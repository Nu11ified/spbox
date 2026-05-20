import { moduleSource, readFileSync } from "./spacetimedb-source.js";
import { describe, expect, it } from "vitest";

describe("SpacetimeDB gameplay reducer semantics", () => {
  const source = moduleSource;

  it("grant_item validates item existence and stack limits before mutation", () => {
    const lib = source();

    expect(lib).toContain("let Some(item) = ctx.db.items().key().find(item_key.clone())");
    expect(lib).toContain("let stack_id = inventory_stack_id(&owner_id, &item_key)");
    expect(lib).toContain("existing.quantity += quantity");
    expect(lib).toContain("item stack limit exceeded");
  });

  it("rejects blank inventory grant fields before quantity validation, item lookup, or mutation", () => {
    const lib = source();
    const grantBody = lib.slice(
      lib.indexOf("pub fn grant_item"),
      lib.indexOf("#[reducer]\npub fn assign_job")
    );

    expect(grantBody).toContain("validate_inventory_grant_identity(&owner_id, &item_key)?");
    expect(lib).toContain("fn validate_inventory_grant_identity");
    expect(lib).toContain('return Err("inventory grant owner id is required".to_string())');
    expect(lib).toContain('return Err("inventory grant item key is required".to_string())');
    expect(grantBody.indexOf("validate_inventory_grant_identity")).toBeLessThan(
      grantBody.indexOf("quantity == 0")
    );
    expect(grantBody.indexOf("validate_inventory_grant_identity")).toBeLessThan(
      grantBody.indexOf("ctx.db.items().key().find")
    );
    expect(grantBody.indexOf("validate_inventory_grant_identity")).toBeLessThan(
      grantBody.indexOf("ctx.db.inventory_stacks()")
    );
  });

  it("remove_item validates inventory stack existence and decrements or deletes rows", () => {
    const lib = source();
    const removeBody = lib.slice(
      lib.indexOf("pub fn remove_item"),
      lib.indexOf("#[reducer]\npub fn assign_job")
    );

    expect(removeBody).toContain("validate_inventory_grant_identity(&owner_id, &item_key)?");
    expect(removeBody).toContain("let stack_id = inventory_stack_id(&owner_id, &item_key)");
    expect(removeBody).toContain("let Some(mut existing) = ctx.db.inventory_stacks().id().find(stack_id.clone())");
    expect(removeBody).toContain('return Err("inventory stack not found".to_string())');
    expect(removeBody).toContain("ctx.db.inventory_stacks().id().delete(stack_id)");
    expect(removeBody).toContain("existing.quantity -= quantity");
    expect(removeBody.indexOf("validate_inventory_grant_identity")).toBeLessThan(
      removeBody.indexOf("ctx.db.inventory_stacks().id().find")
    );
  });

  it("assign_job validates job existence and grade membership", () => {
    const lib = source();

    expect(lib).toContain("let Some(job) = ctx.db.jobs().key().find(job_key.clone())");
    expect(lib).toContain("grade_exists(&job.grades_json, &grade)");
    expect(lib).toContain('return Err("unknown job grade".to_string())');
  });

  it("upsert_character validates identity fields before character mutation", () => {
    const lib = source();
    const characterBody = lib.slice(
      lib.indexOf("pub fn upsert_character"),
      lib.indexOf("#[reducer]\npub fn grant_item")
    );

    expect(characterBody).toContain("validate_character_identity");
    expect(lib).toContain("fn validate_character_identity");
    expect(lib).toContain('return Err("character id is required".to_string())');
    expect(lib).toContain('return Err("character player principal id is required".to_string())');
    expect(lib).toContain('return Err("character citizen id is required".to_string())');
    expect(lib).toContain('return Err("character cid must be positive".to_string())');
    expect(lib).toContain('return Err("character slot must be positive".to_string())');
    expect(characterBody.indexOf("validate_character_identity")).toBeLessThan(
      characterBody.indexOf("ctx.db.characters()")
    );
  });

  it("upsert_character stores gang_json for QBCore gang persistence", () => {
    const lib = source();

    expect(lib).toContain("pub gang_json: String");
    const characterBody = lib.slice(
      lib.indexOf("pub fn upsert_character"),
      lib.indexOf("fn validate_character_identity")
    );

    expect(characterBody).toContain("gang_json: String");
    expect(characterBody).toContain("gang_json,");
  });

  it("upsert_character clears other selected characters for the same player principal", () => {
    const lib = source();
    const characterBody = lib.slice(
      lib.indexOf("pub fn upsert_character"),
      lib.indexOf("#[reducer]\npub fn grant_item")
    );

    expect(characterBody).toContain("if selected");
    expect(characterBody).toContain("character.player_principal_id == player_principal_id");
    expect(characterBody).toContain("character.id != id");
    expect(characterBody).toContain("character.selected = false");
    expect(characterBody.indexOf("if selected")).toBeLessThan(
      characterBody.indexOf("ctx.db.characters().id().find")
    );
  });

  it("rejects blank job assignment fields before job lookup or mutation", () => {
    const lib = source();
    const assignBody = lib.slice(
      lib.indexOf("pub fn assign_job"),
      lib.indexOf("fn inventory_stack_id")
    );

    expect(assignBody).toContain("validate_job_assignment_identity(&character_id, &job_key, &grade)?");
    expect(lib).toContain("fn validate_job_assignment_identity");
    expect(lib).toContain('return Err("job assignment character id is required".to_string())');
    expect(lib).toContain('return Err("job assignment job key is required".to_string())');
    expect(lib).toContain('return Err("job assignment grade is required".to_string())');
    expect(assignBody.indexOf("validate_job_assignment_identity")).toBeLessThan(
      assignBody.indexOf("ctx.db.jobs().key().find")
    );
    expect(assignBody.indexOf("validate_job_assignment_identity")).toBeLessThan(
      assignBody.indexOf("ctx.db.character_jobs()")
    );
  });

  it("declares helper functions for inventory stack ids and grade checks", () => {
    const lib = source();

    expect(lib).toContain("fn inventory_stack_id");
    expect(lib).toContain("fn grade_exists");
  });

  it("guards plugin-owned gameplay primitive reducers against unknown plugins", () => {
    const lib = source();

    for (const message of [
      "plugin must exist before item writes",
      "plugin must exist before job writes",
      "plugin must exist before vehicle writes",
      "plugin must exist before location writes",
      "plugin must exist before hook writes"
    ]) {
      expect(lib).toContain(message);
    }
    expect(lib.indexOf("plugin must exist before item writes")).toBeLessThan(
      lib.indexOf("ctx.db.items().insert")
    );
    expect(lib.indexOf("plugin must exist before hook writes")).toBeLessThan(
      lib.indexOf("ctx.db.plugin_hooks().insert")
    );
    expect(lib).toContain("pub handler_type: String");
    expect(lib).toContain("validate_plugin_hook_handler_type(&handler_type)?");
    expect(lib).toContain('return Err("invalid plugin hook handler type".to_string())');
    expect(lib).toContain("pub fn set_plugin_hooks_enabled");
    expect(lib).toContain("hook.enabled = enabled");
  });

  it("rejects blank plugin hook registration fields before plugin lookup, handler validation, or insert", () => {
    const lib = source();
    const hookBody = lib.slice(
      lib.indexOf("pub fn register_plugin_hook"),
      lib.indexOf("#[reducer]\npub fn set_plugin_hooks_enabled")
    );

    expect(hookBody).toContain(
      "validate_plugin_hook_registration_identity(&id, &plugin_id, &hook_name, &capability, &handler_type, &handler_ref)?"
    );
    expect(lib).toContain("fn validate_plugin_hook_registration_identity");
    expect(lib).toContain('return Err("plugin hook id is required".to_string())');
    expect(lib).toContain('return Err("plugin hook plugin id is required".to_string())');
    expect(lib).toContain('return Err("plugin hook name is required".to_string())');
    expect(lib).toContain('return Err("plugin hook capability is required".to_string())');
    expect(lib).toContain('return Err("plugin hook handler type is required".to_string())');
    expect(lib).toContain('return Err("plugin hook handler ref is required".to_string())');
    expect(hookBody.indexOf("validate_plugin_hook_registration_identity")).toBeLessThan(
      hookBody.indexOf("plugin_exists(ctx, &plugin_id)")
    );
    expect(hookBody.indexOf("validate_plugin_hook_registration_identity")).toBeLessThan(
      hookBody.indexOf("validate_plugin_hook_handler_type")
    );
    expect(hookBody.indexOf("validate_plugin_hook_registration_identity")).toBeLessThan(
      hookBody.indexOf("ctx.db.plugin_hooks().insert")
    );
  });

  it("rejects blank plugin hook enablement plugin ids before lookup or mutation", () => {
    const lib = source();
    const enableBody = lib.slice(
      lib.indexOf("pub fn set_plugin_hooks_enabled"),
      lib.indexOf("fn set_plugin_hooks_enabled_for_plugin")
    );

    expect(enableBody).toContain("validate_plugin_hook_enablement_identity(&plugin_id)?");
    expect(lib).toContain("fn validate_plugin_hook_enablement_identity");
    expect(lib).toContain('return Err("plugin hook enablement plugin id is required".to_string())');
    expect(enableBody.indexOf("validate_plugin_hook_enablement_identity")).toBeLessThan(
      enableBody.indexOf("plugin_exists(ctx, &plugin_id)")
    );
    expect(enableBody.indexOf("validate_plugin_hook_enablement_identity")).toBeLessThan(
      enableBody.indexOf("set_plugin_hooks_enabled_for_plugin")
    );
  });

  it("fails closed when reducer calls try to leave inactive plugin hooks enabled", () => {
    const lib = source();

    expect(lib).toContain('return Err("plugin must be active before registering hooks".to_string())');
    expect(lib.indexOf('return Err("plugin must be active before registering hooks".to_string())')).toBeLessThan(
      lib.indexOf("ctx.db.plugin_hooks().insert")
    );
    expect(lib).toContain('return Err("plugin must be active before enabling hooks".to_string())');
    expect(lib.indexOf('return Err("plugin must be active before enabling hooks".to_string())')).toBeLessThan(
      lib.indexOf("set_plugin_hooks_enabled_for_plugin(ctx, &plugin_id, enabled);")
    );
    expect(lib).toContain('let should_disable_hooks = status != "active";');
    expect(lib).toContain("if should_disable_hooks");
    expect(lib).toContain("set_plugin_hooks_enabled_for_plugin(ctx, &plugin_id, false);");
  });

  it("guards plugin-owned gameplay primitive writes against inactive plugins", () => {
    const lib = source();

    for (const message of [
      "plugin must be active before item writes",
      "plugin must be active before job writes",
      "plugin must be active before vehicle writes",
      "plugin must be active before location writes"
    ]) {
      expect(lib).toContain(message);
    }
    expect(lib.indexOf("plugin must be active before item writes")).toBeLessThan(
      lib.indexOf("ctx.db.items().insert")
    );
    expect(lib.indexOf("plugin must be active before job writes")).toBeLessThan(
      lib.indexOf("ctx.db.jobs().insert")
    );
    expect(lib.indexOf("plugin must be active before vehicle writes")).toBeLessThan(
      lib.indexOf("ctx.db.vehicles().insert")
    );
    expect(lib.indexOf("plugin must be active before location writes")).toBeLessThan(
      lib.indexOf("ctx.db.locations().insert")
    );
  });

  it("rejects blank item registration fields before plugin lookup or insert", () => {
    const lib = source();
    const itemBody = lib.slice(
      lib.indexOf("pub fn register_item"),
      lib.indexOf("#[reducer]\npub fn register_job")
    );

    expect(itemBody).toContain("validate_item_registration_identity(&key, &plugin_id, &label)?");
    expect(lib).toContain("fn validate_item_registration_identity");
    expect(lib).toContain('return Err("item key is required".to_string())');
    expect(lib).toContain('return Err("item plugin id is required".to_string())');
    expect(lib).toContain('return Err("item label is required".to_string())');
    expect(itemBody.indexOf("validate_item_registration_identity")).toBeLessThan(
      itemBody.indexOf("plugin_exists(ctx, &plugin_id)")
    );
    expect(itemBody.indexOf("validate_item_registration_identity")).toBeLessThan(
      itemBody.indexOf("ctx.db.items().insert")
    );
  });

  it("rejects blank job registration fields before plugin lookup or insert", () => {
    const lib = source();
    const jobBody = lib.slice(
      lib.indexOf("pub fn register_job"),
      lib.indexOf("#[reducer]\npub fn register_vehicle")
    );

    expect(jobBody).toContain("validate_job_registration_identity(&key, &plugin_id, &label, &grades_json)?");
    expect(lib).toContain("fn validate_job_registration_identity");
    expect(lib).toContain('return Err("job key is required".to_string())');
    expect(lib).toContain('return Err("job plugin id is required".to_string())');
    expect(lib).toContain('return Err("job label is required".to_string())');
    expect(lib).toContain('return Err("job grades json is required".to_string())');
    expect(jobBody.indexOf("validate_job_registration_identity")).toBeLessThan(
      jobBody.indexOf("plugin_exists(ctx, &plugin_id)")
    );
    expect(jobBody.indexOf("validate_job_registration_identity")).toBeLessThan(
      jobBody.indexOf("ctx.db.jobs().insert")
    );
  });

  it("rejects blank vehicle registration fields before plugin lookup or insert", () => {
    const lib = source();
    const vehicleBody = lib.slice(
      lib.indexOf("pub fn register_vehicle"),
      lib.indexOf("#[reducer]\npub fn register_location")
    );

    expect(vehicleBody).toContain("validate_vehicle_registration_identity(&model, &plugin_id, &label, &category)?");
    expect(lib).toContain("fn validate_vehicle_registration_identity");
    expect(lib).toContain('return Err("vehicle model is required".to_string())');
    expect(lib).toContain('return Err("vehicle plugin id is required".to_string())');
    expect(lib).toContain('return Err("vehicle label is required".to_string())');
    expect(lib).toContain('return Err("vehicle category is required".to_string())');
    expect(vehicleBody.indexOf("validate_vehicle_registration_identity")).toBeLessThan(
      vehicleBody.indexOf("plugin_exists(ctx, &plugin_id)")
    );
    expect(vehicleBody.indexOf("validate_vehicle_registration_identity")).toBeLessThan(
      vehicleBody.indexOf("ctx.db.vehicles().insert")
    );
  });

  it("rejects blank location registration fields before plugin lookup or insert", () => {
    const lib = source();
    const locationBody = lib.slice(
      lib.indexOf("pub fn register_location"),
      lib.indexOf("#[reducer]\npub fn grant_item")
    );

    expect(locationBody).toContain("validate_location_registration_identity(&key, &plugin_id, &label)?");
    expect(lib).toContain("fn validate_location_registration_identity");
    expect(lib).toContain('return Err("location key is required".to_string())');
    expect(lib).toContain('return Err("location plugin id is required".to_string())');
    expect(lib).toContain('return Err("location label is required".to_string())');
    expect(locationBody.indexOf("validate_location_registration_identity")).toBeLessThan(
      locationBody.indexOf("plugin_exists(ctx, &plugin_id)")
    );
    expect(locationBody.indexOf("validate_location_registration_identity")).toBeLessThan(
      locationBody.indexOf("ctx.db.locations().insert")
    );
  });
});
