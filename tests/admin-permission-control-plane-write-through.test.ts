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

describe("admin permission control-plane write-through", () => {
  it("serves permission graph reads from SpacetimeDB live cache", async () => {
    const client = new FakeSpacetimeClient({
      principals: [
        {
          id: "player:license:abc",
          principalType: "player",
          externalId: "license:abc",
          name: "Ada",
          createdAt: new Date("2026-05-18T12:00:00.000Z")
        }
      ],
      principal_edges: [
        {
          id: "edge:staff:ada",
          parentPrincipalId: "group.staff",
          childPrincipalId: "player:license:abc",
          source: "manual"
        }
      ],
      permission_grants: [
        {
          id: "grant:staff:repair",
          principalId: "group.staff",
          permissionKey: "vehicle.repair",
          effect: "allow",
          source: "manual"
        }
      ],
      permissions: [
        {
          id: "perm:vehicle.repair",
          key: "vehicle.repair",
          description: "Repair vehicles",
          pluginId: "mechanic_core"
        }
      ],
      ace_mirror_rules: [
        {
          id: "ace:vehicle.repair",
          permissionKey: "vehicle.repair",
          aceObject: "sdb.vehicle.repair",
          enabled: true,
          mode: "allow_only"
        }
      ],
      policy_constraints: [
        {
          id: "policy:repair-duty",
          permissionKey: "vehicle.repair",
          constraintType: "requires_state",
          constraintJson: "{\"key\":\"job:on_duty\",\"equals\":true}",
          priority: 10,
          enabled: true
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

    await expect(api.handle({ method: "GET", path: "/permissions" })).resolves.toEqual({
      status: 200,
      body: {
        principals: [expect.objectContaining({ id: "player:license:abc", type: "player" })],
        edges: [expect.objectContaining({ parentPrincipalId: "group.staff" })],
        grants: [expect.objectContaining({ permissionKey: "vehicle.repair", effect: "allow" })],
        permissions: [expect.objectContaining({ key: "vehicle.repair" })],
        aceMirrorRules: [expect.objectContaining({ aceObject: "sdb.vehicle.repair" })],
        policies: [
          expect.objectContaining({
            id: "policy:repair-duty",
            constraint: { key: "job:on_duty", equals: true }
          })
        ]
      }
    });
  });

  it("mirrors permission definitions, cache acks, and ACE mirror rules through SpacetimeDB", async () => {
    const { admin, client } = createAdmin();

    admin.registerPermissionDefinition({
      id: "perm:vehicle.repair",
      key: "vehicle.repair",
      description: "Repair vehicles",
      pluginId: "mechanic_core"
    });
    admin.upsertAceMirrorRule({
      id: "ace:vehicle.repair",
      permissionKey: "vehicle.repair",
      aceObject: "sdb.vehicle.repair",
      enabled: true,
      mode: "allow_only"
    });
    admin.ackPermissionCacheVersion("server-1", 4);

    await admin.flushWrites();

    expect(client.reducerCalls).toEqual([
      {
        name: "register_permission",
        args: {
          id: "perm:vehicle.repair",
          key: "vehicle.repair",
          description: "Repair vehicles",
          pluginId: "mechanic_core"
        }
      },
      {
        name: "upsert_ace_mirror_rule",
        args: {
          id: "ace:vehicle.repair",
          permissionKey: "vehicle.repair",
          aceObject: "sdb.vehicle.repair",
          enabled: true,
          mode: "allow_only"
        }
      },
      {
        name: "ack_permission_cache_version",
        args: {
          serverId: "server-1",
          version: 4
        }
      }
    ]);
  });

  it("exposes permission definition and ACE mirror HTTP routes", async () => {
    const { admin, client } = createAdmin();
    const api = createAdminHttpApi(admin);

    const permission = await api.handle({
      method: "POST",
      path: "/permissions/definitions",
      body: {
        id: "perm:economy.transfer",
        key: "economy.transfer",
        description: "Transfer money",
        pluginId: "economy_core"
      }
    });
    const ace = await api.handle({
      method: "POST",
      path: "/permissions/ace-rules",
      body: {
        id: "ace:economy.transfer",
        permissionKey: "economy.transfer",
        aceObject: "sdb.economy.transfer",
        enabled: true,
        mode: "allow_and_deny"
      }
    });

    expect(permission).toEqual({ status: 200, body: { ok: true } });
    expect(ace).toEqual({ status: 200, body: { ok: true } });
    expect(client.reducerCalls.map((call) => call.name)).toEqual([
      "register_permission",
      "upsert_ace_mirror_rule"
    ]);
  });
});
