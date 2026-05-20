import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = "src/spacetime/module_bindings";

function files(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

function normalizeImportSpecifiers(source) {
  return source.replace(/from (["'])(\.\.?\/[^"']+)\1/g, (match, quote, specifier) => {
    if (specifier.endsWith(".js") || specifier.endsWith(".json")) {
      return match;
    }
    return `from ${quote}${specifier}.js${quote}`;
  });
}

for (const file of files(root)) {
  if (!file.endsWith(".ts")) {
    continue;
  }

  const source = readFileSync(file, "utf8");
  const normalized = normalizeImportSpecifiers(source)
    .replace(/from "spacetimedb\/sdk";/g, 'from "spacetimedb";')
    .replace(/from 'spacetimedb\/sdk';/g, "from 'spacetimedb';");

  if (normalized !== source) {
    writeFileSync(file, normalized);
  }
}

console.log("Normalized generated SpacetimeDB bindings for NodeNext TypeScript.");
