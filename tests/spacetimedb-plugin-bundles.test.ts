import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("SpacetimeDB plugin bundle registry", () => {
  it("declares bundle and capability tables", () => {
    const lib = readFileSync("spacetimedb/src/lib.rs", "utf8");

    expect(lib).toContain("#[table(name = plugin_bundles, public)]");
    expect(lib).toContain("pub struct PluginBundle");
    expect(lib).toContain("#[table(name = plugin_capabilities, public)]");
    expect(lib).toContain("pub struct PluginCapability");
  });

  it("exposes reducers for bundle metadata and capability declarations", () => {
    const lib = readFileSync("spacetimedb/src/lib.rs", "utf8");

    expect(lib).toContain("pub fn register_plugin_bundle");
    expect(lib).toContain("pub fn revoke_plugin_bundle");
    expect(lib).toContain("pub fn upsert_plugin_capability");
    expect(lib).toContain("validate_bundle_status");
    expect(lib).toContain("validate_runtime_type");
    expect(lib).toContain("validate_capability_status");
  });

  it("guards capability reducer writes against plugin/bundle ownership mismatches", () => {
    const lib = readFileSync("spacetimedb/src/lib.rs", "utf8");

    expect(lib).toContain("plugin capability bundle mismatch");
    expect(lib).toContain("if bundle.plugin_id != plugin_id");
  });

  it("rejects duplicate capability ids instead of replacing signed capability metadata", () => {
    const lib = readFileSync("spacetimedb/src/lib.rs", "utf8");
    const upsertCapabilityBody = lib.slice(
      lib.indexOf("pub fn upsert_plugin_capability"),
      lib.indexOf("fn plugin_capability_key_exists")
    );

    expect(lib).toContain("plugin capability already exists");
    expect(lib).toContain("ctx.db.plugin_capabilities().id().find(id.clone()).is_some()");
    expect(lib.indexOf("plugin capability already exists")).toBeLessThan(
      lib.indexOf("let capability = PluginCapability")
    );
    expect(upsertCapabilityBody).not.toContain("ctx.db.plugin_capabilities().id().update(capability)");
  });

  it("rejects blank capability ids before inserting signed capability metadata", () => {
    const lib = readFileSync("spacetimedb/src/lib.rs", "utf8");
    const upsertCapabilityBody = lib.slice(
      lib.indexOf("pub fn upsert_plugin_capability"),
      lib.indexOf("fn plugin_capability_key_exists")
    );

    expect(upsertCapabilityBody).toContain("validate_plugin_capability_id(&id)?");
    expect(lib).toContain("fn validate_plugin_capability_id");
    expect(lib).toContain('return Err("plugin capability id is required".to_string())');
    expect(upsertCapabilityBody.indexOf("validate_plugin_capability_id(&id)?")).toBeLessThan(
      upsertCapabilityBody.indexOf("let capability = PluginCapability")
    );
  });

  it("rejects blank capability plugin and bundle ids before ownership lookup", () => {
    const lib = readFileSync("spacetimedb/src/lib.rs", "utf8");
    const upsertCapabilityBody = lib.slice(
      lib.indexOf("pub fn upsert_plugin_capability"),
      lib.indexOf("fn plugin_capability_key_exists")
    );

    expect(upsertCapabilityBody).toContain("validate_plugin_capability_owner_ids(&plugin_id, &bundle_id)?");
    expect(lib).toContain("fn validate_plugin_capability_owner_ids");
    expect(lib).toContain('return Err("plugin capability plugin id is required".to_string())');
    expect(lib).toContain('return Err("plugin capability bundle id is required".to_string())');
    expect(upsertCapabilityBody.indexOf("validate_plugin_capability_owner_ids(&plugin_id, &bundle_id)?")).toBeLessThan(
      upsertCapabilityBody.indexOf("ctx.db.plugin_bundles().id().find(bundle_id.clone())")
    );
  });

  it("rejects duplicate capability keys within the same bundle", () => {
    const lib = readFileSync("spacetimedb/src/lib.rs", "utf8");

    expect(lib).toContain("plugin capability key already exists for bundle");
    expect(lib).toContain("fn plugin_capability_key_exists");
    expect(lib).toContain("capability.bundle_id == bundle_id && capability.capability_key == capability_key");
    expect(lib.indexOf("plugin capability key already exists for bundle")).toBeLessThan(
      lib.indexOf("let capability = PluginCapability")
    );
  });

  it("rejects blank and forbidden direct database sandbox capability keys", () => {
    const lib = readFileSync("spacetimedb/src/lib.rs", "utf8");
    const upsertCapabilityBody = lib.slice(
      lib.indexOf("pub fn upsert_plugin_capability"),
      lib.indexOf("fn plugin_capability_key_exists")
    );

    expect(upsertCapabilityBody).toContain("validate_plugin_capability_key(&capability_key)?");
    expect(lib).toContain('return Err("plugin capability key is required".to_string())');
    expect(lib).toContain('return Err("plugin capability key is forbidden".to_string())');
    expect(lib).toContain('capability_key == "sandbox.database"');
    expect(lib).toContain('capability_key.starts_with("sandbox.database.")');
    expect(lib).toContain('capability_key == "sandbox.db"');
    expect(lib).toContain('capability_key.starts_with("sandbox.db.")');
    expect(lib).toContain('capability_key == "sandbox.spacetimedb"');
    expect(lib).toContain('capability_key.starts_with("sandbox.spacetimedb.")');
    expect(upsertCapabilityBody.indexOf("validate_plugin_capability_key(&capability_key)?")).toBeLessThan(
      upsertCapabilityBody.indexOf("let capability = PluginCapability")
    );
  });

  it("rejects non-empty capability constraints unless they are JSON objects", () => {
    const lib = readFileSync("spacetimedb/src/lib.rs", "utf8");
    const upsertCapabilityBody = lib.slice(
      lib.indexOf("pub fn upsert_plugin_capability"),
      lib.indexOf("fn plugin_capability_key_exists")
    );

    expect(upsertCapabilityBody).toContain("validate_plugin_capability_constraints_json(&constraints_json)?");
    expect(lib).toContain("fn validate_plugin_capability_constraints_json");
    expect(lib).toContain('return Err("plugin capability constraints must be a JSON object".to_string())');
    expect(lib).toContain("let compact = compact_json(constraints_json);");
    expect(lib).toContain("if compact.is_empty()");
    expect(lib).toContain("!compact.starts_with('{') || !compact.ends_with('}')");
    expect(upsertCapabilityBody.indexOf("validate_plugin_capability_constraints_json(&constraints_json)?")).toBeLessThan(
      upsertCapabilityBody.indexOf("let capability = PluginCapability")
    );
  });

  it("rejects malformed known capability constraint fields inside JSON objects", () => {
    const lib = readFileSync("spacetimedb/src/lib.rs", "utf8");
    const constraintsValidatorBody = lib.slice(
      lib.indexOf("fn validate_plugin_capability_constraints_json"),
      lib.indexOf("fn validate_plugin_capability_payload_limit_constraints")
    );

    expect(lib).toContain("fn validate_plugin_capability_payload_limit_constraints");
    expect(lib).toContain("fn validate_plugin_capability_actor_principal_constraints");
    expect(lib).toContain('"payloadLimits"');
    expect(lib).toContain('"payload_limits"');
    expect(lib).toContain('"allowedActorPrincipals"');
    expect(lib).toContain('"allowed_actor_principals"');
    expect(lib).toContain('return Err("plugin capability payload limits must be a JSON object".to_string())');
    expect(lib).toContain('return Err("plugin capability payload limits must be positive numbers".to_string())');
    expect(lib).toContain(
      'return Err("plugin capability allowed actor principals must be a non-empty string array".to_string())'
    );
    expect(constraintsValidatorBody).toContain("validate_plugin_capability_payload_limit_constraints(&compact)?");
    expect(constraintsValidatorBody).toContain("validate_plugin_capability_actor_principal_constraints(&compact)?");
  });

  it("rejects malformed economy capability constraint fields inside JSON objects", () => {
    const lib = readFileSync("spacetimedb/src/lib.rs", "utf8");
    const constraintsValidatorBody = lib.slice(
      lib.indexOf("fn validate_plugin_capability_constraints_json"),
      lib.indexOf("fn validate_plugin_capability_payload_limit_constraints")
    );

    expect(lib).toContain("fn validate_plugin_capability_economy_constraints");
    expect(lib).toContain('"maxAmount"');
    expect(lib).toContain('"max_amount"');
    expect(lib).toContain('"allowedAccountOwnerTypes"');
    expect(lib).toContain('"allowed_account_owner_types"');
    expect(lib).toContain('"requiresOnDuty"');
    expect(lib).toContain('"requires_on_duty"');
    expect(lib).toContain('return Err("plugin capability maxAmount must be a positive number".to_string())');
    expect(lib).toContain(
      'return Err("plugin capability allowedAccountOwnerTypes must be a non-empty array of account owner types".to_string())'
    );
    expect(lib).toContain('return Err("plugin capability requiresOnDuty must be a boolean".to_string())');
    expect(constraintsValidatorBody).toContain("validate_plugin_capability_economy_constraints(&compact)?");
  });

  it("rejects enabled capabilities for inactive plugins or non-registered bundles", () => {
    const lib = readFileSync("spacetimedb/src/lib.rs", "utf8");

    expect(lib).toContain('return Err("plugin must be active before enabled capability writes".to_string())');
    expect(lib).toContain('return Err("plugin bundle must be registered before enabled capability writes".to_string())');
    expect(lib).toContain('if status == "enabled" && !plugin_is_active(ctx, &plugin_id)');
    expect(lib).toContain('if status == "enabled" && bundle.status != "registered"');
    expect(lib.indexOf("plugin must be active before enabled capability writes")).toBeLessThan(
      lib.indexOf("let capability = PluginCapability")
    );
    expect(lib.indexOf("plugin bundle must be registered before enabled capability writes")).toBeLessThan(
      lib.indexOf("let capability = PluginCapability")
    );
  });

  it("guards bundle reducer writes against unknown plugins", () => {
    const lib = readFileSync("spacetimedb/src/lib.rs", "utf8");

    expect(lib).toContain("plugin must exist before bundle writes");
    expect(lib.indexOf("plugin must exist before bundle writes")).toBeLessThan(
      lib.indexOf("let bundle = PluginBundle")
    );
  });

  it("rejects bundle registration from revoked package signers inside the reducer", () => {
    const lib = readFileSync("spacetimedb/src/lib.rs", "utf8");
    const registerBundleBody = lib.slice(
      lib.indexOf("pub fn register_plugin_bundle"),
      lib.indexOf("#[reducer]\npub fn revoke_plugin_bundle")
    );

    expect(registerBundleBody).toContain('return Err("package signer has been revoked".to_string())');
    expect(registerBundleBody).toContain("if package_signer_revoked(ctx, &signer_id)");
    expect(registerBundleBody.indexOf("package signer has been revoked")).toBeLessThan(
      registerBundleBody.indexOf("let bundle = PluginBundle")
    );
  });

  it("requires bundle registration to create registered bundles with signed metadata", () => {
    const lib = readFileSync("spacetimedb/src/lib.rs", "utf8");
    const registerBundleBody = lib.slice(
      lib.indexOf("pub fn register_plugin_bundle"),
      lib.indexOf("#[reducer]\npub fn revoke_plugin_bundle")
    );

    expect(registerBundleBody).toContain('return Err("plugin bundle registration status must be registered".to_string())');
    expect(registerBundleBody).toContain('return Err("plugin bundle version is required".to_string())');
    expect(registerBundleBody).toContain('return Err("plugin bundle artifact url is required".to_string())');
    expect(registerBundleBody).toContain('return Err("plugin bundle hash is required".to_string())');
    expect(registerBundleBody).toContain('return Err("plugin bundle signature is required".to_string())');
    expect(registerBundleBody).toContain('return Err("plugin bundle signer is required".to_string())');
    expect(registerBundleBody).toContain('return Err("plugin bundle id is required".to_string())');
    expect(registerBundleBody).toContain('return Err("plugin bundle plugin id is required".to_string())');
    expect(registerBundleBody).toContain('if status != "registered"');
    expect(registerBundleBody).toContain("if id.trim().is_empty()");
    expect(registerBundleBody).toContain("if plugin_id.trim().is_empty()");
    expect(registerBundleBody).toContain("if version.trim().is_empty()");
    expect(registerBundleBody).toContain("if artifact_url.trim().is_empty()");
    expect(registerBundleBody).toContain("if bundle_hash.trim().is_empty()");
    expect(registerBundleBody).toContain("if signature.trim().is_empty()");
    expect(registerBundleBody).toContain("if signer_id.trim().is_empty()");
    expect(registerBundleBody.indexOf("plugin bundle registration status must be registered")).toBeLessThan(
      registerBundleBody.indexOf("let bundle = PluginBundle")
    );
  });

  it("rejects bundle hashes without an explicit sha256 algorithm prefix before registration", () => {
    const lib = readFileSync("spacetimedb/src/lib.rs", "utf8");
    const registerBundleBody = lib.slice(
      lib.indexOf("pub fn register_plugin_bundle"),
      lib.indexOf("#[reducer]\npub fn revoke_plugin_bundle")
    );

    expect(registerBundleBody).toContain("validate_plugin_bundle_hash(&bundle_hash)?");
    expect(lib).toContain("fn validate_plugin_bundle_hash");
    expect(lib).toContain('return Err("plugin bundle hash must use sha256:<digest>".to_string())');
    expect(registerBundleBody.indexOf("validate_plugin_bundle_hash(&bundle_hash)?")).toBeLessThan(
      registerBundleBody.indexOf("plugin_exists(ctx, &plugin_id)")
    );
    expect(registerBundleBody.indexOf("validate_plugin_bundle_hash(&bundle_hash)?")).toBeLessThan(
      registerBundleBody.indexOf("let bundle = PluginBundle")
    );
  });

  it("disables plugin capabilities when plugins become inactive", () => {
    const lib = readFileSync("spacetimedb/src/lib.rs", "utf8");

    expect(lib).toContain("set_plugin_capabilities_enabled(ctx, &plugin_id, false);");
    expect(lib).toContain("capability.status = if enabled { \"enabled\" } else { \"disabled\" }.to_string();");
    expect(lib.indexOf("set_plugin_capabilities_enabled(ctx, &plugin_id, false);")).toBeLessThan(
      lib.indexOf("set_plugin_menu_surfaces_enabled(ctx, &plugin_id, false);")
    );
  });

  it("rejects duplicate bundle ids instead of replacing signed bundle metadata", () => {
    const lib = readFileSync("spacetimedb/src/lib.rs", "utf8");
    const registerBundleBody = lib.slice(
      lib.indexOf("pub fn register_plugin_bundle"),
      lib.indexOf("#[reducer]\npub fn revoke_plugin_bundle")
    );

    expect(lib).toContain("plugin bundle already exists");
    expect(lib).toContain("ctx.db.plugin_bundles().id().find(id.clone()).is_some()");
    expect(lib.indexOf("plugin bundle already exists")).toBeLessThan(
      lib.indexOf("let bundle = PluginBundle")
    );
    expect(registerBundleBody).not.toContain("ctx.db.plugin_bundles().id().update(bundle)");
  });

  it("exposes a dedicated reducer for revoking existing bundles", () => {
    const lib = readFileSync("spacetimedb/src/lib.rs", "utf8");

    expect(lib).toContain("pub fn revoke_plugin_bundle");
    expect(lib).toContain("actor_id: String");
    expect(lib).toContain("reason: String");
    expect(lib).toContain("plugin bundle does not exist");
    expect(lib).toContain("bundle.status = \"revoked\".to_string()");
    expect(lib).toContain("ctx.db.plugin_bundles().id().update(bundle)");
  });

  it("rejects blank bundle revocation actors and reasons before mutating bundles", () => {
    const lib = readFileSync("spacetimedb/src/lib.rs", "utf8");
    const revokeBundleBody = lib.slice(
      lib.indexOf("pub fn revoke_plugin_bundle"),
      lib.indexOf("#[reducer]\npub fn upsert_plugin_capability")
    );

    expect(revokeBundleBody).toContain("validate_plugin_bundle_revocation_input(&bundle_id, &actor_id, &reason)?");
    expect(lib).toContain("fn validate_plugin_bundle_revocation_input");
    expect(lib).toContain('return Err("plugin bundle revocation bundle id is required".to_string())');
    expect(lib).toContain('return Err("plugin bundle revocation actor is required".to_string())');
    expect(lib).toContain('return Err("plugin bundle revocation reason is required".to_string())');
    expect(revokeBundleBody.indexOf("validate_plugin_bundle_revocation_input")).toBeLessThan(
      revokeBundleBody.indexOf("ctx.db.plugin_bundles().id().find")
    );
    expect(revokeBundleBody.indexOf("validate_plugin_bundle_revocation_input")).toBeLessThan(
      revokeBundleBody.indexOf("bundle.status = \"revoked\".to_string()")
    );
  });

  it("bundle revocation disables bundle capabilities and kills live deployments", () => {
    const lib = readFileSync("spacetimedb/src/lib.rs", "utf8");
    const revokeBundleBody = lib.slice(
      lib.indexOf("pub fn revoke_plugin_bundle"),
      lib.indexOf("#[reducer]\npub fn upsert_plugin_capability")
    );

    expect(revokeBundleBody).toContain("disable_capabilities_for_bundle(ctx, &bundle_id);");
    expect(revokeBundleBody).toContain("kill_live_deployments_for_bundle(ctx, &bundle_id, &reason);");
    expect(revokeBundleBody.indexOf("bundle.status = \"revoked\".to_string()")).toBeLessThan(
      revokeBundleBody.indexOf("disable_capabilities_for_bundle(ctx, &bundle_id);")
    );
    expect(lib).toContain("fn disable_capabilities_for_bundle");
    expect(lib).toContain("if capability.bundle_id == bundle_id");
    expect(lib).toContain('capability.status = "disabled".to_string();');
    expect(lib).toContain("fn kill_live_deployments_for_bundle");
    expect(lib).toContain('if deployment.bundle_id == bundle_id && (deployment.status == "active" || deployment.status == "pending")');
    expect(lib).toContain('deployment.status = "killed".to_string();');
    expect(lib).toContain('deployment.error_message = format!("bundle revoked: {}", reason);');
  });

  it("guards deployment reducer writes against unknown or mismatched control-plane rows", () => {
    const lib = readFileSync("spacetimedb/src/lib.rs", "utf8");

    expect(lib).toContain("plugin must exist before deployment writes");
    expect(lib).toContain("plugin bundle must exist before deployment writes");
    expect(lib).toContain("plugin deployment bundle mismatch");
    expect(lib).toContain("server must exist before deployment writes");
    expect(lib.indexOf("plugin must exist before deployment writes")).toBeLessThan(
      lib.indexOf("let deployed_at = if status == \"active\"")
    );
    expect(lib.indexOf("server must exist before deployment writes")).toBeLessThan(
      lib.indexOf("ctx.db.plugin_deployments().insert")
    );
  });

  it("rejects blank deployment identity fields before control-plane lookups", () => {
    const lib = readFileSync("spacetimedb/src/lib.rs", "utf8");
    const upsertDeploymentBody = lib.slice(
      lib.indexOf("pub fn upsert_plugin_deployment"),
      lib.indexOf("fn validate_plugin_status")
    );

    expect(upsertDeploymentBody).toContain("validate_plugin_deployment_identity_fields(&id, &plugin_id, &bundle_id, &server_id)?");
    expect(lib).toContain("fn validate_plugin_deployment_identity_fields");
    expect(lib).toContain('return Err("plugin deployment id is required".to_string())');
    expect(lib).toContain('return Err("plugin deployment plugin id is required".to_string())');
    expect(lib).toContain('return Err("plugin deployment bundle id is required".to_string())');
    expect(lib).toContain('return Err("plugin deployment server id is required".to_string())');
    expect(upsertDeploymentBody.indexOf("validate_plugin_deployment_identity_fields(&id, &plugin_id, &bundle_id, &server_id)?")).toBeLessThan(
      upsertDeploymentBody.indexOf("plugin_exists(ctx, &plugin_id)")
    );
  });

  it("rejects active deployments for inactive plugins or non-registered bundles", () => {
    const lib = readFileSync("spacetimedb/src/lib.rs", "utf8");

    expect(lib).toContain('return Err("plugin must be active before active deployment writes".to_string())');
    expect(lib).toContain('return Err("plugin bundle must be registered before active deployment writes".to_string())');
    expect(lib).toContain('return Err("plugin bundle must be registered before pending deployment writes".to_string())');
    expect(lib).toContain('if status == "active" && !plugin_is_active(ctx, &plugin_id)');
    expect(lib).toContain('if status == "active" && bundle.status != "registered"');
    expect(lib).toContain('if status == "pending" && bundle.status != "registered"');
    expect(lib.indexOf("plugin must be active before active deployment writes")).toBeLessThan(
      lib.indexOf("let deployed_at = if status == \"active\"")
    );
    expect(lib.indexOf("plugin bundle must be registered before active deployment writes")).toBeLessThan(
      lib.indexOf("let deployed_at = if status == \"active\"")
    );
    expect(lib.indexOf("plugin bundle must be registered before pending deployment writes")).toBeLessThan(
      lib.indexOf("let deployed_at = if status == \"active\"")
    );
  });

  it("rolls back existing active deployments for the same plugin and server before activating a new one", () => {
    const lib = readFileSync("spacetimedb/src/lib.rs", "utf8");
    const upsertDeploymentBody = lib.slice(
      lib.indexOf("pub fn upsert_plugin_deployment"),
      lib.indexOf("fn validate_plugin_status")
    );

    expect(lib).toContain("fn supersede_active_plugin_deployments");
    expect(upsertDeploymentBody).toContain('if status == "active"');
    expect(upsertDeploymentBody).toContain("supersede_active_plugin_deployments(ctx, &plugin_id, &server_id, &id);");
    expect(lib).toContain("deployment.plugin_id == plugin_id");
    expect(lib).toContain("deployment.server_id == server_id");
    expect(lib).toContain("deployment.id != except_deployment_id");
    expect(lib).toContain('deployment.status == "active"');
    expect(lib).toContain('deployment.status = "rolled_back".to_string();');
    expect(upsertDeploymentBody.indexOf("supersede_active_plugin_deployments")).toBeLessThan(
      upsertDeploymentBody.indexOf("ctx.db.plugin_deployments().insert")
    );
  });

  it("rejects deployment upserts that try to move an existing deployment id", () => {
    const lib = readFileSync("spacetimedb/src/lib.rs", "utf8");
    const upsertDeploymentBody = lib.slice(
      lib.indexOf("pub fn upsert_plugin_deployment"),
      lib.indexOf("fn validate_plugin_status")
    );

    expect(upsertDeploymentBody).toContain('return Err("plugin deployment identity mismatch".to_string())');
    expect(upsertDeploymentBody).toContain("deployment.plugin_id != plugin_id");
    expect(upsertDeploymentBody).toContain("deployment.bundle_id != bundle_id");
    expect(upsertDeploymentBody).toContain("deployment.server_id != server_id");
    expect(upsertDeploymentBody.indexOf("plugin deployment identity mismatch")).toBeLessThan(
      upsertDeploymentBody.indexOf("deployment.status = status")
    );
  });

  it("rejects active and pending deployment writes with versions that do not match the bundle", () => {
    const lib = readFileSync("spacetimedb/src/lib.rs", "utf8");
    const upsertDeploymentBody = lib.slice(
      lib.indexOf("pub fn upsert_plugin_deployment"),
      lib.indexOf("fn validate_plugin_status")
    );

    expect(upsertDeploymentBody).toContain('return Err("plugin deployment desired version must match bundle version".to_string())');
    expect(upsertDeploymentBody).toContain('return Err("active plugin deployment version must match bundle version".to_string())');
    expect(upsertDeploymentBody).toContain('return Err("pending plugin deployment must not have an active version".to_string())');
    expect(upsertDeploymentBody).toContain('if (status == "active" || status == "pending") && desired_version != bundle.version');
    expect(upsertDeploymentBody).toContain('if status == "active" && active_version != bundle.version');
    expect(upsertDeploymentBody).toContain('if status == "pending" && !active_version.is_empty()');
    expect(upsertDeploymentBody.indexOf("plugin deployment desired version must match bundle version")).toBeLessThan(
      upsertDeploymentBody.indexOf("let deployed_at = if status == \"active\"")
    );
  });

  it("rejects deployment writes with error metadata inconsistent with lifecycle status", () => {
    const lib = readFileSync("spacetimedb/src/lib.rs", "utf8");
    const upsertDeploymentBody = lib.slice(
      lib.indexOf("pub fn upsert_plugin_deployment"),
      lib.indexOf("fn validate_plugin_status")
    );

    expect(upsertDeploymentBody).toContain('return Err("active, pending, and rolled back deployments must not have an error message".to_string())');
    expect(upsertDeploymentBody).toContain('return Err("failed and killed deployments require an error message".to_string())');
    expect(upsertDeploymentBody).toContain('(status == "active" || status == "pending" || status == "rolled_back") && !error_message.is_empty()');
    expect(upsertDeploymentBody).toContain('(status == "failed" || status == "killed") && error_message.trim().is_empty()');
    expect(upsertDeploymentBody.indexOf("active, pending, and rolled back deployments must not have an error message")).toBeLessThan(
      upsertDeploymentBody.indexOf("let deployed_at = if status == \"active\"")
    );
  });
});
