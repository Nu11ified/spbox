import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { buildLegacyResourceImportPlan } from "../dist/src/core/legacy-resource-import.js";

const args = parseArgs(process.argv.slice(2));
const root = resolve(args.root ?? process.cwd());
const out = resolve(args.out ?? join(root, "spbox-plugin-import.json"));
const resources = findResourceRoots(root);
const imports = resources.map((resourcePath) =>
  buildLegacyResourceImportPlan({
    resourceName: basename(resourcePath),
    version: args.version,
    packageSource: args.source,
    files: readResourceFiles(resourcePath)
  })
);

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({
  generatedAt: new Date().toISOString(),
  root,
  imports
}, null, 2));

console.log(`Wrote ${imports.length} legacy resource import plan(s) to ${out}`);
for (const entry of imports) {
  const schemaCount = entry.manifest.schemas?.length ?? 0;
  console.log(`- ${entry.resourceName}: ${schemaCount} schema(s), ${entry.warnings.length} warning(s)`);
}

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--root") {
      parsed.root = values[++index];
    } else if (value === "--out") {
      parsed.out = values[++index];
    } else if (value === "--version") {
      parsed.version = values[++index];
    } else if (value === "--source") {
      parsed.source = values[++index];
    } else if (!value.startsWith("--") && !parsed.root) {
      parsed.root = value;
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }
  return parsed;
}

function findResourceRoots(directory) {
  if (!statSync(directory).isDirectory()) {
    throw new Error(`Legacy resource import root must be a directory: ${directory}`);
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
    if (statSync(fullPath).isDirectory()) {
      roots.push(...findResourceRoots(fullPath));
    }
  }
  return roots;
}

function readResourceFiles(resourcePath) {
  return findFiles(resourcePath).map((path) => ({
    path: relative(resourcePath, path),
    content: readFileSync(path, "utf8")
  }));
}

function findFiles(directory) {
  const found = [];
  for (const entry of readdirSync(directory)) {
    if (shouldSkip(entry)) {
      continue;
    }
    const fullPath = join(directory, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      found.push(...findFiles(fullPath));
    } else {
      found.push(fullPath);
    }
  }
  return found;
}

function isResourceRoot(directory) {
  const entries = new Set(readdirSync(directory));
  return entries.has("fxmanifest.lua") || entries.has("__resource.lua");
}

function shouldSkip(entry) {
  return entry === ".git" || entry === "node_modules" || entry === "cache";
}
