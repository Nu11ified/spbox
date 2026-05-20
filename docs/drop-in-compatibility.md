# Drop-In Compatibility

SPBox closes the QBCore/Qbox drop-in gap by treating the top-level `server.cfg` as the install source of truth and converting existing resources into local plugin packages automatically.

The goal is not to rewrite every community script. The goal is to make the normal install path trivial:

1. copy the existing FiveM resource,
2. add `ensure resource_name` to the normal top-level `server.cfg`,
3. restart `sdb_runtime` or the server,
4. let the admin connector scan and install the ensured resources.

On restart, `sdb_runtime` POSTs `/resources/reconcile` to the admin connector. The admin connector reads the configured top-level `server.cfg`, scans only the ensured resources, imports bundled SQL, installs local plugin packages, and enables them in cfg order.

## Automatic Mode

Configure the admin connector with the FXServer config and resources root:

```sh
SDB_FXSERVER_CFG=/path/to/server.cfg \
SDB_FXSERVER_RESOURCES_ROOT=/path/to/resources \
npm run start:admin
```

Set this in the top-level `server.cfg` so `sdb_runtime` can request reconciliation whenever it restarts:

```cfg
set sdb_admin_endpoint "http://127.0.0.1:8787"

ensure sdb_runtime
ensure qb-core
ensure qbx_core
ensure oxmysql
ensure my_legacy_resource
```

Manual CLI commands are no longer the normal path. The CLI remains useful for inspecting generated plans before a production migration.

## Inspect A Resource Or Resource Folder

```sh
npm run import:legacy-resource -- --root path/to/resources --out path/to/spbox-plugin-import.json
```

If `--root` points at a single resource, the importer emits one plan. If it points at a resources folder, it finds every child resource with `fxmanifest.lua` or `__resource.lua`.

The automatic reconciler and inspection command both produce the same plan shape:

- plugin manifest identity,
- FiveM dependencies, files, NUI page, and provided resources,
- approved schemas generated from supported legacy SQL,
- local package metadata for the marketplace/package installer,
- install steps for copy, install, schema registration, enable, and ensure,
- warnings for compatibility-facade dependencies or unsupported SQL.

## Compatibility Facades

Existing ecosystem resources should keep depending on the names they already know:

- `qb-core`
- `qbx_core`
- `oxmysql`
- `qb-inventory`
- `menuv`

SPBox provides those compatibility resources while SpacetimeDB remains the authoritative state layer.

## Marketplace Direction

The package registry is the SPBox marketplace foundation. Existing QBCore/Qbox resources can be represented as `local` or `community` packages with generated manifests first, then promoted to signed `marketplace` packages after smoke testing.

A marketplace entry should include:

- the original resource source,
- generated SPBox manifest,
- SQL import manifest,
- smoke-test evidence,
- compatibility warnings,
- required facades.

## Rule

Drop-in means adding an `ensure` line is enough for normal resources. It does not mean arbitrary SQL or undocumented framework internals bypass SPBox state. Unsupported behavior should become a reproduced compatibility test, then a facade or importer patch.
