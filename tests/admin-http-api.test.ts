import { describe, expect, it } from "vitest";
import { AdminService } from "../src/admin/service.js";
import { createAdminHttpApi } from "../src/admin/http-api.js";
import { EconomyLedger } from "../src/core/economy.js";
import { PermissionStore } from "../src/core/permission-store.js";
import { PluginRegistry } from "../src/core/plugins.js";
import { PermissionEngine } from "../src/core/permissions.js";
import { RuntimeControlPlane } from "../src/core/runtime.js";
import { FakeSpacetimeClient, SpacetimeRuntimeAdapter } from "../src/spacetime/adapter.js";

function createApi() {
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

  const service = new AdminService({
    runtime,
    permissions: new PermissionStore(),
    plugins: new PluginRegistry()
  });

  return Object.assign(createAdminHttpApi(service), { service });
}

describe("admin HTTP API", () => {
  it("returns dashboard snapshots", async () => {
    const api = createApi();

    const response = await api.handle({
      method: "GET",
      path: "/servers/server-1/dashboard"
    });

    expect(response).toEqual({
      status: 200,
      body: {
        health: expect.objectContaining({
          serverId: "server-1",
          status: "degraded",
          reason: "no runtime heartbeat"
        }),
        config: [],
        plugins: [],
        auditLogs: []
      }
    });
  });

  it("searches audit logs from the SpacetimeDB live cache", async () => {
    const client = new FakeSpacetimeClient({
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
        },
        {
          id: "audit-2",
          serverId: "server-1",
          actorId: "player:2",
          pluginId: "economy_core",
          actionType: "economy.transfer",
          permissionKey: "economy.transfer",
          targetType: "account",
          targetId: "acct:1",
          beforeJson: "{}",
          afterJson: "{\"amount\":25}",
          status: "denied",
          createdAt: new Date("2026-05-18T12:01:00.000Z")
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
      path: "/audit?actorId=player%3A2&status=denied"
    })).resolves.toEqual({
      status: 200,
      body: [
        expect.objectContaining({
          id: "audit-2",
          actorId: "player:2",
          status: "denied",
          after: { amount: 25 }
        })
      ]
    });
  });

  it("searches local economy audit logs through the HTTP audit route", async () => {
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
    const api = createAdminHttpApi(new AdminService({
      runtime: new RuntimeControlPlane(),
      permissions: new PermissionStore(),
      plugins: new PluginRegistry(),
      economy
    }));

    await expect(api.handle({
      method: "GET",
      path: "/audit?actionType=economy.transfer&status=succeeded"
    })).resolves.toEqual({
      status: 200,
      body: [
        expect.objectContaining({
          actorId: "player:admin",
          actionType: "economy.transfer",
          permissionKey: "economy.transfer",
          status: "succeeded"
        })
      ]
    });
  });

  it("updates config through a JSON POST", async () => {
    const api = createApi();

    const response = await api.handle({
      method: "POST",
      path: "/servers/server-1/config",
      body: {
        namespace: "economy",
        key: "enabled",
        value: true
      }
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({
      serverId: "server-1",
      namespace: "economy",
      key: "enabled",
      value: true,
      version: 1
    }));
  });

  it("exposes a resource reconciliation route for runtime restarts", async () => {
    const runtime = new RuntimeControlPlane();
    runtime.registerServer({
      id: "server-1",
      name: "Roleplay Dev",
      environment: "development",
      publicKey: "public-key"
    });
    const service = new AdminService({
      runtime,
      permissions: new PermissionStore(),
      plugins: new PluginRegistry(),
      legacyResourceReconciler: async () => ({ imported: [{ pluginId: "qb-banking" }] })
    });
    const api = createAdminHttpApi(service);

    await expect(api.handle({
      method: "POST",
      path: "/resources/reconcile",
      body: { resource: "sdb_runtime" }
    })).resolves.toEqual({
      status: 200,
      body: { imported: [{ pluginId: "qb-banking" }] }
    });
  });

  it("waits for SpacetimeDB write-through before returning mutation responses", async () => {
    const runtime = new RuntimeControlPlane({
      idFactory: () => "config-id"
    });
    runtime.registerServer({
      id: "server-1",
      name: "Roleplay Dev",
      environment: "development",
      publicKey: "public-key"
    });
    const client = new FakeSpacetimeClient({});
    const api = createAdminHttpApi(
      new AdminService({
        runtime,
        permissions: new PermissionStore(),
        plugins: new PluginRegistry(),
        spacetime: new SpacetimeRuntimeAdapter(client)
      })
    );

    const response = await api.handle({
      method: "POST",
      path: "/servers/server-1/config",
      body: {
        namespace: "economy",
        key: "enabled",
        value: true
      }
    });

    expect(response.status).toBe(200);
    expect(client.reducerCalls).toEqual([
      expect.objectContaining({ name: "set_runtime_config" })
    ]);
  });

  it("mirrors runtime audit logs through an admin route", async () => {
    const runtime = new RuntimeControlPlane({
      idFactory: () => "runtime-audit-1"
    });
    runtime.registerServer({
      id: "server-1",
      name: "Roleplay Dev",
      environment: "development",
      publicKey: "public-key"
    });
    runtime.writeAuditLog({
      serverId: "server-1",
      actorId: "player:mechanic",
      pluginId: "mechanic_core",
      actionType: "hook.on_vehicle_damaged",
      permissionKey: "vehicle.inspect",
      targetType: "hook",
      targetId: "mechanic_core:on_vehicle_damaged:mechanic.inspect_damage",
      after: { actionCount: 0 },
      status: "succeeded"
    });
    const client = new FakeSpacetimeClient({});
    const api = createAdminHttpApi(new AdminService({
      runtime,
      permissions: new PermissionStore(),
      plugins: new PluginRegistry(),
      spacetime: new SpacetimeRuntimeAdapter(client)
    }));

    const response = await api.handle({
      method: "POST",
      path: "/servers/server-1/audit/mirror"
    });

    expect(response).toEqual({
      status: 200,
      body: { ok: true }
    });
    expect(client.reducerCalls).toEqual([
      {
        name: "write_audit_log",
        args: expect.objectContaining({
          id: "runtime-audit-1",
          serverId: "server-1",
          actorId: "player:mechanic",
          pluginId: "mechanic_core",
          actionType: "hook.on_vehicle_damaged",
          status: "succeeded"
        })
      }
    ]);
  });

  it("returns a bad request when a SpacetimeDB write-through fails", async () => {
    const runtime = new RuntimeControlPlane({
      idFactory: () => "config-id"
    });
    runtime.registerServer({
      id: "server-1",
      name: "Roleplay Dev",
      environment: "development",
      publicKey: "public-key"
    });
    const client = new FakeSpacetimeClient({});
    client.failReducer("set_runtime_config", new Error("database unavailable"));
    const api = createAdminHttpApi(
      new AdminService({
        runtime,
        permissions: new PermissionStore(),
        plugins: new PluginRegistry(),
        spacetime: new SpacetimeRuntimeAdapter(client)
      })
    );

    const response = await api.handle({
      method: "POST",
      path: "/servers/server-1/config",
      body: {
        namespace: "economy",
        key: "enabled",
        value: true
      }
    });

    expect(response).toEqual({
      status: 400,
      body: { error: "database unavailable" }
    });
  });

  it("installs and enables plugins", async () => {
    const api = createApi();

    const install = await api.handle({
      method: "POST",
      path: "/plugins/install",
      body: {
        pluginId: "mechanic_core",
        name: "Mechanic Core",
        version: "1.0.0"
      }
    });
    const enable = await api.handle({
      method: "POST",
      path: "/plugins/mechanic_core/enable"
    });

    expect(install.status).toBe(200);
    expect(enable.body).toEqual(expect.objectContaining({
      id: "mechanic_core",
      status: "active"
    }));
  });

  it("edits permissions and reports not found routes", async () => {
    const api = createApi();

    const principal = await api.handle({
      method: "POST",
      path: "/permissions/principals",
      body: {
        id: "player:license:abc",
        type: "player",
        externalId: "license:abc",
        name: "Ada"
      }
    });
    const grant = await api.handle({
      method: "POST",
      path: "/permissions/grants",
      body: {
        principalId: "player:license:abc",
        permissionKey: "menu.vehicle.repair",
        effect: "allow",
        source: "manual",
        expiresAt: "2026-05-18T14:00:00.000Z"
      }
    });
    const missing = await api.handle({ method: "GET", path: "/missing" });

    expect(principal.status).toBe(200);
    expect(grant.status).toBe(200);
    expect(api.service.getPermissionSnapshot().grants).toEqual([
      expect.objectContaining({
        principalId: "player:license:abc",
        permissionKey: "menu.vehicle.repair",
        expiresAt: new Date("2026-05-18T14:00:00.000Z")
      })
    ]);
    expect(missing).toEqual({
      status: 404,
      body: { error: "Not found" }
    });
  });

  it("runs Discord role sync through the permission control-plane route", async () => {
    const api = createApi();

    const response = await api.handle({
      method: "POST",
      path: "/connectors/discord/role-sync",
      body: {
        guildId: "guild-1",
        serverId: "server-1",
        roleMappings: [
          {
            discordRoleId: "role-admin",
            targetPrincipalId: "group.admin"
          }
        ],
        members: [
          {
            userId: "user-1",
            displayName: "Ada",
            roleIds: ["role-admin"]
          }
        ]
      }
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({
      audit: expect.objectContaining({
        guildId: "guild-1",
        scannedMembers: 1,
        mappedRoles: 1,
        addedEdges: 1,
        removedEdges: 0
      })
    }));
    expect(api.service.getPermissionSnapshot().edges).toEqual([
      {
        parentPrincipalId: "group.admin",
        childPrincipalId: "discord:guild-1:user-1:role-admin",
        source: "discord:guild-1"
      }
    ]);
  });
});
