import { type FiveMRuntimeClient } from "./fivem-runtime.js";

export type FiveMRuntimeFetch = (
  url: string,
  init: {
    method: "POST";
    headers: Record<string, string>;
    body: string;
  }
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}>;

export interface FiveMHttpRuntimeClientOptions {
  endpoint: string;
  token?: string;
  fetch?: FiveMRuntimeFetch;
}

export class FiveMHttpRuntimeClient implements FiveMRuntimeClient {
  private readonly endpoint: string;
  private readonly token: string | undefined;
  private readonly fetch: FiveMRuntimeFetch;

  public constructor(options: FiveMHttpRuntimeClientOptions) {
    this.endpoint = normalizeHttpEndpoint(options.endpoint);
    this.token = options.token;
    this.fetch = options.fetch ?? defaultFetch();
  }

  public async drainQbCharacterUpdates(serverId: string): Promise<unknown[]> {
    return this.callRuntimeExport(serverId, "DrainQbCharacterUpdates");
  }

  public async drainQbCharacterSelections(serverId: string): Promise<unknown[]> {
    return this.callRuntimeExport(serverId, "DrainQbCharacterSelections");
  }

  public async drainQbMoneyUpdates(serverId: string): Promise<unknown[]> {
    return this.callRuntimeExport(serverId, "DrainQbMoneyUpdates");
  }

  public async drainQbInventoryUpdates(serverId: string): Promise<unknown[]> {
    return this.callRuntimeExport(serverId, "DrainQbInventoryUpdates");
  }

  private async callRuntimeExport(serverId: string, exportName: string): Promise<unknown[]> {
    const normalizedServerId = requireNonEmptyString(serverId, "FiveM runtime export serverId");
    const headers: Record<string, string> = {
      "content-type": "application/json"
    };
    if (this.token) {
      headers.authorization = `Bearer ${this.token}`;
    }

    const response = await this.fetch(this.endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        serverId: normalizedServerId,
        resource: "sdb_runtime",
        export: exportName,
        args: []
      })
    });

    if (!response.ok) {
      const message = await response.text().catch(() => "");
      throw new Error(`FiveM runtime export endpoint failed: HTTP ${response.status}${message ? ` ${message}` : ""}`);
    }

    const body = await parseRuntimeExportJson(response);
    const result: unknown[] | undefined = Array.isArray(body)
      ? body
      : extractArrayResult(body);
    if (!result) {
      throw new Error("FiveM runtime export endpoint must return an array or { result: array }");
    }

    return result;
  }
}

async function parseRuntimeExportJson(response: { json(): Promise<unknown> }): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new Error("FiveM runtime export endpoint returned invalid JSON");
  }
}

function extractArrayResult(body: unknown): unknown[] | undefined {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return undefined;
  }

  const result = (body as Record<string, unknown>).result;
  return Array.isArray(result) ? result : undefined;
}

function normalizeHttpEndpoint(endpoint: string): string {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("invalid protocol");
    }
    return url.toString();
  } catch {
    throw new Error("FiveM runtime export endpoint must be an absolute http(s) URL");
  }
}

function requireNonEmptyString(value: string, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }

  return value.trim();
}

function defaultFetch(): FiveMRuntimeFetch {
  if (typeof globalThis.fetch !== "function") {
    throw new Error("FiveM HTTP runtime client requires fetch support");
  }

  return async (url, init) => {
    const response = await globalThis.fetch(url, init);
    return {
      ok: response.ok,
      status: response.status,
      json: () => response.json() as Promise<unknown>,
      text: () => response.text()
    };
  };
}
