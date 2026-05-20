# Production Runbook

This runbook is for proving and operating the core SpacetimeDB FiveM runtime. It intentionally covers the runtime/control-plane system, not server-specific gameplay content.

## Build Verification

Run these from the repository root before packaging or deploying:

```sh
npm test
npm run verify:spacetime-bindings
npm run verify:fivem-deployment
npm run verify:operations-runbook
npm run build
npm run smoke:admin-local
npm run smoke:production-core
cd spacetimedb && cargo check
```

Expected result:

- TypeScript tests pass.
- Checked-in official TypeScript bindings match the Rust module's public SpacetimeDB tables and reducers.
- FiveM resource manifests, deployment files, QBCore facade dependency/provide behavior, and trusted event guards pass the deployment verifier.
- Backup, recovery, signer revocation, bundle revocation, kill switch, rollback, and health-failure operator procedures match the admin lifecycle routes.
- TypeScript compiles to `dist/`.
- The local admin HTTP integration smoke boots a localhost listener and verifies dashboard, config, action queue, and query-filtered drain routes.
- The local production-core smoke verifies dashboard, plugin registry, and deployment admin routes.
- The SpacetimeDB Rust module checks successfully.

## Required Core Services

Production core deployment has three moving pieces:

| Component | Purpose |
| --- | --- |
| SpacetimeDB module | Authoritative tables, reducers, subscriptions, runtime config, permissions, economy, plugins, and audit rows. |
| Admin connector | HTTP/admin panel, runtime service facade, SpacetimeDB adapter, optional FiveM sync loop. |
| FiveM runtime resource | Single FXServer resource that receives trusted sync events, exposes exports, opens NUI, and applies runtime actions. |

## Admin Connector Environment

`npm run start:admin` reads these environment variables:

| Variable | Required | Purpose |
| --- | --- | --- |
| `SDB_ADMIN_PORT` | No | Admin HTTP port. Defaults to `8787`. |
| `SDB_ADMIN_HOST` | No | Bind host. Defaults to `127.0.0.1`. |
| `SDB_SERVER_ID` | No | Runtime server id registered in the control plane. Defaults to `local-dev`. |
| `SDB_SERVER_NAME` | No | Human-readable server name. Defaults to `Local Development`. |
| `SDB_ENVIRONMENT` | No | Environment label. Defaults to `development`. |
| `SDB_SERVER_PUBLIC_KEY` | No | Server public key recorded in runtime server registration. Defaults to `local-dev-public-key`. |
| `SDB_PLUGIN_SIGNERS` | No | Comma-separated `signerId:secret` list for signed plugin bundles. |
| `SDB_PLUGIN_PACKAGE_SIGNERS` | No | Comma-separated `signerId:secret` list for marketplace/community package manifests. |
| `SDB_PLUGIN_APPROVED_SANDBOX_CAPABILITIES` | No | Comma-separated sandbox capability exceptions, such as approved network sidecar capability names. |
| `SDB_SPACETIME_URI` | Together | SpacetimeDB URI. Must be set with database and bindings module. |
| `SDB_SPACETIME_DATABASE` | Together | SpacetimeDB database name. Must be set with URI and bindings module. |
| `SDB_SPACETIME_BINDINGS_MODULE` | Together | JS module exporting generated `DbConnection` and `tables`. |
| `SDB_SPACETIME_TOKEN` | No | SpacetimeDB auth token when required by the target deployment. |
| `SDB_SPACETIME_CONFIRMED_READS` | No | `true` or `false`; passed to generated SpacetimeDB connection options. |
| `SDB_FIVEM_SYNC_ENABLED` | No | Set to `true` to start the FiveM sync loop. |
| `SDB_FIVEM_SYNC_INTERVAL_MS` | No | FiveM sync loop interval. Defaults to `1000`. |
| `SDB_FIVEM_COMMAND_ENDPOINT` | No | HTTP endpoint that executes FXServer commands. Enables direct command posting. |
| `SDB_FIVEM_COMMAND_TOKEN` | No | Bearer/shared token for `SDB_FIVEM_COMMAND_ENDPOINT`. |

SpacetimeDB variables are all-or-nothing: `SDB_SPACETIME_URI`, `SDB_SPACETIME_DATABASE`, and `SDB_SPACETIME_BINDINGS_MODULE` must be set together.

## Admin Connector Boot

Build and start the connector:

```sh
npm run build
SDB_ADMIN_HOST=0.0.0.0 \
SDB_ADMIN_PORT=8787 \
SDB_SERVER_ID=prod-main \
SDB_SERVER_NAME="Production Main" \
SDB_ENVIRONMENT=production \
SDB_SERVER_PUBLIC_KEY="$SDB_SERVER_PUBLIC_KEY" \
npm run start:admin
```

Expected output includes:

```txt
sdb admin connector listening on http://0.0.0.0:8787/admin/
```

Smoke check the admin API:

```sh
npm run smoke:admin-local
npm run smoke:production-core
```

The local admin smoke command starts a real localhost HTTP listener on an ephemeral port and checks:

- `GET /servers/<server-id>/dashboard`
- `POST /servers/<server-id>/config`
- `POST /gameplay/kicks`
- `POST /gameplay/kicks/drain?serverId=<server-id>`

The production-core smoke command runs an in-process admin connector check against:

- `GET /servers/<server-id>/dashboard`
- `GET /plugins/registry`
- `GET /deployments`

For the live HTTP process, verify the same routes over the network:

```sh
curl -fsS http://127.0.0.1:8787/servers/prod-main/dashboard
curl -fsS http://127.0.0.1:8787/plugins/registry
curl -fsS http://127.0.0.1:8787/deployments
```

## SpacetimeDB Binding Contract

The admin connector expects generated bindings to export:

- `DbConnection`
- `tables`

The checked-in official bindings live at:

```txt
src/spacetime/module_bindings/index.ts
```

Binding provenance lives at:

```txt
src/spacetime/module_bindings/provenance.json
```

Regenerate bindings with:

```sh
npm run generate:spacetime-bindings
```

Successful official generation rewrites `provenance.json` with `status: "official"`, the CLI version, timestamp, module path, and output directory.

The generator also normalizes generated imports for this repository's NodeNext TypeScript build. The `spacetimedb` npm package is required by the generated client.

Then rerun:

```sh
npm run verify:spacetime-bindings
npm test
npm run build
```

## FiveM Resource Install

Detailed FXServer resource checks live in the [FiveM Deployment Checklist](./fivem-deployment-checklist.md).

Install the runtime resource into FXServer:

```txt
resources/[runtime]/sdb_runtime
```

The core server config should only need:

```cfg
ensure sdb_runtime
```

For QBCore compatibility, add the facade resource when needed:

```cfg
ensure sdb_runtime
ensure qb-core
```

The `qb-core` facade must depend on `sdb_runtime`; it is compatibility glue, not the source of truth.

For real FXServer validation, add the smoke resource temporarily:

```cfg
ensure sdb_runtime
ensure qb-core
ensure qbx_core
ensure sdb_runtime_smoke
ensure sdb_qbcore_fixture
ensure sdb_qbox_fixture
```

Then run `sdb_runtime_smoke` from the server console and confirm all emitted smoke lines report `PASS`.

For a disposable Linux validation run with the pinned FXServer artifact, set a real FiveM Keymaster key and run:

```sh
SDB_FIVEM_LICENSE_KEY="your-keymaster-key" npm run smoke:fxserver-core
```

The helper stages only the core runtime, QBCore facade, Qbox facade, smoke resource, and compatibility fixtures, captures `/tmp/spbox-fxserver-smoke/fxserver-smoke.log`, and runs the transcript verifier. The transcript must include FXServer resource lifecycle output for the core resources plus the SPBox smoke `PASS` lines; a smoke-only fixture file is not production evidence.
Runs without `--prepare-only` fail preflight before staging FXServer when `SDB_FIVEM_LICENSE_KEY` is missing; use `--prepare-only` only when you intentionally want to stage files without launching FXServer.
`--prepare-only` still validates generated-evidence inputs such as port, timing values, and client-required connect host before staging files.
The pinned FXServer tarball is cached under `/tmp/spbox-fxserver-artifact-cache` by default. Override that location with `SDB_FXSERVER_ARTIFACT_CACHE_DIR` or `--artifact-cache-dir`.
Runs fail preflight before staging FXServer when `SDB_FXSERVER_ARTIFACT_URL` or `--artifact-url` is blank or whitespace-only.
The verifier stdout/stderr from the run is saved to `/tmp/spbox-fxserver-smoke/fxserver-smoke-verification.txt`. Client-required runs save the server-side verifier result first, then append the client-required verifier result so failed client attempts retain both the QBCore/Qbox server proof and the missing-client diagnostics with the transcript. Production readiness requires saved verifier output used as passing evidence to include the runner's complete server-side section, include a complete client-required section when `--require-client` is used, and contain no verifier failure diagnostics in the section being treated as passing evidence.
The runner stamps `fxserver-smoke.log` and each runner evidence artifact with the same UUID-shaped `Smoke run id:` value so production readiness can reject malformed or mixed transcripts, probes, connect-info, or verifier output from different attempts.

By default, the runner waits for the full smoke timeout when client checks are required so an operator can connect a FiveM client and let the fixture resources emit client smoke lines. Override the collection window with `SDB_FXSERVER_SMOKE_COLLECT_MS` or `--collect-ms` when running server-only checks.
For shortened client-required attempts, set `SDB_FXSERVER_CLIENT_GRACE_MS` or `--client-grace-ms` to keep the server open for an additional no-client grace window when the sampled player probe has not observed any players. The runner extends its effective process timeout to cover startup, the collection window, and that grace window.
Runs fail preflight before staging FXServer when `SDB_FXSERVER_SMOKE_TIMEOUT_MS` or `SDB_FXSERVER_SMOKE_COLLECT_MS` is not a positive finite number, or when `SDB_FXSERVER_CLIENT_GRACE_MS` is not a non-negative finite number.
During client-required runs, the runner repeats the `fivem://connect/...` target while waiting so the operator can connect before the timeout expires. When operator-facing alternate IPv4 targets are detected, such as Tailscale, the terminal output and reminders print those alternate FiveM URIs too.

The runner binds to `127.0.0.1:30120` by default. For a client on another machine, expose the FXServer port and run with `SDB_FXSERVER_BIND_ADDRESS=0.0.0.0`, set `SDB_FXSERVER_CONNECT_HOST` to this machine's reachable LAN or public IP, and, if needed, set `SDB_FXSERVER_PORT=30120` or `--port 30120`.
Runs fail preflight before staging FXServer when `SDB_FXSERVER_BIND_ADDRESS` or `--bind-address` is blank or whitespace-only.
Runs fail preflight before staging FXServer when `SDB_FXSERVER_CONNECT_HOST` or `--connect-host` is blank or whitespace-only.
Runs fail preflight before staging FXServer when `SDB_FXSERVER_PORT` or `--port` is not an integer between `1` and `65535`.
Client-required runs fail preflight before staging FXServer when the advertised connect host is still the unresolved `<server-ip>` placeholder.
The generated `connect-info.txt` includes both the `host:port` target, a `fivem://connect/host:port` URI for launching FiveM directly, alternate FiveM connect URIs for operator-facing interfaces, the path to `connect-launcher.html`, and detected non-loopback IPv4 addresses from the runner host so operators can spot a wrong advertised host.
The generated `connect-launcher.html` contains the clickable FiveM launch URI plus alternate detected IPv4 launch links for operator-facing interfaces such as Tailscale, and browser-side `/info.json` and `/players.json` checks for each listed connect target. Use the reachability table to pick a target the operator machine can reach before launching FiveM.
For the final client-required gate, `connect-info.txt` must show `Client checks required: yes` and a `Client launcher path:`; server-only connect-info is not valid client-required evidence.
The paths recorded in `connect-info.txt` must be non-empty and must match the transcript, probe, and verifier-output paths supplied to `verify:production-readiness`. The generated connect target and `fivem://connect/...` URI must also match the advertised `/info.json` and `/players.json` probe targets plus the socket-probe port, the advertised connect host must not be the unresolved `<server-ip>` placeholder, and recorded alternate FiveM connect URIs must be well-formed when present. When `connect-info.txt` records `Client launcher path:`, production readiness verifies that launcher file has the same smoke run id, `fivem://connect/...` target, and any recorded alternate FiveM connect URIs. The verifier commands recorded in `connect-info.txt` must include all evidence flags, including network and socket probes.
The `Bind address:` recorded in `connect-info.txt` must be non-empty.
All primary and alternate connect ports recorded in `connect-info.txt` must be integers between `1` and `65535`.
The smoke timing fields recorded in `connect-info.txt` must be numeric, with positive timeout, collection, and effective timeout values plus a non-negative client grace window.
Client-required production readiness requires the complete runner evidence bundle: `connect-info.txt`, `fxserver-network-probe.txt`, `fxserver-socket-probe.txt`, `fxserver-player-probe.txt`, and `fxserver-smoke-verification.txt`.
The transcript and all supplied runner artifacts must carry the same UUID-shaped `Smoke run id:` value; production readiness rejects malformed or mixed log, connect-info, probe, or verifier-output evidence from different smoke attempts.
The runner also writes `/tmp/spbox-fxserver-smoke/fxserver-network-probe.txt` with local, advertised, and alternate `/info.json` probe results for the disposable FXServer, `/tmp/spbox-fxserver-smoke/fxserver-socket-probe.txt` with live TCP/UDP listener evidence for the FXServer port, and `/tmp/spbox-fxserver-smoke/fxserver-player-probe.txt` with local, advertised, and alternate `/players.json` reachability, sampled player counts, and the maximum observed player count. Production readiness verifies that alternate probe targets report HTTP 200 when present, that the recorded sample count matches the sampled lines, and that the maximum observed count matches those samples. Client-required readiness treats a supplied player probe with no sampled players as a no-client failure. Local `/info.json` reachability and TCP/UDP socket evidence are required by default; use `SDB_FXSERVER_REQUIRE_NETWORK_PROBE=0` or `--no-require-network-probe` only for unusual hosts where the probe endpoint is intentionally unavailable, and `SDB_FXSERVER_REQUIRE_SOCKET_PROBE=0` or `--no-require-socket-probe` only when `ss` socket inspection is intentionally unavailable.
If the verifier reports `No connected FiveM client evidence found`, the transcript did not contain a client join/connect signal; rerun the smoke and connect the client while the runner is still waiting. Client-required evidence must include both the join/connect marker and the client smoke `PASS` lines.
If it reports `A FiveM client connection was seen, but required client smoke checks are still missing`, the server observed a client but the client-side smoke resource or fixture events did not complete. Client-required evidence includes the explicit `client:sdb_runtime_smoke:loaded` marker before export checks, so inspect the FiveM F8 console and fixture client scripts for runtime errors.

Capture the FXServer console output and verify the transcript:

```sh
npm run verify:fxserver-smoke-log -- path/to/fxserver-smoke.log --require-qbcore --require-qbox --require-client
```

Once the FXServer transcript exists, run the production evidence gate:

```sh
npm run verify:production-readiness -- \
  --fxserver-log path/to/fxserver-smoke.log \
  --fxserver-connect-info path/to/connect-info.txt \
  --fxserver-network-probe path/to/fxserver-network-probe.txt \
  --fxserver-socket-probe path/to/fxserver-socket-probe.txt \
  --fxserver-player-probe path/to/fxserver-player-probe.txt \
  --fxserver-verification-output path/to/fxserver-smoke-verification.txt \
  --require-qbcore \
  --require-qbox \
  --require-client
```

Before packaging resources, run:

```sh
npm run verify:fivem-deployment
```

## FiveM Sync Modes

For command-log mode, leave `SDB_FIVEM_COMMAND_ENDPOINT` unset. The admin connector prints `sdb_runtime_emit ...` commands that an operator or host integration can execute.

For direct HTTP command execution, set:

```sh
SDB_FIVEM_SYNC_ENABLED=true
SDB_FIVEM_COMMAND_ENDPOINT=https://fxserver.example.internal/commands
SDB_FIVEM_COMMAND_TOKEN="$COMMAND_TOKEN"
```

The command executor only posts trusted `sdb_runtime_emit` commands generated by the runtime connector.

## Operational Checks

Before considering a server production-ready, verify:

- Admin dashboard returns current server health.
- Runtime config sync reaches `sdb_runtime` and acknowledgements update.
- Permission sync and ACE mirror commands are emitted or applied.
- Menu tree sync reaches a connected player principal.
- A privileged menu action is denied without permission and succeeds with permission.
- Economy mutations create transactions, balanced ledger entries, and audit rows.
- Plugin deployment approval starts sidecar reconciliation only after signature/hash/capability checks.
- Signer revocation, bundle revocation, plugin kill switch, and rollback all produce audit rows.
- The `sdb_runtime_smoke` FXServer smoke resource reports `PASS` for runtime exports and optional QBCore facade exports.
- QBCore facade smoke coverage passes for the compatibility resources you intend to run.

## Backup and Recovery

Detailed operator procedures live in the [Operations Runbook](./operations-runbook.md).

Minimum backup scope:

- SpacetimeDB database snapshots.
- Generated bindings version used by the deployed admin connector.
- Admin connector environment variables and signer ids.
- Plugin bundle artifacts, signatures, and manifest hashes.
- FXServer resource versions for `sdb_runtime` and compatibility facades.

Recovery sequence:

1. Restore the SpacetimeDB database.
2. Deploy the matching admin connector build and generated bindings.
3. Start `npm run start:admin`.
4. Start FXServer with `ensure sdb_runtime`.
5. Confirm dashboard health and sync status.
6. Reconcile plugin deployments and sidecars from the control plane.
7. Run a denied-action and allowed-action smoke test.

## Rollback and Incident Response

For plugin incidents:

1. Revoke the signer or bundle from the admin API/panel.
2. Confirm active deployments are killed or failed.
3. Confirm sidecar instances stop and sandbox events are mirrored.
4. Confirm menu/actions/capabilities disappear from the target server.
5. Roll back to the previous signed bundle only if the signer and bundle are still trusted.
6. Review runtime audit rows for the affected actor, plugin, hook, and action ids.

For runtime incidents:

1. Stop the FiveM sync loop.
2. Keep SpacetimeDB online for audit inspection.
3. Disable affected plugins or capabilities.
4. Restart `sdb_runtime`.
5. Restart the admin connector.
6. Re-enable sync after health, permissions, menu, and deployment snapshots match expected state.
