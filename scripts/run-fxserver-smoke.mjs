import { copyFileSync, cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import http from "node:http";
import { createHash, randomUUID } from "node:crypto";
import { networkInterfaces } from "node:os";

const defaultArtifactUrl =
  "https://runtime.fivem.net/artifacts/fivem/build_proot_linux/master/25770-8ddccd4e4dfd6a760ce18651656463f961cc4761/fx.tar.xz";
const defaultWorkdir = "/tmp/spbox-fxserver-smoke";

const args = process.argv.slice(2);

function optionValue(name, fallback) {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1];
}

const artifactUrl = optionValue("--artifact-url", process.env.SDB_FXSERVER_ARTIFACT_URL || defaultArtifactUrl);
const workdir = resolve(optionValue("--workdir", process.env.SDB_FXSERVER_SMOKE_DIR || defaultWorkdir));
const artifactCacheDir = resolve(
  optionValue("--artifact-cache-dir", process.env.SDB_FXSERVER_ARTIFACT_CACHE_DIR || "/tmp/spbox-fxserver-artifact-cache")
);
const bindAddress = optionValue("--bind-address", process.env.SDB_FXSERVER_BIND_ADDRESS || "127.0.0.1");
const port = Number(optionValue("--port", process.env.SDB_FXSERVER_PORT || "30120"));
const connectHost = optionValue(
  "--connect-host",
  process.env.SDB_FXSERVER_CONNECT_HOST || (bindAddress === "0.0.0.0" ? "<server-ip>" : bindAddress)
);
const timeoutMs = Number(optionValue("--timeout-ms", process.env.SDB_FXSERVER_SMOKE_TIMEOUT_MS || "180000"));
const licenseKey = optionValue("--license-key", process.env.SDB_FIVEM_LICENSE_KEY);
const prepareOnly = args.includes("--prepare-only");
const noVerify = args.includes("--no-verify");
const requireClient = !args.includes("--no-require-client");
const requireNetworkProbe =
  !args.includes("--no-require-network-probe") && process.env.SDB_FXSERVER_REQUIRE_NETWORK_PROBE !== "0";
const requireSocketProbe =
  !args.includes("--no-require-socket-probe") && process.env.SDB_FXSERVER_REQUIRE_SOCKET_PROBE !== "0";
const defaultCollectMs = requireClient ? timeoutMs : 15000;
const collectMs = Number(optionValue("--collect-ms", process.env.SDB_FXSERVER_SMOKE_COLLECT_MS || String(defaultCollectMs)));
const clientGraceMs = Number(optionValue("--client-grace-ms", process.env.SDB_FXSERVER_CLIENT_GRACE_MS || "0"));
const startupTimeoutBufferMs = 30000;
const effectiveTimeoutMs = Math.max(timeoutMs, startupTimeoutBufferMs + collectMs + (requireClient ? clientGraceMs : 0));
const smokeRunId = randomUUID();

const fxDir = join(workdir, "fx");
const serverDataDir = join(workdir, "server-data");
const artifactPath = join(workdir, "fx.tar.xz");
const artifactCachePath = join(artifactCacheDir, `${createHash("sha256").update(artifactUrl ?? "").digest("hex")}.tar.xz`);
const logPath = join(workdir, "fxserver-smoke.log");
const connectInfoPath = join(workdir, "connect-info.txt");
const connectLauncherPath = join(workdir, "connect-launcher.html");
const networkProbePath = join(workdir, "fxserver-network-probe.txt");
const socketProbePath = join(workdir, "fxserver-socket-probe.txt");
const playerProbePath = join(workdir, "fxserver-player-probe.txt");
const verificationOutputPath = join(workdir, "fxserver-smoke-verification.txt");

const resourceCopies = [
  ["resources/[runtime]/sdb_runtime", "resources/[runtime]/sdb_runtime"],
  ["resources/[compat]/qb-core", "resources/[compat]/qb-core"],
  ["resources/[compat]/qbx_core", "resources/[compat]/qbx_core"],
  ["resources/[test]/sdb_runtime_smoke", "resources/[test]/sdb_runtime_smoke"],
  ["resources/[test]/sdb_qbcore_fixture", "resources/[test]/sdb_qbcore_fixture"],
  ["resources/[test]/sdb_qbox_fixture", "resources/[test]/sdb_qbox_fixture"]
];

const baseSmokeChecks = [
  "sdb_runtime:GetHealth",
  "sdb_runtime:GetConfig",
  "sdb_runtime:HasPermission",
  "sdb_runtime:GetQbShared",
  "qb-core:GetCoreObject",
  "fixture:qbcore:server-core-object",
  "fixture:qbcore:server-player-methods",
  "fixture:qbcore:server-callbacks-items-vehicles",
  "fixture:qbox:server-player-exports",
  "fixture:qbox:server-money-groups",
  "fixture:qbox:server-shared-and-items"
];

const clientSmokeChecks = [
  "client:sdb_runtime_smoke:loaded",
  "client:sdb_runtime:GetQbPlayerData",
  "client:sdb_runtime:GetQbShared",
  "client:qb-core:GetCoreObject",
  "fixture:qbcore:client:core-object-playerdata",
  "fixture:qbox:client:playerdata-module"
];

const ansiPattern = /\u001b\[[0-9;]*m/g;
const playerProbeSamples = [];

function fail(message) {
  console.error(message);
  process.exit(1);
}

function isUnresolvedConnectHost(host) {
  return !host || host === "<server-ip>" || /[<>]/.test(host);
}

function isValidPort(value) {
  return Number.isInteger(value) && value >= 1 && value <= 65535;
}

function isPositiveFiniteNumber(value) {
  return Number.isFinite(value) && value > 0;
}

function isNonNegativeFiniteNumber(value) {
  return Number.isFinite(value) && value >= 0;
}

function isBlank(value) {
  return typeof value !== "string" || value.trim() === "";
}

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    encoding: "utf8",
    stdio: options.stdio || "pipe",
    cwd: options.cwd || process.cwd(),
    timeout: options.timeout
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const stderr = result.stderr ? `\n${result.stderr}` : "";
    const stdout = result.stdout ? `\n${result.stdout}` : "";
    throw new Error(`${command} ${commandArgs.join(" ")} failed with status ${result.status}${stderr}${stdout}`);
  }

  return result;
}

function allRequiredSmokeChecksPassed(output) {
  const cleanOutput = output.replace(ansiPattern, "");
  if (cleanOutput.includes("[sdb_runtime_smoke] FAIL ")) {
    return false;
  }

  const required = requireClient ? [...baseSmokeChecks, ...clientSmokeChecks] : baseSmokeChecks;
  return required.every((check) => cleanOutput.includes(`[sdb_runtime_smoke] PASS ${check}`));
}

function playerProbeResultLine(entry) {
  if (entry.status !== "HTTP 200") {
    return `${entry.label}: ${entry.status}`;
  }
  if (entry.label === "advertised") {
    return `advertised: HTTP 200 players=${entry.playerCount}`;
  }
  if (entry.label.startsWith("alternate-")) {
    return `${entry.label}: HTTP 200 players=${entry.playerCount}`;
  }
  return `local: HTTP 200 players=${entry.playerCount}`;
}

function playerProbeSampleLine(entry) {
  if (entry.label === "advertised") {
    return `sample: ${entry.at} target=advertised reason=${entry.reason} status=${entry.status} players=${entry.playerCount}`;
  }
  if (entry.label.startsWith("alternate-")) {
    return `sample: ${entry.at} target=alternate-${entry.label.slice("alternate-".length)} reason=${entry.reason} status=${entry.status} players=${entry.playerCount}`;
  }
  return `sample: ${entry.at} target=local reason=${entry.reason} status=${entry.status} players=${entry.playerCount}`;
}

function maxObservedPlayerCount() {
  return playerProbeSamples.reduce((max, entry) => Math.max(max, entry.playerCount), 0);
}

function probeHttpInfo(host, label) {
  return new Promise((resolveProbe) => {
    const request = http.get(
      {
        host,
        port,
        path: "/info.json",
        timeout: 3000
      },
      (response) => {
        response.resume();
        response.on("end", () => {
          resolveProbe(`${label}: HTTP ${response.statusCode}`);
        });
      }
    );

    request.on("timeout", () => {
      request.destroy(new Error("timeout"));
    });
    request.on("error", (error) => {
      resolveProbe(`${label}: ${error.message}`);
    });
  });
}

function probeHttpText(host, path, label) {
  return new Promise((resolveProbe) => {
    const request = http.get(
      {
        host,
        port,
        path,
        timeout: 3000
      },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          resolveProbe({
            label,
            statusCode: response.statusCode,
            body
          });
        });
      }
    );

    request.on("timeout", () => {
      request.destroy(new Error("timeout"));
    });
    request.on("error", (error) => {
      resolveProbe({
        label,
        error: error.message,
        body: ""
      });
    });
  });
}

function probeTargetEntries(localHost) {
  const targets = [{ label: "local", host: localHost }];
  if (connectHost !== "<server-ip>" && connectHost !== localHost) {
    targets.push({ label: "advertised", host: connectHost });
  }
  if (bindAddress === "0.0.0.0") {
    for (const target of connectTargetEntries().filter((entry) => entry.label !== "advertised")) {
      const host = target.target.split(":")[0];
      if (host !== localHost && host !== connectHost && !targets.some((entry) => entry.host === host)) {
        targets.push({ label: `alternate-${target.label}`, host });
      }
    }
  }
  return targets;
}

async function probeFxServerNetwork() {
  const localHost = bindAddress === "0.0.0.0" ? "127.0.0.1" : bindAddress;
  const targets = probeTargetEntries(localHost);
  const localResult = await probeHttpInfo(localHost, "local");
  const probes = [
    `FXServer network probe for /info.json`,
    `Smoke run id: ${smokeRunId}`,
    `Local probe target: http://${localHost}:${port}/info.json`,
    localResult
  ];
  let ok = localResult === "local: HTTP 200";

  if (targets.some((target) => target.label === "advertised")) {
    probes.push(`Advertised probe target: http://${connectHost}:${port}/info.json`);
    const advertisedResult = await probeHttpInfo(connectHost, "advertised");
    probes.push(advertisedResult);
    ok = ok && advertisedResult === "advertised: HTTP 200";
  }
  for (const target of targets.filter((entry) => entry.label.startsWith("alternate-"))) {
    probes.push(`Alternate probe target (${target.label.slice("alternate-".length)}): http://${target.host}:${port}/info.json`);
    const alternateResult = await probeHttpInfo(target.host, target.label);
    probes.push(alternateResult);
    ok = ok && alternateResult === `${target.label}: HTTP 200`;
  }

  writeFileSync(networkProbePath, `${probes.join("\n")}\n`);
  console.log(`Network probe path: ${networkProbePath}`);
  return ok;
}

async function probeFxServerPlayers(reason = "sample") {
  const localHost = bindAddress === "0.0.0.0" ? "127.0.0.1" : bindAddress;
  const targets = probeTargetEntries(localHost);

  const results = [];
  for (const target of targets) {
    const result = await probeHttpText(target.host, "/players.json", target.label);
    let playerCount = 0;
    let body = result.body || "";
    try {
      if (result.statusCode === 200) {
        const players = JSON.parse(body);
        if (Array.isArray(players)) {
          playerCount = players.length;
        }
      }
    } catch {
      body = "unparseable players.json";
    }
    results.push({
      label: target.label,
      host: target.host,
      status: result.statusCode === 200 ? "HTTP 200" : result.error || `HTTP ${result.statusCode}`,
      playerCount,
      body: body.trim() || "[]"
    });
  }

  const sampledAt = new Date().toISOString();
  for (const result of results) {
    playerProbeSamples.push({
      at: sampledAt,
      reason,
      ...result
    });
  }
  const localSample = results.find((entry) => entry.label === "local") || results[0];
  const advertisedSample = results.find((entry) => entry.label === "advertised");
  const maxPlayerCount = maxObservedPlayerCount();

  writeFileSync(
    playerProbePath,
    [
      "FXServer player probe for /players.json",
      `Smoke run id: ${smokeRunId}`,
      `Local probe target: http://${localHost}:${port}/players.json`,
      ...(advertisedSample ? [`Advertised probe target: http://${connectHost}:${port}/players.json`] : []),
      ...results
        .filter((entry) => entry.label.startsWith("alternate-"))
        .map((entry) => `Alternate probe target (${entry.label.slice("alternate-".length)}): http://${entry.host}:${port}/players.json`),
      `Probe reason: ${reason}`,
      `Player count observed: ${localSample.playerCount}`,
      `Max player count observed: ${maxPlayerCount}`,
      `Player samples observed: ${playerProbeSamples.length}`,
      ...results.map((entry) => playerProbeResultLine(entry)),
      ...playerProbeSamples.map((entry) => playerProbeSampleLine(entry)),
      `players: ${localSample.body}`,
      ""
    ].join("\n")
  );
  console.log(`Player probe path: ${playerProbePath}`);
  return results.every((entry) => entry.status === "HTTP 200");
}

function probeFxServerSockets() {
  const result = spawnSync("ss", ["-H", "-ltnu"], {
    encoding: "utf8"
  });
  const output = result.stdout || "";
  const portPattern = new RegExp(`:${port}\\b`);
  const lines = output.split(/\r?\n/).filter((line) => portPattern.test(line));
  const tcp = lines.some((line) => /^\s*tcp\b/i.test(line));
  const udp = lines.some((line) => /^\s*udp\b/i.test(line));

  writeFileSync(
    socketProbePath,
    [
      `FXServer socket probe for ${port}`,
      `Smoke run id: ${smokeRunId}`,
      `TCP listen confirmed: ${tcp ? "yes" : "no"}`,
      `UDP listen confirmed: ${udp ? "yes" : "no"}`,
      ...lines,
      ""
    ].join("\n")
  );
  console.log(`Socket probe path: ${socketProbePath}`);
  return tcp && udp;
}

function safeResetWorkdir(path) {
  if (!path.includes("spbox-fxserver-smoke")) {
    fail(`Refusing to reset smoke workdir without spbox-fxserver-smoke in path: ${path}`);
  }
  rmSync(path, { recursive: true, force: true });
}

function copyResource(source, target) {
  if (!existsSync(source)) {
    fail(`Missing source resource: ${source}`);
  }
  const destination = join(serverDataDir, target);
  mkdirSync(dirname(destination), { recursive: true });
  cpSync(source, destination, { recursive: true });
}

function writeServerConfig() {
  writeFileSync(
    join(serverDataDir, "server.cfg"),
    [
      'sv_hostname "SPBox smoke"',
      `endpoint_add_tcp "${bindAddress}:${port}"`,
      `endpoint_add_udp "${bindAddress}:${port}"`,
      "sv_maxclients 8",
      "set onesync on",
      'sets sv_projectName "SPBox smoke"',
      'sets sv_projectDesc "SPBox core runtime smoke"',
      "# sv_licenseKey supplied by scripts/run-fxserver-smoke.mjs from SDB_FIVEM_LICENSE_KEY",
      "ensure sdb_runtime",
      "ensure qb-core",
      "ensure qbx_core",
      "ensure sdb_runtime_smoke",
      "ensure sdb_qbcore_fixture",
      "ensure sdb_qbox_fixture",
      ""
    ].join("\n")
  );
}

function stageArtifact() {
  mkdirSync(artifactCacheDir, { recursive: true });
  if (existsSync(artifactCachePath)) {
    console.log(`Using cached FXServer artifact: ${artifactCachePath}`);
  } else {
    console.log(`Downloading FXServer artifact: ${artifactUrl}`);
    run("curl", ["-L", "--fail", "--silent", "--show-error", artifactUrl, "-o", artifactCachePath]);
  }
  copyFileSync(artifactCachePath, artifactPath);
}

function detectedIpv4AddressEntries() {
  const addresses = [];
  for (const [name, entries] of Object.entries(networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family === "IPv4" && !entry.internal) {
        addresses.push({ name, address: entry.address });
      }
    }
  }
  return addresses;
}

function detectedIpv4Addresses() {
  const addresses = detectedIpv4AddressEntries().map((entry) => `${entry.name}=${entry.address}`);
  return addresses.length > 0 ? addresses.join(", ") : "none";
}

function isOperatorConnectCandidate({ name }) {
  return !/^(br-|docker|veth)/.test(name);
}

function connectTargetEntries() {
  const connectTarget = `${connectHost}:${port}`;
  const connectUri = `fivem://connect/${connectTarget}`;
  const alternateConnectTargetEntries = detectedIpv4AddressEntries()
    .filter(isOperatorConnectCandidate)
    .filter(({ address }) => address !== connectHost)
    .map(({ name, address }) => ({
      label: name,
      target: `${address}:${port}`,
      uri: `fivem://connect/${address}:${port}`
    }));
  return [
    {
      label: "advertised",
      target: connectTarget,
      uri: connectUri
    },
    ...alternateConnectTargetEntries
  ];
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function writeConnectLauncher() {
  const connectTarget = `${connectHost}:${port}`;
  const connectUri = `fivem://connect/${connectTarget}`;
  const escapedConnectTarget = escapeHtml(connectTarget);
  const escapedConnectUri = escapeHtml(connectUri);
  const connectTargetCandidates = connectTargetEntries();
  const alternateConnectTargetEntries = connectTargetCandidates.filter((entry) => entry.label !== "advertised");
  const connectTargets = connectTargetCandidates.map((target, index) => ({
    ...target,
    infoStatusId: `target-info-status-${index}`,
    playerCountId: `target-player-count-${index}`
  }));
  const connectTargetRows = connectTargets.map(
    (target, index) =>
      `  <tr data-target-index="${index}"><td>${escapeHtml(target.label)}</td><td><a href="${escapeHtml(target.uri)}">${escapeHtml(target.target)}</a></td><td><code>${escapeHtml(target.uri)}</code></td><td id="${target.infoStatusId}">checking...</td><td id="${target.playerCountId}">checking...</td></tr>`
  );
  writeFileSync(
    connectLauncherPath,
    [
      "<!doctype html>",
      '<html lang="en">',
      "<head>",
      '  <meta charset="utf-8">',
      "  <title>SPBox FXServer Smoke Connect</title>",
      '  <meta name="viewport" content="width=device-width, initial-scale=1">',
      "  <style>",
      "    body { font-family: system-ui, sans-serif; max-width: 720px; margin: 48px auto; padding: 0 20px; line-height: 1.5; }",
      "    a { display: inline-block; margin: 16px 0; padding: 12px 16px; background: #166534; color: white; border-radius: 6px; text-decoration: none; }",
      "    code { background: #f3f4f6; padding: 2px 5px; border-radius: 4px; }",
      "  </style>",
      "</head>",
      "<body>",
      "  <h1>SPBox FXServer Smoke Connect</h1>",
      `  <p>Connect target: <code>${escapedConnectTarget}</code></p>`,
      `  <p><a href="${escapedConnectUri}">Open FiveM client</a></p>`,
      `  <p>Manual URI: <code>${escapedConnectUri}</code></p>`,
      ...(alternateConnectTargetEntries.length > 0
        ? [
            "  <h2>Alternate detected IPv4 connect targets</h2>",
            "  <ul>",
            ...alternateConnectTargetEntries.map(
              ({ label, target, uri }) =>
                `  <li><a href="${escapeHtml(uri)}">${escapeHtml(`${label}: ${target}`)}</a> <code>${escapeHtml(uri)}</code></li>`
            ),
            "  </ul>"
          ]
        : []),
      "  <h2>Reachability by connect target</h2>",
      "  <table>",
      "    <thead><tr><th>Source</th><th>Target</th><th>FiveM URI</th><th>/info.json</th><th>/players.json</th></tr></thead>",
      "    <tbody>",
      ...connectTargetRows,
      "    </tbody>",
      "  </table>",
      '  <p>FXServer endpoint: <a id="info-link">/info.json</a></p>',
      '  <p>Players endpoint: <a id="players-link">/players.json</a></p>',
      '  <p>Endpoint status: <strong id="endpoint-status">checking...</strong></p>',
      '  <p>Players observed by this browser: <strong id="player-count">checking...</strong></p>',
      `  <p>Smoke run id: <code>${smokeRunId}</code></p>`,
      `  <p>Connection details: <code>${escapeHtml(connectInfoPath)}</code></p>`,
      "  <script>",
      `    const connectTarget = ${JSON.stringify(connectTarget)};`,
      "    const infoUrl = `http://${connectTarget}/info.json`;",
      "    const playersUrl = `http://${connectTarget}/players.json`;",
      `    const connectTargets = ${JSON.stringify(connectTargets)};`,
      "    document.getElementById('info-link').href = infoUrl;",
      "    document.getElementById('players-link').href = playersUrl;",
      "    async function refreshStatus() {",
      "      try {",
      "        const info = await fetch(infoUrl, { cache: 'no-store' });",
      "        document.getElementById('endpoint-status').textContent = `HTTP ${info.status}`;",
      "      } catch (error) {",
      "        document.getElementById('endpoint-status').textContent = String(error.message || error);",
      "      }",
      "      try {",
      "        const playersResponse = await fetch(playersUrl, { cache: 'no-store' });",
      "        const players = await playersResponse.json();",
      "        document.getElementById('player-count').textContent = Array.isArray(players) ? String(players.length) : 'unparseable';",
      "      } catch (error) {",
      "        document.getElementById('player-count').textContent = String(error.message || error);",
      "      }",
      "      for (const target of connectTargets) {",
      "        const targetInfoUrl = `http://${target.target}/info.json`;",
      "        const targetPlayersUrl = `http://${target.target}/players.json`;",
      "        try {",
      "          const targetInfo = await fetch(targetInfoUrl, { cache: 'no-store' });",
      "          document.getElementById(target.infoStatusId).textContent = `HTTP ${targetInfo.status}`;",
      "        } catch (error) {",
      "          document.getElementById(target.infoStatusId).textContent = String(error.message || error);",
      "        }",
      "        try {",
      "          const targetPlayersResponse = await fetch(targetPlayersUrl, { cache: 'no-store' });",
      "          const targetPlayers = await targetPlayersResponse.json();",
      "          document.getElementById(target.playerCountId).textContent = Array.isArray(targetPlayers) ? String(targetPlayers.length) : 'unparseable';",
      "        } catch (error) {",
      "          document.getElementById(target.playerCountId).textContent = String(error.message || error);",
      "        }",
      "      }",
      "    }",
      "    refreshStatus();",
      "    setInterval(refreshStatus, 5000);",
      "  </script>",
      "</body>",
      "</html>",
      ""
    ].join("\n")
  );
}

function writeConnectInfo() {
  const connectTarget = `${connectHost}:${port}`;
  const connectUri = `fivem://connect/${connectTarget}`;
  const alternateConnectUris = connectTargetEntries()
    .filter((entry) => entry.label !== "advertised")
    .map((entry) => `${entry.label}=${entry.uri}`);
  writeFileSync(
    connectInfoPath,
    [
      `FiveM connect target: ${connectTarget}`,
      `Smoke run id: ${smokeRunId}`,
      `FiveM connect URI: ${connectUri}`,
      `Alternate FiveM connect URIs: ${alternateConnectUris.length > 0 ? alternateConnectUris.join(", ") : "none"}`,
      `Detected IPv4 addresses: ${detectedIpv4Addresses()}`,
      `Bind address: ${bindAddress}`,
      `Advertised connect host: ${connectHost}`,
      `Port: ${port}`,
      `Client checks required: ${requireClient ? "yes" : "no"}`,
      `Smoke timeout ms: ${timeoutMs}`,
      `Collection window ms: ${collectMs}`,
      `Client grace window ms: ${clientGraceMs}`,
      `Effective timeout ms: ${effectiveTimeoutMs}`,
      `Transcript path: ${logPath}`,
      `Network probe path: ${networkProbePath}`,
      `Socket probe path: ${socketProbePath}`,
      `Player probe path: ${playerProbePath}`,
      `Verification output path: ${verificationOutputPath}`,
      `Client launcher path: ${connectLauncherPath}`,
      `Server-side readiness verifier: npm run verify:production-readiness -- --fxserver-log ${logPath} --fxserver-connect-info ${connectInfoPath} --fxserver-network-probe ${networkProbePath} --fxserver-socket-probe ${socketProbePath} --fxserver-player-probe ${playerProbePath} --fxserver-verification-output ${verificationOutputPath} --require-qbcore --require-qbox`,
      `Client-required verifier: npm run verify:production-readiness -- --fxserver-log ${logPath} --fxserver-connect-info ${connectInfoPath} --fxserver-network-probe ${networkProbePath} --fxserver-socket-probe ${socketProbePath} --fxserver-player-probe ${playerProbePath} --fxserver-verification-output ${verificationOutputPath} --require-qbcore --require-qbox --require-client`,
      "",
      "If the bind address is 0.0.0.0, set SDB_FXSERVER_CONNECT_HOST to this machine's reachable LAN or public IP.",
      "The runner exits early once all required smoke checks appear.",
      ""
    ].join("\n")
  );
}

function preflight() {
  if (isBlank(artifactUrl)) {
    fail("SDB_FXSERVER_ARTIFACT_URL must be a non-empty value.");
  }
  if (isBlank(bindAddress)) {
    fail("SDB_FXSERVER_BIND_ADDRESS must be a non-empty value.");
  }
  if (isBlank(connectHost)) {
    fail("SDB_FXSERVER_CONNECT_HOST must be a non-empty value.");
  }
  if (!isValidPort(port)) {
    fail("SDB_FXSERVER_PORT must be an integer between 1 and 65535.");
  }
  if (!isPositiveFiniteNumber(timeoutMs)) {
    fail("SDB_FXSERVER_SMOKE_TIMEOUT_MS must be a positive finite number.");
  }
  if (!isPositiveFiniteNumber(collectMs)) {
    fail("SDB_FXSERVER_SMOKE_COLLECT_MS must be a positive finite number.");
  }
  if (!isNonNegativeFiniteNumber(clientGraceMs)) {
    fail("SDB_FXSERVER_CLIENT_GRACE_MS must be a non-negative finite number.");
  }
  if (requireClient && isUnresolvedConnectHost(connectHost)) {
    fail(
      "FXServer client-required smoke needs a concrete connect host, not unresolved <server-ip>. Set SDB_FXSERVER_CONNECT_HOST to this machine's reachable LAN, VPN, or public IP."
    );
  }
  if (prepareOnly) {
    return;
  }
  if (!licenseKey) {
    fail("SDB_FIVEM_LICENSE_KEY is required to run FXServer smoke. Use --prepare-only to stage files without a key.");
  }
}

function prepare() {
  safeResetWorkdir(workdir);
  mkdirSync(fxDir, { recursive: true });
  mkdirSync(serverDataDir, { recursive: true });

  stageArtifact();
  run("tar", ["-xJf", artifactPath, "-C", fxDir]);

  for (const [source, target] of resourceCopies) {
    copyResource(source, target);
  }

  writeServerConfig();
  writeConnectLauncher();
  writeConnectInfo();
  console.log(`Prepared FXServer smoke workdir: ${workdir}`);
  console.log(`Transcript path: ${logPath}`);
  console.log(`Connect info path: ${connectInfoPath}`);
  console.log(`Client launcher path: ${connectLauncherPath}`);
}

function runFxServer() {
  const runScript = join(fxDir, "run.sh");
  if (!existsSync(runScript)) {
    fail(`Missing FXServer run script: ${runScript}`);
  }

  if (requireClient) {
    const alternateConnectUris = connectTargetEntries().filter((entry) => entry.label !== "advertised");
    console.log(`Connect a FiveM client to ${connectHost}:${port} before the smoke timeout expires.`);
    console.log(`FiveM connect URI: fivem://connect/${connectHost}:${port}`);
    for (const target of alternateConnectUris) {
      console.log(`Alternate FiveM connect URI (${target.label}): ${target.uri}`);
    }
    console.log(`FiveM connect target: ${connectHost}:${port}`);
    console.log(`Connection details: ${connectInfoPath}`);
    console.log(`Client launcher path: ${connectLauncherPath}`);
    if (bindAddress === "127.0.0.1" || bindAddress === "localhost") {
      console.log("For a remote client, rerun with SDB_FXSERVER_BIND_ADDRESS=0.0.0.0 and an open firewall port.");
    } else if (connectHost === "<server-ip>") {
      console.log("Set SDB_FXSERVER_CONNECT_HOST to this machine's reachable LAN or public IP for a concrete connect target.");
    }
  }

  return new Promise((resolveRun, rejectRun) => {
    let output = "";
    let sentSmokeCommands = false;
    let requestedQuit = false;
    let settled = false;
    let smokeError;
    let collectTimer;
    let timeout;
    let clientWaitReminderTimer;
    let periodicPlayerProbeTimer;

    const child = spawn(runScript, ["+set", "sv_licenseKey", licenseKey, "+exec", join(serverDataDir, "server.cfg")], {
      cwd: serverDataDir,
      stdio: ["pipe", "pipe", "pipe"]
    });

    if (requireClient) {
      clientWaitReminderTimer = setInterval(() => {
        if (!requestedQuit) {
          console.log(`Still waiting for FiveM client at fivem://connect/${connectHost}:${port}`);
          for (const target of connectTargetEntries().filter((entry) => entry.label !== "advertised")) {
            console.log(`Still waiting for FiveM client; alternate URI (${target.label}): ${target.uri}`);
          }
        }
      }, 30000);
    }

    function append(chunk) {
      output += chunk.toString();
      if (!sentSmokeCommands && output.includes("Started resource sdb_qbox_fixture")) {
        sentSmokeCommands = true;
        setTimeout(async () => {
          const networkProbeOk = await probeFxServerNetwork();
          const socketProbeOk = probeFxServerSockets();
          await probeFxServerPlayers("after resource start");
          periodicPlayerProbeTimer = setInterval(() => {
            void probeFxServerPlayers("periodic sample");
          }, 10000);
          if (requireNetworkProbe && !networkProbeOk) {
            smokeError = new Error(`FXServer network probe failed. See ${networkProbePath}`);
            requestedQuit = true;
            child.stdin.write("quit\n");
            child.stdin.end();
            return;
          }
          if (requireSocketProbe && !socketProbeOk) {
            smokeError = new Error(`FXServer socket probe failed. See ${socketProbePath}`);
            requestedQuit = true;
            child.stdin.write("quit\n");
            child.stdin.end();
            return;
          }
          child.stdin.write("sdb_runtime_smoke\n");
          child.stdin.write("sdb_qbcore_fixture\n");
          child.stdin.write("sdb_qbox_fixture\n");
        }, 1000);
        console.log(`Waiting up to ${collectMs}ms for FXServer smoke output${requireClient ? " and client checks" : ""}.`);
        collectTimer = setTimeout(() => {
          if (requireClient && clientGraceMs > 0 && maxObservedPlayerCount() === 0) {
            console.log(
              `No players observed during the collection window; extending client wait by ${clientGraceMs}ms.`
            );
            collectTimer = setTimeout(() => {
              requestedQuit = true;
              child.stdin.write("quit\n");
              child.stdin.end();
            }, clientGraceMs);
            return;
          }
          requestedQuit = true;
          child.stdin.write("quit\n");
          child.stdin.end();
        }, collectMs);
      }

      if (!requestedQuit && sentSmokeCommands && allRequiredSmokeChecksPassed(output)) {
        console.log("All required smoke checks appeared; stopping FXServer.");
        requestedQuit = true;
        void probeFxServerPlayers("all checks passed");
        child.stdin.write("quit\n");
        child.stdin.end();
      }
    }

    function finish(error) {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      clearTimeout(collectTimer);
      clearInterval(clientWaitReminderTimer);
      clearInterval(periodicPlayerProbeTimer);
      writeFileSync(logPath, `Smoke run id: ${smokeRunId}\n${output}`);
      if (!error && smokeError) {
        rejectRun(smokeError);
        return;
      }
      if (error) {
        rejectRun(error);
        return;
      }
      console.log(`Captured FXServer smoke transcript: ${logPath}`);
      resolveRun();
    }

    child.stdout.on("data", append);
    child.stderr.on("data", append);
    child.on("error", finish);
    child.on("exit", (code, signal) => {
      if (requestedQuit || code === 0 || signal === "SIGTERM") {
        finish();
        return;
      }
      finish(new Error(`FXServer exited before smoke collection completed with status ${code}. Transcript: ${logPath}`));
    });

    timeout = setTimeout(() => {
      requestedQuit = true;
      child.kill("SIGTERM");
    }, effectiveTimeoutMs);
  });
}

preflight();
prepare();

if (prepareOnly) {
  process.exit(0);
}

await runFxServer();

if (!noVerify) {
  const runVerifier = (label, extraArgs = []) => {
    const verifyArgs = [
      "scripts/verify-fxserver-smoke-log.mjs",
      logPath,
      "--require-qbcore",
      "--require-qbox",
      ...extraArgs
    ];
    const result = spawnSync("node", verifyArgs, {
      encoding: "utf8"
    });
    return {
      label,
      result,
      output: `${label}\n${result.stdout || ""}${result.stderr || ""}`
    };
  };

  const results = [runVerifier("Server-side FXServer smoke verifier:")];
  if (requireClient) {
    results.push(runVerifier("Client-required FXServer smoke verifier:", ["--require-client"]));
  }
  const verificationOutput = [`Smoke run id: ${smokeRunId}`, results.map((entry) => entry.output).join("\n")].join("\n");
  writeFileSync(verificationOutputPath, verificationOutput);
  console.log(`Verification output path: ${verificationOutputPath}`);
  for (const { result } of results) {
    if (result.stdout) {
      process.stdout.write(result.stdout);
    }
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }
    if (result.error) {
      throw result.error;
    }
    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }
  }
}
