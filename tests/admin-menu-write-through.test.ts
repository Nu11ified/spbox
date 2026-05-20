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

describe("AdminService menu write-through", () => {
  it("serves menu registry reads from SpacetimeDB live cache", async () => {
    const client = new FakeSpacetimeClient({
      menu_definitions: [
        {
          id: "vehicle.repair.menu",
          pluginId: "admin_tools",
          label: "Repair Vehicle",
          parentId: "vehicle",
          icon: "wrench",
          order: 10,
          requiredPermission: "menu.vehicle.repair",
          actionId: "vehicle.repair",
          enabled: true,
          visibilityPolicyId: "staff-only"
        }
      ],
      menu_actions: [
        {
          id: "vehicle.repair",
          pluginId: "admin_tools",
          actionType: "runtime_action",
          reducerName: "repair_vehicle",
          payloadSchemaJson: "{\"type\":\"object\"}",
          confirmationRequired: false,
          auditLevel: "standard",
          requiredPermission: "menu.vehicle.repair",
          enabled: true
        }
      ],
      runtime_commands: [
        {
          id: "command.vehicle.repair",
          pluginId: "admin_tools",
          name: "sdb_repair",
          aliasesJson: "[\"repairveh\"]",
          actionId: "vehicle.repair",
          requiredPermission: "command.vehicle.repair",
          payloadSchemaJson: "{\"type\":\"object\"}",
          auditLevel: "standard",
          enabled: true
        }
      ],
      runtime_panels: [
        {
          id: "panel.mechanic.work_orders",
          pluginId: "mechanic_core",
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
          id: "staff-only",
          pluginId: "admin_tools",
          policyJson: "{\"requiredDuty\":true}",
          enabled: true
        }
      ],
      menu_sessions: [
        {
          id: "session-1",
          serverId: "server-1",
          playerId: "player:1",
          cacheVersion: 3
        },
        {
          id: "session-other-server",
          serverId: "server-2",
          playerId: "player:2",
          cacheVersion: 9
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

    await expect(api.handle({ method: "GET", path: "/menus" })).resolves.toEqual({
      status: 200,
      body: {
        definitions: [expect.objectContaining({ id: "vehicle.repair.menu", actionId: "vehicle.repair" })],
        actions: [expect.objectContaining({ id: "vehicle.repair", actionType: "runtime_action" })],
        commands: [expect.objectContaining({ id: "command.vehicle.repair", name: "sdb_repair" })],
        panels: [expect.objectContaining({ id: "panel.mechanic.work_orders", route: "/plugins/mechanic/work-orders" })],
        policies: [expect.objectContaining({ id: "staff-only" })],
        sessions: [expect.objectContaining({ id: "session-1", serverId: "server-1" })]
      }
    });
  });

  it("upserts menu definitions and actions through SpacetimeDB reducers", async () => {
    const { admin, client } = createAdmin();

    await admin.upsertMenuDefinition({
      id: "vehicle.repair.menu",
      pluginId: "admin_tools",
      label: "Repair Vehicle",
      parentId: "vehicle",
      icon: "wrench",
      order: 10,
      requiredPermission: "menu.vehicle.repair",
      actionId: "vehicle.repair",
      enabled: true,
      visibilityPolicyId: ""
    });
    await admin.upsertMenuAction({
      id: "vehicle.repair",
      pluginId: "admin_tools",
      actionType: "runtime_action",
      reducerName: "repair_vehicle",
      payloadSchemaJson: "{\"type\":\"object\"}",
      confirmationRequired: false,
      auditLevel: "standard",
      requiredPermission: "menu.vehicle.repair",
      enabled: true
    });
    await admin.upsertRuntimeCommand({
      id: "command.vehicle.repair",
      pluginId: "admin_tools",
      name: "sdb_repair",
      aliasesJson: "[\"repairveh\"]",
      actionId: "vehicle.repair",
      requiredPermission: "command.vehicle.repair",
      payloadSchemaJson: "{\"type\":\"object\"}",
      auditLevel: "standard",
      enabled: true
    });
    await admin.upsertRuntimePanel({
      id: "panel.mechanic.work_orders",
      pluginId: "mechanic_core",
      title: "Work Orders",
      route: "/plugins/mechanic/work-orders",
      requiredPermission: "mechanic.repair",
      icon: "clipboard-list",
      order: 20,
      enabled: true
    });

    expect(client.reducerCalls).toEqual([
      {
        name: "upsert_menu_definition",
        args: {
          id: "vehicle.repair.menu",
          pluginId: "admin_tools",
          label: "Repair Vehicle",
          parentId: "vehicle",
          icon: "wrench",
          order: 10,
          requiredPermission: "menu.vehicle.repair",
          actionId: "vehicle.repair",
          enabled: true,
          visibilityPolicyId: ""
        }
      },
      {
        name: "upsert_menu_action",
        args: {
          id: "vehicle.repair",
          pluginId: "admin_tools",
          actionType: "runtime_action",
          reducerName: "repair_vehicle",
          payloadSchemaJson: "{\"type\":\"object\"}",
          confirmationRequired: false,
          auditLevel: "standard",
          requiredPermission: "menu.vehicle.repair",
          enabled: true
        }
      },
      {
        name: "upsert_runtime_command",
        args: {
          id: "command.vehicle.repair",
          pluginId: "admin_tools",
          name: "sdb_repair",
          aliasesJson: "[\"repairveh\"]",
          actionId: "vehicle.repair",
          requiredPermission: "command.vehicle.repair",
          payloadSchemaJson: "{\"type\":\"object\"}",
          auditLevel: "standard",
          enabled: true
        }
      },
      {
        name: "upsert_runtime_panel",
        args: {
          id: "panel.mechanic.work_orders",
          pluginId: "mechanic_core",
          title: "Work Orders",
          route: "/plugins/mechanic/work-orders",
          requiredPermission: "mechanic.repair",
          icon: "clipboard-list",
          order: 20,
          enabled: true
        }
      }
    ]);
  });

  it("exposes menu definition, action, command, and panel HTTP routes", async () => {
    const { admin, client } = createAdmin();
    const api = createAdminHttpApi(admin);

    const definition = await api.handle({
      method: "POST",
      path: "/menus/definitions",
      body: {
        id: "vehicle.repair.menu",
        pluginId: "admin_tools",
        label: "Repair Vehicle",
        parentId: "vehicle",
        icon: "wrench",
        order: 10,
        requiredPermission: "menu.vehicle.repair",
        actionId: "vehicle.repair",
        enabled: true,
        visibilityPolicyId: ""
      }
    });
    const action = await api.handle({
      method: "POST",
      path: "/menus/actions",
      body: {
        id: "vehicle.repair",
        pluginId: "admin_tools",
        actionType: "runtime_action",
        reducerName: "repair_vehicle",
        payloadSchemaJson: "{\"type\":\"object\"}",
        confirmationRequired: false,
        auditLevel: "standard",
        requiredPermission: "menu.vehicle.repair",
        enabled: true
      }
    });
    const command = await api.handle({
      method: "POST",
      path: "/menus/commands",
      body: {
        id: "command.vehicle.repair",
        pluginId: "admin_tools",
        name: "sdb_repair",
        aliasesJson: "[\"repairveh\"]",
        actionId: "vehicle.repair",
        requiredPermission: "command.vehicle.repair",
        payloadSchemaJson: "{\"type\":\"object\"}",
        auditLevel: "standard",
        enabled: true
      }
    });
    const panel = await api.handle({
      method: "POST",
      path: "/menus/panels",
      body: {
        id: "panel.mechanic.work_orders",
        pluginId: "mechanic_core",
        title: "Work Orders",
        route: "/plugins/mechanic/work-orders",
        requiredPermission: "mechanic.repair",
        icon: "clipboard-list",
        order: 20,
        enabled: true
      }
    });

    expect(definition).toEqual({ status: 200, body: { ok: true } });
    expect(action).toEqual({ status: 200, body: { ok: true } });
    expect(command).toEqual({ status: 200, body: { ok: true } });
    expect(panel).toEqual({ status: 200, body: { ok: true } });
    expect(client.reducerCalls.map((call) => call.name)).toEqual([
      "upsert_menu_definition",
      "upsert_menu_action",
      "upsert_runtime_command",
      "upsert_runtime_panel"
    ]);
  });

  it("upserts visibility policies and records menu sessions through SpacetimeDB reducers", async () => {
    const { admin, client } = createAdmin();

    await admin.upsertMenuVisibilityPolicy({
      id: "staff-only",
      pluginId: "admin_tools",
      policyJson: "{\"requiredDuty\":true}",
      enabled: true
    });
    await admin.openMenuSession({
      id: "session-1",
      serverId: "server-1",
      playerId: "player:1",
      cacheVersion: 3
    });
    await admin.closeMenuSession("session-1");

    expect(client.reducerCalls).toEqual([
      {
        name: "upsert_menu_visibility_policy",
        args: {
          id: "staff-only",
          pluginId: "admin_tools",
          policyJson: "{\"requiredDuty\":true}",
          enabled: true
        }
      },
      {
        name: "open_menu_session",
        args: {
          id: "session-1",
          serverId: "server-1",
          playerId: "player:1",
          cacheVersion: 3
        }
      },
      {
        name: "close_menu_session",
        args: {
          sessionId: "session-1"
        }
      }
    ]);
  });

  it("exposes menu policy and session HTTP routes", async () => {
    const { admin, client } = createAdmin();
    const api = createAdminHttpApi(admin);

    const policy = await api.handle({
      method: "POST",
      path: "/menus/policies",
      body: {
        id: "staff-only",
        pluginId: "admin_tools",
        policyJson: "{\"requiredDuty\":true}",
        enabled: true
      }
    });
    const session = await api.handle({
      method: "POST",
      path: "/menus/sessions",
      body: {
        id: "session-1",
        serverId: "server-1",
        playerId: "player:1",
        cacheVersion: 3
      }
    });
    const closed = await api.handle({
      method: "POST",
      path: "/menus/sessions/session-1/close"
    });

    expect(policy).toEqual({ status: 200, body: { ok: true } });
    expect(session).toEqual({ status: 200, body: { ok: true } });
    expect(closed).toEqual({ status: 200, body: { ok: true } });
    expect(client.reducerCalls.map((call) => call.name)).toEqual([
      "upsert_menu_visibility_policy",
      "open_menu_session",
      "close_menu_session"
    ]);
  });

  it("plans menu refresh targets from active SpacetimeDB sessions", async () => {
    const client = new FakeSpacetimeClient({
      menu_sessions: [
        {
          id: "session-b",
          serverId: "server-1",
          playerId: "player:2",
          cacheVersion: 4
        },
        {
          id: "session-a",
          serverId: "server-1",
          playerId: "player:1",
          cacheVersion: 3
        },
        {
          id: "session-other-server",
          serverId: "server-2",
          playerId: "player:3",
          cacheVersion: 9
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

    expect(admin.planActiveMenuRefreshes()).toEqual([
      {
        serverId: "server-1",
        playerId: "player:1",
        sessionId: "session-a",
        cacheVersion: 3
      },
      {
        serverId: "server-1",
        playerId: "player:2",
        sessionId: "session-b",
        cacheVersion: 4
      }
    ]);
  });

  it("queues menu refresh targets after plugin lifecycle changes", async () => {
    const client = new FakeSpacetimeClient({
      menu_sessions: [
        {
          id: "session-1",
          serverId: "server-1",
          playerId: "player:1",
          cacheVersion: 3
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

    admin.installPlugin({
      pluginId: "mechanic_core",
      name: "Mechanic Core",
      version: "1.0.0"
    });
    admin.enablePlugin("mechanic_core");
    admin.drainPendingMenuRefreshes();

    admin.disablePlugin("mechanic_core");

    expect(admin.drainPendingMenuRefreshes()).toEqual([
      {
        serverId: "server-1",
        playerId: "player:1",
        sessionId: "session-1",
        cacheVersion: 3
      }
    ]);
    expect(admin.drainPendingMenuRefreshes()).toEqual([]);
  });

  it("exposes planned menu refresh targets over HTTP", async () => {
    const client = new FakeSpacetimeClient({
      menu_sessions: [
        {
          id: "session-1",
          serverId: "server-1",
          playerId: "player:1",
          cacheVersion: 3
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

    await expect(api.handle({ method: "GET", path: "/menus/refresh-targets" })).resolves.toEqual({
      status: 200,
      body: [
        {
          serverId: "server-1",
          playerId: "player:1",
          sessionId: "session-1",
          cacheVersion: 3
        }
      ]
    });
  });

  it("drains queued menu refresh targets over HTTP", async () => {
    const client = new FakeSpacetimeClient({
      menu_sessions: [
        {
          id: "session-1",
          serverId: "server-1",
          playerId: "player:1",
          cacheVersion: 3
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
    const api = createAdminHttpApi(admin);

    admin.installPlugin({
      pluginId: "mechanic_core",
      name: "Mechanic Core",
      version: "1.0.0"
    });

    await expect(api.handle({ method: "POST", path: "/menus/refresh-targets/drain" })).resolves.toEqual({
      status: 200,
      body: [
        {
          serverId: "server-1",
          playerId: "player:1",
          sessionId: "session-1",
          cacheVersion: 3
        }
      ]
    });
    await expect(api.handle({ method: "POST", path: "/menus/refresh-targets/drain" })).resolves.toEqual({
      status: 200,
      body: []
    });
  });

  it("queues and drains replicated state hints over HTTP without accepting authoritative state", async () => {
    const api = createAdminHttpApi(new AdminService({
      runtime: new RuntimeControlPlane(),
      permissions: new PermissionStore(),
      plugins: new PluginRegistry()
    }));

    await expect(api.handle({
      method: "POST",
      path: "/runtime/replicated-state",
      body: {
        updates: [
          {
            serverId: "server-1",
            key: "sdb:economy:enabled",
            value: true
          },
          {
            serverId: "server-2",
            playerId: "player:2",
            key: "sdb:menu:dirty",
            value: true
          }
        ]
      }
    })).resolves.toEqual({
      status: 200,
      body: {
        queued: 2
      }
    });

    await expect(api.handle({
      method: "POST",
      path: "/runtime/replicated-state/drain?serverId=server-1"
    })).resolves.toEqual({
      status: 200,
      body: [
        {
          serverId: "server-1",
          key: "sdb:economy:enabled",
          value: true
        }
      ]
    });
    await expect(api.handle({
      method: "POST",
      path: "/runtime/replicated-state/drain?serverId=server-1"
    })).resolves.toEqual({
      status: 200,
      body: []
    });
    await expect(api.handle({
      method: "POST",
      path: "/runtime/replicated-state",
      body: {
        updates: [
          {
            serverId: "server-1",
            key: "sdb:forbidden",
            value: true,
            authoritative: true
          }
        ]
      }
    })).resolves.toEqual({
      status: 400,
      body: {
        error: "authoritative state cannot be replicated"
      }
    });
  });

  it("queues and drains world-state patches over HTTP", async () => {
    const api = createAdminHttpApi(new AdminService({
      runtime: new RuntimeControlPlane(),
      permissions: new PermissionStore(),
      plugins: new PluginRegistry()
    }));

    await expect(api.handle({
      method: "POST",
      path: "/runtime/world-state",
      body: {
        updates: [
          {
            serverId: "server-1",
            world: {
              weatherType: "EXTRASUNNY"
            }
          },
          {
            serverId: "server-2",
            world: {
              hour: 18,
              minute: 15
            }
          }
        ]
      }
    })).resolves.toEqual({
      status: 200,
      body: {
        queued: 2
      }
    });

    await expect(api.handle({
      method: "POST",
      path: "/runtime/world-state/drain?serverId=server-1"
    })).resolves.toEqual({
      status: 200,
      body: [
        {
          serverId: "server-1",
          world: {
            weatherType: "EXTRASUNNY"
          }
        }
      ]
    });
    await expect(api.handle({
      method: "POST",
      path: "/runtime/world-state/drain?serverId=server-1"
    })).resolves.toEqual({
      status: 200,
      body: []
    });
  });
});
