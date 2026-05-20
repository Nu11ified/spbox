import { describe, expect, it } from "vitest";
import { createServerAdapter } from "../src/admin/http-server.js";

describe("admin static server", () => {
  it("serves admin panel files from /admin", async () => {
    const adapter = createServerAdapter({
      async handle() {
        return { status: 404, body: { error: "api miss" } };
      }
    });

    const index = await adapter.inject({ method: "GET", path: "/admin/" });
    const app = await adapter.inject({ method: "GET", path: "/admin/app.js" });

    expect(index.status).toBe(200);
    expect(index.headers["content-type"]).toBe("text/html; charset=utf-8");
    expect(String(index.body)).toContain("SDB Runtime Admin");
    expect(app.status).toBe(200);
    expect(app.headers["content-type"]).toBe("text/javascript; charset=utf-8");
    expect(String(app.body)).toContain("refreshDashboard");
  });
});
