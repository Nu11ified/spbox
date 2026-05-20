import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("SpacetimeDB menu module surface", () => {
  const source = () => readFileSync("spacetimedb/src/lib.rs", "utf8");

  it("declares menu definition, action, command, panel, policy, and session tables", () => {
    const lib = source();

    expect(lib).toContain("#[table(name = menu_definitions, public)]");
    expect(lib).toContain("pub struct MenuDefinition");
    expect(lib).toContain("#[table(name = menu_actions, public)]");
    expect(lib).toContain("pub struct MenuAction");
    expect(lib).toContain("#[table(name = runtime_commands, public)]");
    expect(lib).toContain("pub struct RuntimeCommand");
    expect(lib).toContain("#[table(name = runtime_panels, public)]");
    expect(lib).toContain("pub struct RuntimePanel");
    expect(lib).toContain("#[table(name = menu_visibility_policies, public)]");
    expect(lib).toContain("pub struct MenuVisibilityPolicy");
    expect(lib).toContain("#[table(name = menu_sessions, public)]");
    expect(lib).toContain("pub struct MenuSession");
  });

  it("declares reducers for menu definition, action, command, panel, policy, and session upserts", () => {
    const lib = source();

    expect(lib).toContain("pub fn upsert_menu_definition");
    expect(lib).toContain("pub fn upsert_menu_action");
    expect(lib).toContain("pub fn upsert_runtime_command");
    expect(lib).toContain("pub fn upsert_runtime_panel");
    expect(lib).toContain("pub fn upsert_menu_visibility_policy");
    expect(lib).toContain("pub fn open_menu_session");
    expect(lib).toContain("pub fn close_menu_session");
    expect(lib).toContain("validate_menu_action_type(&action_type)?");
    expect(lib).toContain("validate_menu_audit_level(&audit_level)?");
    expect(lib).toContain("validate_runtime_command_name(&name)?");
    expect(lib).toContain("validate_runtime_panel_route(&route)?");
  });

  it("allows first-party typed runtime menu action names", () => {
    const lib = source();

    expect(lib).toContain("\"repair_vehicle\"");
    expect(lib).toContain("\"spawn_vehicle\"");
    expect(lib).toContain("\"set_weather\"");
    expect(lib).toContain("\"set_time\"");
    expect(lib).toContain("\"teleport_player\"");
    expect(lib).toContain("\"kick_player\"");
    expect(lib).toContain("\"economy_admin_adjust_balance\"");
    expect(lib).toContain("\"set_plugin_status\"");
  });

  it("guards plugin-owned menu reducers against unknown plugins", () => {
    const lib = source();

    for (const message of [
      "plugin must exist before menu definition writes",
      "plugin must exist before menu action writes",
      "plugin must exist before runtime command writes",
      "plugin must exist before runtime panel writes",
      "plugin must exist before menu visibility policy writes"
    ]) {
      expect(lib).toContain(message);
    }
    expect(lib.indexOf("plugin must exist before menu definition writes")).toBeLessThan(
      lib.indexOf("let menu = MenuDefinition")
    );
    expect(lib.indexOf("plugin must exist before menu action writes")).toBeLessThan(
      lib.indexOf("let action = MenuAction")
    );
  });

  it("rejects blank menu definition identity fields before plugin lookup or upsert", () => {
    const lib = source();
    const definitionBody = lib.slice(
      lib.indexOf("pub fn upsert_menu_definition"),
      lib.indexOf("#[reducer]\npub fn upsert_menu_action")
    );

    expect(definitionBody).toContain("validate_menu_definition_identity(&id, &plugin_id, &label)?");
    expect(lib).toContain("fn validate_menu_definition_identity");
    expect(lib).toContain('return Err("menu definition id is required".to_string())');
    expect(lib).toContain('return Err("menu definition plugin id is required".to_string())');
    expect(lib).toContain('return Err("menu definition label is required".to_string())');
    expect(definitionBody.indexOf("validate_menu_definition_identity")).toBeLessThan(
      definitionBody.indexOf("plugin_exists(ctx, &plugin_id)")
    );
    expect(definitionBody.indexOf("validate_menu_definition_identity")).toBeLessThan(
      definitionBody.indexOf("let menu = MenuDefinition")
    );
  });

  it("rejects blank menu action identity fields before semantic validation, plugin lookup, or upsert", () => {
    const lib = source();
    const actionBody = lib.slice(
      lib.indexOf("pub fn upsert_menu_action"),
      lib.indexOf("#[reducer]\npub fn upsert_runtime_command")
    );

    expect(actionBody).toContain(
      "validate_menu_action_identity(&id, &plugin_id, &action_type, &payload_schema_json, &audit_level)?"
    );
    expect(lib).toContain("fn validate_menu_action_identity");
    expect(lib).toContain('return Err("menu action id is required".to_string())');
    expect(lib).toContain('return Err("menu action plugin id is required".to_string())');
    expect(lib).toContain('return Err("menu action type is required".to_string())');
    expect(lib).toContain('return Err("menu action payload schema is required".to_string())');
    expect(lib).toContain('return Err("menu action audit level is required".to_string())');
    expect(actionBody.indexOf("validate_menu_action_identity")).toBeLessThan(
      actionBody.indexOf("validate_menu_action_type")
    );
    expect(actionBody.indexOf("validate_menu_action_identity")).toBeLessThan(
      actionBody.indexOf("plugin_exists(ctx, &plugin_id)")
    );
    expect(actionBody.indexOf("validate_menu_action_identity")).toBeLessThan(
      actionBody.indexOf("let action = MenuAction")
    );
  });

  it("rejects blank runtime command identity fields before command validation, plugin lookup, or upsert", () => {
    const lib = source();
    const commandBody = lib.slice(
      lib.indexOf("pub fn upsert_runtime_command"),
      lib.indexOf("#[reducer]\npub fn upsert_runtime_panel")
    );

    expect(commandBody).toContain(
      "validate_runtime_command_identity(&id, &plugin_id, &name, &action_id, &payload_schema_json, &audit_level)?"
    );
    expect(lib).toContain("fn validate_runtime_command_identity");
    expect(lib).toContain('return Err("runtime command id is required".to_string())');
    expect(lib).toContain('return Err("runtime command plugin id is required".to_string())');
    expect(lib).toContain('return Err("runtime command name is required".to_string())');
    expect(lib).toContain('return Err("runtime command action id is required".to_string())');
    expect(lib).toContain('return Err("runtime command payload schema is required".to_string())');
    expect(lib).toContain('return Err("runtime command audit level is required".to_string())');
    expect(commandBody.indexOf("validate_runtime_command_identity")).toBeLessThan(
      commandBody.indexOf("validate_runtime_command_name")
    );
    expect(commandBody.indexOf("validate_runtime_command_identity")).toBeLessThan(
      commandBody.indexOf("plugin_exists(ctx, &plugin_id)")
    );
    expect(commandBody.indexOf("validate_runtime_command_identity")).toBeLessThan(
      commandBody.indexOf("let command = RuntimeCommand")
    );
  });

  it("rejects blank runtime panel identity fields before route validation, plugin lookup, or upsert", () => {
    const lib = source();
    const panelBody = lib.slice(
      lib.indexOf("pub fn upsert_runtime_panel"),
      lib.indexOf("#[reducer]\npub fn upsert_menu_visibility_policy")
    );

    expect(panelBody).toContain("validate_runtime_panel_identity(&id, &plugin_id, &title, &route)?");
    expect(lib).toContain("fn validate_runtime_panel_identity");
    expect(lib).toContain('return Err("runtime panel id is required".to_string())');
    expect(lib).toContain('return Err("runtime panel plugin id is required".to_string())');
    expect(lib).toContain('return Err("runtime panel title is required".to_string())');
    expect(lib).toContain('return Err("runtime panel route is required".to_string())');
    expect(panelBody.indexOf("validate_runtime_panel_identity")).toBeLessThan(
      panelBody.indexOf("validate_runtime_panel_route")
    );
    expect(panelBody.indexOf("validate_runtime_panel_identity")).toBeLessThan(
      panelBody.indexOf("plugin_exists(ctx, &plugin_id)")
    );
    expect(panelBody.indexOf("validate_runtime_panel_identity")).toBeLessThan(
      panelBody.indexOf("let panel = RuntimePanel")
    );
  });

  it("rejects blank menu visibility policy fields before plugin lookup or upsert", () => {
    const lib = source();
    const policyBody = lib.slice(
      lib.indexOf("pub fn upsert_menu_visibility_policy"),
      lib.indexOf("#[reducer]\npub fn open_menu_session")
    );

    expect(policyBody).toContain("validate_menu_visibility_policy_identity(&id, &plugin_id, &policy_json)?");
    expect(lib).toContain("fn validate_menu_visibility_policy_identity");
    expect(lib).toContain('return Err("menu visibility policy id is required".to_string())');
    expect(lib).toContain('return Err("menu visibility policy plugin id is required".to_string())');
    expect(lib).toContain('return Err("menu visibility policy json is required".to_string())');
    expect(policyBody.indexOf("validate_menu_visibility_policy_identity")).toBeLessThan(
      policyBody.indexOf("plugin_exists(ctx, &plugin_id)")
    );
    expect(policyBody.indexOf("validate_menu_visibility_policy_identity")).toBeLessThan(
      policyBody.indexOf("let policy = MenuVisibilityPolicy")
    );
  });

  it("rejects blank menu session open fields before session upsert", () => {
    const lib = source();
    const openBody = lib.slice(
      lib.indexOf("pub fn open_menu_session"),
      lib.indexOf("#[reducer]\npub fn close_menu_session")
    );

    expect(openBody).toContain("validate_menu_session_open_identity(&id, &server_id, &player_id)?");
    expect(lib).toContain("fn validate_menu_session_open_identity");
    expect(lib).toContain('return Err("menu session id is required".to_string())');
    expect(lib).toContain('return Err("menu session server id is required".to_string())');
    expect(lib).toContain('return Err("menu session player id is required".to_string())');
    expect(openBody.indexOf("validate_menu_session_open_identity")).toBeLessThan(
      openBody.indexOf("let session = MenuSession")
    );
  });

  it("rejects blank menu session close ids before lookup", () => {
    const lib = source();
    const closeBody = lib.slice(
      lib.indexOf("pub fn close_menu_session"),
      lib.indexOf("fn set_plugin_menu_surfaces_enabled")
    );

    expect(closeBody).toContain("validate_menu_session_close_identity(&session_id)?");
    expect(lib).toContain("fn validate_menu_session_close_identity");
    expect(lib).toContain('return Err("menu session close id is required".to_string())');
    expect(closeBody.indexOf("validate_menu_session_close_identity")).toBeLessThan(
      closeBody.indexOf("ctx.db.menu_sessions().id().find")
    );
  });

  it("disables plugin-owned menu surfaces when plugins become inactive", () => {
    const lib = source();

    for (const mutation of [
      "set_plugin_menu_surfaces_enabled(ctx, &plugin_id, false);",
      "definition.enabled = enabled;",
      "action.enabled = enabled;",
      "command.enabled = enabled;",
      "panel.enabled = enabled;",
      "policy.enabled = enabled;"
    ]) {
      expect(lib).toContain(mutation);
    }
    expect(lib.indexOf("set_plugin_menu_surfaces_enabled(ctx, &plugin_id, false);")).toBeLessThan(
      lib.indexOf("set_plugin_hooks_enabled_for_plugin(ctx, &plugin_id, false);")
    );
  });

  it("rejects enabled plugin-owned menu surface writes for inactive plugins", () => {
    const lib = source();

    for (const message of [
      "plugin must be active before enabling menu definitions",
      "plugin must be active before enabling menu actions",
      "plugin must be active before enabling runtime commands",
      "plugin must be active before enabling runtime panels",
      "plugin must be active before enabling menu visibility policies"
    ]) {
      expect(lib).toContain(message);
    }
    expect(lib.indexOf("plugin must be active before enabling menu definitions")).toBeLessThan(
      lib.indexOf("let menu = MenuDefinition")
    );
    expect(lib.indexOf("plugin must be active before enabling menu actions")).toBeLessThan(
      lib.indexOf("let action = MenuAction")
    );
  });

  it("requires explicit permissions for SpacetimeDB server-command menu action rows", () => {
    const lib = source();

    expect(lib).toContain("validate_menu_action_permission(&action_type, &required_permission)?");
    expect(lib).toContain('return Err("execute_server_command actions require an explicit permission".to_string())');
    expect(lib.indexOf("validate_menu_action_permission(&action_type, &required_permission)?")).toBeLessThan(
      lib.indexOf("let action = MenuAction")
    );
  });
});
