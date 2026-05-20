import { moduleSource, readFileSync } from "./spacetimedb-source.js";
import { describe, expect, it } from "vitest";

describe("SpacetimeDB plugin data module surface", () => {
  const source = moduleSource;

  it("declares plugin schema and entity tables", () => {
    const lib = source();

    expect(lib).toContain("#[table(name = plugin_schemas, public)]");
    expect(lib).toContain("pub struct PluginSchema");
    expect(lib).toContain("#[table(name = plugin_entities, public)]");
    expect(lib).toContain("pub struct PluginEntity");
  });

  it("declares reducers for schema registration and namespaced entity upserts", () => {
    const lib = source();

    expect(lib).toContain("pub fn register_plugin_schema");
    expect(lib).toContain("pub fn upsert_plugin_entity");
    expect(lib).toContain("validate_plugin_entity_owner_type(&owner_type)?");
    expect(lib).toContain('return Err("plugin schema must exist before entity writes".to_string())');
  });

  it("guards plugin schema migration plans in the reducer", () => {
    const lib = source();

    expect(lib).toContain("validate_plugin_schema_migration_plan");
    expect(lib).toContain("validate_plugin_schema_json");
    expect(lib).toContain('return Err("unsupported plugin schema migration step".to_string())');
    expect(lib).toContain('return Err("plugin schema migration entity mismatch".to_string())');
    expect(lib.indexOf("validate_plugin_schema_migration_plan")).toBeLessThan(
      lib.indexOf("let id = plugin_schema_id")
    );
  });

  it("guards schema and entity reducers against inactive or unknown plugins", () => {
    const lib = source();

    expect(lib).toContain('return Err("plugin must exist before schema writes".to_string())');
    expect(lib.indexOf('return Err("plugin must exist before schema writes".to_string())')).toBeLessThan(
      lib.indexOf("validate_plugin_schema_json(&schema_json)?")
    );
    expect(lib).toContain('return Err("plugin must be active before entity writes".to_string())');
    expect(lib.indexOf('return Err("plugin must be active before entity writes".to_string())')).toBeLessThan(
      lib.indexOf("let Some(schema) = find_active_plugin_schema")
    );
  });

  it("rejects blank schema identity fields before plugin lookup or schema id creation", () => {
    const lib = source();
    const registerSchemaBody = lib.slice(
      lib.indexOf("pub fn register_plugin_schema"),
      lib.indexOf("#[reducer]\npub fn upsert_plugin_entity")
    );

    expect(registerSchemaBody).toContain("validate_plugin_schema_identity(&plugin_id, &entity_type)?");
    expect(lib).toContain("fn validate_plugin_schema_identity");
    expect(lib).toContain('return Err("plugin schema plugin id is required".to_string())');
    expect(lib).toContain('return Err("plugin schema entity type is required".to_string())');
    expect(registerSchemaBody.indexOf("validate_plugin_schema_identity(&plugin_id, &entity_type)?")).toBeLessThan(
      registerSchemaBody.indexOf("plugin_exists(ctx, &plugin_id)")
    );
    expect(registerSchemaBody.indexOf("validate_plugin_schema_identity(&plugin_id, &entity_type)?")).toBeLessThan(
      registerSchemaBody.indexOf("let id = plugin_schema_id")
    );
  });

  it("guards entity upserts against changing an existing entity type", () => {
    const lib = source();

    expect(lib).toContain("plugin entity type mismatch");
    expect(lib).toContain("if entity.entity_type != entity_type");
    expect(lib.indexOf("plugin entity type mismatch")).toBeLessThan(
      lib.indexOf("entity.owner_type = owner_type")
    );
  });

  it("rejects blank entity identity fields before active plugin lookup or mutation", () => {
    const lib = source();
    const upsertEntityBody = lib.slice(
      lib.indexOf("pub fn upsert_plugin_entity"),
      lib.indexOf("fn validate_plugin_schema_status")
    );

    expect(upsertEntityBody).toContain("validate_plugin_entity_identity(&id, &plugin_id, &entity_type, &owner_id)?");
    expect(lib).toContain("fn validate_plugin_entity_identity");
    expect(lib).toContain('return Err("plugin entity id is required".to_string())');
    expect(lib).toContain('return Err("plugin entity plugin id is required".to_string())');
    expect(lib).toContain('return Err("plugin entity type is required".to_string())');
    expect(lib).toContain('return Err("plugin entity owner id is required".to_string())');
    expect(upsertEntityBody.indexOf("validate_plugin_entity_identity(&id, &plugin_id, &entity_type, &owner_id)?")).toBeLessThan(
      upsertEntityBody.indexOf("plugin_is_active(ctx, &plugin_id)")
    );
    expect(upsertEntityBody.indexOf("validate_plugin_entity_identity(&id, &plugin_id, &entity_type, &owner_id)?")).toBeLessThan(
      upsertEntityBody.indexOf("if let Some(mut entity)")
    );
  });

  it("validates plugin entity data against the active schema before mutation", () => {
    const lib = source();

    expect(lib).toContain("find_active_plugin_schema");
    expect(lib).toContain("validate_plugin_entity_data_json");
    expect(lib).toContain('return Err("plugin entity data must be a json object".to_string())');
    expect(lib).toContain('return Err("plugin entity data missing required field".to_string())');
    expect(lib).toContain('return Err("plugin entity data field type mismatch".to_string())');
    expect(lib.indexOf("validate_plugin_entity_data_json")).toBeLessThan(
      lib.indexOf("if let Some(mut entity)")
    );
  });
});
