# QBCore Hybrid Demo Server

This demo uses SPBox as the framework state layer and runs real QBCore resources on top through compatibility facades.

Install the upstream demo resources:

```sh
npm run install:qbcore-demo
```

The installer writes a disposable server layout under:

```txt
cache/qbcore-demo
```

It copies SPBox resources into `resources/[spbox]` and `resources/[compat]`, then fetches pinned upstream resources into `resources/[qb]` and `resources/[standalone]`.

It also scans upstream `.sql` files and writes `spbox-sql-manifest.json`. That manifest is the framework compatibility contract used to register plugin schemas; SQL files are not loaded into MySQL.

## Stack

- `sdb_runtime` remains the SPBox runtime and QBCore state bridge.
- `qb-core` is the SPBox QBCore compatibility facade, not upstream `qb-core`.
- `oxmysql` is an SPBox facade. SQL-shaped calls from real QBCore resources are mapped into local demo tables and mirrored into SpacetimeDB plugin entities under `sdb_qbcore_real_plugins`.
- `qb-inventory` is a minimal facade that routes item mutations to `sdb_runtime`.
- `menuv` is a minimal facade for `qb-adminmenu` so the real admin menu resource can start without vendoring a built MenuV package.
- Real upstream resources include `qb-multicharacter`, `qb-spawn`, `qb-apartments`, `qb-clothing`, `qb-weathersync`, `qb-menu`, `qb-input`, `qb-adminmenu`, `qb-banking`, `qb-hud`, `qb-vehicleshop`, `qb-garages`, and `qb-vehiclekeys`.

## Runtime Order

Use the generated `cache/qbcore-demo/server.cfg` as the starting point. The important order is:

```cfg
ensure chat
ensure sdb_runtime
ensure oxmysql
ensure qb-core
ensure qb-inventory

ensure PolyZone
ensure menuv
ensure qb-interior
ensure qb-menu
ensure qb-input
ensure qb-weathersync
ensure qb-spawn
ensure qb-apartments
ensure qb-clothing
ensure qb-multicharacter
ensure qb-adminmenu
ensure qb-banking
ensure qb-hud
ensure qb-vehicleshop
ensure qb-garages
ensure qb-vehiclekeys
```

Set this convar when the admin connector is running so real plugin state mirrors into SpacetimeDB:

```cfg
set sdb_poc_admin_endpoint "http://127.0.0.1:8787"
```

The generated config also sets `sdb_admin_endpoint`. When the admin connector is started with `SDB_FXSERVER_CFG` and `SDB_FXSERVER_RESOURCES_ROOT`, restarting `sdb_runtime` automatically reconciles the top-level `ensure` list into SPBox plugin packages and SQL schemas.

## Current Scope

This is a compatibility demo, not a production pack. It proves real QBCore resources can sit on top of SPBox while SPBox owns player selection, character state, money/item mutation queues, and plugin data persistence. The MySQL compatibility layer currently targets the SQL patterns used by the selected demo resources rather than arbitrary SQL.
