# Phase 03: Live Menu Runtime

## Goal

Build a vMenu replacement as a live, policy-driven menu runtime.

Names to consider:

```txt
SDB Menu
Runtime Menu
LiveMenu
PulseMenu
```

Core idea:

```txt
menus are data
permissions are live
menu actions are reducers
UI updates in real time
```

## Why This Works

FiveM supports NUI for browser-based UI and NUI callbacks for UI-to-game calls. It also supports server/client events such as `TriggerClientEvent` and `TriggerServerEvent`. That gives the runtime a natural path:

- SpacetimeDB stores menu definitions and action metadata.
- The FiveM server runtime subscribes to relevant menu and permission rows.
- The client receives only the menu tree it is allowed to see.
- NUI renders the menu.
- Every click goes back to the server.
- The server re-checks permission before executing.

## Data Model

```ts
menu_definitions
- id
- plugin_id
- label
- parent_id
- icon
- order
- required_permission
- action_id
- enabled
- visibility_policy_id

menu_actions
- id
- plugin_id
- action_type
- reducer_name
- payload_schema
- confirmation_required
- audit_level
- enabled

menu_visibility_policies
- id
- plugin_id
- policy_json
- enabled

menu_sessions
- id
- server_id
- player_id
- opened_at
- closed_at
- cache_version
```

Example action:

```json
{
  "id": "vehicle.repair",
  "plugin_id": "admin_tools",
  "action_type": "runtime_action",
  "reducer_name": "repair_vehicle",
  "payload_schema": {
    "type": "object",
    "properties": {
      "target_vehicle_net_id": { "type": "number" }
    },
    "required": ["target_vehicle_net_id"]
  },
  "confirmation_required": false,
  "audit_level": "standard"
}
```

## Runtime Flow

```txt
Admin opens menu
-> FiveM client requests menu tree
-> runtime checks SpacetimeDB-backed permission cache
-> only allowed actions appear
-> admin clicks Repair Vehicle
-> NUI callback sends request to client script
-> client sends action request to server
-> server checks permission again
-> server validates payload
-> server executes approved action/reducer/native
-> audit log is written
```

Never trust the menu UI. Visibility is convenience; server-side authorization is mandatory.

## Menu Actions

Actions should be typed and limited:

```txt
call_reducer
trigger_server_handler
trigger_client_event
execute_server_command
set_runtime_config
open_panel
toggle_feature
```

For dangerous actions such as `execute_server_command`, require explicit permission and capability grants. FiveM permits command execution in several contexts, including config, console, RCon, and resources with ACL permission for command execution, so the runtime should be conservative.

## Built-In Admin Menu Scope

The first real menu should include:

```txt
player management
vehicle tools
weather/time controls
teleport tools
economy admin tools
plugin management
runtime health
audit search
```

Vehicle/player/weather/time actions should be implemented as runtime actions, not as direct client-only logic.

## Live Updates

SpacetimeDB subscriptions push updates when subscribed rows change. Use that to update:

- menu definitions
- menu enabled flags
- permission grants
- plugin enable/disable state
- feature flags
- config values

When a plugin is disabled:

```txt
plugin status = disabled
-> menu rows become inactive
-> runtime subscription update arrives
-> affected client menu entries disappear
-> active menu sessions receive a refresh event
```

## Client UI Notes

- Use NUI for rich menus.
- Use callbacks for UI actions.
- Return every NUI callback to avoid stalled requests.
- Keep client-side state shallow and replaceable.
- Use server events for action requests.
- Use state bags only for lightweight replicated flags, not authoritative permission decisions.

## MVP Deliverables

- Menu registry tables.
- Menu action tables.
- Server-side menu tree builder.
- NUI-based menu shell.
- Permission-gated visibility.
- Server-side action authorization.
- Built-in admin actions.
- Audit logging for every privileged menu action.

## References

- [FiveM NUI callbacks](https://docs.fivem.net/docs/scripting-manual/nui-development/nui-callbacks/)
- [FiveM TriggerClientEvent](https://docs.fivem.net/docs/scripting-reference/runtimes/lua/functions/TriggerClientEvent/)
- [FiveM TriggerServerEvent](https://docs.fivem.net/docs/scripting-reference/runtimes/lua/functions/TriggerServerEvent/)
- [FiveM server commands](https://docs.fivem.net/docs/server-manual/server-commands/)
- [SpacetimeDB subscriptions](https://spacetimedb.com/docs/clients/subscriptions/)
