import { describe, expect, it } from "vitest";
import { FakeSpacetimeClient, SpacetimeRuntimeAdapter } from "../src/spacetime/adapter.js";
import { PermissionEngine } from "../src/core/permissions.js";

describe("SpacetimeRuntimeAdapter menu cache", () => {
  it("caches menu registry rows and keeps sessions scoped to the connected server", async () => {
    const client = new FakeSpacetimeClient({
      menu_definitions: [
        {
          id: "menu:admin.vehicle",
          pluginId: "admin_tools",
          label: "Vehicle",
          parentId: "",
          icon: "car",
          order: 20,
          requiredPermission: "menu.vehicle",
          actionId: "action:vehicle.repair",
          enabled: true,
          visibilityPolicyId: "policy:on-duty"
        }
      ],
      menu_actions: [
        {
          id: "action:vehicle.repair",
          pluginId: "admin_tools",
          actionType: "vehicle.repair",
          reducerName: "submit_action",
          payloadSchemaJson: "{\"type\":\"object\"}",
          confirmationRequired: false,
          auditLevel: "standard",
          requiredPermission: "vehicle.repair",
          enabled: true
        }
      ],
      runtime_commands: [
        {
          id: "command:vehicle.repair",
          pluginId: "admin_tools",
          name: "sdb_repair",
          aliasesJson: "[\"repairveh\"]",
          actionId: "action:vehicle.repair",
          requiredPermission: "command.vehicle.repair",
          payloadSchemaJson: "{\"type\":\"object\"}",
          auditLevel: "standard",
          enabled: true
        }
      ],
      runtime_panels: [
        {
          id: "panel:mechanic.work_orders",
          pluginId: "admin_tools",
          title: "Work Orders",
          route: "/plugins/mechanic/work-orders",
          requiredPermission: "mechanic.repair",
          icon: "clipboard-list",
          order: 20,
          enabled: true
        }
      ],
      menu_visibility_policies: [
        {
          id: "policy:on-duty",
          pluginId: "admin_tools",
          policyJson: "{\"state\":\"on_duty\"}",
          enabled: true
        }
      ],
      menu_sessions: [
        {
          id: "session:server-1:player-1",
          serverId: "server-1",
          playerId: "player:1",
          cacheVersion: 5
        },
        {
          id: "session:server-2:player-1",
          serverId: "server-2",
          playerId: "player:1",
          cacheVersion: 8
        }
      ]
    });
    const adapter = new SpacetimeRuntimeAdapter(client);

    await adapter.connectAndSubscribe("server-1");

    expect(adapter.cache.getMenuDefinition("menu:admin.vehicle")).toEqual(
      expect.objectContaining({
        actionId: "action:vehicle.repair",
        pluginId: "admin_tools"
      })
    );
    expect(adapter.cache.getMenuDefinitionsForPlugin("admin_tools").map((row) => row.id)).toEqual([
      "menu:admin.vehicle"
    ]);
    expect(adapter.cache.getMenuAction("action:vehicle.repair")).toEqual(
      expect.objectContaining({
        actionType: "vehicle.repair",
        requiredPermission: "vehicle.repair"
      })
    );
    expect(adapter.cache.getMenuActionsForPlugin("admin_tools").map((row) => row.id)).toEqual([
      "action:vehicle.repair"
    ]);
    expect(adapter.cache.getRuntimeCommand("command:vehicle.repair")).toEqual(
      expect.objectContaining({
        name: "sdb_repair",
        aliasesJson: "[\"repairveh\"]",
        actionId: "action:vehicle.repair"
      })
    );
    expect(adapter.cache.getRuntimeCommandsForPlugin("admin_tools").map((row) => row.id)).toEqual([
      "command:vehicle.repair"
    ]);
    expect(adapter.cache.getRuntimePanel("panel:mechanic.work_orders")).toEqual(
      expect.objectContaining({
        title: "Work Orders",
        route: "/plugins/mechanic/work-orders",
        requiredPermission: "mechanic.repair"
      })
    );
    expect(adapter.cache.getRuntimePanelsForPlugin("admin_tools").map((row) => row.id)).toEqual([
      "panel:mechanic.work_orders"
    ]);
    expect(adapter.cache.getMenuVisibilityPolicy("policy:on-duty")).toEqual(
      expect.objectContaining({ pluginId: "admin_tools" })
    );
    expect(adapter.cache.getMenuSession("session:server-1:player-1")?.cacheVersion).toBe(5);
    expect(adapter.cache.getMenuSession("session:server-2:player-1")).toBeUndefined();

    client.emitUpdate("menu_sessions", {
      id: "session:server-2:player-2",
      serverId: "server-2",
      playerId: "player:2",
      cacheVersion: 9
    });
    client.emitUpdate("menu_sessions", {
      id: "session:server-1:player-2",
      serverId: "server-1",
      playerId: "player:2",
      cacheVersion: 6
    });

    expect(adapter.cache.getMenuSession("session:server-2:player-2")).toBeUndefined();
    expect(adapter.cache.getMenuSessionsForPlayer("player:2").map((row) => row.id)).toEqual([
      "session:server-1:player-2"
    ]);
  });

  it("builds policy-aware MenuRuntime instances from cached menu rows", async () => {
    const client = new FakeSpacetimeClient({
      menu_definitions: [
        {
          id: "menu:root",
          pluginId: "admin_tools",
          label: "Admin",
          parentId: "",
          icon: "",
          order: 0,
          requiredPermission: "",
          actionId: "",
          enabled: true,
          visibilityPolicyId: ""
        },
        {
          id: "menu:mechanic",
          pluginId: "mechanic_core",
          label: "Mechanic",
          parentId: "menu:root",
          icon: "wrench",
          order: 10,
          requiredPermission: "menu.mechanic",
          actionId: "action:mechanic.repair",
          enabled: true,
          visibilityPolicyId: "policy:on-duty"
        }
      ],
      menu_actions: [
        {
          id: "action:mechanic.repair",
          pluginId: "mechanic_core",
          actionType: "runtime_action",
          reducerName: "repair_vehicle",
          payloadSchemaJson: "{\"type\":\"object\",\"required\":[\"targetVehicleNetId\"],\"properties\":{\"targetVehicleNetId\":{\"type\":\"number\"}}}",
          confirmationRequired: false,
          auditLevel: "standard",
          requiredPermission: "menu.mechanic",
          enabled: true
        }
      ],
      menu_visibility_policies: [
        {
          id: "policy:on-duty",
          pluginId: "mechanic_core",
          policyJson: "{\"requiresState\":{\"key\":\"onDuty\",\"equals\":true}}",
          enabled: true
        }
      ]
    });
    const adapter = new SpacetimeRuntimeAdapter(client);
    await adapter.connectAndSubscribe("server-1");
    const permissions = new PermissionEngine({
      principals: [],
      edges: [],
      grants: [
        {
          principalId: "player:1",
          permissionKey: "menu.mechanic",
          effect: "allow",
          source: "manual"
        }
      ]
    });

    const runtime = adapter.cache.buildMenuRuntime(permissions);

    expect(runtime.buildTreeForPrincipal("player:1", { state: { onDuty: false } })).toEqual([
      expect.objectContaining({
        id: "menu:root",
        children: []
      })
    ]);
    expect(runtime.buildTreeForPrincipal("player:1", { state: { onDuty: true } })).toEqual([
      expect.objectContaining({
        id: "menu:root",
        children: [
          expect.objectContaining({
            id: "menu:mechanic",
            icon: "wrench",
            actionId: "action:mechanic.repair"
          })
        ]
      })
    ]);
    await expect(runtime.executeAction("player:1", "action:mechanic.repair", {})).rejects.toThrow(
      "Missing required field: targetVehicleNetId"
    );
  });
});
