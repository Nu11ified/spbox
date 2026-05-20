import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json") as {
  scripts: Record<string, string>;
};

describe("operations runbook", () => {
  it("documents runnable backup, recovery, revocation, kill switch, and rollback procedures", () => {
    const guide = readFileSync("docs/operations-runbook.md", "utf8");
    const productionRunbook = readFileSync("docs/production-runbook.md", "utf8");
    const readiness = readFileSync("docs/production-readiness.md", "utf8");
    const verifier = readFileSync("scripts/verify-operations-runbook.mjs", "utf8");

    expect(packageJson.scripts["verify:operations-runbook"]).toBe(
      "node scripts/verify-operations-runbook.mjs"
    );
    expect(guide).toContain("# Operations Runbook");
    expect(guide).toContain("SpacetimeDB database snapshots");
    expect(guide).toContain("GET /deployments");
    expect(guide).toContain("POST /signers/<signerId>/revoke");
    expect(guide).toContain("POST /bundles/<bundleId>/revoke");
    expect(guide).toContain("POST /plugins/<pluginId>/kill");
    expect(guide).toContain("POST /plugins/<pluginId>/rollback");
    expect(guide).toContain("POST /deployments/<deploymentId>/fail");
    expect(guide).toContain("plugin.signer_revoked");
    expect(guide).toContain("plugin.bundle_revoked");
    expect(guide).toContain("plugin.kill_switch");
    expect(guide).toContain("plugin.deployment_rollback");
    expect(guide).toContain("npm run verify:operations-runbook");
    expect(productionRunbook).toContain("[Operations Runbook](./operations-runbook.md)");
    expect(productionRunbook).toContain("npm run verify:operations-runbook");
    expect(readiness).not.toContain("Backup, rollback, signer revocation, and plugin kill-switch operator procedures.");
    expect(verifier).toContain("docs/operations-runbook.md");
  });
});
