import { describe, expect, it } from "vitest";
import { createAdminHttpApi } from "../src/admin/http-api.js";
import { AdminService } from "../src/admin/service.js";
import { PermissionStore } from "../src/core/permission-store.js";
import { PluginRegistry } from "../src/core/plugins.js";
import { RuntimeControlPlane } from "../src/core/runtime.js";
import { FakeSpacetimeClient, SpacetimeRuntimeAdapter } from "../src/spacetime/adapter.js";

function createAdmin(client = new FakeSpacetimeClient({})): { admin: AdminService; client: FakeSpacetimeClient } {
  return {
    client,
    admin: new AdminService({
      runtime: new RuntimeControlPlane(),
      permissions: new PermissionStore(),
      plugins: new PluginRegistry(),
      spacetime: new SpacetimeRuntimeAdapter(client)
    })
  };
}

describe("AdminService plugin data write-through", () => {
  it("registers plugin schemas and upserts entities through SpacetimeDB reducers", async () => {
    const { admin, client } = createAdmin();

    await admin.registerPluginSchema({
      pluginId: "mechanic_core",
      schemaVersion: 1,
      entityType: "work_order",
      schemaJson: "{\"type\":\"object\",\"required\":[\"status\"]}",
      migrationPlanJson: "[]",
      status: "active"
    });
    await admin.upsertPluginEntity({
      id: "entity-1",
      pluginId: "mechanic_core",
      entityType: "work_order",
      ownerType: "character",
      ownerId: "char:1",
      dataJson: "{\"status\":\"open\"}"
    });

    expect(client.reducerCalls).toEqual([
      {
        name: "register_plugin_schema",
        args: {
          pluginId: "mechanic_core",
          schemaVersion: 1,
          entityType: "work_order",
          schemaJson: "{\"type\":\"object\",\"required\":[\"status\"]}",
          migrationPlanJson: "[]",
          status: "active"
        }
      },
      {
        name: "upsert_plugin_entity",
        args: {
          id: "entity-1",
          pluginId: "mechanic_core",
          entityType: "work_order",
          ownerType: "character",
          ownerId: "char:1",
          dataJson: "{\"status\":\"open\"}"
        }
      }
    ]);
  });

  it("validates plugin entity payloads against registered schemas before write-through", async () => {
    const { admin, client } = createAdmin();

    await admin.registerPluginSchema({
      pluginId: "mechanic_core",
      schemaVersion: 1,
      entityType: "work_order",
      schemaJson: "{\"type\":\"object\",\"required\":[\"status\"],\"properties\":{\"status\":{\"type\":\"string\"}}}",
      migrationPlanJson: "[]",
      status: "active"
    });

    await expect(
      admin.upsertPluginEntity({
        id: "entity-1",
        pluginId: "mechanic_core",
        entityType: "work_order",
        ownerType: "character",
        ownerId: "char:1",
        dataJson: "{\"status\":123}"
      })
    ).rejects.toThrow("Expected status to be string");

    await admin.upsertPluginEntity({
      id: "entity-2",
      pluginId: "mechanic_core",
      entityType: "work_order",
      ownerType: "character",
      ownerId: "char:1",
      dataJson: "{\"status\":\"open\"}"
    });

    expect(client.reducerCalls.map((call) => call.name)).toEqual([
      "register_plugin_schema",
      "upsert_plugin_entity"
    ]);
    expect(client.reducerCalls[1]?.args).toEqual(expect.objectContaining({ id: "entity-2" }));
  });

  it("validates plugin entity payloads against live cached schemas before write-through", async () => {
    const client = new FakeSpacetimeClient({
      plugin_schemas: [
        {
          id: "mechanic_core:work_order:1",
          pluginId: "mechanic_core",
          schemaVersion: 1,
          entityType: "work_order",
          schemaJson: "{\"type\":\"object\",\"required\":[\"status\"],\"properties\":{\"status\":{\"type\":\"string\"}}}",
          migrationPlanJson: "[]",
          status: "active",
          registeredAt: new Date("2026-05-18T12:00:00.000Z")
        }
      ]
    });
    const spacetime = new SpacetimeRuntimeAdapter(client);
    await spacetime.connectAndSubscribe("server-1");
    const admin = new AdminService({
      runtime: new RuntimeControlPlane(),
      permissions: new PermissionStore(),
      plugins: new PluginRegistry(),
      spacetime
    });

    await expect(
      admin.upsertPluginEntity({
        id: "entity-1",
        pluginId: "mechanic_core",
        entityType: "work_order",
        ownerType: "character",
        ownerId: "char:1",
        dataJson: "{}"
      })
    ).rejects.toThrow("Missing required field: status");

    expect(client.reducerCalls).toEqual([]);
  });

  it("exposes plugin schema and entity HTTP routes", async () => {
    const { admin, client } = createAdmin();
    const api = createAdminHttpApi(admin);

    const schema = await api.handle({
      method: "POST",
      path: "/plugins/schemas",
      body: {
        pluginId: "mechanic_core",
        schemaVersion: 1,
        entityType: "work_order",
        schemaJson: "{\"type\":\"object\"}",
        migrationPlanJson: "[]",
        status: "active"
      }
    });
    const entity = await api.handle({
      method: "POST",
      path: "/plugins/entities",
      body: {
        id: "entity-1",
        pluginId: "mechanic_core",
        entityType: "work_order",
        ownerType: "character",
        ownerId: "char:1",
        dataJson: "{\"status\":\"open\"}"
      }
    });

    expect(schema).toEqual({ status: 200, body: { ok: true } });
    expect(entity).toEqual({ status: 200, body: { ok: true } });
    expect(client.reducerCalls.map((call) => call.name)).toEqual([
      "register_plugin_schema",
      "upsert_plugin_entity"
    ]);
  });

  it("rejects unsafe plugin schema migration plans before write-through", async () => {
    const { admin, client } = createAdmin();
    const api = createAdminHttpApi(admin);

    await expect(
      admin.registerPluginSchema({
        pluginId: "mechanic_core",
        schemaVersion: 1,
        entityType: "work_order",
        schemaJson: "{\"type\":\"object\"}",
        migrationPlanJson: "[{\"step\":\"run_sql\",\"sql\":\"drop table accounts\"}]",
        status: "active"
      })
    ).rejects.toThrow("Plugin schema work_order migration step run_sql is not supported");

    const response = await api.handle({
      method: "POST",
      path: "/plugins/schemas",
      body: {
        pluginId: "mechanic_core",
        schemaVersion: 1,
        entityType: "work_order",
        schemaJson: "{\"type\":\"object\"}",
        migrationPlanJson: "[{\"step\":\"create_json_entity_type\",\"entityType\":\"invoice\"}]",
        status: "active"
      }
    });

    expect(response).toEqual({
      status: 400,
      body: { error: "Plugin schema work_order migration step create_json_entity_type targets invoice" }
    });
    expect(client.reducerCalls).toEqual([]);
  });

  it("serves plugin schema and entity reads from SpacetimeDB live cache", async () => {
    const client = new FakeSpacetimeClient({
      plugin_schemas: [
        {
          id: "mechanic_core:work_order:1",
          pluginId: "mechanic_core",
          schemaVersion: 1,
          entityType: "work_order",
          schemaJson: "{\"type\":\"object\",\"required\":[\"status\"]}",
          migrationPlanJson: "[]",
          status: "active",
          registeredAt: new Date("2026-05-18T12:00:00.000Z")
        }
      ],
      plugin_entities: [
        {
          id: "entity-1",
          pluginId: "mechanic_core",
          entityType: "work_order",
          ownerType: "character",
          ownerId: "char:1",
          dataJson: "{\"status\":\"open\"}",
          createdAt: new Date("2026-05-18T10:00:00.000Z"),
          updatedAt: new Date("2026-05-18T10:30:00.000Z")
        },
        {
          id: "invoice-1",
          pluginId: "economy_core",
          entityType: "invoice_template",
          ownerType: "plugin",
          ownerId: "economy_core",
          dataJson: "{\"label\":\"Repair\"}",
          createdAt: new Date("2026-05-18T09:00:00.000Z"),
          updatedAt: new Date("2026-05-18T09:30:00.000Z")
        }
      ]
    });
    const spacetime = new SpacetimeRuntimeAdapter(client);
    await spacetime.connectAndSubscribe("server-1");
    const api = createAdminHttpApi(new AdminService({
      runtime: new RuntimeControlPlane(),
      permissions: new PermissionStore(),
      plugins: new PluginRegistry(),
      spacetime
    }));

    await expect(api.handle({
      method: "GET",
      path: "/plugins/data?pluginId=mechanic_core&entityType=work_order"
    })).resolves.toEqual({
      status: 200,
      body: {
        schemas: [expect.objectContaining({ id: "mechanic_core:work_order:1", entityType: "work_order" })],
        entities: [expect.objectContaining({ id: "entity-1", dataJson: "{\"status\":\"open\"}" })]
      }
    });
  });
});
