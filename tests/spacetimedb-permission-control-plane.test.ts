import { moduleSource, readFileSync } from "./spacetimedb-source.js";
import { describe, expect, it } from "vitest";

describe("SpacetimeDB permission control-plane tables", () => {
  it("declares permission definitions, cache versions, and ACE mirror rules", () => {
    const lib = moduleSource();

    for (const table of ["permissions", "permission_cache_versions", "ace_mirror_rules"]) {
      expect(lib).toContain(`#[table(name = ${table}, public)]`);
    }
  });

  it("exposes reducers for permission definitions, cache version acks, and ACE mirror rules", () => {
    const lib = moduleSource();

    for (const reducer of ["register_permission", "ack_permission_cache_version", "upsert_ace_mirror_rule"]) {
      expect(lib).toContain(`pub fn ${reducer}`);
    }
    expect(lib).toContain("validate_ace_mirror_mode");
  });

  it("guards permission reducers against unknown plugins, principals, and permission keys", () => {
    const lib = moduleSource();

    for (const message of [
      "plugin must exist before permission writes",
      "principal must exist before permission grant writes",
      "permission must exist before permission grant writes",
      "permission must exist before ace mirror writes",
      "permission must exist before policy constraint writes"
    ]) {
      expect(lib).toContain(message);
    }
    expect(lib.indexOf("plugin must exist before permission writes")).toBeLessThan(
      lib.indexOf("let permission = Permission")
    );
    expect(lib.indexOf("principal must exist before permission grant writes")).toBeLessThan(
      lib.indexOf("ctx.db.permission_grants().insert")
    );
  });

  it("rejects blank permission grant fields before effect validation, lookup, or insert", () => {
    const lib = moduleSource();
    const grantBody = lib.slice(
      lib.indexOf("pub fn grant_permission"),
      lib.indexOf("#[reducer]\npub fn upsert_policy_constraint")
    );

    expect(grantBody).toContain("validate_permission_grant_identity(&id, &principal_id, &permission_key, &source)?");
    expect(lib).toContain("fn validate_permission_grant_identity");
    expect(lib).toContain('return Err("permission grant id is required".to_string())');
    expect(lib).toContain('return Err("permission grant principal id is required".to_string())');
    expect(lib).toContain('return Err("permission grant key is required".to_string())');
    expect(lib).toContain('return Err("permission grant source is required".to_string())');
    expect(grantBody.indexOf("validate_permission_grant_identity")).toBeLessThan(
      grantBody.indexOf('effect != "allow"')
    );
    expect(grantBody.indexOf("validate_permission_grant_identity")).toBeLessThan(
      grantBody.indexOf("principal_exists(ctx, &principal_id)")
    );
    expect(grantBody.indexOf("validate_permission_grant_identity")).toBeLessThan(
      grantBody.indexOf("ctx.db.permission_grants().insert")
    );
  });

  it("rejects blank policy constraint fields before type validation, lookup, or upsert", () => {
    const lib = moduleSource();
    const policyBody = lib.slice(
      lib.indexOf("pub fn upsert_policy_constraint"),
      lib.indexOf("#[reducer]\npub fn remove_policy_constraint")
    );

    expect(policyBody).toContain(
      "validate_policy_constraint_identity(&id, &permission_key, &constraint_type, &constraint_json)?"
    );
    expect(lib).toContain("fn validate_policy_constraint_identity");
    expect(lib).toContain('return Err("policy constraint id is required".to_string())');
    expect(lib).toContain('return Err("policy constraint permission key is required".to_string())');
    expect(lib).toContain('return Err("policy constraint type is required".to_string())');
    expect(lib).toContain('return Err("policy constraint json is required".to_string())');
    expect(policyBody.indexOf("validate_policy_constraint_identity")).toBeLessThan(
      policyBody.indexOf("validate_policy_constraint_type")
    );
    expect(policyBody.indexOf("validate_policy_constraint_identity")).toBeLessThan(
      policyBody.indexOf("permission_key_exists(ctx, &permission_key)")
    );
    expect(policyBody.indexOf("validate_policy_constraint_identity")).toBeLessThan(
      policyBody.indexOf("ctx.db.policy_constraints()")
    );
  });

  it("rejects blank policy constraint removal ids before delete", () => {
    const lib = moduleSource();
    const removePolicyBody = lib.slice(
      lib.indexOf("pub fn remove_policy_constraint"),
      lib.indexOf("fn validate_policy_constraint_identity")
    );

    expect(removePolicyBody).toContain("validate_policy_constraint_removal_identity(&policy_id)?");
    expect(lib).toContain("fn validate_policy_constraint_removal_identity");
    expect(lib).toContain('return Err("policy constraint removal id is required".to_string())');
    expect(removePolicyBody.indexOf("validate_policy_constraint_removal_identity")).toBeLessThan(
      removePolicyBody.indexOf("ctx.db.policy_constraints().id().delete")
    );
  });

  it("rejects blank principal identity fields before principal row insertion", () => {
    const lib = moduleSource();
    const upsertPrincipalBody = lib.slice(
      lib.indexOf("pub fn upsert_principal"),
      lib.indexOf("#[reducer]\npub fn register_permission")
    );

    expect(upsertPrincipalBody).toContain("validate_principal_identity(&id, &principal_type, &external_id, &name)?");
    expect(lib).toContain("fn validate_principal_identity");
    expect(lib).toContain('return Err("principal id is required".to_string())');
    expect(lib).toContain('return Err("principal type is required".to_string())');
    expect(lib).toContain('return Err("principal external id is required".to_string())');
    expect(lib).toContain('return Err("principal name is required".to_string())');
    expect(upsertPrincipalBody.indexOf("validate_principal_identity")).toBeLessThan(
      upsertPrincipalBody.indexOf("ctx.db.principals().insert")
    );
  });

  it("rejects blank permission definition fields before plugin lookup or upsert", () => {
    const lib = moduleSource();
    const registerPermissionBody = lib.slice(
      lib.indexOf("pub fn register_permission"),
      lib.indexOf("#[reducer]\npub fn ack_permission_cache_version")
    );

    expect(registerPermissionBody).toContain("validate_permission_definition_identity(&id, &key, &description, &plugin_id)?");
    expect(lib).toContain("fn validate_permission_definition_identity");
    expect(lib).toContain('return Err("permission id is required".to_string())');
    expect(lib).toContain('return Err("permission key is required".to_string())');
    expect(lib).toContain('return Err("permission description is required".to_string())');
    expect(lib).toContain('return Err("permission plugin id is required".to_string())');
    expect(registerPermissionBody.indexOf("validate_permission_definition_identity")).toBeLessThan(
      registerPermissionBody.indexOf("plugin_exists(ctx, &plugin_id)")
    );
    expect(registerPermissionBody.indexOf("validate_permission_definition_identity")).toBeLessThan(
      registerPermissionBody.indexOf("let permission = Permission")
    );
  });

  it("guards permission cache acknowledgements against unknown servers", () => {
    const lib = moduleSource();
    const ackBody = lib.slice(
      lib.indexOf("pub fn ack_permission_cache_version"),
      lib.indexOf("#[reducer]\npub fn upsert_ace_mirror_rule")
    );

    expect(ackBody).toContain('return Err("server must exist before permission cache acknowledgements".to_string())');
    expect(ackBody).toContain("if !server_exists(ctx, &server_id)");
    expect(ackBody.indexOf("server must exist before permission cache acknowledgements")).toBeLessThan(
      ackBody.indexOf("let cache_version = PermissionCacheVersion")
    );
  });

  it("rejects blank permission cache acknowledgement server ids before lookup or upsert", () => {
    const lib = moduleSource();
    const ackBody = lib.slice(
      lib.indexOf("pub fn ack_permission_cache_version"),
      lib.indexOf("#[reducer]\npub fn upsert_ace_mirror_rule")
    );

    expect(ackBody).toContain("validate_permission_cache_ack_identity(&server_id)?");
    expect(lib).toContain("fn validate_permission_cache_ack_identity");
    expect(lib).toContain('return Err("permission cache ack server id is required".to_string())');
    expect(ackBody.indexOf("validate_permission_cache_ack_identity")).toBeLessThan(
      ackBody.indexOf("server_exists(ctx, &server_id)")
    );
    expect(ackBody.indexOf("validate_permission_cache_ack_identity")).toBeLessThan(
      ackBody.indexOf("let cache_version = PermissionCacheVersion")
    );
  });

  it("rejects blank ACE mirror rule fields before mode validation, lookup, or upsert", () => {
    const lib = moduleSource();
    const aceBody = lib.slice(
      lib.indexOf("pub fn upsert_ace_mirror_rule"),
      lib.indexOf("fn validate_ace_mirror_mode")
    );

    expect(aceBody).toContain("validate_ace_mirror_identity(&id, &permission_key, &ace_object)?");
    expect(lib).toContain("fn validate_ace_mirror_identity");
    expect(lib).toContain('return Err("ace mirror rule id is required".to_string())');
    expect(lib).toContain('return Err("ace mirror permission key is required".to_string())');
    expect(lib).toContain('return Err("ace mirror object is required".to_string())');
    expect(aceBody.indexOf("validate_ace_mirror_identity")).toBeLessThan(
      aceBody.indexOf("validate_ace_mirror_mode")
    );
    expect(aceBody.indexOf("validate_ace_mirror_identity")).toBeLessThan(
      aceBody.indexOf("permission_key_exists(ctx, &permission_key)")
    );
    expect(aceBody.indexOf("validate_ace_mirror_identity")).toBeLessThan(
      aceBody.indexOf("ctx.db.ace_mirror_rules()")
    );
  });

  it("guards principal edge writes against unknown parent or child principals", () => {
    const lib = moduleSource();

    expect(lib).toContain("parent principal must exist before edge writes");
    expect(lib).toContain("child principal must exist before edge writes");
    expect(lib.indexOf("parent principal must exist before edge writes")).toBeLessThan(
      lib.indexOf("ctx.db.principal_edges().insert")
    );
    expect(lib.indexOf("child principal must exist before edge writes")).toBeLessThan(
      lib.indexOf("ctx.db.principal_edges().insert")
    );
  });

  it("rejects blank principal edge fields before principal lookup or insert", () => {
    const lib = moduleSource();
    const edgeBody = lib.slice(
      lib.indexOf("pub fn add_principal_edge"),
      lib.indexOf("#[reducer]\npub fn remove_principal_edge")
    );

    expect(edgeBody).toContain("validate_principal_edge_identity(&id, &parent_principal_id, &child_principal_id, &source)?");
    expect(lib).toContain("fn validate_principal_edge_identity");
    expect(lib).toContain('return Err("principal edge id is required".to_string())');
    expect(lib).toContain('return Err("parent principal id is required".to_string())');
    expect(lib).toContain('return Err("child principal id is required".to_string())');
    expect(lib).toContain('return Err("principal edge source is required".to_string())');
    expect(edgeBody.indexOf("validate_principal_edge_identity")).toBeLessThan(
      edgeBody.indexOf("principal_exists(ctx, &parent_principal_id)")
    );
    expect(edgeBody.indexOf("validate_principal_edge_identity")).toBeLessThan(
      edgeBody.indexOf("ctx.db.principal_edges().insert")
    );
  });

  it("rejects blank principal edge removal ids before delete", () => {
    const lib = moduleSource();
    const removeEdgeBody = lib.slice(
      lib.indexOf("pub fn remove_principal_edge"),
      lib.indexOf("#[reducer]\npub fn write_audit_log")
    );

    expect(removeEdgeBody).toContain("validate_principal_edge_removal_identity(&edge_id)?");
    expect(lib).toContain("fn validate_principal_edge_removal_identity");
    expect(lib).toContain('return Err("principal edge removal id is required".to_string())');
    expect(removeEdgeBody.indexOf("validate_principal_edge_removal_identity")).toBeLessThan(
      removeEdgeBody.indexOf("ctx.db.principal_edges().id().delete")
    );
  });
});
