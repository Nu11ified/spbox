import { createAdminConnector } from "./bootstrap.js";

export interface ProductionCoreSmokeOptions {
  serverId?: string;
  serverName?: string;
  environment?: string;
  publicKey?: string;
}

export interface ProductionCoreSmokeResult {
  serverId: string;
  checks: Array<{
    name: string;
    status: number;
  }>;
}

export async function runProductionCoreSmoke(
  options: ProductionCoreSmokeOptions = {}
): Promise<ProductionCoreSmokeResult> {
  const serverId = options.serverId ?? process.env.SDB_SERVER_ID ?? "prod-smoke";
  const connector = createAdminConnector({
    serverId,
    serverName: options.serverName ?? process.env.SDB_SERVER_NAME ?? "Production Smoke",
    environment: options.environment ?? process.env.SDB_ENVIRONMENT ?? "production",
    publicKey: options.publicKey ?? process.env.SDB_SERVER_PUBLIC_KEY ?? "production-smoke-public-key"
  });
  const checks = [
    {
      name: "dashboard",
      response: await connector.adapter.inject({
        method: "GET",
        path: `/servers/${serverId}/dashboard`
      })
    },
    {
      name: "plugin registry",
      response: await connector.adapter.inject({
        method: "GET",
        path: "/plugins/registry"
      })
    },
    {
      name: "deployments",
      response: await connector.adapter.inject({
        method: "GET",
        path: "/deployments"
      })
    }
  ];

  for (const check of checks) {
    if (check.response.status !== 200) {
      throw new Error(`Production smoke check failed: ${check.name} returned ${check.response.status}`);
    }
  }

  return {
    serverId,
    checks: checks.map((check) => ({
      name: check.name,
      status: check.response.status
    }))
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await runProductionCoreSmoke();
  console.log(JSON.stringify(result, null, 2));
}
