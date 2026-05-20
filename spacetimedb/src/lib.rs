use spacetimedb::{reducer, table, ReducerContext, Table, Timestamp};

#[table(name = servers, public)]
pub struct Server {
    #[primary_key]
    pub id: String,
    pub name: String,
    pub environment: String,
    pub public_key: String,
    pub status: String,
    pub last_heartbeat_at: Timestamp,
}

#[table(name = runtime_instances, public)]
pub struct RuntimeInstance {
    #[primary_key]
    pub id: String,
    pub server_id: String,
    pub resource_version: String,
    pub fxserver_build: String,
    pub game_build: String,
    pub status: String,
    pub started_at: Timestamp,
    pub last_seen_at: Timestamp,
}

#[table(name = heartbeat_nonces)]
pub struct HeartbeatNonce {
    #[primary_key]
    pub id: String,
    pub server_id: String,
    pub nonce: String,
    pub signature: String,
    pub seen_at: Timestamp,
}

#[table(name = runtime_actions)]
pub struct RuntimeAction {
    #[primary_key]
    pub id: String,
    pub server_id: String,
    pub actor_id: String,
    pub action_type: String,
    pub payload_hash: String,
    pub signature: String,
    pub nonce: String,
    pub idempotency_key: String,
    pub status: String,
    pub created_at: Timestamp,
    pub completed_at: Option<Timestamp>,
}

#[table(name = audit_logs, public)]
pub struct AuditLog {
    #[primary_key]
    pub id: String,
    pub server_id: String,
    pub actor_id: String,
    pub plugin_id: String,
    pub action_type: String,
    pub permission_key: String,
    pub target_type: String,
    pub target_id: String,
    pub before_json: String,
    pub after_json: String,
    pub status: String,
    pub created_at: Timestamp,
}

#[table(name = runtime_config, public)]
pub struct RuntimeConfig {
    #[primary_key]
    pub id: String,
    pub server_id: String,
    pub namespace: String,
    pub key: String,
    pub value_json: String,
    pub version: u64,
    pub updated_at: Timestamp,
}

#[table(name = runtime_config_acks, public)]
pub struct RuntimeConfigAck {
    #[primary_key]
    pub id: String,
    pub server_id: String,
    pub namespace: String,
    pub key: String,
    pub version: u64,
    pub acknowledged_at: Timestamp,
}

#[table(name = menu_definitions, public)]
pub struct MenuDefinition {
    #[primary_key]
    pub id: String,
    pub plugin_id: String,
    pub label: String,
    pub parent_id: String,
    pub icon: String,
    pub order: i32,
    pub required_permission: String,
    pub action_id: String,
    pub enabled: bool,
    pub visibility_policy_id: String,
}

#[table(name = menu_actions, public)]
pub struct MenuAction {
    #[primary_key]
    pub id: String,
    pub plugin_id: String,
    pub action_type: String,
    pub reducer_name: String,
    pub payload_schema_json: String,
    pub confirmation_required: bool,
    pub audit_level: String,
    pub required_permission: String,
    pub enabled: bool,
}

#[table(name = runtime_commands, public)]
pub struct RuntimeCommand {
    #[primary_key]
    pub id: String,
    pub plugin_id: String,
    pub name: String,
    pub aliases_json: String,
    pub action_id: String,
    pub required_permission: String,
    pub payload_schema_json: String,
    pub audit_level: String,
    pub enabled: bool,
}

#[table(name = runtime_panels, public)]
pub struct RuntimePanel {
    #[primary_key]
    pub id: String,
    pub plugin_id: String,
    pub title: String,
    pub route: String,
    pub required_permission: String,
    pub icon: String,
    pub order: i32,
    pub enabled: bool,
}

#[table(name = menu_visibility_policies, public)]
pub struct MenuVisibilityPolicy {
    #[primary_key]
    pub id: String,
    pub plugin_id: String,
    pub policy_json: String,
    pub enabled: bool,
}

#[table(name = menu_sessions, public)]
pub struct MenuSession {
    #[primary_key]
    pub id: String,
    pub server_id: String,
    pub player_id: String,
    pub opened_at: Timestamp,
    pub closed_at: Option<Timestamp>,
    pub cache_version: u64,
}

#[table(name = principals, public)]
pub struct Principal {
    #[primary_key]
    pub id: String,
    pub principal_type: String,
    pub external_id: String,
    pub name: String,
    pub created_at: Timestamp,
}

#[table(name = principal_edges, public)]
pub struct PrincipalEdge {
    #[primary_key]
    pub id: String,
    pub parent_principal_id: String,
    pub child_principal_id: String,
    pub source: String,
    pub expires_at: Option<Timestamp>,
}

#[table(name = permission_grants, public)]
pub struct PermissionGrant {
    #[primary_key]
    pub id: String,
    pub principal_id: String,
    pub permission_key: String,
    pub effect: String,
    pub source: String,
    pub expires_at: Option<Timestamp>,
}

#[table(name = permissions, public)]
pub struct Permission {
    #[primary_key]
    pub id: String,
    #[unique]
    pub key: String,
    pub description: String,
    pub plugin_id: String,
    pub created_at: Timestamp,
}

#[table(name = permission_cache_versions, public)]
pub struct PermissionCacheVersion {
    #[primary_key]
    pub server_id: String,
    pub version: u64,
    pub updated_at: Timestamp,
}

#[table(name = ace_mirror_rules, public)]
pub struct AceMirrorRule {
    #[primary_key]
    pub id: String,
    pub permission_key: String,
    pub ace_object: String,
    pub enabled: bool,
    pub mode: String,
    pub updated_at: Timestamp,
}

#[table(name = policy_constraints, public)]
pub struct PolicyConstraint {
    #[primary_key]
    pub id: String,
    pub permission_key: String,
    pub constraint_type: String,
    pub constraint_json: String,
    pub priority: i32,
    pub enabled: bool,
}

#[table(name = plugins, public)]
pub struct Plugin {
    #[primary_key]
    pub id: String,
    pub name: String,
    pub version: String,
    pub status: String,
    pub trust_level: String,
    pub signature: String,
    pub bundle_hash: String,
    pub created_by: String,
    pub created_at: Timestamp,
    pub updated_at: Timestamp,
}

#[table(name = plugin_packages, public)]
pub struct PluginPackage {
    #[primary_key]
    pub package_id: String,
    pub plugin_id: String,
    pub version: String,
    pub source: String,
    pub publisher: String,
    pub trust_level: String,
    pub signer_id: String,
    pub signature: String,
    pub manifest_hash: String,
    pub installed_at: Timestamp,
    pub updated_at: Timestamp,
}

#[table(name = plugin_package_signer_revocations, public)]
pub struct PluginPackageSignerRevocation {
    #[primary_key]
    pub signer_id: String,
    pub actor_id: String,
    pub reason: String,
    pub affected_plugin_ids_json: String,
    pub revoked_at: Timestamp,
}

#[table(name = plugin_bundles, public)]
pub struct PluginBundle {
    #[primary_key]
    pub id: String,
    pub plugin_id: String,
    pub version: String,
    pub artifact_url: String,
    pub bundle_hash: String,
    pub signature: String,
    pub signer_id: String,
    pub runtime_type: String,
    pub status: String,
    pub created_at: Timestamp,
}

#[table(name = plugin_capabilities, public)]
pub struct PluginCapability {
    #[primary_key]
    pub id: String,
    pub plugin_id: String,
    pub bundle_id: String,
    pub capability_key: String,
    pub constraints_json: String,
    pub status: String,
    pub updated_at: Timestamp,
}

#[table(name = plugin_deployments, public)]
pub struct PluginDeployment {
    #[primary_key]
    pub id: String,
    pub plugin_id: String,
    pub bundle_id: String,
    pub server_id: String,
    pub status: String,
    pub desired_version: String,
    pub active_version: String,
    pub deployed_at: Option<Timestamp>,
    pub error_message: String,
}

#[table(name = plugin_manifests, public)]
pub struct PluginManifest {
    #[primary_key]
    pub plugin_id: String,
    pub manifest_json: String,
    pub required_permissions: String,
    pub required_tables: String,
    pub required_hooks: String,
    pub required_connectors: String,
    pub schema_version: u64,
    pub updated_at: Timestamp,
}

#[table(name = plugin_runtime_instances, public)]
pub struct PluginRuntimeInstance {
    #[primary_key]
    pub id: String,
    pub plugin_id: String,
    pub server_id: String,
    pub status: String,
    pub loaded_at: Option<Timestamp>,
    pub last_heartbeat: Timestamp,
    pub error_message: String,
}

#[table(name = plugin_config_values, public)]
pub struct PluginConfigValue {
    #[primary_key]
    pub id: String,
    pub plugin_id: String,
    pub server_id: String,
    pub key: String,
    pub value_json: String,
    pub version: u64,
    pub updated_at: Timestamp,
}

#[table(name = plugin_schemas, public)]
pub struct PluginSchema {
    #[primary_key]
    pub id: String,
    pub plugin_id: String,
    pub schema_version: u64,
    pub entity_type: String,
    pub schema_json: String,
    pub migration_plan_json: String,
    pub status: String,
    pub registered_at: Timestamp,
}

#[table(name = plugin_entities, public)]
pub struct PluginEntity {
    #[primary_key]
    pub id: String,
    pub plugin_id: String,
    pub entity_type: String,
    pub owner_type: String,
    pub owner_id: String,
    pub data_json: String,
    pub created_at: Timestamp,
    pub updated_at: Timestamp,
}

#[table(name = plugin_sandbox_events, public)]
pub struct PluginSandboxEvent {
    #[primary_key]
    pub id: String,
    pub plugin_id: String,
    pub server_id: String,
    pub event_type: String,
    pub payload_hash: String,
    pub status: String,
    pub created_at: Timestamp,
}

#[table(name = accounts, public)]
pub struct Account {
    #[primary_key]
    pub id: String,
    pub owner_type: String,
    pub owner_id: String,
    pub currency: String,
    pub balance: i128,
    pub status: String,
    pub created_at: Timestamp,
    pub updated_at: Timestamp,
}

#[table(name = transactions, public)]
pub struct Transaction {
    #[primary_key]
    pub id: String,
    pub transaction_type: String,
    pub actor_id: String,
    pub status: String,
    pub idempotency_key: String,
    pub metadata_json: String,
    pub created_at: Timestamp,
    pub completed_at: Option<Timestamp>,
}

#[table(name = ledger_entries, public)]
pub struct LedgerEntry {
    #[primary_key]
    pub id: String,
    pub transaction_id: String,
    pub account_id: String,
    pub direction: String,
    pub amount: i128,
    pub reason: String,
    pub metadata_json: String,
    pub created_at: Timestamp,
}

#[table(name = invoices, public)]
pub struct Invoice {
    #[primary_key]
    pub id: String,
    pub issuer_account_id: String,
    pub payer_account_id: String,
    pub amount: i128,
    pub currency: String,
    pub reason: String,
    pub status: String,
    pub issued_by: String,
    pub idempotency_key: String,
    pub issued_at: Timestamp,
    pub due_at: Option<Timestamp>,
    pub paid_at: Option<Timestamp>,
}

#[table(name = economy_limits, public)]
pub struct EconomyLimit {
    #[primary_key]
    pub id: String,
    pub permission_key: String,
    pub action_type: String,
    pub limit_json: String,
    pub enabled: bool,
}

#[table(name = items, public)]
pub struct Item {
    #[primary_key]
    pub key: String,
    pub plugin_id: String,
    pub label: String,
    pub stackable: bool,
    pub max_stack: u64,
}

#[table(name = jobs, public)]
pub struct Job {
    #[primary_key]
    pub key: String,
    pub plugin_id: String,
    pub label: String,
    pub grades_json: String,
}

#[table(name = vehicles, public)]
pub struct Vehicle {
    #[primary_key]
    pub model: String,
    pub plugin_id: String,
    pub label: String,
    pub category: String,
}

#[table(name = locations, public)]
pub struct Location {
    #[primary_key]
    pub key: String,
    pub plugin_id: String,
    pub label: String,
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

#[table(name = characters, public)]
pub struct Character {
    #[primary_key]
    pub id: String,
    pub player_principal_id: String,
    pub citizen_id: String,
    pub cid: u64,
    pub slot: u64,
    pub license: String,
    pub name: String,
    pub charinfo_json: String,
    pub metadata_json: String,
    pub gang_json: String,
    pub position_json: String,
    pub phone_number: String,
    pub account_number: String,
    pub selected: bool,
    pub updated_at: Timestamp,
}

#[table(name = inventory_stacks, public)]
pub struct InventoryStack {
    #[primary_key]
    pub id: String,
    pub owner_id: String,
    pub item_key: String,
    pub quantity: u64,
    pub updated_at: Timestamp,
}

#[table(name = character_jobs, public)]
pub struct CharacterJob {
    #[primary_key]
    pub character_id: String,
    pub job_key: String,
    pub grade: String,
    pub on_duty: bool,
    pub updated_at: Timestamp,
}

#[table(name = plugin_hooks, public)]
pub struct PluginHook {
    #[primary_key]
    pub id: String,
    pub plugin_id: String,
    pub hook_name: String,
    pub capability: String,
    pub handler_type: String,
    pub handler_ref: String,
    pub priority: i32,
    pub enabled: bool,
}

#[reducer]
pub fn register_server(
    ctx: &ReducerContext,
    id: String,
    name: String,
    environment: String,
    public_key: String,
) -> Result<(), String> {
    validate_server_registration_identity(&id, &name, &environment, &public_key)?;
    let now = ctx.timestamp;
    let server = Server {
        id: id.clone(),
        name,
        environment,
        public_key,
        status: "online".to_string(),
        last_heartbeat_at: now,
    };

    if ctx.db.servers().id().find(id).is_some() {
        ctx.db.servers().id().update(server);
        return Ok(());
    }

    ctx.db.servers().insert(server);
    Ok(())
}

fn validate_server_registration_identity(
    id: &str,
    name: &str,
    environment: &str,
    public_key: &str,
) -> Result<(), String> {
    if id.trim().is_empty() {
        return Err("server id is required".to_string());
    }
    if name.trim().is_empty() {
        return Err("server name is required".to_string());
    }
    if environment.trim().is_empty() {
        return Err("server environment is required".to_string());
    }
    if public_key.trim().is_empty() {
        return Err("server public key is required".to_string());
    }
    Ok(())
}

#[reducer]
pub fn heartbeat(
    ctx: &ReducerContext,
    id: String,
    server_id: String,
    resource_version: String,
    fxserver_build: String,
    game_build: String,
    nonce: String,
    signature: String,
) -> Result<(), String> {
    validate_heartbeat_identity(&id, &server_id, &resource_version, &fxserver_build, &game_build, &nonce, &signature)?;
    ensure_heartbeat_replay_safe(ctx, &server_id, &nonce, &signature)?;
    record_server_heartbeat(ctx, &server_id)?;

    let now = ctx.timestamp;
    ctx.db.runtime_instances().insert(RuntimeInstance {
        id,
        server_id: server_id.clone(),
        resource_version,
        fxserver_build,
        game_build,
        status: "online".to_string(),
        started_at: now,
        last_seen_at: now,
    });
    ctx.db.heartbeat_nonces().insert(HeartbeatNonce {
        id: heartbeat_nonce_id(&server_id, &nonce),
        server_id,
        nonce,
        signature,
        seen_at: now,
    });
    Ok(())
}

fn validate_heartbeat_identity(
    id: &str,
    server_id: &str,
    resource_version: &str,
    fxserver_build: &str,
    game_build: &str,
    nonce: &str,
    signature: &str,
) -> Result<(), String> {
    if id.trim().is_empty() {
        return Err("heartbeat runtime instance id is required".to_string());
    }
    if server_id.trim().is_empty() {
        return Err("heartbeat server id is required".to_string());
    }
    if resource_version.trim().is_empty() {
        return Err("heartbeat resource version is required".to_string());
    }
    if fxserver_build.trim().is_empty() {
        return Err("heartbeat fxserver build is required".to_string());
    }
    if game_build.trim().is_empty() {
        return Err("heartbeat game build is required".to_string());
    }
    if nonce.trim().is_empty() {
        return Err("heartbeat nonce is required".to_string());
    }
    if signature.trim().is_empty() {
        return Err("heartbeat signature is required".to_string());
    }
    Ok(())
}

fn ensure_heartbeat_replay_safe(
    ctx: &ReducerContext,
    server_id: &str,
    nonce: &str,
    signature: &str,
) -> Result<(), String> {
    if signature.is_empty() || nonce.is_empty() {
        return Err("heartbeat signature is required".to_string());
    }

    if ctx
        .db
        .heartbeat_nonces()
        .iter()
        .any(|heartbeat| heartbeat.server_id == server_id && heartbeat.nonce == nonce)
    {
        return Err("heartbeat nonce replay".to_string());
    }

    Ok(())
}

fn record_server_heartbeat(ctx: &ReducerContext, server_id: &str) -> Result<(), String> {
    let Some(mut server) = ctx.db.servers().id().find(server_id.to_string()) else {
        return Err("unknown server".to_string());
    };

    server.last_heartbeat_at = ctx.timestamp;
    server.status = "online".to_string();
    ctx.db.servers().id().update(server);
    Ok(())
}

fn heartbeat_nonce_id(server_id: &str, nonce: &str) -> String {
    format!("{server_id}:{nonce}")
}

#[reducer]
pub fn submit_action(
    ctx: &ReducerContext,
    id: String,
    server_id: String,
    actor_id: String,
    action_type: String,
    payload_hash: String,
    signature: String,
    nonce: String,
    idempotency_key: String,
) -> Result<(), String> {
    validate_runtime_action_envelope(&id, &server_id, &actor_id, &action_type, &payload_hash, &signature, &nonce, &idempotency_key)?;
    if !server_exists(ctx, &server_id) {
        return Err("server must exist before action writes".to_string());
    }
    if ensure_runtime_action_replay_safe(
        ctx,
        &server_id,
        &actor_id,
        &action_type,
        &payload_hash,
        &signature,
        &nonce,
        &idempotency_key,
    )? {
        return Ok(());
    }

    ctx.db.runtime_actions().insert(RuntimeAction {
        id,
        server_id,
        actor_id,
        action_type,
        payload_hash,
        signature,
        nonce,
        idempotency_key,
        status: "submitted".to_string(),
        created_at: ctx.timestamp,
        completed_at: None,
    });
    Ok(())
}

fn validate_runtime_action_envelope(
    id: &str,
    server_id: &str,
    actor_id: &str,
    action_type: &str,
    payload_hash: &str,
    signature: &str,
    nonce: &str,
    idempotency_key: &str,
) -> Result<(), String> {
    if id.trim().is_empty() {
        return Err("runtime action id is required".to_string());
    }
    if server_id.trim().is_empty() {
        return Err("runtime action server id is required".to_string());
    }
    if actor_id.trim().is_empty() {
        return Err("runtime action actor id is required".to_string());
    }
    if action_type.trim().is_empty() {
        return Err("runtime action type is required".to_string());
    }
    if payload_hash.trim().is_empty() {
        return Err("runtime action payload hash is required".to_string());
    }
    if signature.trim().is_empty() {
        return Err("runtime action signature is required".to_string());
    }
    if nonce.trim().is_empty() {
        return Err("runtime action nonce is required".to_string());
    }
    if idempotency_key.trim().is_empty() {
        return Err("runtime action idempotency key is required".to_string());
    }
    Ok(())
}

fn ensure_runtime_action_replay_safe(
    ctx: &ReducerContext,
    server_id: &str,
    actor_id: &str,
    action_type: &str,
    payload_hash: &str,
    signature: &str,
    nonce: &str,
    idempotency_key: &str,
) -> Result<bool, String> {
    if signature.is_empty() {
        return Err("action signature is required".to_string());
    }

    for action in ctx.db.runtime_actions().iter() {
        if action.server_id == server_id && action.idempotency_key == idempotency_key {
            if action.actor_id == actor_id
                && action.action_type == action_type
                && action.payload_hash == payload_hash
            {
                return Ok(true);
            }

            return Err("action idempotency conflict".to_string());
        }

        if action.server_id == server_id && action.nonce == nonce {
            return Err("nonce replay".to_string());
        }
    }

    Ok(false)
}

#[reducer]
pub fn complete_action(ctx: &ReducerContext, action_id: String, status: String) -> Result<(), String> {
    validate_runtime_action_completion_identity(&action_id)?;
    if status != "completed" && status != "failed" {
        return Err("status must be completed or failed".to_string());
    }

    if let Some(mut action) = ctx.db.runtime_actions().id().find(action_id) {
        if action.completed_at.is_some() {
            return Err("action is already completed".to_string());
        }
        action.status = status;
        action.completed_at = Some(ctx.timestamp);
        ctx.db.runtime_actions().id().update(action);
        return Ok(());
    }

    Err("unknown action".to_string())
}

fn validate_runtime_action_completion_identity(action_id: &str) -> Result<(), String> {
    if action_id.trim().is_empty() {
        return Err("runtime action completion id is required".to_string());
    }
    Ok(())
}

#[reducer]
pub fn set_runtime_config(
    ctx: &ReducerContext,
    id: String,
    server_id: String,
    namespace: String,
    key: String,
    value_json: String,
    version: u64,
) -> Result<(), String> {
    validate_runtime_config_identity(&id, &server_id, &namespace, &key, &value_json)?;
    if !server_exists(ctx, &server_id) {
        return Err("server must exist before config writes".to_string());
    }

    ctx.db.runtime_config().insert(RuntimeConfig {
        id,
        server_id,
        namespace,
        key,
        value_json,
        version,
        updated_at: ctx.timestamp,
    });
    Ok(())
}

fn validate_runtime_config_identity(
    id: &str,
    server_id: &str,
    namespace: &str,
    key: &str,
    value_json: &str,
) -> Result<(), String> {
    if id.trim().is_empty() {
        return Err("runtime config id is required".to_string());
    }
    if server_id.trim().is_empty() {
        return Err("runtime config server id is required".to_string());
    }
    if namespace.trim().is_empty() {
        return Err("runtime config namespace is required".to_string());
    }
    if key.trim().is_empty() {
        return Err("runtime config key is required".to_string());
    }
    if value_json.trim().is_empty() {
        return Err("runtime config value json is required".to_string());
    }
    Ok(())
}

#[reducer]
pub fn ack_config_version(
    ctx: &ReducerContext,
    server_id: String,
    namespace: String,
    key: String,
    version: u64,
) -> Result<(), String> {
    validate_runtime_config_ack_identity(&server_id, &namespace, &key)?;
    let config = ctx
        .db
        .runtime_config()
        .iter()
        .find(|row| row.server_id == server_id && row.namespace == namespace && row.key == key);
    let Some(config) = config else {
        return Err("unknown config".to_string());
    };
    if config.version != version {
        return Err("config version mismatch".to_string());
    }

    let id = runtime_config_ack_id(&server_id, &namespace, &key);
    let ack = RuntimeConfigAck {
        id: id.clone(),
        server_id,
        namespace,
        key,
        version,
        acknowledged_at: ctx.timestamp,
    };
    if ctx.db.runtime_config_acks().id().find(id).is_some() {
        ctx.db.runtime_config_acks().id().update(ack);
    } else {
        ctx.db.runtime_config_acks().insert(ack);
    }
    Ok(())
}

fn validate_runtime_config_ack_identity(server_id: &str, namespace: &str, key: &str) -> Result<(), String> {
    if server_id.trim().is_empty() {
        return Err("runtime config ack server id is required".to_string());
    }
    if namespace.trim().is_empty() {
        return Err("runtime config ack namespace is required".to_string());
    }
    if key.trim().is_empty() {
        return Err("runtime config ack key is required".to_string());
    }
    Ok(())
}

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

#[reducer]
pub fn create_account(
    ctx: &ReducerContext,
    id: String,
    owner_type: String,
    owner_id: String,
    currency: String,
    balance: i128,
) -> Result<(), String> {
    validate_account_creation_identity(&id, &owner_type, &owner_id, &currency)?;
    validate_account_owner_type(&owner_type)?;
    if balance < 0 {
        return Err("balance cannot be negative".to_string());
    }

    ctx.db.accounts().insert(Account {
        id,
        owner_type,
        owner_id,
        currency,
        balance,
        status: "active".to_string(),
        created_at: ctx.timestamp,
        updated_at: ctx.timestamp,
    });
    Ok(())
}

fn validate_account_creation_identity(id: &str, owner_type: &str, owner_id: &str, currency: &str) -> Result<(), String> {
    if id.trim().is_empty() {
        return Err("account id is required".to_string());
    }
    if owner_type.trim().is_empty() {
        return Err("account owner type is required".to_string());
    }
    if owner_id.trim().is_empty() {
        return Err("account owner id is required".to_string());
    }
    if currency.trim().is_empty() {
        return Err("account currency is required".to_string());
    }
    Ok(())
}

#[reducer]
pub fn upsert_economy_limit(
    ctx: &ReducerContext,
    id: String,
    permission_key: String,
    action_type: String,
    limit_json: String,
    enabled: bool,
) -> Result<(), String> {
    validate_economy_limit_identity(&id, &permission_key, &action_type, &limit_json)?;
    if !permission_key_exists(ctx, &permission_key) {
        return Err("permission must exist before economy limit writes".to_string());
    }
    validate_economy_limit_json(&limit_json)?;

    ctx.db.economy_limits().insert(EconomyLimit {
        id,
        permission_key,
        action_type,
        limit_json,
        enabled,
    });
    Ok(())
}

fn validate_economy_limit_identity(id: &str, permission_key: &str, action_type: &str, limit_json: &str) -> Result<(), String> {
    if id.trim().is_empty() {
        return Err("economy limit id is required".to_string());
    }
    if permission_key.trim().is_empty() {
        return Err("economy limit permission key is required".to_string());
    }
    if action_type.trim().is_empty() {
        return Err("economy limit action type is required".to_string());
    }
    if limit_json.trim().is_empty() {
        return Err("economy limit json is required".to_string());
    }
    Ok(())
}

fn validate_economy_limit_json(limit_json: &str) -> Result<(), String> {
    let trimmed = limit_json.trim();
    if !trimmed.starts_with('{') || !trimmed.ends_with('}') {
        return Err("economy limit json must be an object".to_string());
    }

    let has_max_amount = trimmed.contains("\"max_amount\"") || trimmed.contains("\"maxAmount\"");
    let has_allowed_owner_types =
        trimmed.contains("\"allowed_account_owner_types\"") || trimmed.contains("\"allowedAccountOwnerTypes\"");
    if !has_max_amount && !has_allowed_owner_types {
        return Err("economy limit json must define max_amount or allowed_account_owner_types".to_string());
    }

    if has_max_amount {
        let Some(max_amount) = parse_limit_max_amount(trimmed) else {
            return Err("economy limit max_amount must be positive".to_string());
        };
        if max_amount <= 0 {
            return Err("economy limit max_amount must be positive".to_string());
        }
    }

    if has_allowed_owner_types {
        let Some(allowed_owner_types) = parse_limit_allowed_owner_types(trimmed) else {
            return Err("economy limit allowed_account_owner_types must be a non-empty string array".to_string());
        };
        if allowed_owner_types.is_empty() {
            return Err("economy limit allowed_account_owner_types must be a non-empty string array".to_string());
        }
        for owner_type in allowed_owner_types {
            if validate_account_owner_type(&owner_type).is_err() {
                return Err("economy limit allowed_account_owner_types contains invalid owner type".to_string());
            }
        }
    }

    Ok(())
}

#[reducer]
pub fn transfer_money(
    ctx: &ReducerContext,
    transaction_id: String,
    actor_id: String,
    from_account_id: String,
    to_account_id: String,
    amount: i128,
    reason: String,
    idempotency_key: String,
) -> Result<(), String> {
    post_account_transfer(
        ctx,
        transaction_id,
        actor_id,
        "economy.transfer".to_string(),
        from_account_id,
        to_account_id,
        amount,
        reason,
        idempotency_key,
        None,
    )
}

#[reducer]
pub fn deposit_cash(
    ctx: &ReducerContext,
    transaction_id: String,
    actor_id: String,
    account_id: String,
    amount: i128,
    reason: String,
    idempotency_key: String,
) -> Result<(), String> {
    post_single_account_transaction(
        ctx,
        transaction_id,
        actor_id,
        "economy.deposit_cash".to_string(),
        account_id,
        "credit".to_string(),
        amount,
        reason,
        idempotency_key,
    )
}

#[reducer]
pub fn withdraw_cash(
    ctx: &ReducerContext,
    transaction_id: String,
    actor_id: String,
    account_id: String,
    amount: i128,
    reason: String,
    idempotency_key: String,
) -> Result<(), String> {
    post_single_account_transaction(
        ctx,
        transaction_id,
        actor_id,
        "economy.withdraw_cash".to_string(),
        account_id,
        "debit".to_string(),
        amount,
        reason,
        idempotency_key,
    )
}

#[reducer]
pub fn pay_salary(
    ctx: &ReducerContext,
    transaction_id: String,
    actor_id: String,
    employer_account_id: String,
    employee_account_id: String,
    amount: i128,
    reason: String,
    idempotency_key: String,
) -> Result<(), String> {
    post_account_transfer(
        ctx,
        transaction_id,
        actor_id,
        "economy.pay_salary".to_string(),
        employer_account_id,
        employee_account_id,
        amount,
        reason,
        idempotency_key,
        None,
    )
}

#[reducer]
pub fn fine_player(
    ctx: &ReducerContext,
    transaction_id: String,
    actor_id: String,
    player_account_id: String,
    destination_account_id: String,
    amount: i128,
    reason: String,
    idempotency_key: String,
) -> Result<(), String> {
    post_account_transfer(
        ctx,
        transaction_id,
        actor_id,
        "economy.fine_player".to_string(),
        player_account_id,
        destination_account_id,
        amount,
        reason,
        idempotency_key,
        None,
    )
}

#[reducer]
pub fn buy_item(
    ctx: &ReducerContext,
    transaction_id: String,
    actor_id: String,
    buyer_account_id: String,
    seller_account_id: String,
    amount: i128,
    item_key: String,
    quantity: u64,
    idempotency_key: String,
) -> Result<(), String> {
    validate_item_transaction_identity(&item_key, "purchased item key")?;
    if quantity == 0 {
        return Err("quantity must be positive".to_string());
    }

    post_account_transfer(
        ctx,
        transaction_id,
        actor_id,
        "economy.buy_item".to_string(),
        buyer_account_id,
        seller_account_id,
        amount,
        item_transaction_reason("buy_item", &item_key),
        idempotency_key,
        Some(item_transaction_metadata_json(&item_key, quantity)),
    )
}

#[reducer]
pub fn sell_item(
    ctx: &ReducerContext,
    transaction_id: String,
    actor_id: String,
    seller_account_id: String,
    buyer_account_id: String,
    amount: i128,
    item_key: String,
    quantity: u64,
    idempotency_key: String,
) -> Result<(), String> {
    validate_item_transaction_identity(&item_key, "sold item key")?;
    if quantity == 0 {
        return Err("quantity must be positive".to_string());
    }

    post_account_transfer(
        ctx,
        transaction_id,
        actor_id,
        "economy.sell_item".to_string(),
        buyer_account_id,
        seller_account_id,
        amount,
        item_transaction_reason("sell_item", &item_key),
        idempotency_key,
        Some(item_transaction_metadata_json(&item_key, quantity)),
    )
}

#[reducer]
pub fn charge_tax(
    ctx: &ReducerContext,
    transaction_id: String,
    actor_id: String,
    payer_account_id: String,
    government_account_id: String,
    amount: i128,
    reason: String,
    idempotency_key: String,
) -> Result<(), String> {
    post_account_transfer(
        ctx,
        transaction_id,
        actor_id,
        "economy.charge_tax".to_string(),
        payer_account_id,
        government_account_id,
        amount,
        reason,
        idempotency_key,
        None,
    )
}

#[reducer]
pub fn business_payout(
    ctx: &ReducerContext,
    transaction_id: String,
    actor_id: String,
    business_account_id: String,
    destination_account_id: String,
    amount: i128,
    reason: String,
    idempotency_key: String,
) -> Result<(), String> {
    post_account_transfer(
        ctx,
        transaction_id,
        actor_id,
        "economy.business_payout".to_string(),
        business_account_id,
        destination_account_id,
        amount,
        reason,
        idempotency_key,
        None,
    )
}

#[reducer]
pub fn admin_adjust_balance(
    ctx: &ReducerContext,
    transaction_id: String,
    actor_id: String,
    account_id: String,
    direction: String,
    amount: i128,
    reason: String,
    idempotency_key: String,
) -> Result<(), String> {
    if direction != "debit" && direction != "credit" {
        return Err("direction must be debit or credit".to_string());
    }

    post_single_account_transaction(
        ctx,
        transaction_id,
        actor_id,
        "economy.admin_adjust_balance".to_string(),
        account_id,
        direction,
        amount,
        reason,
        idempotency_key,
    )
}

fn post_account_transfer(
    ctx: &ReducerContext,
    transaction_id: String,
    actor_id: String,
    transaction_type: String,
    from_account_id: String,
    to_account_id: String,
    amount: i128,
    reason: String,
    idempotency_key: String,
    metadata_json: Option<String>,
) -> Result<(), String> {
    validate_account_transfer_identity(&transaction_id, &actor_id, &transaction_type, &from_account_id, &to_account_id, &idempotency_key)?;
    if amount <= 0 {
        return Err("amount must be positive".to_string());
    }
    validate_economy_reason(&reason)?;

    let metadata_json = metadata_json.unwrap_or_else(|| {
        transfer_metadata_json(
            &from_account_id,
            &to_account_id,
            amount,
            &reason,
        )
    });

    let already_processed = if transaction_type == "economy.transfer" {
        ensure_idempotent_transfer(ctx, &idempotency_key, &actor_id, &metadata_json)?
    } else {
        ensure_idempotent_economy_action(
            ctx,
            &idempotency_key,
            &actor_id,
            &transaction_type,
            &metadata_json,
        )?
    };
    if already_processed {
        return Ok(());
    }
    assert_economy_permission(ctx, &actor_id, &transaction_type)?;

    let Some(mut from) = ctx.db.accounts().id().find(from_account_id.clone()) else {
        return Err("unknown source account".to_string());
    };
    let Some(mut to) = ctx.db.accounts().id().find(to_account_id.clone()) else {
        return Err("unknown destination account".to_string());
    };

    if from.status != "active" || to.status != "active" {
        return Err("account is not active".to_string());
    }

    if from.currency != to.currency {
        return Err("currency mismatch".to_string());
    }

    enforce_economy_limits(
        ctx,
        &transaction_type,
        &transaction_type,
        amount,
        &[&from, &to],
    )?;

    if from.balance < amount {
        return Err("insufficient funds".to_string());
    }

    let before_json = account_pair_balance_json(&from_account_id, from.balance, &to_account_id, to.balance);
    from.balance -= amount;
    to.balance += amount;
    let after_json = account_pair_balance_json(&from_account_id, from.balance, &to_account_id, to.balance);
    from.updated_at = ctx.timestamp;
    to.updated_at = ctx.timestamp;
    ctx.db.accounts().id().update(from);
    ctx.db.accounts().id().update(to);

    ctx.db.transactions().insert(Transaction {
        id: transaction_id.clone(),
        transaction_type: transaction_type.clone(),
        actor_id: actor_id.clone(),
        status: "completed".to_string(),
        idempotency_key,
        metadata_json: metadata_json.clone(),
        created_at: ctx.timestamp,
        completed_at: Some(ctx.timestamp),
    });
    ctx.db.ledger_entries().insert(LedgerEntry {
        id: format!("{transaction_id}:debit"),
        transaction_id: transaction_id.clone(),
        account_id: from_account_id.clone(),
        direction: "debit".to_string(),
        amount,
        reason: reason.clone(),
        metadata_json: metadata_json.clone(),
        created_at: ctx.timestamp,
    });
    ctx.db.ledger_entries().insert(LedgerEntry {
        id: format!("{transaction_id}:credit"),
        transaction_id: transaction_id.clone(),
        account_id: to_account_id.clone(),
        direction: "credit".to_string(),
        amount,
        reason,
        metadata_json,
        created_at: ctx.timestamp,
    });
    ctx.db.audit_logs().insert(AuditLog {
        id: format!("{transaction_id}:audit"),
        server_id: "global".to_string(),
        actor_id,
        plugin_id: String::new(),
        action_type: transaction_type.clone(),
        permission_key: economy_permission_key(&transaction_type).to_string(),
        target_type: "account_transfer".to_string(),
        target_id: format!("{from_account_id}->{to_account_id}"),
        before_json,
        after_json,
        status: "succeeded".to_string(),
        created_at: ctx.timestamp,
    });
    Ok(())
}

fn validate_account_transfer_identity(
    transaction_id: &str,
    actor_id: &str,
    transaction_type: &str,
    from_account_id: &str,
    to_account_id: &str,
    idempotency_key: &str,
) -> Result<(), String> {
    if transaction_id.trim().is_empty() {
        return Err("account transfer transaction id is required".to_string());
    }
    if actor_id.trim().is_empty() {
        return Err("account transfer actor id is required".to_string());
    }
    if transaction_type.trim().is_empty() {
        return Err("account transfer type is required".to_string());
    }
    if from_account_id.trim().is_empty() {
        return Err("account transfer source account id is required".to_string());
    }
    if to_account_id.trim().is_empty() {
        return Err("account transfer destination account id is required".to_string());
    }
    if idempotency_key.trim().is_empty() {
        return Err("account transfer idempotency key is required".to_string());
    }
    Ok(())
}

fn post_single_account_transaction(
    ctx: &ReducerContext,
    transaction_id: String,
    actor_id: String,
    transaction_type: String,
    account_id: String,
    direction: String,
    amount: i128,
    reason: String,
    idempotency_key: String,
) -> Result<(), String> {
    validate_single_account_transaction_identity(&transaction_id, &actor_id, &transaction_type, &account_id, &direction, &idempotency_key)?;
    if amount <= 0 {
        return Err("amount must be positive".to_string());
    }
    validate_economy_reason(&reason)?;

    let metadata_json = single_account_metadata_json(&account_id, &direction, amount, &reason);
    if ensure_idempotent_economy_action(
        ctx,
        &idempotency_key,
        &actor_id,
        &transaction_type,
        &metadata_json,
    )? {
        return Ok(());
    }
    assert_economy_permission(ctx, &actor_id, &transaction_type)?;

    let Some(mut account) = ctx.db.accounts().id().find(account_id.clone()) else {
        return Err("unknown account".to_string());
    };
    if account.status != "active" {
        return Err("account is not active".to_string());
    }
    enforce_economy_limits(
        ctx,
        &transaction_type,
        &transaction_type,
        amount,
        &[&account],
    )?;
    if direction == "debit" && account.balance < amount {
        return Err("insufficient funds".to_string());
    }

    let before_json = account_balance_json(&account_id, account.balance);
    if direction == "debit" {
        account.balance -= amount;
    } else {
        account.balance += amount;
    }
    let after_json = account_balance_json(&account_id, account.balance);
    account.updated_at = ctx.timestamp;
    ctx.db.accounts().id().update(account);

    ctx.db.transactions().insert(Transaction {
        id: transaction_id.clone(),
        transaction_type: transaction_type.clone(),
        actor_id: actor_id.clone(),
        status: "completed".to_string(),
        idempotency_key,
        metadata_json: metadata_json.clone(),
        created_at: ctx.timestamp,
        completed_at: Some(ctx.timestamp),
    });
    ctx.db.ledger_entries().insert(LedgerEntry {
        id: format!("{transaction_id}:{direction}"),
        transaction_id: transaction_id.clone(),
        account_id: account_id.clone(),
        direction,
        amount,
        reason,
        metadata_json,
        created_at: ctx.timestamp,
    });
    ctx.db.audit_logs().insert(AuditLog {
        id: format!("{transaction_id}:audit"),
        server_id: "global".to_string(),
        actor_id,
        plugin_id: String::new(),
        action_type: transaction_type.clone(),
        permission_key: economy_permission_key(&transaction_type).to_string(),
        target_type: "account".to_string(),
        target_id: account_id.clone(),
        before_json,
        after_json,
        status: "succeeded".to_string(),
        created_at: ctx.timestamp,
    });
    Ok(())
}

fn validate_single_account_transaction_identity(
    transaction_id: &str,
    actor_id: &str,
    transaction_type: &str,
    account_id: &str,
    direction: &str,
    idempotency_key: &str,
) -> Result<(), String> {
    if transaction_id.trim().is_empty() {
        return Err("single-account transaction id is required".to_string());
    }
    if actor_id.trim().is_empty() {
        return Err("single-account actor id is required".to_string());
    }
    if transaction_type.trim().is_empty() {
        return Err("single-account transaction type is required".to_string());
    }
    if account_id.trim().is_empty() {
        return Err("single-account account id is required".to_string());
    }
    if direction.trim().is_empty() {
        return Err("single-account direction is required".to_string());
    }
    if idempotency_key.trim().is_empty() {
        return Err("single-account idempotency key is required".to_string());
    }
    Ok(())
}

fn enforce_economy_limits(
    ctx: &ReducerContext,
    permission_key: &str,
    action_type: &str,
    amount: i128,
    accounts: &[&Account],
) -> Result<(), String> {
    for limit in ctx.db.economy_limits().iter() {
        if !limit.enabled {
            continue;
        }
        if !(limit.permission_key == permission_key && limit.action_type == action_type) {
            continue;
        }

        if let Some(max_amount) = parse_limit_max_amount(&limit.limit_json) {
            if amount > max_amount {
                return Err(format!("economy limit exceeded: max amount {max_amount}"));
            }
        }

        if let Some(allowed_owner_types) = parse_limit_allowed_owner_types(&limit.limit_json) {
            for account in accounts {
                if !allowed_owner_types.iter().any(|owner_type| owner_type == &account.owner_type) {
                    return Err(format!("economy limit exceeded: account owner type {} is not allowed", account.owner_type));
                }
            }
        }
    }

    Ok(())
}

fn assert_economy_permission(
    ctx: &ReducerContext,
    actor_id: &str,
    transaction_type: &str,
) -> Result<(), String> {
    let permission_key = economy_permission_key(transaction_type);
    let mut principals_to_check = vec![actor_id.to_string()];
    let mut visited_principals: Vec<String> = Vec::new();
    let mut allowed = false;

    while let Some(principal_id) = principals_to_check.pop() {
        if visited_principals.iter().any(|visited| visited == &principal_id) {
            continue;
        }
        visited_principals.push(principal_id.clone());

        for grant in ctx.db.permission_grants().iter() {
            if grant.principal_id != principal_id || grant.permission_key != permission_key {
                continue;
            }
            if grant.expires_at.is_some_and(|expires_at| expires_at <= ctx.timestamp) {
                continue;
            }
            if grant.effect == "deny" {
                return Err("economy permission denied".to_string());
            }
            if grant.effect == "allow" {
                allowed = true;
            }
        }

        for edge in ctx.db.principal_edges().iter() {
            if edge.child_principal_id == principal_id {
                if edge.expires_at.is_some_and(|expires_at| expires_at <= ctx.timestamp) {
                    continue;
                }
                principals_to_check.push(edge.parent_principal_id);
            }
        }
    }

    if allowed {
        return Ok(());
    }

    return Err("economy permission denied".to_string());
}

fn economy_permission_key(transaction_type: &str) -> &str {
    match transaction_type {
        "economy.admin_adjust_balance" => "economy.admin.adjust_balance",
        _ => transaction_type,
    }
}

fn parse_limit_max_amount(limit_json: &str) -> Option<i128> {
    let trimmed = limit_json.trim();
    if !trimmed.starts_with('{') || !trimmed.ends_with('}') {
        return Some(0);
    }

    extract_i128_field(trimmed, "\"max_amount\"")
        .or_else(|| extract_i128_field(trimmed, "\"maxAmount\""))
}

fn parse_limit_allowed_owner_types(limit_json: &str) -> Option<Vec<String>> {
    let trimmed = limit_json.trim();
    if !trimmed.starts_with('{') || !trimmed.ends_with('}') {
        return Some(Vec::new());
    }

    extract_string_array_field(trimmed, "\"allowed_account_owner_types\"")
        .or_else(|| extract_string_array_field(trimmed, "\"allowedAccountOwnerTypes\""))
}

fn extract_i128_field(json: &str, key: &str) -> Option<i128> {
    let key_index = json.find(key)?;
    let after_key = &json[key_index + key.len()..];
    let colon_index = after_key.find(':')?;
    let after_colon = after_key[colon_index + 1..].trim_start();
    let number: String = after_colon
        .chars()
        .take_while(|character| character.is_ascii_digit() || *character == '-')
        .collect();
    number.parse::<i128>().ok()
}

fn extract_string_array_field(json: &str, key: &str) -> Option<Vec<String>> {
    let key_index = json.find(key)?;
    let after_key = &json[key_index + key.len()..];
    let colon_index = after_key.find(':')?;
    let after_colon = after_key[colon_index + 1..].trim_start();
    let array_start = after_colon.find('[')?;
    let after_array_start = &after_colon[array_start + 1..];
    let array_end = after_array_start.find(']')?;
    let array_body = &after_array_start[..array_end];
    Some(
        array_body
            .split(',')
            .map(|value| value.trim().trim_matches('"').to_string())
            .filter(|value| !value.is_empty())
            .collect()
    )
}

fn transaction_exists(ctx: &ReducerContext, idempotency_key: &str) -> bool {
    ctx.db
        .transactions()
        .iter()
        .any(|transaction| transaction.idempotency_key == idempotency_key)
}

fn ensure_idempotent_transfer(
    ctx: &ReducerContext,
    idempotency_key: &str,
    actor_id: &str,
    metadata_json: &str,
) -> Result<bool, String> {
    ensure_idempotent_economy_action(
        ctx,
        idempotency_key,
        actor_id,
        "economy.transfer",
        metadata_json,
    )
}

fn ensure_idempotent_economy_action(
    ctx: &ReducerContext,
    idempotency_key: &str,
    actor_id: &str,
    transaction_type: &str,
    metadata_json: &str,
) -> Result<bool, String> {
    if !transaction_exists(ctx, idempotency_key) {
        return Ok(false);
    }

    for transaction in ctx.db.transactions().iter() {
        if transaction.idempotency_key != idempotency_key {
            continue;
        }

        if transaction.transaction_type == transaction_type
            && transaction.actor_id == actor_id
            && transaction.metadata_json == metadata_json
        {
            return Ok(true);
        }

        return Err("idempotency conflict".to_string());
    }

    Ok(false)
}

fn transfer_metadata_json(
    from_account_id: &str,
    to_account_id: &str,
    amount: i128,
    reason: &str,
) -> String {
    format!(
        "{{\"amount\":{},\"from_account_id\":\"{}\",\"reason\":\"{}\",\"to_account_id\":\"{}\"}}",
        amount,
        json_escape(from_account_id),
        json_escape(reason),
        json_escape(to_account_id)
    )
}

fn single_account_metadata_json(
    account_id: &str,
    direction: &str,
    amount: i128,
    reason: &str,
) -> String {
    format!(
        "{{\"account_id\":\"{}\",\"amount\":{},\"direction\":\"{}\",\"reason\":\"{}\"}}",
        json_escape(account_id),
        amount,
        json_escape(direction),
        json_escape(reason)
    )
}

fn account_pair_balance_json(
    from_account_id: &str,
    from_balance: i128,
    to_account_id: &str,
    to_balance: i128,
) -> String {
    format!(
        "{{\"{}\":{},\"{}\":{}}}",
        json_escape(from_account_id),
        from_balance,
        json_escape(to_account_id),
        to_balance
    )
}

fn account_balance_json(account_id: &str, balance: i128) -> String {
    format!("{{\"{}\":{}}}", json_escape(account_id), balance)
}

fn account_balances_json(balances: &[(String, i128)]) -> String {
    let entries: Vec<String> = balances
        .iter()
        .map(|(account_id, balance)| format!("\"{}\":{}", json_escape(account_id), balance))
        .collect();
    format!("{{{}}}", entries.join(","))
}

fn item_transaction_reason(action: &str, item_key: &str) -> String {
    format!("{action}:{}", json_escape(item_key))
}

fn validate_item_transaction_identity(item_key: &str, field_name: &str) -> Result<(), String> {
    if item_key.trim().is_empty() {
        return Err(format!("{field_name} is required"));
    }
    Ok(())
}

fn item_transaction_metadata_json(item_key: &str, quantity: u64) -> String {
    format!(
        "{{\"item_key\":\"{}\",\"quantity\":{}}}",
        json_escape(item_key),
        quantity
    )
}

#[reducer]
pub fn void_transaction(
    ctx: &ReducerContext,
    transaction_id: String,
    actor_id: String,
    voided_transaction_id: String,
    reason: String,
    idempotency_key: String,
) -> Result<(), String> {
    validate_void_transaction_identity(&transaction_id, &actor_id, &voided_transaction_id, &idempotency_key)?;
    validate_economy_reason(&reason)?;
    let metadata_json = format!(
        "{{\"reason\":\"{}\",\"voided_transaction_id\":\"{}\"}}",
        json_escape(&reason),
        json_escape(&voided_transaction_id)
    );
    if ensure_idempotent_economy_action(
        ctx,
        &idempotency_key,
        &actor_id,
        "economy.void_transaction",
        &metadata_json,
    )? {
        return Ok(());
    }
    assert_economy_permission(ctx, &actor_id, "economy.void_transaction")?;

    if ctx
        .db
        .transactions()
        .iter()
        .any(|transaction| {
            transaction.transaction_type == "economy.void_transaction"
                && transaction.metadata_json.contains(&format!(
                    "\"voided_transaction_id\":\"{}\"",
                    json_escape(&voided_transaction_id)
                ))
        })
    {
        return Err("transaction is already voided".to_string());
    }

    let Some(voided_transaction) = ctx.db.transactions().id().find(voided_transaction_id.clone()) else {
        return Err("unknown transaction".to_string());
    };
    if voided_transaction.status != "completed" {
        return Err("transaction is not completed".to_string());
    }

    let mut reversals: Vec<(String, String, i128, String)> = Vec::new();
    for entry in ctx.db.ledger_entries().iter() {
        if entry.transaction_id == voided_transaction_id {
            reversals.push((
                entry.id,
                entry.account_id,
                entry.amount,
                reverse_ledger_direction(&entry.direction)?,
            ));
        }
    }
    if reversals.is_empty() {
        return Err("transaction has no ledger entries".to_string());
    }

    let mut before_balances: Vec<(String, i128)> = Vec::new();
    for (_entry_id, account_id, amount, direction) in &reversals {
        let Some(account) = ctx.db.accounts().id().find(account_id.clone()) else {
            return Err("unknown account".to_string());
        };
        if account.status != "active" {
            return Err("account is not active".to_string());
        }
        if direction == "debit" && account.balance < *amount {
            return Err("insufficient funds".to_string());
        }
        before_balances.push((account_id.clone(), account.balance));
    }
    let before_json = account_balances_json(&before_balances);

    let mut after_balances: Vec<(String, i128)> = Vec::new();
    for (entry_id, account_id, amount, direction) in reversals {
        let mut account = ctx.db.accounts().id().find(account_id.clone()).unwrap();
        if direction == "debit" {
            account.balance -= amount;
        } else {
            account.balance += amount;
        }
        account.updated_at = ctx.timestamp;
        after_balances.push((account_id.clone(), account.balance));
        ctx.db.accounts().id().update(account);
        ctx.db.ledger_entries().insert(LedgerEntry {
            id: format!("{transaction_id}:void:{entry_id}"),
            transaction_id: transaction_id.clone(),
            account_id,
            direction,
            amount,
            reason: reason.clone(),
            metadata_json: metadata_json.clone(),
            created_at: ctx.timestamp,
        });
    }
    let after_json = account_balances_json(&after_balances);

    ctx.db.transactions().insert(Transaction {
        id: transaction_id.clone(),
        transaction_type: "economy.void_transaction".to_string(),
        actor_id: actor_id.clone(),
        status: "completed".to_string(),
        idempotency_key,
        metadata_json: metadata_json.clone(),
        created_at: ctx.timestamp,
        completed_at: Some(ctx.timestamp),
    });
    ctx.db.audit_logs().insert(AuditLog {
        id: format!("{transaction_id}:audit"),
        server_id: "global".to_string(),
        actor_id,
        plugin_id: String::new(),
        action_type: "economy.void_transaction".to_string(),
        permission_key: "economy.void_transaction".to_string(),
        target_type: "transaction".to_string(),
        target_id: voided_transaction_id,
        before_json,
        after_json,
        status: "succeeded".to_string(),
        created_at: ctx.timestamp,
    });
    Ok(())
}

fn validate_void_transaction_identity(
    transaction_id: &str,
    actor_id: &str,
    voided_transaction_id: &str,
    idempotency_key: &str,
) -> Result<(), String> {
    if transaction_id.trim().is_empty() {
        return Err("void transaction id is required".to_string());
    }
    if actor_id.trim().is_empty() {
        return Err("void transaction actor id is required".to_string());
    }
    if voided_transaction_id.trim().is_empty() {
        return Err("voided transaction id is required".to_string());
    }
    if idempotency_key.trim().is_empty() {
        return Err("void transaction idempotency key is required".to_string());
    }
    Ok(())
}

fn reverse_ledger_direction(direction: &str) -> Result<String, String> {
    match direction {
        "debit" => Ok("credit".to_string()),
        "credit" => Ok("debit".to_string()),
        _ => Err("invalid ledger direction".to_string()),
    }
}

fn json_escape(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

#[reducer]
pub fn issue_invoice(
    ctx: &ReducerContext,
    id: String,
    issuer_account_id: String,
    payer_account_id: String,
    amount: i128,
    currency: String,
    reason: String,
    issued_by: String,
    idempotency_key: String,
    due_at: Option<Timestamp>,
) -> Result<(), String> {
    validate_invoice_issue_identity(&id, &issuer_account_id, &payer_account_id, &currency, &issued_by, &idempotency_key)?;
    validate_economy_reason(&reason)?;
    let metadata_json = invoice_issue_metadata_json(
        &issuer_account_id,
        &payer_account_id,
        amount,
        &currency,
        &reason,
        &issued_by,
        due_at.is_some(),
    );
    if ensure_idempotent_invoice_issue(ctx, &idempotency_key, &metadata_json)? {
        return Ok(());
    }

    if amount <= 0 {
        return Err("amount must be positive".to_string());
    }
    assert_economy_permission(ctx, &issued_by, "economy.issue_invoice")?;
    let Some(issuer) = ctx.db.accounts().id().find(issuer_account_id.clone()) else {
        return Err("unknown issuer account".to_string());
    };
    let Some(payer) = ctx.db.accounts().id().find(payer_account_id.clone()) else {
        return Err("unknown payer account".to_string());
    };
    if issuer.status != "active" || payer.status != "active" {
        return Err("account is not active".to_string());
    }
    if issuer.currency != currency || payer.currency != currency {
        return Err("currency mismatch".to_string());
    }

    let after_json = invoice_issue_audit_json(&id, &metadata_json);
    ctx.db.invoices().insert(Invoice {
        id: id.clone(),
        issuer_account_id,
        payer_account_id,
        amount,
        currency,
        reason,
        status: "issued".to_string(),
        issued_by: issued_by.clone(),
        idempotency_key,
        issued_at: ctx.timestamp,
        due_at,
        paid_at: None,
    });
    ctx.db.audit_logs().insert(AuditLog {
        id: format!("{id}:audit"),
        server_id: "global".to_string(),
        actor_id: issued_by.clone(),
        plugin_id: String::new(),
        action_type: "economy.issue_invoice".to_string(),
        permission_key: "economy.issue_invoice".to_string(),
        target_type: "invoice".to_string(),
        target_id: id,
        before_json: "{}".to_string(),
        after_json,
        status: "succeeded".to_string(),
        created_at: ctx.timestamp,
    });
    Ok(())
}

fn validate_invoice_issue_identity(
    id: &str,
    issuer_account_id: &str,
    payer_account_id: &str,
    currency: &str,
    issued_by: &str,
    idempotency_key: &str,
) -> Result<(), String> {
    if id.trim().is_empty() {
        return Err("invoice id is required".to_string());
    }
    if issuer_account_id.trim().is_empty() {
        return Err("invoice issuer account id is required".to_string());
    }
    if payer_account_id.trim().is_empty() {
        return Err("invoice payer account id is required".to_string());
    }
    if currency.trim().is_empty() {
        return Err("invoice currency is required".to_string());
    }
    if issued_by.trim().is_empty() {
        return Err("invoice issuer actor is required".to_string());
    }
    if idempotency_key.trim().is_empty() {
        return Err("invoice idempotency key is required".to_string());
    }
    Ok(())
}

fn validate_economy_reason(reason: &str) -> Result<(), String> {
    if reason.trim().is_empty() {
        return Err("reason must be a non-empty string".to_string());
    }

    Ok(())
}

fn ensure_idempotent_invoice_issue(
    ctx: &ReducerContext,
    idempotency_key: &str,
    metadata_json: &str,
) -> Result<bool, String> {
    for invoice in ctx.db.invoices().iter() {
        if invoice.idempotency_key != idempotency_key {
            continue;
        }

        if invoice_issue_metadata_json(
            &invoice.issuer_account_id,
            &invoice.payer_account_id,
            invoice.amount,
            &invoice.currency,
            &invoice.reason,
            &invoice.issued_by,
            invoice.due_at.is_some(),
        ) == metadata_json
        {
            return Ok(true);
        }

        return Err("invoice idempotency conflict".to_string());
    }

    Ok(false)
}

fn invoice_issue_metadata_json(
    issuer_account_id: &str,
    payer_account_id: &str,
    amount: i128,
    currency: &str,
    reason: &str,
    issued_by: &str,
    has_due_at: bool,
) -> String {
    format!(
        "{{\"amount\":{},\"currency\":\"{}\",\"due_at\":{},\"issued_by\":\"{}\",\"issuer_account_id\":\"{}\",\"payer_account_id\":\"{}\",\"reason\":\"{}\"}}",
        amount,
        json_escape(currency),
        if has_due_at { "true" } else { "false" },
        json_escape(issued_by),
        json_escape(issuer_account_id),
        json_escape(payer_account_id),
        json_escape(reason)
    )
}

fn invoice_issue_audit_json(id: &str, metadata_json: &str) -> String {
    format!(
        "{{\"invoice_id\":\"{}\",\"invoice\":{}}}",
        json_escape(id),
        metadata_json
    )
}

#[reducer]
pub fn pay_invoice(
    ctx: &ReducerContext,
    transaction_id: String,
    actor_id: String,
    invoice_id: String,
    idempotency_key: String,
) -> Result<(), String> {
    validate_invoice_payment_identity(&transaction_id, &actor_id, &invoice_id, &idempotency_key)?;

    let Some(mut invoice) = ctx.db.invoices().id().find(invoice_id) else {
        return Err("unknown invoice".to_string());
    };

    let metadata_json = invoice_payment_metadata_json(&invoice);
    if ensure_idempotent_economy_action(
        ctx,
        &idempotency_key,
        &actor_id,
        "economy.pay_invoice",
        &metadata_json,
    )? {
        return Ok(());
    }
    assert_economy_permission(ctx, &actor_id, "economy.pay_invoice")?;

    if invoice.status != "issued" {
        return Err("invoice is not payable".to_string());
    }
    if invoice.amount <= 0 {
        return Err("amount must be positive".to_string());
    }

    let Some(mut payer) = ctx.db.accounts().id().find(invoice.payer_account_id.clone()) else {
        return Err("unknown payer account".to_string());
    };
    let Some(mut issuer) = ctx.db.accounts().id().find(invoice.issuer_account_id.clone()) else {
        return Err("unknown issuer account".to_string());
    };

    if payer.status != "active" || issuer.status != "active" {
        return Err("account is not active".to_string());
    }
    if payer.currency != invoice.currency || issuer.currency != invoice.currency {
        return Err("currency mismatch".to_string());
    }

    enforce_economy_limits(
        ctx,
        "economy.pay_invoice",
        "economy.pay_invoice",
        invoice.amount,
        &[&payer, &issuer],
    )?;

    if payer.balance < invoice.amount {
        return Err("insufficient funds".to_string());
    }

    let before_json = account_pair_balance_json(&invoice.payer_account_id, payer.balance, &invoice.issuer_account_id, issuer.balance);
    payer.balance -= invoice.amount;
    issuer.balance += invoice.amount;
    let after_json = account_pair_balance_json(&invoice.payer_account_id, payer.balance, &invoice.issuer_account_id, issuer.balance);
    payer.updated_at = ctx.timestamp;
    issuer.updated_at = ctx.timestamp;
    ctx.db.accounts().id().update(payer);
    ctx.db.accounts().id().update(issuer);

    ctx.db.transactions().insert(Transaction {
        id: transaction_id.clone(),
        transaction_type: "economy.pay_invoice".to_string(),
        actor_id: actor_id.clone(),
        status: "completed".to_string(),
        idempotency_key,
        metadata_json: metadata_json.clone(),
        created_at: ctx.timestamp,
        completed_at: Some(ctx.timestamp),
    });
    ctx.db.ledger_entries().insert(LedgerEntry {
        id: format!("{transaction_id}:invoice_debit"),
        transaction_id: transaction_id.clone(),
        account_id: invoice.payer_account_id.clone(),
        direction: "debit".to_string(),
        amount: invoice.amount,
        reason: invoice.reason.clone(),
        metadata_json: metadata_json.clone(),
        created_at: ctx.timestamp,
    });
    ctx.db.ledger_entries().insert(LedgerEntry {
        id: format!("{transaction_id}:invoice_credit"),
        transaction_id: transaction_id.clone(),
        account_id: invoice.issuer_account_id.clone(),
        direction: "credit".to_string(),
        amount: invoice.amount,
        reason: invoice.reason.clone(),
        metadata_json: metadata_json.clone(),
        created_at: ctx.timestamp,
    });
    ctx.db.audit_logs().insert(AuditLog {
        id: format!("{transaction_id}:audit"),
        server_id: "global".to_string(),
        actor_id,
        plugin_id: String::new(),
        action_type: "economy.pay_invoice".to_string(),
        permission_key: "economy.pay_invoice".to_string(),
        target_type: "invoice".to_string(),
        target_id: invoice.id.clone(),
        before_json,
        after_json,
        status: "succeeded".to_string(),
        created_at: ctx.timestamp,
    });

    invoice.status = "paid".to_string();
    invoice.paid_at = Some(ctx.timestamp);
    ctx.db.invoices().id().update(invoice);
    Ok(())
}

fn validate_invoice_payment_identity(
    transaction_id: &str,
    actor_id: &str,
    invoice_id: &str,
    idempotency_key: &str,
) -> Result<(), String> {
    if transaction_id.trim().is_empty() {
        return Err("invoice payment transaction id is required".to_string());
    }
    if actor_id.trim().is_empty() {
        return Err("invoice payment actor id is required".to_string());
    }
    if invoice_id.trim().is_empty() {
        return Err("paid invoice id is required".to_string());
    }
    if idempotency_key.trim().is_empty() {
        return Err("invoice payment idempotency key is required".to_string());
    }
    Ok(())
}

fn invoice_payment_metadata_json(invoice: &Invoice) -> String {
    format!(
        "{{\"amount\":{},\"due_at\":{},\"invoice_id\":\"{}\",\"issuer_account_id\":\"{}\",\"payer_account_id\":\"{}\",\"reason\":\"{}\"}}",
        invoice.amount,
        invoice_due_metadata_json(invoice),
        json_escape(&invoice.id),
        json_escape(&invoice.issuer_account_id),
        json_escape(&invoice.payer_account_id),
        json_escape(&invoice.reason)
    )
}

fn invoice_due_metadata_json(invoice: &Invoice) -> &'static str {
    if invoice.due_at.is_some() {
        "true"
    } else {
        "false"
    }
}

#[reducer]
pub fn register_item(
    ctx: &ReducerContext,
    key: String,
    plugin_id: String,
    label: String,
    stackable: bool,
    max_stack: u64,
) -> Result<(), String> {
    validate_item_registration_identity(&key, &plugin_id, &label)?;
    if !plugin_exists(ctx, &plugin_id) {
        return Err("plugin must exist before item writes".to_string());
    }
    if !plugin_is_active(ctx, &plugin_id) {
        return Err("plugin must be active before item writes".to_string());
    }
    ctx.db.items().insert(Item {
        key,
        plugin_id,
        label,
        stackable,
        max_stack,
    });
    Ok(())
}

fn validate_item_registration_identity(key: &str, plugin_id: &str, label: &str) -> Result<(), String> {
    if key.trim().is_empty() {
        return Err("item key is required".to_string());
    }
    if plugin_id.trim().is_empty() {
        return Err("item plugin id is required".to_string());
    }
    if label.trim().is_empty() {
        return Err("item label is required".to_string());
    }
    Ok(())
}

#[reducer]
pub fn register_job(
    ctx: &ReducerContext,
    key: String,
    plugin_id: String,
    label: String,
    grades_json: String,
) -> Result<(), String> {
    validate_job_registration_identity(&key, &plugin_id, &label, &grades_json)?;
    if !plugin_exists(ctx, &plugin_id) {
        return Err("plugin must exist before job writes".to_string());
    }
    if !plugin_is_active(ctx, &plugin_id) {
        return Err("plugin must be active before job writes".to_string());
    }
    ctx.db.jobs().insert(Job {
        key,
        plugin_id,
        label,
        grades_json,
    });
    Ok(())
}

fn validate_job_registration_identity(key: &str, plugin_id: &str, label: &str, grades_json: &str) -> Result<(), String> {
    if key.trim().is_empty() {
        return Err("job key is required".to_string());
    }
    if plugin_id.trim().is_empty() {
        return Err("job plugin id is required".to_string());
    }
    if label.trim().is_empty() {
        return Err("job label is required".to_string());
    }
    if grades_json.trim().is_empty() {
        return Err("job grades json is required".to_string());
    }
    Ok(())
}

#[reducer]
pub fn register_vehicle(
    ctx: &ReducerContext,
    model: String,
    plugin_id: String,
    label: String,
    category: String,
) -> Result<(), String> {
    validate_vehicle_registration_identity(&model, &plugin_id, &label, &category)?;
    if !plugin_exists(ctx, &plugin_id) {
        return Err("plugin must exist before vehicle writes".to_string());
    }
    if !plugin_is_active(ctx, &plugin_id) {
        return Err("plugin must be active before vehicle writes".to_string());
    }
    ctx.db.vehicles().insert(Vehicle {
        model,
        plugin_id,
        label,
        category,
    });
    Ok(())
}

fn validate_vehicle_registration_identity(model: &str, plugin_id: &str, label: &str, category: &str) -> Result<(), String> {
    if model.trim().is_empty() {
        return Err("vehicle model is required".to_string());
    }
    if plugin_id.trim().is_empty() {
        return Err("vehicle plugin id is required".to_string());
    }
    if label.trim().is_empty() {
        return Err("vehicle label is required".to_string());
    }
    if category.trim().is_empty() {
        return Err("vehicle category is required".to_string());
    }
    Ok(())
}

#[reducer]
pub fn register_location(
    ctx: &ReducerContext,
    key: String,
    plugin_id: String,
    label: String,
    x: f64,
    y: f64,
    z: f64,
) -> Result<(), String> {
    validate_location_registration_identity(&key, &plugin_id, &label)?;
    if !plugin_exists(ctx, &plugin_id) {
        return Err("plugin must exist before location writes".to_string());
    }
    if !plugin_is_active(ctx, &plugin_id) {
        return Err("plugin must be active before location writes".to_string());
    }
    ctx.db.locations().insert(Location {
        key,
        plugin_id,
        label,
        x,
        y,
        z,
    });
    Ok(())
}

fn validate_location_registration_identity(key: &str, plugin_id: &str, label: &str) -> Result<(), String> {
    if key.trim().is_empty() {
        return Err("location key is required".to_string());
    }
    if plugin_id.trim().is_empty() {
        return Err("location plugin id is required".to_string());
    }
    if label.trim().is_empty() {
        return Err("location label is required".to_string());
    }
    Ok(())
}

#[reducer]
pub fn upsert_character(
    ctx: &ReducerContext,
    id: String,
    player_principal_id: String,
    citizen_id: String,
    cid: u64,
    slot: u64,
    license: String,
    name: String,
    charinfo_json: String,
    metadata_json: String,
    gang_json: String,
    position_json: String,
    phone_number: String,
    account_number: String,
    selected: bool,
) -> Result<(), String> {
    validate_character_identity(&id, &player_principal_id, &citizen_id, cid, slot)?;

    if selected {
        for mut character in ctx.db.characters().iter() {
            if character.player_principal_id == player_principal_id && character.id != id && character.selected {
                character.selected = false;
                character.updated_at = ctx.timestamp;
                ctx.db.characters().id().update(character);
            }
        }
    }

    let character = Character {
        id: id.clone(),
        player_principal_id,
        citizen_id,
        cid,
        slot,
        license,
        name,
        charinfo_json,
        metadata_json,
        gang_json,
        position_json,
        phone_number,
        account_number,
        selected,
        updated_at: ctx.timestamp,
    };

    if ctx.db.characters().id().find(id).is_some() {
        ctx.db.characters().id().update(character);
    } else {
        ctx.db.characters().insert(character);
    }
    Ok(())
}

fn validate_character_identity(
    id: &str,
    player_principal_id: &str,
    citizen_id: &str,
    cid: u64,
    slot: u64,
) -> Result<(), String> {
    if id.trim().is_empty() {
        return Err("character id is required".to_string());
    }
    if player_principal_id.trim().is_empty() {
        return Err("character player principal id is required".to_string());
    }
    if citizen_id.trim().is_empty() {
        return Err("character citizen id is required".to_string());
    }
    if cid == 0 {
        return Err("character cid must be positive".to_string());
    }
    if slot == 0 {
        return Err("character slot must be positive".to_string());
    }
    Ok(())
}

#[reducer]
pub fn grant_item(
    ctx: &ReducerContext,
    _id: String,
    owner_id: String,
    item_key: String,
    quantity: u64,
) -> Result<(), String> {
    validate_inventory_grant_identity(&owner_id, &item_key)?;
    if quantity == 0 {
        return Err("quantity must be positive".to_string());
    }

    let Some(item) = ctx.db.items().key().find(item_key.clone()) else {
        return Err("unknown item".to_string());
    };
    let stack_id = inventory_stack_id(&owner_id, &item_key);

    if let Some(mut existing) = ctx.db.inventory_stacks().id().find(stack_id.clone()) {
        let next_quantity = existing.quantity + quantity;
        if item.max_stack > 0 && next_quantity > item.max_stack {
            return Err("item stack limit exceeded".to_string());
        }

        existing.quantity += quantity;
        existing.updated_at = ctx.timestamp;
        ctx.db.inventory_stacks().id().update(existing);
        return Ok(());
    }

    if item.max_stack > 0 && quantity > item.max_stack {
        return Err("item stack limit exceeded".to_string());
    }

    ctx.db.inventory_stacks().insert(InventoryStack {
        id: stack_id,
        owner_id,
        item_key,
        quantity,
        updated_at: ctx.timestamp,
    });
    Ok(())
}

#[reducer]
pub fn remove_item(
    ctx: &ReducerContext,
    _id: String,
    owner_id: String,
    item_key: String,
    quantity: u64,
) -> Result<(), String> {
    validate_inventory_grant_identity(&owner_id, &item_key)?;
    if quantity == 0 {
        return Err("quantity must be positive".to_string());
    }

    let stack_id = inventory_stack_id(&owner_id, &item_key);
    let Some(mut existing) = ctx.db.inventory_stacks().id().find(stack_id.clone()) else {
        return Err("inventory stack not found".to_string());
    };
    if existing.quantity < quantity {
        return Err("insufficient item quantity".to_string());
    }

    if existing.quantity == quantity {
        ctx.db.inventory_stacks().id().delete(stack_id);
        return Ok(());
    }

    existing.quantity -= quantity;
    existing.updated_at = ctx.timestamp;
    ctx.db.inventory_stacks().id().update(existing);
    Ok(())
}

fn validate_inventory_grant_identity(owner_id: &str, item_key: &str) -> Result<(), String> {
    if owner_id.trim().is_empty() {
        return Err("inventory grant owner id is required".to_string());
    }
    if item_key.trim().is_empty() {
        return Err("inventory grant item key is required".to_string());
    }
    Ok(())
}

#[reducer]
pub fn assign_job(
    ctx: &ReducerContext,
    character_id: String,
    job_key: String,
    grade: String,
    on_duty: bool,
) -> Result<(), String> {
    validate_job_assignment_identity(&character_id, &job_key, &grade)?;
    let Some(job) = ctx.db.jobs().key().find(job_key.clone()) else {
        return Err("unknown job".to_string());
    };
    if !grade_exists(&job.grades_json, &grade) {
        return Err("unknown job grade".to_string());
    }

    if let Some(mut existing) = ctx.db.character_jobs().character_id().find(character_id.clone()) {
        existing.job_key = job_key;
        existing.grade = grade;
        existing.on_duty = on_duty;
        existing.updated_at = ctx.timestamp;
        ctx.db.character_jobs().character_id().update(existing);
        return Ok(());
    }

    ctx.db.character_jobs().insert(CharacterJob {
        character_id,
        job_key,
        grade,
        on_duty,
        updated_at: ctx.timestamp,
    });
    Ok(())
}

fn validate_job_assignment_identity(character_id: &str, job_key: &str, grade: &str) -> Result<(), String> {
    if character_id.trim().is_empty() {
        return Err("job assignment character id is required".to_string());
    }
    if job_key.trim().is_empty() {
        return Err("job assignment job key is required".to_string());
    }
    if grade.trim().is_empty() {
        return Err("job assignment grade is required".to_string());
    }
    Ok(())
}

fn inventory_stack_id(owner_id: &str, item_key: &str) -> String {
    format!("{owner_id}:{item_key}")
}

fn grade_exists(grades_json: &str, grade: &str) -> bool {
    grades_json
        .split(|character| character == ',' || character == '[' || character == ']')
        .map(|candidate| candidate.trim().trim_matches('"'))
        .any(|candidate| candidate == grade)
}

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
