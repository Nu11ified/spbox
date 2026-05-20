import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { createAdminConnector, loadSpacetimeOptionsFromEnv } from "../src/admin/bootstrap.js";
import { pluginBundleSigningPayload } from "../src/core/plugin-deployment.js";
import { PluginSidecarSupervisor, type PluginSandboxDriver } from "../src/core/plugin-sidecar.js";
import { hashPluginManifest, type PluginManifest } from "../src/core/plugins.js";
import {
  type GeneratedDbConnection,
  type GeneratedSpacetimeBindings,
  type RuntimeTableName
} from "../src/spacetime/adapter.js";

const require = createRequire(import.meta.url);
const packageSigner = { id: "trusted-marketplace", secret: "package-secret" };

function signPackageManifest(manifestHash: string): string {
  return createHmac("sha256", packageSigner.secret).update(manifestHash).digest("hex");
}

function signNetworkBundle(bundleHash: string): string {
  return createHmac("sha256", "secret").update(pluginBundleSigningPayload({
    id: "bundle-1",
    pluginId: "network_plugin",
    version: "1.0.0",
    bundleHash,
    signerId: "trusted-signer",
    runtimeType: "js_sidecar",
    capabilities: [{ key: "sandbox.network" }]
  })).digest("hex");
}

describe("admin connector bootstrap", () => {
  it("creates a runnable admin connector with default runtime stores", async () => {
    const connector = createAdminConnector({
      serverId: "server-1",
      serverName: "Roleplay Dev",
      environment: "development",
      publicKey: "public-key",
      signerSecrets: [{ id: "trusted-signer", secret: "secret" }]
    });

    const dashboard = await connector.adapter.inject({
      method: "GET",
      path: "/servers/server-1/dashboard"
    });
    const adminPanel = await connector.adapter.inject({
      method: "GET",
      path: "/admin/"
    });

    expect(dashboard.status).toBe(200);
    expect(dashboard.body).toEqual({
      health: expect.objectContaining({
        serverId: "server-1",
        serverName: "Roleplay Dev",
        environment: "development",
        status: "degraded",
        reason: "no runtime heartbeat"
      }),
      config: [],
      plugins: [],
      auditLogs: []
    });
    expect(adminPanel.status).toBe(200);
    expect(String(adminPanel.body)).toContain("SDB Runtime Admin");
    expect(connector.runtime.getConfigSnapshot("server-1")).toEqual([]);
  });

  it("wires approved sandbox capabilities into deployment approval policy", () => {
    const connector = createAdminConnector({
      serverId: "server-1",
      serverName: "Roleplay Dev",
      environment: "development",
      publicKey: "public-key",
      signerSecrets: [{ id: "trusted-signer", secret: "secret" }],
      approvedSandboxCapabilities: ["sandbox.network"]
    });
    connector.deployments.registerBundle({
      id: "bundle-1",
      pluginId: "network_plugin",
      version: "1.0.0",
      artifactUrl: "memory://network_plugin.js",
      bundleHash: "29426c99066b0add9d39171bc51aa4ef623cf8d994a115db1139fa7d0678697e",
      signature: signNetworkBundle("29426c99066b0add9d39171bc51aa4ef623cf8d994a115db1139fa7d0678697e"),
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [{ key: "sandbox.network" }]
    });

    const pending = connector.deployments.requestDeployment({
      pluginId: "network_plugin",
      bundleId: "bundle-1",
      serverId: "server-1",
      bundleBytes: "network plugin",
      requestedBy: "owner:1"
    });

    expect(connector.deployments.approveDeployment(pending.id, "owner:2")).toEqual(
      expect.objectContaining({ status: "active" })
    );
  });

  it("wires package signers into marketplace package installation", () => {
    const manifest: PluginManifest = {
      pluginId: "mechanic_core",
      name: "Mechanic Core",
      version: "1.0.0"
    };
    const manifestHash = hashPluginManifest(manifest);
    const connector = createAdminConnector({
      serverId: "server-1",
      serverName: "Roleplay Dev",
      environment: "development",
      publicKey: "public-key",
      packageSigners: [packageSigner]
    });

    const record = connector.plugins.installPackage({
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
    });

    expect(record).toEqual(expect.objectContaining({ id: "mechanic_core", status: "installed" }));
    expect(connector.plugins.listPackages()).toEqual([
      expect.objectContaining({
        packageId: "marketplace:mechanic_core",
        signerId: packageSigner.id
      })
    ]);
  });

  it("provides a CLI entrypoint for running the admin connector", () => {
    const cli = readFileSync("src/admin/main.ts", "utf8");
    const packageJson = require("../package.json") as { scripts: Record<string, string> };

    expect(cli).toContain("createAdminConnector");
    expect(cli).toContain("loadSpacetimeOptionsFromEnv");
    expect(cli).toContain("reconcileLegacyResourcesFromCfg");
    expect(cli).toContain("SDB_FXSERVER_CFG");
    expect(cli).toContain("SDB_FXSERVER_RESOURCES_ROOT");
    expect(cli).toContain("connector.spacetime");
    expect(cli).toContain("process.env.SDB_ADMIN_PORT");
    expect(cli).toContain("connector.adapter.listen");
    expect(packageJson.scripts["start:admin"]).toBe("node dist/src/admin/main.js");
  });

  it("creates a SpacetimeDB runtime adapter when generated bindings are provided", () => {
    const connector = createAdminConnector({
      serverId: "server-1",
      serverName: "Roleplay Dev",
      environment: "production",
      publicKey: "public-key",
      spacetime: {
        uri: "wss://spacetime.example",
        databaseName: "sdb_runtime",
        token: "admin-token",
        confirmedReads: true,
        bindings: {
          DbConnection: {
            builder: () => {
              throw new Error("builder should not run until the adapter connects");
            }
          },
          tables: {}
        }
      }
    });

    expect(connector.spacetime).toBeDefined();
  });

  it("can include a FiveM runtime sync loop when an emitter is provided", async () => {
    const emitted: Array<{ serverId: string; eventName: string; payload: unknown }> = [];
    const connector = createAdminConnector({
      serverId: "server-1",
      serverName: "Roleplay Dev",
      environment: "development",
      publicKey: "public-key",
      fivemRuntime: {
        syncIntervalMs: 250,
        emitter: {
          async emitServerEvent(serverId, eventName, payload) {
            emitted.push({ serverId, eventName, payload });
          }
        }
      }
    });

    expect(connector.fivemRuntime).toBeDefined();
    expect(connector.fivemRuntimeConnector).toBeDefined();
    expect(connector.fivemRuntime?.isRunning()).toBe(false);

    connector.service.queueReplicatedState([
      {
        serverId: "server-1",
        key: "feature:pvp",
        value: true
      }
    ]);
    await connector.fivemRuntimeConnector?.syncReplicatedState();

    expect(emitted).toEqual([
      {
        serverId: "server-1",
        eventName: "sdb_runtime:syncReplicatedState",
        payload: {
          updates: [
            {
              key: "feature:pvp",
              value: true
            }
          ]
        }
      }
    ]);
  });

  it("wires a sidecar supervisor into FiveM runtime deployment sync", async () => {
    let nextId = 0;
    const calls: string[] = [];
    const driver: PluginSandboxDriver = {
      async start(input) {
        calls.push(`start:${input.deployment.id}:${input.bundle.id}`);
        return { pid: "sandbox-1" };
      },
      async stop(instance) {
        calls.push(`stop:${instance.id}`);
      }
    };
    const sidecars = new PluginSidecarSupervisor({
      driver,
      idFactory: () => `sidecar-${++nextId}`,
      allowedSandboxCapabilities: ["sandbox.network"]
    });
    const connector = createAdminConnector({
      serverId: "server-1",
      serverName: "Roleplay Dev",
      environment: "development",
      publicKey: "public-key",
      signerSecrets: [{ id: "trusted-signer", secret: "secret" }],
      approvedSandboxCapabilities: ["sandbox.network"],
      fivemRuntime: {
        syncIntervalMs: 250,
        emitter: {
          async emitServerEvent() {}
        },
        sidecars
      }
    });
    const bundleHash = "29426c99066b0add9d39171bc51aa4ef623cf8d994a115db1139fa7d0678697e";
    connector.deployments.registerBundle({
      id: "bundle-1",
      pluginId: "network_plugin",
      version: "1.0.0",
      artifactUrl: "memory://network_plugin.js",
      bundleHash,
      signature: signNetworkBundle(bundleHash),
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [{ key: "sandbox.network" }]
    });
    const pending = connector.deployments.requestDeployment({
      pluginId: "network_plugin",
      bundleId: "bundle-1",
      serverId: "server-1",
      bundleBytes: "network plugin",
      requestedBy: "owner:1"
    });
    connector.deployments.approveDeployment(pending.id, "owner:2");

    await connector.fivemRuntimeConnector?.syncDeploymentDiagnostics();

    expect(calls).toEqual([`start:${pending.id}:bundle-1`]);
    expect(sidecars.getRunningInstances("network_plugin", "server-1")).toEqual([
      expect.objectContaining({
        deploymentId: pending.id,
        pluginId: "network_plugin",
        bundleId: "bundle-1"
      })
    ]);
  });

  it("exposes CLI environment knobs for the optional FiveM runtime sync loop", () => {
    const cli = readFileSync("src/admin/main.ts", "utf8");

    expect(cli).toContain("SDB_FIVEM_SYNC_ENABLED");
    expect(cli).toContain("SDB_FIVEM_SYNC_INTERVAL_MS");
    expect(cli).toContain("SDB_FIVEM_COMMAND_ENDPOINT");
    expect(cli).toContain("SDB_FIVEM_COMMAND_TOKEN");
    expect(cli).toContain("FiveMCommandEmitter");
    expect(cli).toContain("FiveMHttpCommandExecutor");
    expect(cli).toContain("sdb_runtime_emit");
    expect(cli).toContain("connector.fivemRuntime");
    expect(cli).toContain("fivemRuntime.start");
  });

  it("exposes a CLI environment knob for approved sandbox capabilities", () => {
    const cli = readFileSync("src/admin/main.ts", "utf8");

    expect(cli).toContain("SDB_PLUGIN_APPROVED_SANDBOX_CAPABILITIES");
    expect(cli).toContain("approvedSandboxCapabilities");
    expect(cli).toContain("parseCsv");
  });

  it("exposes a CLI environment knob for trusted package signers", () => {
    const cli = readFileSync("src/admin/main.ts", "utf8");

    expect(cli).toContain("SDB_PLUGIN_PACKAGE_SIGNERS");
    expect(cli).toContain("packageSigners");
  });

  it("wires SpacetimeDB adapter into admin routes for mirrored writes", async () => {
    const reducerCalls: Array<{ name: string; args: unknown[] }> = [];
    const bindings = fakeGeneratedBindings(reducerCalls);
    const connector = createAdminConnector({
      serverId: "server-1",
      serverName: "Roleplay Dev",
      environment: "production",
      publicKey: "public-key",
      spacetime: {
        uri: "wss://spacetime.example",
        databaseName: "sdb_runtime",
        bindings
      }
    });

    await connector.spacetime?.connectAndSubscribe("server-1");
    const response = await connector.adapter.inject({
      method: "POST",
      path: "/servers/server-1/config",
      body: {
        namespace: "economy",
        key: "enabled",
        value: true
      }
    });

    expect(response.status).toBe(200);
    expect(reducerCalls).toContainEqual({
      name: "setRuntimeConfig",
      args: [expect.any(String), "server-1", "economy", "enabled", "true", 1]
    });
  });

  it("loads SpacetimeDB options from production environment variables and generated binding modules", async () => {
    const options = await loadSpacetimeOptionsFromEnv({
      SDB_SPACETIME_URI: "wss://spacetime.example",
      SDB_SPACETIME_DATABASE: "sdb_runtime",
      SDB_SPACETIME_TOKEN: "admin-token",
      SDB_SPACETIME_CONFIRMED_READS: "true",
      SDB_SPACETIME_BINDINGS_MODULE: "virtual:bindings"
    }, async (specifier) => {
      expect(specifier).toBe("virtual:bindings");
      return {
        DbConnection: { builder: () => ({}) },
        tables: { runtimeConfig: Symbol("runtimeConfig") }
      };
    });

    expect(options).toMatchObject({
      uri: "wss://spacetime.example",
      databaseName: "sdb_runtime",
      token: "admin-token",
      confirmedReads: true
    });
    expect(options?.bindings.tables.runtimeConfig).toBeDefined();
  });

  it("does not require SpacetimeDB env vars for local in-memory development", async () => {
    await expect(loadSpacetimeOptionsFromEnv({})).resolves.toBeUndefined();
  });
});

function fakeGeneratedBindings(reducerCalls: Array<{ name: string; args: unknown[] }>): GeneratedSpacetimeBindings {
  const tableNames: RuntimeTableName[] = [
    "servers",
    "runtime_instances",
    "audit_logs",
    "runtime_config",
    "runtime_config_acks",
    "menu_definitions",
    "menu_actions",
    "runtime_commands",
    "runtime_panels",
    "menu_visibility_policies",
    "menu_sessions",
    "principals",
    "principal_edges",
    "permission_grants",
    "permissions",
    "permission_cache_versions",
    "ace_mirror_rules",
    "policy_constraints",
    "plugins",
    "plugin_packages",
    "plugin_package_signer_revocations",
    "plugin_bundles",
    "plugin_capabilities",
    "plugin_deployments",
    "plugin_manifests",
    "plugin_runtime_instances",
    "plugin_config_values",
    "plugin_schemas",
    "plugin_entities",
    "plugin_sandbox_events",
    "accounts",
    "transactions",
    "ledger_entries",
    "invoices",
    "economy_limits",
    "items",
    "jobs",
    "vehicles",
    "locations",
    "characters",
    "inventory_stacks",
    "character_jobs",
    "plugin_hooks"
  ];
  const db: Record<string, unknown> = {};
  const tables: Record<string, unknown> = {};
  for (const table of tableNames) {
    const property = table.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());
    db[property] = {
      iter: () => [],
      onInsert: () => undefined,
      onUpdate: () => undefined
    };
    tables[property] = Symbol(property);
  }

  return {
    DbConnection: {
      builder: () => {
        let connect: ((connection: GeneratedDbConnection, identity: unknown, token: string) => void) | undefined;
        return {
          withUri(uri: string) {
            void uri;
            return this;
          },
          withDatabaseName(databaseName: string) {
            void databaseName;
            return this;
          },
          onConnect(callback: (connection: GeneratedDbConnection, identity: unknown, token: string) => void) {
            connect = callback;
            return this;
          },
          build() {
            let applied: (() => void) | undefined;
            const connection: GeneratedDbConnection = {
              db: db as GeneratedDbConnection["db"],
              reducers: {
                setRuntimeConfig: (...args: unknown[]) => reducerCalls.push({ name: "setRuntimeConfig", args })
              },
              subscriptionBuilder: () => ({
                onApplied(callback: () => void) {
                  applied = callback;
                  return this;
                },
                onError() {
                  return this;
                },
                subscribe() {
                  applied?.();
                }
              })
            };
            connect?.(connection, "identity", "token");
            return connection;
          }
        };
      }
    },
    tables
  };
}
