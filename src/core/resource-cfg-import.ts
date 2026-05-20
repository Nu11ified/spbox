import {
  buildLegacyResourceImportPlan,
  type LegacyResourceFile,
  type LegacyResourceImportPlan
} from "./legacy-resource-import.js";

export interface EnsuredResourceDefinition {
  resourceName: string;
  files: LegacyResourceFile[];
  version?: string;
  packageSource?: string;
}

export interface ServerCfgResourceImportPlan {
  ensuredResources: string[];
  imports: LegacyResourceImportPlan[];
  missingResources: string[];
}

export function parseEnsuredResourcesFromCfg(cfg: string): string[] {
  const resources: string[] = [];
  const seen = new Set<string>();

  for (const line of cfg.split(/\r?\n/)) {
    const stripped = line.replace(/#.*/, "").replace(/\/\/.*/, "").trim();
    const match = stripped.match(/^(?:ensure|start)\s+(.+)$/i);
    if (!match) {
      continue;
    }

    const resourceName = cleanCfgToken(match[1]);
    if (!resourceName || resourceName.startsWith("[") || seen.has(resourceName)) {
      continue;
    }

    seen.add(resourceName);
    resources.push(resourceName);
  }

  return resources;
}

export function buildServerCfgResourceImportPlan(input: {
  cfg: string;
  resources: EnsuredResourceDefinition[];
}): ServerCfgResourceImportPlan {
  const resourcesByName = new Map(input.resources.map((resource) => [resource.resourceName, resource]));
  const ensuredResources = parseEnsuredResourcesFromCfg(input.cfg);
  const imports: LegacyResourceImportPlan[] = [];
  const missingResources: string[] = [];

  for (const resourceName of ensuredResources) {
    const resource = resourcesByName.get(resourceName);
    if (!resource) {
      missingResources.push(resourceName);
      continue;
    }

    imports.push(buildLegacyResourceImportPlan(resource));
  }

  return {
    ensuredResources,
    imports,
    missingResources
  };
}

function cleanCfgToken(value: string): string {
  const trimmed = value.trim();
  const quoted = trimmed.match(/^["']([^"']+)["']/);
  if (quoted) {
    return quoted[1].trim();
  }

  return trimmed.split(/\s+/)[0]?.trim() ?? "";
}
