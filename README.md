# SPBox

SPBox is an experimental FiveM roleplay framework that uses SpacetimeDB as the authoritative state layer instead of MySQL. The goal is to provide QBCore/Qbox-compatible server behavior while making framework state durable, externally accessible, auditable, and easier to synchronize across tools.

## Goals

- Run existing QBCore and Qbox-style resources through compatibility facades.
- Keep characters, money, inventory, jobs, permissions, plugin data, and runtime state in SpacetimeDB.
- Make resource installation mostly drop-in by reading the top-level `server.cfg` `ensure` list and importing resource metadata and SQL automatically.
- Expose framework state to external apps through the admin/control plane and SpacetimeDB-backed APIs.
- Build toward full practical parity with QBCore and Qbox while keeping SPBox's state model safer and more observable.

## Current Status

SPBox currently includes:

- `sdb_runtime`, the FiveM runtime/control-plane resource.
- `qb-core` and `qbx_core` compatibility facades.
- `oxmysql`, `qb-inventory`, and `menuv` compatibility shims.
- SpacetimeDB tables/reducers for runtime, plugins, permissions, economy, gameplay, characters, inventory, menus, and audit data.
- QBCore-shaped player data, character selection, money, inventory, job, gang, callback, command, shared-data, and usable-item compatibility paths.
- Legacy SQL import that converts supported SQL into SPBox plugin schema/migration metadata.
- Automatic resource reconciliation from `server.cfg` via `sdb_runtime` and the admin connector.
- A browser admin panel and HTTP admin API.
- A real QBCore hybrid demo installer using pinned upstream QBCore resources.
- Test coverage for core behavior, compatibility facades, SpacetimeDB adapters, deployment checks, and migration tooling.

## Parity

The project is working toward full practical QBCore and Qbox parity. Common framework surfaces are covered, and representative QBCore/Qbox compatibility fixtures are tested. Some third-party resources may still depend on undocumented framework behavior or unusual SQL patterns.

If a resource does not work, please open an issue with:

- the resource name and version or commit,
- the relevant `server.cfg` ensures,
- startup/runtime logs,
- any SQL files included by the resource,
- the expected QBCore/Qbox behavior.

Compatibility gaps should be fixed with a reproduced test case.

## License

SPBox is licensed under the Apache License 2.0. See [LICENSE](./LICENSE).
