import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { DbConnection, reducers, tables } from "../src/spacetime/module_bindings/index.js";

const require = createRequire(import.meta.url);

function rustModule(): string {
  return readFileSync("spacetimedb/src/lib.rs", "utf8");
}

function camelCase(value: string): string {
  return value.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

describe("checked-in SpacetimeDB TypeScript bindings", () => {
  it("exports table refs for every public table in the Rust module", () => {
    const tableNames = [...rustModule().matchAll(/#\[table\(name = ([a-z_]+), public\)\]/g)].map(
      (match) => match[1]
    );

    expect(Object.keys(tables).sort()).toEqual(tableNames.sort());
  });

  it("exports reducer names for every reducer in the Rust module", () => {
    const expected = [...rustModule().matchAll(/pub fn ([a-z_]+)\(/g)]
      .map((match) => match[1])
      .filter((name) => !["transaction_exists", "inventory_stack_id", "grade_exists"].includes(name))
      .map(camelCase)
      .sort();

    expect(Object.keys(reducers).sort()).toEqual(expected);
  });

  it("provides an official generated DbConnection builder", () => {
    expect(typeof DbConnection.builder).toBe("function");
    expect(() => DbConnection.builder().build()).toThrow(/URI is required/);
  });

  it("documents a repeatable command for regenerating official bindings", () => {
    const packageJson = require("../package.json") as { scripts: Record<string, string> };
    const generator = readFileSync("scripts/generate-spacetime-bindings.mjs", "utf8");
    const provenance = JSON.parse(
      readFileSync("src/spacetime/module_bindings/provenance.json", "utf8")
    ) as {
      status: string;
      generator: string;
      command: string;
      modulePath: string;
      outDir: string;
    };

    expect(packageJson.scripts["generate:spacetime-bindings"]).toBe(
      "node scripts/generate-spacetime-bindings.mjs"
    );
    expect(generator).toContain("spacetime generate --lang typescript");
    expect(generator).toContain("--module-path spacetimedb");
    expect(generator).toContain("--out-dir src/spacetime/module_bindings");
    expect(generator).toContain("scripts/normalize-spacetime-bindings.mjs");
    expect(generator).toContain("provenance.json");
    expect(readFileSync("scripts/normalize-spacetime-bindings.mjs", "utf8")).toContain(
      'from "spacetimedb";'
    );
    expect(provenance.status).toMatch(/^(scaffold|official)$/);
    expect(provenance.generator).toBe("spacetime generate");
    expect(provenance.command).toBe(
      "spacetime generate --lang typescript --module-path spacetimedb --out-dir src/spacetime/module_bindings"
    );
    expect(provenance.modulePath).toBe("spacetimedb");
    expect(provenance.outDir).toBe("src/spacetime/module_bindings");
  });

  it("exposes a runnable binding currency verification command", () => {
    const packageJson = require("../package.json") as { scripts: Record<string, string> };
    const verifier = readFileSync("scripts/verify-spacetime-bindings.mjs", "utf8");
    const runbook = readFileSync("docs/production-runbook.md", "utf8");

    expect(packageJson.scripts["verify:spacetime-bindings"]).toBe(
      "node scripts/verify-spacetime-bindings.mjs"
    );
    expect(verifier).toContain("public SpacetimeDB tables");
    expect(verifier).toContain("SpacetimeDB reducers");
    expect(verifier).toContain("provenance.json");
    expect(verifier).toContain("Binding provenance");
    expect(runbook).toContain("npm run verify:spacetime-bindings");
    expect(runbook).toContain("src/spacetime/module_bindings/provenance.json");
  });
});
