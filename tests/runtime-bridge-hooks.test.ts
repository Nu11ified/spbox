import { describe, expect, it } from "vitest";
import { HookRuntime } from "../src/core/hooks.js";
import { MenuRuntime, type MenuAction } from "../src/core/menu.js";
import { PermissionStore } from "../src/core/permission-store.js";
import { RuntimeControlPlane } from "../src/core/runtime.js";
import { RuntimeBridge } from "../src/runtime/bridge.js";

describe("RuntimeBridge hooks", () => {
  it("dispatches action hooks after a successful local handler", async () => {
    const runtime = new RuntimeControlPlane({
      now: () => new Date("2026-05-18T12:00:00.000Z"),
      idFactory: () => "id"
    });
    runtime.registerServer({
      id: "server-1",
      name: "Roleplay Dev",
      environment: "development",
      publicKey: "public-key"
    });
    const permissions = new PermissionStore();
    permissions.grantPermission({
      principalId: "player:1",
      permissionKey: "menu.vehicle.repair",
      effect: "allow",
      source: "manual"
    });
    const actions: MenuAction[] = [
      {
        id: "vehicle.repair",
        pluginId: "admin_tools",
        actionType: "runtime_action",
        requiredPermission: "menu.vehicle.repair",
        enabled: true,
        auditLevel: "standard"
      }
    ];
    const hooks = new HookRuntime({
      capabilities: new Map([["mechanic_core", new Set(["vehicle.inspect"])]])
    });
    const seen: unknown[] = [];
    hooks.registerHook({
      id: "mechanic-after-repair",
      pluginId: "mechanic_core",
      hookName: "after_action.vehicle.repair",
      capability: "vehicle.inspect",
      priority: 0,
      enabled: true,
      handler: async (payload) => {
        seen.push(payload);
        return { inspected: true };
      }
    });
    const bridge = new RuntimeBridge({
      serverId: "server-1",
      runtime,
      permissions,
      menu: new MenuRuntime({ menus: [], actions, permissions: permissions.toEngine() }),
      hooks
    });
    bridge.registerLocalHandler("vehicle.repair", async () => ({ repaired: true }));

    const result = await bridge.callAction("player:1", "vehicle.repair", { netId: 44 });

    expect(result.ok).toBe(true);
    expect(seen).toEqual([
      {
        actionId: "vehicle.repair",
        actorId: "player:1",
        payload: { netId: 44 },
        result: { repaired: true }
      }
    ]);
    expect(runtime.getAuditLogs("server-1")).toEqual([
      expect.objectContaining({
        actorId: "mechanic_core",
        pluginId: "mechanic_core",
        actionType: "hook.after_action.vehicle.repair",
        permissionKey: "vehicle.inspect",
        targetType: "hook",
        targetId: "mechanic-after-repair",
        status: "succeeded"
      }),
      expect.objectContaining({
        actorId: "player:1",
        pluginId: "admin_tools",
        actionType: "vehicle.repair",
        permissionKey: "menu.vehicle.repair",
        status: "succeeded"
      })
    ]);
  });

  it("can replace hooks after live plugin hook updates", async () => {
    const runtime = new RuntimeControlPlane({
      now: () => new Date("2026-05-18T12:00:00.000Z"),
      idFactory: () => "id"
    });
    runtime.registerServer({
      id: "server-1",
      name: "Roleplay Dev",
      environment: "development",
      publicKey: "public-key"
    });
    const permissions = new PermissionStore();
    permissions.grantPermission({
      principalId: "player:1",
      permissionKey: "menu.vehicle.repair",
      effect: "allow",
      source: "manual"
    });
    const actions: MenuAction[] = [
      {
        id: "vehicle.repair",
        pluginId: "admin_tools",
        actionType: "runtime_action",
        requiredPermission: "menu.vehicle.repair",
        enabled: true,
        auditLevel: "standard"
      }
    ];
    const hooks = new HookRuntime({
      capabilities: new Map([["mechanic_core", new Set(["vehicle.inspect"])]])
    });
    const seen: unknown[] = [];
    hooks.registerHook({
      id: "mechanic-after-repair",
      pluginId: "mechanic_core",
      hookName: "after_action.vehicle.repair",
      capability: "vehicle.inspect",
      priority: 0,
      enabled: true,
      handler: async (payload) => {
        seen.push(payload);
        return { inspected: true };
      }
    });
    const bridge = new RuntimeBridge({
      serverId: "server-1",
      runtime,
      permissions,
      menu: new MenuRuntime({ menus: [], actions, permissions: permissions.toEngine() }),
      hooks
    });
    bridge.registerLocalHandler("vehicle.repair", async () => ({ repaired: true }));

    bridge.updateHookRuntime(new HookRuntime({ capabilities: new Map() }));
    await bridge.callAction("player:1", "vehicle.repair", { netId: 44 });

    expect(seen).toEqual([]);
  });

  it("persists failed hook audits without failing the completed parent action", async () => {
    let nextId = 0;
    const runtime = new RuntimeControlPlane({
      now: () => new Date("2026-05-18T12:00:00.000Z"),
      idFactory: () => `id-${++nextId}`
    });
    runtime.registerServer({
      id: "server-1",
      name: "Roleplay Dev",
      environment: "development",
      publicKey: "public-key"
    });
    const permissions = new PermissionStore();
    permissions.grantPermission({
      principalId: "player:1",
      permissionKey: "menu.vehicle.repair",
      effect: "allow",
      source: "manual"
    });
    const actions: MenuAction[] = [
      {
        id: "vehicle.repair",
        pluginId: "admin_tools",
        actionType: "runtime_action",
        requiredPermission: "menu.vehicle.repair",
        enabled: true,
        auditLevel: "standard"
      }
    ];
    const hooks = new HookRuntime({
      capabilities: new Map([["mechanic_core", new Set(["vehicle.inspect"])]])
    });
    hooks.registerHook({
      id: "mechanic-after-repair",
      pluginId: "mechanic_core",
      hookName: "after_action.vehicle.repair",
      capability: "vehicle.inspect",
      priority: 0,
      enabled: true,
      handler: async () => {
        throw new Error("inspection sidecar failed");
      }
    });
    const bridge = new RuntimeBridge({
      serverId: "server-1",
      runtime,
      permissions,
      menu: new MenuRuntime({ menus: [], actions, permissions: permissions.toEngine() }),
      hooks,
      idFactory: () => `nonce-${++nextId}`
    });
    bridge.registerLocalHandler("vehicle.repair", async () => ({ repaired: true }));

    const result = await bridge.callAction("player:1", "vehicle.repair", { netId: 44 });

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      result: { repaired: true }
    }));
    expect(runtime.getAuditLogs("server-1")).toEqual([
      expect.objectContaining({
        actorId: "mechanic_core",
        pluginId: "mechanic_core",
        actionType: "hook.after_action.vehicle.repair",
        permissionKey: "vehicle.inspect",
        targetType: "hook",
        targetId: "mechanic-after-repair",
        status: "failed",
        after: { error: "inspection sidecar failed" }
      }),
      expect.objectContaining({
        actorId: "player:1",
        pluginId: "admin_tools",
        actionType: "vehicle.repair",
        permissionKey: "menu.vehicle.repair",
        status: "succeeded",
        after: { repaired: true }
      })
    ]);
  });
});
