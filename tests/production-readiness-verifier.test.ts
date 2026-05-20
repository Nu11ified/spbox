import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json") as {
  scripts: Record<string, string>;
};
const smokeRunId = "00000000-0000-4000-8000-000000000001";

function fixturePath(name: string): string {
  const dir = join(tmpdir(), "spbox-production-readiness-tests");
  mkdirSync(dir, { recursive: true });
  return join(dir, name);
}

function writeFixture(name: string, content: string): string {
  const path = fixturePath(name);
  writeFileSync(path, content);
  return path;
}

function writeProvenance(status: "scaffold" | "official"): string {
  return writeFixture(
    `${status}-provenance.json`,
    `${JSON.stringify(
      {
        status,
        generator: "spacetime generate",
        command:
          "spacetime generate --lang typescript --module-path spacetimedb --out-dir src/spacetime/module_bindings",
        modulePath: "spacetimedb",
        outDir: "src/spacetime/module_bindings",
        generatedAt: status === "official" ? "2026-05-19T00:00:00.000Z" : null,
        cliVersion: status === "official" ? "spacetime 1.0.0" : null
      },
      null,
      2
    )}\n`
  );
}

function writeSmokeLog(): string {
  return writeFixture(
    "synthetic-fxserver-smoke-fixture.log",
    `
Smoke run id: ${smokeRunId}
Creating script environments for sdb_runtime
Started resource sdb_runtime
Creating script environments for qb-core
Started resource qb-core
Creating script environments for qbx_core
Started resource qbx_core
Creating script environments for sdb_runtime_smoke
Started resource sdb_runtime_smoke
Creating script environments for sdb_qbcore_fixture
Started resource sdb_qbcore_fixture
Creating script environments for sdb_qbox_fixture
Started resource sdb_qbox_fixture
[sdb_runtime_smoke] INFO playerConnecting: smoke-client
[sdb_runtime_smoke] INFO playerJoining: 1
[sdb_runtime_smoke] PASS sdb_runtime:GetHealth
[sdb_runtime_smoke] PASS sdb_runtime:GetConfig
[sdb_runtime_smoke] PASS sdb_runtime:HasPermission
[sdb_runtime_smoke] PASS sdb_runtime:GetQbShared
[sdb_runtime_smoke] PASS qb-core:GetCoreObject
[sdb_runtime_smoke] PASS fixture:qbcore:server-core-object
[sdb_runtime_smoke] PASS fixture:qbcore:server-player-methods
[sdb_runtime_smoke] PASS fixture:qbcore:server-callbacks-items-vehicles
[sdb_runtime_smoke] PASS fixture:qbox:server-player-exports
[sdb_runtime_smoke] PASS fixture:qbox:server-money-groups
[sdb_runtime_smoke] PASS fixture:qbox:server-shared-and-items
[sdb_runtime_smoke] PASS client:sdb_runtime_smoke:loaded
[sdb_runtime_smoke] PASS client:sdb_runtime:GetQbPlayerData
[sdb_runtime_smoke] PASS client:sdb_runtime:GetQbShared
[sdb_runtime_smoke] PASS client:qb-core:GetCoreObject
[sdb_runtime_smoke] PASS fixture:qbcore:client:core-object-playerdata
[sdb_runtime_smoke] PASS fixture:qbox:client:playerdata-module
`
  );
}

function writeSmokeLogWithRunId(runId: string): string {
  return writeFixture(
    `synthetic-fxserver-smoke-fixture-${runId}.log`,
    `
Smoke run id: ${runId}
Creating script environments for sdb_runtime
Started resource sdb_runtime
Creating script environments for qb-core
Started resource qb-core
Creating script environments for qbx_core
Started resource qbx_core
Creating script environments for sdb_runtime_smoke
Started resource sdb_runtime_smoke
Creating script environments for sdb_qbcore_fixture
Started resource sdb_qbcore_fixture
Creating script environments for sdb_qbox_fixture
Started resource sdb_qbox_fixture
[sdb_runtime_smoke] INFO playerConnecting: smoke-client
[sdb_runtime_smoke] INFO playerJoining: 1
[sdb_runtime_smoke] PASS sdb_runtime:GetHealth
[sdb_runtime_smoke] PASS sdb_runtime:GetConfig
[sdb_runtime_smoke] PASS sdb_runtime:HasPermission
[sdb_runtime_smoke] PASS sdb_runtime:GetQbShared
[sdb_runtime_smoke] PASS qb-core:GetCoreObject
[sdb_runtime_smoke] PASS fixture:qbcore:server-core-object
[sdb_runtime_smoke] PASS fixture:qbcore:server-player-methods
[sdb_runtime_smoke] PASS fixture:qbcore:server-callbacks-items-vehicles
[sdb_runtime_smoke] PASS fixture:qbox:server-player-exports
[sdb_runtime_smoke] PASS fixture:qbox:server-money-groups
[sdb_runtime_smoke] PASS fixture:qbox:server-shared-and-items
[sdb_runtime_smoke] PASS client:sdb_runtime_smoke:loaded
[sdb_runtime_smoke] PASS client:sdb_runtime:GetQbPlayerData
[sdb_runtime_smoke] PASS client:sdb_runtime:GetQbShared
[sdb_runtime_smoke] PASS client:qb-core:GetCoreObject
[sdb_runtime_smoke] PASS fixture:qbcore:client:core-object-playerdata
[sdb_runtime_smoke] PASS fixture:qbox:client:playerdata-module
`
  );
}

function writeNetworkProbe(content = `
FXServer network probe for /info.json
Smoke run id: ${smokeRunId}
Local probe target: http://127.0.0.1:30120/info.json
local: HTTP 200
Advertised probe target: http://192.168.68.102:30120/info.json
advertised: HTTP 200
`): string {
  return writeFixture("fxserver-network-probe.txt", content);
}

function writeSocketProbe(content = `
FXServer socket probe for 30120
Smoke run id: ${smokeRunId}
TCP listen confirmed: yes
UDP listen confirmed: yes
tcp LISTEN 0 4096 0.0.0.0:30120 0.0.0.0:*
udp UNCONN 0 0 0.0.0.0:30120 0.0.0.0:*
`): string {
  return writeFixture("fxserver-socket-probe.txt", content);
}

function writePlayerProbe(content = `
FXServer player probe for /players.json
Smoke run id: ${smokeRunId}
Local probe target: http://127.0.0.1:30120/players.json
Advertised probe target: http://192.168.68.102:30120/players.json
Player count observed: 1
Max player count observed: 1
Player samples observed: 4
local: HTTP 200 players=1
advertised: HTTP 200 players=1
sample: 2026-05-19T00:00:00.000Z target=local reason=after resource start status=HTTP 200 players=0
sample: 2026-05-19T00:00:00.000Z target=advertised reason=after resource start status=HTTP 200 players=0
sample: 2026-05-19T00:00:10.000Z target=local reason=periodic sample status=HTTP 200 players=1
sample: 2026-05-19T00:00:10.000Z target=advertised reason=periodic sample status=HTTP 200 players=1
players: [{"id":1,"name":"smoke-client"}]
`): string {
  return writeFixture("fxserver-player-probe.txt", content);
}

function writeConnectInfo(content = `
FiveM connect target: 192.168.68.102:30120
Smoke run id: ${smokeRunId}
FiveM connect URI: fivem://connect/192.168.68.102:30120
Detected IPv4 addresses: wlo1=192.168.68.102
Bind address: 0.0.0.0
Advertised connect host: 192.168.68.102
Port: 30120
Client checks required: yes
Smoke timeout ms: 180000
Collection window ms: 180000
Transcript path: ${writeSmokeLog()}
Network probe path: /tmp/spbox-fxserver-smoke/fxserver-network-probe.txt
Socket probe path: /tmp/spbox-fxserver-smoke/fxserver-socket-probe.txt
Player probe path: /tmp/spbox-fxserver-smoke/fxserver-player-probe.txt
Verification output path: /tmp/spbox-fxserver-smoke/fxserver-smoke-verification.txt
Client launcher path: ${writeConnectLauncher()}
Server-side readiness verifier: npm run verify:production-readiness -- --fxserver-log /tmp/spbox-fxserver-smoke/fxserver-smoke.log --fxserver-connect-info /tmp/spbox-fxserver-smoke/connect-info.txt --fxserver-network-probe /tmp/spbox-fxserver-smoke/fxserver-network-probe.txt --fxserver-socket-probe /tmp/spbox-fxserver-smoke/fxserver-socket-probe.txt --fxserver-player-probe /tmp/spbox-fxserver-smoke/fxserver-player-probe.txt --fxserver-verification-output /tmp/spbox-fxserver-smoke/fxserver-smoke-verification.txt --require-qbcore --require-qbox
Client-required verifier: npm run verify:production-readiness -- --fxserver-log /tmp/spbox-fxserver-smoke/fxserver-smoke.log --fxserver-connect-info /tmp/spbox-fxserver-smoke/connect-info.txt --fxserver-network-probe /tmp/spbox-fxserver-smoke/fxserver-network-probe.txt --fxserver-socket-probe /tmp/spbox-fxserver-smoke/fxserver-socket-probe.txt --fxserver-player-probe /tmp/spbox-fxserver-smoke/fxserver-player-probe.txt --fxserver-verification-output /tmp/spbox-fxserver-smoke/fxserver-smoke-verification.txt --require-qbcore --require-qbox --require-client
`): string {
  return writeFixture("connect-info.txt", content);
}

function writeConnectLauncher(content = `
<!doctype html>
<html lang="en">
<body>
  <p><a href="fivem://connect/192.168.68.102:30120">Open FiveM client</a></p>
  <p>Manual URI: <code>fivem://connect/192.168.68.102:30120</code></p>
  <p>Smoke run id: <code>${smokeRunId}</code></p>
</body>
</html>
`): string {
  return writeFixture("connect-launcher.html", content);
}

function writeVerificationOutput(content = `
Smoke run id: ${smokeRunId}
Server-side FXServer smoke verifier:
Verified FXServer smoke transcript: 16 checks passed.
Verified QBCore facade smoke checks.
Verified Qbox facade smoke checks.
Client-required FXServer smoke verifier:
Verified FXServer smoke transcript: 16 checks passed.
Verified QBCore facade smoke checks.
Verified Qbox facade smoke checks.
Verified client smoke checks.
`): string {
  return writeFixture("fxserver-smoke-verification.txt", content);
}

function runVerifier(...args: string[]): string {
  return execFileSync("node", ["scripts/verify-production-readiness.mjs", ...args], {
    cwd: process.cwd(),
    encoding: "utf8"
  });
}

describe("production readiness verifier", () => {
  it("is exposed as an explicit evidence-gated command", () => {
    expect(packageJson.scripts["verify:production-readiness"]).toBe(
      "node scripts/verify-production-readiness.mjs"
    );
  });

  it("accepts official binding provenance plus a complete FXServer smoke transcript", () => {
    const smokeLog = writeSmokeLog();
    const networkProbe = writeNetworkProbe();
    const socketProbe = writeSocketProbe();
    const playerProbe = writePlayerProbe();
    const verificationOutput = writeVerificationOutput();
    const launcher = writeConnectLauncher();
    const output = runVerifier(
      "--provenance",
      writeProvenance("official"),
      "--fxserver-log",
      smokeLog,
      "--fxserver-network-probe",
      networkProbe,
      "--fxserver-socket-probe",
      socketProbe,
      "--fxserver-player-probe",
      playerProbe,
      "--fxserver-connect-info",
      writeConnectInfo(`
FiveM connect target: 192.168.68.102:30120
Smoke run id: ${smokeRunId}
FiveM connect URI: fivem://connect/192.168.68.102:30120
Detected IPv4 addresses: wlo1=192.168.68.102
Bind address: 0.0.0.0
Advertised connect host: 192.168.68.102
Port: 30120
Client checks required: yes
Smoke timeout ms: 180000
Collection window ms: 180000
Transcript path: ${smokeLog}
Network probe path: ${networkProbe}
Socket probe path: ${socketProbe}
Player probe path: ${playerProbe}
Verification output path: ${verificationOutput}
Client launcher path: ${launcher}
Server-side readiness verifier: npm run verify:production-readiness -- --fxserver-log ${smokeLog} --fxserver-connect-info /tmp/spbox-fxserver-smoke/connect-info.txt --fxserver-network-probe ${networkProbe} --fxserver-socket-probe ${socketProbe} --fxserver-player-probe ${playerProbe} --fxserver-verification-output ${verificationOutput} --require-qbcore --require-qbox
Client-required verifier: npm run verify:production-readiness -- --fxserver-log ${smokeLog} --fxserver-connect-info /tmp/spbox-fxserver-smoke/connect-info.txt --fxserver-network-probe ${networkProbe} --fxserver-socket-probe ${socketProbe} --fxserver-player-probe ${playerProbe} --fxserver-verification-output ${verificationOutput} --require-qbcore --require-qbox --require-client
`),
      "--fxserver-verification-output",
      verificationOutput,
      "--allow-test-fixture",
      "--require-qbcore",
      "--require-qbox",
      "--require-client"
    );

    expect(output).toContain("Production readiness evidence verified");
    expect(output).toContain("FXServer network probe evidence");
    expect(output).toContain("FXServer socket probe evidence");
    expect(output).toContain("FXServer player probe evidence");
    expect(output).toContain("FXServer connect info evidence");
    expect(output).toContain("FXServer verification output evidence");
  });

  it("rejects failed FXServer network probe evidence when supplied", () => {
    expect(() =>
      runVerifier(
        "--provenance",
        writeProvenance("official"),
        "--fxserver-log",
        writeSmokeLog(),
        "--fxserver-network-probe",
        writeNetworkProbe(`
FXServer network probe for /info.json
Local probe target: http://127.0.0.1:30120/info.json
local: connect ECONNREFUSED 127.0.0.1:30120
`),
        "--allow-test-fixture"
      )
    ).toThrow(/FXServer network probe did not confirm local HTTP 200/);
  });

  it("rejects failed alternate FXServer network probe evidence when supplied", () => {
    expect(() =>
      runVerifier(
        "--provenance",
        writeProvenance("official"),
        "--fxserver-log",
        writeSmokeLog(),
        "--fxserver-network-probe",
        writeNetworkProbe(`
FXServer network probe for /info.json
Smoke run id: ${smokeRunId}
Local probe target: http://127.0.0.1:30120/info.json
local: HTTP 200
Advertised probe target: http://192.168.68.102:30120/info.json
advertised: HTTP 200
Alternate probe target (tailscale0): http://100.71.161.17:30120/info.json
alternate-tailscale0: connect ETIMEDOUT 100.71.161.17:30120
`),
        "--allow-test-fixture"
      )
    ).toThrow(/FXServer network probe did not confirm alternate HTTP 200/);
  });

  it("rejects failed FXServer socket probe evidence when supplied", () => {
    expect(() =>
      runVerifier(
        "--provenance",
        writeProvenance("official"),
        "--fxserver-log",
        writeSmokeLog(),
        "--fxserver-socket-probe",
        writeSocketProbe(`
FXServer socket probe for 30120
TCP listen confirmed: yes
UDP listen confirmed: no
tcp LISTEN 0 4096 0.0.0.0:30120 0.0.0.0:*
`),
        "--allow-test-fixture"
      )
    ).toThrow(/FXServer socket probe did not confirm UDP listen/);
  });

  it("rejects malformed FXServer player probe evidence when supplied", () => {
    expect(() =>
      runVerifier(
        "--provenance",
        writeProvenance("official"),
        "--fxserver-log",
        writeSmokeLog(),
        "--fxserver-player-probe",
        writePlayerProbe(`
FXServer player probe for /players.json
Local probe target: http://127.0.0.1:30120/players.json
Player count observed: unknown
Max player count observed: unknown
local: connect ECONNREFUSED 127.0.0.1:30120
`),
        "--allow-test-fixture"
      )
    ).toThrow(/FXServer player probe did not confirm local HTTP 200/);
  });

  it("rejects failed advertised FXServer player probe evidence when supplied", () => {
    expect(() =>
      runVerifier(
        "--provenance",
        writeProvenance("official"),
        "--fxserver-log",
        writeSmokeLog(),
        "--fxserver-player-probe",
        writePlayerProbe(`
FXServer player probe for /players.json
Local probe target: http://127.0.0.1:30120/players.json
Advertised probe target: http://192.168.68.102:30120/players.json
Player count observed: 0
Max player count observed: 0
Player samples observed: 2
local: HTTP 200 players=0
advertised: connect ECONNREFUSED 192.168.68.102:30120
players: []
`),
        "--allow-test-fixture"
      )
    ).toThrow(/FXServer player probe did not confirm advertised HTTP 200/);
  });

  it("rejects failed alternate FXServer player probe evidence when supplied", () => {
    expect(() =>
      runVerifier(
        "--provenance",
        writeProvenance("official"),
        "--fxserver-log",
        writeSmokeLog(),
        "--fxserver-player-probe",
        writePlayerProbe(`
FXServer player probe for /players.json
Smoke run id: ${smokeRunId}
Local probe target: http://127.0.0.1:30120/players.json
Advertised probe target: http://192.168.68.102:30120/players.json
Alternate probe target (tailscale0): http://100.71.161.17:30120/players.json
Player count observed: 1
Max player count observed: 1
Player samples observed: 3
local: HTTP 200 players=1
advertised: HTTP 200 players=1
alternate-tailscale0: connect ETIMEDOUT 100.71.161.17:30120
sample: 2026-05-19T00:00:00.000Z target=local reason=after resource start status=HTTP 200 players=1
sample: 2026-05-19T00:00:00.000Z target=advertised reason=after resource start status=HTTP 200 players=1
sample: 2026-05-19T00:00:00.000Z target=alternate-tailscale0 reason=after resource start status=connect ETIMEDOUT players=0
players: [{"id":1,"name":"smoke-client"}]
`),
        "--allow-test-fixture"
      )
    ).toThrow(/FXServer player probe did not confirm alternate HTTP 200/);
  });

  it("requires player probe evidence to observe a player when client checks are required", () => {
    const smokeLog = writeSmokeLog();
    const networkProbe = writeNetworkProbe();
    const socketProbe = writeSocketProbe();
    const playerProbe = writePlayerProbe(`
FXServer player probe for /players.json
Smoke run id: ${smokeRunId}
Local probe target: http://127.0.0.1:30120/players.json
Advertised probe target: http://192.168.68.102:30120/players.json
Player count observed: 0
Max player count observed: 0
Player samples observed: 2
local: HTTP 200 players=0
advertised: HTTP 200 players=0
sample: 2026-05-19T00:00:00.000Z target=local reason=after resource start status=HTTP 200 players=0
sample: 2026-05-19T00:00:00.000Z target=advertised reason=after resource start status=HTTP 200 players=0
players: []
`);
    const verificationOutput = writeVerificationOutput();
    expect(() =>
      runVerifier(
        "--provenance",
        writeProvenance("official"),
        "--fxserver-log",
        smokeLog,
        "--fxserver-network-probe",
        networkProbe,
        "--fxserver-socket-probe",
        socketProbe,
        "--fxserver-player-probe",
        playerProbe,
        "--fxserver-connect-info",
        writeConnectInfo(`
FiveM connect target: 192.168.68.102:30120
Smoke run id: ${smokeRunId}
FiveM connect URI: fivem://connect/192.168.68.102:30120
Detected IPv4 addresses: wlo1=192.168.68.102
Bind address: 0.0.0.0
Advertised connect host: 192.168.68.102
Port: 30120
Client checks required: yes
Smoke timeout ms: 180000
Collection window ms: 180000
Transcript path: ${smokeLog}
Network probe path: ${networkProbe}
Socket probe path: ${socketProbe}
Player probe path: ${playerProbe}
Verification output path: ${verificationOutput}
Server-side readiness verifier: npm run verify:production-readiness -- --fxserver-log ${smokeLog} --fxserver-connect-info /tmp/spbox-production-readiness-tests/connect-info.txt --fxserver-network-probe ${networkProbe} --fxserver-socket-probe ${socketProbe} --fxserver-player-probe ${playerProbe} --fxserver-verification-output ${verificationOutput} --require-qbcore --require-qbox
Client-required verifier: npm run verify:production-readiness -- --fxserver-log ${smokeLog} --fxserver-connect-info /tmp/spbox-production-readiness-tests/connect-info.txt --fxserver-network-probe ${networkProbe} --fxserver-socket-probe ${socketProbe} --fxserver-player-probe ${playerProbe} --fxserver-verification-output ${verificationOutput} --require-qbcore --require-qbox --require-client
`),
        "--fxserver-verification-output",
        verificationOutput,
        "--allow-test-fixture",
        "--require-qbcore",
        "--require-qbox",
        "--require-client"
      )
    ).toThrow(/FXServer player probe did not observe a connected player/);
  });

  it("requires client player evidence to come from sampled player probe lines", () => {
    const smokeLog = writeSmokeLog();
    const networkProbe = writeNetworkProbe();
    const socketProbe = writeSocketProbe();
    const playerProbe = writePlayerProbe(`
FXServer player probe for /players.json
Smoke run id: ${smokeRunId}
Local probe target: http://127.0.0.1:30120/players.json
Advertised probe target: http://192.168.68.102:30120/players.json
Player count observed: 0
Max player count observed: 1
Player samples observed: 2
local: HTTP 200 players=0
advertised: HTTP 200 players=0
sample: 2026-05-19T00:00:00.000Z target=local reason=after resource start status=HTTP 200 players=0
sample: 2026-05-19T00:00:00.000Z target=advertised reason=after resource start status=HTTP 200 players=0
players: []
`);
    const verificationOutput = writeVerificationOutput();

    expect(() =>
      runVerifier(
        "--provenance",
        writeProvenance("official"),
        "--fxserver-log",
        smokeLog,
        "--fxserver-network-probe",
        networkProbe,
        "--fxserver-socket-probe",
        socketProbe,
        "--fxserver-player-probe",
        playerProbe,
        "--fxserver-connect-info",
        writeConnectInfo(`
FiveM connect target: 192.168.68.102:30120
Smoke run id: ${smokeRunId}
FiveM connect URI: fivem://connect/192.168.68.102:30120
Detected IPv4 addresses: wlo1=192.168.68.102
Bind address: 0.0.0.0
Advertised connect host: 192.168.68.102
Port: 30120
Client checks required: yes
Smoke timeout ms: 180000
Collection window ms: 180000
Transcript path: ${smokeLog}
Network probe path: ${networkProbe}
Socket probe path: ${socketProbe}
Player probe path: ${playerProbe}
Verification output path: ${verificationOutput}
Server-side readiness verifier: npm run verify:production-readiness -- --fxserver-log ${smokeLog} --fxserver-connect-info /tmp/spbox-production-readiness-tests/connect-info.txt --fxserver-network-probe ${networkProbe} --fxserver-socket-probe ${socketProbe} --fxserver-player-probe ${playerProbe} --fxserver-verification-output ${verificationOutput} --require-qbcore --require-qbox
Client-required verifier: npm run verify:production-readiness -- --fxserver-log ${smokeLog} --fxserver-connect-info /tmp/spbox-production-readiness-tests/connect-info.txt --fxserver-network-probe ${networkProbe} --fxserver-socket-probe ${socketProbe} --fxserver-player-probe ${playerProbe} --fxserver-verification-output ${verificationOutput} --require-qbcore --require-qbox --require-client
`),
        "--fxserver-verification-output",
        verificationOutput,
        "--allow-test-fixture",
        "--require-qbcore",
        "--require-qbox",
        "--require-client"
      )
    ).toThrow(/FXServer player probe max player count does not match sampled players/);
  });

  it("rejects player probe evidence whose sample count does not match sampled lines", () => {
    expect(() =>
      runVerifier(
        "--provenance",
        writeProvenance("official"),
        "--fxserver-log",
        writeSmokeLog(),
        "--fxserver-player-probe",
        writePlayerProbe(`
FXServer player probe for /players.json
Smoke run id: ${smokeRunId}
Local probe target: http://127.0.0.1:30120/players.json
Player count observed: 0
Max player count observed: 0
Player samples observed: 3
local: HTTP 200 players=0
sample: 2026-05-19T00:00:00.000Z target=local reason=after resource start status=HTTP 200 players=0
players: []
`),
        "--allow-test-fixture"
      )
    ).toThrow(/FXServer player probe sample count does not match sampled lines/);
  });

  it("requires the full runner evidence bundle when client checks are required", () => {
    expect(() =>
      runVerifier(
        "--provenance",
        writeProvenance("official"),
        "--fxserver-log",
        writeSmokeLog(),
        "--allow-test-fixture",
        "--require-qbcore",
        "--require-qbox",
        "--require-client"
      )
    ).toThrow(/Client-required production readiness requires runner evidence/);
  });

  it("rejects incomplete FXServer connect info evidence when supplied", () => {
    expect(() =>
      runVerifier(
        "--provenance",
        writeProvenance("official"),
        "--fxserver-log",
        writeSmokeLog(),
        "--fxserver-connect-info",
        writeConnectInfo(`
FiveM connect target: 192.168.68.102:30120
Bind address: 0.0.0.0
`),
        "--allow-test-fixture"
      )
    ).toThrow(/FXServer connect info missing required content/);
  });

  it("requires connect info to come from a client-required run when client checks are required", () => {
    const smokeLog = writeSmokeLog();
    const networkProbe = writeNetworkProbe();
    const socketProbe = writeSocketProbe();
    const playerProbe = writePlayerProbe();
    const verificationOutput = writeVerificationOutput();
    expect(() =>
      runVerifier(
        "--provenance",
        writeProvenance("official"),
        "--fxserver-log",
        smokeLog,
        "--fxserver-network-probe",
        networkProbe,
        "--fxserver-socket-probe",
        socketProbe,
        "--fxserver-player-probe",
        playerProbe,
        "--fxserver-connect-info",
        writeConnectInfo(`
FiveM connect target: 192.168.68.102:30120
Smoke run id: ${smokeRunId}
FiveM connect URI: fivem://connect/192.168.68.102:30120
Detected IPv4 addresses: wlo1=192.168.68.102
Bind address: 0.0.0.0
Advertised connect host: 192.168.68.102
Port: 30120
Client checks required: no
Smoke timeout ms: 180000
Collection window ms: 180000
Transcript path: ${smokeLog}
Network probe path: ${networkProbe}
Socket probe path: ${socketProbe}
Player probe path: ${playerProbe}
Verification output path: ${verificationOutput}
Server-side readiness verifier: npm run verify:production-readiness -- --fxserver-log ${smokeLog} --fxserver-connect-info /tmp/spbox-fxserver-smoke/connect-info.txt --fxserver-network-probe ${networkProbe} --fxserver-socket-probe ${socketProbe} --fxserver-player-probe ${playerProbe} --fxserver-verification-output ${verificationOutput} --require-qbcore --require-qbox
Client-required verifier: npm run verify:production-readiness -- --fxserver-log ${smokeLog} --fxserver-connect-info /tmp/spbox-fxserver-smoke/connect-info.txt --fxserver-network-probe ${networkProbe} --fxserver-socket-probe ${socketProbe} --fxserver-player-probe ${playerProbe} --fxserver-verification-output ${verificationOutput} --require-qbcore --require-qbox --require-client
`),
        "--fxserver-verification-output",
        verificationOutput,
        "--allow-test-fixture",
        "--require-qbcore",
        "--require-qbox",
        "--require-client"
      )
    ).toThrow(/FXServer connect info did not come from a client-required run/);
  });

  it("rejects connect info whose smoke timing fields are malformed", () => {
    const smokeLog = writeSmokeLog();
    const networkProbe = writeNetworkProbe();
    const socketProbe = writeSocketProbe();
    const playerProbe = writePlayerProbe();
    const verificationOutput = writeVerificationOutput();
    const launcher = writeConnectLauncher();
    expect(() =>
      runVerifier(
        "--provenance",
        writeProvenance("official"),
        "--fxserver-log",
        smokeLog,
        "--fxserver-network-probe",
        networkProbe,
        "--fxserver-socket-probe",
        socketProbe,
        "--fxserver-player-probe",
        playerProbe,
        "--fxserver-connect-info",
        writeConnectInfo(`
FiveM connect target: 192.168.68.102:30120
Smoke run id: ${smokeRunId}
FiveM connect URI: fivem://connect/192.168.68.102:30120
Detected IPv4 addresses: wlo1=192.168.68.102
Bind address: 0.0.0.0
Advertised connect host: 192.168.68.102
Port: 30120
Client checks required: yes
Smoke timeout ms: NaN
Collection window ms: 180000
Client grace window ms: -1
Effective timeout ms: NaN
Transcript path: ${smokeLog}
Network probe path: ${networkProbe}
Socket probe path: ${socketProbe}
Player probe path: ${playerProbe}
Verification output path: ${verificationOutput}
Client launcher path: ${launcher}
Server-side readiness verifier: npm run verify:production-readiness -- --fxserver-log ${smokeLog} --fxserver-connect-info /tmp/spbox-fxserver-smoke/connect-info.txt --fxserver-network-probe ${networkProbe} --fxserver-socket-probe ${socketProbe} --fxserver-player-probe ${playerProbe} --fxserver-verification-output ${verificationOutput} --require-qbcore --require-qbox
Client-required verifier: npm run verify:production-readiness -- --fxserver-log ${smokeLog} --fxserver-connect-info /tmp/spbox-fxserver-smoke/connect-info.txt --fxserver-network-probe ${networkProbe} --fxserver-socket-probe ${socketProbe} --fxserver-player-probe ${playerProbe} --fxserver-verification-output ${verificationOutput} --require-qbcore --require-qbox --require-client
`),
        "--fxserver-verification-output",
        verificationOutput,
        "--allow-test-fixture",
        "--require-qbcore",
        "--require-qbox",
        "--require-client"
      )
    ).toThrow(/FXServer connect info smoke timing is malformed/);
  });

  it("rejects connect info paths that do not match supplied evidence paths", () => {
    const smokeLog = writeSmokeLog();
    const networkProbe = writeNetworkProbe();
    const socketProbe = writeSocketProbe();
    const playerProbe = writePlayerProbe();
    const verificationOutput = writeVerificationOutput();
    expect(() =>
      runVerifier(
        "--provenance",
        writeProvenance("official"),
        "--fxserver-log",
        smokeLog,
        "--fxserver-network-probe",
        networkProbe,
        "--fxserver-socket-probe",
        socketProbe,
        "--fxserver-player-probe",
        playerProbe,
        "--fxserver-connect-info",
        writeConnectInfo(`
FiveM connect target: 192.168.68.102:30120
FiveM connect URI: fivem://connect/192.168.68.102:30120
Detected IPv4 addresses: wlo1=192.168.68.102
Bind address: 0.0.0.0
Advertised connect host: 192.168.68.102
Port: 30120
Client checks required: yes
Smoke timeout ms: 180000
Collection window ms: 180000
Transcript path: /tmp/other-run/fxserver-smoke.log
Network probe path: ${networkProbe}
Socket probe path: ${socketProbe}
Player probe path: ${playerProbe}
Verification output path: ${verificationOutput}
Server-side readiness verifier: npm run verify:production-readiness -- --fxserver-log /tmp/other-run/fxserver-smoke.log --fxserver-connect-info /tmp/spbox-fxserver-smoke/connect-info.txt --fxserver-network-probe ${networkProbe} --fxserver-socket-probe ${socketProbe} --fxserver-player-probe ${playerProbe} --fxserver-verification-output ${verificationOutput} --require-qbcore --require-qbox
Client-required verifier: npm run verify:production-readiness -- --fxserver-log /tmp/other-run/fxserver-smoke.log --fxserver-connect-info /tmp/spbox-fxserver-smoke/connect-info.txt --fxserver-network-probe ${networkProbe} --fxserver-socket-probe ${socketProbe} --fxserver-player-probe ${playerProbe} --fxserver-verification-output ${verificationOutput} --require-qbcore --require-qbox --require-client
`),
        "--fxserver-verification-output",
        verificationOutput,
        "--allow-test-fixture",
        "--require-qbcore",
        "--require-qbox",
        "--require-client"
      )
    ).toThrow(/FXServer connect info transcript path does not match supplied evidence/);
  });

  it("rejects connect info whose advertised target does not match probe targets", () => {
    const smokeLog = writeSmokeLog();
    const networkProbe = writeNetworkProbe();
    const socketProbe = writeSocketProbe();
    const playerProbe = writePlayerProbe();
    const verificationOutput = writeVerificationOutput();
    expect(() =>
      runVerifier(
        "--provenance",
        writeProvenance("official"),
        "--fxserver-log",
        smokeLog,
        "--fxserver-network-probe",
        networkProbe,
        "--fxserver-socket-probe",
        socketProbe,
        "--fxserver-player-probe",
        playerProbe,
        "--fxserver-connect-info",
        writeConnectInfo(`
FiveM connect target: 10.10.10.10:30120
Smoke run id: ${smokeRunId}
FiveM connect URI: fivem://connect/10.10.10.10:30120
Detected IPv4 addresses: wlo1=192.168.68.102
Bind address: 0.0.0.0
Advertised connect host: 10.10.10.10
Port: 30120
Client checks required: yes
Smoke timeout ms: 180000
Collection window ms: 180000
Transcript path: ${smokeLog}
Network probe path: ${networkProbe}
Socket probe path: ${socketProbe}
Player probe path: ${playerProbe}
Verification output path: ${verificationOutput}
Server-side readiness verifier: npm run verify:production-readiness -- --fxserver-log ${smokeLog} --fxserver-connect-info /tmp/spbox-fxserver-smoke/connect-info.txt --fxserver-network-probe ${networkProbe} --fxserver-socket-probe ${socketProbe} --fxserver-player-probe ${playerProbe} --fxserver-verification-output ${verificationOutput} --require-qbcore --require-qbox
Client-required verifier: npm run verify:production-readiness -- --fxserver-log ${smokeLog} --fxserver-connect-info /tmp/spbox-fxserver-smoke/connect-info.txt --fxserver-network-probe ${networkProbe} --fxserver-socket-probe ${socketProbe} --fxserver-player-probe ${playerProbe} --fxserver-verification-output ${verificationOutput} --require-qbcore --require-qbox --require-client
`),
        "--fxserver-verification-output",
        verificationOutput,
        "--allow-test-fixture",
        "--require-qbcore",
        "--require-qbox",
        "--require-client"
      )
    ).toThrow(/FXServer connect info advertised target does not match probe evidence/);
  });

  it("rejects connect info whose bind address is blank", () => {
    const smokeLog = writeSmokeLog();
    const networkProbe = writeNetworkProbe();
    const socketProbe = writeSocketProbe();
    const playerProbe = writePlayerProbe();
    const verificationOutput = writeVerificationOutput();
    const launcher = writeConnectLauncher();
    expect(() =>
      runVerifier(
        "--provenance",
        writeProvenance("official"),
        "--fxserver-log",
        smokeLog,
        "--fxserver-network-probe",
        networkProbe,
        "--fxserver-socket-probe",
        socketProbe,
        "--fxserver-player-probe",
        playerProbe,
        "--fxserver-connect-info",
        writeConnectInfo(`
FiveM connect target: 192.168.68.102:30120
Smoke run id: ${smokeRunId}
FiveM connect URI: fivem://connect/192.168.68.102:30120
Detected IPv4 addresses: wlo1=192.168.68.102
Bind address:
Advertised connect host: 192.168.68.102
Port: 30120
Client checks required: yes
Smoke timeout ms: 180000
Collection window ms: 180000
Client grace window ms: 0
Effective timeout ms: 210000
Transcript path: ${smokeLog}
Network probe path: ${networkProbe}
Socket probe path: ${socketProbe}
Player probe path: ${playerProbe}
Verification output path: ${verificationOutput}
Client launcher path: ${launcher}
Server-side readiness verifier: npm run verify:production-readiness -- --fxserver-log ${smokeLog} --fxserver-connect-info /tmp/spbox-fxserver-smoke/connect-info.txt --fxserver-network-probe ${networkProbe} --fxserver-socket-probe ${socketProbe} --fxserver-player-probe ${playerProbe} --fxserver-verification-output ${verificationOutput} --require-qbcore --require-qbox
Client-required verifier: npm run verify:production-readiness -- --fxserver-log ${smokeLog} --fxserver-connect-info /tmp/spbox-fxserver-smoke/connect-info.txt --fxserver-network-probe ${networkProbe} --fxserver-socket-probe ${socketProbe} --fxserver-player-probe ${playerProbe} --fxserver-verification-output ${verificationOutput} --require-qbcore --require-qbox --require-client
`),
        "--fxserver-verification-output",
        verificationOutput,
        "--allow-test-fixture",
        "--require-qbcore",
        "--require-qbox",
        "--require-client"
      )
    ).toThrow(/FXServer connect info bind address is missing/);
  });

  it("rejects connect info whose advertised port is outside the valid FXServer range", () => {
    const smokeLog = writeSmokeLog();
    const networkProbe = writeNetworkProbe(`
FXServer network probe for /info.json
Smoke run id: ${smokeRunId}
Local probe target: http://127.0.0.1:30120/info.json
local: HTTP 200
`);
    const socketProbe = writeSocketProbe(`
FXServer socket probe for 99999
Smoke run id: ${smokeRunId}
TCP listen confirmed: yes
UDP listen confirmed: yes
tcp LISTEN 0 4096 0.0.0.0:99999 0.0.0.0:*
udp UNCONN 0 0 0.0.0.0:99999 0.0.0.0:*
`);
    const playerProbe = writePlayerProbe(`
FXServer player probe for /players.json
Smoke run id: ${smokeRunId}
Local probe target: http://127.0.0.1:99999/players.json
Player count observed: 1
Max player count observed: 1
Player samples observed: 1
local: HTTP 200 players=1
sample: 2026-05-19T00:00:00.000Z target=local reason=periodic sample status=HTTP 200 players=1
players: [{"id":1,"name":"smoke-client"}]
`);
    const verificationOutput = writeVerificationOutput();
    const launcher = writeConnectLauncher(`
<!doctype html>
<html lang="en">
<body>
  <p><a href="fivem://connect/192.168.68.102:99999">Open FiveM client</a></p>
  <p>Smoke run id: <code>${smokeRunId}</code></p>
</body>
</html>
`);
    expect(() =>
      runVerifier(
        "--provenance",
        writeProvenance("official"),
        "--fxserver-log",
        smokeLog,
        "--fxserver-network-probe",
        networkProbe,
        "--fxserver-socket-probe",
        socketProbe,
        "--fxserver-player-probe",
        playerProbe,
        "--fxserver-connect-info",
        writeConnectInfo(`
FiveM connect target: 192.168.68.102:99999
Smoke run id: ${smokeRunId}
FiveM connect URI: fivem://connect/192.168.68.102:99999
Detected IPv4 addresses: wlo1=192.168.68.102
Bind address: 0.0.0.0
Advertised connect host: 192.168.68.102
Port: 99999
Client checks required: yes
Smoke timeout ms: 180000
Collection window ms: 180000
Client grace window ms: 0
Effective timeout ms: 210000
Transcript path: ${smokeLog}
Network probe path: ${networkProbe}
Socket probe path: ${socketProbe}
Player probe path: ${playerProbe}
Verification output path: ${verificationOutput}
Client launcher path: ${launcher}
Server-side readiness verifier: npm run verify:production-readiness -- --fxserver-log ${smokeLog} --fxserver-connect-info /tmp/spbox-fxserver-smoke/connect-info.txt --fxserver-network-probe ${networkProbe} --fxserver-socket-probe ${socketProbe} --fxserver-player-probe ${playerProbe} --fxserver-verification-output ${verificationOutput} --require-qbcore --require-qbox
Client-required verifier: npm run verify:production-readiness -- --fxserver-log ${smokeLog} --fxserver-connect-info /tmp/spbox-fxserver-smoke/connect-info.txt --fxserver-network-probe ${networkProbe} --fxserver-socket-probe ${socketProbe} --fxserver-player-probe ${playerProbe} --fxserver-verification-output ${verificationOutput} --require-qbcore --require-qbox --require-client
`),
        "--fxserver-verification-output",
        verificationOutput,
        "--allow-test-fixture",
        "--require-qbcore",
        "--require-qbox",
        "--require-client"
      )
    ).toThrow(/FXServer connect info advertised target is malformed/);
  });

  it("rejects connect info whose advertised target is the unresolved server-ip placeholder", () => {
    const smokeLog = writeSmokeLog();
    const networkProbe = writeNetworkProbe(`
FXServer network probe for /info.json
Smoke run id: ${smokeRunId}
Local probe target: http://127.0.0.1:30120/info.json
local: HTTP 200
`);
    const socketProbe = writeSocketProbe();
    const playerProbe = writePlayerProbe(`
FXServer player probe for /players.json
Smoke run id: ${smokeRunId}
Local probe target: http://127.0.0.1:30120/players.json
Player count observed: 1
Max player count observed: 1
Player samples observed: 1
local: HTTP 200 players=1
sample: 2026-05-19T00:00:00.000Z target=local reason=periodic sample status=HTTP 200 players=1
players: [{"id":1,"name":"smoke-client"}]
`);
    const verificationOutput = writeVerificationOutput();
    const launcher = writeConnectLauncher(`
<!doctype html>
<html lang="en">
<body>
  <p><a href="fivem://connect/<server-ip>:30120">Open FiveM client</a></p>
  <p>Smoke run id: <code>${smokeRunId}</code></p>
</body>
</html>
`);
    expect(() =>
      runVerifier(
        "--provenance",
        writeProvenance("official"),
        "--fxserver-log",
        smokeLog,
        "--fxserver-network-probe",
        networkProbe,
        "--fxserver-socket-probe",
        socketProbe,
        "--fxserver-player-probe",
        playerProbe,
        "--fxserver-connect-info",
        writeConnectInfo(`
FiveM connect target: <server-ip>:30120
Smoke run id: ${smokeRunId}
FiveM connect URI: fivem://connect/<server-ip>:30120
Detected IPv4 addresses: wlo1=192.168.68.102
Bind address: 0.0.0.0
Advertised connect host: <server-ip>
Port: 30120
Client checks required: yes
Smoke timeout ms: 180000
Collection window ms: 180000
Transcript path: ${smokeLog}
Network probe path: ${networkProbe}
Socket probe path: ${socketProbe}
Player probe path: ${playerProbe}
Verification output path: ${verificationOutput}
Client launcher path: ${launcher}
Server-side readiness verifier: npm run verify:production-readiness -- --fxserver-log ${smokeLog} --fxserver-connect-info /tmp/spbox-fxserver-smoke/connect-info.txt --fxserver-network-probe ${networkProbe} --fxserver-socket-probe ${socketProbe} --fxserver-player-probe ${playerProbe} --fxserver-verification-output ${verificationOutput} --require-qbcore --require-qbox
Client-required verifier: npm run verify:production-readiness -- --fxserver-log ${smokeLog} --fxserver-connect-info /tmp/spbox-fxserver-smoke/connect-info.txt --fxserver-network-probe ${networkProbe} --fxserver-socket-probe ${socketProbe} --fxserver-player-probe ${playerProbe} --fxserver-verification-output ${verificationOutput} --require-qbcore --require-qbox --require-client
`),
        "--fxserver-verification-output",
        verificationOutput,
        "--allow-test-fixture",
        "--require-qbcore",
        "--require-qbox",
        "--require-client"
      )
    ).toThrow(/FXServer connect info advertised target is unresolved/);
  });

  it("rejects malformed alternate FiveM connect URI evidence when present", () => {
    const smokeLog = writeSmokeLog();
    const networkProbe = writeNetworkProbe();
    const socketProbe = writeSocketProbe();
    const playerProbe = writePlayerProbe();
    const verificationOutput = writeVerificationOutput();
    const launcher = writeConnectLauncher();
    expect(() =>
      runVerifier(
        "--provenance",
        writeProvenance("official"),
        "--fxserver-log",
        smokeLog,
        "--fxserver-network-probe",
        networkProbe,
        "--fxserver-socket-probe",
        socketProbe,
        "--fxserver-player-probe",
        playerProbe,
        "--fxserver-connect-info",
        writeConnectInfo(`
FiveM connect target: 192.168.68.102:30120
Smoke run id: ${smokeRunId}
FiveM connect URI: fivem://connect/192.168.68.102:30120
Alternate FiveM connect URIs: tailscale0=not-a-fivem-uri
Detected IPv4 addresses: wlo1=192.168.68.102, tailscale0=100.71.161.17
Bind address: 0.0.0.0
Advertised connect host: 192.168.68.102
Port: 30120
Client checks required: yes
Smoke timeout ms: 180000
Collection window ms: 180000
Transcript path: ${smokeLog}
Network probe path: ${networkProbe}
Socket probe path: ${socketProbe}
Player probe path: ${playerProbe}
Verification output path: ${verificationOutput}
Client launcher path: ${launcher}
Server-side readiness verifier: npm run verify:production-readiness -- --fxserver-log ${smokeLog} --fxserver-connect-info /tmp/spbox-fxserver-smoke/connect-info.txt --fxserver-network-probe ${networkProbe} --fxserver-socket-probe ${socketProbe} --fxserver-player-probe ${playerProbe} --fxserver-verification-output ${verificationOutput} --require-qbcore --require-qbox
Client-required verifier: npm run verify:production-readiness -- --fxserver-log ${smokeLog} --fxserver-connect-info /tmp/spbox-fxserver-smoke/connect-info.txt --fxserver-network-probe ${networkProbe} --fxserver-socket-probe ${socketProbe} --fxserver-player-probe ${playerProbe} --fxserver-verification-output ${verificationOutput} --require-qbcore --require-qbox --require-client
`),
        "--fxserver-verification-output",
        verificationOutput,
        "--allow-test-fixture",
        "--require-qbcore",
        "--require-qbox",
        "--require-client"
      )
    ).toThrow(/FXServer connect info alternate FiveM connect URI is malformed/);
  });

  it("rejects alternate FiveM connect URI evidence with an out-of-range port", () => {
    const smokeLog = writeSmokeLog();
    const networkProbe = writeNetworkProbe();
    const socketProbe = writeSocketProbe();
    const playerProbe = writePlayerProbe();
    const verificationOutput = writeVerificationOutput();
    const launcher = writeConnectLauncher(`
<!doctype html>
<html lang="en">
<body>
  <p><a href="fivem://connect/192.168.68.102:30120">Open FiveM client</a></p>
  <p><a href="fivem://connect/100.71.161.17:99999">Alternate FiveM client</a></p>
  <p>Smoke run id: <code>${smokeRunId}</code></p>
</body>
</html>
`);
    expect(() =>
      runVerifier(
        "--provenance",
        writeProvenance("official"),
        "--fxserver-log",
        smokeLog,
        "--fxserver-network-probe",
        networkProbe,
        "--fxserver-socket-probe",
        socketProbe,
        "--fxserver-player-probe",
        playerProbe,
        "--fxserver-connect-info",
        writeConnectInfo(`
FiveM connect target: 192.168.68.102:30120
Smoke run id: ${smokeRunId}
FiveM connect URI: fivem://connect/192.168.68.102:30120
Alternate FiveM connect URIs: tailscale0=fivem://connect/100.71.161.17:99999
Detected IPv4 addresses: wlo1=192.168.68.102, tailscale0=100.71.161.17
Bind address: 0.0.0.0
Advertised connect host: 192.168.68.102
Port: 30120
Client checks required: yes
Smoke timeout ms: 180000
Collection window ms: 180000
Client grace window ms: 0
Effective timeout ms: 210000
Transcript path: ${smokeLog}
Network probe path: ${networkProbe}
Socket probe path: ${socketProbe}
Player probe path: ${playerProbe}
Verification output path: ${verificationOutput}
Client launcher path: ${launcher}
Server-side readiness verifier: npm run verify:production-readiness -- --fxserver-log ${smokeLog} --fxserver-connect-info /tmp/spbox-fxserver-smoke/connect-info.txt --fxserver-network-probe ${networkProbe} --fxserver-socket-probe ${socketProbe} --fxserver-player-probe ${playerProbe} --fxserver-verification-output ${verificationOutput} --require-qbcore --require-qbox
Client-required verifier: npm run verify:production-readiness -- --fxserver-log ${smokeLog} --fxserver-connect-info /tmp/spbox-fxserver-smoke/connect-info.txt --fxserver-network-probe ${networkProbe} --fxserver-socket-probe ${socketProbe} --fxserver-player-probe ${playerProbe} --fxserver-verification-output ${verificationOutput} --require-qbcore --require-qbox --require-client
`),
        "--fxserver-verification-output",
        verificationOutput,
        "--allow-test-fixture",
        "--require-qbcore",
        "--require-qbox",
        "--require-client"
      )
    ).toThrow(/FXServer connect info alternate FiveM connect URI is malformed/);
  });

  it("rejects alternate FiveM connect URI evidence missing from the client launcher", () => {
    const smokeLog = writeSmokeLog();
    const networkProbe = writeNetworkProbe();
    const socketProbe = writeSocketProbe();
    const playerProbe = writePlayerProbe();
    const verificationOutput = writeVerificationOutput();
    const launcher = writeConnectLauncher();
    expect(() =>
      runVerifier(
        "--provenance",
        writeProvenance("official"),
        "--fxserver-log",
        smokeLog,
        "--fxserver-network-probe",
        networkProbe,
        "--fxserver-socket-probe",
        socketProbe,
        "--fxserver-player-probe",
        playerProbe,
        "--fxserver-connect-info",
        writeConnectInfo(`
FiveM connect target: 192.168.68.102:30120
Smoke run id: ${smokeRunId}
FiveM connect URI: fivem://connect/192.168.68.102:30120
Alternate FiveM connect URIs: tailscale0=fivem://connect/100.71.161.17:30120
Detected IPv4 addresses: wlo1=192.168.68.102, tailscale0=100.71.161.17
Bind address: 0.0.0.0
Advertised connect host: 192.168.68.102
Port: 30120
Client checks required: yes
Smoke timeout ms: 180000
Collection window ms: 180000
Transcript path: ${smokeLog}
Network probe path: ${networkProbe}
Socket probe path: ${socketProbe}
Player probe path: ${playerProbe}
Verification output path: ${verificationOutput}
Client launcher path: ${launcher}
Server-side readiness verifier: npm run verify:production-readiness -- --fxserver-log ${smokeLog} --fxserver-connect-info /tmp/spbox-fxserver-smoke/connect-info.txt --fxserver-network-probe ${networkProbe} --fxserver-socket-probe ${socketProbe} --fxserver-player-probe ${playerProbe} --fxserver-verification-output ${verificationOutput} --require-qbcore --require-qbox
Client-required verifier: npm run verify:production-readiness -- --fxserver-log ${smokeLog} --fxserver-connect-info /tmp/spbox-fxserver-smoke/connect-info.txt --fxserver-network-probe ${networkProbe} --fxserver-socket-probe ${socketProbe} --fxserver-player-probe ${playerProbe} --fxserver-verification-output ${verificationOutput} --require-qbcore --require-qbox --require-client
`),
        "--fxserver-verification-output",
        verificationOutput,
        "--allow-test-fixture",
        "--require-qbcore",
        "--require-qbox",
        "--require-client"
      )
    ).toThrow(/FXServer client launcher is missing alternate FiveM connect URI/);
  });

  it("rejects connect info whose port does not match socket probe evidence", () => {
    const smokeLog = writeSmokeLog();
    const networkProbe = writeNetworkProbe();
    const socketProbe = writeSocketProbe();
    const playerProbe = writePlayerProbe();
    const verificationOutput = writeVerificationOutput();
    expect(() =>
      runVerifier(
        "--provenance",
        writeProvenance("official"),
        "--fxserver-log",
        smokeLog,
        "--fxserver-network-probe",
        networkProbe,
        "--fxserver-socket-probe",
        socketProbe,
        "--fxserver-player-probe",
        playerProbe,
        "--fxserver-connect-info",
        writeConnectInfo(`
FiveM connect target: 192.168.68.102:30121
Smoke run id: ${smokeRunId}
FiveM connect URI: fivem://connect/192.168.68.102:30121
Detected IPv4 addresses: wlo1=192.168.68.102
Bind address: 0.0.0.0
Advertised connect host: 192.168.68.102
Port: 30121
Client checks required: yes
Smoke timeout ms: 180000
Collection window ms: 180000
Transcript path: ${smokeLog}
Network probe path: ${networkProbe}
Socket probe path: ${socketProbe}
Player probe path: ${playerProbe}
Verification output path: ${verificationOutput}
Server-side readiness verifier: npm run verify:production-readiness -- --fxserver-log ${smokeLog} --fxserver-connect-info /tmp/spbox-fxserver-smoke/connect-info.txt --fxserver-network-probe ${networkProbe} --fxserver-socket-probe ${socketProbe} --fxserver-player-probe ${playerProbe} --fxserver-verification-output ${verificationOutput} --require-qbcore --require-qbox
Client-required verifier: npm run verify:production-readiness -- --fxserver-log ${smokeLog} --fxserver-connect-info /tmp/spbox-fxserver-smoke/connect-info.txt --fxserver-network-probe ${networkProbe} --fxserver-socket-probe ${socketProbe} --fxserver-player-probe ${playerProbe} --fxserver-verification-output ${verificationOutput} --require-qbcore --require-qbox --require-client
`),
        "--fxserver-verification-output",
        verificationOutput,
        "--allow-test-fixture",
        "--require-qbcore",
        "--require-qbox",
        "--require-client"
      )
    ).toThrow(/FXServer connect info port does not match socket probe evidence/);
  });

  it("rejects connect info whose recorded evidence paths are blank", () => {
    const smokeLog = writeSmokeLog();
    const networkProbe = writeNetworkProbe();
    const socketProbe = writeSocketProbe();
    const playerProbe = writePlayerProbe();
    const verificationOutput = writeVerificationOutput();
    expect(() =>
      runVerifier(
        "--provenance",
        writeProvenance("official"),
        "--fxserver-log",
        smokeLog,
        "--fxserver-network-probe",
        networkProbe,
        "--fxserver-socket-probe",
        socketProbe,
        "--fxserver-player-probe",
        playerProbe,
        "--fxserver-connect-info",
        writeConnectInfo(`
FiveM connect target: 192.168.68.102:30120
Smoke run id: ${smokeRunId}
FiveM connect URI: fivem://connect/192.168.68.102:30120
Detected IPv4 addresses: wlo1=192.168.68.102
Bind address: 0.0.0.0
Advertised connect host: 192.168.68.102
Port: 30120
Client checks required: yes
Smoke timeout ms: 180000
Collection window ms: 180000
Transcript path:
Network probe path: ${networkProbe}
Socket probe path: ${socketProbe}
Player probe path: ${playerProbe}
Verification output path: ${verificationOutput}
Server-side readiness verifier: npm run verify:production-readiness -- --fxserver-log ${smokeLog} --fxserver-connect-info /tmp/spbox-fxserver-smoke/connect-info.txt --fxserver-network-probe ${networkProbe} --fxserver-socket-probe ${socketProbe} --fxserver-player-probe ${playerProbe} --fxserver-verification-output ${verificationOutput} --require-qbcore --require-qbox
Client-required verifier: npm run verify:production-readiness -- --fxserver-log ${smokeLog} --fxserver-connect-info /tmp/spbox-fxserver-smoke/connect-info.txt --fxserver-network-probe ${networkProbe} --fxserver-socket-probe ${socketProbe} --fxserver-player-probe ${playerProbe} --fxserver-verification-output ${verificationOutput} --require-qbcore --require-qbox --require-client
`),
        "--fxserver-verification-output",
        verificationOutput,
        "--allow-test-fixture",
        "--require-qbcore",
        "--require-qbox",
        "--require-client"
      )
    ).toThrow(/FXServer connect info transcript path is missing/);
  });

  it("rejects connect info whose recorded client launcher path is blank", () => {
    const smokeLog = writeSmokeLog();
    const networkProbe = writeNetworkProbe();
    const socketProbe = writeSocketProbe();
    const playerProbe = writePlayerProbe();
    const verificationOutput = writeVerificationOutput();
    expect(() =>
      runVerifier(
        "--provenance",
        writeProvenance("official"),
        "--fxserver-log",
        smokeLog,
        "--fxserver-network-probe",
        networkProbe,
        "--fxserver-socket-probe",
        socketProbe,
        "--fxserver-player-probe",
        playerProbe,
        "--fxserver-connect-info",
        writeConnectInfo(`
FiveM connect target: 192.168.68.102:30120
Smoke run id: ${smokeRunId}
FiveM connect URI: fivem://connect/192.168.68.102:30120
Detected IPv4 addresses: wlo1=192.168.68.102
Bind address: 0.0.0.0
Advertised connect host: 192.168.68.102
Port: 30120
Client checks required: yes
Smoke timeout ms: 180000
Collection window ms: 180000
Transcript path: ${smokeLog}
Network probe path: ${networkProbe}
Socket probe path: ${socketProbe}
Player probe path: ${playerProbe}
Verification output path: ${verificationOutput}
Client launcher path:
Server-side readiness verifier: npm run verify:production-readiness -- --fxserver-log ${smokeLog} --fxserver-connect-info /tmp/spbox-fxserver-smoke/connect-info.txt --fxserver-network-probe ${networkProbe} --fxserver-socket-probe ${socketProbe} --fxserver-player-probe ${playerProbe} --fxserver-verification-output ${verificationOutput} --require-qbcore --require-qbox
Client-required verifier: npm run verify:production-readiness -- --fxserver-log ${smokeLog} --fxserver-connect-info /tmp/spbox-fxserver-smoke/connect-info.txt --fxserver-network-probe ${networkProbe} --fxserver-socket-probe ${socketProbe} --fxserver-player-probe ${playerProbe} --fxserver-verification-output ${verificationOutput} --require-qbcore --require-qbox --require-client
`),
        "--fxserver-verification-output",
        verificationOutput,
        "--allow-test-fixture",
        "--require-qbcore",
        "--require-qbox",
        "--require-client"
      )
    ).toThrow(/FXServer connect info client launcher path is missing/);
  });

  it("requires client launcher evidence when client checks are required", () => {
    const smokeLog = writeSmokeLog();
    const networkProbe = writeNetworkProbe();
    const socketProbe = writeSocketProbe();
    const playerProbe = writePlayerProbe();
    const verificationOutput = writeVerificationOutput();
    expect(() =>
      runVerifier(
        "--provenance",
        writeProvenance("official"),
        "--fxserver-log",
        smokeLog,
        "--fxserver-network-probe",
        networkProbe,
        "--fxserver-socket-probe",
        socketProbe,
        "--fxserver-player-probe",
        playerProbe,
        "--fxserver-connect-info",
        writeConnectInfo(`
FiveM connect target: 192.168.68.102:30120
Smoke run id: ${smokeRunId}
FiveM connect URI: fivem://connect/192.168.68.102:30120
Detected IPv4 addresses: wlo1=192.168.68.102
Bind address: 0.0.0.0
Advertised connect host: 192.168.68.102
Port: 30120
Client checks required: yes
Smoke timeout ms: 180000
Collection window ms: 180000
Transcript path: ${smokeLog}
Network probe path: ${networkProbe}
Socket probe path: ${socketProbe}
Player probe path: ${playerProbe}
Verification output path: ${verificationOutput}
Server-side readiness verifier: npm run verify:production-readiness -- --fxserver-log ${smokeLog} --fxserver-connect-info /tmp/spbox-fxserver-smoke/connect-info.txt --fxserver-network-probe ${networkProbe} --fxserver-socket-probe ${socketProbe} --fxserver-player-probe ${playerProbe} --fxserver-verification-output ${verificationOutput} --require-qbcore --require-qbox
Client-required verifier: npm run verify:production-readiness -- --fxserver-log ${smokeLog} --fxserver-connect-info /tmp/spbox-fxserver-smoke/connect-info.txt --fxserver-network-probe ${networkProbe} --fxserver-socket-probe ${socketProbe} --fxserver-player-probe ${playerProbe} --fxserver-verification-output ${verificationOutput} --require-qbcore --require-qbox --require-client
`),
        "--fxserver-verification-output",
        verificationOutput,
        "--allow-test-fixture",
        "--require-qbcore",
        "--require-qbox",
        "--require-client"
      )
    ).toThrow(/FXServer connect info missing required content: Client launcher path:/);
  });

  it("rejects connect info whose client launcher target does not match the advertised target", () => {
    const smokeLog = writeSmokeLog();
    const networkProbe = writeNetworkProbe();
    const socketProbe = writeSocketProbe();
    const playerProbe = writePlayerProbe();
    const verificationOutput = writeVerificationOutput();
    const launcher = writeConnectLauncher(`
<!doctype html>
<html lang="en">
<body>
  <p><a href="fivem://connect/10.10.10.10:30120">Open FiveM client</a></p>
  <p>Manual URI: <code>fivem://connect/10.10.10.10:30120</code></p>
  <p>Smoke run id: <code>${smokeRunId}</code></p>
</body>
</html>
`);
    expect(() =>
      runVerifier(
        "--provenance",
        writeProvenance("official"),
        "--fxserver-log",
        smokeLog,
        "--fxserver-network-probe",
        networkProbe,
        "--fxserver-socket-probe",
        socketProbe,
        "--fxserver-player-probe",
        playerProbe,
        "--fxserver-connect-info",
        writeConnectInfo(`
FiveM connect target: 192.168.68.102:30120
Smoke run id: ${smokeRunId}
FiveM connect URI: fivem://connect/192.168.68.102:30120
Detected IPv4 addresses: wlo1=192.168.68.102
Bind address: 0.0.0.0
Advertised connect host: 192.168.68.102
Port: 30120
Client checks required: yes
Smoke timeout ms: 180000
Collection window ms: 180000
Transcript path: ${smokeLog}
Network probe path: ${networkProbe}
Socket probe path: ${socketProbe}
Player probe path: ${playerProbe}
Verification output path: ${verificationOutput}
Client launcher path: ${launcher}
Server-side readiness verifier: npm run verify:production-readiness -- --fxserver-log ${smokeLog} --fxserver-connect-info /tmp/spbox-fxserver-smoke/connect-info.txt --fxserver-network-probe ${networkProbe} --fxserver-socket-probe ${socketProbe} --fxserver-player-probe ${playerProbe} --fxserver-verification-output ${verificationOutput} --require-qbcore --require-qbox
Client-required verifier: npm run verify:production-readiness -- --fxserver-log ${smokeLog} --fxserver-connect-info /tmp/spbox-fxserver-smoke/connect-info.txt --fxserver-network-probe ${networkProbe} --fxserver-socket-probe ${socketProbe} --fxserver-player-probe ${playerProbe} --fxserver-verification-output ${verificationOutput} --require-qbcore --require-qbox --require-client
`),
        "--fxserver-verification-output",
        verificationOutput,
        "--allow-test-fixture",
        "--require-qbcore",
        "--require-qbox",
        "--require-client"
      )
    ).toThrow(/FXServer client launcher target does not match connect info/);
  });

  it("rejects connect info verifier commands missing required evidence flags", () => {
    const smokeLog = writeSmokeLog();
    expect(() =>
      runVerifier(
        "--provenance",
        writeProvenance("official"),
        "--fxserver-log",
        smokeLog,
        "--fxserver-connect-info",
        writeConnectInfo(`
FiveM connect target: 192.168.68.102:30120
Smoke run id: ${smokeRunId}
FiveM connect URI: fivem://connect/192.168.68.102:30120
Detected IPv4 addresses: wlo1=192.168.68.102
Bind address: 0.0.0.0
Advertised connect host: 192.168.68.102
Port: 30120
Client checks required: no
Smoke timeout ms: 180000
Collection window ms: 180000
Transcript path: ${smokeLog}
Network probe path: /tmp/spbox-fxserver-smoke/fxserver-network-probe.txt
Socket probe path: /tmp/spbox-fxserver-smoke/fxserver-socket-probe.txt
Player probe path: /tmp/spbox-fxserver-smoke/fxserver-player-probe.txt
Verification output path: /tmp/spbox-fxserver-smoke/fxserver-smoke-verification.txt
Server-side readiness verifier: npm run verify:production-readiness -- --fxserver-log /tmp/spbox-fxserver-smoke/fxserver-smoke.log --fxserver-connect-info /tmp/spbox-fxserver-smoke/connect-info.txt --fxserver-player-probe /tmp/spbox-fxserver-smoke/fxserver-player-probe.txt --fxserver-verification-output /tmp/spbox-fxserver-smoke/fxserver-smoke-verification.txt --require-qbcore --require-qbox
Client-required verifier: npm run verify:production-readiness -- --fxserver-log /tmp/spbox-fxserver-smoke/fxserver-smoke.log --fxserver-connect-info /tmp/spbox-fxserver-smoke/connect-info.txt --fxserver-player-probe /tmp/spbox-fxserver-smoke/fxserver-player-probe.txt --fxserver-verification-output /tmp/spbox-fxserver-smoke/fxserver-smoke-verification.txt --require-qbcore --require-qbox --require-client
`),
        "--allow-test-fixture"
      )
    ).toThrow(/FXServer connect info missing required content/);
  });

  it("rejects mixed FXServer runner evidence from different smoke runs", () => {
    const smokeLog = writeSmokeLog();
    const networkProbe = writeNetworkProbe();
    const socketProbe = writeSocketProbe();
    const playerProbe = writePlayerProbe();
    const verificationOutput = writeVerificationOutput(`
Smoke run id: 00000000-0000-4000-8000-000000000002
Server-side FXServer smoke verifier:
Verified FXServer smoke transcript: 16 checks passed.
Verified QBCore facade smoke checks.
Verified Qbox facade smoke checks.
Client-required FXServer smoke verifier:
Verified FXServer smoke transcript: 16 checks passed.
Verified QBCore facade smoke checks.
Verified Qbox facade smoke checks.
Verified client smoke checks.
`);

    expect(() =>
      runVerifier(
        "--provenance",
        writeProvenance("official"),
        "--fxserver-log",
        smokeLog,
        "--fxserver-network-probe",
        networkProbe,
        "--fxserver-socket-probe",
        socketProbe,
        "--fxserver-player-probe",
        playerProbe,
        "--fxserver-connect-info",
        writeConnectInfo(`
FiveM connect target: 192.168.68.102:30120
Smoke run id: ${smokeRunId}
FiveM connect URI: fivem://connect/192.168.68.102:30120
Detected IPv4 addresses: wlo1=192.168.68.102
Bind address: 0.0.0.0
Advertised connect host: 192.168.68.102
Port: 30120
Client checks required: yes
Smoke timeout ms: 180000
Collection window ms: 180000
Transcript path: ${smokeLog}
Network probe path: ${networkProbe}
Socket probe path: ${socketProbe}
Player probe path: ${playerProbe}
Verification output path: ${verificationOutput}
Server-side readiness verifier: npm run verify:production-readiness -- --fxserver-log ${smokeLog} --fxserver-connect-info /tmp/spbox-fxserver-smoke/connect-info.txt --fxserver-network-probe ${networkProbe} --fxserver-socket-probe ${socketProbe} --fxserver-player-probe ${playerProbe} --fxserver-verification-output ${verificationOutput} --require-qbcore --require-qbox
Client-required verifier: npm run verify:production-readiness -- --fxserver-log ${smokeLog} --fxserver-connect-info /tmp/spbox-fxserver-smoke/connect-info.txt --fxserver-network-probe ${networkProbe} --fxserver-socket-probe ${socketProbe} --fxserver-player-probe ${playerProbe} --fxserver-verification-output ${verificationOutput} --require-qbcore --require-qbox --require-client
`),
        "--fxserver-verification-output",
        verificationOutput,
        "--allow-test-fixture",
        "--require-qbcore",
        "--require-qbox",
        "--require-client"
      )
    ).toThrow(/FXServer runner evidence smoke run ids do not match/);
  });

  it("rejects an FXServer transcript from a different smoke run", () => {
    const smokeLog = writeSmokeLogWithRunId("00000000-0000-4000-8000-000000000099");
    const networkProbe = writeNetworkProbe();
    const socketProbe = writeSocketProbe();
    const playerProbe = writePlayerProbe();
    const verificationOutput = writeVerificationOutput();
    expect(() =>
      runVerifier(
        "--provenance",
        writeProvenance("official"),
        "--fxserver-log",
        smokeLog,
        "--fxserver-network-probe",
        networkProbe,
        "--fxserver-socket-probe",
        socketProbe,
        "--fxserver-player-probe",
        playerProbe,
        "--fxserver-connect-info",
        writeConnectInfo(`
FiveM connect target: 192.168.68.102:30120
Smoke run id: ${smokeRunId}
FiveM connect URI: fivem://connect/192.168.68.102:30120
Detected IPv4 addresses: wlo1=192.168.68.102
Bind address: 0.0.0.0
Advertised connect host: 192.168.68.102
Port: 30120
Client checks required: yes
Smoke timeout ms: 180000
Collection window ms: 180000
Transcript path: ${smokeLog}
Network probe path: ${networkProbe}
Socket probe path: ${socketProbe}
Player probe path: ${playerProbe}
Verification output path: ${verificationOutput}
Server-side readiness verifier: npm run verify:production-readiness -- --fxserver-log ${smokeLog} --fxserver-connect-info /tmp/spbox-fxserver-smoke/connect-info.txt --fxserver-network-probe ${networkProbe} --fxserver-socket-probe ${socketProbe} --fxserver-player-probe ${playerProbe} --fxserver-verification-output ${verificationOutput} --require-qbcore --require-qbox
Client-required verifier: npm run verify:production-readiness -- --fxserver-log ${smokeLog} --fxserver-connect-info /tmp/spbox-fxserver-smoke/connect-info.txt --fxserver-network-probe ${networkProbe} --fxserver-socket-probe ${socketProbe} --fxserver-player-probe ${playerProbe} --fxserver-verification-output ${verificationOutput} --require-qbcore --require-qbox --require-client
`),
        "--fxserver-verification-output",
        verificationOutput,
        "--allow-test-fixture",
        "--require-qbcore",
        "--require-qbox",
        "--require-client"
      )
    ).toThrow(/FXServer runner evidence smoke run ids do not match/);
  });

  it("rejects a client launcher from a different smoke run", () => {
    const smokeLog = writeSmokeLog();
    const networkProbe = writeNetworkProbe();
    const socketProbe = writeSocketProbe();
    const playerProbe = writePlayerProbe();
    const verificationOutput = writeVerificationOutput();
    const launcher = writeConnectLauncher(`
<!doctype html>
<html lang="en">
<body>
  <p><a href="fivem://connect/192.168.68.102:30120">Open FiveM client</a></p>
  <p>Smoke run id: <code>00000000-0000-4000-8000-000000000123</code></p>
</body>
</html>
`);
    expect(() =>
      runVerifier(
        "--provenance",
        writeProvenance("official"),
        "--fxserver-log",
        smokeLog,
        "--fxserver-network-probe",
        networkProbe,
        "--fxserver-socket-probe",
        socketProbe,
        "--fxserver-player-probe",
        playerProbe,
        "--fxserver-connect-info",
        writeConnectInfo(`
FiveM connect target: 192.168.68.102:30120
Smoke run id: ${smokeRunId}
FiveM connect URI: fivem://connect/192.168.68.102:30120
Detected IPv4 addresses: wlo1=192.168.68.102
Bind address: 0.0.0.0
Advertised connect host: 192.168.68.102
Port: 30120
Client checks required: yes
Smoke timeout ms: 180000
Collection window ms: 180000
Transcript path: ${smokeLog}
Network probe path: ${networkProbe}
Socket probe path: ${socketProbe}
Player probe path: ${playerProbe}
Verification output path: ${verificationOutput}
Client launcher path: ${launcher}
Server-side readiness verifier: npm run verify:production-readiness -- --fxserver-log ${smokeLog} --fxserver-connect-info /tmp/spbox-fxserver-smoke/connect-info.txt --fxserver-network-probe ${networkProbe} --fxserver-socket-probe ${socketProbe} --fxserver-player-probe ${playerProbe} --fxserver-verification-output ${verificationOutput} --require-qbcore --require-qbox
Client-required verifier: npm run verify:production-readiness -- --fxserver-log ${smokeLog} --fxserver-connect-info /tmp/spbox-fxserver-smoke/connect-info.txt --fxserver-network-probe ${networkProbe} --fxserver-socket-probe ${socketProbe} --fxserver-player-probe ${playerProbe} --fxserver-verification-output ${verificationOutput} --require-qbcore --require-qbox --require-client
`),
        "--fxserver-verification-output",
        verificationOutput,
        "--allow-test-fixture",
        "--require-qbcore",
        "--require-qbox",
        "--require-client"
      )
    ).toThrow(/FXServer runner evidence smoke run ids do not match/);
  });

  it("rejects malformed smoke run ids in runner evidence", () => {
    const smokeLog = writeSmokeLogWithRunId("not-a-uuid");
    expect(() =>
      runVerifier(
        "--provenance",
        writeProvenance("official"),
        "--fxserver-log",
        smokeLog,
        "--allow-test-fixture"
      )
    ).toThrow(/FXServer runner evidence has malformed smoke run id/);
  });

  it("rejects incomplete FXServer verification output evidence when supplied", () => {
    const smokeLog = writeSmokeLog();
    const networkProbe = writeNetworkProbe();
    const socketProbe = writeSocketProbe();
    const playerProbe = writePlayerProbe();
    const verificationOutput = writeVerificationOutput("Verified FXServer smoke transcript: 16 checks passed.\n");
    expect(() =>
      runVerifier(
        "--provenance",
        writeProvenance("official"),
        "--fxserver-log",
        smokeLog,
        "--fxserver-network-probe",
        networkProbe,
        "--fxserver-socket-probe",
        socketProbe,
        "--fxserver-player-probe",
        playerProbe,
        "--fxserver-connect-info",
        writeConnectInfo(`
FiveM connect target: 192.168.68.102:30120
Smoke run id: ${smokeRunId}
FiveM connect URI: fivem://connect/192.168.68.102:30120
Detected IPv4 addresses: wlo1=192.168.68.102
Bind address: 0.0.0.0
Advertised connect host: 192.168.68.102
Port: 30120
Client checks required: yes
Smoke timeout ms: 180000
Collection window ms: 180000
Transcript path: ${smokeLog}
Network probe path: ${networkProbe}
Socket probe path: ${socketProbe}
Player probe path: ${playerProbe}
Verification output path: ${verificationOutput}
Server-side readiness verifier: npm run verify:production-readiness -- --fxserver-log ${smokeLog} --fxserver-connect-info /tmp/spbox-production-readiness-tests/connect-info.txt --fxserver-network-probe ${networkProbe} --fxserver-socket-probe ${socketProbe} --fxserver-player-probe ${playerProbe} --fxserver-verification-output ${verificationOutput} --require-qbcore --require-qbox
Client-required verifier: npm run verify:production-readiness -- --fxserver-log ${smokeLog} --fxserver-connect-info /tmp/spbox-production-readiness-tests/connect-info.txt --fxserver-network-probe ${networkProbe} --fxserver-socket-probe ${socketProbe} --fxserver-player-probe ${playerProbe} --fxserver-verification-output ${verificationOutput} --require-qbcore --require-qbox --require-client
`),
        "--fxserver-verification-output",
        verificationOutput,
        "--allow-test-fixture",
        "--require-qbcore",
        "--require-qbox",
        "--require-client"
      )
    ).toThrow(/FXServer verification output missing required content/);
  });

  it("rejects saved verifier output missing runner verifier sections", () => {
    const smokeLog = writeSmokeLog();
    const networkProbe = writeNetworkProbe();
    const socketProbe = writeSocketProbe();
    const playerProbe = writePlayerProbe();
    const verificationOutput = writeVerificationOutput(`
Smoke run id: ${smokeRunId}
Verified FXServer smoke transcript: 16 checks passed.
Verified QBCore facade smoke checks.
Verified Qbox facade smoke checks.
Verified client smoke checks.
`);
    expect(() =>
      runVerifier(
        "--provenance",
        writeProvenance("official"),
        "--fxserver-log",
        smokeLog,
        "--fxserver-network-probe",
        networkProbe,
        "--fxserver-socket-probe",
        socketProbe,
        "--fxserver-player-probe",
        playerProbe,
        "--fxserver-connect-info",
        writeConnectInfo(`
FiveM connect target: 192.168.68.102:30120
Smoke run id: ${smokeRunId}
FiveM connect URI: fivem://connect/192.168.68.102:30120
Detected IPv4 addresses: wlo1=192.168.68.102
Bind address: 0.0.0.0
Advertised connect host: 192.168.68.102
Port: 30120
Client checks required: yes
Smoke timeout ms: 180000
Collection window ms: 180000
Transcript path: ${smokeLog}
Network probe path: ${networkProbe}
Socket probe path: ${socketProbe}
Player probe path: ${playerProbe}
Verification output path: ${verificationOutput}
Server-side readiness verifier: npm run verify:production-readiness -- --fxserver-log ${smokeLog} --fxserver-connect-info /tmp/spbox-production-readiness-tests/connect-info.txt --fxserver-network-probe ${networkProbe} --fxserver-socket-probe ${socketProbe} --fxserver-player-probe ${playerProbe} --fxserver-verification-output ${verificationOutput} --require-qbcore --require-qbox
Client-required verifier: npm run verify:production-readiness -- --fxserver-log ${smokeLog} --fxserver-connect-info /tmp/spbox-production-readiness-tests/connect-info.txt --fxserver-network-probe ${networkProbe} --fxserver-socket-probe ${socketProbe} --fxserver-player-probe ${playerProbe} --fxserver-verification-output ${verificationOutput} --require-qbcore --require-qbox --require-client
`),
        "--fxserver-verification-output",
        verificationOutput,
        "--allow-test-fixture",
        "--require-qbcore",
        "--require-qbox",
        "--require-client"
      )
    ).toThrow(/FXServer verification output missing required content/);
  });

  it("requires client-required saved verifier output to include a complete client verifier section", () => {
    const smokeLog = writeSmokeLog();
    const networkProbe = writeNetworkProbe();
    const socketProbe = writeSocketProbe();
    const playerProbe = writePlayerProbe();
    const verificationOutput = writeVerificationOutput(`
Smoke run id: ${smokeRunId}
Server-side FXServer smoke verifier:
Verified FXServer smoke transcript: 11 checks passed.
Verified QBCore facade smoke checks.
Verified Qbox facade smoke checks.
Client-required FXServer smoke verifier:
Verified client smoke checks.
`);
    expect(() =>
      runVerifier(
        "--provenance",
        writeProvenance("official"),
        "--fxserver-log",
        smokeLog,
        "--fxserver-network-probe",
        networkProbe,
        "--fxserver-socket-probe",
        socketProbe,
        "--fxserver-player-probe",
        playerProbe,
        "--fxserver-connect-info",
        writeConnectInfo(`
FiveM connect target: 192.168.68.102:30120
Smoke run id: ${smokeRunId}
FiveM connect URI: fivem://connect/192.168.68.102:30120
Detected IPv4 addresses: wlo1=192.168.68.102
Bind address: 0.0.0.0
Advertised connect host: 192.168.68.102
Port: 30120
Client checks required: yes
Smoke timeout ms: 180000
Collection window ms: 180000
Transcript path: ${smokeLog}
Network probe path: ${networkProbe}
Socket probe path: ${socketProbe}
Player probe path: ${playerProbe}
Verification output path: ${verificationOutput}
Server-side readiness verifier: npm run verify:production-readiness -- --fxserver-log ${smokeLog} --fxserver-connect-info /tmp/spbox-production-readiness-tests/connect-info.txt --fxserver-network-probe ${networkProbe} --fxserver-socket-probe ${socketProbe} --fxserver-player-probe ${playerProbe} --fxserver-verification-output ${verificationOutput} --require-qbcore --require-qbox
Client-required verifier: npm run verify:production-readiness -- --fxserver-log ${smokeLog} --fxserver-connect-info /tmp/spbox-production-readiness-tests/connect-info.txt --fxserver-network-probe ${networkProbe} --fxserver-socket-probe ${socketProbe} --fxserver-player-probe ${playerProbe} --fxserver-verification-output ${verificationOutput} --require-qbcore --require-qbox --require-client
`),
        "--fxserver-verification-output",
        verificationOutput,
        "--allow-test-fixture",
        "--require-qbcore",
        "--require-qbox",
        "--require-client"
      )
    ).toThrow(/FXServer verification output missing required content/);
  });

  it("rejects saved verifier output that preserves failure diagnostics", () => {
    expect(() =>
      runVerifier(
        "--provenance",
        writeProvenance("official"),
        "--fxserver-log",
        writeSmokeLog(),
        "--fxserver-verification-output",
        writeVerificationOutput(`
Smoke run id: ${smokeRunId}
Server-side FXServer smoke verifier:
Verified FXServer smoke transcript: 16 checks passed.
Verified QBCore facade smoke checks.
Verified Qbox facade smoke checks.
Missing FXServer smoke checks:
- client:sdb_runtime:GetQbPlayerData
`),
        "--allow-test-fixture",
        "--require-qbcore",
        "--require-qbox"
      )
    ).toThrow(/FXServer verification output contains failure diagnostics/);
  });

  it("accepts server-side readiness when saved output preserves a later client-required failure section", () => {
    const output = runVerifier(
      "--provenance",
      writeProvenance("official"),
      "--fxserver-log",
      writeSmokeLog(),
      "--fxserver-verification-output",
      writeVerificationOutput(`
Smoke run id: ${smokeRunId}
Server-side FXServer smoke verifier:
Verified FXServer smoke transcript: 11 checks passed.
Verified QBCore facade smoke checks.
Verified Qbox facade smoke checks.
Client-required FXServer smoke verifier:
Missing FXServer smoke checks:
- client:sdb_runtime:GetQbPlayerData
No connected FiveM client evidence found in the FXServer transcript.
`),
      "--allow-test-fixture",
      "--require-qbcore",
      "--require-qbox"
    );

    expect(output).toContain("Production readiness evidence verified");
  });

  it("rejects scaffold provenance or missing FXServer evidence", () => {
    expect(() =>
      runVerifier(
        "--provenance",
        writeProvenance("scaffold"),
        "--fxserver-log",
        writeSmokeLog(),
        "--allow-test-fixture"
      )
    ).toThrow(/official SpacetimeDB bindings are required/);

    expect(() => runVerifier("--provenance", writeProvenance("official"))).toThrow(
      /FXServer smoke log evidence is required/
    );
  });

  it("rejects test fixture smoke logs as production evidence unless explicitly allowed", () => {
    const smokeLog = writeSmokeLog();
    const networkProbe = writeNetworkProbe();
    const socketProbe = writeSocketProbe();
    const playerProbe = writePlayerProbe();
    const verificationOutput = writeVerificationOutput();
    expect(() =>
      runVerifier(
        "--provenance",
        writeProvenance("official"),
        "--fxserver-log",
        smokeLog,
        "--fxserver-network-probe",
        networkProbe,
        "--fxserver-socket-probe",
        socketProbe,
        "--fxserver-player-probe",
        playerProbe,
        "--fxserver-connect-info",
        writeConnectInfo(`
FiveM connect target: 192.168.68.102:30120
Smoke run id: ${smokeRunId}
FiveM connect URI: fivem://connect/192.168.68.102:30120
Detected IPv4 addresses: wlo1=192.168.68.102
Bind address: 0.0.0.0
Advertised connect host: 192.168.68.102
Port: 30120
Client checks required: yes
Smoke timeout ms: 180000
Collection window ms: 180000
Transcript path: ${smokeLog}
Network probe path: ${networkProbe}
Socket probe path: ${socketProbe}
Player probe path: ${playerProbe}
Verification output path: ${verificationOutput}
Server-side readiness verifier: npm run verify:production-readiness -- --fxserver-log ${smokeLog} --fxserver-connect-info /tmp/spbox-production-readiness-tests/connect-info.txt --fxserver-network-probe ${networkProbe} --fxserver-socket-probe ${socketProbe} --fxserver-player-probe ${playerProbe} --fxserver-verification-output ${verificationOutput} --require-qbcore --require-qbox
Client-required verifier: npm run verify:production-readiness -- --fxserver-log ${smokeLog} --fxserver-connect-info /tmp/spbox-production-readiness-tests/connect-info.txt --fxserver-network-probe ${networkProbe} --fxserver-socket-probe ${socketProbe} --fxserver-player-probe ${playerProbe} --fxserver-verification-output ${verificationOutput} --require-qbcore --require-qbox --require-client
`),
        "--fxserver-verification-output",
        verificationOutput,
        "--require-qbcore",
        "--require-qbox",
        "--require-client"
      )
    ).toThrow(/Refusing test fixture smoke log/);
  });
});
