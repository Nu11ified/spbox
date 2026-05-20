# Phase 02: Permission Engine

## Goal

Replace static permission configuration with a live principal and policy engine backed by SpacetimeDB, while preserving compatibility with FiveM ACE where needed.

FiveM ACE is based on principals and access control entries. Server commands such as `add_ace`, `remove_ace`, `add_principal`, `remove_principal`, and `test_ace` manage the server ACL. Existing resources commonly check ACE permissions, so the runtime should support both native SDB permission checks and an ACE mirror.

## Target Model

```txt
SpacetimeDB permissions
  -> runtime permission graph
  -> optional FXServer ACE mirror
  -> FiveM IsPlayerAceAllowed compatibility
```

Two modes:

```txt
Native SDB permission checks:
  exports.sdb_runtime:HasPermission(source, "vehicle.spawn")

ACE compatibility bridge:
  runtime mirrors selected SDB permissions into FiveM ACE
```

## Data Model

```ts
principals
- id
- type // player, group, discord_role, resource, server, temp
- external_id
- name
- created_at

permissions
- id
- key // "menu.vehicle.spawn", "admin.kick", "economy.give_money"
- description
- plugin_id
- created_at

principal_edges
- parent_principal_id
- child_principal_id
- source // manual, discord, role, temp, plugin
- expires_at

permission_grants
- principal_id
- permission_key
- effect // allow, deny
- source
- expires_at

permission_cache_versions
- server_id
- version
- updated_at

ace_mirror_rules
- id
- permission_key
- ace_object
- enabled
- mode // allow_only, allow_and_deny
```

This supports:

```txt
Discord role -> group.staff
player license -> group.owner
temporary event staff -> expires in 2 hours
resource identity -> only allowed to call certain actions
deny overrides allow
```

## Permission Evaluation

The permission runtime should have four layers:

```txt
1. Identity verification
2. Principal resolution
3. Permission graph evaluation
4. Action capability check
```

Example:

```txt
Player clicks Give Money
-> check player identity
-> resolve principals: license, Discord roles, staff group
-> evaluate permission: economy.admin.give_money
-> check action capability: can call reducer economy_give_money
-> validate payload limits
-> execute reducer
-> write audit log
```

The graph should support explicit deny and expiration. If there is a conflict, deny wins unless a higher-priority policy system deliberately says otherwise.

## Policy Constraints

Permissions alone are not enough. Actions need contextual policy:

```txt
staff can give max $10,000
moderators can kick but not ban
mechanics can repair only while on duty
police can access CAD only while on duty
Discord role grants staff but expires if role is removed
plugin can only write its own namespace
```

Suggested policy table:

```ts
policy_constraints
- id
- permission_key
- constraint_type
- constraint_json
- priority
- enabled
```

Examples:

```json
{
  "constraint_type": "max_amount",
  "constraint_json": { "amount": 10000, "currency": "cash" }
}
```

```json
{
  "constraint_type": "requires_state",
  "constraint_json": { "key": "job:on_duty", "equals": true }
}
```

FiveM state bags can help mirror lightweight state such as duty status or feature flags to clients, but the authoritative permission decision should still happen server-side.

## Discord Connector

```txt
Discord bot watches guild member roles
-> updates discord_role principal edges in SpacetimeDB
-> FiveM runtime receives subscription update
-> player permission cache updates live
-> menu changes immediately
```

The connector should be external to reducers because Discord requires network I/O. The connector writes changes by calling reducers such as `upsert_discord_role_edge` and `remove_discord_role_edge`.

## ACE Mirror

FiveM server commands can add and remove ACE entries and principal inheritance at runtime. The runtime can use that to mirror selected SDB permissions:

```txt
permission grant changed
-> runtime recomputes mirrored ACE rows
-> runtime executes add_ace/remove_ace/add_principal/remove_principal as needed
-> compatibility resources continue using ACE checks
```

Keep this mirror explicit. Do not mirror every internal permission by default or the ACE namespace will become noisy and hard to reason about.

## Security Rules

- Never trust the client menu UI.
- Re-check permission server-side for every action.
- Re-check action capabilities after permission passes.
- Include the actor, resolved principals, permission key, and policy result in the audit log.
- Cache permissions for speed, but invalidate on subscription updates.
- Use expiration for temporary grants and Discord-derived grants.

## MVP Deliverables

- Principal, edge, permission, and grant tables.
- Permission reducer API.
- Runtime permission cache.
- `HasPermission` export.
- ACE mirror for selected permissions.
- Discord role connector.
- Web permission editor.
- Audit records for every permission-changing action.

## References

- [FiveM server commands and ACE commands](https://docs.fivem.net/docs/server-manual/server-commands/)
- [FiveM ACL/security cookbook note](https://docs.fivem.net/docs/cookbook/2021/07/17/quick-note-on-using-built-in-acl-security/)
- [FiveM state bags](https://docs.fivem.net/docs/scripting-manual/networking/state-bags/)
- [SpacetimeDB subscriptions](https://spacetimedb.com/docs/clients/subscriptions/)
- [SpacetimeDB reducers](https://spacetimedb.com/docs/functions/reducers/)
