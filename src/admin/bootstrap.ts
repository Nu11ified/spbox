import { createAdminHttpApi } from "./http-api.js";
import { createServerAdapter, type ServerAdapter } from "./http-server.js";
import { AdminService } from "./service.js";
import {
  PermissionStore,
  PluginDeploymentManager,
  type PluginPackageSigner,
  type PluginSigner,
  PluginRegistry,
  RuntimeControlPlane
} from "../core/index.js";
import { type PluginSidecarSupervisor } from "../core/plugin-sidecar.js";
import {
  GeneratedSpacetimeClient,
  type GeneratedSpacetimeBindings,
  SpacetimeRuntimeAdapter
} from "../spacetime/adapter.js";
import {
  FiveMRuntimeConnector,
  type FiveMRuntimeClient,
  type FiveMServerEventEmitter,
  FiveMRuntimeSyncLoop
} from "../connectors/index.js";

export interface AdminConnectorOptions {
  serverId: string;
  serverName: string;
  environment: string;
  publicKey: string;
  signerSecrets?: PluginSigner[];
  packageSigners?: PluginPackageSigner[];
  approvedSandboxCapabilities?: string[];
  spacetime?: AdminSpacetimeOptions;
  fivemRuntime?: AdminFiveMRuntimeOptions;
}

export interface AdminSpacetimeOptions {
  uri: string;
  databaseName: string;
  token?: string;
  confirmedReads?: boolean;
  bindings: GeneratedSpacetimeBindings;
}

export interface AdminFiveMRuntimeOptions {
  emitter: FiveMServerEventEmitter;
  runtimeClient?: FiveMRuntimeClient;
  syncIntervalMs: number;
  sidecars?: PluginSidecarSupervisor;
}

export interface AdminConnector {
  runtime: RuntimeControlPlane;
  permissions: PermissionStore;
  plugins: PluginRegistry;
  deployments: PluginDeploymentManager;
  service: AdminService;
  adapter: ServerAdapter;
  spacetime?: SpacetimeRuntimeAdapter;
  fivemRuntimeConnector?: FiveMRuntimeConnector;
  fivemRuntime?: FiveMRuntimeSyncLoop;
}

export type Environment = Record<string, string | undefined>;
export type ModuleLoader = (specifier: string) => Promise<unknown>;

export function createAdminConnector(options: AdminConnectorOptions): AdminConnector {
  const runtime = new RuntimeControlPlane();
  runtime.registerServer({
    id: options.serverId,
    name: options.serverName,
    environment: options.environment,
    publicKey: options.publicKey
  });

  const permissions = new PermissionStore();
  const plugins = new PluginRegistry({
    packageSigners: options.packageSigners
  });
  const deployments = new PluginDeploymentManager({
    signers: options.signerSecrets ?? [],
    approvedSandboxCapabilities: options.approvedSandboxCapabilities
  });
  const spacetime = options.spacetime
    ? new SpacetimeRuntimeAdapter(new GeneratedSpacetimeClient(options.spacetime))
    : undefined;
  const service = new AdminService({
    runtime,
    permissions,
    plugins,
    deployments,
    spacetime,
    serverId: options.serverId
  });
  const adapter = createServerAdapter(createAdminHttpApi(service));
  const fivemRuntimeConnector = options.fivemRuntime
    ? new FiveMRuntimeConnector({
      admin: createAdminHttpApi(service),
      emitter: options.fivemRuntime.emitter,
      serverId: options.serverId,
      runtimeClient: options.fivemRuntime.runtimeClient,
      sidecarReconciler: options.fivemRuntime.sidecars
    })
    : undefined;
  const fivemRuntime = options.fivemRuntime && fivemRuntimeConnector
    ? new FiveMRuntimeSyncLoop({
      connector: fivemRuntimeConnector,
      intervalMs: options.fivemRuntime.syncIntervalMs
    })
    : undefined;

  return {
    runtime,
    permissions,
    plugins,
    deployments,
    service,
    adapter,
    spacetime,
    fivemRuntimeConnector,
    fivemRuntime
  };
}

export async function loadSpacetimeOptionsFromEnv(
  env: Environment,
  moduleLoader: ModuleLoader = (specifier) => import(specifier)
): Promise<AdminSpacetimeOptions | undefined> {
  const uri = env.SDB_SPACETIME_URI;
  const databaseName = env.SDB_SPACETIME_DATABASE;
  const bindingsModule = env.SDB_SPACETIME_BINDINGS_MODULE;

  if (!uri && !databaseName && !bindingsModule) {
    return undefined;
  }
  if (!uri || !databaseName || !bindingsModule) {
    throw new Error(
      "SDB_SPACETIME_URI, SDB_SPACETIME_DATABASE, and SDB_SPACETIME_BINDINGS_MODULE must be set together"
    );
  }

  const loaded = await moduleLoader(bindingsModule);
  const bindings = asGeneratedBindings(loaded);

  return {
    uri,
    databaseName,
    token: env.SDB_SPACETIME_TOKEN,
    confirmedReads: parseOptionalBoolean(env.SDB_SPACETIME_CONFIRMED_READS),
    bindings
  };
}

function asGeneratedBindings(moduleExports: unknown): GeneratedSpacetimeBindings {
  const candidate = moduleExports as Partial<GeneratedSpacetimeBindings> & {
    default?: Partial<GeneratedSpacetimeBindings>;
  };
  const bindings = candidate.DbConnection && candidate.tables ? candidate : candidate.default;

  if (!bindings?.DbConnection || !bindings.tables) {
    throw new Error("SDB_SPACETIME_BINDINGS_MODULE must export DbConnection and tables");
  }

  return bindings as GeneratedSpacetimeBindings;
}

function parseOptionalBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined || value === "") {
    return undefined;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }

  throw new Error("SDB_SPACETIME_CONFIRMED_READS must be true or false");
}
