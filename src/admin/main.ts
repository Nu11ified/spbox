import { createAdminConnector, loadSpacetimeOptionsFromEnv } from "./bootstrap.js";
import { reconcileLegacyResourcesFromCfg } from "./resource-auto-import.js";
import { FiveMCommandEmitter, FiveMHttpCommandExecutor } from "../connectors/index.js";

const port = Number(process.env.SDB_ADMIN_PORT ?? 8787);
const hostname = process.env.SDB_ADMIN_HOST ?? "127.0.0.1";
const serverId = process.env.SDB_SERVER_ID ?? "local-dev";
const serverName = process.env.SDB_SERVER_NAME ?? "Local Development";
const environment = process.env.SDB_ENVIRONMENT ?? "development";
const publicKey = process.env.SDB_SERVER_PUBLIC_KEY ?? "local-dev-public-key";
const spacetime = await loadSpacetimeOptionsFromEnv(process.env);
const fivemRuntime = process.env.SDB_FIVEM_SYNC_ENABLED === "true"
  ? {
    syncIntervalMs: Number(process.env.SDB_FIVEM_SYNC_INTERVAL_MS ?? 1000),
    emitter: new FiveMCommandEmitter(createFiveMCommandExecutor())
  }
  : undefined;
const connector = createAdminConnector({
  serverId,
  serverName,
  environment,
  publicKey,
  signerSecrets: parseSignerSecrets(process.env.SDB_PLUGIN_SIGNERS),
  packageSigners: parseSignerSecrets(process.env.SDB_PLUGIN_PACKAGE_SIGNERS),
  approvedSandboxCapabilities: parseCsv(process.env.SDB_PLUGIN_APPROVED_SANDBOX_CAPABILITIES),
  spacetime,
  fivemRuntime
});
const autoImport = loadResourceAutoImportOptions(process.env);
if (autoImport) {
  connector.service.setLegacyResourceReconciler(() => reconcileLegacyResourcesFromCfg(connector.service, autoImport));
}

if (connector.spacetime) {
  await connector.spacetime.connectAndSubscribe(serverId);
  await connector.spacetime.registerServer({
    id: serverId,
    name: serverName,
    environment,
    publicKey
  });
}

if (connector.fivemRuntime) {
  await connector.fivemRuntime.start();
  console.log(`sdb FiveM runtime sync loop running every ${fivemRuntime?.syncIntervalMs}ms`);
}

if (autoImport && process.env.SDB_RESOURCE_AUTO_IMPORT_ON_START !== "false") {
  const result = await connector.service.reconcileLegacyResources();
  console.log(`sdb resource auto-import reconciled ${formatAutoImportCount(result)} resource(s)`);
}

const server = await connector.adapter.listen(port, hostname);
process.once("SIGTERM", () => server.close());
process.once("SIGINT", () => server.close());
console.log(`sdb admin connector listening on http://${hostname}:${port}/admin/`);

function parseSignerSecrets(value: string | undefined): Array<{ id: string; secret: string }> {
  if (!value) {
    return [];
  }

  return value.split(",").map((entry) => {
    const [id, secret] = entry.split(":");
    if (!id || !secret) {
      throw new Error("Signer secret entries must use id:secret format");
    }

    return { id, secret };
  });
}

function parseCsv(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function createFiveMCommandExecutor() {
  const endpoint = process.env.SDB_FIVEM_COMMAND_ENDPOINT;
  if (endpoint) {
    return new FiveMHttpCommandExecutor({
      endpoint,
      token: process.env.SDB_FIVEM_COMMAND_TOKEN
    });
  }

  return {
    execute(command: string) {
      if (!command.startsWith("sdb_runtime_emit ")) {
        throw new Error("FiveM command emitter produced an unsupported command");
      }
      console.log(command);
    }
  };
}

function loadResourceAutoImportOptions(env: NodeJS.ProcessEnv) {
  const cfgPath = env.SDB_FXSERVER_CFG;
  const resourcesRoot = env.SDB_FXSERVER_RESOURCES_ROOT;
  if (!cfgPath && !resourcesRoot) {
    return undefined;
  }
  if (!cfgPath || !resourcesRoot) {
    throw new Error("SDB_FXSERVER_CFG and SDB_FXSERVER_RESOURCES_ROOT must be set together for resource auto-import");
  }

  return {
    cfgPath,
    resourcesRoot,
    version: env.SDB_LEGACY_RESOURCE_VERSION
  };
}

function formatAutoImportCount(result: unknown): number {
  const imported = (result as { imported?: unknown[] }).imported;
  return Array.isArray(imported) ? imported.length : 0;
}
