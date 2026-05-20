# Operations Runbook

This runbook covers core runtime operations for production incidents and recovery. It is scoped to the SpacetimeDB FiveM runtime control plane, signed plugin lifecycle, and deployable resources.

Verify this document stays aligned with admin routes before deployment:

```sh
npm run verify:operations-runbook
```

## Backup Scope

Back up these artifacts together so a restored deployment can match the authoritative control-plane state:

- SpacetimeDB database snapshots.
- Generated TypeScript bindings used by the deployed admin connector.
- Admin connector environment variables, excluding raw secrets when your secret manager stores them separately.
- Server identity public keys and signer ids.
- Plugin bundle artifacts, signatures, signer ids, manifest hashes, and package metadata.
- FXServer resource versions for `resources/[runtime]/sdb_runtime` and `resources/[compat]/qb-core`.
- Last known output from `GET /deployments`.

Minimum pre-backup checks:

```sh
npm test
npm run verify:spacetime-bindings
npm run verify:fivem-deployment
npm run verify:operations-runbook
npm run build
```

## Recovery Sequence

1. Restore the SpacetimeDB database snapshot.
2. Deploy the matching admin connector build and generated bindings.
3. Restore environment variables and signer configuration.
4. Start the admin connector with `npm run start:admin`.
5. Start FXServer with `ensure sdb_runtime`; add `ensure qb-core` only when compatibility mode is required.
6. Confirm the dashboard and deployment state:

```sh
curl -fsS http://127.0.0.1:8787/servers/prod-main/dashboard
curl -fsS http://127.0.0.1:8787/deployments
```

7. Confirm config, permission, menu, deployment, QBCore shared data, and QBCore PlayerData sync reaches the runtime resource.
8. Run a denied privileged action and an allowed privileged action, then confirm both audit rows are visible through `/audit`.

## Deployment Snapshot

Read the current deployment state before and after every plugin incident action:

```sh
curl -fsS http://127.0.0.1:8787/deployments
```

Expected evidence:

- Active deployments list the intended plugin id, bundle id, server id, version, and status.
- Killed, failed, or rolled-back deployments carry an explicit status and reason.
- Sandbox diagnostics are present when a sidecar failed, stopped, or missed heartbeats.

## Lifecycle Route Summary

| Operation | Route |
| --- | --- |
| Deployment snapshot | `GET /deployments` |
| Signer revocation | `POST /signers/<signerId>/revoke` |
| Bundle revocation | `POST /bundles/<bundleId>/revoke` |
| Plugin kill switch | `POST /plugins/<pluginId>/kill` |
| Manual rollback | `POST /plugins/<pluginId>/rollback` |
| Health-failure handling | `POST /deployments/<deploymentId>/fail` |

## Signer Revocation

Use signer revocation when a bundle signer is compromised and every bundle signed by that signer should stop being deployable.

```sh
curl -fsS -X POST http://127.0.0.1:8787/signers/<signerId>/revoke \
  -H 'content-type: application/json' \
  -d '{"actorId":"operator:security","serverId":"prod-main","reason":"compromised signer"}'
```

Expected evidence:

- Active or pending deployments signed by the revoked signer return with `status: "killed"`.
- Future deployment requests for that signer fail closed.
- Audit search shows `plugin.signer_revoked`.
- Audit search shows `plugin.deployment_killed` for affected active or pending deployments.

## Bundle Revocation

Use bundle revocation when one signed version is bad but the signer and other versions remain trusted.

```sh
curl -fsS -X POST http://127.0.0.1:8787/bundles/<bundleId>/revoke \
  -H 'content-type: application/json' \
  -d '{"actorId":"operator:security","serverId":"prod-main","reason":"bad release"}'
```

Expected evidence:

- Only deployments using the revoked bundle are killed.
- The bundle row is no longer deployable.
- Rollback skips the revoked bundle.
- Audit search shows `plugin.bundle_revoked`.
- Audit search shows `plugin.deployment_killed` for affected deployments.

## Plugin Kill Switch

Use the kill switch when the plugin id itself should stop running, including pending deployments.

```sh
curl -fsS -X POST http://127.0.0.1:8787/plugins/<pluginId>/kill \
  -H 'content-type: application/json' \
  -d '{"actorId":"operator:security","reason":"compromised plugin"}'
```

Expected evidence:

- Active and pending deployments for the plugin return with `status: "killed"`.
- Sidecar reconciliation stops killed deployments.
- Capability reads for the plugin fail closed or disappear from the active surface.
- Audit search shows `plugin.kill_switch`.
- Audit search shows `plugin.deployment_killed`.

## Manual Rollback

Use rollback only after verifying the previous bundle and signer are still trusted.

```sh
curl -fsS -X POST http://127.0.0.1:8787/plugins/<pluginId>/rollback \
  -H 'content-type: application/json' \
  -d '{"serverId":"prod-main"}'
```

Expected evidence:

- The restored deployment uses the previous trusted bundle/version.
- Revoked bundles and revoked signer history are skipped.
- The superseded active deployment is no longer active.
- Audit search shows `plugin.deployment_rollback`.

## Health-Failure Handling

Use deployment failure when runtime or sidecar health proves a rollout is bad and the system should restore the previous trusted deployment if available.

```sh
curl -fsS -X POST http://127.0.0.1:8787/deployments/<deploymentId>/fail \
  -H 'content-type: application/json' \
  -d '{"actorId":"operator:health","reason":"sidecar heartbeat expired"}'
```

Expected evidence:

- The failed deployment carries `status: "failed"` and the supplied reason.
- A previous trusted deployment is restored when available.
- Pending deployments can be failed without creating duplicate rollback rows.
- Audit search shows the failed deployment lifecycle row and any rollback row.

## Audit Review

Use audit search after each operation:

```sh
curl -fsS 'http://127.0.0.1:8787/audit?actionType=plugin.signer_revoked'
curl -fsS 'http://127.0.0.1:8787/audit?actionType=plugin.bundle_revoked'
curl -fsS 'http://127.0.0.1:8787/audit?actionType=plugin.kill_switch'
curl -fsS 'http://127.0.0.1:8787/audit?actionType=plugin.deployment_rollback'
```

Every privileged operation must leave enough evidence to answer:

- Who initiated the operation.
- Which signer, bundle, plugin, deployment, or server was affected.
- What reason was supplied.
- Which deployments were killed, failed, or restored.
- Whether sidecar diagnostics were mirrored.
