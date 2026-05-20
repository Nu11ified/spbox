import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createAdminHttpApi } from "../src/admin/http-api.js";
import { AdminService } from "../src/admin/service.js";
import { PermissionStore } from "../src/core/permission-store.js";
import { hashPluginManifest, PluginRegistry, type PluginManifest } from "../src/core/plugins.js";
import { RuntimeControlPlane } from "../src/core/runtime.js";
import { FakeSpacetimeClient, SpacetimeRuntimeAdapter } from "../src/spacetime/adapter.js";

const packageSigner = { id: "trusted-marketplace", secret: "package-secret" };

function signPackageManifest(manifestHash: string): string {
  return createHmac("sha256", packageSigner.secret).update(manifestHash).digest("hex");
}

function createAdmin(client = new FakeSpacetimeClient({})): { admin: AdminService; client: FakeSpacetimeClient } {
  return {
    client,
    admin: new AdminService({
      runtime: new RuntimeControlPlane(),
      permissions: new PermissionStore(),
      plugins: new PluginRegistry({ packageSigners: [packageSigner] }),
      spacetime: new SpacetimeRuntimeAdapter(client)
    })
  };
}

describe("admin plugin registry control-plane write-through", () => {
  it("serves plugin list reads from SpacetimeDB live cache when available", async () => {
    const client = new FakeSpacetimeClient({
      plugins: [
        {
          id: "economy_core",
          name: "Economy Core",
          version: "1.0.0",
          status: "active",
          installedAt: new Date("2026-05-18T12:00:00.000Z"),
          updatedAt: new Date("2026-05-18T12:00:00.000Z")
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

    expect(admin.getPlugins()).toEqual([
      expect.objectContaining({ id: "economy_core", status: "active" })
    ]);
    await expect(api.handle({ method: "GET", path: "/plugins" })).resolves.toEqual({
      status: 200,
      body: [expect.objectContaining({ id: "economy_core", status: "active" })]
    });
  });

  it("serves full plugin registry reads from SpacetimeDB live cache", async () => {
    const client = new FakeSpacetimeClient({
      plugins: [
        {
          id: "mechanic_core",
          name: "Mechanic Core",
          version: "1.0.0",
          status: "active",
          installedAt: new Date("2026-05-18T12:00:00.000Z"),
          updatedAt: new Date("2026-05-18T12:00:00.000Z")
        }
      ],
      plugin_manifests: [
        {
          pluginId: "mechanic_core",
          manifestJson: "{\"pluginId\":\"mechanic_core\"}",
          requiredPermissions: "mechanic.repair",
          requiredTables: "plugin_entities",
          requiredHooks: "on_vehicle_damaged",
          requiredConnectors: "discord",
          schemaVersion: 1,
          updatedAt: new Date("2026-05-18T12:00:00.000Z")
        }
      ],
      plugin_runtime_instances: [
        {
          id: "mechanic_core:server-1",
          pluginId: "mechanic_core",
          serverId: "server-1",
          status: "loaded",
          loadedAt: new Date("2026-05-18T12:00:00.000Z"),
          lastHeartbeat: new Date("2026-05-18T12:01:00.000Z"),
          errorMessage: ""
        }
      ],
      plugin_config_values: [
        {
          id: "mechanic_core:server-1:hourlyRate",
          pluginId: "mechanic_core",
          serverId: "server-1",
          key: "hourlyRate",
          valueJson: "75",
          version: 2,
          updatedAt: new Date("2026-05-18T12:00:00.000Z")
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

    await expect(api.handle({ method: "GET", path: "/plugins/registry" })).resolves.toEqual({
      status: 200,
      body: {
        plugins: [expect.objectContaining({ id: "mechanic_core", status: "active" })],
        packages: [],
        packageSignerRevocations: [],
        manifests: [expect.objectContaining({ pluginId: "mechanic_core", requiredHooks: "on_vehicle_damaged" })],
        runtimeInstances: [expect.objectContaining({ id: "mechanic_core:server-1", status: "loaded" })],
        configValues: [expect.objectContaining({ id: "mechanic_core:server-1:hourlyRate", valueJson: "75" })]
      }
    });
  });

  it("mirrors plugin manifest, runtime instance, config values, and uninstall", async () => {
    const { admin, client } = createAdmin();

    admin.installPlugin({
      pluginId: "mechanic_core",
      name: "Mechanic Core",
      version: "1.0.0",
      permissions: [{ key: "mechanic.repair", description: "Repair vehicles" }],
      configSchema: { hourlyRate: { type: "number", default: 75 } },
      hooks: [{
        hookName: "on_vehicle_damaged",
        capability: "vehicle.inspect",
        handlerType: "reducer",
        handlerRef: "handleDamage"
      }]
    });
    admin.enablePlugin("mechanic_core");
    admin.upsertPluginRuntimeInstance({
      pluginId: "mechanic_core",
      serverId: "server-1",
      status: "loaded",
      errorMessage: ""
    });
    admin.setPluginConfigValue({
      pluginId: "mechanic_core",
      serverId: "server-1",
      key: "hourlyRate",
      value: 75,
      version: 1
    });
    admin.uninstallPlugin("mechanic_core");

    await admin.flushWrites();

    expect(client.reducerCalls.map((call) => call.name).filter((name) => name !== "write_audit_log")).toEqual([
      "register_plugin",
      "register_plugin_manifest",
      "register_plugin_hook",
      "set_plugin_status",
      "upsert_plugin_runtime_instance",
      "set_plugin_config_value",
      "uninstall_plugin"
    ]);
    expect(client.reducerCalls).toContainEqual({
      name: "register_plugin_hook",
      args: {
        id: "mechanic_core:on_vehicle_damaged:handleDamage",
        pluginId: "mechanic_core",
        hookName: "on_vehicle_damaged",
        capability: "vehicle.inspect",
        handlerType: "reducer",
        handlerRef: "handleDamage",
        priority: 0
      }
    });
  });

  it("disables mirrored plugin hook rows when a plugin is disabled", async () => {
    const { admin, client } = createAdmin();

    admin.installPlugin({
      pluginId: "mechanic_core",
      name: "Mechanic Core",
      version: "1.0.0",
      hooks: [{
        hookName: "on_vehicle_damaged",
        capability: "vehicle.inspect",
        handlerType: "sidecar",
        handlerRef: "handleDamage"
      }]
    });
    admin.enablePlugin("mechanic_core");
    admin.disablePlugin("mechanic_core");

    await admin.flushWrites();

    expect(client.reducerCalls.map((call) => call.name).filter((name) => name !== "write_audit_log")).toEqual([
      "register_plugin",
      "register_plugin_manifest",
      "register_plugin_hook",
      "set_plugin_status",
      "set_plugin_hooks_enabled",
      "set_plugin_status"
    ]);
    expect(client.reducerCalls).toContainEqual({
      name: "set_plugin_hooks_enabled",
      args: {
        pluginId: "mechanic_core",
        enabled: false
      }
    });
  });

  it("installs marketplace plugin packages through admin HTTP and mirrors the manifest", async () => {
    const { admin, client } = createAdmin();
    const api = createAdminHttpApi(admin);
    const manifest: PluginManifest = {
      pluginId: "mechanic_core",
      name: "Mechanic Core",
      version: "1.0.0",
      permissions: [{ key: "mechanic.repair", description: "Repair vehicles" }]
    };

    const response = await api.handle({
      method: "POST",
      path: "/plugins/install-package",
      body: {
        packageId: "marketplace:mechanic_core",
        pluginId: "mechanic_core",
        version: "1.0.0",
        source: "https://plugins.example.test/mechanic_core",
        publisher: "SDB Labs",
        trustLevel: "marketplace",
        signerId: packageSigner.id,
        signature: signPackageManifest(hashPluginManifest(manifest)),
        manifestHash: hashPluginManifest(manifest),
        manifest
      }
    });

    expect(response).toEqual({
      status: 200,
      body: expect.objectContaining({
        id: "mechanic_core",
        status: "installed"
      })
    });
    expect(admin.getPluginPackages()).toEqual([
      expect.objectContaining({
        packageId: "marketplace:mechanic_core",
        pluginId: "mechanic_core",
        trustLevel: "marketplace"
      })
    ]);
    expect(client.reducerCalls.map((call) => call.name)).toContain("register_plugin_package");
    expect(client.reducerCalls.map((call) => call.name)).toContain("register_plugin");
    expect(client.reducerCalls.map((call) => call.name)).toContain("register_plugin_manifest");
    expect(client.reducerCalls).toContainEqual(
      expect.objectContaining({
        name: "write_audit_log",
        args: expect.objectContaining({
          actionType: "plugin.package_install",
          pluginId: "mechanic_core"
        })
      })
    );
    await expect(api.handle({ method: "GET", path: "/plugins/registry" })).resolves.toEqual({
      status: 200,
      body: expect.objectContaining({
        packages: [
          expect.objectContaining({
            packageId: "marketplace:mechanic_core",
            pluginId: "mechanic_core",
            source: "https://plugins.example.test/mechanic_core",
            publisher: "SDB Labs",
            trustLevel: "marketplace"
          })
        ]
      })
    });
  });

  it("serves package provenance from the SpacetimeDB live cache when available", async () => {
    const client = new FakeSpacetimeClient({
      plugins: [
        {
          id: "mechanic_core",
          name: "Mechanic Core",
          version: "1.0.0",
          status: "installed",
          installedAt: new Date("2026-05-18T12:00:00.000Z"),
          updatedAt: new Date("2026-05-18T12:00:00.000Z")
        }
      ],
      plugin_packages: [
        {
          packageId: "marketplace:mechanic_core",
          pluginId: "mechanic_core",
          version: "1.0.0",
          source: "https://plugins.example.test/mechanic_core",
          publisher: "SDB Labs",
          trustLevel: "marketplace",
          signerId: "trusted-marketplace",
          signature: "sig:mechanic",
          manifestHash: "sha256:manifest",
          installedAt: new Date("2026-05-18T12:00:00.000Z"),
          updatedAt: new Date("2026-05-18T12:00:00.000Z")
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

    expect(admin.getPluginRegistrySnapshot().packages).toEqual([
      expect.objectContaining({
        packageId: "marketplace:mechanic_core",
        signerId: "trusted-marketplace"
      })
    ]);
  });

  it("serves package signer revocations from SpacetimeDB and blocks package installs from revoked signers", async () => {
    const manifest: PluginManifest = {
      pluginId: "mechanic_core",
      name: "Mechanic Core",
      version: "1.0.0"
    };
    const manifestHash = hashPluginManifest(manifest);
    const client = new FakeSpacetimeClient({
      plugin_package_signer_revocations: [
        {
          signerId: packageSigner.id,
          actorId: "owner:1",
          reason: "compromised key",
          affectedPluginIdsJson: "[]",
          revokedAt: new Date("2026-05-18T12:04:00.000Z")
        }
      ]
    });
    const spacetime = new SpacetimeRuntimeAdapter(client);
    await spacetime.connectAndSubscribe("server-1");
    const admin = new AdminService({
      runtime: new RuntimeControlPlane(),
      permissions: new PermissionStore(),
      plugins: new PluginRegistry({ packageSigners: [packageSigner] }),
      spacetime
    });
    const api = createAdminHttpApi(admin);

    expect(admin.getPluginRegistrySnapshot().packageSignerRevocations).toEqual([
      expect.objectContaining({
        signerId: packageSigner.id,
        actorId: "owner:1",
        reason: "compromised key",
        affectedPluginIdsJson: "[]"
      })
    ]);
    await expect(api.handle({
      method: "POST",
      path: "/plugins/install-package",
      body: {
        packageId: "marketplace:mechanic_core",
        pluginId: "mechanic_core",
        version: "1.0.0",
        source: "https://plugins.example.test/mechanic_core",
        publisher: "SDB Labs",
        trustLevel: "marketplace",
        signerId: packageSigner.id,
        signature: signPackageManifest(manifestHash),
        manifestHash,
        manifest
      }
    })).resolves.toEqual({
      status: 400,
      body: { error: "Package signer has been revoked: trusted-marketplace" }
    });
  });

  it("revokes package signers through admin HTTP and mirrors disabled plugin status", async () => {
    const { admin, client } = createAdmin();
    const api = createAdminHttpApi(admin);
    const manifest: PluginManifest = {
      pluginId: "mechanic_core",
      name: "Mechanic Core",
      version: "1.0.0"
    };
    const manifestHash = hashPluginManifest(manifest);

    await api.handle({
      method: "POST",
      path: "/plugins/install-package",
      body: {
        packageId: "marketplace:mechanic_core",
        pluginId: "mechanic_core",
        version: "1.0.0",
        source: "https://plugins.example.test/mechanic_core",
        publisher: "SDB Labs",
        trustLevel: "marketplace",
        signerId: packageSigner.id,
        signature: signPackageManifest(manifestHash),
        manifestHash,
        manifest
      }
    });
    await api.handle({ method: "POST", path: "/plugins/mechanic_core/enable" });

    await expect(api.handle({
      method: "POST",
      path: "/package-signers/trusted-marketplace/revoke",
      body: {
        actorId: "owner:1",
        reason: "compromised marketplace key"
      }
    })).resolves.toEqual({
      status: 200,
      body: [
        expect.objectContaining({
          id: "mechanic_core",
          status: "disabled"
        })
      ]
    });
    expect(admin.getPlugins()).toContainEqual(expect.objectContaining({
      id: "mechanic_core",
      status: "disabled"
    }));
    expect(client.reducerCalls).toContainEqual(
      expect.objectContaining({
        name: "set_plugin_status",
        args: {
          pluginId: "mechanic_core",
          status: "disabled"
        }
      })
    );
    expect(client.reducerCalls).toContainEqual(
      expect.objectContaining({
        name: "revoke_package_signer",
        args: {
          signerId: "trusted-marketplace",
          actorId: "owner:1",
          reason: "compromised marketplace key"
        }
      })
    );
    expect(client.reducerCalls).toContainEqual(
      expect.objectContaining({
        name: "write_audit_log",
        args: expect.objectContaining({
          actionType: "plugin.package_signer_revoked",
          targetType: "package_signer",
          targetId: "trusted-marketplace",
          actorId: "owner:1",
          afterJson: "{\"signerId\":\"trusted-marketplace\",\"disabledPluginIds\":[\"mechanic_core\"],\"reason\":\"compromised marketplace key\"}"
        })
      })
    );
    await expect(api.handle({ method: "POST", path: "/plugins/mechanic_core/enable" })).resolves.toEqual({
      status: 400,
      body: { error: "Package signer has been revoked: trusted-marketplace" }
    });
  });

  it("mirrors plugin lifecycle audit logs through SpacetimeDB", async () => {
    const { admin, client } = createAdmin();

    admin.installPlugin({
      pluginId: "mechanic_core",
      name: "Mechanic Core",
      version: "1.0.0"
    });
    admin.enablePlugin("mechanic_core");
    admin.disablePlugin("mechanic_core");
    admin.uninstallPlugin("mechanic_core");

    await admin.flushWrites();

    expect(client.reducerCalls).toEqual(expect.arrayContaining([
      {
        name: "write_audit_log",
        args: expect.objectContaining({
          id: "plugin.install:mechanic_core:1",
          serverId: "control-plane",
          actorId: "system",
          pluginId: "mechanic_core",
          actionType: "plugin.install",
          targetType: "plugin",
          targetId: "mechanic_core",
          status: "succeeded"
        })
      },
      {
        name: "write_audit_log",
        args: expect.objectContaining({
          id: "plugin.enable:mechanic_core:2",
          serverId: "control-plane",
          actionType: "plugin.enable",
          targetId: "mechanic_core"
        })
      },
      {
        name: "write_audit_log",
        args: expect.objectContaining({
          id: "plugin.disable:mechanic_core:3",
          serverId: "control-plane",
          actionType: "plugin.disable",
          targetId: "mechanic_core"
        })
      },
      {
        name: "write_audit_log",
        args: expect.objectContaining({
          id: "plugin.uninstall:mechanic_core:4",
          serverId: "control-plane",
          actionType: "plugin.uninstall",
          targetId: "mechanic_core"
        })
      }
    ]));
  });

  it("applies approved plugin schema declarations during manifest install", async () => {
    const { admin, client } = createAdmin();

    admin.installPlugin({
      pluginId: "mechanic_core",
      name: "Mechanic Core",
      version: "1.0.0",
      schemas: [
        {
          entityType: "work_order",
          schemaVersion: 1,
          schema: {
            type: "object",
            required: ["status"],
            properties: {
              status: { type: "string" }
            }
          },
          migrationPlan: [{ step: "create_json_entity_type", entityType: "work_order" }],
          approved: true
        },
        {
          entityType: "draft_note",
          schemaVersion: 1,
          schema: { type: "object" },
          approved: false
        }
      ]
    });

    await admin.flushWrites();

    expect(client.reducerCalls).toContainEqual({
      name: "register_plugin_schema",
      args: {
        pluginId: "mechanic_core",
        entityType: "work_order",
        schemaVersion: 1,
        schemaJson: JSON.stringify({
          type: "object",
          required: ["status"],
          properties: {
            status: { type: "string" }
          }
        }),
        migrationPlanJson: JSON.stringify([{ step: "create_json_entity_type", entityType: "work_order" }]),
        status: "active"
      }
    });
    expect(client.reducerCalls.map((call) => call.name)).not.toContain("draft_note");
  });

  it("validates plugin config writes against the manifest schema before write-through", async () => {
    const { admin, client } = createAdmin();
    admin.installPlugin({
      pluginId: "mechanic_core",
      name: "Mechanic Core",
      version: "1.0.0",
      configSchema: { hourlyRate: { type: "number", default: 75 } }
    });
    admin.enablePlugin("mechanic_core");

    expect(() =>
      admin.setPluginConfigValue({
        pluginId: "mechanic_core",
        serverId: "server-1",
        key: "hourlyRate",
        value: "75",
        version: 1
      })
    ).toThrow("Expected hourlyRate to be number");

    await admin.flushWrites();
    expect(client.reducerCalls.map((call) => call.name).filter((name) => name !== "write_audit_log")).toEqual([
      "register_plugin",
      "register_plugin_manifest",
      "set_plugin_status"
    ]);
  });

  it("rejects inactive plugin config writes before write-through", async () => {
    const { admin, client } = createAdmin();
    admin.installPlugin({
      pluginId: "mechanic_core",
      name: "Mechanic Core",
      version: "1.0.0",
      configSchema: { hourlyRate: { type: "number", default: 75 } }
    });

    expect(() =>
      admin.setPluginConfigValue({
        pluginId: "mechanic_core",
        serverId: "server-1",
        key: "hourlyRate",
        value: 75,
        version: 1
      })
    ).toThrow("Plugin config is not active: mechanic_core");

    await admin.flushWrites();
    expect(client.reducerCalls.map((call) => call.name).filter((name) => name !== "write_audit_log")).toEqual([
      "register_plugin",
      "register_plugin_manifest"
    ]);
  });

  it("exposes plugin runtime and config HTTP routes", async () => {
    const { admin, client } = createAdmin();
    const api = createAdminHttpApi(admin);

    const install = await api.handle({
      method: "POST",
      path: "/plugins/install",
      body: {
        pluginId: "mechanic_core",
        name: "Mechanic Core",
        version: "1.0.0",
        configSchema: { hourlyRate: { type: "number", default: 75 } }
      }
    });
    const runtime = await api.handle({
      method: "POST",
      path: "/plugins/runtime-instances",
      body: {
        pluginId: "mechanic_core",
        serverId: "server-1",
        status: "loaded",
        errorMessage: ""
      }
    });
    const enable = await api.handle({
      method: "POST",
      path: "/plugins/mechanic_core/enable"
    });
    const config = await api.handle({
      method: "POST",
      path: "/plugins/config-values",
      body: {
        pluginId: "mechanic_core",
        serverId: "server-1",
        key: "hourlyRate",
        value: 75,
        version: 1
      }
    });
    const uninstall = await api.handle({
      method: "POST",
      path: "/plugins/mechanic_core/uninstall"
    });

    expect(install.status).toBe(200);
    expect(runtime).toEqual({ status: 200, body: { ok: true } });
    expect(enable).toEqual({ status: 200, body: expect.objectContaining({ status: "active" }) });
    expect(config).toEqual({ status: 200, body: { ok: true } });
    expect(uninstall).toEqual({ status: 200, body: { ok: true } });
    expect(client.reducerCalls.map((call) => call.name).filter((name) => name !== "write_audit_log")).toEqual([
      "register_plugin",
      "register_plugin_manifest",
      "upsert_plugin_runtime_instance",
      "set_plugin_status",
      "set_plugin_config_value",
      "uninstall_plugin"
    ]);
  });
});
