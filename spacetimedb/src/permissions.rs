#[reducer]
pub fn upsert_principal(
    ctx: &ReducerContext,
    id: String,
    principal_type: String,
    external_id: String,
    name: String,
) -> Result<(), String> {
    validate_principal_identity(&id, &principal_type, &external_id, &name)?;
    ctx.db.principals().insert(Principal {
        id,
        principal_type,
        external_id,
        name,
        created_at: ctx.timestamp,
    });
    Ok(())
}

fn validate_principal_identity(id: &str, principal_type: &str, external_id: &str, name: &str) -> Result<(), String> {
    if id.trim().is_empty() {
        return Err("principal id is required".to_string());
    }
    if principal_type.trim().is_empty() {
        return Err("principal type is required".to_string());
    }
    if external_id.trim().is_empty() {
        return Err("principal external id is required".to_string());
    }
    if name.trim().is_empty() {
        return Err("principal name is required".to_string());
    }
    Ok(())
}

#[reducer]
pub fn register_permission(
    ctx: &ReducerContext,
    id: String,
    key: String,
    description: String,
    plugin_id: String,
) -> Result<(), String> {
    validate_permission_definition_identity(&id, &key, &description, &plugin_id)?;
    if !plugin_exists(ctx, &plugin_id) {
        return Err("plugin must exist before permission writes".to_string());
    }
    let permission = Permission {
        id: id.clone(),
        key,
        description,
        plugin_id,
        created_at: ctx.timestamp,
    };

    if ctx.db.permissions().id().find(id).is_some() {
        ctx.db.permissions().id().update(permission);
    } else {
        ctx.db.permissions().insert(permission);
    }
    Ok(())
}

fn validate_permission_definition_identity(id: &str, key: &str, description: &str, plugin_id: &str) -> Result<(), String> {
    if id.trim().is_empty() {
        return Err("permission id is required".to_string());
    }
    if key.trim().is_empty() {
        return Err("permission key is required".to_string());
    }
    if description.trim().is_empty() {
        return Err("permission description is required".to_string());
    }
    if plugin_id.trim().is_empty() {
        return Err("permission plugin id is required".to_string());
    }
    Ok(())
}

#[reducer]
pub fn ack_permission_cache_version(
    ctx: &ReducerContext,
    server_id: String,
    version: u64,
) -> Result<(), String> {
    validate_permission_cache_ack_identity(&server_id)?;
    if !server_exists(ctx, &server_id) {
        return Err("server must exist before permission cache acknowledgements".to_string());
    }
    let cache_version = PermissionCacheVersion {
        server_id: server_id.clone(),
        version,
        updated_at: ctx.timestamp,
    };

    if ctx.db.permission_cache_versions().server_id().find(server_id).is_some() {
        ctx.db.permission_cache_versions().server_id().update(cache_version);
    } else {
        ctx.db.permission_cache_versions().insert(cache_version);
    }
    Ok(())
}

fn validate_permission_cache_ack_identity(server_id: &str) -> Result<(), String> {
    if server_id.trim().is_empty() {
        return Err("permission cache ack server id is required".to_string());
    }
    Ok(())
}

#[reducer]
pub fn upsert_ace_mirror_rule(
    ctx: &ReducerContext,
    id: String,
    permission_key: String,
    ace_object: String,
    enabled: bool,
    mode: String,
) -> Result<(), String> {
    validate_ace_mirror_identity(&id, &permission_key, &ace_object)?;
    validate_ace_mirror_mode(&mode)?;
    if !permission_key_exists(ctx, &permission_key) {
        return Err("permission must exist before ace mirror writes".to_string());
    }

    let rule = AceMirrorRule {
        id: id.clone(),
        permission_key,
        ace_object,
        enabled,
        mode,
        updated_at: ctx.timestamp,
    };

    if ctx.db.ace_mirror_rules().id().find(id).is_some() {
        ctx.db.ace_mirror_rules().id().update(rule);
    } else {
        ctx.db.ace_mirror_rules().insert(rule);
    }
    Ok(())
}

fn validate_ace_mirror_identity(id: &str, permission_key: &str, ace_object: &str) -> Result<(), String> {
    if id.trim().is_empty() {
        return Err("ace mirror rule id is required".to_string());
    }
    if permission_key.trim().is_empty() {
        return Err("ace mirror permission key is required".to_string());
    }
    if ace_object.trim().is_empty() {
        return Err("ace mirror object is required".to_string());
    }
    Ok(())
}

fn validate_ace_mirror_mode(mode: &str) -> Result<(), String> {
    match mode {
        "allow_only" | "allow_and_deny" => Ok(()),
        _ => Err("invalid ace mirror mode".to_string()),
    }
}

#[reducer]
pub fn grant_permission(
    ctx: &ReducerContext,
    id: String,
    principal_id: String,
    permission_key: String,
    effect: String,
    source: String,
    expires_at: Option<Timestamp>,
) -> Result<(), String> {
    validate_permission_grant_identity(&id, &principal_id, &permission_key, &source)?;
    if effect != "allow" && effect != "deny" {
        return Err("effect must be allow or deny".to_string());
    }
    if !principal_exists(ctx, &principal_id) {
        return Err("principal must exist before permission grant writes".to_string());
    }
    if !permission_key_exists(ctx, &permission_key) {
        return Err("permission must exist before permission grant writes".to_string());
    }

    ctx.db.permission_grants().insert(PermissionGrant {
        id,
        principal_id,
        permission_key,
        effect,
        source,
        expires_at,
    });
    Ok(())
}

fn validate_permission_grant_identity(id: &str, principal_id: &str, permission_key: &str, source: &str) -> Result<(), String> {
    if id.trim().is_empty() {
        return Err("permission grant id is required".to_string());
    }
    if principal_id.trim().is_empty() {
        return Err("permission grant principal id is required".to_string());
    }
    if permission_key.trim().is_empty() {
        return Err("permission grant key is required".to_string());
    }
    if source.trim().is_empty() {
        return Err("permission grant source is required".to_string());
    }
    Ok(())
}

#[reducer]
pub fn upsert_policy_constraint(
    ctx: &ReducerContext,
    id: String,
    permission_key: String,
    constraint_type: String,
    constraint_json: String,
    priority: i32,
    enabled: bool,
) -> Result<(), String> {
    validate_policy_constraint_identity(&id, &permission_key, &constraint_type, &constraint_json)?;
    validate_policy_constraint_type(&constraint_type)?;
    if !permission_key_exists(ctx, &permission_key) {
        return Err("permission must exist before policy constraint writes".to_string());
    }

    let policy = PolicyConstraint {
        id: id.clone(),
        permission_key,
        constraint_type,
        constraint_json,
        priority,
        enabled,
    };

    if ctx.db.policy_constraints().id().find(id).is_some() {
        ctx.db.policy_constraints().id().update(policy);
    } else {
        ctx.db.policy_constraints().insert(policy);
    }
    Ok(())
}

#[reducer]
pub fn remove_policy_constraint(ctx: &ReducerContext, policy_id: String) -> Result<(), String> {
    validate_policy_constraint_removal_identity(&policy_id)?;
    ctx.db.policy_constraints().id().delete(policy_id);
    Ok(())
}

fn validate_policy_constraint_removal_identity(policy_id: &str) -> Result<(), String> {
    if policy_id.trim().is_empty() {
        return Err("policy constraint removal id is required".to_string());
    }
    Ok(())
}

fn validate_policy_constraint_identity(id: &str, permission_key: &str, constraint_type: &str, constraint_json: &str) -> Result<(), String> {
    if id.trim().is_empty() {
        return Err("policy constraint id is required".to_string());
    }
    if permission_key.trim().is_empty() {
        return Err("policy constraint permission key is required".to_string());
    }
    if constraint_type.trim().is_empty() {
        return Err("policy constraint type is required".to_string());
    }
    if constraint_json.trim().is_empty() {
        return Err("policy constraint json is required".to_string());
    }
    Ok(())
}

fn validate_policy_constraint_type(constraint_type: &str) -> Result<(), String> {
    match constraint_type {
        "max_amount" | "requires_state" | "namespace_scope" => Ok(()),
        _ => Err("invalid policy constraint type".to_string()),
    }
}

fn principal_exists(ctx: &ReducerContext, principal_id: &str) -> bool {
    ctx.db.principals().id().find(principal_id.to_string()).is_some()
}

fn permission_key_exists(ctx: &ReducerContext, permission_key: &str) -> bool {
    ctx.db.permissions().key().find(permission_key.to_string()).is_some()
}

#[reducer]
pub fn add_principal_edge(
    ctx: &ReducerContext,
    id: String,
    parent_principal_id: String,
    child_principal_id: String,
    source: String,
    expires_at: Option<Timestamp>,
) -> Result<(), String> {
    validate_principal_edge_identity(&id, &parent_principal_id, &child_principal_id, &source)?;
    if !principal_exists(ctx, &parent_principal_id) {
        return Err("parent principal must exist before edge writes".to_string());
    }
    if !principal_exists(ctx, &child_principal_id) {
        return Err("child principal must exist before edge writes".to_string());
    }

    ctx.db.principal_edges().insert(PrincipalEdge {
        id,
        parent_principal_id,
        child_principal_id,
        source,
        expires_at,
    });
    Ok(())
}

fn validate_principal_edge_identity(id: &str, parent_principal_id: &str, child_principal_id: &str, source: &str) -> Result<(), String> {
    if id.trim().is_empty() {
        return Err("principal edge id is required".to_string());
    }
    if parent_principal_id.trim().is_empty() {
        return Err("parent principal id is required".to_string());
    }
    if child_principal_id.trim().is_empty() {
        return Err("child principal id is required".to_string());
    }
    if source.trim().is_empty() {
        return Err("principal edge source is required".to_string());
    }
    Ok(())
}

#[reducer]
pub fn remove_principal_edge(ctx: &ReducerContext, edge_id: String) -> Result<(), String> {
    validate_principal_edge_removal_identity(&edge_id)?;
    ctx.db.principal_edges().id().delete(edge_id);
    Ok(())
}

fn validate_principal_edge_removal_identity(edge_id: &str) -> Result<(), String> {
    if edge_id.trim().is_empty() {
        return Err("principal edge removal id is required".to_string());
    }
    Ok(())
}

#[reducer]
pub fn write_audit_log(
    ctx: &ReducerContext,
    id: String,
    server_id: String,
    actor_id: String,
    plugin_id: String,
    action_type: String,
    permission_key: String,
    target_type: String,
    target_id: String,
    before_json: String,
    after_json: String,
    status: String,
) -> Result<(), String> {
    validate_audit_log_identity(&id, &server_id, &actor_id, &action_type, &target_type, &target_id, &before_json, &after_json)?;
    if !server_exists(ctx, &server_id) {
        return Err("server must exist before audit writes".to_string());
    }
    validate_audit_status(&status)?;

    ctx.db.audit_logs().insert(AuditLog {
        id,
        server_id,
        actor_id,
        plugin_id,
        action_type,
        permission_key,
        target_type,
        target_id,
        before_json,
        after_json,
        status,
        created_at: ctx.timestamp,
    });
    Ok(())
}

fn validate_audit_log_identity(
    id: &str,
    server_id: &str,
    actor_id: &str,
    action_type: &str,
    target_type: &str,
    target_id: &str,
    before_json: &str,
    after_json: &str,
) -> Result<(), String> {
    if id.trim().is_empty() {
        return Err("audit log id is required".to_string());
    }
    if server_id.trim().is_empty() {
        return Err("audit log server id is required".to_string());
    }
    if actor_id.trim().is_empty() {
        return Err("audit log actor id is required".to_string());
    }
    if action_type.trim().is_empty() {
        return Err("audit log action type is required".to_string());
    }
    if target_type.trim().is_empty() {
        return Err("audit log target type is required".to_string());
    }
    if target_id.trim().is_empty() {
        return Err("audit log target id is required".to_string());
    }
    if before_json.trim().is_empty() {
        return Err("audit log before json is required".to_string());
    }
    if after_json.trim().is_empty() {
        return Err("audit log after json is required".to_string());
    }
    Ok(())
}

fn validate_audit_status(status: &str) -> Result<(), String> {
    match status {
        "succeeded" | "failed" | "denied" => Ok(()),
        _ => Err(format!("invalid audit status: {}", status)),
    }
}
