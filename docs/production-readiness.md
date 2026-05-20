# Production Readiness Gate

This gate defines what must be true before the SpacetimeDB FiveM runtime core should be considered production-ready.

The product is a runtime control plane, not a complete gameplay pack. Production readiness means the core can be deployed, operated, observed, recovered, and extended through primitives without relying on loose scripts or manual server config as the source of truth.

## Core Production Scope

The production-ready core includes:

- Single `sdb_runtime` FiveM resource loader.
- SpacetimeDB module with authoritative reducers and subscribed tables.
- Admin service and HTTP API for runtime operations.
- Server identity, heartbeat, config sync, and action envelope validation.
- Permission graph, Discord-derived principals, and ACE compatibility mirror.
- Live menu runtime with server-side permission re-checks.
- Ledger-backed economy primitives and audited plugin economy API.
- Plugin registry, signed bundle metadata, deployment lifecycle, kill switch, rollback, and sandbox sidecar supervision.
- QBCore compatibility facade sufficient for common resources to run through runtime primitives.
- Audit logs for privileged actions, plugin actions, hook dispatch, deployment lifecycle, and economy mutations.
- Repeatable verification gates for TypeScript, SpacetimeDB Rust, resource fixtures, admin routes, and compatibility shims.

## Out of Scope for Core Production Readiness

Gameplay logic is not part of the core production gate.

Do not block core readiness on building full gameplay systems such as:

- Police, EMS, mechanic, racing, survival, or business job packs.
- Full inventory UI or item catalogue content.
- Complete vehicle dealership, housing, phone, CAD, garage, crafting, or minigame systems.
- Server-specific economy balancing.
- Roleplay rules, progression systems, or world design.
- Marketplace content beyond the package/signing/install primitives.

Those belong as plugins or server-specific packages built on top of the primitives.

## Production Proof Checklist

The framework is not production-ready until these checks have concrete evidence:

| Area | Required Evidence |
| --- | --- |
| Build and tests | `npm test`, `npm run build`, and `cargo check` pass from a clean checkout. |
| Admin boot | `npm run build` followed by `npm run start:admin` boots with documented environment variables and exposes health/admin routes. |
| SpacetimeDB module | The Rust module builds, generated TypeScript bindings are current, and reducer argument-order tests pass. |
| FiveM resource boot | `ensure sdb_runtime` loads the resource, registers exports/events, opens NUI, and rejects client-originated trusted sync events. |
| Control-plane sync | Health, config, permissions, ACE mirror, menu trees, deployments, audits, QBCore queues, and gameplay dispatch queues sync without duplicate replay. |
| Action security | Runtime actions require server identity where configured, reject nonce/idempotency replay, validate payloads, and audit denied/failed/succeeded results. |
| Plugin security | Bundles require trusted signatures, immutable ids, hash verification, capability validation, sidecar policy checks, kill switch, rollback, and sandbox diagnostics. |
| Economy integrity | All money movement goes through ledger transactions with idempotency, balanced debit/credit entries, audit rows, and no direct plugin balance mutation. |
| QBCore parity | Common QBCore resource smoke tests pass through the `qb-core` facade and runtime queues without requiring QBCore as the source of truth. |
| Operations | There is a documented deployment path, environment variable list, log/audit inspection path, backup/recovery procedure, and rollback procedure. |

The deployment path and operator commands live in the [Production Runbook](./production-runbook.md), [FiveM Deployment Checklist](./fivem-deployment-checklist.md), and [Operations Runbook](./operations-runbook.md).

## Evidence Gate

After local gates pass, production readiness is claimed through an evidence-gated command:

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

This command requires:

- `src/spacetime/module_bindings/provenance.json` to report `status: "official"`.
- The official binding provenance to include `generatedAt` and `cliVersion`.
- A real FXServer `sdb_runtime_smoke` transcript with the disposable-runner `Smoke run id:`, FXServer resource lifecycle output, and no `FAIL` lines.
- Optional disposable-runner connect-info evidence, when `--fxserver-connect-info` is supplied, showing the generated connect target, `fivem://connect/...` URI, detected IPv4 addresses, non-empty bind address, smoke timing fields when recorded, non-empty probe paths, and server/client verifier commands with all evidence flags. Recorded timing fields must be numeric, recorded evidence paths must match the supplied verifier arguments, the connect target must match the advertised network/player probe targets and socket port, all recorded primary and alternate connect ports must be integers between `1` and `65535`, the advertised connect host must not be the unresolved `<server-ip>` placeholder, and recorded alternate FiveM connect URIs must be well-formed when present. When connect-info records a client launcher path, the launcher file must belong to the same smoke run, point at the same connect target, and include any recorded alternate FiveM connect URIs. When `--require-client` is used, connect-info must show `Client checks required: yes` and include client launcher evidence.
- Optional disposable-runner network probe evidence, when `--fxserver-network-probe` is supplied, showing HTTP 200 for the local `/info.json` endpoint, the advertised endpoint when present, and any alternate probe targets when present.
- Optional disposable-runner socket probe evidence, when `--fxserver-socket-probe` is supplied, showing TCP and UDP listeners for the FXServer port during the smoke run.
- Optional disposable-runner player probe evidence, when `--fxserver-player-probe` is supplied, showing HTTP 200 for local, advertised, and alternate `/players.json` targets when present, sampled player counts, and the maximum observed player count during the smoke run. The recorded sample count must match the sampled lines, and the maximum observed count must match those samples. When `--require-client` is used, this evidence must show at least one observed player in a sampled `/players.json` line.
- Optional disposable-runner verifier output evidence, when `--fxserver-verification-output` is supplied, showing the saved runner verifier output sections expected by the selected QBCore/Qbox/client flags. This artifact must include a complete server-side verifier section, include a complete client-required verifier section when `--require-client` is used, and must not contain verifier failure diagnostics in the section being treated as passing evidence.
- Client-required production readiness requires the complete disposable-runner evidence bundle: connect-info, network probe, socket probe, player probe, and saved verifier output.
- The FXServer transcript and all supplied disposable-runner evidence artifacts must include the same UUID-shaped `Smoke run id:` value so mixed artifacts from different smoke attempts are rejected.
- Runtime, QBCore facade, Qbox facade, fixture resources, client join/connect markers, and client smoke checks when `--require-qbcore --require-qbox --require-client` are used.

To create that transcript with the pinned disposable Linux FXServer runner, provide a valid Keymaster value for `sv_licenseKey` through the environment:

```sh
SDB_FIVEM_LICENSE_KEY="your-keymaster-key" npm run smoke:fxserver-core
```

The runner stages only the production core resources and compatibility fixtures, writes `fxserver-smoke.log`, writes `connect-info.txt`, writes `fxserver-network-probe.txt`, writes `fxserver-socket-probe.txt`, writes `fxserver-player-probe.txt`, stamps runner artifacts with a shared smoke run id, then invokes the same smoke transcript verifier.

## Current Production Gap

The core has runnable verification and operator documentation for the listed production checks. Official SpacetimeDB bindings are generated and recorded in provenance. Production readiness still requires a real FXServer smoke transcript with client checks before `npm run verify:production-readiness -- --require-client` can pass for a deployment. The local run authenticated with a valid Keymaster key, started the core resources, and passed the server-side QBCore/Qbox smoke verifier; a connected FiveM client is still required to emit the client smoke lines.
