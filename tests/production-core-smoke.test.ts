import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { runProductionCoreSmoke } from "../src/admin/production-smoke.js";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json") as {
  scripts: Record<string, string>;
};

describe("production core smoke", () => {
  it("verifies the admin connector endpoints used by the production runbook", async () => {
    const result = await runProductionCoreSmoke({
      serverId: "prod-smoke",
      serverName: "Production Smoke",
      environment: "production",
      publicKey: "public-key"
    });

    expect(result).toEqual({
      serverId: "prod-smoke",
      checks: [
        { name: "dashboard", status: 200 },
        { name: "plugin registry", status: 200 },
        { name: "deployments", status: 200 }
      ]
    });
  });

  it("exposes the production core smoke command after build", () => {
    expect(packageJson.scripts["smoke:production-core"]).toBe("node dist/src/admin/production-smoke.js");
  });
});
