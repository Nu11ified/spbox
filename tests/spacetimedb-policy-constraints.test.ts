import { moduleSource, readFileSync } from "./spacetimedb-source.js";
import { describe, expect, it } from "vitest";

describe("SpacetimeDB policy constraint module surface", () => {
  const source = moduleSource;

  it("declares a public policy constraint table", () => {
    const lib = source();

    expect(lib).toContain("#[table(name = policy_constraints, public)]");
    expect(lib).toContain("pub struct PolicyConstraint");
    expect(lib).toContain("pub permission_key: String");
    expect(lib).toContain("pub constraint_type: String");
    expect(lib).toContain("pub constraint_json: String");
  });

  it("declares reducers for policy constraint upsert and removal", () => {
    const lib = source();

    expect(lib).toContain("pub fn upsert_policy_constraint");
    expect(lib).toContain("pub fn remove_policy_constraint");
    expect(lib).toContain("validate_policy_constraint_type(&constraint_type)?");
  });
});
