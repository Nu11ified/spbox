import { moduleSource, readFileSync } from "./spacetimedb-source.js";
import { describe, expect, it } from "vitest";

describe("SpacetimeDB runtime config acknowledgements", () => {
  it("declares config acknowledgement table and reducer", () => {
    const lib = moduleSource();

    expect(lib).toContain("#[table(name = runtime_config_acks, public)]");
    expect(lib).toContain("pub struct RuntimeConfigAck");
    expect(lib).toContain("pub fn ack_config_version");
  });

  it("guards acknowledgements against stale or unknown config rows", () => {
    const lib = moduleSource();

    expect(lib).toContain('return Err("unknown config".to_string())');
    expect(lib).toContain('return Err("config version mismatch".to_string())');
    expect(lib).toContain("acknowledged_at: ctx.timestamp");
  });

  it("rejects blank acknowledgement coordinates before config lookup or ack row writes", () => {
    const lib = moduleSource();
    const ackBody = lib.slice(
      lib.indexOf("pub fn ack_config_version"),
      lib.indexOf("fn runtime_config_ack_id")
    );

    expect(ackBody).toContain("validate_runtime_config_ack_identity(&server_id, &namespace, &key)?");
    expect(lib).toContain("fn validate_runtime_config_ack_identity");
    expect(lib).toContain('return Err("runtime config ack server id is required".to_string())');
    expect(lib).toContain('return Err("runtime config ack namespace is required".to_string())');
    expect(lib).toContain('return Err("runtime config ack key is required".to_string())');
    expect(ackBody.indexOf("validate_runtime_config_ack_identity")).toBeLessThan(
      ackBody.indexOf(".runtime_config()")
    );
    expect(ackBody.indexOf("validate_runtime_config_ack_identity")).toBeLessThan(
      ackBody.indexOf("let id = runtime_config_ack_id")
    );
  });

  it("guards runtime config writes against unknown servers", () => {
    const lib = moduleSource();

    expect(lib).toContain("server must exist before config writes");
    expect(lib.indexOf("server must exist before config writes")).toBeLessThan(
      lib.indexOf("ctx.db.runtime_config().insert")
    );
  });
});
