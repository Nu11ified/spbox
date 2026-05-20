import { describe, expect, it } from "vitest";
import { RuntimeBridge } from "../src/runtime/bridge.js";
import { verifyActionEnvelopeSignature } from "../src/core/actions.js";
import { RuntimeCommandRegistry, type RuntimeCommandDefinition } from "../src/core/commands.js";
import { MenuRuntime, type MenuAction, type MenuDefinition } from "../src/core/menu.js";
import { PermissionStore } from "../src/core/permission-store.js";
import { RuntimeControlPlane, verifyHeartbeatSignature } from "../src/core/runtime.js";

function createBridge(options: {
  heartbeatSecret?: string;
  requireSignedHeartbeats?: boolean;
  actionSecret?: string;
  requireSignedActions?: boolean;
  serverCommandExecutor?: (command: string) => unknown;
  allowedServerCommandPrefixes?: string[];
  reducerDispatcher?: (reducerName: string, payload: unknown) => unknown;
  serverHandlerDispatcher?: (handlerName: string, principalId: string, payload: unknown) => unknown;
  clientEventDispatcher?: (eventName: string, targetPrincipalId: string, payload: unknown) => unknown;
  vehicleSpawnDispatcher?: (principalId: string, payload: unknown) => unknown;
  worldStateDispatcher?: (principalId: string, payload: unknown) => unknown;
  teleportDispatcher?: (principalId: string, payload: unknown) => unknown;
  kickDispatcher?: (principalId: string, payload: unknown) => unknown;
  vehicleRepairDispatcher?: (principalId: string, payload: unknown) => unknown;
  economyAdminAdjustDispatcher?: (principalId: string, payload: unknown) => unknown;
  pluginStatusDispatcher?: (principalId: string, payload: unknown) => unknown;
} = {}) {
  let nextId = 0;
  const heartbeatSecret = options.heartbeatSecret ?? "heartbeat-secret";
  const actionSecret = options.actionSecret ?? "action-secret";
  const runtime = new RuntimeControlPlane({
    now: () => new Date("2026-05-18T12:00:00.000Z"),
    idFactory: () => `id-${++nextId}`,
    heartbeatSignatureVerifier: options.requireSignedHeartbeats
      ? (server, heartbeat) => verifyHeartbeatSignature(server, heartbeat, heartbeatSecret)
      : undefined,
    actionSignatureVerifier: options.requireSignedActions
      ? (envelope) => verifyActionEnvelopeSignature(envelope, actionSecret)
      : undefined
  });
  runtime.registerServer({
    id: "server-1",
    name: "Roleplay Dev",
    environment: "development",
    publicKey: "public-key"
  });
  runtime.setRuntimeConfig({
    serverId: "server-1",
    namespace: "economy",
    key: "enabled",
    value: true
  });

  const permissions = new PermissionStore({
    now: () => new Date("2026-05-18T12:00:00.000Z")
  });
  permissions.grantPermission({
    principalId: "player:1",
    permissionKey: "menu.vehicle.repair",
    effect: "allow",
    source: "manual"
  });
  permissions.grantPermission({
    principalId: "player:1",
    permissionKey: "command.vehicle.repair",
    effect: "allow",
    source: "manual"
  });
  permissions.grantPermission({
    principalId: "player:1",
    permissionKey: "runtime.config.set",
    effect: "allow",
    source: "manual"
  });
  permissions.grantPermission({
    principalId: "player:1",
    permissionKey: "runtime.health.view",
    effect: "allow",
    source: "manual"
  });
  permissions.grantPermission({
    principalId: "player:1",
    permissionKey: "server.command.execute",
    effect: "allow",
    source: "manual"
  });
  permissions.grantPermission({
    principalId: "player:1",
    permissionKey: "features.toggle",
    effect: "allow",
    source: "manual"
  });
  permissions.grantPermission({
    principalId: "player:1",
    permissionKey: "economy.admin.adjust_balance",
    effect: "allow",
    source: "manual"
  });
  permissions.grantPermission({
    principalId: "player:1",
    permissionKey: "server.handler.trigger",
    effect: "allow",
    source: "manual"
  });
  permissions.grantPermission({
    principalId: "player:1",
    permissionKey: "client.event.trigger",
    effect: "allow",
    source: "manual"
  });
  permissions.grantPermission({
    principalId: "player:1",
    permissionKey: "admin.vehicles.spawn",
    effect: "allow",
    source: "manual"
  });
  permissions.grantPermission({
    principalId: "player:1",
    permissionKey: "admin.vehicles.repair",
    effect: "allow",
    source: "manual"
  });
  permissions.grantPermission({
    principalId: "player:1",
    permissionKey: "admin.world.weather",
    effect: "allow",
    source: "manual"
  });
  permissions.grantPermission({
    principalId: "player:1",
    permissionKey: "admin.world.time",
    effect: "allow",
    source: "manual"
  });
  permissions.grantPermission({
    principalId: "player:1",
    permissionKey: "admin.teleport.to_marker",
    effect: "allow",
    source: "manual"
  });
  permissions.grantPermission({
    principalId: "player:1",
    permissionKey: "admin.players.kick",
    effect: "allow",
    source: "manual"
  });
  permissions.grantPermission({
    principalId: "player:1",
    permissionKey: "plugins.manage",
    effect: "allow",
    source: "manual"
  });
  permissions.grantPermission({
    principalId: "player:1",
    permissionKey: "custom.reducer.call",
    effect: "allow",
    source: "manual"
  });
  const actions: MenuAction[] = [
    {
      id: "vehicle.repair",
      pluginId: "admin_tools",
      actionType: "runtime_action",
      reducerName: "repair_vehicle",
      requiredPermission: "menu.vehicle.repair",
      payloadSchema: {
        type: "object",
        required: ["targetVehicleNetId"],
        properties: {
          targetVehicleNetId: { type: "number" }
        }
      },
      auditLevel: "standard",
      enabled: true
    },
    {
      id: "runtime.config.set",
      pluginId: "admin_tools",
      actionType: "set_runtime_config",
      requiredPermission: "runtime.config.set",
      payloadSchema: {
        type: "object",
        required: ["namespace", "key", "value"],
        properties: {
          namespace: { type: "string" },
          key: { type: "string" }
        }
      },
      confirmationRequired: true,
      auditLevel: "high",
      enabled: true
    },
    {
      id: "runtime.health.panel",
      pluginId: "admin_tools",
      actionType: "open_panel",
      requiredPermission: "runtime.health.view",
      payloadSchema: {
        type: "object",
        properties: {
          panelId: { type: "string" },
          route: { type: "string" }
        }
      },
      auditLevel: "standard",
      enabled: true
    },
    {
      id: "server.command.weather",
      pluginId: "admin_tools",
      actionType: "execute_server_command",
      requiredPermission: "server.command.execute",
      payloadSchema: {
        type: "object",
        required: ["command"],
        properties: {
          command: { type: "string" }
        }
      },
      confirmationRequired: true,
      auditLevel: "high",
      enabled: true
    },
    {
      id: "features.toggle",
      pluginId: "admin_tools",
      actionType: "toggle_feature",
      requiredPermission: "features.toggle",
      payloadSchema: {
        type: "object",
        required: ["key"],
        properties: {
          namespace: { type: "string" },
          key: { type: "string" },
          enabled: { type: "boolean" }
        }
      },
      confirmationRequired: true,
      auditLevel: "standard",
      enabled: true
    },
    {
      id: "economy.admin.adjust_balance",
      pluginId: "admin_tools",
      actionType: "economy_admin_adjust_balance",
      requiredPermission: "economy.admin.adjust_balance",
      payloadSchema: {
        type: "object",
        required: ["accountId", "direction", "amount", "currency", "reason", "idempotencyKey"],
        properties: {
          accountId: { type: "string" },
          direction: { type: "string" },
          amount: { type: "number" },
          currency: { type: "string" },
          reason: { type: "string" },
          idempotencyKey: { type: "string" }
        }
      },
      confirmationRequired: true,
      auditLevel: "high",
      enabled: true
    },
    {
      id: "plugins.status.set",
      pluginId: "admin_tools",
      actionType: "set_plugin_status",
      requiredPermission: "plugins.manage",
      payloadSchema: {
        type: "object",
        required: ["pluginId", "status"],
        properties: {
          pluginId: { type: "string" },
          status: { type: "string" }
        }
      },
      confirmationRequired: true,
      auditLevel: "high",
      enabled: true
    },
    {
      id: "custom.reducer.run",
      pluginId: "admin_tools",
      actionType: "call_reducer",
      reducerName: "custom_reducer",
      requiredPermission: "custom.reducer.call",
      payloadSchema: {
        type: "object",
        required: ["value"],
        properties: {
          value: { type: "string" }
        }
      },
      auditLevel: "standard",
      enabled: true
    },
    {
      id: "server.handler.announce",
      pluginId: "admin_tools",
      actionType: "trigger_server_handler",
      reducerName: "announce_handler",
      requiredPermission: "server.handler.trigger",
      payloadSchema: {
        type: "object",
        required: ["message"],
        properties: {
          message: { type: "string" }
        }
      },
      auditLevel: "standard",
      enabled: true
    },
    {
      id: "client.event.highlight",
      pluginId: "admin_tools",
      actionType: "trigger_client_event",
      reducerName: "sdb_runtime:highlightTarget",
      requiredPermission: "client.event.trigger",
      payloadSchema: {
        type: "object",
        required: ["targetPlayerId"],
        properties: {
          targetPlayerId: { type: "string" },
          color: { type: "string" }
        }
      },
      auditLevel: "standard",
      enabled: true
    },
    {
      id: "admin.players.kick",
      pluginId: "admin_tools",
      actionType: "kick_player",
      requiredPermission: "admin.players.kick",
      payloadSchema: {
        type: "object",
        required: ["targetSource", "reason"],
        properties: {
          targetSource: { type: "string" },
          reason: { type: "string" }
        }
      },
      confirmationRequired: true,
      auditLevel: "high",
      enabled: true
    },
    {
      id: "admin.vehicles.repair",
      pluginId: "admin_tools",
      actionType: "repair_vehicle",
      requiredPermission: "admin.vehicles.repair",
      payloadSchema: {
        type: "object",
        required: ["targetSource", "targetVehicleNetId"],
        properties: {
          targetSource: { type: "string" },
          targetVehicleNetId: { type: "number" }
        }
      },
      auditLevel: "standard",
      enabled: true
    },
    {
      id: "admin.vehicles.spawn",
      pluginId: "admin_tools",
      actionType: "spawn_vehicle",
      requiredPermission: "admin.vehicles.spawn",
      payloadSchema: {
        type: "object",
        required: ["targetSource", "model"],
        properties: {
          targetSource: { type: "string" },
          model: { type: "string" },
          heading: { type: "number" }
        }
      },
      auditLevel: "standard",
      enabled: true
    },
    {
      id: "admin.world.weather",
      pluginId: "admin_tools",
      actionType: "set_weather",
      requiredPermission: "admin.world.weather",
      payloadSchema: {
        type: "object",
        required: ["weatherType"],
        properties: {
          weatherType: { type: "string" }
        }
      },
      auditLevel: "standard",
      enabled: true
    },
    {
      id: "admin.world.time",
      pluginId: "admin_tools",
      actionType: "set_time",
      requiredPermission: "admin.world.time",
      payloadSchema: {
        type: "object",
        required: ["hour", "minute"],
        properties: {
          hour: { type: "number" },
          minute: { type: "number" }
        }
      },
      auditLevel: "standard",
      enabled: true
    },
    {
      id: "admin.teleport.to_marker",
      pluginId: "admin_tools",
      actionType: "teleport_player",
      requiredPermission: "admin.teleport.to_marker",
      payloadSchema: {
        type: "object",
        required: ["targetSource", "x", "y", "z"],
        properties: {
          targetSource: { type: "string" },
          x: { type: "number" },
          y: { type: "number" },
          z: { type: "number" },
          heading: { type: "number" }
        }
      },
      auditLevel: "standard",
      enabled: true
    }
  ];
  const menus: MenuDefinition[] = [
    {
      id: "admin.root",
      pluginId: "admin_tools",
      label: "Admin",
      order: 0,
      enabled: true
    },
    {
      id: "vehicle.repair.menu",
      pluginId: "admin_tools",
      label: "Repair Vehicle",
      parentId: "admin.root",
      order: 10,
      requiredPermission: "menu.vehicle.repair",
      actionId: "vehicle.repair",
      enabled: true
    }
  ];
  const commands: RuntimeCommandDefinition[] = [
    {
      id: "repair-command",
      pluginId: "admin_tools",
      name: "sdb_repair",
      aliases: ["repairveh"],
      actionId: "vehicle.repair",
      requiredPermission: "command.vehicle.repair",
      payloadSchema: {
        type: "object",
        required: ["targetVehicleNetId"],
        properties: {
          targetVehicleNetId: { type: "number" }
        }
      },
      auditLevel: "standard",
      enabled: true
    }
  ];

  return {
    runtime,
    permissions,
    bridge: new RuntimeBridge({
      serverId: "server-1",
      runtime,
      permissions,
      menu: new MenuRuntime({
        menus,
        actions,
        permissions: permissions.toEngine(),
        now: () => new Date("2026-05-18T12:00:00.000Z")
      }),
      commands: new RuntimeCommandRegistry({
        commands,
        permissions: permissions.toEngine(),
        now: () => new Date("2026-05-18T12:00:00.000Z")
      }),
      heartbeatSecret: options.heartbeatSecret,
      actionSecret: options.actionSecret,
      serverCommandExecutor: options.serverCommandExecutor,
      allowedServerCommandPrefixes: options.allowedServerCommandPrefixes,
      reducerDispatcher: options.reducerDispatcher,
      serverHandlerDispatcher: options.serverHandlerDispatcher,
      clientEventDispatcher: options.clientEventDispatcher,
      vehicleRepairDispatcher: options.vehicleRepairDispatcher,
      vehicleSpawnDispatcher: options.vehicleSpawnDispatcher,
      worldStateDispatcher: options.worldStateDispatcher,
      teleportDispatcher: options.teleportDispatcher,
      kickDispatcher: options.kickDispatcher,
      economyAdminAdjustDispatcher: options.economyAdminAdjustDispatcher,
      pluginStatusDispatcher: options.pluginStatusDispatcher,
      idFactory: () => `nonce-${++nextId}`
    })
  };
}

describe("RuntimeBridge", () => {
  it("implements HasPermission and GetConfig export behavior", () => {
    const { bridge } = createBridge();

    expect(bridge.hasPermission("player:1", "menu.vehicle.repair")).toBe(true);
    expect(bridge.hasPermission("player:2", "menu.vehicle.repair")).toBe(false);
    expect(bridge.getConfig("economy", "enabled")).toBe(true);
  });

  it("records signed runtime heartbeats when a heartbeat secret is configured", () => {
    const { bridge, runtime } = createBridge({
      heartbeatSecret: "heartbeat-secret",
      requireSignedHeartbeats: true
    });

    const instance = bridge.recordHeartbeat({
      resourceVersion: "0.1.0",
      fxserverBuild: "7290",
      gameBuild: "3095"
    });

    expect(instance).toEqual(expect.objectContaining({
      serverId: "server-1",
      resourceVersion: "0.1.0",
      fxserverBuild: "7290",
      gameBuild: "3095",
      status: "online"
    }));
    expect(runtime.getHealth("server-1")).toEqual(expect.objectContaining({
      status: "online",
      reason: "runtime heartbeat current",
      resourceVersion: "0.1.0"
    }));
  });

  it("exposes the runtime health snapshot for resource synchronization", () => {
    const { bridge } = createBridge();

    bridge.recordHeartbeat({
      resourceVersion: "0.1.0",
      fxserverBuild: "7290",
      gameBuild: "3095"
    });

    expect(bridge.getHealth()).toEqual(expect.objectContaining({
      serverId: "server-1",
      status: "online",
      reason: "runtime heartbeat current",
      resourceVersion: "0.1.0"
    }));
  });

  it("exposes permission-filtered menu trees for NUI delivery", () => {
    const { bridge } = createBridge();

    expect(bridge.getMenuTree("player:1")).toEqual([
      expect.objectContaining({
        id: "admin.root",
        children: [
          expect.objectContaining({
            id: "vehicle.repair.menu",
            label: "Repair Vehicle",
            actionId: "vehicle.repair"
          })
        ]
      })
    ]);
    expect(bridge.getMenuTree("player:2")).toEqual([
      expect.objectContaining({
        id: "admin.root",
        children: []
      })
    ]);
  });

  it("can replace its menu runtime after live control-plane menu updates", async () => {
    const { bridge } = createBridge();
    const permissions = new PermissionStore({
      now: () => new Date("2026-05-18T12:00:00.000Z")
    });
    permissions.grantPermission({
      principalId: "player:1",
      permissionKey: "menu.vehicle.repair",
      effect: "allow",
      source: "manual"
    });

    bridge.updateMenuRuntime(new MenuRuntime({
      menus: [],
      actions: [],
      permissions: permissions.toEngine(),
      now: () => new Date("2026-05-18T12:00:00.000Z")
    }));

    expect(bridge.getMenuTree("player:1")).toEqual([]);
    expect(await bridge.callAction("player:1", "vehicle.repair", {
      targetVehicleNetId: 44
    })).toEqual({
      ok: false,
      error: "Unknown or disabled action: vehicle.repair"
    });
  });

  it("calls registered local handlers after action authorization and validation", async () => {
    const { bridge, runtime } = createBridge();
    bridge.registerLocalHandler("vehicle.repair", async (_principalId, payload) => ({
      repaired: (payload as { targetVehicleNetId: number }).targetVehicleNetId
    }));

    const result = await bridge.callAction("player:1", "vehicle.repair", {
      targetVehicleNetId: 44
    });

    expect(result).toEqual({
      ok: true,
      result: { repaired: 44 },
      actionId: expect.any(String)
    });
    expect(runtime.getAuditLogs("server-1")).toEqual([
      expect.objectContaining({
        actorId: "player:1",
        pluginId: "admin_tools",
        actionType: "vehicle.repair",
        permissionKey: "menu.vehicle.repair",
        status: "succeeded"
      })
    ]);
  });

  it("signs submitted runtime action envelopes when an action secret is configured", async () => {
    const actionSecret = "action-secret";
    const { bridge, runtime } = createBridge({
      actionSecret,
      requireSignedActions: true
    });
    bridge.registerLocalHandler("vehicle.repair", async (_principalId, payload) => ({
      repaired: (payload as { targetVehicleNetId: number }).targetVehicleNetId
    }));

    const result = await bridge.callAction("player:1", "vehicle.repair", {
      targetVehicleNetId: 44
    });

    expect(result).toEqual({
      ok: true,
      result: { repaired: 44 },
      actionId: expect.any(String)
    });
    const action = runtime.getAction(result.actionId!);
    expect(action).toEqual(expect.objectContaining({
      serverId: "server-1",
      actorId: "player:1",
      actionType: "vehicle.repair",
      signature: expect.any(String),
      status: "completed"
    }));
    expect(verifyActionEnvelopeSignature(action!, actionSecret)).toBe(true);
  });

  it("denies unauthorized actions before local handlers run", async () => {
    const { bridge } = createBridge();
    let called = false;
    bridge.registerLocalHandler("vehicle.repair", async () => {
      called = true;
      return { repaired: true };
    });

    const result = await bridge.callAction("player:2", "vehicle.repair", {
      targetVehicleNetId: 44
    });

    expect(result).toEqual({
      ok: false,
      error: "Permission denied: menu.vehicle.repair"
    });
    expect(called).toBe(false);
  });

  it("audits denied menu actions with resolved principals and failed policy context", async () => {
    const { bridge, permissions, runtime } = createBridge({
      economyAdminAdjustDispatcher: () => ({ adjusted: true })
    });
    permissions.upsertPolicyConstraint({
      id: "staff-adjust-limit",
      permissionKey: "economy.admin.adjust_balance",
      constraintType: "max_amount",
      constraint: { amount: 10_000, currency: "cash" },
      priority: 100,
      enabled: true
    });
    bridge.refreshPermissionEngine();

    const result = await bridge.callAction("player:1", "economy.admin.adjust_balance", {
      accountId: "acct:1",
      direction: "credit",
      amount: 50_000,
      currency: "cash",
      reason: "event grant",
      idempotencyKey: "adjust-1"
    });

    expect(result).toEqual({
      ok: false,
      error: "Permission denied: economy.admin.adjust_balance"
    });
    expect(runtime.getAuditLogs("server-1")).toEqual([
      expect.objectContaining({
        actorId: "player:1",
        pluginId: "admin_tools",
        actionType: "economy.admin.adjust_balance",
        permissionKey: "economy.admin.adjust_balance",
        status: "denied",
        after: expect.objectContaining({
          error: "Permission denied: economy.admin.adjust_balance",
          resolvedPrincipals: ["player:1"],
          policyResults: [
            expect.objectContaining({
              policyId: "staff-adjust-limit",
              passed: false,
              reason: "amount exceeds policy"
            })
          ],
          deniedByPolicyId: "staff-adjust-limit"
        })
      })
    ]);
  });

  it("completes submitted actions as failed when local handlers throw", async () => {
    const { bridge, runtime } = createBridge();
    bridge.registerLocalHandler("vehicle.repair", async () => {
      throw new Error("repair native failed");
    });

    const result = await bridge.callAction("player:1", "vehicle.repair", {
      targetVehicleNetId: 44
    });

    expect(result).toEqual({
      ok: false,
      error: "repair native failed"
    });
    expect(runtime.getAuditLogs("server-1")).toEqual([
      expect.objectContaining({
        actorId: "player:1",
        pluginId: "admin_tools",
        actionType: "vehicle.repair",
        permissionKey: "menu.vehicle.repair",
        status: "failed"
      })
    ]);
  });

  it("dispatches registered runtime commands through local action handlers", async () => {
    const { bridge, runtime } = createBridge();
    bridge.registerLocalHandler("vehicle.repair", async (_principalId, payload) => ({
      repaired: (payload as { targetVehicleNetId: number }).targetVehicleNetId
    }));

    const result = await bridge.callCommand("player:1", "repairveh", {
      targetVehicleNetId: 44
    });

    expect(result).toEqual({
      ok: true,
      result: { repaired: 44 },
      actionId: expect.any(String)
    });
    expect(runtime.getAuditLogs("server-1")).toEqual([
      expect.objectContaining({
        actorId: "player:1",
        pluginId: "admin_tools",
        actionType: "vehicle.repair",
        permissionKey: "command.vehicle.repair",
        status: "succeeded"
      })
    ]);
  });

  it("can replace its command registry after live control-plane command updates", async () => {
    const { bridge } = createBridge();
    bridge.registerLocalHandler("vehicle.repair", async () => ({ repaired: true }));

    bridge.updateCommandRegistry(new RuntimeCommandRegistry({
      commands: [],
      permissions: new PermissionStore({
        now: () => new Date("2026-05-18T12:00:00.000Z")
      }).toEngine(),
      now: () => new Date("2026-05-18T12:00:00.000Z")
    }));

    expect(await bridge.callCommand("player:1", "repairveh", {
      targetVehicleNetId: 44
    })).toEqual({
      ok: false,
      error: "Unknown or disabled command: repairveh"
    });
  });

  it("refreshes menu and command permission engines after live permission changes", async () => {
    const { bridge, permissions } = createBridge();
    bridge.registerLocalHandler("vehicle.repair", async () => ({ repaired: true }));

    permissions.revokePermission("player:1", "menu.vehicle.repair");
    permissions.revokePermission("player:1", "command.vehicle.repair");
    bridge.refreshPermissionEngine();

    expect(bridge.hasPermission("player:1", "menu.vehicle.repair")).toBe(false);
    expect(await bridge.callAction("player:1", "vehicle.repair", {
      targetVehicleNetId: 44
    })).toEqual({
      ok: false,
      error: "Permission denied: menu.vehicle.repair"
    });
    expect(await bridge.callCommand("player:1", "repairveh", {
      targetVehicleNetId: 44
    })).toEqual({
      ok: false,
      error: "Permission denied: command.vehicle.repair"
    });
  });

  it("denies runtime commands before local handlers run", async () => {
    const { bridge } = createBridge();
    let called = false;
    bridge.registerLocalHandler("vehicle.repair", async () => {
      called = true;
      return { repaired: true };
    });

    const result = await bridge.callCommand("player:2", "sdb_repair", {
      targetVehicleNetId: 44
    });

    expect(result).toEqual({
      ok: false,
      error: "Permission denied: command.vehicle.repair"
    });
    expect(called).toBe(false);
  });

  it("executes set_runtime_config menu actions through the control plane without a local handler", async () => {
    const { bridge, runtime } = createBridge();

    const result = await bridge.callAction("player:1", "runtime.config.set", {
      namespace: "weather",
      key: "freezeTime",
      value: true
    });

    expect(result).toEqual({
      ok: true,
      result: expect.objectContaining({
        serverId: "server-1",
        namespace: "weather",
        key: "freezeTime",
        value: true,
        version: 1
      }),
      actionId: expect.any(String)
    });
    expect(runtime.getRuntimeConfig("server-1", "weather", "freezeTime")?.value).toBe(true);
    expect(runtime.getAuditLogs("server-1")).toEqual([
      expect.objectContaining({
        actorId: "player:1",
        pluginId: "admin_tools",
        actionType: "runtime.config.set",
        permissionKey: "runtime.config.set",
        status: "succeeded",
        after: expect.objectContaining({
          namespace: "weather",
          key: "freezeTime",
          value: true
        })
      })
    ]);
  });

  it("returns open_panel instructions without a local handler after authorization", async () => {
    const { bridge, runtime } = createBridge();

    const result = await bridge.callAction("player:1", "runtime.health.panel", {
      panelId: "runtime.health",
      route: "/runtime/health"
    });

    expect(result).toEqual({
      ok: true,
      result: {
        type: "open_panel",
        panelId: "runtime.health",
        route: "/runtime/health",
        payload: {
          panelId: "runtime.health",
          route: "/runtime/health"
        }
      },
      actionId: expect.any(String)
    });
    expect(runtime.getAuditLogs("server-1")).toEqual([
      expect.objectContaining({
        actorId: "player:1",
        pluginId: "admin_tools",
        actionType: "runtime.health.panel",
        permissionKey: "runtime.health.view",
        status: "succeeded",
        after: expect.objectContaining({
          type: "open_panel",
          panelId: "runtime.health"
        })
      })
    ]);
  });

  it("executes allowlisted server command actions through an explicit executor", async () => {
    const executed: string[] = [];
    const { bridge, runtime } = createBridge({
      allowedServerCommandPrefixes: ["weather "],
      serverCommandExecutor(command) {
        executed.push(command);
        return { command };
      }
    });

    const result = await bridge.callAction("player:1", "server.command.weather", {
      command: "weather extrasunny"
    });

    expect(result).toEqual({
      ok: true,
      result: {
        command: "weather extrasunny",
        executed: true
      },
      actionId: expect.any(String)
    });
    expect(executed).toEqual(["weather extrasunny"]);
    expect(runtime.getAuditLogs("server-1")).toEqual([
      expect.objectContaining({
        actorId: "player:1",
        pluginId: "admin_tools",
        actionType: "server.command.weather",
        permissionKey: "server.command.execute",
        status: "succeeded",
        after: {
          command: "weather extrasunny",
          executed: true
        }
      })
    ]);
  });

  it("rejects unallowlisted server command actions before executor dispatch", async () => {
    const executed: string[] = [];
    const { bridge, runtime } = createBridge({
      allowedServerCommandPrefixes: ["weather "],
      serverCommandExecutor(command) {
        executed.push(command);
      }
    });

    const result = await bridge.callAction("player:1", "server.command.weather", {
      command: "quit"
    });

    expect(result).toEqual({
      ok: false,
      error: "Server command is not allowlisted: quit"
    });
    expect(executed).toEqual([]);
    expect(runtime.getAuditLogs("server-1")).toEqual([
      expect.objectContaining({
        actorId: "player:1",
        pluginId: "admin_tools",
        actionType: "server.command.weather",
        permissionKey: "server.command.execute",
        status: "failed",
        after: { error: "Server command is not allowlisted: quit" }
      })
    ]);
  });

  it("executes toggle_feature actions as feature config updates", async () => {
    const { bridge, runtime } = createBridge();

    const result = await bridge.callAction("player:1", "features.toggle", {
      key: "economy",
      enabled: false
    });

    expect(result).toEqual({
      ok: true,
      result: expect.objectContaining({
        serverId: "server-1",
        namespace: "features",
        key: "economy",
        value: false,
        version: 1
      }),
      actionId: expect.any(String)
    });
    expect(runtime.getRuntimeConfig("server-1", "features", "economy")?.value).toBe(false);
    expect(runtime.getAuditLogs("server-1")).toEqual([
      expect.objectContaining({
        actorId: "player:1",
        pluginId: "admin_tools",
        actionType: "features.toggle",
        permissionKey: "features.toggle",
        status: "succeeded",
        after: expect.objectContaining({
          namespace: "features",
          key: "economy",
          value: false
        })
      })
    ]);
  });

  it("toggles feature state from the current runtime config when enabled is omitted", async () => {
    const { bridge, runtime } = createBridge();
    runtime.setRuntimeConfig({
      serverId: "server-1",
      namespace: "features",
      key: "pvp",
      value: false
    });

    const result = await bridge.callAction("player:1", "features.toggle", {
      key: "pvp"
    });

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      result: expect.objectContaining({
        namespace: "features",
        key: "pvp",
        value: true,
        version: 2
      })
    }));
    expect(runtime.getRuntimeConfig("server-1", "features", "pvp")?.value).toBe(true);
  });

  it("executes economy_admin_adjust_balance actions through an explicit economy dispatcher", async () => {
    const adjustmentCalls: Array<{ principalId: string; payload: unknown }> = [];
    const { bridge, runtime } = createBridge({
      economyAdminAdjustDispatcher(principalId, payload) {
        adjustmentCalls.push({ principalId, payload });
        return {
          transactionId: "txn-1",
          accountId: "acct:cash",
          balance: 1500
        };
      }
    });
    const payload = {
      accountId: "acct:cash",
      direction: "credit",
      amount: 500,
      currency: "cash",
      reason: "event payout",
      idempotencyKey: "adjust-1"
    };

    const result = await bridge.callAction("player:1", "economy.admin.adjust_balance", payload);

    expect(result).toEqual({
      ok: true,
      result: {
        transactionId: "txn-1",
        accountId: "acct:cash",
        balance: 1500
      },
      actionId: expect.any(String)
    });
    expect(adjustmentCalls).toEqual([
      {
        principalId: "player:1",
        payload
      }
    ]);
    expect(runtime.getAuditLogs("server-1")).toEqual([
      expect.objectContaining({
        actorId: "player:1",
        pluginId: "admin_tools",
        actionType: "economy.admin.adjust_balance",
        permissionKey: "economy.admin.adjust_balance",
        status: "succeeded",
        after: {
          transactionId: "txn-1",
          accountId: "acct:cash",
          balance: 1500
        }
      })
    ]);
  });

  it("fails economy_admin_adjust_balance actions before dispatch when no economy dispatcher is configured", async () => {
    const { bridge, runtime } = createBridge();

    const result = await bridge.callAction("player:1", "economy.admin.adjust_balance", {
      accountId: "acct:cash",
      direction: "credit",
      amount: 500,
      currency: "cash",
      reason: "event payout",
      idempotencyKey: "adjust-1"
    });

    expect(result).toEqual({
      ok: false,
      error: "Economy admin adjustment dispatcher is not configured"
    });
    expect(runtime.getAuditLogs("server-1")).toEqual([
      expect.objectContaining({
        actionType: "economy.admin.adjust_balance",
        status: "failed",
        after: { error: "Economy admin adjustment dispatcher is not configured" }
      })
    ]);
  });

  it("executes set_plugin_status actions through an explicit plugin status dispatcher", async () => {
    const statusCalls: Array<{ principalId: string; payload: unknown }> = [];
    const { bridge, runtime } = createBridge({
      pluginStatusDispatcher(principalId, payload) {
        statusCalls.push({ principalId, payload });
        return {
          pluginId: "mechanic_core",
          status: "disabled",
          menuRefreshQueued: true
        };
      }
    });
    const payload = {
      pluginId: "mechanic_core",
      status: "disabled"
    };

    const result = await bridge.callAction("player:1", "plugins.status.set", payload);

    expect(result).toEqual({
      ok: true,
      result: {
        pluginId: "mechanic_core",
        status: "disabled",
        menuRefreshQueued: true
      },
      actionId: expect.any(String)
    });
    expect(statusCalls).toEqual([
      {
        principalId: "player:1",
        payload
      }
    ]);
    expect(runtime.getAuditLogs("server-1")).toEqual([
      expect.objectContaining({
        actorId: "player:1",
        pluginId: "admin_tools",
        actionType: "plugins.status.set",
        permissionKey: "plugins.manage",
        status: "succeeded",
        after: {
          pluginId: "mechanic_core",
          status: "disabled",
          menuRefreshQueued: true
        }
      })
    ]);
  });

  it("fails set_plugin_status actions before dispatch when no plugin status dispatcher is configured", async () => {
    const { bridge, runtime } = createBridge();

    const result = await bridge.callAction("player:1", "plugins.status.set", {
      pluginId: "mechanic_core",
      status: "disabled"
    });

    expect(result).toEqual({
      ok: false,
      error: "Plugin status dispatcher is not configured"
    });
    expect(runtime.getAuditLogs("server-1")).toEqual([
      expect.objectContaining({
        actionType: "plugins.status.set",
        status: "failed",
        after: { error: "Plugin status dispatcher is not configured" }
      })
    ]);
  });

  it("executes call_reducer actions through an explicit reducer dispatcher", async () => {
    const reducerCalls: Array<{ reducerName: string; payload: unknown }> = [];
    const { bridge, runtime } = createBridge({
      reducerDispatcher(reducerName, payload) {
        reducerCalls.push({ reducerName, payload });
        return { reducerName, accepted: true };
      }
    });
    const payload = {
      value: "accepted"
    };

    const result = await bridge.callAction("player:1", "custom.reducer.run", payload);

    expect(result).toEqual({
      ok: true,
      result: {
        reducerName: "custom_reducer",
        accepted: true
      },
      actionId: expect.any(String)
    });
    expect(reducerCalls).toEqual([
      {
        reducerName: "custom_reducer",
        payload
      }
    ]);
    expect(runtime.getAuditLogs("server-1")).toEqual([
      expect.objectContaining({
        actorId: "player:1",
        pluginId: "admin_tools",
        actionType: "custom.reducer.run",
        permissionKey: "custom.reducer.call",
        status: "succeeded",
        after: {
          reducerName: "custom_reducer",
          accepted: true
        }
      })
    ]);
  });

  it("fails call_reducer actions before dispatch when no reducer dispatcher is configured", async () => {
    const { bridge, runtime } = createBridge();

    const result = await bridge.callAction("player:1", "custom.reducer.run", {
      value: "accepted"
    });

    expect(result).toEqual({
      ok: false,
      error: "Reducer dispatcher is not configured"
    });
    expect(runtime.getAuditLogs("server-1")).toEqual([
      expect.objectContaining({
        actionType: "custom.reducer.run",
        status: "failed",
        after: { error: "Reducer dispatcher is not configured" }
      })
    ]);
  });

  it("executes trigger_server_handler actions through an explicit server handler dispatcher", async () => {
    const handlerCalls: Array<{ handlerName: string; principalId: string; payload: unknown }> = [];
    const { bridge, runtime } = createBridge({
      serverHandlerDispatcher(handlerName, principalId, payload) {
        handlerCalls.push({ handlerName, principalId, payload });
        return { handlerName, sent: true };
      }
    });
    const payload = { message: "restart soon" };

    const result = await bridge.callAction("player:1", "server.handler.announce", payload);

    expect(result).toEqual({
      ok: true,
      result: {
        handlerName: "announce_handler",
        sent: true
      },
      actionId: expect.any(String)
    });
    expect(handlerCalls).toEqual([
      {
        handlerName: "announce_handler",
        principalId: "player:1",
        payload
      }
    ]);
    expect(runtime.getAuditLogs("server-1")).toEqual([
      expect.objectContaining({
        actorId: "player:1",
        pluginId: "admin_tools",
        actionType: "server.handler.announce",
        permissionKey: "server.handler.trigger",
        status: "succeeded",
        after: {
          handlerName: "announce_handler",
          sent: true
        }
      })
    ]);
  });

  it("fails trigger_server_handler actions before dispatch when no server handler dispatcher is configured", async () => {
    const { bridge, runtime } = createBridge();

    const result = await bridge.callAction("player:1", "server.handler.announce", {
      message: "restart soon"
    });

    expect(result).toEqual({
      ok: false,
      error: "Server handler dispatcher is not configured"
    });
    expect(runtime.getAuditLogs("server-1")).toEqual([
      expect.objectContaining({
        actionType: "server.handler.announce",
        status: "failed",
        after: { error: "Server handler dispatcher is not configured" }
      })
    ]);
  });

  it("executes trigger_client_event actions through an explicit client event dispatcher", async () => {
    const clientEvents: Array<{ eventName: string; targetPrincipalId: string; payload: unknown }> = [];
    const { bridge, runtime } = createBridge({
      clientEventDispatcher(eventName, targetPrincipalId, payload) {
        clientEvents.push({ eventName, targetPrincipalId, payload });
        return { eventName, targetPrincipalId, delivered: true };
      }
    });
    const payload = { targetPlayerId: "player:2", color: "amber" };

    const result = await bridge.callAction("player:1", "client.event.highlight", payload);

    expect(result).toEqual({
      ok: true,
      result: {
        eventName: "sdb_runtime:highlightTarget",
        targetPrincipalId: "player:1",
        delivered: true
      },
      actionId: expect.any(String)
    });
    expect(clientEvents).toEqual([
      {
        eventName: "sdb_runtime:highlightTarget",
        targetPrincipalId: "player:1",
        payload
      }
    ]);
    expect(runtime.getAuditLogs("server-1")).toEqual([
      expect.objectContaining({
        actorId: "player:1",
        pluginId: "admin_tools",
        actionType: "client.event.highlight",
        permissionKey: "client.event.trigger",
        status: "succeeded",
        after: {
          eventName: "sdb_runtime:highlightTarget",
          targetPrincipalId: "player:1",
          delivered: true
        }
      })
    ]);
  });

  it("fails trigger_client_event actions before dispatch when no client event dispatcher is configured", async () => {
    const { bridge, runtime } = createBridge();

    const result = await bridge.callAction("player:1", "client.event.highlight", {
      targetPlayerId: "player:2",
      color: "amber"
    });

    expect(result).toEqual({
      ok: false,
      error: "Client event dispatcher is not configured"
    });
    expect(runtime.getAuditLogs("server-1")).toEqual([
      expect.objectContaining({
        actionType: "client.event.highlight",
        status: "failed",
        after: { error: "Client event dispatcher is not configured" }
      })
    ]);
  });

  it("executes repair_vehicle actions through an explicit vehicle repair dispatcher", async () => {
    const repairCalls: Array<{ principalId: string; payload: unknown }> = [];
    const { bridge, runtime } = createBridge({
      vehicleRepairDispatcher(principalId, payload) {
        repairCalls.push({ principalId, payload });
        return {
          repaired: true,
          targetVehicleNetId: 44
        };
      }
    });
    const payload = {
      targetSource: "7",
      targetVehicleNetId: 44
    };

    const result = await bridge.callAction("player:1", "admin.vehicles.repair", payload);

    expect(result).toEqual({
      ok: true,
      result: {
        repaired: true,
        targetVehicleNetId: 44
      },
      actionId: expect.any(String)
    });
    expect(repairCalls).toEqual([
      {
        principalId: "player:1",
        payload
      }
    ]);
    expect(runtime.getAuditLogs("server-1")).toEqual([
      expect.objectContaining({
        actorId: "player:1",
        pluginId: "admin_tools",
        actionType: "admin.vehicles.repair",
        permissionKey: "admin.vehicles.repair",
        status: "succeeded",
        after: {
          repaired: true,
          targetVehicleNetId: 44
        }
      })
    ]);
  });

  it("fails repair_vehicle actions before dispatch when no vehicle repair dispatcher is configured", async () => {
    const { bridge, runtime } = createBridge();

    const result = await bridge.callAction("player:1", "admin.vehicles.repair", {
      targetSource: "7",
      targetVehicleNetId: 44
    });

    expect(result).toEqual({
      ok: false,
      error: "Vehicle repair dispatcher is not configured"
    });
    expect(runtime.getAuditLogs("server-1")).toEqual([
      expect.objectContaining({
        actionType: "admin.vehicles.repair",
        status: "failed",
        after: { error: "Vehicle repair dispatcher is not configured" }
      })
    ]);
  });

  it("executes spawn_vehicle actions through an explicit vehicle spawn dispatcher", async () => {
    const spawnCalls: Array<{ principalId: string; payload: unknown }> = [];
    const { bridge, runtime } = createBridge({
      vehicleSpawnDispatcher(principalId, payload) {
        spawnCalls.push({ principalId, payload });
        return {
          queued: 1,
          serverId: "server-1"
        };
      }
    });
    const payload = {
      targetSource: "7",
      model: "sultan",
      heading: 90
    };

    const result = await bridge.callAction("player:1", "admin.vehicles.spawn", payload);

    expect(result).toEqual({
      ok: true,
      result: {
        queued: 1,
        serverId: "server-1"
      },
      actionId: expect.any(String)
    });
    expect(spawnCalls).toEqual([
      {
        principalId: "player:1",
        payload
      }
    ]);
    expect(runtime.getAuditLogs("server-1")).toEqual([
      expect.objectContaining({
        actorId: "player:1",
        pluginId: "admin_tools",
        actionType: "admin.vehicles.spawn",
        permissionKey: "admin.vehicles.spawn",
        status: "succeeded",
        after: {
          queued: 1,
          serverId: "server-1"
        }
      })
    ]);
  });

  it("fails spawn_vehicle actions before dispatch when no vehicle spawn dispatcher is configured", async () => {
    const { bridge, runtime } = createBridge();

    const result = await bridge.callAction("player:1", "admin.vehicles.spawn", {
      targetSource: "7",
      model: "sultan"
    });

    expect(result).toEqual({
      ok: false,
      error: "Vehicle spawn dispatcher is not configured"
    });
    expect(runtime.getAuditLogs("server-1")).toEqual([
      expect.objectContaining({
        actionType: "admin.vehicles.spawn",
        status: "failed",
        after: { error: "Vehicle spawn dispatcher is not configured" }
      })
    ]);
  });

  it("executes world weather and time actions through an explicit world-state dispatcher", async () => {
    const worldCalls: Array<{ principalId: string; payload: unknown }> = [];
    const { bridge, runtime } = createBridge({
      worldStateDispatcher(principalId, payload) {
        worldCalls.push({ principalId, payload });
        return {
          applied: true,
          payload
        };
      }
    });

    const weather = await bridge.callAction("player:1", "admin.world.weather", {
      weatherType: "EXTRASUNNY"
    });
    const time = await bridge.callAction("player:1", "admin.world.time", {
      hour: 21,
      minute: 30
    });

    expect(weather).toEqual({
      ok: true,
      result: {
        applied: true,
        payload: { weatherType: "EXTRASUNNY" }
      },
      actionId: expect.any(String)
    });
    expect(time).toEqual({
      ok: true,
      result: {
        applied: true,
        payload: { hour: 21, minute: 30 }
      },
      actionId: expect.any(String)
    });
    expect(worldCalls).toEqual([
      {
        principalId: "player:1",
        payload: { weatherType: "EXTRASUNNY" }
      },
      {
        principalId: "player:1",
        payload: { hour: 21, minute: 30 }
      }
    ]);
    expect(runtime.getAuditLogs("server-1")).toEqual([
      expect.objectContaining({
        actorId: "player:1",
        actionType: "admin.world.weather",
        permissionKey: "admin.world.weather",
        status: "succeeded"
      }),
      expect.objectContaining({
        actorId: "player:1",
        actionType: "admin.world.time",
        permissionKey: "admin.world.time",
        status: "succeeded"
      })
    ]);
  });

  it("fails world-state actions before dispatch when no world-state dispatcher is configured", async () => {
    const { bridge, runtime } = createBridge();

    const result = await bridge.callAction("player:1", "admin.world.weather", {
      weatherType: "RAIN"
    });

    expect(result).toEqual({
      ok: false,
      error: "World state dispatcher is not configured"
    });
    expect(runtime.getAuditLogs("server-1")).toEqual([
      expect.objectContaining({
        actionType: "admin.world.weather",
        status: "failed",
        after: { error: "World state dispatcher is not configured" }
      })
    ]);
  });

  it("executes teleport_player actions through an explicit teleport dispatcher", async () => {
    const teleportCalls: Array<{ principalId: string; payload: unknown }> = [];
    const { bridge, runtime } = createBridge({
      teleportDispatcher(principalId, payload) {
        teleportCalls.push({ principalId, payload });
        return {
          teleported: true,
          targetSource: "7"
        };
      }
    });
    const payload = {
      targetSource: "7",
      x: 100,
      y: 200,
      z: 30,
      heading: 90
    };

    const result = await bridge.callAction("player:1", "admin.teleport.to_marker", payload);

    expect(result).toEqual({
      ok: true,
      result: {
        teleported: true,
        targetSource: "7"
      },
      actionId: expect.any(String)
    });
    expect(teleportCalls).toEqual([
      {
        principalId: "player:1",
        payload
      }
    ]);
    expect(runtime.getAuditLogs("server-1")).toEqual([
      expect.objectContaining({
        actorId: "player:1",
        actionType: "admin.teleport.to_marker",
        permissionKey: "admin.teleport.to_marker",
        status: "succeeded",
        after: {
          teleported: true,
          targetSource: "7"
        }
      })
    ]);
  });

  it("fails teleport_player actions before dispatch when no teleport dispatcher is configured", async () => {
    const { bridge, runtime } = createBridge();

    const result = await bridge.callAction("player:1", "admin.teleport.to_marker", {
      targetSource: "7",
      x: 100,
      y: 200,
      z: 30
    });

    expect(result).toEqual({
      ok: false,
      error: "Teleport dispatcher is not configured"
    });
    expect(runtime.getAuditLogs("server-1")).toEqual([
      expect.objectContaining({
        actionType: "admin.teleport.to_marker",
        status: "failed",
        after: { error: "Teleport dispatcher is not configured" }
      })
    ]);
  });

  it("executes kick_player actions through an explicit kick dispatcher", async () => {
    const kickCalls: Array<{ principalId: string; payload: unknown }> = [];
    const { bridge, runtime } = createBridge({
      kickDispatcher(principalId, payload) {
        kickCalls.push({ principalId, payload });
        return {
          kicked: true,
          targetSource: "7"
        };
      }
    });
    const payload = {
      targetSource: "7",
      reason: "Rule violation"
    };

    const result = await bridge.callAction("player:1", "admin.players.kick", payload);

    expect(result).toEqual({
      ok: true,
      result: {
        kicked: true,
        targetSource: "7"
      },
      actionId: expect.any(String)
    });
    expect(kickCalls).toEqual([
      {
        principalId: "player:1",
        payload
      }
    ]);
    expect(runtime.getAuditLogs("server-1")).toEqual([
      expect.objectContaining({
        actorId: "player:1",
        actionType: "admin.players.kick",
        permissionKey: "admin.players.kick",
        status: "succeeded",
        after: {
          kicked: true,
          targetSource: "7"
        }
      })
    ]);
  });

  it("fails kick_player actions before dispatch when no kick dispatcher is configured", async () => {
    const { bridge, runtime } = createBridge();

    const result = await bridge.callAction("player:1", "admin.players.kick", {
      targetSource: "7",
      reason: "Rule violation"
    });

    expect(result).toEqual({
      ok: false,
      error: "Kick dispatcher is not configured"
    });
    expect(runtime.getAuditLogs("server-1")).toEqual([
      expect.objectContaining({
        actionType: "admin.players.kick",
        status: "failed",
        after: { error: "Kick dispatcher is not configured" }
      })
    ]);
  });
});
