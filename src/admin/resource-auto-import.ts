import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import {
  buildServerCfgResourceImportPlan,
  type EnsuredResourceDefinition,
  type LegacyResourceImportPlan
} from "../core/index.js";
import { type AdminService } from "./service.js";

export interface ResourceAutoImportOptions {
  cfgPath: string;
  resourcesRoot: string;
  version?: string;
}

export interface ResourceAutoImportResult {
  cfgPath: string;
  resourcesRoot: string;
  ensuredResources: string[];
  imported: Array<{
    pluginId: string;
    resourceName: string;
    schemas: number;
    warnings: string[];
    enabled: boolean;
  }>;
  missingResources: string[];
  enableFailures: Array<{ pluginId: string; error: string }>;
}

export async function reconcileLegacyResourcesFromCfg(
  admin: AdminService,
  options: ResourceAutoImportOptions
): Promise<ResourceAutoImportResult> {
  const cfgPath = resolve(options.cfgPath);
  const resourcesRoot = resolve(options.resourcesRoot);
  const cfg = readFileSync(cfgPath, "utf8");
  const plan = buildServerCfgResourceImportPlan({
    cfg,
    resources: findResourceDefinitions(resourcesRoot, options.version)
  });

  for (const entry of plan.imports) {
    admin.installPluginPackage(entry.package);
  }
  await admin.flushWrites();

  const enableFailures: Array<{ pluginId: string; error: string }> = [];
  const enabledPluginIds = new Set<string>();
  for (const entry of plan.imports) {
    try {
      admin.enablePlugin(entry.pluginId);
      enabledPluginIds.add(entry.pluginId);
    } catch (error) {
      enableFailures.push({
        pluginId: entry.pluginId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  await admin.flushWrites();

  return {
    cfgPath,
    resourcesRoot,
    ensuredResources: plan.ensuredResources,
    imported: plan.imports.map((entry) => importSummary(entry, enabledPluginIds.has(entry.pluginId))),
    missingResources: plan.missingResources,
    enableFailures
  };
}

function importSummary(entry: LegacyResourceImportPlan, enabled: boolean): ResourceAutoImportResult["imported"][number] {
  return {
    pluginId: entry.pluginId,
    resourceName: entry.resourceName,
    schemas: entry.manifest.schemas?.length ?? 0,
    warnings: entry.warnings,
    enabled
  };
}

function findResourceDefinitions(resourcesRoot: string, version?: string): EnsuredResourceDefinition[] {
  return findResourceRoots(resourcesRoot).map((resourcePath) => ({
    resourceName: basename(resourcePath),
    version,
    packageSource: `local:${resourcePath}`,
    files: readImportFiles(resourcePath)
  }));
}

function findResourceRoots(directory: string): string[] {
  if (!statSync(directory).isDirectory()) {
    throw new Error(`Resource root must be a directory: ${directory}`);
  }

  if (isResourceRoot(directory)) {
    return [directory];
  }

  const roots: string[] = [];
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

function readImportFiles(resourcePath: string): Array<{ path: string; content: string }> {
  return findImportFiles(resourcePath).map((path) => ({
    path: relative(resourcePath, path),
    content: readFileSync(path, "utf8")
  }));
}

function findImportFiles(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory)) {
    if (shouldSkip(entry)) {
      continue;
    }
    const fullPath = join(directory, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      found.push(...findImportFiles(fullPath));
    } else if (isImportFile(entry)) {
      found.push(fullPath);
    }
  }
  return found;
}

function isResourceRoot(directory: string): boolean {
  const entries = new Set(readdirSync(directory));
  return entries.has("fxmanifest.lua") || entries.has("__resource.lua");
}

function isImportFile(entry: string): boolean {
  return /(^fxmanifest|^__resource|\.lua$|\.sql$)/i.test(entry);
}

function shouldSkip(entry: string): boolean {
  return entry === ".git" || entry === "node_modules" || entry === "cache";
}
