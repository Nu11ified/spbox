import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("SpacetimeDB Rust module scaffold", () => {
  it("declares the module dependency and library target", () => {
    const cargo = readFileSync("spacetimedb/Cargo.toml", "utf8");

    expect(cargo).toContain('name = "sdb_runtime_module"');
    expect(cargo).toContain('crate-type = ["cdylib"]');
    expect(cargo).toContain('spacetimedb = "1"');
  });

  it("declares phase 01 runtime tables and reducers", () => {
    const lib = readFileSync("spacetimedb/src/lib.rs", "utf8");

    for (const table of [
      "servers",
      "runtime_instances",
      "heartbeat_nonces",
      "runtime_actions",
      "audit_logs",
      "runtime_config",
      "runtime_config_acks",
      "principals",
      "principal_edges",
      "permission_grants",
      "plugins",
      "plugin_deployments"
    ]) {
      expect(lib).toContain(`#[table(name = ${table}`);
    }

    for (const reducer of [
      "register_server",
      "heartbeat",
      "submit_action",
      "complete_action",
      "set_runtime_config",
      "ack_config_version",
      "upsert_principal",
      "add_principal_edge",
      "remove_principal_edge",
      "write_audit_log"
    ]) {
      expect(lib).toContain(`pub fn ${reducer}`);
    }
  });

  it("rejects blank server registration identity before authoritative server insert", () => {
    const lib = readFileSync("spacetimedb/src/lib.rs", "utf8");
    const registerServerBody = lib.slice(
      lib.indexOf("pub fn register_server"),
      lib.indexOf("#[reducer]\npub fn heartbeat")
    );

    expect(registerServerBody).toContain("validate_server_registration_identity(&id, &name, &environment, &public_key)?");
    expect(lib).toContain("fn validate_server_registration_identity");
    expect(lib).toContain('return Err("server id is required".to_string())');
    expect(lib).toContain('return Err("server name is required".to_string())');
    expect(lib).toContain('return Err("server environment is required".to_string())');
    expect(lib).toContain('return Err("server public key is required".to_string())');
    expect(registerServerBody.indexOf("validate_server_registration_identity")).toBeLessThan(
      registerServerBody.indexOf("ctx.db.servers().insert")
    );
    expect(registerServerBody).toContain("ctx.db.servers().id().update(server)");
  });

  it("guards runtime action submission against replay and missing signatures", () => {
    const lib = readFileSync("spacetimedb/src/lib.rs", "utf8");

    expect(lib).toContain("ensure_runtime_action_replay_safe");
    expect(lib).toContain('return Err("action signature is required".to_string())');
    expect(lib).toContain('return Err("nonce replay".to_string())');
    expect(lib).toContain('return Err("action idempotency conflict".to_string())');
  });

  it("scopes runtime action replay checks to the server", () => {
    const lib = readFileSync("spacetimedb/src/lib.rs", "utf8");
    const submitActionBody = lib.slice(
      lib.indexOf("pub fn submit_action"),
      lib.indexOf("#[reducer]\npub fn complete_action")
    );
    const replayHelperBody = lib.slice(
      lib.indexOf("fn ensure_runtime_action_replay_safe"),
      lib.indexOf("#[reducer]\npub fn complete_action")
    );

    expect(submitActionBody).toContain("&server_id,");
    expect(replayHelperBody).toContain("server_id: &str");
    expect(replayHelperBody).toContain("action.server_id == server_id");
    expect(replayHelperBody).toContain("action.server_id == server_id && action.nonce == nonce");
    expect(replayHelperBody.indexOf("action.server_id == server_id")).toBeLessThan(
      replayHelperBody.indexOf("action.idempotency_key == idempotency_key")
    );
  });

  it("guards runtime action submission against unknown servers", () => {
    const lib = readFileSync("spacetimedb/src/lib.rs", "utf8");

    expect(lib).toContain("server must exist before action writes");
    expect(lib.indexOf("server must exist before action writes")).toBeLessThan(
      lib.indexOf("ctx.db.runtime_actions().insert")
    );
  });

  it("rejects blank runtime action envelope fields before replay checks or insert", () => {
    const lib = readFileSync("spacetimedb/src/lib.rs", "utf8");
    const submitActionBody = lib.slice(
      lib.indexOf("pub fn submit_action"),
      lib.indexOf("fn ensure_runtime_action_replay_safe")
    );

    expect(submitActionBody).toContain(
      "validate_runtime_action_envelope(&id, &server_id, &actor_id, &action_type, &payload_hash, &signature, &nonce, &idempotency_key)?"
    );
    expect(lib).toContain("fn validate_runtime_action_envelope");
    expect(lib).toContain('return Err("runtime action id is required".to_string())');
    expect(lib).toContain('return Err("runtime action server id is required".to_string())');
    expect(lib).toContain('return Err("runtime action actor id is required".to_string())');
    expect(lib).toContain('return Err("runtime action type is required".to_string())');
    expect(lib).toContain('return Err("runtime action payload hash is required".to_string())');
    expect(lib).toContain('return Err("runtime action signature is required".to_string())');
    expect(lib).toContain('return Err("runtime action nonce is required".to_string())');
    expect(lib).toContain('return Err("runtime action idempotency key is required".to_string())');
    expect(submitActionBody.indexOf("validate_runtime_action_envelope")).toBeLessThan(
      submitActionBody.indexOf("server_exists(ctx, &server_id)")
    );
    expect(submitActionBody.indexOf("validate_runtime_action_envelope")).toBeLessThan(
      submitActionBody.indexOf("ensure_runtime_action_replay_safe")
    );
  });

  it("treats runtime action completion as terminal", () => {
    const lib = readFileSync("spacetimedb/src/lib.rs", "utf8");
    const completeActionBody = lib.slice(
      lib.indexOf("pub fn complete_action"),
      lib.indexOf("#[reducer]\npub fn set_runtime_config")
    );

    expect(completeActionBody).toContain('return Err("action is already completed".to_string())');
    expect(completeActionBody).toContain("if action.completed_at.is_some()");
    expect(completeActionBody.indexOf("action is already completed")).toBeLessThan(
      completeActionBody.indexOf("action.status = status")
    );
  });

  it("rejects blank runtime action completion ids before action lookup", () => {
    const lib = readFileSync("spacetimedb/src/lib.rs", "utf8");
    const completeActionBody = lib.slice(
      lib.indexOf("pub fn complete_action"),
      lib.indexOf("#[reducer]\npub fn set_runtime_config")
    );

    expect(completeActionBody).toContain("validate_runtime_action_completion_identity(&action_id)?");
    expect(lib).toContain("fn validate_runtime_action_completion_identity");
    expect(lib).toContain('return Err("runtime action completion id is required".to_string())');
    expect(completeActionBody.indexOf("validate_runtime_action_completion_identity")).toBeLessThan(
      completeActionBody.indexOf("ctx.db.runtime_actions().id().find")
    );
  });

  it("rejects blank runtime config identity fields before server lookup or insert", () => {
    const lib = readFileSync("spacetimedb/src/lib.rs", "utf8");
    const setConfigBody = lib.slice(
      lib.indexOf("pub fn set_runtime_config"),
      lib.indexOf("#[reducer]\npub fn ack_config_version")
    );

    expect(setConfigBody).toContain("validate_runtime_config_identity(&id, &server_id, &namespace, &key, &value_json)?");
    expect(lib).toContain("fn validate_runtime_config_identity");
    expect(lib).toContain('return Err("runtime config id is required".to_string())');
    expect(lib).toContain('return Err("runtime config server id is required".to_string())');
    expect(lib).toContain('return Err("runtime config namespace is required".to_string())');
    expect(lib).toContain('return Err("runtime config key is required".to_string())');
    expect(lib).toContain('return Err("runtime config value json is required".to_string())');
    expect(setConfigBody.indexOf("validate_runtime_config_identity")).toBeLessThan(
      setConfigBody.indexOf("server_exists(ctx, &server_id)")
    );
    expect(setConfigBody.indexOf("validate_runtime_config_identity")).toBeLessThan(
      setConfigBody.indexOf("ctx.db.runtime_config().insert")
    );
  });

  it("guards audit log writes against unknown servers", () => {
    const lib = readFileSync("spacetimedb/src/lib.rs", "utf8");

    expect(lib).toContain("server must exist before audit writes");
    expect(lib.indexOf("server must exist before audit writes")).toBeLessThan(
      lib.indexOf("ctx.db.audit_logs().insert")
    );
  });

  it("guards audit log writes against invalid status values", () => {
    const lib = readFileSync("spacetimedb/src/lib.rs", "utf8");
    const writeAuditLogBody = lib.slice(
      lib.indexOf("pub fn write_audit_log"),
      lib.indexOf("#[reducer]\npub fn register_plugin")
    );

    expect(lib).toContain("fn validate_audit_status(status: &str) -> Result<(), String>");
    expect(lib).toContain('Err(format!("invalid audit status: {}", status))');
    expect(writeAuditLogBody).toContain("validate_audit_status(&status)?");
    expect(writeAuditLogBody.indexOf("validate_audit_status(&status)?")).toBeLessThan(
      writeAuditLogBody.indexOf("ctx.db.audit_logs().insert")
    );
  });

  it("rejects blank audit identity fields before server lookup or insert", () => {
    const lib = readFileSync("spacetimedb/src/lib.rs", "utf8");
    const writeAuditLogBody = lib.slice(
      lib.indexOf("pub fn write_audit_log"),
      lib.indexOf("fn validate_audit_status")
    );

    expect(writeAuditLogBody).toContain(
      "validate_audit_log_identity(&id, &server_id, &actor_id, &action_type, &target_type, &target_id, &before_json, &after_json)?"
    );
    expect(lib).toContain("fn validate_audit_log_identity");
    expect(lib).toContain('return Err("audit log id is required".to_string())');
    expect(lib).toContain('return Err("audit log server id is required".to_string())');
    expect(lib).toContain('return Err("audit log actor id is required".to_string())');
    expect(lib).toContain('return Err("audit log action type is required".to_string())');
    expect(lib).toContain('return Err("audit log target type is required".to_string())');
    expect(lib).toContain('return Err("audit log target id is required".to_string())');
    expect(lib).toContain('return Err("audit log before json is required".to_string())');
    expect(lib).toContain('return Err("audit log after json is required".to_string())');
    expect(writeAuditLogBody.indexOf("validate_audit_log_identity")).toBeLessThan(
      writeAuditLogBody.indexOf("server_exists(ctx, &server_id)")
    );
    expect(writeAuditLogBody.indexOf("validate_audit_log_identity")).toBeLessThan(
      writeAuditLogBody.indexOf("ctx.db.audit_logs().insert")
    );
  });

  it("guards runtime heartbeats against missing signatures and nonce replay", () => {
    const lib = readFileSync("spacetimedb/src/lib.rs", "utf8");

    expect(lib).toContain("ensure_heartbeat_replay_safe");
    expect(lib).toContain('return Err("heartbeat signature is required".to_string())');
    expect(lib).toContain('return Err("heartbeat nonce replay".to_string())');
  });

  it("rejects blank heartbeat identity fields before replay checks or runtime instance insert", () => {
    const lib = readFileSync("spacetimedb/src/lib.rs", "utf8");
    const heartbeatBody = lib.slice(
      lib.indexOf("pub fn heartbeat"),
      lib.indexOf("fn ensure_heartbeat_replay_safe")
    );

    expect(heartbeatBody).toContain(
      "validate_heartbeat_identity(&id, &server_id, &resource_version, &fxserver_build, &game_build, &nonce, &signature)?"
    );
    expect(lib).toContain("fn validate_heartbeat_identity");
    expect(lib).toContain('return Err("heartbeat runtime instance id is required".to_string())');
    expect(lib).toContain('return Err("heartbeat server id is required".to_string())');
    expect(lib).toContain('return Err("heartbeat resource version is required".to_string())');
    expect(lib).toContain('return Err("heartbeat fxserver build is required".to_string())');
    expect(lib).toContain('return Err("heartbeat game build is required".to_string())');
    expect(lib).toContain('return Err("heartbeat nonce is required".to_string())');
    expect(heartbeatBody.indexOf("validate_heartbeat_identity")).toBeLessThan(
      heartbeatBody.indexOf("ensure_heartbeat_replay_safe")
    );
    expect(heartbeatBody.indexOf("validate_heartbeat_identity")).toBeLessThan(
      heartbeatBody.indexOf("ctx.db.runtime_instances().insert")
    );
  });

  it("updates the server health row when recording a heartbeat", () => {
    const lib = readFileSync("spacetimedb/src/lib.rs", "utf8");

    expect(lib).toContain("record_server_heartbeat(ctx, &server_id)?");
    expect(lib).toContain("server.last_heartbeat_at = ctx.timestamp");
    expect(lib).toContain("server.status = \"online\".to_string()");
    expect(lib).toContain("ctx.db.servers().id().update(server)");
  });
});
