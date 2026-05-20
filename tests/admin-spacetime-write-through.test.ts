import { createHash, createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { AdminService } from "../src/admin/service.js";
import { PermissionStore } from "../src/core/permission-store.js";
import {
  PluginDeploymentManager,
  pluginBundleSigningPayload,
  type PluginBundleSigningPayloadInput
} from "../src/core/plugin-deployment.js";
import { PluginSidecarSupervisor } from "../src/core/plugin-sidecar.js";
import { PluginRegistry } from "../src/core/plugins.js";
import { RuntimeControlPlane } from "../src/core/runtime.js";
import { FakeSpacetimeClient, SpacetimeRuntimeAdapter } from "../src/spacetime/adapter.js";

function signBundle(
  secret: string,
  bundle: Omit<PluginBundleSigningPayloadInput, "signerId" | "runtimeType"> &
    Partial<Pick<PluginBundleSigningPayloadInput, "signerId" | "runtimeType">>
) {
  return createHmac("sha256", secret).update(pluginBundleSigningPayload({
    signerId: "trusted-signer",
    runtimeType: "js_sidecar",
    ...bundle
  })).digest("hex");
}

describe("AdminService SpacetimeDB write-through", () => {
  it("mirrors config and permission edits through SpacetimeDB reducers", async () => {
    const runtime = new RuntimeControlPlane({
      now: () => new Date("2026-05-18T12:00:00.000Z"),
      idFactory: () => "config-id"
    });
    runtime.registerServer({
      id: "server-1",
      name: "Roleplay Dev",
      environment: "development",
      publicKey: "public-key"
    });
    const client = new FakeSpacetimeClient({});
    const spacetime = new SpacetimeRuntimeAdapter(client);
    const admin = new AdminService({
      runtime,
      permissions: new PermissionStore(),
      plugins: new PluginRegistry(),
      spacetime
    });

    admin.setConfig({
      serverId: "server-1",
      namespace: "economy",
      key: "enabled",
      value: true
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
      source: "manual",
      expiresAt: new Date("2026-05-18T14:00:00.000Z")
    });

    await admin.flushWrites();

    expect(client.reducerCalls.filter((call) => call.name !== "write_audit_log")).toEqual([
      {
        name: "set_runtime_config",
        args: {
          id: "config-id",
          serverId: "server-1",
          namespace: "economy",
          key: "enabled",
          value: true,
          version: 1
        }
      },
      {
        name: "upsert_principal",
        args: {
          id: "player:license:abc",
          principalType: "player",
          externalId: "license:abc",
          name: "Ada"
        }
      },
      {
        name: "grant_permission",
        args: {
          id: "player:license:abc:menu.vehicle.repair:allow",
          principalId: "player:license:abc",
          permissionKey: "menu.vehicle.repair",
          effect: "allow",
          source: "manual",
          expiresAt: new Date("2026-05-18T14:00:00.000Z")
        }
      }
    ]);
  });

  it("mirrors Discord role connector sync through permission reducers and audit", async () => {
    const permissions = new PermissionStore();
    permissions.addPrincipalEdge({
      parentPrincipalId: "group.admin",
      childPrincipalId: "discord:guild-1:user-old:role-admin",
      source: "discord:guild-1"
    });
    const client = new FakeSpacetimeClient({});
    const admin = new AdminService({
      runtime: new RuntimeControlPlane(),
      permissions,
      plugins: new PluginRegistry(),
      spacetime: new SpacetimeRuntimeAdapter(client)
    });

    const plan = admin.syncDiscordRoles({
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
    });
    await admin.flushWrites();

    expect(plan.audit).toEqual({
      guildId: "guild-1",
      scannedMembers: 1,
      mappedRoles: 1,
      addedEdges: 1,
      removedEdges: 1
    });
    expect(client.reducerCalls).toEqual([
      {
        name: "upsert_principal",
        args: {
          id: "discord:guild-1:role-admin",
          principalType: "discord_role",
          externalId: "guild-1:role-admin",
          name: "Discord Role role-admin"
        }
      },
      {
        name: "upsert_principal",
        args: {
          id: "discord:guild-1:user-1:role-admin",
          principalType: "discord_role",
          externalId: "guild-1:user-1:role-admin",
          name: "Ada role-admin"
        }
      },
      {
        name: "add_principal_edge",
        args: {
          id: "group.admin:discord:guild-1:user-1:role-admin:discord:guild-1",
          parentPrincipalId: "group.admin",
          childPrincipalId: "discord:guild-1:user-1:role-admin",
          source: "discord:guild-1",
          expiresAt: undefined
        }
      },
      {
        name: "remove_principal_edge",
        args: {
          edgeId: "group.admin:discord:guild-1:user-old:role-admin:discord:guild-1"
        }
      },
      {
        name: "write_audit_log",
        args: {
          id: "discord.role_sync:guild-1",
          serverId: "server-1",
          actorId: "connector:discord:guild-1",
          pluginId: "connector.discord",
          actionType: "discord.role_sync",
          permissionKey: "",
          targetType: "discord_guild",
          targetId: "guild-1",
          beforeJson: "{}",
          afterJson: "{\"guildId\":\"guild-1\",\"scannedMembers\":1,\"mappedRoles\":1,\"addedEdges\":1,\"removedEdges\":1}",
          status: "succeeded"
        }
      }
    ]);
  });

  it("surfaces failed mirrored writes when flushed", async () => {
    const runtime = new RuntimeControlPlane({
      idFactory: () => "config-id"
    });
    runtime.registerServer({
      id: "server-1",
      name: "Roleplay Dev",
      environment: "development",
      publicKey: "public-key"
    });
    const failingClient = new FakeSpacetimeClient({});
    failingClient.failReducer("set_runtime_config", new Error("database unavailable"));
    const admin = new AdminService({
      runtime,
      permissions: new PermissionStore(),
      plugins: new PluginRegistry(),
      spacetime: new SpacetimeRuntimeAdapter(failingClient)
    });

    admin.setConfig({
      serverId: "server-1",
      namespace: "economy",
      key: "enabled",
      value: true
    });

    await expect(admin.flushWrites()).rejects.toThrow("database unavailable");
  });

  it("mirrors runtime audit logs through SpacetimeDB reducers once", async () => {
    const runtime = new RuntimeControlPlane({
      now: () => new Date("2026-05-18T12:00:00.000Z"),
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
    const admin = new AdminService({
      runtime,
      permissions: new PermissionStore(),
      plugins: new PluginRegistry(),
      spacetime: new SpacetimeRuntimeAdapter(client)
    });

    admin.mirrorRuntimeAuditLogs("server-1");
    admin.mirrorRuntimeAuditLogs("server-1");
    await admin.flushWrites();

    expect(client.reducerCalls).toEqual([
      {
        name: "write_audit_log",
        args: {
          id: "runtime-audit-1",
          serverId: "server-1",
          actorId: "player:mechanic",
          pluginId: "mechanic_core",
          actionType: "hook.on_vehicle_damaged",
          permissionKey: "vehicle.inspect",
          targetType: "hook",
          targetId: "mechanic_core:on_vehicle_damaged:mechanic.inspect_damage",
          beforeJson: "{}",
          afterJson: "{\"actionCount\":0}",
          status: "succeeded"
        }
      }
    ]);
  });

  it("mirrors plugin install, enable, and disable through SpacetimeDB reducers", async () => {
    const client = new FakeSpacetimeClient({});
    const admin = new AdminService({
      runtime: new RuntimeControlPlane(),
      permissions: new PermissionStore(),
      plugins: new PluginRegistry({
        now: () => new Date("2026-05-18T12:00:00.000Z")
      }),
      spacetime: new SpacetimeRuntimeAdapter(client)
    });

    admin.installPlugin({
      pluginId: "mechanic_core",
      name: "Mechanic Core",
      version: "1.0.0",
      permissions: [{ key: "mechanic.repair", description: "Repair vehicles" }]
    });
    admin.enablePlugin("mechanic_core");
    admin.disablePlugin("mechanic_core");

    await admin.flushWrites();

    expect(client.reducerCalls.filter((call) => call.name !== "write_audit_log")).toEqual([
      {
        name: "register_plugin",
        args: {
          id: "mechanic_core",
          name: "Mechanic Core",
          version: "1.0.0",
          status: "installed",
          trustLevel: "manifest",
          signature: expect.stringMatching(/^manifest:sha256:[a-f0-9]{64}$/),
          bundleHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
          createdBy: "admin"
        }
      },
      {
        name: "register_plugin_manifest",
        args: {
          pluginId: "mechanic_core",
          manifestJson:
            "{\"pluginId\":\"mechanic_core\",\"name\":\"Mechanic Core\",\"version\":\"1.0.0\",\"permissions\":[{\"key\":\"mechanic.repair\",\"description\":\"Repair vehicles\"}]}",
          requiredPermissions: "mechanic.repair",
          requiredTables: "plugin_entities",
          requiredHooks: "",
          requiredConnectors: "",
          schemaVersion: 1
        }
      },
      {
        name: "set_plugin_status",
        args: {
          pluginId: "mechanic_core",
          status: "active"
        }
      },
      {
        name: "set_plugin_status",
        args: {
          pluginId: "mechanic_core",
          status: "disabled"
        }
      }
    ]);
  });

  it("mirrors cascade-disabled dependent plugin statuses through SpacetimeDB reducers", async () => {
    const client = new FakeSpacetimeClient({});
    const admin = new AdminService({
      runtime: new RuntimeControlPlane(),
      permissions: new PermissionStore(),
      plugins: new PluginRegistry(),
      spacetime: new SpacetimeRuntimeAdapter(client)
    });

    admin.installPlugin({
      pluginId: "economy_core",
      name: "Economy Core",
      version: "1.0.0",
      providedCapabilities: ["economy.transfer"]
    });
    admin.installPlugin({
      pluginId: "shop_core",
      name: "Shop Core",
      version: "1.0.0",
      requiredPlugins: ["economy_core"],
      requiredCapabilities: ["economy.transfer"]
    });
    admin.enablePlugin("economy_core");
    admin.enablePlugin("shop_core");
    await admin.flushWrites();
    client.reducerCalls.length = 0;

    admin.disablePlugin("economy_core");
    await admin.flushWrites();

    expect(admin.getPlugins()).toEqual([
      expect.objectContaining({ id: "economy_core", status: "disabled" }),
      expect.objectContaining({ id: "shop_core", status: "disabled" })
    ]);
    expect(client.reducerCalls.filter((call) => call.name !== "write_audit_log")).toEqual([
      {
        name: "set_plugin_status",
        args: {
          pluginId: "economy_core",
          status: "disabled"
        }
      },
      {
        name: "set_plugin_status",
        args: {
          pluginId: "shop_core",
          status: "disabled"
        }
      }
    ]);
  });

  it("mirrors cascade-disabled dependent plugin statuses when a dependency is uninstalled", async () => {
    const client = new FakeSpacetimeClient({});
    const admin = new AdminService({
      runtime: new RuntimeControlPlane(),
      permissions: new PermissionStore(),
      plugins: new PluginRegistry({
        now: () => new Date("2026-05-18T12:00:00.000Z")
      }),
      spacetime: new SpacetimeRuntimeAdapter(client)
    });
    admin.installPlugin({
      pluginId: "economy_core",
      name: "Economy Core",
      version: "1.0.0",
      providedCapabilities: ["economy.transfer"]
    });
    admin.installPlugin({
      pluginId: "shop_core",
      name: "Shop Core",
      version: "1.0.0",
      requiredPlugins: ["economy_core"],
      requiredCapabilities: ["economy.transfer"]
    });
    admin.enablePlugin("economy_core");
    admin.enablePlugin("shop_core");
    await admin.flushWrites();
    client.reducerCalls.length = 0;

    admin.uninstallPlugin("economy_core");
    await admin.flushWrites();

    expect(admin.getPlugins()).toEqual([
      expect.objectContaining({ id: "shop_core", status: "disabled" })
    ]);
    expect(client.reducerCalls).toEqual(expect.arrayContaining([
      {
        name: "set_plugin_status",
        args: {
          pluginId: "shop_core",
          status: "disabled"
        }
      },
      {
        name: "uninstall_plugin",
        args: {
          pluginId: "economy_core"
        }
      }
    ]));
  });

  it("mirrors deployment request, approval, and kill-switch updates through SpacetimeDB reducers", async () => {
    const client = new FakeSpacetimeClient({});
    let nextId = 0;
    const deployments = new PluginDeploymentManager({
      idFactory: () => `deployment-${++nextId}`,
      now: () => new Date("2026-05-18T12:00:00.000Z"),
      signers: [{ id: "trusted-signer", secret: "secret" }]
    });
    deployments.registerBundle({
      id: "bundle-1",
      pluginId: "economy_core",
      version: "1.0.0",
      artifactUrl: "memory://economy_core.js",
      bundleHash: "hash",
      signature: "signature",
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [{ key: "economy.transfer" }]
    });
    const admin = new AdminService({
      runtime: new RuntimeControlPlane(),
      permissions: new PermissionStore(),
      plugins: new PluginRegistry(),
      deployments,
      spacetime: new SpacetimeRuntimeAdapter(client)
    });

    const pending = admin.requestPluginDeployment({
      pluginId: "economy_core",
      bundleId: "bundle-1",
      serverId: "server-1",
      bundleBytes: "bundle-bytes",
      requestedBy: "owner:1"
    });
    const failed = admin.approvePluginDeployment(pending.id, "owner:1");
    const killed = admin.killPlugin("economy_core", "owner:1", "disabled from admin");

    await admin.flushWrites();

    expect(failed.status).toBe("failed");
    expect(killed).toEqual([]);
    expect(client.reducerCalls).toEqual(expect.arrayContaining([
      {
        name: "upsert_plugin_deployment",
        args: {
          id: "deployment-1",
          pluginId: "economy_core",
          bundleId: "bundle-1",
          serverId: "server-1",
          status: "pending",
          desiredVersion: "1.0.0",
          activeVersion: "",
          errorMessage: ""
        }
      },
      {
        name: "upsert_plugin_deployment",
        args: {
          id: "deployment-1",
          pluginId: "economy_core",
          bundleId: "bundle-1",
          serverId: "server-1",
          status: "failed",
          desiredVersion: "1.0.0",
          activeVersion: "",
          errorMessage: "Bundle hash mismatch"
        }
      }
    ]));
  });

  it("mirrors superseded active deployments when approving a newer rollout", async () => {
    const client = new FakeSpacetimeClient({});
    let nextId = 0;
    const secret = "secret";
    const firstBytes = "console.log('economy core')";
    const firstHash = createHash("sha256").update(firstBytes).digest("hex");
    const secondBytes = "console.log('economy core v2')";
    const secondHash = createHash("sha256").update(secondBytes).digest("hex");
    const deployments = new PluginDeploymentManager({
      idFactory: () => `deployment-${++nextId}`,
      now: () => new Date("2026-05-18T12:00:00.000Z"),
      signers: [{ id: "trusted-signer", secret }]
    });
    const admin = new AdminService({
      runtime: new RuntimeControlPlane(),
      permissions: new PermissionStore(),
      plugins: new PluginRegistry(),
      deployments,
      spacetime: new SpacetimeRuntimeAdapter(client)
    });

    admin.registerPluginBundle({
      id: "bundle-1",
      pluginId: "economy_core",
      version: "1.0.0",
      artifactUrl: "memory://economy_core-1.0.0.js",
      bundleHash: firstHash,
      signature: signBundle(secret, {
        id: "bundle-1",
        pluginId: "economy_core",
        version: "1.0.0",
        bundleHash: firstHash,
        capabilities: [{ key: "economy.transfer" }]
      }),
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [{ key: "economy.transfer" }]
    });
    admin.registerPluginBundle({
      id: "bundle-2",
      pluginId: "economy_core",
      version: "2.0.0",
      artifactUrl: "memory://economy_core-2.0.0.js",
      bundleHash: secondHash,
      signature: signBundle(secret, {
        id: "bundle-2",
        pluginId: "economy_core",
        version: "2.0.0",
        bundleHash: secondHash,
        capabilities: [{ key: "economy.transfer" }, { key: "economy.invoice" }]
      }),
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [{ key: "economy.transfer" }, { key: "economy.invoice" }]
    });
    admin.requestPluginDeployment({
      pluginId: "economy_core",
      bundleId: "bundle-1",
      serverId: "server-1",
      bundleBytes: firstBytes,
      requestedBy: "owner:1"
    });
    admin.approvePluginDeployment("deployment-1", "owner:1");
    const pending = admin.requestPluginDeployment({
      pluginId: "economy_core",
      bundleId: "bundle-2",
      serverId: "server-1",
      bundleBytes: secondBytes,
      requestedBy: "owner:1"
    });
    await admin.flushWrites();
    client.reducerCalls.splice(0);

    admin.approvePluginDeployment(pending.id, "owner:2");
    await admin.flushWrites();

    expect(client.reducerCalls).toEqual(expect.arrayContaining([
      {
        name: "upsert_plugin_deployment",
        args: {
          id: "deployment-1",
          pluginId: "economy_core",
          bundleId: "bundle-1",
          serverId: "server-1",
          status: "rolled_back",
          desiredVersion: "1.0.0",
          activeVersion: "1.0.0",
          errorMessage: ""
        }
      },
      {
        name: "upsert_plugin_deployment",
        args: {
          id: "deployment-2",
          pluginId: "economy_core",
          bundleId: "bundle-2",
          serverId: "server-1",
          status: "active",
          desiredVersion: "2.0.0",
          activeVersion: "2.0.0",
          errorMessage: ""
        }
      }
    ]));
  });

  it("mirrors deployment request, approval, and kill-switch audit logs through SpacetimeDB", async () => {
    const client = new FakeSpacetimeClient({});
    let nextId = 0;
    const secret = "secret";
    const bundleBytes = "console.log('economy core')";
    const bundleHash = createHash("sha256").update(bundleBytes).digest("hex");
    const deployments = new PluginDeploymentManager({
      idFactory: () => `deployment-${++nextId}`,
      now: () => new Date("2026-05-18T12:00:00.000Z"),
      signers: [{ id: "trusted-signer", secret }]
    });
    deployments.registerBundle({
      id: "bundle-1",
      pluginId: "economy_core",
      version: "1.0.0",
      artifactUrl: "memory://economy_core.js",
      bundleHash,
      signature: signBundle(secret, {
        id: "bundle-1",
        pluginId: "economy_core",
        version: "1.0.0",
        bundleHash,
        capabilities: [{ key: "economy.transfer" }]
      }),
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [{ key: "economy.transfer" }]
    });
    const admin = new AdminService({
      runtime: new RuntimeControlPlane(),
      permissions: new PermissionStore(),
      plugins: new PluginRegistry(),
      deployments,
      spacetime: new SpacetimeRuntimeAdapter(client)
    });

    const pending = admin.requestPluginDeployment({
      pluginId: "economy_core",
      bundleId: "bundle-1",
      serverId: "server-1",
      bundleBytes,
      requestedBy: "owner:1"
    });
    admin.approvePluginDeployment(pending.id, "owner:2");
    admin.killPlugin("economy_core", "owner:3", "disabled from admin");
    await admin.flushWrites();

    expect(client.reducerCalls).toEqual(expect.arrayContaining([
      {
        name: "write_audit_log",
        args: expect.objectContaining({
          id: "plugin.deployment_requested:deployment-1:2",
          serverId: "server-1",
          actorId: "owner:1",
          pluginId: "economy_core",
          actionType: "plugin.deployment_requested",
          targetId: "deployment-1",
          status: "succeeded"
        })
      },
      {
        name: "write_audit_log",
        args: expect.objectContaining({
          id: "plugin.deployment_approved:deployment-1:3",
          serverId: "server-1",
          actorId: "owner:2",
          pluginId: "economy_core",
          actionType: "plugin.deployment_approved",
          targetId: "deployment-1",
          status: "succeeded"
        })
      },
      {
        name: "write_audit_log",
        args: expect.objectContaining({
          id: "plugin.deployment_killed:deployment-1:4",
          serverId: "server-1",
          actorId: "owner:3",
          pluginId: "economy_core",
          actionType: "plugin.deployment_killed",
          targetId: "deployment-1",
          status: "succeeded",
          afterJson: "{\"reason\":\"disabled from admin\"}"
        })
      },
      {
        name: "write_audit_log",
        args: expect.objectContaining({
          id: "plugin.kill_switch:economy_core:5",
          serverId: "server-1",
          actorId: "owner:3",
          pluginId: "economy_core",
          actionType: "plugin.kill_switch",
          targetId: "economy_core",
          status: "succeeded"
        })
      }
    ]));
  });

  it("mirrors deployment kills when a plugin is disabled through the registry", async () => {
    const client = new FakeSpacetimeClient({});
    let nextId = 0;
    const secret = "secret";
    const bundleBytes = "console.log('economy core')";
    const bundleHash = createHash("sha256").update(bundleBytes).digest("hex");
    const deployments = new PluginDeploymentManager({
      idFactory: () => `deployment-${++nextId}`,
      now: () => new Date("2026-05-18T12:00:00.000Z"),
      signers: [{ id: "trusted-signer", secret }]
    });
    deployments.registerBundle({
      id: "bundle-1",
      pluginId: "economy_core",
      version: "1.0.0",
      artifactUrl: "memory://economy_core.js",
      bundleHash,
      signature: signBundle(secret, {
        id: "bundle-1",
        pluginId: "economy_core",
        version: "1.0.0",
        bundleHash,
        capabilities: [{ key: "economy.transfer" }]
      }),
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [{ key: "economy.transfer" }]
    });
    const admin = new AdminService({
      runtime: new RuntimeControlPlane(),
      permissions: new PermissionStore(),
      plugins: new PluginRegistry(),
      deployments,
      spacetime: new SpacetimeRuntimeAdapter(client)
    });

    admin.installPlugin({
      pluginId: "economy_core",
      name: "Economy Core",
      version: "1.0.0"
    });
    admin.enablePlugin("economy_core");
    const pending = admin.requestPluginDeployment({
      pluginId: "economy_core",
      bundleId: "bundle-1",
      serverId: "server-1",
      bundleBytes,
      requestedBy: "owner:1"
    });
    admin.approvePluginDeployment(pending.id, "owner:2");
    admin.disablePlugin("economy_core");
    await admin.flushWrites();

    expect(client.reducerCalls).toEqual(expect.arrayContaining([
      {
        name: "upsert_plugin_deployment",
        args: {
          id: "deployment-1",
          pluginId: "economy_core",
          bundleId: "bundle-1",
          serverId: "server-1",
          status: "killed",
          desiredVersion: "1.0.0",
          activeVersion: "1.0.0",
          errorMessage: "plugin disabled"
        }
      },
      {
        name: "write_audit_log",
        args: expect.objectContaining({
          id: "plugin.deployment_killed:deployment-1:4",
          serverId: "server-1",
          actorId: "system",
          pluginId: "economy_core",
          actionType: "plugin.deployment_killed",
          targetId: "deployment-1",
          status: "succeeded",
          afterJson: "{\"reason\":\"plugin disabled\"}"
        })
      },
      {
        name: "write_audit_log",
        args: expect.objectContaining({
          id: "plugin.kill_switch:economy_core:5",
          serverId: "server-1",
          actorId: "system",
          pluginId: "economy_core",
          actionType: "plugin.kill_switch",
          targetId: "economy_core",
          status: "succeeded"
        })
      }
    ]));
  });

  it("mirrors rollback deployment state transitions through SpacetimeDB reducers", async () => {
    const client = new FakeSpacetimeClient({});
    let nextId = 0;
    const secret = "secret";
    const bundleBytes = "console.log('mechanic v1')";
    const bundleHash = createHash("sha256").update(bundleBytes).digest("hex");
    const secondBundleBytes = "console.log('mechanic v2')";
    const secondBundleHash = createHash("sha256").update(secondBundleBytes).digest("hex");
    const deployments = new PluginDeploymentManager({
      idFactory: () => `deployment-${++nextId}`,
      now: () => new Date("2026-05-18T12:00:00.000Z"),
      signers: [{ id: "trusted-signer", secret }]
    });
    deployments.registerBundle({
      id: "bundle-1",
      pluginId: "mechanic_core",
      version: "1.0.0",
      artifactUrl: "memory://mechanic_core-1.0.0.js",
      bundleHash,
      signature: signBundle(secret, {
        id: "bundle-1",
        pluginId: "mechanic_core",
        version: "1.0.0",
        bundleHash,
        capabilities: [{ key: "vehicle.repair" }]
      }),
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [{ key: "vehicle.repair" }]
    });
    deployments.registerBundle({
      id: "bundle-2",
      pluginId: "mechanic_core",
      version: "2.0.0",
      artifactUrl: "memory://mechanic_core-2.0.0.js",
      bundleHash: secondBundleHash,
      signature: signBundle(secret, {
        id: "bundle-2",
        pluginId: "mechanic_core",
        version: "2.0.0",
        bundleHash: secondBundleHash,
        capabilities: [{ key: "vehicle.repair" }, { key: "vehicle.invoice" }]
      }),
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [{ key: "vehicle.repair" }, { key: "vehicle.invoice" }]
    });
    deployments.deploy({
      pluginId: "mechanic_core",
      bundleId: "bundle-1",
      serverId: "server-1",
      bundleBytes
    });
    deployments.deploy({
      pluginId: "mechanic_core",
      bundleId: "bundle-2",
      serverId: "server-1",
      bundleBytes: secondBundleBytes
    });
    const admin = new AdminService({
      runtime: new RuntimeControlPlane(),
      permissions: new PermissionStore(),
      plugins: new PluginRegistry(),
      deployments,
      spacetime: new SpacetimeRuntimeAdapter(client)
    });

    const rollback = admin.rollbackPluginDeployment("mechanic_core", "server-1");
    await admin.flushWrites();

    expect(rollback).toEqual(expect.objectContaining({
      id: "deployment-3",
      bundleId: "bundle-1",
      status: "active",
      activeVersion: "1.0.0"
    }));
    expect(client.reducerCalls).toEqual(expect.arrayContaining([
      {
        name: "upsert_plugin_deployment",
        args: {
          id: "deployment-2",
          pluginId: "mechanic_core",
          bundleId: "bundle-2",
          serverId: "server-1",
          status: "rolled_back",
          desiredVersion: "2.0.0",
          activeVersion: "2.0.0",
          errorMessage: ""
        }
      },
      {
        name: "upsert_plugin_deployment",
        args: {
          id: "deployment-3",
          pluginId: "mechanic_core",
          bundleId: "bundle-1",
          serverId: "server-1",
          status: "active",
          desiredVersion: "1.0.0",
          activeVersion: "1.0.0",
          errorMessage: ""
        }
      }
    ]));
    expect(client.reducerCalls).toContainEqual({
      name: "write_audit_log",
      args: expect.objectContaining({
        id: "plugin.deployment_rolled_back:deployment-2:5",
        serverId: "server-1",
        actorId: "system",
        pluginId: "mechanic_core",
        actionType: "plugin.deployment_rolled_back",
        targetId: "deployment-2",
        afterJson: "{\"rollbackDeploymentId\":\"deployment-3\",\"restoredBundleId\":\"bundle-1\",\"restoredVersion\":\"1.0.0\"}",
        status: "succeeded"
      })
    });
  });

  it("mirrors signer revocation as a SpacetimeDB audit log", async () => {
    const client = new FakeSpacetimeClient({});
    const deployments = new PluginDeploymentManager({
      now: () => new Date("2026-05-18T12:00:00.000Z"),
      signers: [{ id: "trusted-signer", secret: "secret" }]
    });
    const admin = new AdminService({
      runtime: new RuntimeControlPlane(),
      permissions: new PermissionStore(),
      plugins: new PluginRegistry(),
      deployments,
      spacetime: new SpacetimeRuntimeAdapter(client)
    });

    admin.revokePluginSigner("trusted-signer", "owner:1", "compromised signer", "server-1");
    await admin.flushWrites();

    expect(client.reducerCalls).toEqual([
      {
        name: "write_audit_log",
        args: {
          id: "plugin.signer_revoked:trusted-signer:1",
          serverId: "server-1",
          actorId: "owner:1",
          pluginId: "",
          actionType: "plugin.signer_revoked",
          permissionKey: "",
          targetType: "plugin",
          targetId: "trusted-signer",
          beforeJson: "{}",
          afterJson: "{\"reason\":\"compromised signer\"}",
          status: "succeeded"
        }
      }
    ]);
  });

  it("mirrors deployments killed by signer revocation through SpacetimeDB", async () => {
    const client = new FakeSpacetimeClient({});
    const secret = "secret";
    const bundleBytes = "console.log('admin tools')";
    const bundleHash = createHash("sha256").update(bundleBytes).digest("hex");
    const deployments = new PluginDeploymentManager({
      now: () => new Date("2026-05-18T12:00:00.000Z"),
      idFactory: () => "deployment-1",
      signers: [{ id: "trusted-signer", secret }]
    });
    const admin = new AdminService({
      runtime: new RuntimeControlPlane(),
      permissions: new PermissionStore(),
      plugins: new PluginRegistry(),
      deployments,
      spacetime: new SpacetimeRuntimeAdapter(client)
    });

    admin.registerPluginBundle({
      id: "bundle-1",
      pluginId: "admin_tools",
      version: "1.0.0",
      artifactUrl: "memory://admin_tools-1.0.0.js",
      bundleHash,
      signature: signBundle(secret, {
        id: "bundle-1",
        pluginId: "admin_tools",
        version: "1.0.0",
        bundleHash,
        capabilities: [{ key: "vehicle.repair" }]
      }),
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [{ key: "vehicle.repair" }]
    });
    const pending = admin.requestPluginDeployment({
      pluginId: "admin_tools",
      bundleId: "bundle-1",
      serverId: "server-1",
      bundleBytes,
      requestedBy: "owner:1"
    });
    admin.approvePluginDeployment(pending.id, "owner:1");
    await admin.flushWrites();
    client.reducerCalls.splice(0);

    admin.revokePluginSigner("trusted-signer", "owner:1", "compromised signer", "server-1");
    await admin.flushWrites();

    expect(client.reducerCalls).toContainEqual({
      name: "upsert_plugin_deployment",
      args: {
        id: "deployment-1",
        pluginId: "admin_tools",
        bundleId: "bundle-1",
        serverId: "server-1",
        status: "killed",
        desiredVersion: "1.0.0",
        activeVersion: "1.0.0",
        errorMessage: "signer revoked: compromised signer"
      }
    });
  });

  it("mirrors bundle revocation and killed deployments through SpacetimeDB", async () => {
    const client = new FakeSpacetimeClient({});
    const secret = "secret";
    const bundleBytes = "console.log('admin tools')";
    const bundleHash = createHash("sha256").update(bundleBytes).digest("hex");
    const deployments = new PluginDeploymentManager({
      now: () => new Date("2026-05-18T12:00:00.000Z"),
      idFactory: () => "deployment-1",
      signers: [{ id: "trusted-signer", secret }]
    });
    const admin = new AdminService({
      runtime: new RuntimeControlPlane(),
      permissions: new PermissionStore(),
      plugins: new PluginRegistry(),
      deployments,
      spacetime: new SpacetimeRuntimeAdapter(client)
    });

    admin.registerPluginBundle({
      id: "bundle-1",
      pluginId: "admin_tools",
      version: "1.0.0",
      artifactUrl: "memory://admin_tools-1.0.0.js",
      bundleHash,
      signature: signBundle(secret, {
        id: "bundle-1",
        pluginId: "admin_tools",
        version: "1.0.0",
        bundleHash,
        capabilities: [{ key: "vehicle.repair" }]
      }),
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [{ key: "vehicle.repair" }]
    });
    const pending = admin.requestPluginDeployment({
      pluginId: "admin_tools",
      bundleId: "bundle-1",
      serverId: "server-1",
      bundleBytes,
      requestedBy: "owner:1"
    });
    admin.approvePluginDeployment(pending.id, "owner:1");
    await admin.flushWrites();
    client.reducerCalls.splice(0);

    admin.revokePluginBundle("bundle-1", "owner:2", "bad release", "server-1");
    await admin.flushWrites();

    expect(client.reducerCalls).toEqual(expect.arrayContaining([
      {
        name: "revoke_plugin_bundle",
        args: {
          bundleId: "bundle-1",
          status: "revoked",
          actorId: "owner:2",
          reason: "bad release"
        }
      },
      {
        name: "upsert_plugin_deployment",
        args: {
          id: "deployment-1",
          pluginId: "admin_tools",
          bundleId: "bundle-1",
          serverId: "server-1",
          status: "killed",
          desiredVersion: "1.0.0",
          activeVersion: "1.0.0",
          errorMessage: "bundle revoked: bad release"
        }
      },
      {
        name: "write_audit_log",
        args: expect.objectContaining({
          actorId: "owner:2",
          actionType: "plugin.bundle_revoked",
          targetId: "bundle-1",
          afterJson: "{\"reason\":\"bad release\"}"
        })
      }
    ]));
  });

  it("mirrors pending deployments killed by signer revocation through SpacetimeDB", async () => {
    const client = new FakeSpacetimeClient({});
    const secret = "secret";
    const bundleBytes = "console.log('admin tools')";
    const bundleHash = createHash("sha256").update(bundleBytes).digest("hex");
    const deployments = new PluginDeploymentManager({
      now: () => new Date("2026-05-18T12:00:00.000Z"),
      idFactory: () => "deployment-1",
      signers: [{ id: "trusted-signer", secret }]
    });
    const admin = new AdminService({
      runtime: new RuntimeControlPlane(),
      permissions: new PermissionStore(),
      plugins: new PluginRegistry(),
      deployments,
      spacetime: new SpacetimeRuntimeAdapter(client)
    });

    admin.registerPluginBundle({
      id: "bundle-1",
      pluginId: "admin_tools",
      version: "1.0.0",
      artifactUrl: "memory://admin_tools-1.0.0.js",
      bundleHash,
      signature: signBundle(secret, {
        id: "bundle-1",
        pluginId: "admin_tools",
        version: "1.0.0",
        bundleHash,
        capabilities: [{ key: "vehicle.repair" }]
      }),
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [{ key: "vehicle.repair" }]
    });
    admin.requestPluginDeployment({
      pluginId: "admin_tools",
      bundleId: "bundle-1",
      serverId: "server-1",
      bundleBytes,
      requestedBy: "owner:1"
    });
    await admin.flushWrites();
    client.reducerCalls.splice(0);

    admin.revokePluginSigner("trusted-signer", "owner:1", "compromised signer", "server-1");
    await admin.flushWrites();

    expect(client.reducerCalls).toContainEqual({
      name: "upsert_plugin_deployment",
      args: {
        id: "deployment-1",
        pluginId: "admin_tools",
        bundleId: "bundle-1",
        serverId: "server-1",
        status: "killed",
        desiredVersion: "1.0.0",
        activeVersion: "",
        errorMessage: "signer revoked: compromised signer"
      }
    });
  });

  it("mirrors plugin bundle metadata and capabilities through SpacetimeDB reducers", async () => {
    const client = new FakeSpacetimeClient({});
    const deployments = new PluginDeploymentManager({
      now: () => new Date("2026-05-18T12:00:00.000Z"),
      signers: [{ id: "trusted-signer", secret: "secret" }]
    });
    const admin = new AdminService({
      runtime: new RuntimeControlPlane(),
      permissions: new PermissionStore(),
      plugins: new PluginRegistry(),
      deployments,
      spacetime: new SpacetimeRuntimeAdapter(client)
    });

    admin.registerPluginBundle({
      id: "bundle-1",
      pluginId: "mechanic_core",
      version: "1.0.0",
      artifactUrl: "memory://mechanic_core.js",
      bundleHash: "hash",
      signature: "signature",
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [
        { key: "vehicle.repair", constraints: { maxDistance: 10 } },
        { key: "invoice.issue" }
      ]
    });

    await admin.flushWrites();

    expect(client.reducerCalls).toEqual([
      {
        name: "register_plugin_bundle",
        args: {
          id: "bundle-1",
          pluginId: "mechanic_core",
          version: "1.0.0",
          artifactUrl: "memory://mechanic_core.js",
          bundleHash: "hash",
          signature: "signature",
          signerId: "trusted-signer",
          runtimeType: "js_sidecar",
          status: "registered"
        }
      },
      {
        name: "upsert_plugin_capability",
        args: {
          id: "bundle-1:vehicle.repair",
          pluginId: "mechanic_core",
          bundleId: "bundle-1",
          capabilityKey: "vehicle.repair",
          constraintsJson: "{\"maxDistance\":10}",
          status: "enabled"
        }
      },
      {
        name: "upsert_plugin_capability",
        args: {
          id: "bundle-1:invoice.issue",
          pluginId: "mechanic_core",
          bundleId: "bundle-1",
          capabilityKey: "invoice.issue",
          constraintsJson: "{}",
          status: "enabled"
        }
      }
    ]);
  });

  it("mirrors sidecar sandbox events through SpacetimeDB reducers once", async () => {
    const client = new FakeSpacetimeClient({});
    const admin = new AdminService({
      runtime: new RuntimeControlPlane(),
      permissions: new PermissionStore(),
      plugins: new PluginRegistry(),
      spacetime: new SpacetimeRuntimeAdapter(client)
    });
    let nextSidecarId = 0;
    const supervisor = new PluginSidecarSupervisor({
      driver: {
        async start() {
          return { pid: 1234 };
        },
        async stop() {
          return undefined;
        }
      },
      now: () => new Date("2026-05-18T12:00:00.000Z"),
      idFactory: () => `sidecar-${++nextSidecarId}`
    });
    const deployment = {
      id: "deployment-1",
      pluginId: "mechanic_core",
      bundleId: "bundle-1",
      serverId: "server-1",
      status: "active" as const,
      desiredVersion: "1.0.0",
      activeVersion: "1.0.0",
      deployedAt: new Date("2026-05-18T12:00:00.000Z")
    };
    const bundle = {
      id: "bundle-1",
      pluginId: "mechanic_core",
      version: "1.0.0",
      artifactUrl: "memory://mechanic_core.js",
      bundleHash: "hash",
      signature: "signature",
      signerId: "trusted-signer",
      runtimeType: "js_sidecar" as const,
      capabilities: [{ key: "vehicle.repair" }],
      status: "registered" as const,
      createdAt: new Date("2026-05-18T12:00:00.000Z")
    };

    const instance = await supervisor.start(deployment, bundle);
    supervisor.heartbeat(instance.id);
    admin.mirrorPluginSandboxEvents(supervisor.getSandboxEvents());
    admin.mirrorPluginSandboxEvents(supervisor.getSandboxEvents());
    await admin.flushWrites();

    expect(client.reducerCalls).toEqual([
      {
        name: "record_plugin_sandbox_event",
        args: expect.objectContaining({
          id: "sidecar-2",
          pluginId: "mechanic_core",
          serverId: "server-1",
          eventType: "sidecar.started",
          status: "succeeded"
        })
      },
      {
        name: "record_plugin_sandbox_event",
        args: expect.objectContaining({
          id: "sidecar-3",
          pluginId: "mechanic_core",
          serverId: "server-1",
          eventType: "sidecar.heartbeat",
          status: "succeeded"
        })
      }
    ]);
  });

  it("mirrors stale sidecar failure events with failed deployment rollback state", async () => {
    const client = new FakeSpacetimeClient({});
    let nextDeploymentId = 0;
    let nextSidecarId = 0;
    let currentTime = new Date("2026-05-18T12:00:00.000Z");
    const secret = "secret";
    const bundleBytes = "console.log('mechanic v1')";
    const bundleHash = createHash("sha256").update(bundleBytes).digest("hex");
    const secondBundleBytes = "console.log('mechanic v2')";
    const secondBundleHash = createHash("sha256").update(secondBundleBytes).digest("hex");
    const deployments = new PluginDeploymentManager({
      idFactory: () => `deployment-${++nextDeploymentId}`,
      now: () => new Date("2026-05-18T12:00:00.000Z"),
      signers: [{ id: "trusted-signer", secret }]
    });
    const firstBundle = deployments.registerBundle({
      id: "bundle-1",
      pluginId: "mechanic_core",
      version: "1.0.0",
      artifactUrl: "memory://mechanic_core-1.0.0.js",
      bundleHash,
      signature: signBundle(secret, {
        id: "bundle-1",
        pluginId: "mechanic_core",
        version: "1.0.0",
        bundleHash,
        capabilities: [{ key: "vehicle.repair" }]
      }),
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [{ key: "vehicle.repair" }]
    });
    const secondBundle = deployments.registerBundle({
      id: "bundle-2",
      pluginId: "mechanic_core",
      version: "2.0.0",
      artifactUrl: "memory://mechanic_core-2.0.0.js",
      bundleHash: secondBundleHash,
      signature: signBundle(secret, {
        id: "bundle-2",
        pluginId: "mechanic_core",
        version: "2.0.0",
        bundleHash: secondBundleHash,
        capabilities: [{ key: "vehicle.repair" }, { key: "vehicle.invoice" }]
      }),
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [{ key: "vehicle.repair" }, { key: "vehicle.invoice" }]
    });
    deployments.deploy({
      pluginId: "mechanic_core",
      bundleId: firstBundle.id,
      serverId: "server-1",
      bundleBytes
    });
    const active = deployments.deploy({
      pluginId: "mechanic_core",
      bundleId: secondBundle.id,
      serverId: "server-1",
      bundleBytes: secondBundleBytes
    });
    const supervisor = new PluginSidecarSupervisor({
      driver: {
        async start() {
          return { pid: 1234 };
        },
        async stop() {
          return undefined;
        }
      },
      now: () => currentTime,
      idFactory: () => `sidecar-${++nextSidecarId}`,
      heartbeatTimeoutMs: 30_000
    });
    await supervisor.start(active, secondBundle);
    const admin = new AdminService({
      runtime: new RuntimeControlPlane(),
      permissions: new PermissionStore(),
      plugins: new PluginRegistry(),
      deployments,
      spacetime: new SpacetimeRuntimeAdapter(client)
    });

    currentTime = new Date("2026-05-18T12:01:00.000Z");
    const stale = await supervisor.failStaleInstances();
    admin.failPluginSidecarDeployments(stale, supervisor.getSandboxEvents());
    await admin.flushWrites();

    expect(client.reducerCalls).toEqual(expect.arrayContaining([
      {
        name: "record_plugin_sandbox_event",
        args: expect.objectContaining({
          id: "sidecar-2",
          pluginId: "mechanic_core",
          serverId: "server-1",
          eventType: "sidecar.started",
          status: "succeeded"
        })
      },
      {
        name: "record_plugin_sandbox_event",
        args: expect.objectContaining({
          id: "sidecar-3",
          pluginId: "mechanic_core",
          serverId: "server-1",
          eventType: "sidecar.failed",
          status: "failed"
        })
      },
      {
        name: "upsert_plugin_deployment",
        args: expect.objectContaining({
          id: "deployment-2",
          pluginId: "mechanic_core",
          bundleId: "bundle-2",
          serverId: "server-1",
          status: "failed",
          errorMessage: "sidecar heartbeat timeout"
        })
      },
      {
        name: "upsert_plugin_deployment",
        args: expect.objectContaining({
          id: "deployment-3",
          pluginId: "mechanic_core",
          bundleId: "bundle-1",
          serverId: "server-1",
          status: "active",
          activeVersion: "1.0.0"
        })
      },
      {
        name: "write_audit_log",
        args: expect.objectContaining({
          actorId: "runtime:server-1",
          pluginId: "mechanic_core",
          actionType: "plugin.deployment_failed",
          targetId: "deployment-2",
          status: "failed",
          afterJson: "{\"error\":\"sidecar heartbeat timeout\"}"
        })
      }
    ]));
  });
});
