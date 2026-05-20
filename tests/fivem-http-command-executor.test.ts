import { describe, expect, it } from "vitest";
import { FiveMHttpCommandExecutor } from "../src/connectors/fivem-http-command-executor.js";

describe("FiveM HTTP command executor", () => {
  it("posts commands to the configured endpoint with bearer auth", async () => {
    const calls: Array<{ url: string; init: unknown }> = [];
    const executor = new FiveMHttpCommandExecutor({
      endpoint: "https://fx.example/runtime/commands",
      token: "secret-token",
      fetch: async (url, init) => {
        calls.push({ url, init });
        return {
          ok: true,
          status: 204,
          async text() {
            return "";
          }
        };
      }
    });

    await executor.execute('sdb_runtime_emit {"eventName":"sdb_runtime:syncConfig","payload":{}}');

    expect(calls).toEqual([
      {
        url: "https://fx.example/runtime/commands",
        init: {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: "Bearer secret-token"
          },
          body: JSON.stringify({
            command: 'sdb_runtime_emit {"eventName":"sdb_runtime:syncConfig","payload":{}}'
          })
        }
      }
    ]);
  });

  it("omits authorization when no token is configured", async () => {
    const calls: Array<{ url: string; init: { headers: Record<string, string> } }> = [];
    const executor = new FiveMHttpCommandExecutor({
      endpoint: "http://127.0.0.1:30120/runtime/commands",
      fetch: async (url, init) => {
        calls.push({ url, init });
        return {
          ok: true,
          status: 200,
          async text() {
            return "";
          }
        };
      }
    });

    await executor.execute('sdb_runtime_emit {"eventName":"sdb_runtime:syncHealth","payload":{}}');

    expect(calls[0]?.init.headers).toEqual({
      "content-type": "application/json"
    });
  });

  it("rejects failed command endpoint responses with status and response text", async () => {
    const executor = new FiveMHttpCommandExecutor({
      endpoint: "https://fx.example/runtime/commands",
      fetch: async () => ({
        ok: false,
        status: 403,
        async text() {
          return "forbidden";
        }
      })
    });

    await expect(executor.execute('sdb_runtime_emit {"eventName":"sdb_runtime:syncHealth","payload":{}}'))
      .rejects.toThrow("FiveM command endpoint failed: HTTP 403 forbidden");
  });

  it("validates endpoint URL and command input", async () => {
    expect(() => new FiveMHttpCommandExecutor({
      endpoint: "not a url",
      fetch: async () => ({
        ok: true,
        status: 200,
        async text() {
          return "";
        }
      })
    })).toThrow("FiveM command endpoint must be an absolute http(s) URL");

    const executor = new FiveMHttpCommandExecutor({
      endpoint: "https://fx.example/runtime/commands",
      fetch: async () => ({
        ok: true,
        status: 200,
        async text() {
          return "";
        }
      })
    });

    await expect(executor.execute("")).rejects.toThrow("command must be a non-empty string");
  });

  it("rejects unsupported console commands before HTTP transport", async () => {
    const calls: string[] = [];
    const executor = new FiveMHttpCommandExecutor({
      endpoint: "https://fx.example/runtime/commands",
      fetch: async (url) => {
        calls.push(url);
        return {
          ok: true,
          status: 200,
          async text() {
            return "";
          }
        };
      }
    });

    await expect(executor.execute("status"))
      .rejects.toThrow("FiveM HTTP command executor only supports sdb_runtime_emit commands");
    expect(calls).toEqual([]);
  });
});
