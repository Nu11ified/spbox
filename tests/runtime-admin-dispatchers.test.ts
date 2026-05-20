import { describe, expect, it } from "vitest";
import { AdminService } from "../src/admin/service.js";
import { PermissionStore } from "../src/core/permission-store.js";
import { PluginRegistry } from "../src/core/plugins.js";
import { RuntimeControlPlane } from "../src/core/runtime.js";
import {
  createAdminGameplayRuntimeDispatchers,
  createAdminRuntimeDispatchers
} from "../src/runtime/admin-dispatchers.js";
import { FakeSpacetimeClient, SpacetimeRuntimeAdapter } from "../src/spacetime/adapter.js";

function createAdmin(): AdminService {
  return new AdminService({
    runtime: new RuntimeControlPlane(),
    permissions: new PermissionStore(),
    plugins: new PluginRegistry()
  });
}

describe("admin gameplay runtime dispatchers", () => {
  it("queues typed gameplay actions for the selected server", async () => {
    const admin = createAdmin();
    const dispatchers = createAdminGameplayRuntimeDispatchers({
      admin,
      serverId: "server-1"
    });

    await dispatchers.vehicleSpawnDispatcher?.("player:1", {
      targetSource: "7",
      model: "sultan",
      label: "Sultan",
      category: "car",
      heading: 90,
      warpIntoVehicle: true
    });
    await dispatchers.vehicleRepairDispatcher?.("player:1", {
      targetSource: "7",
      targetVehicleNetId: 44
    });
    await dispatchers.teleportDispatcher?.("player:1", {
      targetSource: "7",
      x: 100,
      y: 200,
      z: 30
    });
    await dispatchers.kickDispatcher?.("player:1", {
      targetSource: "7",
      reason: "Rule violation"
    });

    expect(admin.drainVehicleSpawns({ serverId: "server-1" })).toEqual([
      {
        serverId: "server-1",
        targetSource: "7",
        model: "sultan",
        label: "Sultan",
        category: "car",
        heading: 90,
        warpIntoVehicle: true
      }
    ]);
    expect(admin.drainVehicleRepairs({ serverId: "server-1" })).toEqual([
      {
        serverId: "server-1",
        targetSource: "7",
        targetVehicleNetId: 44
      }
    ]);
    expect(admin.drainTeleports({ serverId: "server-1" })).toEqual([
      {
        serverId: "server-1",
        targetSource: "7",
        x: 100,
        y: 200,
        z: 30
      }
    ]);
    expect(admin.drainKicks({ serverId: "server-1" })).toEqual([
      {
        serverId: "server-1",
        targetSource: "7",
        reason: "Rule violation"
      }
    ]);
  });

  it("maps weather and time actions into world-state queue updates", async () => {
    const admin = createAdmin();
    const dispatchers = createAdminGameplayRuntimeDispatchers({
      admin,
      serverId: "server-1"
    });

    await dispatchers.worldStateDispatcher?.("player:1", {
      weatherType: "EXTRASUNNY"
    });
    await dispatchers.worldStateDispatcher?.("player:1", {
      hour: 12,
      minute: 30
    });

    expect(admin.drainWorldState({ serverId: "server-1" })).toEqual([
      {
        serverId: "server-1",
        world: {
          hour: 12,
          minute: 30
        }
      },
      {
        serverId: "server-1",
        world: {
          weatherType: "EXTRASUNNY"
        }
      }
    ]);
  });

  it("rejects non-object typed action payloads before queueing", async () => {
    const admin = createAdmin();
    const dispatchers = createAdminGameplayRuntimeDispatchers({
      admin,
      serverId: "server-1"
    });

    expect(() => dispatchers.kickDispatcher?.("player:1", "bad-payload"))
      .toThrow("Runtime dispatcher payload must be an object");
    expect(admin.drainKicks({ serverId: "server-1" })).toEqual([]);
  });
});

describe("admin runtime dispatchers", () => {
  it("maps typed economy admin adjustments into SpacetimeDB reducer calls", async () => {
    const client = new FakeSpacetimeClient({});
    const admin = new AdminService({
      runtime: new RuntimeControlPlane(),
      permissions: new PermissionStore(),
      plugins: new PluginRegistry(),
      spacetime: new SpacetimeRuntimeAdapter(client)
    });
    const dispatchers = createAdminRuntimeDispatchers({
      admin,
      serverId: "server-1"
    });

    await expect(dispatchers.economyAdminAdjustDispatcher?.("player:1", {
      accountId: "acct:cash",
      direction: "credit",
      amount: 500,
      currency: "cash",
      reason: "event payout",
      idempotencyKey: "adjust-1"
    })).resolves.toEqual({
      transactionId: "runtime:server-1:player:1:adjust-1",
      accountId: "acct:cash",
      direction: "credit",
      amount: 500,
      currency: "cash",
      reason: "event payout",
      idempotencyKey: "adjust-1"
    });

    expect(client.reducerCalls).toEqual([
      {
        name: "admin_adjust_balance",
        args: {
          transactionId: "runtime:server-1:player:1:adjust-1",
          actorId: "player:1",
          accountId: "acct:cash",
          direction: "credit",
          amount: 500,
          reason: "event payout",
          idempotencyKey: "adjust-1"
        }
      }
    ]);
  });

  it("maps typed plugin status actions into plugin lifecycle operations", async () => {
    const admin = createAdmin();
    admin.installPlugin({
      pluginId: "mechanic_core",
      name: "Mechanic Core",
      version: "1.0.0"
    });
    const dispatchers = createAdminRuntimeDispatchers({
      admin,
      serverId: "server-1"
    });

    await expect(dispatchers.pluginStatusDispatcher?.("player:1", {
      pluginId: "mechanic_core",
      status: "active"
    })).resolves.toEqual({
      pluginId: "mechanic_core",
      status: "active",
      menuRefreshQueued: true
    });
    await expect(dispatchers.pluginStatusDispatcher?.("player:1", {
      pluginId: "mechanic_core",
      status: "disabled"
    })).resolves.toEqual({
      pluginId: "mechanic_core",
      status: "disabled",
      menuRefreshQueued: true
    });

    expect(admin.getPlugins()).toEqual([
      expect.objectContaining({
        id: "mechanic_core",
        status: "disabled"
      })
    ]);
  });
});
