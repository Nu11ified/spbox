# SpacetimeDB FiveM Runtime Goal

Build a live runtime layer for FiveM where permissions, menus, plugins, economy, configuration, server actions, and web/game state flow through one authoritative SpacetimeDB control plane.

This is not a traditional FiveM framework. The goal is a database-backed runtime operating layer:

- vMenu becomes live data.
- ACE becomes live policy.
- Economy becomes an audited ledger.
- Plugins become signed runtime capabilities.
- The website, Discord connector, game server, and admin tools share one synchronized source of truth.

## Table of Contents

1. [Phase 01: Runtime Core](./phases/phase01.md)
2. [Phase 02: Permission Engine](./phases/phase02.md)
3. [Phase 03: Live Menu Runtime](./phases/phase03.md)
4. [Phase 04: Economy Core](./phases/phase04.md)
5. [Phase 05: Plugin Registry](./phases/phase05.md)
6. [Phase 06: Controlled Live Plugins](./phases/phase06.md)
7. [QBCore Parity Track](./qbcore-parity.md)
8. [Missing Core Items](./core-missing-items.md)
9. [Production Readiness Gate](./production-readiness.md)

## Product Positioning

The strongest positioning is:

> A live, database-backed FiveM operating system where menus, permissions, economy, plugins, and server actions are managed from one real-time control plane.

The system should provide primitives, not a rigid roleplay framework:

- identity
- permissions
- actions
- menus
- economy
- inventory
- jobs
- vehicles
- locations
- events
- hooks
- config
- plugins
- auditing
- connectors

Server owners should be able to build police RP, racing, survival, business simulation, military RP, custom minigames, or hardcore economy servers without being forced into a QBCore/ESX-style structure.

## Core Principle

Do not make the main product model "load arbitrary scripts from the database and run them in FiveM."

Instead, define runtime primitives and allow plugins to register against those primitives:

- commands
- menu entries
- reducers and actions
- event handlers
- config schemas
- permission requirements
- UI panels
- database tables or extension schemas
- runtime hooks

The runtime should execute trusted, typed, permission-checked actions. Dangerous dynamic scripting belongs behind signing, sandboxing, explicit capabilities, and audit controls.

## External References

- [SpacetimeDB tables](https://spacetimedb.com/docs/tables/)
- [SpacetimeDB reducers](https://spacetimedb.com/docs/functions/reducers/)
- [SpacetimeDB subscriptions](https://spacetimedb.com/docs/clients/subscriptions/)
- [FiveM resources](https://docs.fivem.net/docs/scripting-manual/introduction/introduction-to-resources/)
- [FiveM resource manifest](https://docs.fivem.net/docs/scripting-reference/resource-manifest/)
- [FiveM server commands and ACE commands](https://docs.fivem.net/docs/server-manual/server-commands/)
- [FiveM state bags](https://docs.fivem.net/docs/scripting-manual/networking/state-bags/)
- [FiveM NUI callbacks](https://docs.fivem.net/docs/scripting-manual/nui-development/nui-callbacks/)
