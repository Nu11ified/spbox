# Missing Core Items

This is the finite remaining core list. When these items are complete, stop expanding the framework and move to real server testing.

The core target is only:

- `sdb_runtime` as the authoritative SpacetimeDB-backed runtime.
- Compatibility facades needed to place SPBox into an FXServer and test existing QBCore/Qbox-style scripts.
- Production evidence that the runtime boots and the compatibility facades work inside real FXServer.

Do not add full gameplay packs, job systems, phone, housing, garage, CAD, inventory UI, racing, police, EMS, mechanic, or marketplace content to this list. Those are plugins or server-specific packages.

## CORE-01: Qbox/QBX Compatibility Facade

Status: complete.

Build a thin Qbox compatibility resource over the existing runtime primitives, matching the same approach used for `resources/[compat]/qb-core`.

Required output:

- `resources/[compat]/qbx_core`
- `fxmanifest.lua` with the correct compatibility provide/dependency behavior.
- Server exports for the common Qbox/QBX script surface that can be backed by current runtime state.
- Client player data support for Qbox-style scripts that import or read Qbox player data.
- Tests proving the facade exists, provides the expected resource name, depends on `sdb_runtime`, and delegates into runtime-owned data.
- Deployment checklist entries for Qbox compatibility mode.

Grounding:

- Current Qbox docs expose `qbx_core` server exports such as player data mutation and lookup helpers.
- Current Qbox docs also document client-side `@qbx_core/modules/playerdata.lua`, which creates and updates a `QBX.PlayerData` global.
- Source references:
  - https://docs.qbox.re/resources/qbx_core/exports/server
  - https://docs.qbox.re/resources/qbx_core/modules/playerdata
  - https://docs.qbox.re/resources/qbx_core/exports/shared

Done condition:

- A Qbox/QBX script can depend on `qbx_core` and call the implemented facade exports without installing upstream Qbox as the source of truth.
- Local tests and `npm run verify:fivem-deployment` pass with Qbox coverage.

Evidence:

- `resources/[compat]/qbx_core`
- `tests/qbox-compat-resource.test.ts`
- `scripts/verify-fivem-deployment.mjs`

## CORE-02: Real Compatibility Fixture Scripts

Status: complete.

Add small test resources that behave like normal third-party scripts instead of only static source assertions.

Required output:

- A QBCore fixture resource that calls `exports['qb-core']:GetCoreObject()`, player lookup, callbacks, usable items, shared data, money/inventory methods, and vehicle helpers through SPBox.
- A Qbox fixture resource that calls the supported `qbx_core` exports/modules through SPBox.
- Both fixtures run inside FXServer smoke mode and print explicit `PASS`/`FAIL` lines.
- The smoke log verifier checks for these fixture lines.

Done condition:

- The fixtures prove existing-style QBCore and Qbox scripts can start against SPBox compatibility facades.
- The fixtures do not add gameplay content; they only verify compatibility surfaces.

Evidence:

- `resources/[test]/sdb_qbcore_fixture`
- `resources/[test]/sdb_qbox_fixture`
- `scripts/verify-fxserver-smoke-log.mjs`
- `tests/fxserver-smoke-log-verifier.test.ts`

## CORE-03: Real FXServer Smoke Evidence

Status: complete.

Run the runtime in a real FXServer, not only Vitest or local Node smoke tests.

Required output:

- Install only the core resources needed for the test:

```txt
resources/[runtime]/sdb_runtime
resources/[compat]/qb-core
resources/[compat]/qbx_core
resources/[test]/sdb_runtime_smoke
resources/[test]/sdb_qbcore_fixture
resources/[test]/sdb_qbox_fixture
```

- Start with the simplest server config:

```cfg
ensure sdb_runtime
ensure qb-core
ensure qbx_core
ensure sdb_runtime_smoke
ensure sdb_qbcore_fixture
ensure sdb_qbox_fixture
```

- Run the smoke command from the FXServer console.
- Save the console transcript, including FXServer resource lifecycle output for the ensured resources.
- Verify it locally:

```sh
npm run verify:fxserver-smoke-log -- path/to/fxserver-smoke.log --require-qbcore --require-qbox --require-client
npm run verify:production-readiness -- --fxserver-log path/to/fxserver-smoke.log --fxserver-connect-info path/to/connect-info.txt --fxserver-network-probe path/to/fxserver-network-probe.txt --fxserver-socket-probe path/to/fxserver-socket-probe.txt --fxserver-player-probe path/to/fxserver-player-probe.txt --fxserver-verification-output path/to/fxserver-smoke-verification.txt --require-qbcore --require-qbox --require-client
```

Done condition:

- No `FAIL` lines in the FXServer transcript.
- Production readiness verifier passes using the real FXServer transcript.

Current evidence:

- A disposable FXServer artifact was staged locally with a valid Keymaster license key.
- FXServer authenticated the license, created script environments, and started `sdb_runtime`, `qb-core`, `qbx_core`, `sdb_runtime_smoke`, `sdb_qbcore_fixture`, and `sdb_qbox_fixture`.
- The repeatable runner now keeps FXServer stdin open, sends the smoke commands, captures the transcript, and verifies real server-side QBCore/Qbox fixture checks.
- The runner writes `fxserver-network-probe.txt` with `/info.json` reachability results for the local and advertised disposable FXServer target, and requires the local probe by default.
- The runner writes `fxserver-socket-probe.txt` with live TCP and UDP listener evidence for the disposable FXServer port, and requires that socket evidence by default.
- The runner writes `fxserver-player-probe.txt` with local and advertised `/players.json` reachability, sampled player counts, and the maximum observed player count for the disposable FXServer run.
- Production readiness now rejects supplied player-probe evidence where the recorded sample count does not match the sampled lines or the maximum observed player count does not match those samples.
- Client-required production readiness now rejects supplied player-probe evidence where no sampled `/players.json` line observed a connected player.
- Client-required production readiness now rejects supplied `connect-info.txt` from server-only runs where `Client checks required` is not `yes`.
- Client-required production readiness now requires the full disposable-runner evidence bundle: connect-info, network probe, socket probe, player probe, and saved verifier output.
- Client-required production readiness now requires `connect-info.txt` to include a client launcher path for the generated `connect-launcher.html` evidence.
- Production readiness now rejects `connect-info.txt` whose recorded transcript, probe, or verifier-output paths are blank or do not match the supplied evidence arguments.
- Production readiness now rejects `connect-info.txt` whose generated connect target, `fivem://connect/...` URI, advertised probe targets, or socket-probe port disagree, or whose advertised host is still the unresolved `<server-ip>` placeholder.
- Production readiness now rejects `connect-info.txt` whose recorded `connect-launcher.html` path is blank, from another smoke run, or points at a different `fivem://connect/...` target.
- Production readiness now rejects `connect-info.txt` whose recorded verifier commands omit required evidence flags, including network and socket probes.
- Production readiness now rejects supplied disposable-runner artifacts whose `Smoke run id:` values do not match, preventing mixed evidence from different smoke attempts.
- The runner now stamps the FXServer transcript itself with the same `Smoke run id:` as connect-info, probes, and saved verifier output, and production readiness rejects a transcript from a different smoke attempt.
- Production readiness now rejects malformed non-UUID smoke run ids in runner evidence before accepting same-run proof.
- Production readiness now rejects saved verifier-output evidence that is missing the runner verifier sections or contains verifier failure diagnostics.
- The current real probe confirms `HTTP 200` for both `http://127.0.0.1:30120/info.json` and `http://192.168.68.102:30120/info.json`.
- A live smoke run was confirmed listening on both TCP and UDP `0.0.0.0:30120` while advertising `fivem://connect/192.168.68.102:30120`.
- Client-required runs save server-side verifier PASS output first, then append the client-required verifier result in `fxserver-smoke-verification.txt`, so no-client attempts still preserve same-run QBCore/Qbox server proof.
- The smoke resource now prints explicit `playerConnecting`/`playerJoining` markers and re-triggers all client fixture checks after a player joins, so a client-present failure can be distinguished from no-client evidence.
- Client-required smoke verification now requires `client:sdb_runtime_smoke:loaded` before client export checks, so a connected-client failure can distinguish a client resource load problem from later QBCore/Qbox fixture failures.
- Runner invocations now fail preflight before staging FXServer when `SDB_FXSERVER_BIND_ADDRESS` or `--bind-address` is blank or whitespace-only.
- Runner invocations now fail preflight before staging FXServer when `SDB_FXSERVER_CONNECT_HOST` or `--connect-host` is blank or whitespace-only.
- Runner invocations now fail preflight before staging FXServer when `SDB_FXSERVER_ARTIFACT_URL` or `--artifact-url` is blank or whitespace-only.
- Runner invocations now fail preflight before staging FXServer when `SDB_FIVEM_LICENSE_KEY` is missing, while `--prepare-only` remains available for staging without a key.
- Runner invocations now fail preflight before staging FXServer when `SDB_FXSERVER_PORT` or `--port` is not an integer between `1` and `65535`.
- Runner invocations now fail preflight before staging FXServer when timeout or collection windows are not positive finite numbers, or client grace is not a non-negative finite number.
- `--prepare-only` skips launch-only requirements but still validates generated-evidence inputs such as port, timing values, and client-required connect host before staging files.
- Client-required runner invocations now fail preflight before staging FXServer when the advertised connect host is still the unresolved `<server-ip>` placeholder.
- The latest client-required run on 2026-05-20 had smoke run id `df19f99f-970a-431a-b9d6-dd0739cfbf2e`, bound to `0.0.0.0:30120`, advertised as `fivem://connect/192.168.68.102:30120`, recorded alternate URI `fivem://connect/100.71.161.17:30120`, wrote same-run `connect-info.txt` plus `connect-launcher.html` evidence with browser-side `/info.json` and `/players.json` checks, waited through the 300s collection window and part of the 600s no-client grace window, observed a connected player in `/players.json`, recorded `Player count observed: 1`, `Max player count observed: 1`, and `Player samples observed: 159`, emitted `playerJoining: 1`, emitted `client:sdb_runtime_smoke:loaded`, and passed all 17 server/client QBCore/Qbox smoke checks.
- Client-required production readiness now passes with the real FXServer transcript, connect-info, network probe, socket probe, player probe, saved verifier output, QBCore/Qbox flags, and `--require-client`.

Repeatable runner:

```sh
SDB_FIVEM_LICENSE_KEY="your-keymaster-key" npm run smoke:fxserver-core
```

This command downloads the pinned Linux FXServer artifact, stages only the core runtime, compatibility facades, and smoke fixtures under `/tmp/spbox-fxserver-smoke`, captures `fxserver-smoke.log`, and runs the transcript verifier with `--require-qbcore --require-qbox --require-client`.

## CORE-04: Final Core Gate And Stop

Status: complete.

Run the final core gates once, record the result, and stop.

Required commands:

```sh
npm test
npm run verify:spacetime-bindings
npm run verify:fivem-deployment
npm run verify:operations-runbook
npm run build
npm run smoke:admin-local
npm run smoke:production-core
(cd spacetimedb && cargo check)
npm run verify:production-readiness -- --fxserver-log path/to/fxserver-smoke.log --fxserver-connect-info path/to/connect-info.txt --fxserver-network-probe path/to/fxserver-network-probe.txt --fxserver-socket-probe path/to/fxserver-socket-probe.txt --fxserver-player-probe path/to/fxserver-player-probe.txt --fxserver-verification-output path/to/fxserver-smoke-verification.txt --require-qbcore --require-qbox --require-client
```

Done condition:

- All commands pass.
- `docs/implementation-status.md` says the missing core list is complete.
- No new feature slices are opened unless a real QBCore/Qbox script fails against the facade and produces a concrete failing test.

Current evidence:

- The final gate commands passed on 2026-05-20: `npm test`, `npm run verify:spacetime-bindings`, `npm run verify:fivem-deployment`, `npm run verify:operations-runbook`, `npm run build`, `npm run smoke:admin-local`, `npm run smoke:production-core`, `(cd spacetimedb && cargo check)`, and client-required `npm run verify:production-readiness`.

## Explicit Stop Line

After CORE-04 passes, stop core development.

The next step is not more framework construction. The next step is placing SPBox in an FXServer with real QBCore/Qbox scripts and only fixing reproduced compatibility failures.
