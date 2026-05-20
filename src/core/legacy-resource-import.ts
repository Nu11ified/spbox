import { buildLegacySqlImportManifest, type LegacySqlImportManifest } from "./sql-compat.js";
import { hashPluginManifest, type PluginManifest } from "./plugins.js";

export interface LegacyResourceFile {
  path: string;
  content: string;
}

export interface LegacyResourceImportInput {
  resourceName: string;
  version?: string;
  files: LegacyResourceFile[];
  packageSource?: string;
}

export interface LegacyResourceImportPlan {
  resourceName: string;
  pluginId: string;
  manifest: PluginManifest;
  sqlImport?: LegacySqlImportManifest;
  package: {
    packageId: string;
    pluginId: string;
    version: string;
    source: string;
    publisher: string;
    trustLevel: "local";
    signerId: string;
    signature: string;
    manifestHash: string;
    manifest: PluginManifest;
  };
  installSteps: string[];
  warnings: string[];
}

const compatibilityProviders = new Set(["qb-core", "qbx_core", "oxmysql", "qb-inventory", "menuv"]);

export function buildLegacyResourceImportPlan(input: LegacyResourceImportInput): LegacyResourceImportPlan {
  const resourceName = normalizeResourceName(input.resourceName);
  const pluginId = resourceName;
  const version = input.version ?? "0.0.0-legacy";
  const fxmanifest = findManifest(input.files);
  const sqlFiles = input.files.filter((file) => file.path.toLowerCase().endsWith(".sql"));
  const sqlImport = sqlFiles.length > 0
    ? buildLegacySqlImportManifest({ pluginId, resourceName, sqlFiles: sqlFiles.map((file) => ({ path: file.path, sql: file.content })) })
    : undefined;

  const manifest: PluginManifest = {
    pluginId,
    name: resourceName,
    version,
    fivem: {
      dependencies: fxmanifest.dependencies,
      files: fxmanifest.files,
      nuiPage: fxmanifest.nuiPage,
      provides: fxmanifest.provides
    },
    schemas: sqlImport?.schemas
  };

  const warnings = [
    ...sqlImport?.unsupportedStatements.map((statement) => `Unsupported SQL statement: ${statement.slice(0, 120)}`) ?? [],
    ...fxmanifest.dependencies
      .filter((dependency) => compatibilityProviders.has(dependency))
      .map((dependency) => `Dependency ${dependency} is expected to be satisfied by an SPBox compatibility facade`)
  ];
  const manifestHash = hashPluginManifest(manifest);

  return {
    resourceName,
    pluginId,
    manifest,
    sqlImport,
    package: {
      packageId: `legacy:${pluginId}`,
      pluginId,
      version,
      source: input.packageSource ?? `local:${resourceName}`,
      publisher: "legacy-resource-importer",
      trustLevel: "local",
      signerId: "local-legacy-importer",
      signature: `local:${pluginId}:${version}`,
      manifestHash,
      manifest
    },
    installSteps: [
      `copy_resource:${resourceName}`,
      `install_plugin:${pluginId}`,
      `register_schemas:${sqlImport?.schemas.length ?? 0}`,
      `enable_plugin:${pluginId}`,
      `ensure_resource:${resourceName}`
    ],
    warnings
  };
}

function findManifest(files: LegacyResourceFile[]): {
  dependencies: string[];
  files: string[];
  nuiPage?: string;
  provides: string[];
} {
  const manifest = files.find((file) => /(^|\/)(fxmanifest|__resource)\.lua$/i.test(file.path));
  if (!manifest) {
    return { dependencies: [], files: files.map((file) => file.path), provides: [] };
  }

  return {
    dependencies: parseLuaStringList(manifest.content, "dependency", "dependencies"),
    files: [
      ...parseLuaStringList(manifest.content, "file", "files"),
      ...parseLuaStringList(manifest.content, "client_script", "client_scripts"),
      ...parseLuaStringList(manifest.content, "server_script", "server_scripts"),
      ...parseLuaStringList(manifest.content, "shared_script", "shared_scripts")
    ],
    nuiPage: parseLuaStringValue(manifest.content, "ui_page"),
    provides: parseLuaStringList(manifest.content, "provide", "provides")
  };
}

function parseLuaStringList(content: string, singleName: string, listName: string): string[] {
  const values = new Set<string>();
  const single = new RegExp(`${singleName}\\s+['"]([^'"]+)['"]`, "gi");
  for (const match of content.matchAll(single)) {
    values.add(match[1]);
  }

  const list = new RegExp(`${listName}\\s*\\{([\\s\\S]*?)\\}`, "gi");
  for (const match of content.matchAll(list)) {
    for (const value of match[1].matchAll(/['"]([^'"]+)['"]/g)) {
      values.add(value[1]);
    }
  }

  return [...values].sort();
}

function parseLuaStringValue(content: string, name: string): string | undefined {
  return content.match(new RegExp(`${name}\\s+['"]([^'"]+)['"]`, "i"))?.[1];
}

function normalizeResourceName(resourceName: string): string {
  const trimmed = resourceName.trim();
  if (!trimmed) {
    throw new Error("Legacy resource import requires resourceName");
  }
  return trimmed;
}
