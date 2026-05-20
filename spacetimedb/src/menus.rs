#[reducer]
pub fn upsert_menu_definition(
    ctx: &ReducerContext,
    id: String,
    plugin_id: String,
    label: String,
    parent_id: String,
    icon: String,
    order: i32,
    required_permission: String,
    action_id: String,
    enabled: bool,
    visibility_policy_id: String,
) -> Result<(), String> {
    validate_menu_definition_identity(&id, &plugin_id, &label)?;
    if !plugin_exists(ctx, &plugin_id) {
        return Err("plugin must exist before menu definition writes".to_string());
    }
    if enabled && !plugin_is_active(ctx, &plugin_id) {
        return Err("plugin must be active before enabling menu definitions".to_string());
    }
    let menu = MenuDefinition {
        id: id.clone(),
        plugin_id,
        label,
        parent_id,
        icon,
        order,
        required_permission,
        action_id,
        enabled,
        visibility_policy_id,
    };

    if ctx.db.menu_definitions().id().find(id).is_some() {
        ctx.db.menu_definitions().id().update(menu);
    } else {
        ctx.db.menu_definitions().insert(menu);
    }
    Ok(())
}

fn validate_menu_definition_identity(id: &str, plugin_id: &str, label: &str) -> Result<(), String> {
    if id.trim().is_empty() {
        return Err("menu definition id is required".to_string());
    }
    if plugin_id.trim().is_empty() {
        return Err("menu definition plugin id is required".to_string());
    }
    if label.trim().is_empty() {
        return Err("menu definition label is required".to_string());
    }
    Ok(())
}

#[reducer]
pub fn upsert_menu_action(
    ctx: &ReducerContext,
    id: String,
    plugin_id: String,
    action_type: String,
    reducer_name: String,
    payload_schema_json: String,
    confirmation_required: bool,
    audit_level: String,
    required_permission: String,
    enabled: bool,
) -> Result<(), String> {
    validate_menu_action_identity(&id, &plugin_id, &action_type, &payload_schema_json, &audit_level)?;
    validate_menu_action_type(&action_type)?;
    validate_menu_audit_level(&audit_level)?;
    validate_menu_action_permission(&action_type, &required_permission)?;
    if !plugin_exists(ctx, &plugin_id) {
        return Err("plugin must exist before menu action writes".to_string());
    }
    if enabled && !plugin_is_active(ctx, &plugin_id) {
        return Err("plugin must be active before enabling menu actions".to_string());
    }

    let action = MenuAction {
        id: id.clone(),
        plugin_id,
        action_type,
        reducer_name,
        payload_schema_json,
        confirmation_required,
        audit_level,
        required_permission,
        enabled,
    };

    if ctx.db.menu_actions().id().find(id).is_some() {
        ctx.db.menu_actions().id().update(action);
    } else {
        ctx.db.menu_actions().insert(action);
    }
    Ok(())
}

fn validate_menu_action_identity(
    id: &str,
    plugin_id: &str,
    action_type: &str,
    payload_schema_json: &str,
    audit_level: &str,
) -> Result<(), String> {
    if id.trim().is_empty() {
        return Err("menu action id is required".to_string());
    }
    if plugin_id.trim().is_empty() {
        return Err("menu action plugin id is required".to_string());
    }
    if action_type.trim().is_empty() {
        return Err("menu action type is required".to_string());
    }
    if payload_schema_json.trim().is_empty() {
        return Err("menu action payload schema is required".to_string());
    }
    if audit_level.trim().is_empty() {
        return Err("menu action audit level is required".to_string());
    }
    Ok(())
}

#[reducer]
pub fn upsert_runtime_command(
    ctx: &ReducerContext,
    id: String,
    plugin_id: String,
    name: String,
    aliases_json: String,
    action_id: String,
    required_permission: String,
    payload_schema_json: String,
    audit_level: String,
    enabled: bool,
) -> Result<(), String> {
    validate_runtime_command_identity(&id, &plugin_id, &name, &action_id, &payload_schema_json, &audit_level)?;
    validate_runtime_command_name(&name)?;
    validate_menu_audit_level(&audit_level)?;
    if !plugin_exists(ctx, &plugin_id) {
        return Err("plugin must exist before runtime command writes".to_string());
    }
    if enabled && !plugin_is_active(ctx, &plugin_id) {
        return Err("plugin must be active before enabling runtime commands".to_string());
    }

    let command = RuntimeCommand {
        id: id.clone(),
        plugin_id,
        name,
        aliases_json,
        action_id,
        required_permission,
        payload_schema_json,
        audit_level,
        enabled,
    };

    if ctx.db.runtime_commands().id().find(id).is_some() {
        ctx.db.runtime_commands().id().update(command);
    } else {
        ctx.db.runtime_commands().insert(command);
    }
    Ok(())
}

fn validate_runtime_command_identity(
    id: &str,
    plugin_id: &str,
    name: &str,
    action_id: &str,
    payload_schema_json: &str,
    audit_level: &str,
) -> Result<(), String> {
    if id.trim().is_empty() {
        return Err("runtime command id is required".to_string());
    }
    if plugin_id.trim().is_empty() {
        return Err("runtime command plugin id is required".to_string());
    }
    if name.trim().is_empty() {
        return Err("runtime command name is required".to_string());
    }
    if action_id.trim().is_empty() {
        return Err("runtime command action id is required".to_string());
    }
    if payload_schema_json.trim().is_empty() {
        return Err("runtime command payload schema is required".to_string());
    }
    if audit_level.trim().is_empty() {
        return Err("runtime command audit level is required".to_string());
    }
    Ok(())
}

#[reducer]
pub fn upsert_runtime_panel(
    ctx: &ReducerContext,
    id: String,
    plugin_id: String,
    title: String,
    route: String,
    required_permission: String,
    icon: String,
    order: i32,
    enabled: bool,
) -> Result<(), String> {
    validate_runtime_panel_identity(&id, &plugin_id, &title, &route)?;
    validate_runtime_panel_route(&route)?;
    if !plugin_exists(ctx, &plugin_id) {
        return Err("plugin must exist before runtime panel writes".to_string());
    }
    if enabled && !plugin_is_active(ctx, &plugin_id) {
        return Err("plugin must be active before enabling runtime panels".to_string());
    }

    let panel = RuntimePanel {
        id: id.clone(),
        plugin_id,
        title,
        route,
        required_permission,
        icon,
        order,
        enabled,
    };

    if ctx.db.runtime_panels().id().find(id).is_some() {
        ctx.db.runtime_panels().id().update(panel);
    } else {
        ctx.db.runtime_panels().insert(panel);
    }
    Ok(())
}

fn validate_runtime_panel_identity(id: &str, plugin_id: &str, title: &str, route: &str) -> Result<(), String> {
    if id.trim().is_empty() {
        return Err("runtime panel id is required".to_string());
    }
    if plugin_id.trim().is_empty() {
        return Err("runtime panel plugin id is required".to_string());
    }
    if title.trim().is_empty() {
        return Err("runtime panel title is required".to_string());
    }
    if route.trim().is_empty() {
        return Err("runtime panel route is required".to_string());
    }
    Ok(())
}

#[reducer]
pub fn upsert_menu_visibility_policy(
    ctx: &ReducerContext,
    id: String,
    plugin_id: String,
    policy_json: String,
    enabled: bool,
) -> Result<(), String> {
    validate_menu_visibility_policy_identity(&id, &plugin_id, &policy_json)?;
    if !plugin_exists(ctx, &plugin_id) {
        return Err("plugin must exist before menu visibility policy writes".to_string());
    }
    if enabled && !plugin_is_active(ctx, &plugin_id) {
        return Err("plugin must be active before enabling menu visibility policies".to_string());
    }
    let policy = MenuVisibilityPolicy {
        id: id.clone(),
        plugin_id,
        policy_json,
        enabled,
    };

    if ctx.db.menu_visibility_policies().id().find(id).is_some() {
        ctx.db.menu_visibility_policies().id().update(policy);
    } else {
        ctx.db.menu_visibility_policies().insert(policy);
    }
    Ok(())
}

fn validate_menu_visibility_policy_identity(id: &str, plugin_id: &str, policy_json: &str) -> Result<(), String> {
    if id.trim().is_empty() {
        return Err("menu visibility policy id is required".to_string());
    }
    if plugin_id.trim().is_empty() {
        return Err("menu visibility policy plugin id is required".to_string());
    }
    if policy_json.trim().is_empty() {
        return Err("menu visibility policy json is required".to_string());
    }
    Ok(())
}

#[reducer]
pub fn open_menu_session(
    ctx: &ReducerContext,
    id: String,
    server_id: String,
    player_id: String,
    cache_version: u64,
) -> Result<(), String> {
    validate_menu_session_open_identity(&id, &server_id, &player_id)?;
    let session = MenuSession {
        id: id.clone(),
        server_id,
        player_id,
        opened_at: ctx.timestamp,
        closed_at: None,
        cache_version,
    };

    if ctx.db.menu_sessions().id().find(id).is_some() {
        ctx.db.menu_sessions().id().update(session);
    } else {
        ctx.db.menu_sessions().insert(session);
    }
    Ok(())
}

#[reducer]
pub fn close_menu_session(ctx: &ReducerContext, session_id: String) -> Result<(), String> {
    validate_menu_session_close_identity(&session_id)?;
    if let Some(mut session) = ctx.db.menu_sessions().id().find(session_id) {
        session.closed_at = Some(ctx.timestamp);
        ctx.db.menu_sessions().id().update(session);
        return Ok(());
    }

    Err("unknown menu session".to_string())
}

fn validate_menu_session_open_identity(id: &str, server_id: &str, player_id: &str) -> Result<(), String> {
    if id.trim().is_empty() {
        return Err("menu session id is required".to_string());
    }
    if server_id.trim().is_empty() {
        return Err("menu session server id is required".to_string());
    }
    if player_id.trim().is_empty() {
        return Err("menu session player id is required".to_string());
    }
    Ok(())
}

fn validate_menu_session_close_identity(session_id: &str) -> Result<(), String> {
    if session_id.trim().is_empty() {
        return Err("menu session close id is required".to_string());
    }
    Ok(())
}

fn set_plugin_menu_surfaces_enabled(
    ctx: &ReducerContext,
    plugin_id: &str,
    enabled: bool,
) {
    for mut definition in ctx.db.menu_definitions().iter() {
        if definition.plugin_id == plugin_id {
            definition.enabled = enabled;
            ctx.db.menu_definitions().id().update(definition);
        }
    }
    for mut action in ctx.db.menu_actions().iter() {
        if action.plugin_id == plugin_id {
            action.enabled = enabled;
            ctx.db.menu_actions().id().update(action);
        }
    }
    for mut command in ctx.db.runtime_commands().iter() {
        if command.plugin_id == plugin_id {
            command.enabled = enabled;
            ctx.db.runtime_commands().id().update(command);
        }
    }
    for mut panel in ctx.db.runtime_panels().iter() {
        if panel.plugin_id == plugin_id {
            panel.enabled = enabled;
            ctx.db.runtime_panels().id().update(panel);
        }
    }
    for mut policy in ctx.db.menu_visibility_policies().iter() {
        if policy.plugin_id == plugin_id {
            policy.enabled = enabled;
            ctx.db.menu_visibility_policies().id().update(policy);
        }
    }
}

fn validate_menu_action_type(action_type: &str) -> Result<(), String> {
    match action_type {
        "runtime_action"
        | "call_reducer"
        | "trigger_server_handler"
        | "trigger_client_event"
        | "execute_server_command"
        | "set_runtime_config"
        | "open_panel"
        | "toggle_feature"
        | "repair_vehicle"
        | "spawn_vehicle"
        | "set_weather"
        | "set_time"
        | "teleport_player"
        | "kick_player"
        | "economy_admin_adjust_balance"
        | "set_plugin_status" => Ok(()),
        _ => Err("invalid menu action type".to_string()),
    }
}

fn validate_menu_action_permission(action_type: &str, required_permission: &str) -> Result<(), String> {
    if action_type == "execute_server_command" && required_permission.trim().is_empty() {
        return Err("execute_server_command actions require an explicit permission".to_string());
    }

    Ok(())
}

fn validate_menu_audit_level(audit_level: &str) -> Result<(), String> {
    match audit_level {
        "none" | "standard" | "high" => Ok(()),
        _ => Err("invalid menu audit level".to_string()),
    }
}

fn validate_runtime_command_name(name: &str) -> Result<(), String> {
    if name.is_empty() || name.chars().any(|character| character.is_whitespace()) {
        return Err("invalid runtime command name".to_string());
    }

    Ok(())
}

fn validate_runtime_panel_route(route: &str) -> Result<(), String> {
    if route.is_empty() || !route.starts_with('/') {
        return Err("invalid runtime panel route".to_string());
    }

    Ok(())
}
