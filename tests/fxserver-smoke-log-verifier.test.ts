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

function writeLog(name: string, content: string): string {
  const dir = join(tmpdir(), "spbox-fxserver-smoke-log-tests");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, name);
  writeFileSync(path, content);
  return path;
}

function runVerifier(path: string, ...args: string[]): string {
  return execFileSync("node", ["scripts/verify-fxserver-smoke-log.mjs", path, ...args], {
    cwd: process.cwd(),
    encoding: "utf8"
  });
}

function verifierFailure(path: string, ...args: string[]): string {
  try {
    runVerifier(path, ...args);
  } catch (error) {
    return String((error as Error).message);
  }

  throw new Error("expected verifier to fail");
}

const fxserverLifecycleLines = `
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
`;

describe("FXServer smoke log verifier", () => {
  it("is exposed as a package verification command", () => {
    expect(packageJson.scripts["verify:fxserver-smoke-log"]).toBe(
      "node scripts/verify-fxserver-smoke-log.mjs"
    );
  });

  it("accepts a complete runtime, QBCore, Qbox, and fixture smoke transcript", () => {
    const path = writeLog(
      "passing.log",
      `
${fxserverLifecycleLines}
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

    expect(
      runVerifier(path, "--allow-test-fixture", "--require-qbcore", "--require-qbox", "--require-client")
    ).toContain("Verified FXServer smoke transcript");
    expect(runVerifier(path, "--allow-test-fixture", "--require-qbox")).toContain(
      "Verified Qbox facade smoke checks"
    );
  });

  it("rejects synthetic smoke-only fixtures without FXServer resource lifecycle evidence", () => {
    const synthetic = writeLog(
      "synthetic.log",
      `
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

    expect(() =>
      runVerifier(
        synthetic,
        "--allow-test-fixture",
        "--require-qbcore",
        "--require-qbox",
        "--require-client"
      )
    ).toThrow(/Missing FXServer resource lifecycle evidence/);
  });

  it("rejects known test fixture paths as production smoke evidence", () => {
    const fixture = writeLog(
      "fixture-path.log",
      `
${fxserverLifecycleLines}
[sdb_runtime_smoke] PASS sdb_runtime:GetHealth
[sdb_runtime_smoke] PASS sdb_runtime:GetConfig
[sdb_runtime_smoke] PASS sdb_runtime:HasPermission
[sdb_runtime_smoke] PASS sdb_runtime:GetQbShared
`
    );

    expect(() => runVerifier(fixture)).toThrow(/Refusing test fixture smoke log/);
  });

  it("rejects failed smoke checks and missing required checks", () => {
    const failed = writeLog(
      "failed.log",
      `
${fxserverLifecycleLines}
[sdb_runtime_smoke] PASS sdb_runtime:GetHealth
[sdb_runtime_smoke] FAIL sdb_runtime:GetConfig: expected missing config to return nil
`
    );

    expect(() =>
      runVerifier(failed, "--allow-test-fixture", "--require-qbcore", "--require-client")
    ).toThrow(
      /Failed FXServer smoke checks/
    );

    const incomplete = writeLog(
      "incomplete.log",
      `
${fxserverLifecycleLines}
[sdb_runtime_smoke] PASS sdb_runtime:GetHealth
[sdb_runtime_smoke] PASS sdb_runtime:GetConfig
[sdb_runtime_smoke] PASS sdb_runtime:HasPermission
[sdb_runtime_smoke] PASS sdb_runtime:GetQbShared
`
    );

    expect(() =>
      runVerifier(incomplete, "--allow-test-fixture", "--require-qbcore", "--require-client")
    ).toThrow(
      /Missing FXServer smoke checks/
    );
  });

  it("explains when client-required smoke has no client connection evidence", () => {
    const noClient = writeLog(
      "no-client.log",
      `
${fxserverLifecycleLines}
[sdb_runtime_smoke] PASS sdb_runtime:GetHealth
[sdb_runtime_smoke] PASS sdb_runtime:GetConfig
[sdb_runtime_smoke] PASS sdb_runtime:HasPermission
[sdb_runtime_smoke] PASS sdb_runtime:GetQbShared
[sdb_runtime_smoke] PASS qb-core:GetCoreObject
[sdb_runtime_smoke] PASS fixture:qbcore:server-core-object
[sdb_runtime_smoke] PASS fixture:qbcore:server-player-methods
[sdb_runtime_smoke] PASS fixture:qbcore:server-callbacks-items-vehicles
`
    );

    expect(() =>
      runVerifier(noClient, "--allow-test-fixture", "--require-qbcore", "--require-client")
    ).toThrow(/No connected FiveM client evidence found/);
  });

  it("rejects client smoke pass lines without client connection evidence", () => {
    const noClientConnection = writeLog(
      "client-pass-without-join.log",
      `
${fxserverLifecycleLines}
[sdb_runtime_smoke] PASS sdb_runtime:GetHealth
[sdb_runtime_smoke] PASS sdb_runtime:GetConfig
[sdb_runtime_smoke] PASS sdb_runtime:HasPermission
[sdb_runtime_smoke] PASS sdb_runtime:GetQbShared
[sdb_runtime_smoke] PASS qb-core:GetCoreObject
[sdb_runtime_smoke] PASS fixture:qbcore:server-core-object
[sdb_runtime_smoke] PASS fixture:qbcore:server-player-methods
[sdb_runtime_smoke] PASS fixture:qbcore:server-callbacks-items-vehicles
[sdb_runtime_smoke] PASS client:sdb_runtime:GetQbPlayerData
[sdb_runtime_smoke] PASS client:sdb_runtime:GetQbShared
[sdb_runtime_smoke] PASS client:qb-core:GetCoreObject
[sdb_runtime_smoke] PASS fixture:qbcore:client:core-object-playerdata
`
    );

    expect(() =>
      runVerifier(noClientConnection, "--allow-test-fixture", "--require-qbcore", "--require-client")
    ).toThrow(/No connected FiveM client evidence found/);
  });

  it("explains when a client connected but did not emit client smoke checks", () => {
    const connectedNoSmoke = writeLog(
      "connected-no-smoke.log",
      `
${fxserverLifecycleLines}
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
`
    );

    const failure = verifierFailure(
      connectedNoSmoke,
      "--allow-test-fixture",
      "--require-qbcore",
      "--require-client"
    );
    expect(failure).toMatch(/A FiveM client connection was seen, but required client smoke checks are still missing/);
    expect(failure).not.toMatch(/No connected FiveM client evidence found/);
  });

  it("requires explicit smoke client loaded evidence when client checks are required", () => {
    const missingLoaded = writeLog(
      "client-checks-without-loaded.log",
      `
${fxserverLifecycleLines}
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
[sdb_runtime_smoke] PASS client:sdb_runtime:GetQbPlayerData
[sdb_runtime_smoke] PASS client:sdb_runtime:GetQbShared
[sdb_runtime_smoke] PASS client:qb-core:GetCoreObject
[sdb_runtime_smoke] PASS fixture:qbcore:client:core-object-playerdata
`
    );

    expect(() =>
      runVerifier(missingLoaded, "--allow-test-fixture", "--require-qbcore", "--require-client")
    ).toThrow(/client:sdb_runtime_smoke:loaded/);
  });
});
