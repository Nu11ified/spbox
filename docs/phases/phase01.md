# Phase 01: Runtime Core

## Goal

Create the stable FiveM resource and SpacetimeDB bridge that everything else uses.

The visible server-owner experience should be one resource:

```txt
resources/[runtime]/sdb_runtime
```

The server config should eventually only need:

```cfg
ensure sdb_runtime
```

Internally, the runtime can still be modular:

```txt
sdb_runtime
  /client
  /server
  /modules
    permissions
    menu
    economy
    inventory
    connector_discord
    plugin_host
```

FiveM resources are collections of files with client scripts, server scripts, assets, and an `fxmanifest.lua`. They can be started, stopped, restarted, and grouped under bracketed folders in `resources/`. The runtime should use that native resource model instead of fighting it.

## Architecture

```txt
FiveM Server
  -> sdb_runtime
       -> permission engine
       -> menu runtime
       -> economy runtime
       -> plugin registry
       -> config registry
       -> event/action bus
       -> Discord connector
       -> web/admin connector
       -> SpacetimeDB bridge
```

External shape:

```txt
[FiveM Client]
     <-> 
[FiveM Server: sdb_runtime]
     <-> 
[SpacetimeDB Runtime Module]
     <-> 
[Web Admin Panel] [Discord Bot] [Plugin Marketplace] [Audit Logs] [Live Config UI]
```

The intended shift:

```txt
server.cfg stops being the source of truth
loose MySQL scripts stop being the source of truth
random resource configs stop being the source of truth

SpacetimeDB becomes the live authority
```

## SpacetimeDB Fit

SpacetimeDB is a good fit because its model is table and reducer centered:

- Tables hold persistent state.
- Public tables can be subscribed to by clients.
- Private tables stay visible only to reducers and the database owner.
- Reducers are the primary way to mutate state.
- Reducers run transactionally and roll back on failure.
- Subscriptions mirror selected rows to clients and push updates in real time.

Important constraint: reducers are isolated and should not perform external I/O such as HTTP requests, filesystem access, or system calls. Anything that talks to Discord, FiveM, webhooks, object storage, or a plugin sandbox should run in a connector, sidecar, procedure where appropriate, or the FiveM resource process, then call reducers for state changes.

## FiveM Runtime Surface

The resource should expose a small, stable interface:

```lua
exports('HasPermission', HasPermission)
exports('CallAction', CallAction)
exports('GetConfig', GetConfig)
exports('RegisterLocalHandler', RegisterLocalHandler)
```

It should also own these network surfaces:

- client-to-server action requests
- server-to-client menu/config updates
- NUI callbacks for in-game UI
- admin command hooks
- heartbeat and health events

FiveM supports Lua, JavaScript, and C# script runtimes. A pragmatic MVP can use Lua for client/server integration and either JavaScript or a sidecar process for richer SpacetimeDB client handling if the official SDK support is better there.

## Core Tables

```ts
servers
- id
- name
- environment
- public_key
- status
- last_heartbeat_at

runtime_instances
- id
- server_id
- resource_version
- fxserver_build
- game_build
- status
- started_at
- last_seen_at

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
- completed_at

audit_logs
- id
- server_id
- actor_id
- plugin_id
- action_type
- permission_key
- target_type
- target_id
- before_json
- after_json
- status
- created_at

runtime_config
- id
- server_id
- namespace
- key
- value_json
- version
- updated_at
```

## Reducers

```txt
register_server
heartbeat
submit_action
complete_action
write_audit_log
set_runtime_config
ack_config_version
```

All privileged state changes should enter through reducers so they are atomic, auditable, and visible through subscriptions.

## Runtime Flow

```txt
FXServer starts
-> ensure sdb_runtime
-> resource reads local bootstrap config
-> runtime authenticates server identity
-> runtime opens SpacetimeDB subscriptions
-> runtime receives initial config, permissions, plugins, and menus
-> runtime starts heartbeat
-> runtime exposes exports and events to local resources
```

## Implementation Notes

- Keep local config limited to bootstrap values: database host, module name, server identity, and signing key path.
- Treat SpacetimeDB subscriptions as the live cache source.
- Keep reducer calls idempotent where retries are possible.
- Use action envelopes for privileged work.
- Include `server_id`, `actor_id`, `plugin_id`, and `idempotency_key` everywhere.
- Do not rely on reducer global/static state; store durable state in tables.
- Do not put connector side effects inside reducers.

## MVP Deliverables

- `sdb_runtime` FiveM resource with `fxmanifest.lua`.
- SpacetimeDB runtime module.
- Server registration and heartbeat.
- Subscription client and local cache.
- Action bus skeleton.
- Audit log table and reducer.
- Health status visible in a web/admin client.

## References

- [FiveM introduction to resources](https://docs.fivem.net/docs/scripting-manual/introduction/introduction-to-resources/)
- [FiveM resource manifest](https://docs.fivem.net/docs/scripting-reference/resource-manifest/)
- [SpacetimeDB tables](https://spacetimedb.com/docs/tables/)
- [SpacetimeDB reducers](https://spacetimedb.com/docs/functions/reducers/)
- [SpacetimeDB subscriptions](https://spacetimedb.com/docs/clients/subscriptions/)
