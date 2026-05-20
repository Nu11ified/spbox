import { readFileSync } from "node:fs";

const rustModule = readFileSync("spacetimedb/src/lib.rs", "utf8");
const bindingModule = readFileSync("src/spacetime/module_bindings/index.ts", "utf8");
const provenancePath = "src/spacetime/module_bindings/provenance.json";
const provenance = JSON.parse(readFileSync(provenancePath, "utf8"));
const expectedCommand = "spacetime generate --lang typescript --module-path spacetimedb --out-dir src/spacetime/module_bindings";

const ignoredPrivateHelpers = new Set([
  "transaction_exists",
  "inventory_stack_id",
  "grade_exists"
]);

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

function extractPublicTables(source) {
  return uniqueSorted(
    [...source.matchAll(/#\[table\(name = ([a-z_]+), public\)\]/g)].map((match) => match[1])
  );
}

function extractBoundTables(source) {
  return uniqueSorted(
    [...source.matchAll(/^\s+([a-z_]+): __table\(\{$/gm)].map((match) => match[1])
  );
}

function extractReducers(source) {
  return uniqueSorted(
    [...source.matchAll(/pub fn ([a-z_]+)\(/g)]
      .map((match) => match[1])
      .filter((name) => !ignoredPrivateHelpers.has(name))
  );
}

function extractBoundReducers(source) {
  return uniqueSorted([...source.matchAll(/__reducerSchema\("([a-z_]+)"/g)].map((match) => match[1]));
}

function diff(expected, actual) {
  return {
    missing: expected.filter((value) => !actual.includes(value)),
    extra: actual.filter((value) => !expected.includes(value))
  };
}

function assertMatches(label, expected, actual) {
  const result = diff(expected, actual);
  if (result.missing.length === 0 && result.extra.length === 0) {
    console.log(`Verified ${expected.length} ${label}.`);
    return true;
  }

  console.error(`Out-of-date ${label}.`);
  if (result.missing.length > 0) {
    console.error(`Missing from bindings: ${result.missing.join(", ")}`);
  }
  if (result.extra.length > 0) {
    console.error(`Extra in bindings: ${result.extra.join(", ")}`);
  }
  return false;
}

function assertProvenance() {
  const validStatuses = new Set(["scaffold", "official"]);
  const failures = [];

  if (!validStatuses.has(provenance.status)) {
    failures.push("status must be scaffold or official");
  }
  if (provenance.generator !== "spacetime generate") {
    failures.push("generator must be spacetime generate");
  }
  if (provenance.command !== expectedCommand) {
    failures.push(`command must be ${expectedCommand}`);
  }
  if (provenance.modulePath !== "spacetimedb") {
    failures.push("modulePath must be spacetimedb");
  }
  if (provenance.outDir !== "src/spacetime/module_bindings") {
    failures.push("outDir must be src/spacetime/module_bindings");
  }
  if (provenance.status === "official" && !provenance.generatedAt) {
    failures.push("official bindings require generatedAt");
  }

  if (failures.length > 0) {
    console.error(`Invalid binding provenance: ${provenancePath}`);
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    return false;
  }

  console.log(`Binding provenance: ${provenance.status}`);
  return true;
}

const publicTablesOk = assertMatches(
  "public SpacetimeDB tables",
  extractPublicTables(rustModule),
  extractBoundTables(bindingModule)
);
const reducersOk = assertMatches(
  "SpacetimeDB reducers",
  extractReducers(rustModule),
  extractBoundReducers(bindingModule)
);
const provenanceOk = assertProvenance();

if (!publicTablesOk || !reducersOk || !provenanceOk) {
  console.error("Run `npm run generate:spacetime-bindings` and review the generated binding scaffold.");
  process.exit(1);
}
