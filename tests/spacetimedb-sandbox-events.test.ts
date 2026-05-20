import { moduleSource, readFileSync } from "./spacetimedb-source.js";
import { describe, expect, it } from "vitest";

describe("SpacetimeDB sandbox event module surface", () => {
  const source = moduleSource;

  it("declares plugin sandbox event persistence", () => {
    const lib = source();

    expect(lib).toContain("#[table(name = plugin_sandbox_events, public)]");
    expect(lib).toContain("pub struct PluginSandboxEvent");
    expect(lib).toContain("pub event_type: String");
    expect(lib).toContain("pub payload_hash: String");
  });

  it("declares a reducer for recording sandbox events", () => {
    const lib = source();

    expect(lib).toContain("pub fn record_plugin_sandbox_event");
    expect(lib).toContain("validate_sandbox_event_status(&status)?");
  });

  it("guards sandbox event writes against unknown plugins and servers", () => {
    const lib = source();

    expect(lib).toContain("plugin must exist before sandbox event writes");
    expect(lib).toContain("server must exist before sandbox event writes");
    expect(lib.indexOf("plugin must exist before sandbox event writes")).toBeLessThan(
      lib.indexOf("ctx.db.plugin_sandbox_events().insert")
    );
    expect(lib.indexOf("server must exist before sandbox event writes")).toBeLessThan(
      lib.indexOf("ctx.db.plugin_sandbox_events().insert")
    );
  });

  it("rejects blank sandbox event identity fields before plugin/server lookup or insert", () => {
    const lib = source();
    const recordSandboxEventBody = lib.slice(
      lib.indexOf("pub fn record_plugin_sandbox_event"),
      lib.indexOf("fn validate_sandbox_event_status")
    );

    expect(recordSandboxEventBody).toContain(
      "validate_plugin_sandbox_event_identity(&id, &plugin_id, &server_id, &event_type, &payload_hash)?"
    );
    expect(lib).toContain("fn validate_plugin_sandbox_event_identity");
    expect(lib).toContain('return Err("plugin sandbox event id is required".to_string())');
    expect(lib).toContain('return Err("plugin sandbox event plugin id is required".to_string())');
    expect(lib).toContain('return Err("plugin sandbox event server id is required".to_string())');
    expect(lib).toContain('return Err("plugin sandbox event type is required".to_string())');
    expect(lib).toContain('return Err("plugin sandbox event payload hash is required".to_string())');
    expect(recordSandboxEventBody.indexOf("validate_plugin_sandbox_event_identity")).toBeLessThan(
      recordSandboxEventBody.indexOf("plugin_exists(ctx, &plugin_id)")
    );
    expect(recordSandboxEventBody.indexOf("validate_plugin_sandbox_event_identity")).toBeLessThan(
      recordSandboxEventBody.indexOf("ctx.db.plugin_sandbox_events().insert")
    );
  });
});
