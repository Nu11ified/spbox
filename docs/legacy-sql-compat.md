# Legacy SQL Compatibility

SPBox treats legacy resource SQL as compatibility metadata, not as a second source of truth.

When a QBCore-style resource ships `.sql` files, the framework importer scans those files, parses supported `CREATE TABLE` statements, and converts them into approved plugin schema declarations. Runtime reads and writes still flow through SPBox compatibility facades and SpacetimeDB-backed plugin entities.

## Supported

- `CREATE TABLE` and `CREATE TABLE IF NOT EXISTS`
- Column names, common MySQL scalar types, `NOT NULL`, inline primary keys, and table primary keys
- `ALTER TABLE ... ADD COLUMN` as schema migration metadata
- `ALTER TABLE ... ADD UNIQUE INDEX` and foreign keys as compatibility metadata
- Conversion to plugin entity schemas named `sql_<table_name>`

## Blocked

- `DROP TABLE`
- destructive `ALTER TABLE` operations
- triggers, procedures, and functions
- `TRUNCATE`
- table renames

Unsupported destructive SQL must be migrated intentionally into SPBox reducers or explicit plugin schema migration plans.

## Generated Files

`npm run install:qbcore-demo` writes:

```txt
cache/qbcore-demo/spbox-sql-manifest.json
cache/qbcore-demo/resources.lock.json
```

`spbox-sql-manifest.json` is the compatibility contract for discovered SQL tables. `resources.lock.json` records the pinned upstream resources plus the SQL import summary.

Any resource tree can be scanned with:

```sh
npm run import:legacy-sql -- --root path/to/resources --out path/to/spbox-sql-manifest.json
```

If `--root` points at one resource, the importer emits one plugin SQL manifest. If it points at a resources folder, the importer finds every child resource with `fxmanifest.lua` or `__resource.lua` and scans its `.sql` files.

For the full drop-in resource install plan, use:

```sh
npm run import:legacy-resource -- --root path/to/resources --out path/to/spbox-plugin-import.json
```

## Framework Rule

The compatibility importer exists so adding legacy plugins is trivial:

1. install or copy the resource,
2. scan its `fxmanifest.lua` and `.sql` files,
3. register generated SPBox plugin schemas,
4. route legacy `MySQL.*` calls through the SPBox `oxmysql` facade.

MySQL does not become authoritative. SpacetimeDB remains the durability layer.
