import { type FiveMCommandExecutor } from "./fivem-command-emitter.js";

export type FiveMHttpFetch = (
  url: string,
  init: {
    method: "POST";
    headers: Record<string, string>;
    body: string;
  }
) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
}>;

export interface FiveMHttpCommandExecutorOptions {
  endpoint: string;
  token?: string;
  fetch?: FiveMHttpFetch;
}

export class FiveMHttpCommandExecutor implements FiveMCommandExecutor {
  private readonly endpoint: string;
  private readonly token: string | undefined;
  private readonly fetch: FiveMHttpFetch;

  public constructor(options: FiveMHttpCommandExecutorOptions) {
    this.endpoint = normalizeHttpEndpoint(options.endpoint);
    this.token = options.token;
    this.fetch = options.fetch ?? defaultFetch();
  }

  public async execute(command: string): Promise<void> {
    if (typeof command !== "string" || command.trim().length === 0) {
      throw new Error("command must be a non-empty string");
    }
    if (!command.startsWith("sdb_runtime_emit ")) {
      throw new Error("FiveM HTTP command executor only supports sdb_runtime_emit commands");
    }

    const headers: Record<string, string> = {
      "content-type": "application/json"
    };
    if (this.token) {
      headers.authorization = `Bearer ${this.token}`;
    }

    const response = await this.fetch(this.endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ command })
    });

    if (!response.ok) {
      const message = await response.text().catch(() => "");
      throw new Error(`FiveM command endpoint failed: HTTP ${response.status}${message ? ` ${message}` : ""}`);
    }
  }
}

function normalizeHttpEndpoint(endpoint: string): string {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("invalid protocol");
    }
    return url.toString();
  } catch {
    throw new Error("FiveM command endpoint must be an absolute http(s) URL");
  }
}

function defaultFetch(): FiveMHttpFetch {
  if (typeof globalThis.fetch !== "function") {
    throw new Error("FiveM HTTP command executor requires fetch support");
  }

  return async (url, init) => {
    const response = await globalThis.fetch(url, init);
    return {
      ok: response.ok,
      status: response.status,
      text: () => response.text()
    };
  };
}
