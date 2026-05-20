import { describe, expect, it } from "vitest";
import { createServerAdapter } from "../src/admin/http-server.js";

describe("admin HTTP server adapter", () => {
  it("serializes handler responses and request JSON bodies", async () => {
    const adapter = createServerAdapter({
      async handle(request) {
        return {
          status: 201,
          body: {
            method: request.method,
            path: request.path,
            body: request.body
          }
        };
      }
    });

    const response = await adapter.inject({
      method: "POST",
      path: "/example",
      body: { ok: true }
    });

    expect(response).toEqual({
      status: 201,
      headers: { "content-type": "application/json" },
      body: {
        method: "POST",
        path: "/example",
        body: { ok: true }
      }
    });
  });

  it("preserves query strings for HTTP routes that filter by query parameters", async () => {
    const adapter = createServerAdapter({
      async handle(request) {
        return {
          status: 200,
          body: {
            path: request.path
          }
        };
      }
    });
    const server = await adapter.listen(0, "127.0.0.1");

    try {
      const address = server.address();
      if (address === null || typeof address === "string") {
        throw new Error("Expected TCP server address");
      }
      const response = await fetch(`http://127.0.0.1:${address.port}/audit?status=denied`);

      await expect(response.json()).resolves.toEqual({
        path: "/audit?status=denied"
      });
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }
  });

  it("serializes bigint values from live SpacetimeDB rows", async () => {
    const adapter = createServerAdapter({
      async handle() {
        return {
          status: 200,
          body: {
            row: {
              balance: 9007199254740993n
            }
          }
        };
      }
    });
    const server = await adapter.listen(0, "127.0.0.1");

    try {
      const address = server.address();
      if (address === null || typeof address === "string") {
        throw new Error("Expected TCP server address");
      }
      const response = await fetch(`http://127.0.0.1:${address.port}/example`);

      await expect(response.json()).resolves.toEqual({
        row: {
          balance: "9007199254740993"
        }
      });
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }
  });
});
