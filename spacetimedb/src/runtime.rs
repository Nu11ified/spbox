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
