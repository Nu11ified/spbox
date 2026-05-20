
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
