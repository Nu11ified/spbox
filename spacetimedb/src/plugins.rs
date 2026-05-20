#[reducer]
pub fn register_plugin(
    ctx: &ReducerContext,
    id: String,
    name: String,
    version: String,
    status: String,
    trust_level: String,
    signature: String,
    bundle_hash: String,
    created_by: String,
) -> Result<(), String> {
    validate_plugin_registration_metadata(&id, &name, &version, &trust_level, &signature, &bundle_hash, &created_by)?;
    validate_plugin_status(&status)?;

    let plugin = Plugin {
        id: id.clone(),
        name,
        version,
        status,
        trust_level,
        signature,
        bundle_hash,
        created_by,
        created_at: ctx.timestamp,
        updated_at: ctx.timestamp,
    };

    if let Some(existing) = ctx.db.plugins().id().find(id) {
        ctx.db.plugins().id().update(Plugin {
            created_at: existing.created_at,
            ..plugin
        });
        return Ok(());
    }

    ctx.db.plugins().insert(plugin);
    Ok(())
}

fn validate_plugin_registration_metadata(
    id: &str,
    name: &str,
    version: &str,
    trust_level: &str,
    signature: &str,
    bundle_hash: &str,
    created_by: &str,
) -> Result<(), String> {
    if id.trim().is_empty() {
        return Err("plugin id is required".to_string());
    }
    if name.trim().is_empty() {
        return Err("plugin name is required".to_string());
    }
    if version.trim().is_empty() {
        return Err("plugin version is required".to_string());
    }
    if trust_level.trim().is_empty() {
        return Err("plugin trust level is required".to_string());
    }
    if signature.trim().is_empty() {
        return Err("plugin signature is required".to_string());
    }
    if bundle_hash.trim().is_empty() {
        return Err("plugin bundle hash is required".to_string());
    }
    if created_by.trim().is_empty() {
        return Err("plugin creator is required".to_string());
    }
    Ok(())
}

#[reducer]
pub fn register_plugin_package(
    ctx: &ReducerContext,
    package_id: String,
    plugin_id: String,
    version: String,
    source: String,
    publisher: String,
    trust_level: String,
    signer_id: String,
    signature: String,
    manifest_hash: String,
) -> Result<(), String> {
    validate_plugin_package_registration_metadata(&package_id, &plugin_id, &version, &source, &publisher, &signer_id, &signature, &manifest_hash)?;
    if !plugin_exists(ctx, &plugin_id) {
        return Err("plugin must exist before package writes".to_string());
    }
    validate_package_trust_level(&trust_level)?;
    if package_signer_revoked(ctx, &signer_id) {
        return Err("package signer has been revoked".to_string());
    }

    let installed_at = ctx
        .db
        .plugin_packages()
        .package_id()
        .find(package_id.clone())
        .map(|package| package.installed_at)
        .unwrap_or(ctx.timestamp);
    let package = PluginPackage {
        package_id: package_id.clone(),
        plugin_id,
        version,
        source,
        publisher,
        trust_level,
        signer_id,
        signature,
        manifest_hash,
        installed_at,
        updated_at: ctx.timestamp,
    };

    if ctx.db.plugin_packages().package_id().find(package_id).is_some() {
        ctx.db.plugin_packages().package_id().update(package);
    } else {
        ctx.db.plugin_packages().insert(package);
    }
    Ok(())
}

fn validate_plugin_package_registration_metadata(
    package_id: &str,
    plugin_id: &str,
    version: &str,
    source: &str,
    publisher: &str,
    signer_id: &str,
    signature: &str,
    manifest_hash: &str,
) -> Result<(), String> {
    if package_id.trim().is_empty() {
        return Err("plugin package id is required".to_string());
    }
    if plugin_id.trim().is_empty() {
        return Err("plugin package plugin id is required".to_string());
    }
    if version.trim().is_empty() {
        return Err("plugin package version is required".to_string());
    }
    if source.trim().is_empty() {
        return Err("plugin package source is required".to_string());
    }
    if publisher.trim().is_empty() {
        return Err("plugin package publisher is required".to_string());
    }
    if signer_id.trim().is_empty() {
        return Err("plugin package signer is required".to_string());
    }
    if signature.trim().is_empty() {
        return Err("plugin package signature is required".to_string());
    }
    if manifest_hash.trim().is_empty() {
        return Err("plugin package manifest hash is required".to_string());
    }
    Ok(())
}

fn package_signer_revoked(ctx: &ReducerContext, signer_id: &str) -> bool {
    ctx.db
        .plugin_package_signer_revocations()
        .signer_id()
        .find(signer_id.to_string())
        .is_some()
}

#[reducer]
pub fn revoke_package_signer(
    ctx: &ReducerContext,
    signer_id: String,
    actor_id: String,
    reason: String,
) -> Result<(), String> {
    validate_package_signer_revocation_input(&signer_id, &actor_id, &reason)?;
    let mut disabled_plugin_ids = disable_plugins_for_package_signer(ctx, &signer_id)?;
    let bundle_plugin_ids = revoke_bundles_for_package_signer(ctx, &signer_id, &reason);
    merge_unique_strings(&mut disabled_plugin_ids, bundle_plugin_ids);
    let revocation = PluginPackageSignerRevocation {
        signer_id: signer_id.clone(),
        actor_id,
        reason,
        affected_plugin_ids_json: string_list_json(&disabled_plugin_ids),
        revoked_at: ctx.timestamp,
    };
    if ctx.db.plugin_package_signer_revocations().signer_id().find(signer_id.clone()).is_some() {
        ctx.db.plugin_package_signer_revocations().signer_id().update(revocation);
    } else {
        ctx.db.plugin_package_signer_revocations().insert(revocation);
    }
    Ok(())
}

fn validate_package_signer_revocation_input(
    signer_id: &str,
    actor_id: &str,
    reason: &str,
) -> Result<(), String> {
    if signer_id.trim().is_empty() {
        return Err("package signer id is required".to_string());
    }
    if actor_id.trim().is_empty() {
        return Err("package signer revocation actor is required".to_string());
    }
    if reason.trim().is_empty() {
        return Err("package signer revocation reason is required".to_string());
    }
    Ok(())
}

fn revoke_bundles_for_package_signer(ctx: &ReducerContext, signer_id: &str, reason: &str) -> Vec<String> {
    let mut plugin_ids: Vec<String> = Vec::new();
    let mut bundle_ids: Vec<String> = Vec::new();

    for mut bundle in ctx.db.plugin_bundles().iter() {
        if bundle.signer_id == signer_id && bundle.status != "revoked" {
            let bundle_id = bundle.id.clone();
            merge_unique_strings(&mut plugin_ids, vec![bundle.plugin_id.clone()]);
            bundle.status = "revoked".to_string();
            ctx.db.plugin_bundles().id().update(bundle);
            bundle_ids.push(bundle_id);
        }
    }

    for bundle_id in bundle_ids {
        disable_capabilities_for_bundle(ctx, &bundle_id);
        kill_live_deployments_for_bundle(ctx, &bundle_id, reason);
    }

    plugin_ids
}

fn disable_plugins_for_package_signer(ctx: &ReducerContext, signer_id: &str) -> Result<Vec<String>, String> {
    let mut plugin_ids: Vec<String> = Vec::new();
    for package in ctx.db.plugin_packages().iter() {
        if package.signer_id == signer_id && !plugin_ids.iter().any(|plugin_id| plugin_id == &package.plugin_id) {
            plugin_ids.push(package.plugin_id);
        }
    }

    let mut disabled_plugin_ids: Vec<String> = Vec::new();
    for plugin_id in plugin_ids {
        let Some(mut plugin) = ctx.db.plugins().id().find(plugin_id.clone()) else {
            continue;
        };
        plugin.status = "disabled".to_string();
        plugin.updated_at = ctx.timestamp;
        ctx.db.plugins().id().update(plugin);
        set_plugin_capabilities_enabled(ctx, &plugin_id, false);
        set_plugin_menu_surfaces_enabled(ctx, &plugin_id, false);
        set_plugin_hooks_enabled_for_plugin(ctx, &plugin_id, false);
        disabled_plugin_ids.push(plugin_id);
    }

    Ok(disabled_plugin_ids)
}

fn merge_unique_strings(target: &mut Vec<String>, values: Vec<String>) {
    for value in values {
        if !target.iter().any(|existing| existing == &value) {
            target.push(value);
        }
    }
}

fn string_list_json(values: &[String]) -> String {
    format!(
        "[{}]",
        values
            .iter()
            .map(|value| format!("\"{}\"", json_escape(value)))
            .collect::<Vec<String>>()
            .join(",")
    )
}

#[reducer]
pub fn set_plugin_status(
    ctx: &ReducerContext,
    plugin_id: String,
    status: String,
) -> Result<(), String> {
    validate_plugin_lifecycle_id(&plugin_id)?;
    validate_plugin_status(&status)?;

    if let Some(mut plugin) = ctx.db.plugins().id().find(plugin_id.clone()) {
        if status == "active" && plugin_has_revoked_signer(ctx, &plugin_id) {
            return Err("plugin signer has been revoked".to_string());
        }
        let should_disable_hooks = status != "active";
        plugin.status = status;
        plugin.updated_at = ctx.timestamp;
        ctx.db.plugins().id().update(plugin);
        if should_disable_hooks {
            set_plugin_capabilities_enabled(ctx, &plugin_id, false);
            set_plugin_menu_surfaces_enabled(ctx, &plugin_id, false);
            set_plugin_hooks_enabled_for_plugin(ctx, &plugin_id, false);
        }
        return Ok(());
    }

    Err("unknown plugin".to_string())
}

fn validate_plugin_lifecycle_id(plugin_id: &str) -> Result<(), String> {
    if plugin_id.trim().is_empty() {
        return Err("plugin id is required".to_string());
    }
    Ok(())
}

fn plugin_has_revoked_signer(ctx: &ReducerContext, plugin_id: &str) -> bool {
    for package in ctx.db.plugin_packages().iter() {
        if package.plugin_id == plugin_id && package_signer_revoked(ctx, &package.signer_id) {
            return true;
        }
    }

    for bundle in ctx.db.plugin_bundles().iter() {
        if bundle.plugin_id == plugin_id && package_signer_revoked(ctx, &bundle.signer_id) {
            return true;
        }
    }

    false
}

#[reducer]
pub fn uninstall_plugin(ctx: &ReducerContext, plugin_id: String) -> Result<(), String> {
    validate_plugin_lifecycle_id(&plugin_id)?;
    ctx.db.plugins().id().delete(plugin_id.clone());
    ctx.db.plugin_manifests().plugin_id().delete(plugin_id.clone());
    for package in ctx.db.plugin_packages().iter() {
        if package.plugin_id == plugin_id {
            ctx.db.plugin_packages().package_id().delete(package.package_id);
        }
    }
    delete_plugin_bundles(ctx, &plugin_id);
    delete_plugin_capabilities(ctx, &plugin_id);
    delete_plugin_deployments(ctx, &plugin_id);
    delete_plugin_runtime_instances(ctx, &plugin_id);
    delete_plugin_config_values(ctx, &plugin_id);
    delete_plugin_schemas(ctx, &plugin_id);
    delete_plugin_entities(ctx, &plugin_id);
    delete_plugin_hooks(ctx, &plugin_id);
    delete_plugin_menu_surfaces(ctx, &plugin_id);
    delete_plugin_permissions(ctx, &plugin_id);
    Ok(())
}

fn delete_plugin_bundles(ctx: &ReducerContext, plugin_id: &str) {
    for bundle in ctx.db.plugin_bundles().iter() {
        if bundle.plugin_id == plugin_id {
            ctx.db.plugin_bundles().id().delete(bundle.id);
        }
    }
}

fn delete_plugin_capabilities(ctx: &ReducerContext, plugin_id: &str) {
    for capability in ctx.db.plugin_capabilities().iter() {
        if capability.plugin_id == plugin_id {
            ctx.db.plugin_capabilities().id().delete(capability.id);
        }
    }
}

fn delete_plugin_deployments(ctx: &ReducerContext, plugin_id: &str) {
    for deployment in ctx.db.plugin_deployments().iter() {
        if deployment.plugin_id == plugin_id {
            ctx.db.plugin_deployments().id().delete(deployment.id);
        }
    }
}

fn delete_plugin_runtime_instances(ctx: &ReducerContext, plugin_id: &str) {
    for instance in ctx.db.plugin_runtime_instances().iter() {
        if instance.plugin_id == plugin_id {
            ctx.db.plugin_runtime_instances().id().delete(instance.id);
        }
    }
}

fn delete_plugin_config_values(ctx: &ReducerContext, plugin_id: &str) {
    for config in ctx.db.plugin_config_values().iter() {
        if config.plugin_id == plugin_id {
            ctx.db.plugin_config_values().id().delete(config.id);
        }
    }
}

fn delete_plugin_schemas(ctx: &ReducerContext, plugin_id: &str) {
    for schema in ctx.db.plugin_schemas().iter() {
        if schema.plugin_id == plugin_id {
            ctx.db.plugin_schemas().id().delete(schema.id);
        }
    }
}

fn delete_plugin_entities(ctx: &ReducerContext, plugin_id: &str) {
    for entity in ctx.db.plugin_entities().iter() {
        if entity.plugin_id == plugin_id {
            ctx.db.plugin_entities().id().delete(entity.id);
        }
    }
}

fn delete_plugin_hooks(ctx: &ReducerContext, plugin_id: &str) {
    for hook in ctx.db.plugin_hooks().iter() {
        if hook.plugin_id == plugin_id {
            ctx.db.plugin_hooks().id().delete(hook.id);
        }
    }
}

fn delete_plugin_menu_surfaces(ctx: &ReducerContext, plugin_id: &str) {
    for definition in ctx.db.menu_definitions().iter() {
        if definition.plugin_id == plugin_id {
            ctx.db.menu_definitions().id().delete(definition.id);
        }
    }
    for action in ctx.db.menu_actions().iter() {
        if action.plugin_id == plugin_id {
            ctx.db.menu_actions().id().delete(action.id);
        }
    }
    for command in ctx.db.runtime_commands().iter() {
        if command.plugin_id == plugin_id {
            ctx.db.runtime_commands().id().delete(command.id);
        }
    }
    for panel in ctx.db.runtime_panels().iter() {
        if panel.plugin_id == plugin_id {
            ctx.db.runtime_panels().id().delete(panel.id);
        }
    }
    for policy in ctx.db.menu_visibility_policies().iter() {
        if policy.plugin_id == plugin_id {
            ctx.db.menu_visibility_policies().id().delete(policy.id);
        }
    }
}

fn delete_plugin_permissions(ctx: &ReducerContext, plugin_id: &str) {
    for permission in ctx.db.permissions().iter() {
        if permission.plugin_id == plugin_id {
            delete_permission_dependents(ctx, &permission.key);
            ctx.db.permissions().id().delete(permission.id);
        }
    }
}

fn delete_permission_dependents(ctx: &ReducerContext, permission_key: &str) {
    for grant in ctx.db.permission_grants().iter() {
        if grant.permission_key == permission_key {
            ctx.db.permission_grants().id().delete(grant.id);
        }
    }
    for rule in ctx.db.ace_mirror_rules().iter() {
        if rule.permission_key == permission_key {
            ctx.db.ace_mirror_rules().id().delete(rule.id);
        }
    }
    for policy in ctx.db.policy_constraints().iter() {
        if policy.permission_key == permission_key {
            ctx.db.policy_constraints().id().delete(policy.id);
        }
    }
}

#[reducer]
pub fn register_plugin_manifest(
    ctx: &ReducerContext,
    plugin_id: String,
    manifest_json: String,
    required_permissions: String,
    required_tables: String,
    required_hooks: String,
    required_connectors: String,
    schema_version: u64,
) -> Result<(), String> {
    validate_plugin_manifest_identity(&plugin_id)?;
    if schema_version == 0 {
        return Err("manifest schema version must be positive".to_string());
    }
    validate_plugin_manifest_json(&manifest_json)?;
    if !plugin_exists(ctx, &plugin_id) {
        return Err("plugin must exist before manifest writes".to_string());
    }

    let manifest = PluginManifest {
        plugin_id: plugin_id.clone(),
        manifest_json,
        required_permissions,
        required_tables,
        required_hooks,
        required_connectors,
        schema_version,
        updated_at: ctx.timestamp,
    };

    if ctx.db.plugin_manifests().plugin_id().find(plugin_id).is_some() {
        ctx.db.plugin_manifests().plugin_id().update(manifest);
    } else {
        ctx.db.plugin_manifests().insert(manifest);
    }
    Ok(())
}

fn validate_plugin_manifest_identity(plugin_id: &str) -> Result<(), String> {
    if plugin_id.trim().is_empty() {
        return Err("plugin manifest plugin id is required".to_string());
    }
    Ok(())
}

fn validate_plugin_manifest_json(manifest_json: &str) -> Result<(), String> {
    let compact = compact_json(manifest_json);
    if !compact.starts_with('{') || !compact.ends_with('}') {
        return Err("plugin manifest json must be an object".to_string());
    }

    let permission_keys = manifest_permission_keys(&compact);

    if let Some(menus) = extract_json_array(&compact, "\"menus\"") {
        for entry in split_top_level_json_objects(menus) {
            validate_optional_manifest_permission_reference(
                entry,
                "\"permission\"",
                &permission_keys,
                "Menu manifest entries reference undeclared permission",
            )?;
        }
    }

    if let Some(commands) = extract_json_array(&compact, "\"commands\"") {
        for entry in split_top_level_json_objects(commands) {
            validate_optional_manifest_permission_reference(
                entry,
                "\"permission\"",
                &permission_keys,
                "Command manifest entries reference undeclared permission",
            )?;
        }
    }

    if let Some(panels) = extract_json_array(&compact, "\"panels\"") {
        for entry in split_top_level_json_objects(panels) {
            validate_optional_manifest_permission_reference(
                entry,
                "\"requiredPermission\"",
                &permission_keys,
                "Panel manifest entries reference undeclared permission",
            )?;
        }
    }

    if let Some(server_commands) = extract_json_array(&compact, "\"serverCommands\"") {
        for entry in split_top_level_json_objects(server_commands) {
            let Some(permission) = json_object_string_field(entry, "\"permission\"") else {
                return Err("FiveM server command manifest entries require permission".to_string());
            };
            if permission.is_empty() {
                return Err("FiveM server command manifest entries require permission".to_string());
            }
            if !manifest_permission_declared(&permission_keys, &permission) {
                return Err("FiveM server command manifest entries reference undeclared permission".to_string());
            }
            if !json_object_has_non_empty_string(entry, "\"action\"") {
                return Err("FiveM server command manifest entries require non-empty action".to_string());
            }
        }
    }

    if let Some(exports) = extract_json_array(&compact, "\"exports\"") {
        for entry in split_top_level_json_objects(exports) {
            if !json_object_has_non_empty_string(entry, "\"action\"") {
                return Err("FiveM export manifest entries require non-empty action".to_string());
            }
            if let Some(permission) = json_object_string_field(entry, "\"permission\"") {
                if !permission.is_empty() && !manifest_permission_declared(&permission_keys, &permission) {
                    return Err("FiveM export manifest entries reference undeclared permission".to_string());
                }
            }
        }
    }

    Ok(())
}

fn validate_optional_manifest_permission_reference(
    entry: &str,
    field: &str,
    permission_keys: &[String],
    error_message: &str,
) -> Result<(), String> {
    if let Some(permission) = json_object_string_field(entry, field) {
        if !permission.is_empty() && !manifest_permission_declared(permission_keys, &permission) {
            return Err(error_message.to_string());
        }
    }

    Ok(())
}

fn manifest_permission_keys(compact_manifest_json: &str) -> Vec<String> {
    let Some(permissions) = extract_json_array(compact_manifest_json, "\"permissions\"") else {
        return Vec::new();
    };

    split_top_level_json_objects(permissions)
        .into_iter()
        .filter_map(|entry| json_object_string_field(entry, "\"key\""))
        .filter(|key| !key.is_empty())
        .collect()
}

fn manifest_permission_declared(permission_keys: &[String], permission: &str) -> bool {
    permission_keys.iter().any(|key| key == permission)
}

fn json_object_has_non_empty_string(json_object: &str, key: &str) -> bool {
    json_object_string_field(json_object, key)
        .map(|value| !value.is_empty())
        .unwrap_or(false)
}

fn json_object_string_field(json_object: &str, key: &str) -> Option<String> {
    let Some(key_index) = json_object.find(key) else {
        return None;
    };
    let after_key = &json_object[key_index + key.len()..];
    let Some(colon_index) = after_key.find(':') else {
        return None;
    };
    let after_colon = &after_key[colon_index + 1..];
    let Some(value_start) = after_colon.find('"') else {
        return None;
    };
    let value = &after_colon[value_start + 1..];
    let mut escaped = false;
    let mut output = String::new();

    for character in value.chars() {
        if escaped {
            escaped = false;
            output.push(character);
            continue;
        }

        if character == '\\' {
            escaped = true;
            continue;
        }

        if character == '"' {
            return Some(output);
        }

        output.push(character);
    }

    None
}

fn compact_json(json: &str) -> String {
    let mut output = String::new();
    let mut in_string = false;
    let mut escaped = false;

    for character in json.chars() {
        if in_string {
            output.push(character);
            if escaped {
                escaped = false;
            } else if character == '\\' {
                escaped = true;
            } else if character == '"' {
                in_string = false;
            }
            continue;
        }

        if character == '"' {
            in_string = true;
            output.push(character);
        } else if !character.is_whitespace() {
            output.push(character);
        }
    }

    output
}

fn extract_json_array<'a>(json: &'a str, key: &str) -> Option<&'a str> {
    let key_index = json.find(key)?;
    let after_key = &json[key_index + key.len()..];
    let colon_index = after_key.find(':')?;
    let after_colon = &after_key[colon_index + 1..];
    let start = after_colon.find('[')?;
    let mut depth = 0_i32;
    let mut in_string = false;
    let mut escaped = false;
    let array = &after_colon[start..];

    for (index, character) in array.char_indices() {
        if in_string {
            if escaped {
                escaped = false;
            } else if character == '\\' {
                escaped = true;
            } else if character == '"' {
                in_string = false;
            }
            continue;
        }

        if character == '"' {
            in_string = true;
        } else if character == '[' {
            depth += 1;
        } else if character == ']' {
            depth -= 1;
            if depth == 0 {
                return Some(&array[1..index]);
            }
        }
    }

    None
}

fn split_top_level_json_objects(json_array_body: &str) -> Vec<&str> {
    let mut objects = Vec::new();
    let mut start: Option<usize> = None;
    let mut depth = 0_i32;
    let mut in_string = false;
    let mut escaped = false;

    for (index, character) in json_array_body.char_indices() {
        if in_string {
            if escaped {
                escaped = false;
            } else if character == '\\' {
                escaped = true;
            } else if character == '"' {
                in_string = false;
            }
            continue;
        }

        if character == '"' {
            in_string = true;
        } else if character == '{' {
            if depth == 0 {
                start = Some(index);
            }
            depth += 1;
        } else if character == '}' {
            depth -= 1;
            if depth == 0 {
                if let Some(object_start) = start {
                    objects.push(&json_array_body[object_start..=index]);
                }
                start = None;
            }
        }
    }

    objects
}

#[reducer]
pub fn upsert_plugin_runtime_instance(
    ctx: &ReducerContext,
    plugin_id: String,
    server_id: String,
    status: String,
    error_message: String,
) -> Result<(), String> {
    validate_plugin_runtime_instance_identity(&plugin_id, &server_id)?;
    validate_plugin_runtime_status(&status)?;
    validate_plugin_runtime_instance_error(&status, &error_message)?;
    if !plugin_exists(ctx, &plugin_id) {
        return Err("plugin must exist before runtime instance writes".to_string());
    }
    if !server_exists(ctx, &server_id) {
        return Err("server must exist before runtime instance writes".to_string());
    }
    if status == "loaded" && !plugin_is_active(ctx, &plugin_id) {
        return Err("plugin must be active before loading runtime instances".to_string());
    }
    let id = plugin_runtime_instance_id(&plugin_id, &server_id);
    let loaded_at = if status == "loaded" { Some(ctx.timestamp) } else { None };
    let instance = PluginRuntimeInstance {
        id: id.clone(),
        plugin_id,
        server_id,
        status,
        loaded_at,
        last_heartbeat: ctx.timestamp,
        error_message,
    };

    if ctx.db.plugin_runtime_instances().id().find(id).is_some() {
        ctx.db.plugin_runtime_instances().id().update(instance);
    } else {
        ctx.db.plugin_runtime_instances().insert(instance);
    }
    Ok(())
}

fn validate_plugin_runtime_instance_identity(plugin_id: &str, server_id: &str) -> Result<(), String> {
    if plugin_id.trim().is_empty() {
        return Err("plugin runtime instance plugin id is required".to_string());
    }
    if server_id.trim().is_empty() {
        return Err("plugin runtime instance server id is required".to_string());
    }
    Ok(())
}

fn validate_plugin_runtime_instance_error(status: &str, error_message: &str) -> Result<(), String> {
    if (status == "loaded" || status == "unloaded" || status == "disabled") && !error_message.is_empty() {
        return Err("loaded, unloaded, and disabled runtime instances cannot carry error messages".to_string());
    }
    if status == "failed" && error_message.trim().is_empty() {
        return Err("failed runtime instances require an error message".to_string());
    }
    Ok(())
}

#[reducer]
pub fn set_plugin_config_value(
    ctx: &ReducerContext,
    plugin_id: String,
    server_id: String,
    key: String,
    value_json: String,
    version: u64,
) -> Result<(), String> {
    validate_plugin_config_value_identity(&plugin_id, &server_id, &key)?;
    if !plugin_exists(ctx, &plugin_id) {
        return Err("plugin must exist before config writes".to_string());
    }
    if !plugin_is_active(ctx, &plugin_id) {
        return Err("plugin must be active before config writes".to_string());
    }
    if !server_exists(ctx, &server_id) {
        return Err("server must exist before config writes".to_string());
    }
    let id = plugin_config_value_id(&plugin_id, &server_id, &key);
    let config = PluginConfigValue {
        id: id.clone(),
        plugin_id,
        server_id,
        key,
        value_json,
        version,
        updated_at: ctx.timestamp,
    };

    if ctx.db.plugin_config_values().id().find(id).is_some() {
        ctx.db.plugin_config_values().id().update(config);
    } else {
        ctx.db.plugin_config_values().insert(config);
    }
    Ok(())
}

fn validate_plugin_config_value_identity(plugin_id: &str, server_id: &str, key: &str) -> Result<(), String> {
    if plugin_id.trim().is_empty() {
        return Err("plugin config plugin id is required".to_string());
    }
    if server_id.trim().is_empty() {
        return Err("plugin config server id is required".to_string());
    }
    if key.trim().is_empty() {
        return Err("plugin config key is required".to_string());
    }
    Ok(())
}

fn validate_plugin_runtime_status(status: &str) -> Result<(), String> {
    match status {
        "loaded" | "disabled" | "failed" | "unloaded" => Ok(()),
        _ => Err("invalid plugin runtime status".to_string()),
    }
}

fn plugin_exists(ctx: &ReducerContext, plugin_id: &str) -> bool {
    ctx.db.plugins().id().find(plugin_id.to_string()).is_some()
}

fn plugin_is_active(ctx: &ReducerContext, plugin_id: &str) -> bool {
    ctx.db
        .plugins()
        .id()
        .find(plugin_id.to_string())
        .map(|plugin| plugin.status == "active")
        .unwrap_or(false)
}

fn server_exists(ctx: &ReducerContext, server_id: &str) -> bool {
    ctx.db.servers().id().find(server_id.to_string()).is_some()
}

fn plugin_runtime_instance_id(plugin_id: &str, server_id: &str) -> String {
    format!("{plugin_id}:{server_id}")
}

fn plugin_config_value_id(plugin_id: &str, server_id: &str, key: &str) -> String {
    format!("{plugin_id}:{server_id}:{key}")
}

fn runtime_config_ack_id(server_id: &str, namespace: &str, key: &str) -> String {
    format!("{server_id}:{namespace}:{key}")
}

#[reducer]
pub fn register_plugin_bundle(
    ctx: &ReducerContext,
    id: String,
    plugin_id: String,
    version: String,
    artifact_url: String,
    bundle_hash: String,
    signature: String,
    signer_id: String,
    runtime_type: String,
    status: String,
) -> Result<(), String> {
    validate_bundle_status(&status)?;
    validate_runtime_type(&runtime_type)?;
    if status != "registered" {
        return Err("plugin bundle registration status must be registered".to_string());
    }
    if id.trim().is_empty() {
        return Err("plugin bundle id is required".to_string());
    }
    if plugin_id.trim().is_empty() {
        return Err("plugin bundle plugin id is required".to_string());
    }
    if version.trim().is_empty() {
        return Err("plugin bundle version is required".to_string());
    }
    if artifact_url.trim().is_empty() {
        return Err("plugin bundle artifact url is required".to_string());
    }
    if bundle_hash.trim().is_empty() {
        return Err("plugin bundle hash is required".to_string());
    }
    validate_plugin_bundle_hash(&bundle_hash)?;
    if signature.trim().is_empty() {
        return Err("plugin bundle signature is required".to_string());
    }
    if signer_id.trim().is_empty() {
        return Err("plugin bundle signer is required".to_string());
    }
    if !plugin_exists(ctx, &plugin_id) {
        return Err("plugin must exist before bundle writes".to_string());
    }
    if package_signer_revoked(ctx, &signer_id) {
        return Err("package signer has been revoked".to_string());
    }
    if ctx.db.plugin_bundles().id().find(id.clone()).is_some() {
        return Err("plugin bundle already exists".to_string());
    }

    let bundle = PluginBundle {
        id: id.clone(),
        plugin_id,
        version,
        artifact_url,
        bundle_hash,
        signature,
        signer_id,
        runtime_type,
        status,
        created_at: ctx.timestamp,
    };

    ctx.db.plugin_bundles().insert(bundle);
    Ok(())
}

fn validate_plugin_bundle_hash(bundle_hash: &str) -> Result<(), String> {
    let Some(digest) = bundle_hash.strip_prefix("sha256:") else {
        return Err("plugin bundle hash must use sha256:<digest>".to_string());
    };
    if digest.trim().is_empty() {
        return Err("plugin bundle hash must use sha256:<digest>".to_string());
    }
    Ok(())
}

#[reducer]
pub fn revoke_plugin_bundle(
    ctx: &ReducerContext,
    bundle_id: String,
    status: String,
    actor_id: String,
    reason: String,
) -> Result<(), String> {
    validate_plugin_bundle_revocation_input(&bundle_id, &actor_id, &reason)?;
    validate_bundle_status(&status)?;
    if status != "revoked" {
        return Err("plugin bundle revocation status must be revoked".to_string());
    }
    let Some(mut bundle) = ctx.db.plugin_bundles().id().find(bundle_id.clone()) else {
        return Err("plugin bundle does not exist".to_string());
    };

    bundle.status = "revoked".to_string();
    ctx.db.plugin_bundles().id().update(bundle);
    disable_capabilities_for_bundle(ctx, &bundle_id);
    kill_live_deployments_for_bundle(ctx, &bundle_id, &reason);
    Ok(())
}

fn validate_plugin_bundle_revocation_input(
    bundle_id: &str,
    actor_id: &str,
    reason: &str,
) -> Result<(), String> {
    if bundle_id.trim().is_empty() {
        return Err("plugin bundle revocation bundle id is required".to_string());
    }
    if actor_id.trim().is_empty() {
        return Err("plugin bundle revocation actor is required".to_string());
    }
    if reason.trim().is_empty() {
        return Err("plugin bundle revocation reason is required".to_string());
    }
    Ok(())
}

fn disable_capabilities_for_bundle(ctx: &ReducerContext, bundle_id: &str) {
    for mut capability in ctx.db.plugin_capabilities().iter() {
        if capability.bundle_id == bundle_id {
            capability.status = "disabled".to_string();
            capability.updated_at = ctx.timestamp;
            ctx.db.plugin_capabilities().id().update(capability);
        }
    }
}

fn kill_live_deployments_for_bundle(ctx: &ReducerContext, bundle_id: &str, reason: &str) {
    for mut deployment in ctx.db.plugin_deployments().iter() {
        if deployment.bundle_id == bundle_id && (deployment.status == "active" || deployment.status == "pending") {
            deployment.status = "killed".to_string();
            deployment.error_message = format!("bundle revoked: {}", reason);
            ctx.db.plugin_deployments().id().update(deployment);
        }
    }
}

#[reducer]
pub fn upsert_plugin_capability(
    ctx: &ReducerContext,
    id: String,
    plugin_id: String,
    bundle_id: String,
    capability_key: String,
    constraints_json: String,
    status: String,
) -> Result<(), String> {
    validate_capability_status(&status)?;
    validate_plugin_capability_id(&id)?;
    validate_plugin_capability_owner_ids(&plugin_id, &bundle_id)?;
    validate_plugin_capability_key(&capability_key)?;
    validate_plugin_capability_constraints_json(&constraints_json)?;
    let Some(bundle) = ctx.db.plugin_bundles().id().find(bundle_id.clone()) else {
        return Err("plugin bundle must exist before capability writes".to_string());
    };
    if bundle.plugin_id != plugin_id {
        return Err("plugin capability bundle mismatch".to_string());
    }
    if status == "enabled" && !plugin_is_active(ctx, &plugin_id) {
        return Err("plugin must be active before enabled capability writes".to_string());
    }
    if status == "enabled" && bundle.status != "registered" {
        return Err("plugin bundle must be registered before enabled capability writes".to_string());
    }
    if ctx.db.plugin_capabilities().id().find(id.clone()).is_some() {
        return Err("plugin capability already exists".to_string());
    }
    if plugin_capability_key_exists(ctx, &bundle_id, &capability_key) {
        return Err("plugin capability key already exists for bundle".to_string());
    }

    let capability = PluginCapability {
        id: id.clone(),
        plugin_id,
        bundle_id,
        capability_key,
        constraints_json,
        status,
        updated_at: ctx.timestamp,
    };

    ctx.db.plugin_capabilities().insert(capability);
    Ok(())
}

fn validate_plugin_capability_id(id: &str) -> Result<(), String> {
    if id.trim().is_empty() {
        return Err("plugin capability id is required".to_string());
    }

    Ok(())
}

fn validate_plugin_capability_owner_ids(plugin_id: &str, bundle_id: &str) -> Result<(), String> {
    if plugin_id.trim().is_empty() {
        return Err("plugin capability plugin id is required".to_string());
    }
    if bundle_id.trim().is_empty() {
        return Err("plugin capability bundle id is required".to_string());
    }

    Ok(())
}

fn validate_plugin_capability_constraints_json(constraints_json: &str) -> Result<(), String> {
    let compact = compact_json(constraints_json);
    if compact.is_empty() {
        return Ok(());
    }
    if !compact.starts_with('{') || !compact.ends_with('}') {
        return Err("plugin capability constraints must be a JSON object".to_string());
    }
    validate_plugin_capability_payload_limit_constraints(&compact)?;
    validate_plugin_capability_actor_principal_constraints(&compact)?;
    validate_plugin_capability_economy_constraints(&compact)?;

    Ok(())
}

fn validate_plugin_capability_payload_limit_constraints(compact_constraints_json: &str) -> Result<(), String> {
    for key in ["payloadLimits", "payload_limits"] {
        let Some(value) = top_level_json_object_field_value(compact_constraints_json, key) else {
            continue;
        };
        if !value.starts_with('{') {
            return Err("plugin capability payload limits must be a JSON object".to_string());
        }
        let Some(body) = extract_json_object_body(value) else {
            return Err("plugin capability payload limits must be a JSON object".to_string());
        };
        for (_, limit) in split_top_level_json_fields(body) {
            if !json_number_is_positive(limit) {
                return Err("plugin capability payload limits must be positive numbers".to_string());
            }
        }
    }

    Ok(())
}

fn validate_plugin_capability_actor_principal_constraints(compact_constraints_json: &str) -> Result<(), String> {
    for key in ["allowedActorPrincipals", "allowed_actor_principals"] {
        let Some(value) = top_level_json_object_field_value(compact_constraints_json, key) else {
            continue;
        };
        if !value.starts_with('[') {
            return Err("plugin capability allowed actor principals must be a non-empty string array".to_string());
        }
        let Some(body) = extract_json_array_body(value) else {
            return Err("plugin capability allowed actor principals must be a non-empty string array".to_string());
        };
        let principals = split_top_level_json_values(body);
        if principals.is_empty() {
            return Err("plugin capability allowed actor principals must be a non-empty string array".to_string());
        }
        for principal in principals {
            if !json_string_is_non_empty(principal) {
                return Err("plugin capability allowed actor principals must be a non-empty string array".to_string());
            }
        }
    }

    Ok(())
}

fn validate_plugin_capability_economy_constraints(compact_constraints_json: &str) -> Result<(), String> {
    for key in ["maxAmount", "max_amount"] {
        let Some(value) = top_level_json_object_field_value(compact_constraints_json, key) else {
            continue;
        };
        if !json_number_is_positive(value) {
            return Err("plugin capability maxAmount must be a positive number".to_string());
        }
    }

    for key in ["allowedAccountOwnerTypes", "allowed_account_owner_types"] {
        let Some(value) = top_level_json_object_field_value(compact_constraints_json, key) else {
            continue;
        };
        if !value.starts_with('[') {
            return Err("plugin capability allowedAccountOwnerTypes must be a non-empty array of account owner types".to_string());
        }
        let Some(body) = extract_json_array_body(value) else {
            return Err("plugin capability allowedAccountOwnerTypes must be a non-empty array of account owner types".to_string());
        };
        let owner_types = split_top_level_json_values(body);
        if owner_types.is_empty() {
            return Err("plugin capability allowedAccountOwnerTypes must be a non-empty array of account owner types".to_string());
        }
        for owner_type in owner_types {
            let Some(owner_type) = json_string_value(owner_type) else {
                return Err("plugin capability allowedAccountOwnerTypes must be a non-empty array of account owner types".to_string());
            };
            validate_account_owner_type(owner_type)
                .map_err(|_| "plugin capability allowedAccountOwnerTypes must be a non-empty array of account owner types".to_string())?;
        }
    }

    for key in ["requiresOnDuty", "requires_on_duty"] {
        let Some(value) = top_level_json_object_field_value(compact_constraints_json, key) else {
            continue;
        };
        if value != "true" && value != "false" {
            return Err("plugin capability requiresOnDuty must be a boolean".to_string());
        }
    }

    Ok(())
}

fn top_level_json_object_field_value<'a>(json_object: &'a str, field: &str) -> Option<&'a str> {
    let body = extract_json_object_body(json_object)?;
    split_top_level_json_fields(body)
        .into_iter()
        .find_map(|(key, value)| {
            if json_string_value(key) == Some(field) {
                Some(value)
            } else {
                None
            }
        })
}

fn extract_json_object_body(json: &str) -> Option<&str> {
    extract_json_bracket_body(json, '{', '}')
}

fn extract_json_array_body(json: &str) -> Option<&str> {
    extract_json_bracket_body(json, '[', ']')
}

fn extract_json_bracket_body(json: &str, open: char, close: char) -> Option<&str> {
    let trimmed = json.trim_start();
    if !trimmed.starts_with(open) {
        return None;
    }

    let mut depth = 0_i32;
    let mut in_string = false;
    let mut escaped = false;
    for (index, character) in trimmed.char_indices() {
        if in_string {
            if escaped {
                escaped = false;
            } else if character == '\\' {
                escaped = true;
            } else if character == '"' {
                in_string = false;
            }
            continue;
        }

        if character == '"' {
            in_string = true;
        } else if character == open {
            depth += 1;
        } else if character == close {
            depth -= 1;
            if depth == 0 {
                return Some(&trimmed[1..index]);
            }
        }
    }

    None
}

fn split_top_level_json_fields(json_object_body: &str) -> Vec<(&str, &str)> {
    split_top_level_json_values(json_object_body)
        .into_iter()
        .filter_map(|field| {
            let colon = top_level_colon_index(field)?;
            Some((&field[..colon], &field[colon + 1..]))
        })
        .collect()
}

fn split_top_level_json_values(json: &str) -> Vec<&str> {
    let mut values = Vec::new();
    let mut start = 0_usize;
    let mut object_depth = 0_i32;
    let mut array_depth = 0_i32;
    let mut in_string = false;
    let mut escaped = false;

    for (index, character) in json.char_indices() {
        if in_string {
            if escaped {
                escaped = false;
            } else if character == '\\' {
                escaped = true;
            } else if character == '"' {
                in_string = false;
            }
            continue;
        }

        match character {
            '"' => in_string = true,
            '{' => object_depth += 1,
            '}' => object_depth -= 1,
            '[' => array_depth += 1,
            ']' => array_depth -= 1,
            ',' if object_depth == 0 && array_depth == 0 => {
                let value = json[start..index].trim();
                if !value.is_empty() {
                    values.push(value);
                }
                start = index + 1;
            }
            _ => {}
        }
    }

    let value = json[start..].trim();
    if !value.is_empty() {
        values.push(value);
    }

    values
}

fn top_level_colon_index(json_field: &str) -> Option<usize> {
    let mut object_depth = 0_i32;
    let mut array_depth = 0_i32;
    let mut in_string = false;
    let mut escaped = false;

    for (index, character) in json_field.char_indices() {
        if in_string {
            if escaped {
                escaped = false;
            } else if character == '\\' {
                escaped = true;
            } else if character == '"' {
                in_string = false;
            }
            continue;
        }

        match character {
            '"' => in_string = true,
            '{' => object_depth += 1,
            '}' => object_depth -= 1,
            '[' => array_depth += 1,
            ']' => array_depth -= 1,
            ':' if object_depth == 0 && array_depth == 0 => return Some(index),
            _ => {}
        }
    }

    None
}

fn json_number_is_positive(value: &str) -> bool {
    let value = value.trim();
    if value.starts_with('"') || value.starts_with('{') || value.starts_with('[') {
        return false;
    }

    let number: String = value
        .chars()
        .take_while(|character| {
            character.is_ascii_digit()
                || *character == '-'
                || *character == '+'
                || *character == '.'
                || *character == 'e'
                || *character == 'E'
        })
        .collect();
    !number.is_empty() && number.parse::<f64>().is_ok_and(|parsed| parsed.is_finite() && parsed > 0.0)
}

fn json_string_is_non_empty(value: &str) -> bool {
    json_string_value(value).is_some_and(|string| !string.is_empty())
}

fn json_string_value(value: &str) -> Option<&str> {
    let trimmed = value.trim();
    if !trimmed.starts_with('"') {
        return None;
    }

    let mut escaped = false;
    for (index, character) in trimmed[1..].char_indices() {
        if escaped {
            escaped = false;
            continue;
        }

        if character == '\\' {
            escaped = true;
            continue;
        }

        if character == '"' {
            return Some(&trimmed[1..index + 1]);
        }
    }

    None
}

fn validate_plugin_capability_key(capability_key: &str) -> Result<(), String> {
    if capability_key.trim().is_empty() {
        return Err("plugin capability key is required".to_string());
    }
    if capability_key == "sandbox.database"
        || capability_key.starts_with("sandbox.database.")
        || capability_key == "sandbox.db"
        || capability_key.starts_with("sandbox.db.")
        || capability_key == "sandbox.spacetimedb"
        || capability_key.starts_with("sandbox.spacetimedb.")
    {
        return Err("plugin capability key is forbidden".to_string());
    }

    Ok(())
}

fn plugin_capability_key_exists(ctx: &ReducerContext, bundle_id: &str, capability_key: &str) -> bool {
    ctx.db
        .plugin_capabilities()
        .iter()
        .any(|capability| capability.bundle_id == bundle_id && capability.capability_key == capability_key)
}

fn set_plugin_capabilities_enabled(
    ctx: &ReducerContext,
    plugin_id: &str,
    enabled: bool,
) {
    for mut capability in ctx.db.plugin_capabilities().iter() {
        if capability.plugin_id == plugin_id {
            capability.status = if enabled { "enabled" } else { "disabled" }.to_string();
            capability.updated_at = ctx.timestamp;
            ctx.db.plugin_capabilities().id().update(capability);
        }
    }
}

#[reducer]
pub fn upsert_plugin_deployment(
    ctx: &ReducerContext,
    id: String,
    plugin_id: String,
    bundle_id: String,
    server_id: String,
    status: String,
    desired_version: String,
    active_version: String,
    error_message: String,
) -> Result<(), String> {
    validate_deployment_status(&status)?;
    validate_plugin_deployment_identity_fields(&id, &plugin_id, &bundle_id, &server_id)?;
    if !plugin_exists(ctx, &plugin_id) {
        return Err("plugin must exist before deployment writes".to_string());
    }
    let Some(bundle) = ctx.db.plugin_bundles().id().find(bundle_id.clone()) else {
        return Err("plugin bundle must exist before deployment writes".to_string());
    };
    if bundle.plugin_id != plugin_id {
        return Err("plugin deployment bundle mismatch".to_string());
    }
    if !server_exists(ctx, &server_id) {
        return Err("server must exist before deployment writes".to_string());
    }
    if status == "active" && !plugin_is_active(ctx, &plugin_id) {
        return Err("plugin must be active before active deployment writes".to_string());
    }
    if status == "active" && bundle.status != "registered" {
        return Err("plugin bundle must be registered before active deployment writes".to_string());
    }
    if status == "pending" && bundle.status != "registered" {
        return Err("plugin bundle must be registered before pending deployment writes".to_string());
    }
    if (status == "active" || status == "pending") && desired_version != bundle.version {
        return Err("plugin deployment desired version must match bundle version".to_string());
    }
    if status == "active" && active_version != bundle.version {
        return Err("active plugin deployment version must match bundle version".to_string());
    }
    if status == "pending" && !active_version.is_empty() {
        return Err("pending plugin deployment must not have an active version".to_string());
    }
    if (status == "active" || status == "pending" || status == "rolled_back") && !error_message.is_empty() {
        return Err("active, pending, and rolled back deployments must not have an error message".to_string());
    }
    if (status == "failed" || status == "killed") && error_message.trim().is_empty() {
        return Err("failed and killed deployments require an error message".to_string());
    }
    let deployed_at = if status == "active" {
        supersede_active_plugin_deployments(ctx, &plugin_id, &server_id, &id);
        Some(ctx.timestamp)
    } else {
        None
    };

    if let Some(mut deployment) = ctx.db.plugin_deployments().id().find(id.clone()) {
        if deployment.plugin_id != plugin_id || deployment.bundle_id != bundle_id || deployment.server_id != server_id {
            return Err("plugin deployment identity mismatch".to_string());
        }
        deployment.status = status;
        deployment.desired_version = desired_version;
        deployment.active_version = active_version;
        deployment.deployed_at = deployed_at;
        deployment.error_message = error_message;
        ctx.db.plugin_deployments().id().update(deployment);
        return Ok(());
    }

    ctx.db.plugin_deployments().insert(PluginDeployment {
        id,
        plugin_id,
        bundle_id,
        server_id,
        status,
        desired_version,
        active_version,
        deployed_at,
        error_message,
    });
    Ok(())
}

fn validate_plugin_deployment_identity_fields(id: &str, plugin_id: &str, bundle_id: &str, server_id: &str) -> Result<(), String> {
    if id.trim().is_empty() {
        return Err("plugin deployment id is required".to_string());
    }
    if plugin_id.trim().is_empty() {
        return Err("plugin deployment plugin id is required".to_string());
    }
    if bundle_id.trim().is_empty() {
        return Err("plugin deployment bundle id is required".to_string());
    }
    if server_id.trim().is_empty() {
        return Err("plugin deployment server id is required".to_string());
    }

    Ok(())
}

fn supersede_active_plugin_deployments(
    ctx: &ReducerContext,
    plugin_id: &str,
    server_id: &str,
    except_deployment_id: &str,
) {
    for mut deployment in ctx.db.plugin_deployments().iter() {
        if deployment.plugin_id == plugin_id
            && deployment.server_id == server_id
            && deployment.id != except_deployment_id
            && deployment.status == "active"
        {
            deployment.status = "rolled_back".to_string();
            ctx.db.plugin_deployments().id().update(deployment);
        }
    }
}

fn validate_plugin_status(status: &str) -> Result<(), String> {
    match status {
        "installed" | "active" | "disabled" | "failed" => Ok(()),
        _ => Err("invalid plugin status".to_string()),
    }
}

fn validate_package_trust_level(trust_level: &str) -> Result<(), String> {
    match trust_level {
        "marketplace" | "community" | "local" => Ok(()),
        _ => Err("invalid plugin package trust level".to_string()),
    }
}

fn validate_bundle_status(status: &str) -> Result<(), String> {
    match status {
        "registered" | "revoked" => Ok(()),
        _ => Err("invalid plugin bundle status".to_string()),
    }
}

fn validate_runtime_type(runtime_type: &str) -> Result<(), String> {
    match runtime_type {
        "wasm" | "js_sidecar" | "native_sidecar" => Ok(()),
        _ => Err("invalid plugin bundle runtime type".to_string()),
    }
}

fn validate_capability_status(status: &str) -> Result<(), String> {
    match status {
        "enabled" | "disabled" => Ok(()),
        _ => Err("invalid plugin capability status".to_string()),
    }
}

fn validate_deployment_status(status: &str) -> Result<(), String> {
    match status {
        "pending" | "active" | "failed" | "rolled_back" | "killed" => Ok(()),
        _ => Err("invalid deployment status".to_string()),
    }
}

#[reducer]
pub fn register_plugin_schema(
    ctx: &ReducerContext,
    plugin_id: String,
    schema_version: u64,
    entity_type: String,
    schema_json: String,
    migration_plan_json: String,
    status: String,
) -> Result<(), String> {
    validate_plugin_schema_identity(&plugin_id, &entity_type)?;
    validate_plugin_schema_status(&status)?;
    if schema_version == 0 {
        return Err("schema version must be positive".to_string());
    }
    if !plugin_exists(ctx, &plugin_id) {
        return Err("plugin must exist before schema writes".to_string());
    }
    validate_plugin_schema_json(&schema_json)?;
    validate_plugin_schema_migration_plan(&entity_type, &migration_plan_json)?;

    let id = plugin_schema_id(&plugin_id, &entity_type, schema_version);
    let schema = PluginSchema {
        id: id.clone(),
        plugin_id,
        schema_version,
        entity_type,
        schema_json,
        migration_plan_json,
        status,
        registered_at: ctx.timestamp,
    };

    if ctx.db.plugin_schemas().id().find(id).is_some() {
        ctx.db.plugin_schemas().id().update(schema);
    } else {
        ctx.db.plugin_schemas().insert(schema);
    }
    Ok(())
}

fn validate_plugin_schema_identity(plugin_id: &str, entity_type: &str) -> Result<(), String> {
    if plugin_id.trim().is_empty() {
        return Err("plugin schema plugin id is required".to_string());
    }
    if entity_type.trim().is_empty() {
        return Err("plugin schema entity type is required".to_string());
    }
    Ok(())
}

#[reducer]
pub fn upsert_plugin_entity(
    ctx: &ReducerContext,
    id: String,
    plugin_id: String,
    entity_type: String,
    owner_type: String,
    owner_id: String,
    data_json: String,
) -> Result<(), String> {
    validate_plugin_entity_identity(&id, &plugin_id, &entity_type, &owner_id)?;
    validate_plugin_entity_owner_type(&owner_type)?;
    if !plugin_is_active(ctx, &plugin_id) {
        return Err("plugin must be active before entity writes".to_string());
    }
    let Some(schema) = find_active_plugin_schema(ctx, &plugin_id, &entity_type) else {
        return Err("plugin schema must exist before entity writes".to_string());
    };
    validate_plugin_entity_data_json(&schema.schema_json, &data_json)?;

    if let Some(mut entity) = ctx.db.plugin_entities().id().find(id.clone()) {
        if entity.plugin_id != plugin_id {
            return Err("plugin entity namespace mismatch".to_string());
        }
        if entity.entity_type != entity_type {
            return Err("plugin entity type mismatch".to_string());
        }

        entity.owner_type = owner_type;
        entity.owner_id = owner_id;
        entity.data_json = data_json;
        entity.updated_at = ctx.timestamp;
        ctx.db.plugin_entities().id().update(entity);
        return Ok(());
    }

    ctx.db.plugin_entities().insert(PluginEntity {
        id,
        plugin_id,
        entity_type,
        owner_type,
        owner_id,
        data_json,
        created_at: ctx.timestamp,
        updated_at: ctx.timestamp,
    });
    Ok(())
}

fn validate_plugin_entity_identity(id: &str, plugin_id: &str, entity_type: &str, owner_id: &str) -> Result<(), String> {
    if id.trim().is_empty() {
        return Err("plugin entity id is required".to_string());
    }
    if plugin_id.trim().is_empty() {
        return Err("plugin entity plugin id is required".to_string());
    }
    if entity_type.trim().is_empty() {
        return Err("plugin entity type is required".to_string());
    }
    if owner_id.trim().is_empty() {
        return Err("plugin entity owner id is required".to_string());
    }
    Ok(())
}

fn validate_plugin_schema_status(status: &str) -> Result<(), String> {
    match status {
        "active" | "pending" | "disabled" => Ok(()),
        _ => Err("invalid plugin schema status".to_string()),
    }
}

fn validate_plugin_schema_json(schema_json: &str) -> Result<(), String> {
    let trimmed = schema_json.trim();
    if !trimmed.starts_with('{') || !trimmed.ends_with('}') {
        return Err("plugin schema json must be an object".to_string());
    }
    if !trimmed.contains("\"type\"") {
        return Err("plugin schema json must declare type".to_string());
    }
    Ok(())
}

fn validate_plugin_schema_migration_plan(entity_type: &str, migration_plan_json: &str) -> Result<(), String> {
    let trimmed = migration_plan_json.trim();
    if !trimmed.starts_with('[') || !trimmed.ends_with(']') {
        return Err("plugin schema migration plan must be an array".to_string());
    }

    if trimmed == "[]" {
        return Ok(());
    }

    for blocked in ["run_sql", "raw_sql", "drop_table", "alter_table", "delete_core_table"] {
        if trimmed.contains(&format!("\"step\":\"{blocked}\"")) {
            return Err("unsupported plugin schema migration step".to_string());
        }
    }

    if trimmed.contains("\"step\":\"create_json_entity_type\"")
        && !trimmed.contains(&format!("\"entityType\":\"{}\"", json_escape(entity_type)))
        && !trimmed.contains(&format!("\"entity_type\":\"{}\"", json_escape(entity_type)))
    {
        return Err("plugin schema migration entity mismatch".to_string());
    }

    if trimmed.contains("\"step\":\"add_optional_property\"") || trimmed.contains("\"step\":\"add_required_property\"") {
        if !trimmed.contains("\"property\"") || !trimmed.contains("\"schema\"") || !trimmed.contains("\"type\"") {
            return Err("plugin schema migration property schema is invalid".to_string());
        }
        for invalid_type in ["integer", "null", "any"] {
            if trimmed.contains(&format!("\"type\":\"{invalid_type}\"")) {
                return Err("plugin schema migration property schema is invalid".to_string());
            }
        }
    }

    Ok(())
}

fn validate_plugin_entity_owner_type(owner_type: &str) -> Result<(), String> {
    match owner_type {
        "character" | "business" | "server" | "plugin" | "resource" => Ok(()),
        _ => Err("invalid plugin entity owner type".to_string()),
    }
}

fn validate_plugin_entity_data_json(schema_json: &str, data_json: &str) -> Result<(), String> {
    let data = data_json.trim();
    if !data.starts_with('{') || !data.ends_with('}') {
        return Err("plugin entity data must be a json object".to_string());
    }

    for required in extract_schema_required_fields(schema_json) {
        if !json_object_has_key(data, &required) {
            return Err("plugin entity data missing required field".to_string());
        }
    }

    for (property, property_type) in extract_schema_property_types(schema_json) {
        if json_object_has_key(data, &property) && !json_object_field_matches_type(data, &property, &property_type) {
            return Err("plugin entity data field type mismatch".to_string());
        }
    }

    Ok(())
}

fn extract_schema_required_fields(schema_json: &str) -> Vec<String> {
    extract_string_array_field(schema_json, "\"required\"").unwrap_or_default()
}

fn extract_schema_property_types(schema_json: &str) -> Vec<(String, String)> {
    let Some(properties_index) = schema_json.find("\"properties\"") else {
        return Vec::new();
    };
    let after_properties = &schema_json[properties_index..];
    let Some(mut cursor) = after_properties.find('{').map(|index| index + 1) else {
        return Vec::new();
    };

    let mut properties = Vec::new();
    while cursor < after_properties.len() {
        let remaining = &after_properties[cursor..];
        let Some(key_start) = remaining.find('"') else {
            break;
        };
        let after_key_start = cursor + key_start + 1;
        let Some(key_end) = after_properties[after_key_start..].find('"') else {
            break;
        };
        let key = &after_properties[after_key_start..after_key_start + key_end];
        if key == "type" {
            break;
        }

        let after_key = &after_properties[after_key_start + key_end..];
        let Some(type_index) = after_key.find("\"type\"") else {
            break;
        };
        let type_section = &after_key[type_index + "\"type\"".len()..];
        let Some(type_value_start) = type_section.find('"') else {
            break;
        };
        let after_type_value_start = type_value_start + 1;
        let Some(type_value_end) = type_section[after_type_value_start..].find('"') else {
            break;
        };
        let property_type = &type_section[after_type_value_start..after_type_value_start + type_value_end];
        properties.push((key.to_string(), property_type.to_string()));
        cursor = after_key_start + key_end + type_index + after_type_value_start + type_value_end;
    }

    properties
}

fn json_object_has_key(json: &str, key: &str) -> bool {
    json.contains(&format!("\"{}\"", json_escape(key)))
}

fn json_object_field_matches_type(json: &str, key: &str, property_type: &str) -> bool {
    let Some(key_index) = json.find(&format!("\"{}\"", json_escape(key))) else {
        return false;
    };
    let after_key = &json[key_index + key.len() + 2..];
    let Some(colon_index) = after_key.find(':') else {
        return false;
    };
    let value = after_key[colon_index + 1..].trim_start();

    match property_type {
        "string" => value.starts_with('"'),
        "number" => value.chars().next().is_some_and(|character| character.is_ascii_digit() || character == '-'),
        "boolean" => value.starts_with("true") || value.starts_with("false"),
        "object" => value.starts_with('{'),
        "array" => value.starts_with('['),
        _ => false,
    }
}

fn validate_account_owner_type(owner_type: &str) -> Result<(), String> {
    match owner_type {
        "character" | "business" | "government" | "society" | "plugin" => Ok(()),
        _ => Err("invalid account owner type".to_string()),
    }
}

fn find_active_plugin_schema(ctx: &ReducerContext, plugin_id: &str, entity_type: &str) -> Option<PluginSchema> {
    ctx.db
        .plugin_schemas()
        .iter()
        .filter(|schema| schema.plugin_id == plugin_id && schema.entity_type == entity_type && schema.status == "active")
        .max_by_key(|schema| schema.schema_version)
}

fn plugin_schema_id(plugin_id: &str, entity_type: &str, schema_version: u64) -> String {
    format!("{plugin_id}:{entity_type}:{schema_version}")
}

#[reducer]
pub fn record_plugin_sandbox_event(
    ctx: &ReducerContext,
    id: String,
    plugin_id: String,
    server_id: String,
    event_type: String,
    payload_hash: String,
    status: String,
) -> Result<(), String> {
    validate_plugin_sandbox_event_identity(&id, &plugin_id, &server_id, &event_type, &payload_hash)?;
    validate_sandbox_event_status(&status)?;
    if !plugin_exists(ctx, &plugin_id) {
        return Err("plugin must exist before sandbox event writes".to_string());
    }
    if !server_exists(ctx, &server_id) {
        return Err("server must exist before sandbox event writes".to_string());
    }

    ctx.db.plugin_sandbox_events().insert(PluginSandboxEvent {
        id,
        plugin_id,
        server_id,
        event_type,
        payload_hash,
        status,
        created_at: ctx.timestamp,
    });
    Ok(())
}

fn validate_plugin_sandbox_event_identity(
    id: &str,
    plugin_id: &str,
    server_id: &str,
    event_type: &str,
    payload_hash: &str,
) -> Result<(), String> {
    if id.trim().is_empty() {
        return Err("plugin sandbox event id is required".to_string());
    }
    if plugin_id.trim().is_empty() {
        return Err("plugin sandbox event plugin id is required".to_string());
    }
    if server_id.trim().is_empty() {
        return Err("plugin sandbox event server id is required".to_string());
    }
    if event_type.trim().is_empty() {
        return Err("plugin sandbox event type is required".to_string());
    }
    if payload_hash.trim().is_empty() {
        return Err("plugin sandbox event payload hash is required".to_string());
    }
    Ok(())
}

fn validate_sandbox_event_status(status: &str) -> Result<(), String> {
    match status {
        "succeeded" | "failed" => Ok(()),
        _ => Err("invalid sandbox event status".to_string()),
    }
}
