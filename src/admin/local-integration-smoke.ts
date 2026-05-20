import { type AddressInfo } from "node:net";
import { pathToFileURL } from "node:url";
import { createAdminConnector } from "./bootstrap.js";

export interface AdminLocalIntegrationSmokeOptions {
  serverId?: string;
  serverName?: string;
  environment?: string;
  publicKey?: string;
}

export interface AdminLocalIntegrationSmokeResult {
  serverId: string;
  checks: Array<{
    name: string;
    status: number;
  }>;
  configVersion: number;
  unrelatedDrainCount: number;
  drainedActionCount: number;
}

interface JsonResponse<T> {
  status: number;
  body: T;
}

export async function runAdminLocalIntegrationSmoke(
  options: AdminLocalIntegrationSmokeOptions = {}
): Promise<AdminLocalIntegrationSmokeResult> {
  const serverId = options.serverId ?? process.env.SDB_SERVER_ID ?? "integration-smoke";
  const connector = createAdminConnector({
    serverId,
    serverName: options.serverName ?? process.env.SDB_SERVER_NAME ?? "Integration Smoke",
    environment: options.environment ?? process.env.SDB_ENVIRONMENT ?? "production",
    publicKey: options.publicKey ?? process.env.SDB_SERVER_PUBLIC_KEY ?? "integration-smoke-public-key"
  });
  const server = await connector.adapter.listen(0, "127.0.0.1");

  try {
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const dashboard = await requestJson<unknown>(baseUrl, "GET", `/servers/${serverId}/dashboard`);
    const config = await requestJson<{ version: number }>(baseUrl, "POST", `/servers/${serverId}/config`, {
      namespace: "runtime",
      key: "integration_smoke",
      value: true
    });
    const queued = await requestJson<{ queued: number }>(baseUrl, "POST", "/gameplay/kicks", {
      kicks: [
        {
          serverId,
          targetSource: 42,
          reason: "integration smoke"
        }
      ]
    });
    const unrelatedDrain = await requestJson<unknown[]>(baseUrl, "POST", "/gameplay/kicks/drain?serverId=unrelated");
    const drain = await requestJson<unknown[]>(baseUrl, "POST", `/gameplay/kicks/drain?serverId=${serverId}`);

    const checks = [
      { name: "dashboard", status: dashboard.status },
      { name: "config write", status: config.status },
      { name: "action queue", status: queued.status },
      { name: "query filtered drain", status: unrelatedDrain.status },
      { name: "action drain", status: drain.status }
    ];
    const failed = checks.find((check) => check.status !== 200);
    if (failed) {
      throw new Error(`Admin local integration smoke failed: ${failed.name} returned ${failed.status}`);
    }
    if (queued.body.queued !== 1) {
      throw new Error(`Admin local integration smoke failed: expected one queued action, got ${queued.body.queued}`);
    }

    return {
      serverId,
      checks,
      configVersion: config.body.version,
      unrelatedDrainCount: unrelatedDrain.body.length,
      drainedActionCount: drain.body.length
    };
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
}

async function requestJson<T>(
  baseUrl: string,
  method: string,
  path: string,
  body?: unknown
): Promise<JsonResponse<T>> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return {
    status: response.status,
    body: await response.json() as T
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await runAdminLocalIntegrationSmoke();
  console.log(JSON.stringify(result, null, 2));
}
