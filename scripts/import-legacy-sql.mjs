import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { buildLegacySqlImportManifest } from "../dist/src/core/sql-compat.js";

const args = parseArgs(process.argv.slice(2));
const root = resolve(args.root ?? process.cwd());
const out = resolve(args.out ?? join(root, "spbox-sql-manifest.json"));
const resources = findResourceRoots(root);
const imports = resources
  .map((resourcePath) => {
    const sqlFiles = findSqlFiles(resourcePath).map((path) => ({
      path: relative(resourcePath, path),
      sql: readFileSync(path, "utf8")
    }));
    if (sqlFiles.length === 0) {
      return undefined;
    }

    const resourceName = basename(resourcePath);
    return buildLegacySqlImportManifest({
      pluginId: args.pluginId ?? resourceName,
      resourceName,
      sqlFiles
    });
  })
  .filter(Boolean);

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({
  generatedAt: new Date().toISOString(),
  root,
  imports
}, null, 2));

console.log(`Wrote ${imports.length} SQL import manifest(s) to ${out}`);
for (const entry of imports) {
  console.log(`- ${entry.resourceName}: ${entry.tables.length} table(s), ${entry.unsupportedStatements.length} unsupported statement(s)`);
}

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--root") {
      parsed.root = values[++index];
    } else if (value === "--out") {
      parsed.out = values[++index];
    } else if (value === "--plugin-id") {
      parsed.pluginId = values[++index];
    } else if (!value.startsWith("--") && !parsed.root) {
      parsed.root = value;
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }
  return parsed;
}

function findResourceRoots(directory) {
  const stat = statSync(directory);
  if (!stat.isDirectory()) {
    throw new Error(`SQL import root must be a directory: ${directory}`);
  }

  if (isResourceRoot(directory)) {
    return [directory];
  }

  const roots = [];
  for (const entry of readdirSync(directory)) {
    if (shouldSkip(entry)) {
      continue;
    }
    const fullPath = join(directory, entry);
    if (!statSync(fullPath).isDirectory()) {
      continue;
    }
    roots.push(...findResourceRoots(fullPath));
  }
  return roots;
}

function isResourceRoot(directory) {
  const entries = new Set(readdirSync(directory));
  return entries.has("fxmanifest.lua") || entries.has("__resource.lua");
}

function findSqlFiles(directory) {
  const found = [];
  for (const entry of readdirSync(directory)) {
    if (shouldSkip(entry)) {
      continue;
    }
    const fullPath = join(directory, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      found.push(...findSqlFiles(fullPath));
    } else if (entry.toLowerCase().endsWith(".sql")) {
      found.push(fullPath);
    }
  }
  return found;
}

function shouldSkip(entry) {
  return entry === ".git" || entry === "node_modules" || entry === "cache";
}
