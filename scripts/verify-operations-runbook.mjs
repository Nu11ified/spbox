import { readFileSync } from "node:fs";

const guidePath = "docs/operations-runbook.md";
const httpApiPath = "src/admin/http-api.ts";
const guide = readFileSync(guidePath, "utf8");
const httpApi = readFileSync(httpApiPath, "utf8");

const requiredGuideContent = [
  "SpacetimeDB database snapshots",
  "GET /deployments",
  "POST /signers/<signerId>/revoke",
  "POST /bundles/<bundleId>/revoke",
  "POST /plugins/<pluginId>/kill",
  "POST /plugins/<pluginId>/rollback",
  "POST /deployments/<deploymentId>/fail",
  "plugin.signer_revoked",
  "plugin.bundle_revoked",
  "plugin.kill_switch",
  "plugin.deployment_rollback",
  "npm run verify:operations-runbook"
];

const requiredApiFragments = [
  'parts[0] === "signers" && parts[2] === "revoke"',
  'parts[0] === "bundles" && parts[2] === "revoke"',
  'parts[0] === "plugins" && parts[2] === "kill"',
  'parts[0] === "plugins" && parts[2] === "rollback"',
  'parts[0] === "deployments" && parts[2] === "fail"',
  'request.method === "GET" && pathOnly === "/deployments"'
];

for (const expected of requiredGuideContent) {
  if (!guide.includes(expected)) {
    throw new Error(`${guidePath} missing required operation text: ${expected}`);
  }
}

for (const expected of requiredApiFragments) {
  if (!httpApi.includes(expected)) {
    throw new Error(`${httpApiPath} missing documented operation route: ${expected}`);
  }
}

console.log("Verified operations runbook lifecycle routes and audit checks.");
