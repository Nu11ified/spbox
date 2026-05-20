# Phase 05: Plugin Registry

## Goal

Build a plugin system based on manifests, registered primitives, schema declarations, permissions, config, and hooks before allowing dynamic runtime code.

This phase should deliver the "one visible script" experience:

```cfg
ensure sdb_runtime
```

Then the web panel controls:

```txt
installed plugins
enabled plugins
permissions
menus
economy modules
connectors
server config
```

## Plugin Levels

### Level 1: Data-Only Plugins

Safest.

A plugin can define:

```txt
items
menus
permissions
jobs
shops
vehicles
locations
config schemas
```

No custom code. Just data and runtime primitives.

Example:

```json
{
  "plugin_id": "mechanic_core",
  "permissions": ["mechanic.repair", "mechanic.invoice"],
  "menus": [
    {
      "label": "Repair Vehicle",
      "permission": "mechanic.repair",
      "action": "vehicle.repair"
    }
  ],
  "items": [
    {
      "key": "engine_oil",
      "label": "Engine Oil"
    }
  ]
}
```

### Level 2: Reducer-Backed Plugins

The plugin ships or declares SpacetimeDB reducer-backed behavior:

```txt
on_vehicle_damaged
on_item_used
on_player_clocked_in
on_business_sale
```

This is powerful but needs versioning and migration rules.

### Level 3: Runtime Code Plugins

Most dangerous. Do not make this the MVP. Phase 06 handles it with signing, sandboxing, and capabilities.

## Registry Tables

```ts
plugins
- id
- name
- version
- status // installed, active, disabled, failed
- trust_level
- signature
- bundle_hash
- created_by
- created_at
- updated_at

plugin_manifests
- plugin_id
- manifest_json
- required_permissions
- required_tables
- required_hooks
- required_connectors
- schema_version

plugin_runtime_instances
- plugin_id
- server_id
- status
- loaded_at
- last_heartbeat
- error_message

plugin_config_values
- plugin_id
- server_id
- key
- value_json
- version
- updated_at

plugin_hooks
- id
- plugin_id
- hook_name
- handler_type // action, reducer, sidecar
- handler_ref
- priority
- enabled
```

## Schema Registry

"No manual schema changes" is achievable, but plugins should not randomly mutate core tables.

Use a plugin schema registry:

```txt
core schema is stable
plugins get namespaced extension tables
plugin data can be JSON/typed schema registered at install
migrations are declared in plugin manifest
runtime applies migrations through approved reducers/admin workflow
```

Example:

```ts
plugin_schemas
- plugin_id
- schema_version
- table_name
- schema_json
- migration_plan
- status
```

For MVP, use namespaced JSON extension tables:

```ts
plugin_entities
- id
- plugin_id
- entity_type
- owner_type
- owner_id
- data_json
- created_at
- updated_at
```

Later, make this typed and optimized.

## Install Flow

```txt
plugin installed from web
-> manifest stored in SpacetimeDB
-> runtime sees plugin status = active
-> validates manifest requirements
-> registers menus, permissions, config, hooks
-> applies approved schema entries
-> audit log written
```

Disable flow:

```txt
plugin status = disabled
-> runtime unsubscribes hooks
-> removes menu entries
-> removes temporary permissions
-> stops sidecar/runtime instance if present
-> keeps persistent data unless explicitly deleted
-> audit log written
```

## FiveM Compatibility

FiveM manifests can declare exports, dependencies, files, NUI pages, and runtime constraints. The plugin registry should understand those concepts even if the server owner only sees `sdb_runtime`.

Useful mappings:

```txt
FiveM export -> runtime export/action
FiveM dependency -> plugin dependency
NUI page -> plugin UI panel
server command -> permission-gated runtime action
resource provide -> compatibility shim
```

The runtime can eventually use `provide` for compatibility shims, but the MVP should avoid pretending to be too many existing resources at once.

## MVP Deliverables

- Plugin manifest schema.
- Install, enable, disable, and uninstall reducers.
- Registered permissions and menu entries.
- Config schema and config editor.
- Hook registry.
- Namespaced plugin entity storage.
- Runtime plugin status subscriptions.
- Audit log for plugin lifecycle operations.

## References

- [FiveM resource manifest](https://docs.fivem.net/docs/scripting-reference/resource-manifest/)
- [FiveM finding resources](https://docs.fivem.net/docs/server-manual/finding-resources/)
- [SpacetimeDB tables](https://spacetimedb.com/docs/tables/)
- [SpacetimeDB functions](https://spacetimedb.com/docs/functions/)
