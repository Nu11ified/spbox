import { describe, expect, it } from "vitest";
import { FiveMHttpRuntimeClient } from "../src/connectors/fivem-http-runtime-client.js";

describe("FiveM HTTP runtime client", () => {
  it("calls the runtime export bridge to drain QBCore character updates", async () => {
    const calls: Array<{ url: string; init: unknown }> = [];
    const client = new FiveMHttpRuntimeClient({
      endpoint: "https://fx.example/runtime/exports",
      token: "secret-token",
      fetch: async (url, init) => {
        calls.push({ url, init });
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              result: [
                {
                  characterId: "char:ada",
                  playerPrincipalId: "player:7",
                  citizenId: "CID7",
                  cid: 1,
                  slot: 1,
                  license: "license:abc",
                  name: "Ada Lovelace",
                  charinfoJson: "{}",
                  metadataJson: "{}",
                  positionJson: "{}",
                  phoneNumber: "555-0101",
                  accountNumber: "ACCT-ADA",
                  selected: true
                }
              ]
            };
          },
          async text() {
            return "";
          }
        };
      }
    });

    await expect(client.drainQbCharacterUpdates("server-1")).resolves.toEqual([
      expect.objectContaining({ characterId: "char:ada" })
    ]);
    expect(calls).toEqual([
      {
        url: "https://fx.example/runtime/exports",
        init: {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: "Bearer secret-token"
          },
          body: JSON.stringify({
            serverId: "server-1",
            resource: "sdb_runtime",
            export: "DrainQbCharacterUpdates",
            args: []
          })
        }
      }
    ]);
  });

  it("calls the runtime export bridge to drain QBCore money updates", async () => {
    const calls: Array<{ url: string; init: unknown }> = [];
    const client = new FiveMHttpRuntimeClient({
      endpoint: "https://fx.example/runtime/exports",
      fetch: async (url, init) => {
        calls.push({ url, init });
        return {
          ok: true,
          status: 200,
          async json() {
            return { result: [] };
          },
          async text() {
            return "";
          }
        };
      }
    });

    await expect(client.drainQbMoneyUpdates("server-1")).resolves.toEqual([]);
    expect(calls[0]?.init).toEqual({
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        serverId: "server-1",
        resource: "sdb_runtime",
        export: "DrainQbMoneyUpdates",
        args: []
      })
    });
  });

  it("calls the runtime export bridge to drain QBCore inventory updates", async () => {
    const calls: Array<{ init: unknown }> = [];
    const client = new FiveMHttpRuntimeClient({
      endpoint: "https://fx.example/runtime/exports",
      fetch: async (_url, init) => {
        calls.push({ init });
        return {
          ok: true,
          status: 200,
          async json() {
            return { result: [] };
          },
          async text() {
            return "";
          }
        };
      }
    });

    await expect(client.drainQbInventoryUpdates("server-1")).resolves.toEqual([]);
    expect(calls[0]?.init).toEqual({
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        serverId: "server-1",
        resource: "sdb_runtime",
        export: "DrainQbInventoryUpdates",
        args: []
      })
    });
  });

  it("calls the runtime export bridge to drain QBCore character selections", async () => {
    const calls: Array<{ init: unknown }> = [];
    const client = new FiveMHttpRuntimeClient({
      endpoint: "https://fx.example/runtime/exports",
      fetch: async (_url, init) => {
        calls.push({ init });
        return {
          ok: true,
          status: 200,
          async json() {
            return { result: [] };
          },
          async text() {
            return "";
          }
        };
      }
    });

    await expect(client.drainQbCharacterSelections("server-1")).resolves.toEqual([]);
    expect(calls[0]?.init).toEqual({
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        serverId: "server-1",
        resource: "sdb_runtime",
        export: "DrainQbCharacterSelections",
        args: []
      })
    });
  });

  it("accepts a raw array response from the runtime export bridge", async () => {
    const client = new FiveMHttpRuntimeClient({
      endpoint: "http://127.0.0.1:30120/runtime/exports",
      fetch: async () => ({
        ok: true,
        status: 200,
        async json() {
          return [];
        },
        async text() {
          return "";
        }
      })
    });

    await expect(client.drainQbCharacterUpdates("server-1")).resolves.toEqual([]);
  });

  it("rejects failed export bridge responses and malformed endpoints", async () => {
    expect(() => new FiveMHttpRuntimeClient({
      endpoint: "not a url",
      fetch: async () => ({
        ok: true,
        status: 200,
        async json() {
          return [];
        },
        async text() {
          return "";
        }
      })
    })).toThrow("FiveM runtime export endpoint must be an absolute http(s) URL");

    const client = new FiveMHttpRuntimeClient({
      endpoint: "https://fx.example/runtime/exports",
      fetch: async () => ({
        ok: false,
        status: 500,
        async json() {
          return {};
        },
        async text() {
          return "boom";
        }
      })
    });

    await expect(client.drainQbCharacterUpdates("server-1"))
      .rejects.toThrow("FiveM runtime export endpoint failed: HTTP 500 boom");
  });

  it("rejects invalid JSON responses with a stable bridge error", async () => {
    const client = new FiveMHttpRuntimeClient({
      endpoint: "https://fx.example/runtime/exports",
      fetch: async () => ({
        ok: true,
        status: 200,
        async json() {
          throw new SyntaxError("Unexpected token < in JSON");
        },
        async text() {
          return "<html>not json</html>";
        }
      })
    });

    await expect(client.drainQbCharacterUpdates("server-1"))
      .rejects.toThrow("FiveM runtime export endpoint returned invalid JSON");
  });

  it("rejects blank server ids before calling the runtime export bridge", async () => {
    const calls: unknown[] = [];
    const client = new FiveMHttpRuntimeClient({
      endpoint: "https://fx.example/runtime/exports",
      fetch: async (_url, init) => {
        calls.push(init);
        return {
          ok: true,
          status: 200,
          async json() {
            return [];
          },
          async text() {
            return "";
          }
        };
      }
    });

    await expect(client.drainQbCharacterUpdates(" "))
      .rejects.toThrow("FiveM runtime export serverId must be a non-empty string");
    await expect(client.drainQbMoneyUpdates(""))
      .rejects.toThrow("FiveM runtime export serverId must be a non-empty string");
    expect(calls).toEqual([]);
  });
});
