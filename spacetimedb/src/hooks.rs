#[reducer]
pub fn register_plugin_hook(
    ctx: &ReducerContext,
    id: String,
    plugin_id: String,
    hook_name: String,
    capability: String,
    handler_type: String,
    handler_ref: String,
    priority: i32,
) -> Result<(), String> {
    validate_plugin_hook_registration_identity(&id, &plugin_id, &hook_name, &capability, &handler_type, &handler_ref)?;
    if !plugin_exists(ctx, &plugin_id) {
        return Err("plugin must exist before hook writes".to_string());
    }
    if !plugin_is_active(ctx, &plugin_id) {
        return Err("plugin must be active before registering hooks".to_string());
    }
    validate_plugin_hook_handler_type(&handler_type)?;
    ctx.db.plugin_hooks().insert(PluginHook {
        id,
        plugin_id,
        hook_name,
        capability,
        handler_type,
        handler_ref,
        priority,
        enabled: true,
    });
    Ok(())
}

fn validate_plugin_hook_registration_identity(
    id: &str,
    plugin_id: &str,
    hook_name: &str,
    capability: &str,
    handler_type: &str,
    handler_ref: &str,
) -> Result<(), String> {
    if id.trim().is_empty() {
        return Err("plugin hook id is required".to_string());
    }
    if plugin_id.trim().is_empty() {
        return Err("plugin hook plugin id is required".to_string());
    }
    if hook_name.trim().is_empty() {
        return Err("plugin hook name is required".to_string());
    }
    if capability.trim().is_empty() {
        return Err("plugin hook capability is required".to_string());
    }
    if handler_type.trim().is_empty() {
        return Err("plugin hook handler type is required".to_string());
    }
    if handler_ref.trim().is_empty() {
        return Err("plugin hook handler ref is required".to_string());
    }
    Ok(())
}

#[reducer]
pub fn set_plugin_hooks_enabled(
    ctx: &ReducerContext,
    plugin_id: String,
    enabled: bool,
) -> Result<(), String> {
    validate_plugin_hook_enablement_identity(&plugin_id)?;
    if !plugin_exists(ctx, &plugin_id) {
        return Err("plugin must exist before hook writes".to_string());
    }

    if enabled && !plugin_is_active(ctx, &plugin_id) {
        return Err("plugin must be active before enabling hooks".to_string());
    }

    set_plugin_hooks_enabled_for_plugin(ctx, &plugin_id, enabled);
    Ok(())
}

fn validate_plugin_hook_enablement_identity(plugin_id: &str) -> Result<(), String> {
    if plugin_id.trim().is_empty() {
        return Err("plugin hook enablement plugin id is required".to_string());
    }
    Ok(())
}

fn set_plugin_hooks_enabled_for_plugin(
    ctx: &ReducerContext,
    plugin_id: &str,
    enabled: bool,
) {
    for mut hook in ctx.db.plugin_hooks().iter() {
        if hook.plugin_id == plugin_id {
            hook.enabled = enabled;
            ctx.db.plugin_hooks().id().update(hook);
        }
    }
}

fn validate_plugin_hook_handler_type(handler_type: &str) -> Result<(), String> {
    match handler_type {
        "action" | "reducer" | "sidecar" => Ok(()),
        _ => return Err("invalid plugin hook handler type".to_string()),
    }
}
