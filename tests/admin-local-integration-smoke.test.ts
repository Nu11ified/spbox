import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { runAdminLocalIntegrationSmoke } from "../src/admin/local-integration-smoke.js";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json") as {
  scripts: Record<string, string>;
};

describe("admin local integration smoke", () => {
  it("boots the admin HTTP server and exercises health, config, and action routes over localhost", async () => {
    const result = await runAdminLocalIntegrationSmoke({
      serverId: "integration-main",
      serverName: "Integration Main",
      environment: "production",
      publicKey: "integration-public-key"
    });

    expect(result).toEqual({
      serverId: "integration-main",
      checks: [
        { name: "dashboard", status: 200 },
        { name: "config write", status: 200 },
        { name: "action queue", status: 200 },
        { name: "query filtered drain", status: 200 },
        { name: "action drain", status: 200 }
      ],
      configVersion: 1,
      unrelatedDrainCount: 0,
      drainedActionCount: 1
    });
  });

  it("exposes the local integration smoke command after build", () => {
    expect(packageJson.scripts["smoke:admin-local"]).toBe("node dist/src/admin/local-integration-smoke.js");
  });
});
