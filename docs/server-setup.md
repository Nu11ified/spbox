# SPBox Server Setup

This guide explains how to run SPBox as the framework core for a FiveM server and how to add native SPBox, QBCore, and Qbox resources.

SPBox is the runtime and state framework. SpacetimeDB is the authoritative data layer. Compatibility resources named `qb-core`, `qbx_core`, `oxmysql`, `qb-inventory`, and `menuv` exist so existing ecosystem resources can keep calling the APIs they already expect while SPBox owns the underlying state.

## Architecture

The intended flow is:

```txt
FiveM resource
  -> SPBox native API or compatibility facade
  -> sdb_runtime
  -> admin connector
  -> SpacetimeDB module
```

For native SPBox resources, the resource talks to `sdb_runtime` and the admin connector directly.

For QBCore resources, the resource calls names like `exports['qb-core']:GetCoreObject()` or `exports['qb-core']:GetShared()`. SPBox provides a local `qb-core` facade with `provide 'qb-core'`. That facade is not upstream QBCore; it adapts QBCore-shaped calls into `sdb_runtime`.

For Qbox resources, the resource calls `qbx_core` exports/modules. SPBox provides a local `qbx_core` facade that routes those calls into the same runtime state.

For SQL-backed legacy resources, SPBox provides `oxmysql`. SQL is imported as plugin schema metadata and SQL-shaped runtime calls are mirrored into SPBox plugin data where supported. MySQL should not become the source of truth.

## Prerequisites

- Node.js and npm.
- Docker, for the local SpacetimeDB demo path.
- The `spacetime` CLI when publishing the module and generating official bindings.
- A FiveM FXServer artifact and a valid server license key for real client testing.

Install dependencies and build:

```sh
npm install
npm run build
```

## Local SpacetimeDB Demo

For local development, start an in-memory SpacetimeDB container, publish the SPBox module, build the admin connector, and start the admin panel:

```sh
npm run start:spacetime-demo
```

This uses:

```txt
SpacetimeDB: http://127.0.0.1:3005
Admin panel: http://127.0.0.1:8787/admin/
```

For production or persistent development, run SpacetimeDB with persistent storage, publish `spacetimedb/`, generate official bindings, and start the admin connector with:

```sh
npm run generate:spacetime-bindings
npm run build

SDB_ADMIN_HOST=0.0.0.0 \
SDB_ADMIN_PORT=8787 \
SDB_SERVER_ID=main \
SDB_SERVER_NAME="Main Server" \
SDB_ENVIRONMENT=production \
SDB_SPACETIME_URI="http://127.0.0.1:3000" \
SDB_SPACETIME_DATABASE="spbox-main" \
SDB_SPACETIME_BINDINGS_MODULE="file:///absolute/path/to/spbox/dist/src/spacetime/module_bindings/index.js" \
npm run start:admin
```

Set `SDB_SPACETIME_TOKEN` too if your SpacetimeDB deployment requires auth.

## FXServer Resource Layout

Copy the SPBox runtime and compatibility resources into your FXServer resources folder:

```txt
resources/[spbox]/sdb_runtime
resources/[compat]/qb-core
resources/[compat]/qbx_core
resources/[compat]/oxmysql
resources/[compat]/qb-inventory
resources/[compat]/menuv
```

For a quick demo layout with pinned upstream QBCore resources:

```sh
npm run install:qbcore-demo
```

That writes:

```txt
cache/qbcore-demo
```

Use its generated `server.cfg` as a reference.

## Base server.cfg

The important rule is that `sdb_runtime` starts before compatibility facades and gameplay resources.

```cfg
sv_hostname "SPBox Server"
endpoint_add_tcp "0.0.0.0:30120"
endpoint_add_udp "0.0.0.0:30120"
sv_maxclients 32
set onesync on

set sdb_server_id "main"
set sdb_admin_endpoint "http://127.0.0.1:8787"
set sdb_poc_admin_endpoint "http://127.0.0.1:8787"

ensure sdb_runtime

# Compatibility facades. Enable only the surfaces your resources need.
ensure oxmysql
ensure qb-core
ensure qbx_core
ensure qb-inventory
ensure menuv

# Native SPBox resources.
ensure sdb_poc_chat
ensure sdb_poc_suite

# Existing QBCore/Qbox/community resources.
ensure qb-menu
ensure qb-input
ensure qb-spawn
ensure qb-clothing
```

Do not put the license key in committed files. Supply it through your normal FXServer launch environment or private server config.

## Automatic Plugin Import

SPBox treats the top-level `server.cfg` as the install source of truth.

Start the admin connector with the FXServer config and resources root:

```sh
SDB_FXSERVER_CFG=/absolute/path/to/server.cfg \
SDB_FXSERVER_RESOURCES_ROOT=/absolute/path/to/resources \
npm run start:admin
```

Then set this in `server.cfg`:

```cfg
set sdb_admin_endpoint "http://127.0.0.1:8787"
```

When `sdb_runtime` starts or restarts, it requests `/resources/reconcile`. The admin connector reads the top-level `ensure` list, scans the ensured resources, imports supported SQL, registers schemas, installs local plugin packages, and enables plugins in cfg order.

The normal install path should be:

1. Copy a resource into the resources folder.
2. Add `ensure resource_name` to `server.cfg`.
3. Restart `sdb_runtime` or restart the server.
4. Check the admin panel or `/plugins/registry`.

Manual import commands are for inspection and debugging:

```sh
npm run import:legacy-resource -- --root /path/to/resources --out /tmp/spbox-plugin-import.json
npm run import:legacy-sql -- --root /path/to/resources --out /tmp/spbox-sql-manifest.json
```

## Native SPBox Plugins

Native SPBox plugins should depend on `sdb_runtime` and write durable state through the admin connector or runtime exports.

Use native plugins when you are building new SPBox-first features such as:

- chat,
- economy,
- menus,
- admin tools,
- permissions,
- gameplay services,
- external app integrations.

Recommended pattern:

```txt
resources/[spbox]/my_plugin/
  fxmanifest.lua
  client/main.lua
  server/main.lua
  web/
```

In `fxmanifest.lua`:

```lua
fx_version 'cerulean'
game 'gta5'

dependency 'sdb_runtime'

client_script 'client/main.lua'
server_script 'server/main.lua'
```

Native plugins should register plugin metadata, schemas, config, and entities through the admin connector. The proof-of-concept resources under `resources/[poc]` show this pattern.

## QBCore Plugins

For existing QBCore resources:

1. Copy the resource into your resources folder.
2. Keep its normal dependencies in `fxmanifest.lua`.
3. Ensure SPBox facades before the resource.
4. Add the resource to the top-level `server.cfg`.
5. Restart `sdb_runtime` or the server so reconciliation imports metadata and SQL.

Minimum QBCore compatibility order:

```cfg
ensure sdb_runtime
ensure oxmysql
ensure qb-core
ensure qb-inventory

ensure your_qb_resource
```

Use `menuv` if the resource expects MenuV, and keep standalone dependencies like `PolyZone`, `qb-menu`, or `qb-input` in the same order the original resource expects.

The `qb-core` resource in SPBox is a facade. It should stay thin. If a QBCore plugin fails because an export or shared table is missing, add that behavior to the facade and route state into `sdb_runtime` instead of modifying the upstream plugin.

## Qbox Plugins

For existing Qbox resources:

1. Copy the resource into your resources folder.
2. Ensure `sdb_runtime` and `qbx_core` first.
3. Keep any normal Qbox dependencies the resource expects.
4. Add the resource to `server.cfg`.
5. Restart `sdb_runtime` or the server.

Minimum Qbox compatibility order:

```cfg
ensure sdb_runtime
ensure qbx_core

ensure your_qbox_resource
```

The `qbx_core` resource is also a facade. It exposes Qbox-shaped exports/modules while SPBox remains authoritative.

## SQL Files

Do not manually load legacy `.sql` files into MySQL for SPBox-owned state.

SPBox scans SQL from ensured resources and converts supported table definitions into plugin schema metadata. The generated `spbox-sql-manifest.json` is the compatibility contract. Runtime SQL calls through `oxmysql` are compatibility calls and should be mirrored into SPBox plugin data where supported.

If SQL import fails:

- keep the original `.sql` file with the resource,
- capture the importer warning,
- open an issue with the resource name, SQL file, and expected behavior,
- add a compatibility test before broadening SQL support.

## Verifying A Server

After startup:

```sh
curl -fsS http://127.0.0.1:8787/health
curl -fsS http://127.0.0.1:8787/plugins/registry
curl -fsS http://127.0.0.1:30120/info.json
```

Check FXServer logs for:

```txt
Started resource sdb_runtime
Started resource qb-core
Started resource qbx_core
[sdb_runtime] resource reconcile requested
```

For scripted smoke testing:

```sh
SDB_FIVEM_LICENSE_KEY="your-private-key" npm run smoke:fxserver-core
```

## Compatibility Rule

If a QBCore or Qbox resource does not work, do not fork it first. Treat the failure as a compatibility gap:

1. Identify the missing export, event, shared table, SQL pattern, or player method.
2. Add a focused test.
3. Implement the behavior in the SPBox facade, importer, or runtime.
4. Keep the third-party resource unchanged whenever possible.

That is how SPBox gets closer to drop-in compatibility while keeping SpacetimeDB as the framework core.
