import { describe, expect, it } from "vitest";
import { AdminService } from "../src/admin/service.js";
import { RuntimeControlPlane } from "../src/core/runtime.js";
import { PermissionStore } from "../src/core/permission-store.js";
import { PluginRegistry } from "../src/core/plugins.js";
import { EconomyLedger } from "../src/core/economy.js";
import { PermissionEngine } from "../src/core/permissions.js";
import { FakeSpacetimeClient, SpacetimeRuntimeAdapter } from "../src/spacetime/adapter.js";

describe("AdminService", () => {
  it("updates runtime config and exposes an admin dashboard snapshot", () => {
    const runtime = new RuntimeControlPlane({
      now: () => new Date("2026-05-18T12:00:00.000Z"),
      idFactory: () => "id-1"
    });
    runtime.registerServer({
      id: "server-1",
      name: "Roleplay Dev",
      environment: "development",
      publicKey: "public-key"
    });
    const admin = new AdminService({
      runtime,
      permissions: new PermissionStore(),
      plugins: new PluginRegistry()
    });

    admin.setConfig({
      serverId: "server-1",
      namespace: "economy",
      key: "enabled",
      value: true
    });

    expect(admin.getDashboard("server-1")).toEqual({
      health: expect.objectContaining({
        serverId: "server-1",
        status: "degraded",
        reason: "no runtime heartbeat"
      }),
      config: [expect.objectContaining({ namespace: "economy", key: "enabled", value: true })],
      plugins: [],
      auditLogs: []
    });
  });

  it("includes local economy audit logs in dashboard and audit search reads", () => {
    const economy = new EconomyLedger({
      permissions: new PermissionEngine({
        principals: [],
        edges: [],
        grants: [
          {
            principalId: "player:admin",
            permissionKey: "economy.transfer",
            effect: "allow",
            source: "manual"
          }
        ]
      }),
      now: () => new Date("2026-05-18T12:00:00.000Z"),
      idFactory: (() => {
        let nextId = 0;
        return () => `economy-id-${++nextId}`;
      })(),
      accounts: [
        {
          id: "acct:a",
          ownerType: "character",
          ownerId: "char:a",
          currency: "cash",
          balance: 1000,
          status: "active"
        },
        {
          id: "acct:b",
          ownerType: "business",
          ownerId: "biz:b",
          currency: "cash",
          balance: 100,
          status: "active"
        }
      ]
    });
    economy.transferMoney({
      actorPrincipalId: "player:admin",
      fromAccountId: "acct:a",
      toAccountId: "acct:b",
      amount: 250,
      currency: "cash",
      reason: "invoice_payment",
      idempotencyKey: "transfer-1"
    });
    const runtime = new RuntimeControlPlane();
    runtime.registerServer({
      id: "server-1",
      name: "Roleplay Dev",
      environment: "development",
      publicKey: "public-key"
    });
    const admin = new AdminService({
      runtime,
      permissions: new PermissionStore(),
      plugins: new PluginRegistry(),
      economy
    });

    expect(admin.getDashboard("server-1").auditLogs).toEqual([
      expect.objectContaining({
        actorId: "player:admin",
        actionType: "economy.transfer",
        targetId: "acct:a->acct:b",
        status: "succeeded"
      })
    ]);
    expect(admin.searchAuditLogs({ actionType: "economy.transfer" })).toEqual([
      expect.objectContaining({
        actorId: "player:admin",
        permissionKey: "economy.transfer"
      })
    ]);
  });

  it("reports runtime heartbeat health in the admin dashboard", () => {
    const runtime = new RuntimeControlPlane({
      now: () => new Date("2026-05-18T12:00:00.000Z"),
      idFactory: () => "runtime-instance-1"
    });
    runtime.registerServer({
      id: "server-1",
      name: "Roleplay Dev",
      environment: "development",
      publicKey: "public-key"
    });
    runtime.heartbeat({
      serverId: "server-1",
      resourceVersion: "0.1.0",
      fxserverBuild: "8730",
      gameBuild: "b3095"
    });

    const admin = new AdminService({
      runtime,
      permissions: new PermissionStore(),
      plugins: new PluginRegistry()
    });

    expect(admin.getDashboard("server-1").health).toEqual({
      serverId: "server-1",
      serverName: "Roleplay Dev",
      environment: "development",
      status: "online",
      reason: "runtime heartbeat current",
      resourceVersion: "0.1.0",
      fxserverBuild: "8730",
      gameBuild: "b3095",
      lastHeartbeatAt: new Date("2026-05-18T12:00:00.000Z"),
      lastSeenAt: new Date("2026-05-18T12:00:00.000Z")
    });
  });

  it("uses SpacetimeDB live cache for dashboard reads when connected", async () => {
    const client = new FakeSpacetimeClient({
      servers: [
        {
          id: "server-1",
          name: "Roleplay Live",
          environment: "production",
          publicKey: "public-key",
          status: "online",
          lastHeartbeatAt: new Date("2026-05-18T12:00:00.000Z")
        }
      ],
      runtime_instances: [
        {
          id: "runtime-1",
          serverId: "server-1",
          resourceVersion: "0.2.0",
          fxserverBuild: "9000",
          gameBuild: "b3258",
          status: "online",
          startedAt: new Date("2026-05-18T11:59:00.000Z"),
          lastSeenAt: new Date("2026-05-18T12:00:00.000Z")
        }
      ],
      runtime_config: [
        {
          id: "config:server-1:economy:enabled",
          serverId: "server-1",
          namespace: "economy",
          key: "enabled",
          value: true,
          version: 4,
          updatedAt: new Date("2026-05-18T12:00:00.000Z")
        }
      ],
      plugins: [
        {
          id: "economy_core",
          name: "Economy Core",
          version: "1.0.0",
          status: "active",
          installedAt: new Date("2026-05-18T12:00:00.000Z"),
          updatedAt: new Date("2026-05-18T12:00:00.000Z")
        }
      ],
      audit_logs: [
        {
          id: "audit-1",
          serverId: "server-1",
          actorId: "player:1",
          pluginId: "admin_tools",
          actionType: "vehicle.repair",
          permissionKey: "admin.vehicles.repair",
          targetType: "vehicle",
          targetId: "net:10",
          beforeJson: "{\"repaired\":false}",
          afterJson: "{\"repaired\":true}",
          status: "succeeded",
          createdAt: new Date("2026-05-18T12:00:00.000Z")
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

    expect(admin.getDashboard("server-1")).toEqual({
      health: expect.objectContaining({
        serverId: "server-1",
        serverName: "Roleplay Live",
        environment: "production",
        status: "online",
        reason: "runtime heartbeat current",
        resourceVersion: "0.2.0"
      }),
      config: [expect.objectContaining({ namespace: "economy", key: "enabled", value: true, version: 4 })],
      plugins: [expect.objectContaining({ id: "economy_core", status: "active" })],
      auditLogs: [
        expect.objectContaining({
          id: "audit-1",
          before: { repaired: false },
          after: { repaired: true }
        })
      ]
    });
  });

  it("manages plugin lifecycle from manifests", () => {
    const runtime = new RuntimeControlPlane();
    runtime.registerServer({
      id: "server-1",
      name: "Roleplay Dev",
      environment: "development",
      publicKey: "public-key"
    });
    const admin = new AdminService({
      runtime,
      permissions: new PermissionStore(),
      plugins: new PluginRegistry()
    });

    admin.installPlugin({
      pluginId: "mechanic_core",
      name: "Mechanic Core",
      version: "1.0.0",
      permissions: [{ key: "mechanic.repair", description: "Repair vehicles" }]
    });
    admin.enablePlugin("mechanic_core");

    expect(admin.getPlugins()).toEqual([
      expect.objectContaining({ id: "mechanic_core", status: "active" })
    ]);

    admin.disablePlugin("mechanic_core");

    expect(admin.getPlugins()).toEqual([
      expect.objectContaining({ id: "mechanic_core", status: "disabled" })
    ]);
    expect(admin.getDashboard("server-1").auditLogs).toEqual([
      expect.objectContaining({ actionType: "plugin.install", pluginId: "mechanic_core" }),
      expect.objectContaining({ actionType: "plugin.enable", pluginId: "mechanic_core" }),
      expect.objectContaining({ actionType: "plugin.disable", pluginId: "mechanic_core" })
    ]);
  });

  it("edits permissions and returns an evaluatable permission snapshot", () => {
    const admin = new AdminService({
      runtime: new RuntimeControlPlane(),
      permissions: new PermissionStore(),
      plugins: new PluginRegistry()
    });

    admin.upsertPrincipal({
      id: "player:license:abc",
      type: "player",
      externalId: "license:abc",
      name: "Ada"
    });
    admin.grantPermission({
      principalId: "player:license:abc",
      permissionKey: "menu.vehicle.repair",
      effect: "allow",
      source: "manual"
    });

    expect(admin.getPermissionEngine().hasPermission("player:license:abc", "menu.vehicle.repair").allowed).toBe(true);
    expect(admin.getPermissionAudit()).toEqual([
      expect.objectContaining({ actionType: "permission.upsert_principal" }),
      expect.objectContaining({ actionType: "permission.grant" })
    ]);
  });
});
