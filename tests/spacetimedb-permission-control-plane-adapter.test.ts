import { describe, expect, it } from "vitest";
import { FakeSpacetimeClient, SpacetimeRuntimeAdapter } from "../src/spacetime/adapter.js";

describe("SpacetimeRuntimeAdapter permission control-plane reducers", () => {
  it("subscribes to permission definition and ACE mirror tables", async () => {
    const client = new FakeSpacetimeClient({
      principals: [
        {
          id: "player:license:abc",
          principalType: "player",
          externalId: "license:abc",
          name: "Player ABC",
          createdAt: new Date("2026-05-18T12:00:00.000Z")
        },
        {
          id: "group.staff",
          principalType: "group",
          externalId: "staff",
          name: "Staff",
          createdAt: new Date("2026-05-18T12:00:00.000Z")
        }
      ],
      principal_edges: [
        {
          id: "edge:player:staff",
          parentPrincipalId: "group.staff",
          childPrincipalId: "player:license:abc",
          source: "discord",
          expiresAt: new Date("2026-05-18T14:00:00.000Z")
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
      permission_cache_versions: [
        {
          serverId: "server-1",
          version: 3,
          updatedAt: new Date("2026-05-18T12:00:00.000Z")
        },
        {
          serverId: "server-2",
          version: 9,
          updatedAt: new Date("2026-05-18T12:00:00.000Z")
        }
      ],
      ace_mirror_rules: [
        {
          id: "ace:vehicle.repair",
          permissionKey: "vehicle.repair",
          aceObject: "sdb.vehicle.repair",
          enabled: true,
          mode: "allow_and_deny"
        }
      ],
      policy_constraints: [
        {
          id: "policy:mechanic-duty",
          permissionKey: "vehicle.repair",
          constraintType: "requires_state",
          constraintJson: "{\"key\":\"job:on_duty\",\"equals\":true}",
          priority: 20,
          enabled: true
        },
        {
          id: "policy:repair-limit",
          permissionKey: "vehicle.repair",
          constraintType: "max_amount",
          constraintJson: "{\"amount\":1000}",
          priority: 10,
          enabled: false
        }
      ]
    });
    const adapter = new SpacetimeRuntimeAdapter(client);

    await adapter.connectAndSubscribe("server-1");

    expect(client.subscribedTables).toContain("principals");
    expect(client.subscribedTables).toContain("principal_edges");
    expect(client.subscribedTables).toContain("permission_grants");
    expect(client.subscribedTables).toContain("permissions");
    expect(client.subscribedTables).toContain("permission_cache_versions");
    expect(client.subscribedTables).toContain("ace_mirror_rules");
    expect(client.subscribedTables).toContain("policy_constraints");
    expect(adapter.cache.getPrincipal("player:license:abc")).toEqual(
      expect.objectContaining({
        principalType: "player",
        externalId: "license:abc"
      })
    );
    expect(adapter.cache.getPrincipalEdgesForChild("player:license:abc").map((row) => row.id)).toEqual([
      "edge:player:staff"
    ]);
    expect(adapter.cache.getPermissionGrantsForPrincipal("group.staff").map((row) => row.permissionKey)).toEqual([
      "vehicle.repair"
    ]);
    expect(adapter.cache.getPermission("vehicle.repair")).toEqual(expect.objectContaining({
      id: "perm:vehicle.repair",
      pluginId: "mechanic_core"
    }));
    expect(adapter.cache.getPermissionCacheVersion("server-1")?.version).toBe(3);
    expect(adapter.cache.getPermissionCacheVersion("server-2")).toBeUndefined();
    expect(adapter.cache.getAceMirrorRules()).toEqual([
      expect.objectContaining({
        id: "ace:vehicle.repair",
        aceObject: "sdb.vehicle.repair"
      })
    ]);
    expect(adapter.cache.getPolicyConstraint("policy:mechanic-duty")).toEqual(
      expect.objectContaining({
        permissionKey: "vehicle.repair",
        constraintType: "requires_state"
      })
    );
    expect(adapter.cache.getPolicyConstraintsForPermission("vehicle.repair").map((row) => row.id)).toEqual([
      "policy:repair-limit",
      "policy:mechanic-duty"
    ]);

    client.emitUpdate("permission_cache_versions", {
      serverId: "server-2",
      version: 10,
      updatedAt: new Date("2026-05-18T12:01:00.000Z")
    });
    client.emitUpdate("permission_cache_versions", {
      serverId: "server-1",
      version: 4,
      updatedAt: new Date("2026-05-18T12:02:00.000Z")
    });
    client.emitUpdate("policy_constraints", {
      id: "policy:mechanic-duty",
      permissionKey: "vehicle.repair",
      constraintType: "requires_state",
      constraintJson: "{\"key\":\"job:on_duty\",\"equals\":false}",
      priority: 30,
      enabled: true
    });
    client.emitUpdate("permission_grants", {
      id: "grant:staff:spawn",
      principalId: "group.staff",
      permissionKey: "vehicle.spawn",
      effect: "allow",
      source: "manual"
    });

    expect(adapter.cache.getPermissionCacheVersion("server-1")?.version).toBe(4);
    expect(adapter.cache.getPermissionCacheVersion("server-2")).toBeUndefined();
    expect(adapter.cache.getPolicyConstraint("policy:mechanic-duty")?.constraintJson).toBe(
      "{\"key\":\"job:on_duty\",\"equals\":false}"
    );
    expect(adapter.cache.getPermissionGrantsForPrincipal("group.staff").map((row) => row.permissionKey)).toEqual([
      "vehicle.repair",
      "vehicle.spawn"
    ]);
  });

  it("calls permission definition, cache ack, and ACE mirror reducers", async () => {
    const client = new FakeSpacetimeClient({});
    const adapter = new SpacetimeRuntimeAdapter(client);

    await adapter.registerPermission({
      id: "perm:vehicle.repair",
      key: "vehicle.repair",
      description: "Repair vehicles",
      pluginId: "mechanic_core"
    });
    await adapter.ackPermissionCacheVersion({
      serverId: "server-1",
      version: 3
    });
    await adapter.upsertAceMirrorRule({
      id: "ace:vehicle.repair",
      permissionKey: "vehicle.repair",
      aceObject: "sdb.vehicle.repair",
      enabled: true,
      mode: "allow_and_deny"
    });

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
        name: "ack_permission_cache_version",
        args: {
          serverId: "server-1",
          version: 3
        }
      },
      {
        name: "upsert_ace_mirror_rule",
        args: {
          id: "ace:vehicle.repair",
          permissionKey: "vehicle.repair",
          aceObject: "sdb.vehicle.repair",
          enabled: true,
          mode: "allow_and_deny"
        }
      }
    ]);
  });
});
