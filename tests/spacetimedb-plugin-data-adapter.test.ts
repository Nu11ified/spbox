import { describe, expect, it } from "vitest";
import { FakeSpacetimeClient, SpacetimeRuntimeAdapter } from "../src/spacetime/adapter.js";

describe("SpacetimeRuntimeAdapter plugin data cache", () => {
  it("caches plugin schemas and namespaced entities from subscriptions", async () => {
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
          id: "entity-2",
          pluginId: "mechanic_core",
          entityType: "work_order",
          ownerType: "character",
          ownerId: "char:2",
          dataJson: "{\"status\":\"closed\"}",
          createdAt: new Date("2026-05-18T11:00:00.000Z"),
          updatedAt: new Date("2026-05-18T11:30:00.000Z")
        },
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
    const adapter = new SpacetimeRuntimeAdapter(client);

    await adapter.connectAndSubscribe("server-1");

    expect(client.subscribedTables).toContain("plugin_schemas");
    expect(client.subscribedTables).toContain("plugin_entities");
    expect(adapter.cache.getPluginSchema("mechanic_core", "work_order", 1)).toEqual(
      expect.objectContaining({
        id: "mechanic_core:work_order:1",
        schemaJson: "{\"type\":\"object\",\"required\":[\"status\"]}"
      })
    );
    expect(adapter.cache.getPluginEntity("entity-1")).toEqual(
      expect.objectContaining({
        pluginId: "mechanic_core",
        ownerId: "char:1"
      })
    );
    expect(adapter.cache.getPluginEntities("mechanic_core", "work_order").map((row) => row.id)).toEqual([
      "entity-1",
      "entity-2"
    ]);

    client.emitUpdate("plugin_entities", {
      id: "entity-1",
      pluginId: "mechanic_core",
      entityType: "work_order",
      ownerType: "character",
      ownerId: "char:1",
      dataJson: "{\"status\":\"assigned\"}",
      createdAt: new Date("2026-05-18T10:00:00.000Z"),
      updatedAt: new Date("2026-05-18T12:30:00.000Z")
    });

    expect(adapter.cache.getPluginEntity("entity-1")?.dataJson).toBe("{\"status\":\"assigned\"}");
  });
});
