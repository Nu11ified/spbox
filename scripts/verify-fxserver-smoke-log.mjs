import { existsSync, readFileSync } from "node:fs";

const args = process.argv.slice(2);
const logPath = args.find((arg) => !arg.startsWith("--"));
const requireQbcore = args.includes("--require-qbcore");
const requireQbox = args.includes("--require-qbox");
const requireClient = args.includes("--require-client");
const allowTestFixture = args.includes("--allow-test-fixture");

const ansiPattern = /\u001b\[[0-9;]*m/g;

const baseChecks = [
  "sdb_runtime:GetHealth",
  "sdb_runtime:GetConfig",
  "sdb_runtime:HasPermission",
  "sdb_runtime:GetQbShared"
];

const qbcoreChecks = [
  "qb-core:GetCoreObject"
];

const qboxChecks = [
  "fixture:qbox:server-player-exports",
  "fixture:qbox:server-money-groups",
  "fixture:qbox:server-shared-and-items"
];

const qbcoreFixtureChecks = [
  "fixture:qbcore:server-core-object",
  "fixture:qbcore:server-player-methods",
  "fixture:qbcore:server-callbacks-items-vehicles"
];

const clientChecks = [
  "client:sdb_runtime_smoke:loaded",
  "client:sdb_runtime:GetQbPlayerData",
  "client:sdb_runtime:GetQbShared"
];

const clientQbcoreChecks = [
  "client:qb-core:GetCoreObject",
  "fixture:qbcore:client:core-object-playerdata"
];

const clientQboxChecks = [
  "fixture:qbox:client:playerdata-module"
];

const fxserverResourceChecks = [
  "sdb_runtime",
  "qb-core",
  "qbx_core",
  "sdb_runtime_smoke",
  "sdb_qbcore_fixture",
  "sdb_qbox_fixture"
];

if (!logPath) {
  console.error("Usage: node scripts/verify-fxserver-smoke-log.mjs <fxserver-log-path> [--require-qbcore] [--require-qbox] [--require-client]");
  process.exit(1);
}

if (!existsSync(logPath)) {
  console.error(`Missing FXServer smoke log: ${logPath}`);
  process.exit(1);
}

const normalizedLogPath = logPath.replace(/\\/g, "/");
const testFixturePath =
  normalizedLogPath.includes("/spbox-fxserver-smoke-log-tests/") ||
  normalizedLogPath.includes("/spbox-production-readiness-tests/");
if (testFixturePath && !allowTestFixture) {
  console.error(`Refusing test fixture smoke log as production evidence: ${logPath}`);
  process.exit(1);
}

const log = readFileSync(logPath, "utf8").replace(ansiPattern, "");
const passed = new Set();
const failed = [];
const clientConnectionEvidence = [
  /\bplayerConnecting\b/i,
  /\bplayerJoining\b/i,
  /\bplayerDropped\b/i,
  /\bjoined the server\b/i,
  /\bClient .* connected\b/i,
  /\bNetworkGetEntityOwner\b/i
];

const missingResourceStarts = fxserverResourceChecks.filter((resourceName) => {
  const escaped = resourceName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const startedResource = new RegExp(`\\bStarted resource ${escaped}\\b`);
  const scriptEnvironment = new RegExp(`\\bCreating script environments for ${escaped}\\b`);
  return !startedResource.test(log) && !scriptEnvironment.test(log);
});

if (missingResourceStarts.length > 0) {
  console.error("Missing FXServer resource lifecycle evidence:");
  for (const resourceName of missingResourceStarts) {
    console.error(`- ${resourceName}`);
  }
  process.exit(1);
}

for (const line of log.split(/\r?\n/)) {
  const match = line.match(/\[sdb_runtime_smoke\]\s+(PASS|FAIL)\s+(.+)$/);
  if (!match) {
    continue;
  }

  const [, status, payload] = match;
  const detailSeparator = payload.indexOf(": ");
  const name = detailSeparator === -1 ? payload : payload.slice(0, detailSeparator);
  const detail = detailSeparator === -1 ? "" : payload.slice(detailSeparator + 2);
  if (status === "PASS") {
    passed.add(name);
  } else {
    failed.push({ name, detail });
  }
}

if (failed.length > 0) {
  console.error("Failed FXServer smoke checks:");
  for (const failure of failed) {
    console.error(`- ${failure.name}${failure.detail ? `: ${failure.detail}` : ""}`);
  }
  process.exit(1);
}

const required = [...baseChecks];
if (requireQbcore) {
  required.push(...qbcoreChecks, ...qbcoreFixtureChecks);
}
if (requireQbox) {
  required.push(...qboxChecks);
}
if (requireClient) {
  required.push(...clientChecks);
}
if (requireQbcore && requireClient) {
  required.push(...clientQbcoreChecks);
}
if (requireQbox && requireClient) {
  required.push(...clientQboxChecks);
}

const missing = required.filter((check) => !passed.has(check));
const hasClientConnectionEvidence = clientConnectionEvidence.some((pattern) => pattern.test(log));
if (missing.length > 0) {
  console.error("Missing FXServer smoke checks:");
  for (const check of missing) {
    console.error(`- ${check}`);
  }
  if (requireClient && missing.some((check) => check.startsWith("client:") || check.includes(":client:"))) {
    if (!hasClientConnectionEvidence) {
      console.error("No connected FiveM client evidence found in the FXServer transcript.");
      console.error("Connect a FiveM client to the runner's fivem://connect target while the smoke run is active.");
    } else {
      console.error("A FiveM client connection was seen, but required client smoke checks are still missing.");
      console.error("Inspect the client F8 console and fixture client scripts for runtime errors or blocked client events.");
    }
  }
  process.exit(1);
}

if (requireClient && !hasClientConnectionEvidence) {
  console.error("No connected FiveM client evidence found in the FXServer transcript.");
  console.error("Client-required smoke evidence must include a client join/connect marker as well as client PASS lines.");
  process.exit(1);
}

console.log(`Verified FXServer smoke transcript: ${passed.size} checks passed.`);
if (requireQbcore) {
  console.log("Verified QBCore facade smoke checks.");
}
if (requireQbox) {
  console.log("Verified Qbox facade smoke checks.");
}
if (requireClient) {
  console.log("Verified client smoke checks.");
}
