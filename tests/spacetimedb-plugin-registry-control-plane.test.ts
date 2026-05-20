import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("SpacetimeDB plugin registry control-plane tables", () => {
  it("declares package, manifest, runtime instance, and config value tables", () => {
    const lib = readFileSync("spacetimedb/src/lib.rs", "utf8");

    for (const table of [
      "plugin_packages",
      "plugin_package_signer_revocations",
      "plugin_manifests",
      "plugin_runtime_instances",
      "plugin_config_values"
    ]) {
      expect(lib).toContain(`#[table(name = ${table}, public)]`);
    }
  });

  it("exposes reducers for packages, manifests, runtime instances, config values, and uninstall", () => {
    const lib = readFileSync("spacetimedb/src/lib.rs", "utf8");

    for (const reducer of [
      "register_plugin_package",
      "revoke_package_signer",
      "register_plugin_manifest",
      "upsert_plugin_runtime_instance",
      "set_plugin_config_value",
      "uninstall_plugin"
    ]) {
      expect(lib).toContain(`pub fn ${reducer}`);
    }
    expect(lib).toContain("validate_plugin_runtime_status");
  });

  it("guards package, runtime instance, and config reducers against unknown plugins", () => {
    const lib = readFileSync("spacetimedb/src/lib.rs", "utf8");

    expect(lib).toContain("plugin must exist before package writes");
    expect(lib).toContain("plugin must exist before manifest writes");
    expect(lib).toContain("plugin must exist before runtime instance writes");
    expect(lib).toContain("plugin must exist before config writes");
    expect(lib).toContain("fn plugin_exists");
  });

  it("rejects blank plugin registration metadata before inserting plugin rows", () => {
    const lib = readFileSync("spacetimedb/src/lib.rs", "utf8");
    const registerPluginBody = lib.slice(
      lib.indexOf("pub fn register_plugin"),
      lib.indexOf("#[reducer]\npub fn register_plugin_package")
    );

    expect(registerPluginBody).toContain(
      "validate_plugin_registration_metadata(&id, &name, &version, &trust_level, &signature, &bundle_hash, &created_by)?"
    );
    expect(lib).toContain("fn validate_plugin_registration_metadata");
    expect(lib).toContain('return Err("plugin id is required".to_string())');
    expect(lib).toContain('return Err("plugin name is required".to_string())');
    expect(lib).toContain('return Err("plugin version is required".to_string())');
    expect(lib).toContain('return Err("plugin trust level is required".to_string())');
    expect(lib).toContain('return Err("plugin signature is required".to_string())');
    expect(lib).toContain('return Err("plugin bundle hash is required".to_string())');
    expect(lib).toContain('return Err("plugin creator is required".to_string())');
    expect(registerPluginBody.indexOf("validate_plugin_registration_metadata")).toBeLessThan(
      registerPluginBody.indexOf("ctx.db.plugins().insert")
    );
    expect(registerPluginBody).toContain("ctx.db.plugins().id().update(Plugin");
  });

  it("rejects blank package registration metadata before plugin lookup or package writes", () => {
    const lib = readFileSync("spacetimedb/src/lib.rs", "utf8");
    const registerPackageBody = lib.slice(
      lib.indexOf("pub fn register_plugin_package"),
      lib.indexOf("fn package_signer_revoked")
    );

    expect(registerPackageBody).toContain(
      "validate_plugin_package_registration_metadata(&package_id, &plugin_id, &version, &source, &publisher, &signer_id, &signature, &manifest_hash)?"
    );
    expect(lib).toContain("fn validate_plugin_package_registration_metadata");
    expect(lib).toContain('return Err("plugin package id is required".to_string())');
    expect(lib).toContain('return Err("plugin package plugin id is required".to_string())');
    expect(lib).toContain('return Err("plugin package version is required".to_string())');
    expect(lib).toContain('return Err("plugin package source is required".to_string())');
    expect(lib).toContain('return Err("plugin package publisher is required".to_string())');
    expect(lib).toContain('return Err("plugin package signer is required".to_string())');
    expect(lib).toContain('return Err("plugin package signature is required".to_string())');
    expect(lib).toContain('return Err("plugin package manifest hash is required".to_string())');
    expect(registerPackageBody.indexOf("validate_plugin_package_registration_metadata")).toBeLessThan(
      registerPackageBody.indexOf("plugin_exists(ctx, &plugin_id)")
    );
    expect(registerPackageBody.indexOf("validate_plugin_package_registration_metadata")).toBeLessThan(
      registerPackageBody.indexOf("let package = PluginPackage")
    );
  });

  it("rejects manifest reducer writes for unknown plugins", () => {
    const lib = readFileSync("spacetimedb/src/lib.rs", "utf8");
    const registerManifestBody = lib.slice(
      lib.indexOf("pub fn register_plugin_manifest"),
      lib.indexOf("#[reducer]\npub fn upsert_plugin_runtime_instance")
    );

    expect(registerManifestBody).toContain('return Err("plugin must exist before manifest writes".to_string())');
    expect(registerManifestBody).toContain("if !plugin_exists(ctx, &plugin_id)");
    expect(registerManifestBody.indexOf("plugin must exist before manifest writes")).toBeLessThan(
      registerManifestBody.indexOf("let manifest = PluginManifest")
    );
  });

  it("rejects blank manifest plugin ids before manifest validation or writes", () => {
    const lib = readFileSync("spacetimedb/src/lib.rs", "utf8");
    const registerManifestBody = lib.slice(
      lib.indexOf("pub fn register_plugin_manifest"),
      lib.indexOf("#[reducer]\npub fn upsert_plugin_runtime_instance")
    );

    expect(registerManifestBody).toContain("validate_plugin_manifest_identity(&plugin_id)?");
    expect(lib).toContain("fn validate_plugin_manifest_identity");
    expect(lib).toContain('return Err("plugin manifest plugin id is required".to_string())');
    expect(registerManifestBody.indexOf("validate_plugin_manifest_identity(&plugin_id)?")).toBeLessThan(
      registerManifestBody.indexOf("validate_plugin_manifest_json(&manifest_json)?")
    );
    expect(registerManifestBody.indexOf("validate_plugin_manifest_identity(&plugin_id)?")).toBeLessThan(
      registerManifestBody.indexOf("plugin_exists(ctx, &plugin_id)")
    );
  });

  it("validates manifest json before reducer writes", () => {
    const lib = readFileSync("spacetimedb/src/lib.rs", "utf8");
    const registerManifestBody = lib.slice(
      lib.indexOf("pub fn register_plugin_manifest"),
      lib.indexOf("#[reducer]\npub fn upsert_plugin_runtime_instance")
    );

    expect(registerManifestBody).toContain("validate_plugin_manifest_json(&manifest_json)?");
    expect(lib).toContain("fn validate_plugin_manifest_json");
    expect(lib).toContain('return Err("plugin manifest json must be an object".to_string())');
    expect(lib).toContain("validate_optional_manifest_permission_reference");
    expect(lib).toContain('"Menu manifest entries reference undeclared permission"');
    expect(lib).toContain('"Command manifest entries reference undeclared permission"');
    expect(lib).toContain('"Panel manifest entries reference undeclared permission"');
    expect(lib).toContain('return Err("FiveM server command manifest entries require permission".to_string())');
    expect(lib).toContain('return Err("FiveM server command manifest entries require non-empty action".to_string())');
    expect(lib).toContain('return Err("FiveM server command manifest entries reference undeclared permission".to_string())');
    expect(lib).toContain('return Err("FiveM export manifest entries require non-empty action".to_string())');
    expect(lib).toContain('return Err("FiveM export manifest entries reference undeclared permission".to_string())');
    expect(registerManifestBody.indexOf("validate_plugin_manifest_json(&manifest_json)?")).toBeLessThan(
      registerManifestBody.indexOf("let manifest = PluginManifest")
    );
  });

  it("rejects config reducer writes unless the plugin is active", () => {
    const lib = readFileSync("spacetimedb/src/lib.rs", "utf8");

    expect(lib).toContain('return Err("plugin must be active before config writes".to_string())');
    expect(lib.indexOf('return Err("plugin must be active before config writes".to_string())')).toBeLessThan(
      lib.indexOf("let id = plugin_config_value_id")
    );
    expect(lib).toContain("if !plugin_is_active(ctx, &plugin_id)");
  });

  it("rejects blank config identity fields and unknown servers before config writes", () => {
    const lib = readFileSync("spacetimedb/src/lib.rs", "utf8");
    const setConfigBody = lib.slice(
      lib.indexOf("pub fn set_plugin_config_value"),
      lib.indexOf("fn validate_plugin_runtime_status")
    );

    expect(setConfigBody).toContain("validate_plugin_config_value_identity(&plugin_id, &server_id, &key)?");
    expect(lib).toContain("fn validate_plugin_config_value_identity");
    expect(lib).toContain('return Err("plugin config plugin id is required".to_string())');
    expect(lib).toContain('return Err("plugin config server id is required".to_string())');
    expect(lib).toContain('return Err("plugin config key is required".to_string())');
    expect(setConfigBody).toContain('return Err("server must exist before config writes".to_string())');
    expect(setConfigBody).toContain("if !server_exists(ctx, &server_id)");
    expect(setConfigBody.indexOf("validate_plugin_config_value_identity(&plugin_id, &server_id, &key)?")).toBeLessThan(
      setConfigBody.indexOf("plugin_exists(ctx, &plugin_id)")
    );
    expect(setConfigBody.indexOf("server must exist before config writes")).toBeLessThan(
      setConfigBody.indexOf("let id = plugin_config_value_id")
    );
  });

  it("guards loaded runtime instances against inactive plugins and unknown servers", () => {
    const lib = readFileSync("spacetimedb/src/lib.rs", "utf8");

    expect(lib).toContain('return Err("server must exist before runtime instance writes".to_string())');
    expect(lib).toContain('return Err("plugin must be active before loading runtime instances".to_string())');
    expect(lib.indexOf('return Err("server must exist before runtime instance writes".to_string())')).toBeLessThan(
      lib.indexOf("let id = plugin_runtime_instance_id")
    );
    expect(lib.indexOf('return Err("plugin must be active before loading runtime instances".to_string())')).toBeLessThan(
      lib.indexOf("let id = plugin_runtime_instance_id")
    );
    expect(lib).toContain('if status == "loaded" && !plugin_is_active(ctx, &plugin_id)');
  });

  it("rejects blank runtime instance identity fields and lifecycle/error mismatches before writes", () => {
    const lib = readFileSync("spacetimedb/src/lib.rs", "utf8");
    const runtimeInstanceBody = lib.slice(
      lib.indexOf("pub fn upsert_plugin_runtime_instance"),
      lib.indexOf("#[reducer]\npub fn set_plugin_config_value")
    );

    expect(runtimeInstanceBody).toContain("validate_plugin_runtime_instance_identity(&plugin_id, &server_id)?");
    expect(runtimeInstanceBody).toContain("validate_plugin_runtime_instance_error(&status, &error_message)?");
    expect(lib).toContain("fn validate_plugin_runtime_instance_identity");
    expect(lib).toContain("fn validate_plugin_runtime_instance_error");
    expect(lib).toContain('return Err("plugin runtime instance plugin id is required".to_string())');
    expect(lib).toContain('return Err("plugin runtime instance server id is required".to_string())');
    expect(lib).toContain('return Err("loaded, unloaded, and disabled runtime instances cannot carry error messages".to_string())');
    expect(lib).toContain('return Err("failed runtime instances require an error message".to_string())');
    expect(runtimeInstanceBody.indexOf("validate_plugin_runtime_instance_identity(&plugin_id, &server_id)?")).toBeLessThan(
      runtimeInstanceBody.indexOf("plugin_exists(ctx, &plugin_id)")
    );
    expect(runtimeInstanceBody.indexOf("validate_plugin_runtime_instance_error(&status, &error_message)?")).toBeLessThan(
      runtimeInstanceBody.indexOf("let id = plugin_runtime_instance_id")
    );
  });

  it("rejects package writes from revoked package signers inside the reducer", () => {
    const lib = readFileSync("spacetimedb/src/lib.rs", "utf8");

    expect(lib).toContain("fn package_signer_revoked");
    expect(lib).toContain('return Err("package signer has been revoked".to_string())');
    expect(lib.indexOf("package signer has been revoked")).toBeLessThan(
      lib.indexOf("ctx.db.plugin_packages().insert(package)")
    );
  });

  it("disables package-backed plugins inside the package signer revocation reducer", () => {
    const lib = readFileSync("spacetimedb/src/lib.rs", "utf8");

    expect(lib).toContain("fn disable_plugins_for_package_signer");
    expect(lib).toContain("let mut disabled_plugin_ids = disable_plugins_for_package_signer(ctx, &signer_id)?");
    expect(lib).toContain("affected_plugin_ids_json: string_list_json(&disabled_plugin_ids)");
    expect(lib).toContain("plugin.status = \"disabled\".to_string()");
    expect(lib.indexOf("let mut disabled_plugin_ids = disable_plugins_for_package_signer(ctx, &signer_id)?")).toBeLessThan(
      lib.indexOf("ctx.db.plugin_package_signer_revocations().insert")
    );
  });

  it("rejects blank package signer revocation inputs before cascading signer trust changes", () => {
    const lib = readFileSync("spacetimedb/src/lib.rs", "utf8");
    const revokeSignerBody = lib.slice(
      lib.indexOf("pub fn revoke_package_signer"),
      lib.indexOf("fn disable_plugins_for_package_signer")
    );

    expect(revokeSignerBody).toContain("validate_package_signer_revocation_input(&signer_id, &actor_id, &reason)?");
    expect(lib).toContain("fn validate_package_signer_revocation_input");
    expect(lib).toContain('return Err("package signer id is required".to_string())');
    expect(lib).toContain('return Err("package signer revocation actor is required".to_string())');
    expect(lib).toContain('return Err("package signer revocation reason is required".to_string())');
    expect(revokeSignerBody.indexOf("validate_package_signer_revocation_input")).toBeLessThan(
      revokeSignerBody.indexOf("disable_plugins_for_package_signer")
    );
    expect(revokeSignerBody.indexOf("validate_package_signer_revocation_input")).toBeLessThan(
      revokeSignerBody.indexOf("revoke_bundles_for_package_signer")
    );
    expect(revokeSignerBody.indexOf("validate_package_signer_revocation_input")).toBeLessThan(
      revokeSignerBody.indexOf("let revocation = PluginPackageSignerRevocation")
    );
  });

  it("rejects direct active status writes when package or bundle signers are revoked", () => {
    const lib = readFileSync("spacetimedb/src/lib.rs", "utf8");
    const setStatusBody = lib.slice(
      lib.indexOf("pub fn set_plugin_status"),
      lib.indexOf("#[reducer]\npub fn uninstall_plugin")
    );

    expect(setStatusBody).toContain('if status == "active" && plugin_has_revoked_signer(ctx, &plugin_id)');
    expect(setStatusBody).toContain('return Err("plugin signer has been revoked".to_string())');
    expect(setStatusBody.indexOf("plugin signer has been revoked")).toBeLessThan(
      setStatusBody.indexOf("plugin.status = status")
    );
    expect(lib).toContain("fn plugin_has_revoked_signer");
    expect(lib).toContain("package.plugin_id == plugin_id && package_signer_revoked(ctx, &package.signer_id)");
    expect(lib).toContain("bundle.plugin_id == plugin_id && package_signer_revoked(ctx, &bundle.signer_id)");
  });

  it("rejects blank plugin ids before status or uninstall reducer mutations", () => {
    const lib = readFileSync("spacetimedb/src/lib.rs", "utf8");
    const setStatusBody = lib.slice(
      lib.indexOf("pub fn set_plugin_status"),
      lib.indexOf("fn plugin_has_revoked_signer")
    );
    const uninstallBody = lib.slice(
      lib.indexOf("pub fn uninstall_plugin"),
      lib.indexOf("#[reducer]\npub fn register_plugin_manifest")
    );

    expect(setStatusBody).toContain("validate_plugin_lifecycle_id(&plugin_id)?");
    expect(uninstallBody).toContain("validate_plugin_lifecycle_id(&plugin_id)?");
    expect(lib).toContain("fn validate_plugin_lifecycle_id");
    expect(lib).toContain('return Err("plugin id is required".to_string())');
    expect(setStatusBody.indexOf("validate_plugin_lifecycle_id(&plugin_id)?")).toBeLessThan(
      setStatusBody.indexOf("ctx.db.plugins().id().find")
    );
    expect(uninstallBody.indexOf("validate_plugin_lifecycle_id(&plugin_id)?")).toBeLessThan(
      uninstallBody.indexOf("ctx.db.plugins().id().delete")
    );
  });

  it("revokes signer-owned bundles and kills their live deployments inside signer revocation", () => {
    const lib = readFileSync("spacetimedb/src/lib.rs", "utf8");
    const revokeSignerBody = lib.slice(
      lib.indexOf("pub fn revoke_package_signer"),
      lib.indexOf("fn disable_plugins_for_package_signer")
    );

    expect(revokeSignerBody).toContain("let bundle_plugin_ids = revoke_bundles_for_package_signer(ctx, &signer_id, &reason);");
    expect(revokeSignerBody).toContain("merge_unique_strings(&mut disabled_plugin_ids, bundle_plugin_ids);");
    expect(revokeSignerBody.indexOf("revoke_bundles_for_package_signer")).toBeLessThan(
      revokeSignerBody.indexOf("let revocation = PluginPackageSignerRevocation")
    );
    expect(lib).toContain("fn revoke_bundles_for_package_signer");
    expect(lib).toContain("if bundle.signer_id == signer_id && bundle.status != \"revoked\"");
    expect(lib).toContain("bundle.status = \"revoked\".to_string();");
    expect(lib).toContain("disable_capabilities_for_bundle(ctx, &bundle_id);");
    expect(lib).toContain("kill_live_deployments_for_bundle(ctx, &bundle_id, reason);");
  });

  it("upserts package signer revocations so repeated revokes are idempotent", () => {
    const lib = readFileSync("spacetimedb/src/lib.rs", "utf8");

    expect(lib).toContain("let revocation = PluginPackageSignerRevocation");
    expect(lib).toContain("affected_plugin_ids_json: string_list_json(&disabled_plugin_ids)");
    expect(lib).toContain("plugin_package_signer_revocations().signer_id().find(signer_id.clone()).is_some()");
    expect(lib).toContain("ctx.db.plugin_package_signer_revocations().signer_id().update(revocation)");
  });

  it("uninstall removes plugin-owned runtime rows instead of leaving orphaned state", () => {
    const lib = readFileSync("spacetimedb/src/lib.rs", "utf8");
    const uninstallBody = lib.slice(
      lib.indexOf("pub fn uninstall_plugin"),
      lib.indexOf("#[reducer]\npub fn register_plugin_manifest")
    );

    for (const call of [
      "delete_plugin_bundles(ctx, &plugin_id);",
      "delete_plugin_capabilities(ctx, &plugin_id);",
      "delete_plugin_deployments(ctx, &plugin_id);",
      "delete_plugin_runtime_instances(ctx, &plugin_id);",
      "delete_plugin_config_values(ctx, &plugin_id);",
      "delete_plugin_schemas(ctx, &plugin_id);",
      "delete_plugin_entities(ctx, &plugin_id);",
      "delete_plugin_hooks(ctx, &plugin_id);",
      "delete_plugin_menu_surfaces(ctx, &plugin_id);",
      "delete_plugin_permissions(ctx, &plugin_id);"
    ]) {
      expect(uninstallBody).toContain(call);
    }
    expect(lib).toContain("fn delete_plugin_bundles");
    expect(lib).toContain("ctx.db.plugin_bundles().id().delete(bundle.id)");
    expect(lib).toContain("ctx.db.plugin_capabilities().id().delete(capability.id)");
    expect(lib).toContain("ctx.db.plugin_deployments().id().delete(deployment.id)");
    expect(lib).toContain("ctx.db.plugin_runtime_instances().id().delete(instance.id)");
    expect(lib).toContain("ctx.db.plugin_config_values().id().delete(config.id)");
    expect(lib).toContain("ctx.db.plugin_schemas().id().delete(schema.id)");
    expect(lib).toContain("ctx.db.plugin_entities().id().delete(entity.id)");
    expect(lib).toContain("ctx.db.plugin_hooks().id().delete(hook.id)");
    expect(lib).toContain("ctx.db.menu_definitions().id().delete(definition.id)");
    expect(lib).toContain("fn delete_plugin_permissions");
    expect(lib).toContain("permission.plugin_id == plugin_id");
    expect(lib).toContain("delete_permission_dependents(ctx, &permission.key);");
    expect(lib).toContain("ctx.db.permissions().id().delete(permission.id)");
    expect(lib).toContain("fn delete_permission_dependents");
    expect(lib).toContain("ctx.db.permission_grants().id().delete(grant.id)");
    expect(lib).toContain("ctx.db.ace_mirror_rules().id().delete(rule.id)");
    expect(lib).toContain("ctx.db.policy_constraints().id().delete(policy.id)");
  });
});
