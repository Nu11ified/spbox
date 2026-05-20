# Proof-Of-Concept Plugins

The optional POC resources are demo plugins on top of the SPBox framework. They are for manual testing, demos, and compatibility experiments only.

## sdb_poc_suite

Path:

```txt
resources/[poc]/sdb_poc_suite
```

This resource is not a core runtime dependency. It provides:

- Basic client spawning so a manual test player can leave the loading screen.
- A custom `F7` NUI panel opened with `/pocmenu`.
- Simple server-owned economy balances with cash, bank, deposit, withdraw, paycheck, max-money demo balance, and job selection.
- A vMenu-style proof-of-concept surface for vehicle spawn/repair, waypoint teleport, weather, time, and noclip.
- `/pocspawn` respawns the local player if the manual test client loads invisibly.
- When `set sdb_poc_admin_endpoint "http://127.0.0.1:8787"` is configured, player sessions and demo economy state are written through the admin connector into SpacetimeDB-backed plugin data.

To try it in a disposable FXServer config, add:

```cfg
ensure sdb_poc_suite
```

Keep this resource out of production core gates unless a server intentionally wants the demo behavior.

## sdb_poc_chat

Path:

```txt
resources/[poc]/sdb_poc_chat
```

This resource is not a core runtime dependency. It provides a minimal local text chat for manual test servers:

- `T` opens normal chat.
- `/` opens command chat.
- Messages are broadcast by the server to connected players.
- Slash commands are executed locally, so `/pocmenu` and `/pocspawn` work without a stock chat resource.
- When `set sdb_poc_admin_endpoint "http://127.0.0.1:8787"` is configured, chat messages are written through the admin connector into SpacetimeDB-backed plugin data.

To try it in a disposable FXServer config, add:

```cfg
ensure sdb_poc_chat
```
