import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);

function optionValue(name, fallback) {
  const index = args.indexOf(name);
  if (index === -1) {
    return fallback;
  }
  return args[index + 1];
}

const provenancePath = optionValue("--provenance", "src/spacetime/module_bindings/provenance.json");
const fxserverLogPath = optionValue("--fxserver-log", undefined);
const fxserverNetworkProbePath = optionValue("--fxserver-network-probe", undefined);
const fxserverSocketProbePath = optionValue("--fxserver-socket-probe", undefined);
const fxserverPlayerProbePath = optionValue("--fxserver-player-probe", undefined);
const fxserverConnectInfoPath = optionValue("--fxserver-connect-info", undefined);
const fxserverVerificationOutputPath = optionValue("--fxserver-verification-output", undefined);
const requireQbcore = args.includes("--require-qbcore");
const requireQbox = args.includes("--require-qbox");
const requireClient = args.includes("--require-client");
const allowTestFixture = args.includes("--allow-test-fixture");

function fail(message) {
  console.error(message);
  process.exit(1);
}

function requireFile(path, label) {
  if (!path) {
    fail(`${label} is required.`);
  }
  if (!existsSync(path)) {
    fail(`Missing ${label}: ${path}`);
  }
}

function readEvidence(path, label) {
  requireFile(path, label);
  return readFileSync(path, "utf8");
}

function smokeRunIdFrom(content) {
  return (
    content.match(/^Smoke run id:\s+(.+)$/m)?.[1]?.trim() ||
    content.match(/Smoke run id:\s*<code>([^<]+)<\/code>/)?.[1]?.trim()
  );
}

function lineValue(content, label) {
  const pattern = new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[ \\t]*(.*)$`, "m");
  return content.match(pattern)?.[1]?.trim();
}

function parseHttpTarget(content, label, path) {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedPath = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = content.match(new RegExp(`^${escapedLabel}: http://([^:/\\s]+):(\\d+)${escapedPath}$`, "m"));
  if (!match) {
    return undefined;
  }
  return {
    host: match[1],
    port: Number(match[2])
  };
}

function parseConnectTarget(value) {
  const match = value?.match(/^([^:\s]+):(\d+)$/);
  if (!match) {
    return undefined;
  }
  return {
    host: match[1],
    port: Number(match[2])
  };
}

function parseFivemConnectUri(value) {
  const match = value?.match(/^fivem:\/\/connect\/([^:\s]+):(\d+)$/);
  if (!match) {
    return undefined;
  }
  return {
    host: match[1],
    port: Number(match[2])
  };
}

function parseFiniteNumberLine(content, label) {
  const rawValue = lineValue(content, label);
  if (rawValue === undefined) {
    return undefined;
  }
  const value = Number(rawValue);
  return Number.isFinite(value) ? value : undefined;
}

function hasLine(content, label) {
  return lineValue(content, label) !== undefined;
}

function parseAlternateFivemConnectUris(value) {
  if (!value || value === "none") {
    return [];
  }
  return value.split(",").map((entry) => entry.trim()).filter(Boolean);
}

function isUnresolvedConnectHost(host) {
  return !host || host === "<server-ip>" || /[<>]/.test(host);
}

function isValidPort(value) {
  return Number.isInteger(value) && value >= 1 && value <= 65535;
}

function fivemHrefTarget(content) {
  const match = content.match(/href="(fivem:\/\/connect\/[^"]+)"/);
  return parseFivemConnectUri(match?.[1]);
}

const smokeRunEvidence = [];
let missingClientLauncherEvidence = false;

function recordSmokeRunEvidence(path, label, content) {
  smokeRunEvidence.push({
    label,
    path,
    runId: smokeRunIdFrom(content)
  });
}

function requireClientRunnerEvidenceBundle() {
  if (!requireClient) {
    return;
  }

  const required = [
    ["--fxserver-connect-info", fxserverConnectInfoPath],
    ["--fxserver-network-probe", fxserverNetworkProbePath],
    ["--fxserver-socket-probe", fxserverSocketProbePath],
    ["--fxserver-player-probe", fxserverPlayerProbePath],
    ["--fxserver-verification-output", fxserverVerificationOutputPath]
  ];
  const missing = required.filter(([, path]) => !path).map(([option]) => option);
  if (missing.length > 0) {
    fail(`Client-required production readiness requires runner evidence: ${missing.join(", ")}`);
  }
}

function verifyFxServerNetworkProbe(path) {
  if (!path) {
    return;
  }

  const probe = readEvidence(path, "FXServer network probe evidence");
  recordSmokeRunEvidence(path, "FXServer network probe evidence", probe);
  if (!probe.includes("FXServer network probe for /info.json")) {
    fail("FXServer network probe evidence is not a runner-generated /info.json probe.");
  }
  if (!/^local: HTTP 200$/m.test(probe)) {
    fail("FXServer network probe did not confirm local HTTP 200.");
  }
  if (probe.includes("Advertised probe target:") && !/^advertised: HTTP 200$/m.test(probe)) {
    fail("FXServer network probe did not confirm advertised HTTP 200.");
  }
  for (const match of probe.matchAll(/^Alternate probe target \(([^)]+)\):/gm)) {
    const label = match[1];
    const pattern = new RegExp(`^alternate-${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}: HTTP 200$`, "m");
    if (!pattern.test(probe)) {
      fail("FXServer network probe did not confirm alternate HTTP 200.");
    }
  }
}

function verifyFxServerSocketProbe(path) {
  if (!path) {
    return;
  }

  const probe = readEvidence(path, "FXServer socket probe evidence");
  recordSmokeRunEvidence(path, "FXServer socket probe evidence", probe);
  if (!probe.includes("FXServer socket probe for")) {
    fail("FXServer socket probe evidence is not a runner-generated socket probe.");
  }
  if (!/^TCP listen confirmed: yes$/m.test(probe)) {
    fail("FXServer socket probe did not confirm TCP listen.");
  }
  if (!/^UDP listen confirmed: yes$/m.test(probe)) {
    fail("FXServer socket probe did not confirm UDP listen.");
  }
}

function verifyFxServerPlayerProbe(path) {
  if (!path) {
    return;
  }

  const probe = readEvidence(path, "FXServer player probe evidence");
  recordSmokeRunEvidence(path, "FXServer player probe evidence", probe);
  if (!probe.includes("FXServer player probe for /players.json")) {
    fail("FXServer player probe evidence is not a runner-generated /players.json probe.");
  }
  if (!/^local: HTTP 200 players=\d+$/m.test(probe)) {
    fail("FXServer player probe did not confirm local HTTP 200.");
  }
  if (probe.includes("Advertised probe target:") && !/^advertised: HTTP 200 players=\d+$/m.test(probe)) {
    fail("FXServer player probe did not confirm advertised HTTP 200.");
  }
  for (const match of probe.matchAll(/^Alternate probe target \(([^)]+)\):/gm)) {
    const label = match[1];
    const pattern = new RegExp(`^alternate-${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}: HTTP 200 players=\\d+$`, "m");
    if (!pattern.test(probe)) {
      fail("FXServer player probe did not confirm alternate HTTP 200.");
    }
  }
  if (!/^Player count observed: \d+$/m.test(probe)) {
    fail("FXServer player probe did not record a numeric observed player count.");
  }
  if (!/^Max player count observed: \d+$/m.test(probe)) {
    fail("FXServer player probe did not record a numeric max player count.");
  }
  const maxPlayerCount = Number(probe.match(/^Max player count observed: (\d+)$/m)?.[1] ?? "0");
  if (!/^Player samples observed: \d+$/m.test(probe)) {
    fail("FXServer player probe did not record a numeric sample count.");
  }
  const observedSampleCount = Number(probe.match(/^Player samples observed: (\d+)$/m)?.[1] ?? "0");
  const samplePlayerCounts = [...probe.matchAll(/^sample:\s+.+\splayers=(\d+)$/gm)].map((match) => Number(match[1]));
  if (samplePlayerCounts.length !== observedSampleCount) {
    fail("FXServer player probe sample count does not match sampled lines.");
  }
  const sampledMaxPlayerCount = samplePlayerCounts.reduce((max, count) => Math.max(max, count), 0);
  if (sampledMaxPlayerCount !== maxPlayerCount) {
    fail("FXServer player probe max player count does not match sampled players.");
  }
  if (requireClient && sampledMaxPlayerCount < 1) {
    fail("FXServer player probe did not observe a connected player.");
  }
}

function verifyFxServerConnectInfo(path) {
  if (!path) {
    return;
  }

  const info = readEvidence(path, "FXServer connect info evidence");
  recordSmokeRunEvidence(path, "FXServer connect info evidence", info);
  const required = [
    "FiveM connect target:",
    "FiveM connect URI: fivem://connect/",
    "Detected IPv4 addresses:",
    "Bind address:",
    "Advertised connect host:",
    "Port:",
    "Transcript path:",
    "Network probe path:",
    "Socket probe path:",
    "Player probe path:",
    "Verification output path:",
    "Server-side readiness verifier:",
    "Client-required verifier:",
    "--fxserver-connect-info",
    "--fxserver-network-probe",
    "--fxserver-socket-probe",
    "--fxserver-player-probe",
    "--fxserver-verification-output",
    "--require-client"
  ];
  const missing = required.filter((item) => !info.includes(item));
  if (missing.length > 0) {
    fail(`FXServer connect info missing required content: ${missing.join(", ")}`);
  }
  if (requireClient && !/^Client checks required: yes$/m.test(info)) {
    fail("FXServer connect info did not come from a client-required run.");
  }
  const bindAddress = lineValue(info, "Bind address:");
  if (!bindAddress) {
    fail("FXServer connect info bind address is missing.");
  }
  const advertisedHost = lineValue(info, "Advertised connect host:");
  const advertisedPort = Number(lineValue(info, "Port:") ?? "NaN");
  if (!advertisedHost || !isValidPort(advertisedPort)) {
    fail("FXServer connect info advertised target is malformed.");
  }
  const connectTarget = parseConnectTarget(lineValue(info, "FiveM connect target:"));
  const connectUriTarget = parseFivemConnectUri(lineValue(info, "FiveM connect URI:"));
  if (!connectTarget || !connectUriTarget || !isValidPort(connectTarget.port) || !isValidPort(connectUriTarget.port)) {
    fail("FXServer connect info advertised target is malformed.");
  }
  const smokeTimeoutMs = parseFiniteNumberLine(info, "Smoke timeout ms:");
  const collectionWindowMs = parseFiniteNumberLine(info, "Collection window ms:");
  const clientGraceWindowMs = parseFiniteNumberLine(info, "Client grace window ms:");
  const effectiveTimeoutMs = parseFiniteNumberLine(info, "Effective timeout ms:");
  if (hasLine(info, "Smoke timeout ms:") && (!smokeTimeoutMs || smokeTimeoutMs <= 0)) {
    fail("FXServer connect info smoke timing is malformed.");
  }
  if (hasLine(info, "Collection window ms:") && (!collectionWindowMs || collectionWindowMs <= 0)) {
    fail("FXServer connect info smoke timing is malformed.");
  }
  if (hasLine(info, "Client grace window ms:") && (clientGraceWindowMs === undefined || clientGraceWindowMs < 0)) {
    fail("FXServer connect info smoke timing is malformed.");
  }
  if (hasLine(info, "Effective timeout ms:") && (!effectiveTimeoutMs || effectiveTimeoutMs <= 0)) {
    fail("FXServer connect info smoke timing is malformed.");
  }
  if (
    isUnresolvedConnectHost(advertisedHost) ||
    isUnresolvedConnectHost(connectTarget.host) ||
    isUnresolvedConnectHost(connectUriTarget.host)
  ) {
    fail("FXServer connect info advertised target is unresolved.");
  }
  const alternateConnectUris = [];
  for (const alternateEntry of parseAlternateFivemConnectUris(lineValue(info, "Alternate FiveM connect URIs:"))) {
    const separatorIndex = alternateEntry.indexOf("=");
    const alternateUri = alternateEntry.slice(separatorIndex + 1);
    const alternateTarget = parseFivemConnectUri(alternateUri);
    if (
      separatorIndex < 1 ||
      !alternateTarget ||
      isUnresolvedConnectHost(alternateTarget.host) ||
      !isValidPort(alternateTarget.port)
    ) {
      fail("FXServer connect info alternate FiveM connect URI is malformed.");
    }
    alternateConnectUris.push(alternateUri);
  }
  if (
    connectTarget.host !== advertisedHost ||
    connectTarget.port !== advertisedPort ||
    connectUriTarget.host !== advertisedHost ||
    connectUriTarget.port !== advertisedPort
  ) {
    fail("FXServer connect info advertised target does not match probe evidence.");
  }
  const expectedPaths = [
    ["Transcript path:", fxserverLogPath, "transcript"],
    ["Network probe path:", fxserverNetworkProbePath, "network probe"],
    ["Socket probe path:", fxserverSocketProbePath, "socket probe"],
    ["Player probe path:", fxserverPlayerProbePath, "player probe"],
    ["Verification output path:", fxserverVerificationOutputPath, "verification output"]
  ];
  for (const [label, expectedPath, description] of expectedPaths) {
    if (!expectedPath) {
      continue;
    }
    const actualPath = lineValue(info, label);
    if (!actualPath) {
      fail(`FXServer connect info ${description} path is missing.`);
    }
    if (actualPath !== expectedPath) {
      fail(`FXServer connect info ${description} path does not match supplied evidence.`);
    }
  }
  if (fxserverSocketProbePath) {
    const socketProbe = readFileSync(fxserverSocketProbePath, "utf8");
    const socketPort = Number(socketProbe.match(/^FXServer socket probe for (\d+)$/m)?.[1] ?? "NaN");
    if (Number.isInteger(socketPort) && socketPort !== advertisedPort) {
      fail("FXServer connect info port does not match socket probe evidence.");
    }
  }
  if (fxserverNetworkProbePath) {
    const networkProbe = readFileSync(fxserverNetworkProbePath, "utf8");
    const target = parseHttpTarget(networkProbe, "Advertised probe target", "/info.json");
    if (target && (target.host !== advertisedHost || target.port !== advertisedPort)) {
      fail("FXServer connect info advertised target does not match probe evidence.");
    }
  }
  if (fxserverPlayerProbePath) {
    const playerProbe = readFileSync(fxserverPlayerProbePath, "utf8");
    const target = parseHttpTarget(playerProbe, "Advertised probe target", "/players.json");
    if (target && (target.host !== advertisedHost || target.port !== advertisedPort)) {
      fail("FXServer connect info advertised target does not match probe evidence.");
    }
  }
  if (requireClient && !info.includes("Client launcher path:")) {
    missingClientLauncherEvidence = true;
  }
  if (info.includes("Client launcher path:")) {
    const launcherPath = lineValue(info, "Client launcher path:");
    if (!launcherPath) {
      fail("FXServer connect info client launcher path is missing.");
    }
    const launcher = readEvidence(launcherPath, "FXServer client launcher evidence");
    recordSmokeRunEvidence(launcherPath, "FXServer client launcher evidence", launcher);
    const launcherTarget = fivemHrefTarget(launcher);
    if (!launcherTarget) {
      fail("FXServer client launcher target is malformed.");
    }
    if (launcherTarget.host !== advertisedHost || launcherTarget.port !== advertisedPort) {
      fail("FXServer client launcher target does not match connect info.");
    }
    for (const alternateUri of alternateConnectUris) {
      if (!launcher.includes(alternateUri)) {
        fail("FXServer client launcher is missing alternate FiveM connect URI.");
      }
    }
  }
}

function verifyFxServerVerificationOutput(path) {
  if (!path) {
    return;
  }

  const output = readEvidence(path, "FXServer verification output evidence");
  recordSmokeRunEvidence(path, "FXServer verification output evidence", output);
  const clientSectionMarker = "Client-required FXServer smoke verifier:";
  const serverSection = output.split(clientSectionMarker)[0] || "";
  const clientSection = output.includes(clientSectionMarker) ? output.slice(output.indexOf(clientSectionMarker)) : "";
  const serverRequired = ["Server-side FXServer smoke verifier:", "Verified FXServer smoke transcript:"];
  if (requireQbcore) {
    serverRequired.push("Verified QBCore facade smoke checks.");
  }
  if (requireQbox) {
    serverRequired.push("Verified Qbox facade smoke checks.");
  }
  const missing = serverRequired.filter((item) => !serverSection.includes(item));
  if (requireClient) {
    const clientRequired = [clientSectionMarker, "Verified FXServer smoke transcript:", "Verified client smoke checks."];
    if (requireQbcore) {
      clientRequired.push("Verified QBCore facade smoke checks.");
    }
    if (requireQbox) {
      clientRequired.push("Verified Qbox facade smoke checks.");
    }
    missing.push(...clientRequired.filter((item) => !clientSection.includes(item)));
  }
  if (missing.length > 0) {
    fail(`FXServer verification output missing required content: ${missing.join(", ")}`);
  }
  const failurePatterns = [
    /^Missing FXServer smoke checks:/m,
    /^Failed FXServer smoke checks:/m,
    /^No connected FiveM client evidence found/m,
    /^A FiveM client connection was seen, but required client smoke checks are still missing/m,
    /^Refusing test fixture smoke log/m
  ];
  const serverSideOutput = output.split("Client-required FXServer smoke verifier:")[0] || output;
  const relevantOutput = requireClient ? output : serverSideOutput;
  if (failurePatterns.some((pattern) => pattern.test(relevantOutput))) {
    fail("FXServer verification output contains failure diagnostics.");
  }
}

function verifySmokeRunIds() {
  if (smokeRunEvidence.length === 0) {
    return;
  }

  const missing = smokeRunEvidence.filter((entry) => !entry.runId);
  if (missing.length > 0) {
    fail(`FXServer runner evidence missing smoke run id: ${missing.map((entry) => entry.label).join(", ")}`);
  }

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const malformed = smokeRunEvidence.filter((entry) => !uuidPattern.test(entry.runId));
  if (malformed.length > 0) {
    fail(`FXServer runner evidence has malformed smoke run id: ${malformed.map((entry) => entry.label).join(", ")}`);
  }

  const distinctRunIds = [...new Set(smokeRunEvidence.map((entry) => entry.runId))];
  if (distinctRunIds.length > 1) {
    fail("FXServer runner evidence smoke run ids do not match.");
  }
}

requireFile(provenancePath, "binding provenance");

const provenance = JSON.parse(readFileSync(provenancePath, "utf8"));
if (provenance.status !== "official") {
  fail(
    `official SpacetimeDB bindings are required; current provenance status is ${JSON.stringify(
      provenance.status
    )}. Run npm run generate:spacetime-bindings with the spacetime CLI.`
  );
}

if (!provenance.generatedAt || !provenance.cliVersion) {
  fail("official SpacetimeDB binding provenance requires generatedAt and cliVersion.");
}

requireFile(fxserverLogPath, "FXServer smoke log evidence");
recordSmokeRunEvidence(
  fxserverLogPath,
  "FXServer smoke log evidence",
  readFileSync(fxserverLogPath, "utf8")
);
requireClientRunnerEvidenceBundle();

const smokeArgs = ["scripts/verify-fxserver-smoke-log.mjs", fxserverLogPath];
if (requireQbcore) {
  smokeArgs.push("--require-qbcore");
}
if (requireQbox) {
  smokeArgs.push("--require-qbox");
}
if (requireClient) {
  smokeArgs.push("--require-client");
}
if (allowTestFixture) {
  smokeArgs.push("--allow-test-fixture");
}

const smoke = spawnSync("node", smokeArgs, {
  encoding: "utf8"
});

if (smoke.stdout) {
  process.stdout.write(smoke.stdout);
}
if (smoke.stderr) {
  process.stderr.write(smoke.stderr);
}
if (smoke.status !== 0) {
  process.exit(smoke.status ?? 1);
}

verifyFxServerNetworkProbe(fxserverNetworkProbePath);
verifyFxServerSocketProbe(fxserverSocketProbePath);
verifyFxServerPlayerProbe(fxserverPlayerProbePath);
verifyFxServerConnectInfo(fxserverConnectInfoPath);
verifyFxServerVerificationOutput(fxserverVerificationOutputPath);
verifySmokeRunIds();
if (missingClientLauncherEvidence) {
  fail("FXServer connect info missing required content: Client launcher path:");
}

console.log("Production readiness evidence verified.");
console.log(`Official bindings generated at: ${provenance.generatedAt}`);
console.log(`SpacetimeDB CLI version: ${provenance.cliVersion}`);
console.log(`FXServer smoke evidence: ${fxserverLogPath}`);
if (fxserverNetworkProbePath) {
  console.log(`FXServer network probe evidence: ${fxserverNetworkProbePath}`);
}
if (fxserverSocketProbePath) {
  console.log(`FXServer socket probe evidence: ${fxserverSocketProbePath}`);
}
if (fxserverPlayerProbePath) {
  console.log(`FXServer player probe evidence: ${fxserverPlayerProbePath}`);
}
if (fxserverConnectInfoPath) {
  console.log(`FXServer connect info evidence: ${fxserverConnectInfoPath}`);
}
if (fxserverVerificationOutputPath) {
  console.log(`FXServer verification output evidence: ${fxserverVerificationOutputPath}`);
}
