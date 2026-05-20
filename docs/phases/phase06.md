# Phase 06: Controlled Live Plugins

## Goal

Add live plugin code only after the runtime primitives, permissions, audit system, schema registry, and plugin registry are stable.

The original idea:

> Scripts come from SpacetimeDB, stored and loaded in real time.

Safer version:

```txt
Plugin source/bundles are registered in SpacetimeDB.
Runtime downloads verified bundles.
FiveM only runs a stable loader resource.
Plugin logic runs through controlled hooks/actions.
```

## Do Not Live-Load Arbitrary Lua As The Main Model

Live-loading arbitrary Lua directly into FiveM is a remote-code-execution risk. It makes permissions, filesystem access, OS access, database access, and incident response much harder.

The safer model is a plugin sidecar:

```txt
SpacetimeDB
  -> plugin bundle registry
  -> runtime sidecar downloads signed bundle
  -> executes in sandbox
  -> communicates with FiveM only through approved runtime actions
```

This preserves the live plugin experience without turning the game server into an uncontrolled code executor.

## Hard Controls

Runtime code plugins require:

```txt
signed plugin bundles
hash verification
approval workflow
sandboxed sidecar execution
no direct OS access
no arbitrary file access
no direct database writes
capability-based permissions
kill switch
version rollback
audit logging
```

## Bundle Tables

```ts
plugin_bundles
- id
- plugin_id
- version
- artifact_url
- bundle_hash
- signature
- signer_id
- runtime_type // wasm, js_sidecar, native_sidecar
- status
- created_at

plugin_deployments
- id
- plugin_id
- bundle_id
- server_id
- status // pending, active, failed, rolled_back
- desired_version
- active_version
- deployed_at
- error_message

plugin_capabilities
- plugin_id
- capability_key
- constraints_json
- enabled

plugin_sandbox_events
- id
- plugin_id
- server_id
- event_type
- payload_hash
- status
- created_at
```

## Action Envelope

Privileged actions should be signed and replay-resistant:

```ts
runtime_actions
- id
- server_id
- actor_id
- action_type
- payload_hash
- signature
- nonce
- idempotency_key
- status
- created_at
```

Every privileged action should record:

```txt
who called it
from where
what permission allowed it
what plugin initiated it
what changed
whether it succeeded
```

You can encrypt transport and sign actions, but once code runs on a server, that server can inspect its own process. The practical security model is:

```txt
TLS for transport
signed action envelopes
server identity keys
plugin signing
capability-based authorization
audit logs
replay protection
idempotency keys
no direct DB mutation outside reducers
```

## Runtime Flow

Install:

```txt
plugin installed from web
-> bundle metadata stored in SpacetimeDB
-> admin approves deployment
-> runtime sees desired deployment
-> validates signature and hash
-> checks requested capabilities
-> starts sandbox sidecar
-> sidecar registers heartbeat
-> runtime enables hooks/actions
-> audit log written
```

Action:

```txt
hook event occurs
-> runtime sends event to plugin sidecar
-> sidecar returns desired action
-> runtime checks plugin capability
-> runtime validates payload schema
-> runtime checks actor permission if user-scoped
-> reducer/action executes
-> audit log written
```

Rollback:

```txt
new bundle fails health check
-> runtime disables deployment
-> previous signed bundle restored
-> hooks rebound
-> failed deployment audit log written
```

Kill switch:

```txt
admin disables plugin or signer is revoked
-> all deployments stop
-> hooks removed
-> capabilities disabled
-> menu entries hidden
-> sidecar terminated
-> persistent data retained
```

## SpacetimeDB Boundaries

Reducers are the only way to mutate tables and are transactionally safe, but they are intentionally isolated from the outside world. Plugin code that performs HTTP, filesystem work, Discord calls, or other side effects should run outside reducers and call back into reducers through controlled APIs.

For plugin modules that extend the SpacetimeDB schema, require explicit migration manifests and review. Do not allow arbitrary direct writes to system tables or core runtime tables.

## MVP Deliverables

- Signed bundle metadata.
- Capability declarations.
- Deployment state machine.
- Sidecar supervisor.
- Health checks and heartbeat.
- Kill switch.
- Rollback.
- Full audit trail.
- Runtime action envelope validation.

## Killer Demo

```txt
1. Server owner installs only sdb_runtime.
2. Opens web dashboard.
3. Connects Discord guild.
4. Maps Discord Admin role -> group.admin.
5. In-game player with that Discord role instantly gets admin menu.
6. Admin spawns vehicle, changes weather, or gives money.
7. Every action appears in audit logs.
8. Server owner disables the economy plugin from web.
9. Economy menu disappears in-game without editing server.cfg.
10. Re-enable it; it returns live.
```

## References

- [SpacetimeDB reducers](https://spacetimedb.com/docs/functions/reducers/)
- [SpacetimeDB functions](https://spacetimedb.com/docs/functions/)
- [SpacetimeDB subscriptions](https://spacetimedb.com/docs/clients/subscriptions/)
- [FiveM resource manifest](https://docs.fivem.net/docs/scripting-reference/resource-manifest/)
- [FiveM server commands](https://docs.fivem.net/docs/server-manual/server-commands/)
