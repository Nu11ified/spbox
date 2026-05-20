import { describe, expect, it } from "vitest";
import { FakeSpacetimeClient, SpacetimeRuntimeAdapter } from "../src/spacetime/adapter.js";

describe("SpacetimeRuntimeAdapter plugin registry control-plane reducers", () => {
  it("caches plugin packages, manifests, runtime instances, and server-scoped config values", async () => {
    const client = new FakeSpacetimeClient({
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
      ],
      plugin_package_signer_revocations: [
        {
          signerId: "revoked-marketplace",
          actorId: "owner:1",
          reason: "compromised key",
          affectedPluginIdsJson: "[\"mechanic_core\"]",
          revokedAt: new Date("2026-05-18T12:04:00.000Z")
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
        },
        {
          id: "mechanic_core:server-2",
          pluginId: "mechanic_core",
          serverId: "server-2",
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
        },
        {
          id: "mechanic_core:server-2:hourlyRate",
          pluginId: "mechanic_core",
          serverId: "server-2",
          key: "hourlyRate",
          valueJson: "100",
          version: 4,
          updatedAt: new Date("2026-05-18T12:00:00.000Z")
        }
      ]
    });
    const adapter = new SpacetimeRuntimeAdapter(client);

    await adapter.connectAndSubscribe("server-1");

    expect(client.subscribedTables).toContain("plugin_manifests");
    expect(client.subscribedTables).toContain("plugin_packages");
    expect(client.subscribedTables).toContain("plugin_package_signer_revocations");
    expect(client.subscribedTables).toContain("plugin_runtime_instances");
    expect(client.subscribedTables).toContain("plugin_config_values");
    expect(adapter.cache.listPluginPackages()).toEqual([
      expect.objectContaining({
        packageId: "marketplace:mechanic_core",
        pluginId: "mechanic_core",
        signerId: "trusted-marketplace"
      })
    ]);
    expect(adapter.cache.listPackageSignerRevocations()).toEqual([
      expect.objectContaining({
        signerId: "revoked-marketplace",
        actorId: "owner:1",
        affectedPluginIdsJson: "[\"mechanic_core\"]"
      })
    ]);
    expect(adapter.cache.getPluginManifest("mechanic_core")).toEqual(
      expect.objectContaining({
        manifestJson: "{\"pluginId\":\"mechanic_core\"}",
        requiredHooks: "on_vehicle_damaged"
      })
    );
    expect(adapter.cache.getPluginRuntimeInstance("mechanic_core:server-1")?.status).toBe("loaded");
    expect(adapter.cache.getPluginRuntimeInstance("mechanic_core:server-2")).toBeUndefined();
    expect(adapter.cache.getPluginConfigValue("mechanic_core", "server-1", "hourlyRate")?.valueJson).toBe("75");
    expect(adapter.cache.getPluginConfigValue("mechanic_core", "server-2", "hourlyRate")).toBeUndefined();

    client.emitUpdate("plugin_runtime_instances", {
      id: "mechanic_core:server-2",
      pluginId: "mechanic_core",
      serverId: "server-2",
      status: "failed",
      loadedAt: new Date("2026-05-18T12:00:00.000Z"),
      lastHeartbeat: new Date("2026-05-18T12:02:00.000Z"),
      errorMessage: "wrong server"
    });
    client.emitUpdate("plugin_config_values", {
      id: "mechanic_core:server-1:hourlyRate",
      pluginId: "mechanic_core",
      serverId: "server-1",
      key: "hourlyRate",
      valueJson: "80",
      version: 3,
      updatedAt: new Date("2026-05-18T12:02:00.000Z")
    });
    client.emitUpdate("plugin_packages", {
      packageId: "marketplace:economy_core",
      pluginId: "economy_core",
      version: "2.0.0",
      source: "https://plugins.example.test/economy_core",
      publisher: "SDB Labs",
      trustLevel: "marketplace",
      signerId: "trusted-marketplace",
      signature: "sig:economy",
      manifestHash: "sha256:economy",
      installedAt: new Date("2026-05-18T12:03:00.000Z"),
      updatedAt: new Date("2026-05-18T12:03:00.000Z")
    });

    expect(adapter.cache.getPluginRuntimeInstance("mechanic_core:server-2")).toBeUndefined();
    expect(adapter.cache.listPluginPackages().map((row) => row.packageId)).toEqual([
      "marketplace:economy_core",
      "marketplace:mechanic_core"
    ]);
    expect(adapter.cache.getPluginConfigValuesForPlugin("mechanic_core").map((row) => row.valueJson)).toEqual([
      "80"
    ]);
  });

  it("calls plugin registry persistence reducers", async () => {
    const client = new FakeSpacetimeClient({});
    const adapter = new SpacetimeRuntimeAdapter(client);

    await adapter.registerPluginPackage({
      packageId: "marketplace:mechanic_core",
      pluginId: "mechanic_core",
      version: "1.0.0",
      source: "https://plugins.example.test/mechanic_core",
      publisher: "SDB Labs",
      trustLevel: "marketplace",
      signerId: "trusted-marketplace",
      signature: "sig:mechanic",
      manifestHash: "sha256:manifest"
    });
    await adapter.revokePackageSigner({
      signerId: "trusted-marketplace",
      actorId: "owner:1",
      reason: "compromised key"
    });
    await adapter.registerPluginManifest({
      pluginId: "mechanic_core",
      manifestJson: "{\"pluginId\":\"mechanic_core\"}",
      requiredPermissions: "mechanic.repair",
      requiredTables: "plugin_entities",
      requiredHooks: "on_vehicle_damaged",
      requiredConnectors: "discord",
      schemaVersion: 1
    });
    await adapter.upsertPluginRuntimeInstance({
      pluginId: "mechanic_core",
      serverId: "server-1",
      status: "loaded",
      errorMessage: ""
    });
    await adapter.setPluginConfigValue({
      pluginId: "mechanic_core",
      serverId: "server-1",
      key: "hourlyRate",
      valueJson: "75",
      version: 2
    });
    await adapter.uninstallPlugin("mechanic_core");

    expect(client.reducerCalls).toEqual([
      {
        name: "register_plugin_package",
        args: {
          packageId: "marketplace:mechanic_core",
          pluginId: "mechanic_core",
          version: "1.0.0",
          source: "https://plugins.example.test/mechanic_core",
          publisher: "SDB Labs",
          trustLevel: "marketplace",
          signerId: "trusted-marketplace",
          signature: "sig:mechanic",
          manifestHash: "sha256:manifest"
        }
      },
      {
        name: "revoke_package_signer",
        args: {
          signerId: "trusted-marketplace",
          actorId: "owner:1",
          reason: "compromised key"
        }
      },
      {
        name: "register_plugin_manifest",
        args: {
          pluginId: "mechanic_core",
          manifestJson: "{\"pluginId\":\"mechanic_core\"}",
          requiredPermissions: "mechanic.repair",
          requiredTables: "plugin_entities",
          requiredHooks: "on_vehicle_damaged",
          requiredConnectors: "discord",
          schemaVersion: 1
        }
      },
      {
        name: "upsert_plugin_runtime_instance",
        args: {
          pluginId: "mechanic_core",
          serverId: "server-1",
          status: "loaded",
          errorMessage: ""
        }
      },
      {
        name: "set_plugin_config_value",
        args: {
          pluginId: "mechanic_core",
          serverId: "server-1",
          key: "hourlyRate",
          valueJson: "75",
          version: 2
        }
      },
      {
        name: "uninstall_plugin",
        args: {
          pluginId: "mechanic_core"
        }
      }
    ]);
  });
});
