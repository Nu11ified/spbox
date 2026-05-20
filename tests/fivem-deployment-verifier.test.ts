import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json") as {
  scripts: Record<string, string>;
};

describe("FiveM deployment verifier", () => {
  it("fails client-required smoke preflight before staging when the connect host is unresolved", () => {
    const workdir = "/tmp/spbox-fxserver-smoke-preflight-check";
    rmSync(workdir, { recursive: true, force: true });

    expect(() =>
      execFileSync(
        "node",
        [
          "scripts/run-fxserver-smoke.mjs",
          "--workdir",
          workdir,
          "--bind-address",
          "0.0.0.0",
          "--timeout-ms",
          "1000"
        ],
        {
          cwd: process.cwd(),
          encoding: "utf8",
          env: {
            ...process.env,
            SDB_FIVEM_LICENSE_KEY: "test-license-key"
          }
        }
      )
    ).toThrow(/FXServer client-required smoke needs a concrete connect host/);
    expect(existsSync(workdir)).toBe(false);
  });

  it("fails smoke preflight before staging when the license key is missing", () => {
    const workdir = "/tmp/spbox-fxserver-smoke-license-preflight-check";
    rmSync(workdir, { recursive: true, force: true });

    expect(() =>
      execFileSync(
        "node",
        [
          "scripts/run-fxserver-smoke.mjs",
          "--workdir",
          workdir,
          "--no-require-client",
          "--timeout-ms",
          "1000"
        ],
        {
          cwd: process.cwd(),
          encoding: "utf8",
          env: {
            ...process.env,
            SDB_FIVEM_LICENSE_KEY: ""
          }
        }
      )
    ).toThrow(/SDB_FIVEM_LICENSE_KEY is required to run FXServer smoke/);
    expect(existsSync(workdir)).toBe(false);
  });

  it("fails smoke preflight before staging when the port is invalid", () => {
    const workdir = "/tmp/spbox-fxserver-smoke-port-preflight-check";
    rmSync(workdir, { recursive: true, force: true });

    expect(() =>
      execFileSync(
        "node",
        [
          "scripts/run-fxserver-smoke.mjs",
          "--workdir",
          workdir,
          "--no-require-client",
          "--port",
          "not-a-port"
        ],
        {
          cwd: process.cwd(),
          encoding: "utf8",
          env: {
            ...process.env,
            SDB_FIVEM_LICENSE_KEY: "test-license-key"
          }
        }
      )
    ).toThrow(/SDB_FXSERVER_PORT must be an integer between 1 and 65535/);
    expect(existsSync(workdir)).toBe(false);
  });

  it("fails smoke preflight before staging when the bind address is blank", () => {
    const workdir = "/tmp/spbox-fxserver-smoke-bind-preflight-check";
    rmSync(workdir, { recursive: true, force: true });

    expect(() =>
      execFileSync(
        "node",
        [
          "scripts/run-fxserver-smoke.mjs",
          "--workdir",
          workdir,
          "--no-require-client",
          "--bind-address",
          ""
        ],
        {
          cwd: process.cwd(),
          encoding: "utf8",
          env: {
            ...process.env,
            SDB_FIVEM_LICENSE_KEY: "test-license-key"
          }
        }
      )
    ).toThrow(/SDB_FXSERVER_BIND_ADDRESS must be a non-empty value/);
    expect(existsSync(workdir)).toBe(false);
  });

  it("fails smoke preflight before staging when the connect host is blank", () => {
    const workdir = "/tmp/spbox-fxserver-smoke-connect-host-blank-preflight-check";
    rmSync(workdir, { recursive: true, force: true });

    expect(() =>
      execFileSync(
        "node",
        [
          "scripts/run-fxserver-smoke.mjs",
          "--workdir",
          workdir,
          "--no-require-client",
          "--connect-host",
          ""
        ],
        {
          cwd: process.cwd(),
          encoding: "utf8",
          env: {
            ...process.env,
            SDB_FIVEM_LICENSE_KEY: "test-license-key"
          }
        }
      )
    ).toThrow(/SDB_FXSERVER_CONNECT_HOST must be a non-empty value/);
    expect(existsSync(workdir)).toBe(false);
  });

  it("fails smoke preflight before staging when bind or connect host is whitespace", () => {
    const bindWorkdir = "/tmp/spbox-fxserver-smoke-bind-whitespace-preflight-check";
    rmSync(bindWorkdir, { recursive: true, force: true });

    expect(() =>
      execFileSync(
        "node",
        [
          "scripts/run-fxserver-smoke.mjs",
          "--workdir",
          bindWorkdir,
          "--no-require-client",
          "--bind-address",
          "   "
        ],
        {
          cwd: process.cwd(),
          encoding: "utf8",
          env: {
            ...process.env,
            SDB_FIVEM_LICENSE_KEY: "test-license-key"
          }
        }
      )
    ).toThrow(/SDB_FXSERVER_BIND_ADDRESS must be a non-empty value/);
    expect(existsSync(bindWorkdir)).toBe(false);

    const connectWorkdir = "/tmp/spbox-fxserver-smoke-connect-host-whitespace-preflight-check";
    rmSync(connectWorkdir, { recursive: true, force: true });

    expect(() =>
      execFileSync(
        "node",
        [
          "scripts/run-fxserver-smoke.mjs",
          "--workdir",
          connectWorkdir,
          "--no-require-client",
          "--connect-host",
          "   "
        ],
        {
          cwd: process.cwd(),
          encoding: "utf8",
          env: {
            ...process.env,
            SDB_FIVEM_LICENSE_KEY: "test-license-key"
          }
        }
      )
    ).toThrow(/SDB_FXSERVER_CONNECT_HOST must be a non-empty value/);
    expect(existsSync(connectWorkdir)).toBe(false);
  });

  it("fails prepare-only preflight before staging when the artifact URL is blank", () => {
    const workdir = "/tmp/spbox-fxserver-smoke-artifact-url-preflight-check";
    rmSync(workdir, { recursive: true, force: true });

    expect(() =>
      execFileSync(
        "node",
        [
          "scripts/run-fxserver-smoke.mjs",
          "--prepare-only",
          "--workdir",
          workdir,
          "--artifact-url",
          "   "
        ],
        {
          cwd: process.cwd(),
          encoding: "utf8",
          env: {
            ...process.env,
            SDB_FIVEM_LICENSE_KEY: ""
          }
        }
      )
    ).toThrow(/SDB_FXSERVER_ARTIFACT_URL must be a non-empty value/);
    expect(existsSync(workdir)).toBe(false);

    const missingValueWorkdir = "/tmp/spbox-fxserver-smoke-artifact-url-missing-value-preflight-check";
    rmSync(missingValueWorkdir, { recursive: true, force: true });

    expect(() =>
      execFileSync(
        "node",
        [
          "scripts/run-fxserver-smoke.mjs",
          "--prepare-only",
          "--workdir",
          missingValueWorkdir,
          "--artifact-url"
        ],
        {
          cwd: process.cwd(),
          encoding: "utf8",
          env: {
            ...process.env,
            SDB_FIVEM_LICENSE_KEY: ""
          }
        }
      )
    ).toThrow(/SDB_FXSERVER_ARTIFACT_URL must be a non-empty value/);
    expect(existsSync(missingValueWorkdir)).toBe(false);
  });

  it("fails smoke preflight before staging when timing options are invalid", () => {
    const workdir = "/tmp/spbox-fxserver-smoke-timing-preflight-check";
    rmSync(workdir, { recursive: true, force: true });

    expect(() =>
      execFileSync(
        "node",
        [
          "scripts/run-fxserver-smoke.mjs",
          "--workdir",
          workdir,
          "--no-require-client",
          "--timeout-ms",
          "not-a-timeout"
        ],
        {
          cwd: process.cwd(),
          encoding: "utf8",
          env: {
            ...process.env,
            SDB_FIVEM_LICENSE_KEY: "test-license-key"
          }
        }
      )
    ).toThrow(/SDB_FXSERVER_SMOKE_TIMEOUT_MS must be a positive finite number/);
    expect(existsSync(workdir)).toBe(false);
  });

  it("fails smoke preflight before staging when collection or grace timing is invalid", () => {
    const collectWorkdir = "/tmp/spbox-fxserver-smoke-collect-preflight-check";
    rmSync(collectWorkdir, { recursive: true, force: true });

    expect(() =>
      execFileSync(
        "node",
        [
          "scripts/run-fxserver-smoke.mjs",
          "--workdir",
          collectWorkdir,
          "--no-require-client",
          "--collect-ms",
          "0"
        ],
        {
          cwd: process.cwd(),
          encoding: "utf8",
          env: {
            ...process.env,
            SDB_FIVEM_LICENSE_KEY: "test-license-key"
          }
        }
      )
    ).toThrow(/SDB_FXSERVER_SMOKE_COLLECT_MS must be a positive finite number/);
    expect(existsSync(collectWorkdir)).toBe(false);

    const graceWorkdir = "/tmp/spbox-fxserver-smoke-grace-preflight-check";
    rmSync(graceWorkdir, { recursive: true, force: true });

    expect(() =>
      execFileSync(
        "node",
        [
          "scripts/run-fxserver-smoke.mjs",
          "--workdir",
          graceWorkdir,
          "--bind-address",
          "127.0.0.1",
          "--client-grace-ms",
          "-1"
        ],
        {
          cwd: process.cwd(),
          encoding: "utf8",
          env: {
            ...process.env,
            SDB_FIVEM_LICENSE_KEY: "test-license-key"
          }
        }
      )
    ).toThrow(/SDB_FXSERVER_CLIENT_GRACE_MS must be a non-negative finite number/);
    expect(existsSync(graceWorkdir)).toBe(false);
  });

  it("fails prepare-only preflight before staging invalid generated evidence", () => {
    const portWorkdir = "/tmp/spbox-fxserver-smoke-prepare-port-preflight-check";
    rmSync(portWorkdir, { recursive: true, force: true });

    expect(() =>
      execFileSync(
        "node",
        [
          "scripts/run-fxserver-smoke.mjs",
          "--prepare-only",
          "--workdir",
          portWorkdir,
          "--port",
          "not-a-port"
        ],
        {
          cwd: process.cwd(),
          encoding: "utf8",
          env: {
            ...process.env,
            SDB_FIVEM_LICENSE_KEY: ""
          }
        }
      )
    ).toThrow(/SDB_FXSERVER_PORT must be an integer between 1 and 65535/);
    expect(existsSync(portWorkdir)).toBe(false);

    const timingWorkdir = "/tmp/spbox-fxserver-smoke-prepare-timing-preflight-check";
    rmSync(timingWorkdir, { recursive: true, force: true });

    expect(() =>
      execFileSync(
        "node",
        [
          "scripts/run-fxserver-smoke.mjs",
          "--prepare-only",
          "--workdir",
          timingWorkdir,
          "--collect-ms",
          "NaN"
        ],
        {
          cwd: process.cwd(),
          encoding: "utf8",
          env: {
            ...process.env,
            SDB_FIVEM_LICENSE_KEY: ""
          }
        }
      )
    ).toThrow(/SDB_FXSERVER_SMOKE_COLLECT_MS must be a positive finite number/);
    expect(existsSync(timingWorkdir)).toBe(false);
  });

  it("fails prepare-only client-required preflight before staging unresolved connect evidence", () => {
    const workdir = "/tmp/spbox-fxserver-smoke-prepare-connect-host-preflight-check";
    rmSync(workdir, { recursive: true, force: true });

    expect(() =>
      execFileSync(
        "node",
        [
          "scripts/run-fxserver-smoke.mjs",
          "--prepare-only",
          "--workdir",
          workdir,
          "--bind-address",
          "0.0.0.0"
        ],
        {
          cwd: process.cwd(),
          encoding: "utf8",
          env: {
            ...process.env,
            SDB_FIVEM_LICENSE_KEY: ""
          }
        }
      )
    ).toThrow(/FXServer client-required smoke needs a concrete connect host/);
    expect(existsSync(workdir)).toBe(false);
  });

  it("exposes a runnable deployment verification command and checklist docs", () => {
    const verifier = readFileSync("scripts/verify-fivem-deployment.mjs", "utf8");
    const runner = readFileSync("scripts/run-fxserver-smoke.mjs", "utf8");
    const checklist = readFileSync("docs/fivem-deployment-checklist.md", "utf8");
    const runbook = readFileSync("docs/production-runbook.md", "utf8");

    expect(packageJson.scripts["verify:fivem-deployment"]).toBe(
      "node scripts/verify-fivem-deployment.mjs"
    );
    expect(packageJson.scripts["smoke:fxserver-core"]).toBe("node scripts/run-fxserver-smoke.mjs");
    expect(verifier).toContain("resources/[runtime]/sdb_runtime/fxmanifest.lua");
    expect(verifier).toContain("resources/[compat]/qb-core/fxmanifest.lua");
    expect(verifier).toContain("resources/[compat]/qbx_core/fxmanifest.lua");
    expect(verifier).toContain("resources/[test]/sdb_runtime_smoke/fxmanifest.lua");
    expect(verifier).toContain("resources/[test]/sdb_qbcore_fixture/fxmanifest.lua");
    expect(verifier).toContain("resources/[test]/sdb_qbox_fixture/fxmanifest.lua");
    expect(verifier).toContain("sdb_runtime_smoke");
    expect(verifier).toContain("trusted sync event");
    expect(runner).toContain("SDB_FIVEM_LICENSE_KEY");
    expect(runner).toContain("Use --prepare-only to stage files without a key");
    expect(runner).toContain("+set");
    expect(runner).toContain("sv_licenseKey");
    expect(runner).toContain("# sv_licenseKey supplied by scripts/run-fxserver-smoke.mjs");
    expect(runner).toContain("SDB_FXSERVER_SMOKE_COLLECT_MS");
    expect(runner).toContain("SDB_FXSERVER_SMOKE_COLLECT_MS must be a positive finite number");
    expect(runner).toContain("SDB_FXSERVER_CLIENT_GRACE_MS");
    expect(runner).toContain("SDB_FXSERVER_CLIENT_GRACE_MS must be a non-negative finite number");
    expect(runner).toContain("SDB_FXSERVER_SMOKE_TIMEOUT_MS must be a positive finite number");
    expect(runner).toContain("SDB_FXSERVER_BIND_ADDRESS");
    expect(runner).toContain("SDB_FXSERVER_BIND_ADDRESS must be a non-empty value");
    expect(runner).toContain("function isBlank");
    expect(runner).toContain("SDB_FXSERVER_PORT");
    expect(runner).toContain("SDB_FXSERVER_PORT must be an integer between 1 and 65535");
    expect(runner).toContain("function isValidPort");
    expect(runner).toContain("SDB_FXSERVER_CONNECT_HOST");
    expect(runner).toContain("SDB_FXSERVER_CONNECT_HOST must be a non-empty value");
    expect(runner).toContain("SDB_FXSERVER_ARTIFACT_URL");
    expect(runner).toContain("SDB_FXSERVER_ARTIFACT_URL must be a non-empty value");
    expect(runner).toContain("SDB_FXSERVER_ARTIFACT_CACHE_DIR");
    expect(runner).toContain("--artifact-cache-dir");
    expect(runner).toContain("Using cached FXServer artifact");
    expect(runner).toContain("function preflight()");
    expect(runner).toContain("if (prepareOnly)");
    expect(runner).toContain("preflight();");
    expect(runner).toContain("randomUUID");
    expect(runner).toContain("Smoke run id:");
    expect(runner).toContain("writeFileSync(logPath, `Smoke run id:");
    expect(runner).toContain("--connect-host");
    expect(runner).toContain("--client-grace-ms");
    expect(runner).toContain("Connect a FiveM client");
    expect(runner).toContain("Still waiting for FiveM client");
    expect(runner).toContain("clientWaitReminderTimer");
    expect(runner).toContain("connect-info.txt");
    expect(runner).toContain("connect-launcher.html");
    expect(runner).toContain("Client launcher path:");
    expect(runner).toContain("fivem://connect/${connectTarget}");
    expect(runner).toContain('<a href="${escapedConnectUri}"');
    expect(runner).toContain("const infoUrl = `http://${connectTarget}/info.json`");
    expect(runner).toContain("const playersUrl = `http://${connectTarget}/players.json`");
    expect(runner).toContain("const connectTargets =");
    expect(runner).toContain("data-target-index");
    expect(runner).toContain("target.infoStatusId");
    expect(runner).toContain("target.playerCountId");
    expect(runner).toContain("fetch(infoUrl");
    expect(runner).toContain("fetch(playersUrl");
    expect(runner).toContain("players.length");
    expect(runner).toContain("fxserver-network-probe.txt");
    expect(runner).toContain("fxserver-socket-probe.txt");
    expect(runner).toContain("fxserver-player-probe.txt");
    expect(runner).toContain("fxserver-smoke-verification.txt");
    expect(runner).toContain("Verification output path:");
    expect(runner).toContain("Server-side FXServer smoke verifier:");
    expect(runner).toContain("Client-required FXServer smoke verifier:");
    expect(runner).toContain("probeFxServerNetwork");
    expect(runner).toContain("probeFxServerSockets");
    expect(runner).toContain("probeFxServerPlayers");
    expect(runner).toContain("/info.json");
    expect(runner).toContain("/players.json");
    expect(runner).toContain("TCP listen confirmed:");
    expect(runner).toContain("UDP listen confirmed:");
    expect(runner).toContain("Player count observed:");
    expect(runner).toContain("Max player count observed:");
    expect(runner).toContain("Player samples observed:");
    expect(runner).toContain("Advertised probe target:");
    expect(runner).toContain("Alternate probe target");
    expect(runner).toContain("target=alternate-");
    expect(runner).toContain("advertised: HTTP 200 players=");
    expect(runner).toContain("target=advertised");
    expect(runner).toContain("playerProbeSamples");
    expect(runner).toContain("periodicPlayerProbeTimer");
    expect(runner).toContain("maxObservedPlayerCount");
    expect(runner).toContain("No players observed during the collection window");
    expect(runner).toContain("Client grace window ms:");
    expect(runner).toContain("Effective timeout ms:");
    expect(runner).toContain("effectiveTimeoutMs");
    expect(runner).toContain("startupTimeoutBufferMs");
    expect(runner).toContain("SDB_FXSERVER_REQUIRE_NETWORK_PROBE");
    expect(runner).toContain("SDB_FXSERVER_REQUIRE_SOCKET_PROBE");
    expect(runner).toContain("--no-require-network-probe");
    expect(runner).toContain("--no-require-socket-probe");
    expect(runner).toContain("FXServer network probe failed");
    expect(runner).toContain("FXServer socket probe failed");
    expect(runner).toContain("FiveM connect target:");
    expect(runner).toContain("FXServer client-required smoke needs a concrete connect host, not unresolved <server-ip>");
    expect(runner).toContain("FiveM connect URI:");
    expect(runner).toContain("Detected IPv4 addresses:");
    expect(runner).toContain("networkInterfaces");
    expect(runner).toContain("detectedIpv4AddressEntries");
    expect(runner).toContain("isOperatorConnectCandidate");
    expect(runner).toContain("Alternate detected IPv4 connect targets");
    expect(runner).toContain("Alternate FiveM connect URI");
    expect(runner).toContain("Alternate FiveM connect URIs:");
    expect(runner).toContain("Still waiting for FiveM client; alternate URI");
    expect(runner).toContain("fivem://connect/${address}:${port}");
    expect(runner).toContain("Client-required verifier:");
    expect(runner).toContain("Server-side readiness verifier:");
    expect(runner).toContain("--fxserver-network-probe");
    expect(runner).toContain("--fxserver-socket-probe");
    expect(runner).toContain("--fxserver-player-probe");
    expect(runner).toContain("fivem://connect/");
    expect(runner).toContain("requireClient ? timeoutMs : 15000");
    expect(runner).toContain("Waiting up to");
    expect(runner).toContain("allRequiredSmokeChecksPassed");
    expect(runner).toContain("client:sdb_runtime_smoke:loaded");
    expect(runner).toContain("All required smoke checks appeared");
    expect(runner).toContain("resources/[runtime]/sdb_runtime");
    expect(runner).toContain("resources/[compat]/qb-core");
    expect(runner).toContain("resources/[compat]/qbx_core");
    expect(runner).toContain("resources/[test]/sdb_runtime_smoke");
    expect(runner).toContain("resources/[test]/sdb_qbcore_fixture");
    expect(runner).toContain("resources/[test]/sdb_qbox_fixture");
    expect(runner).toContain("scripts/verify-fxserver-smoke-log.mjs");
    expect(runner).toContain("--require-qbcore");
    expect(runner).toContain("--require-qbox");
    expect(verifier).toContain("AddEventHandler('playerConnecting'");
    expect(verifier).toContain("AddEventHandler('playerJoining'");
    expect(verifier).toContain("sdb_runtime_smoke] INFO playerConnecting");
    expect(verifier).toContain("sdb_runtime_smoke] INFO playerJoining");
    expect(verifier).toContain("sdb_runtime_smoke:loaded");
    expect(verifier).toContain("TriggerClientEvent('sdb_qbcore_fixture:run'");
    expect(verifier).toContain("TriggerClientEvent('sdb_qbox_fixture:run'");
    expect(checklist).toContain("ensure sdb_runtime");
    expect(checklist).toContain("ensure qb-core");
    expect(checklist).toContain("ensure qbx_core");
    expect(checklist).toContain("ensure sdb_runtime_smoke");
    expect(checklist).toContain("sdb_qbcore_fixture");
    expect(checklist).toContain("sdb_qbox_fixture");
    expect(checklist).toContain("npm run verify:fxserver-smoke-log");
    expect(checklist).toContain("SDB_FIVEM_SYNC_ENABLED");
    expect(checklist).toContain("SDB_FXSERVER_CLIENT_GRACE_MS");
    expect(checklist).toContain("sdb_runtime_emit");
    expect(runbook).toContain("npm run verify:fivem-deployment");
    expect(runbook).toContain("npm run smoke:fxserver-core");
    expect(runbook).toContain("SDB_FXSERVER_CLIENT_GRACE_MS");
    expect(runbook).toContain("npm run verify:fxserver-smoke-log");
    expect(runbook).toContain("ensure qbx_core");
    expect(runbook).toContain("ensure sdb_qbcore_fixture");
    expect(runbook).toContain("ensure sdb_qbox_fixture");
    expect(runbook).toContain("[FiveM Deployment Checklist](./fivem-deployment-checklist.md)");
  });
});
