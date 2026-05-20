import { type PluginManifest, type PluginManifestSchemaDeclaration } from "./plugins.js";
import { type SimpleJsonSchema } from "./plugin-data.js";

export type LegacySqlColumnType = "string" | "number" | "boolean";

export interface LegacySqlColumn {
  name: string;
  sqlType: string;
  schemaType: LegacySqlColumnType;
  required: boolean;
  primaryKey: boolean;
}

export interface LegacySqlIndex {
  name: string;
  columns: string[];
  unique: boolean;
}

export interface LegacySqlForeignKey {
  name: string;
  columns: string[];
  referencedTable: string;
  referencedColumns: string[];
  onDelete?: string;
  onUpdate?: string;
}

export interface LegacySqlTable {
  name: string;
  columns: LegacySqlColumn[];
  primaryKeys: string[];
  indexes: LegacySqlIndex[];
  foreignKeys: LegacySqlForeignKey[];
  migrationPlan: unknown[];
}

export interface LegacySqlImportManifest {
  pluginId: string;
  resourceName: string;
  sqlFiles: string[];
  tables: LegacySqlTable[];
  schemas: PluginManifestSchemaDeclaration[];
  unsupportedStatements: string[];
}

export interface BuildLegacySqlImportInput {
  pluginId: string;
  resourceName: string;
  sqlFiles: Array<{ path: string; sql: string }>;
}

const blockedStatementPrefixes = [
  "drop table",
  "create trigger",
  "create procedure",
  "create function",
  "truncate",
  "rename table"
];

export function buildLegacySqlImportManifest(input: BuildLegacySqlImportInput): LegacySqlImportManifest {
  if (!input.pluginId || !input.resourceName) {
    throw new Error("Legacy SQL import requires pluginId and resourceName");
  }

  const tablesByName = new Map<string, LegacySqlTable>();
  const unsupportedStatements: string[] = [];

  for (const file of input.sqlFiles) {
    for (const statement of splitSqlStatements(file.sql)) {
      const normalized = normalizeSql(statement);
      if (!normalized) {
        continue;
      }
      if (blockedStatementPrefixes.some((prefix) => normalized.startsWith(prefix))) {
        unsupportedStatements.push(statement.trim());
        continue;
      }
      if (normalized.startsWith("alter table")) {
        const applied = applyAlterTable(statement, tablesByName);
        if (!applied) {
          unsupportedStatements.push(statement.trim());
        }
        continue;
      }
      if (!normalized.startsWith("create table")) {
        continue;
      }

      const table = parseCreateTable(statement);
      tablesByName.set(table.name, table);
    }
  }

  const tables = [...tablesByName.values()];
  return {
    pluginId: input.pluginId,
    resourceName: input.resourceName,
    sqlFiles: input.sqlFiles.map((file) => file.path),
    tables,
    schemas: tables.map((table) => tableToSchema(table)),
    unsupportedStatements
  };
}

export function legacySqlImportToPluginManifest(input: {
  pluginId: string;
  name: string;
  version: string;
  resourceName: string;
  sqlFiles: Array<{ path: string; sql: string }>;
}): PluginManifest {
  const importManifest = buildLegacySqlImportManifest({
    pluginId: input.pluginId,
    resourceName: input.resourceName,
    sqlFiles: input.sqlFiles
  });

  if (importManifest.unsupportedStatements.length > 0) {
    throw new Error(`Unsupported SQL statements in ${input.resourceName}: ${importManifest.unsupportedStatements.length}`);
  }

  return {
    pluginId: input.pluginId,
    name: input.name,
    version: input.version,
    schemas: importManifest.schemas
  };
}

function tableToSchema(table: LegacySqlTable): PluginManifestSchemaDeclaration {
  const properties: Record<string, SimpleJsonSchema> = {};
  const required: string[] = [];

  for (const column of table.columns) {
    properties[column.name] = { type: column.schemaType };
    if (column.required || column.primaryKey) {
      required.push(column.name);
    }
  }

  return {
    entityType: sqlEntityType(table.name),
    schemaVersion: 1,
    schema: {
      type: "object",
      required,
      properties
    },
    migrationPlan: [
      {
        step: "create_json_entity_type",
        entityType: sqlEntityType(table.name),
        sourceTable: table.name,
        primaryKeys: table.primaryKeys,
        indexes: table.indexes,
        foreignKeys: table.foreignKeys
      },
      ...table.migrationPlan
    ],
    approved: true
  };
}

function parseCreateTable(statement: string): LegacySqlTable {
  const match = statement.match(/create\s+table\s+(?:if\s+not\s+exists\s+)?`?([a-zA-Z0-9_]+)`?\s*\(([\s\S]*)\)\s*(?:engine|default|charset|collate|auto_increment|row_format|comment|;|$)/i);
  if (!match) {
    throw new Error(`Unsupported CREATE TABLE statement: ${statement.trim().slice(0, 80)}`);
  }

  const tableName = match[1];
  const body = match[2];
  const columns: LegacySqlColumn[] = [];
  const indexes: LegacySqlIndex[] = [];
  const foreignKeys: LegacySqlForeignKey[] = [];
  const tablePrimaryKeys = new Set<string>();

  for (const part of splitSqlList(body)) {
    const trimmed = part.trim();
    const primaryKeyMatch = trimmed.match(/^primary\s+key\s*\(([^)]+)\)/i);
    if (primaryKeyMatch) {
      for (const key of primaryKeyMatch[1].split(",")) {
        tablePrimaryKeys.add(cleanIdentifier(key));
      }
      continue;
    }
    const index = parseIndexDefinition(trimmed);
    if (index) {
      indexes.push(index);
      continue;
    }
    const foreignKey = parseForeignKeyDefinition(trimmed);
    if (foreignKey) {
      foreignKeys.push(foreignKey);
      continue;
    }
    if (/^(constraint)\b/i.test(trimmed)) {
      continue;
    }

    const column = parseColumnDefinition(trimmed);
    if (!column) {
      continue;
    }

    if (column.primaryKey) {
      tablePrimaryKeys.add(column.name);
    }
    columns.push(column);
  }

  const primaryKeys = [...tablePrimaryKeys];
  return {
    name: tableName,
    columns: columns.map((column) => ({
      ...column,
      primaryKey: column.primaryKey || tablePrimaryKeys.has(column.name)
    })),
    primaryKeys,
    indexes,
    foreignKeys,
    migrationPlan: []
  };
}

function applyAlterTable(statement: string, tablesByName: Map<string, LegacySqlTable>): boolean {
  const addColumnMatch = statement.match(/^alter\s+table\s+`?([a-zA-Z0-9_]+)`?\s+add\s+column\s+([\s\S]+)$/i);
  if (addColumnMatch) {
    const table = tablesByName.get(addColumnMatch[1]);
    const column = table ? parseColumnDefinition(addColumnMatch[2]) : undefined;
    if (!table || !column) {
      return false;
    }
    if (!table.columns.some((existing) => existing.name === column.name)) {
      table.columns.push(column);
      table.migrationPlan.push({
        step: column.required || column.primaryKey ? "add_required_property" : "add_optional_property",
        entityType: sqlEntityType(table.name),
        sourceTable: table.name,
        property: column.name,
        schema: { type: column.schemaType },
        column
      });
    }
    return true;
  }

  const addIndexMatch = statement.match(/^alter\s+table\s+`?([a-zA-Z0-9_]+)`?\s+add\s+(.+)$/i);
  if (addIndexMatch) {
    const table = tablesByName.get(addIndexMatch[1]);
    const index = table ? parseIndexDefinition(addIndexMatch[2]) : undefined;
    if (!table || !index) {
      return false;
    }
    table.indexes.push(index);
    table.migrationPlan.push({
      step: "record_sql_index",
      entityType: sqlEntityType(table.name),
      sourceTable: table.name,
      index
    });
    return true;
  }

  const addConstraintMatch = statement.match(/^alter\s+table\s+`?([a-zA-Z0-9_]+)`?\s+add\s+([\s\S]+)$/i);
  if (addConstraintMatch) {
    const table = tablesByName.get(addConstraintMatch[1]);
    const foreignKey = table ? parseForeignKeyDefinition(addConstraintMatch[2]) : undefined;
    if (!table || !foreignKey) {
      return false;
    }
    table.foreignKeys.push(foreignKey);
    table.migrationPlan.push({
      step: "record_sql_foreign_key",
      entityType: sqlEntityType(table.name),
      sourceTable: table.name,
      foreignKey
    });
    return true;
  }

  return false;
}

function parseColumnDefinition(definition: string): LegacySqlColumn | undefined {
  const columnMatch = definition.trim().match(/^`?([a-zA-Z0-9_]+)`?\s+([a-zA-Z0-9()]+)/i);
  if (!columnMatch) {
    return undefined;
  }

  const sqlType = columnMatch[2].toLowerCase();
  return {
    name: columnMatch[1],
    sqlType,
    schemaType: sqlTypeToSchemaType(sqlType),
    required: /\bnot\s+null\b/i.test(definition),
    primaryKey: /\bprimary\s+key\b/i.test(definition)
  };
}

function parseIndexDefinition(definition: string): LegacySqlIndex | undefined {
  const match = definition.trim().match(/^(unique\s+)?(?:index|key)\s+`?([a-zA-Z0-9_]+)`?\s*\(([^)]+)\)/i);
  if (!match) {
    return undefined;
  }

  return {
    name: match[2],
    columns: splitIdentifierList(match[3]),
    unique: Boolean(match[1])
  };
}

function parseForeignKeyDefinition(definition: string): LegacySqlForeignKey | undefined {
  const match = definition
    .trim()
    .match(/^(?:constraint\s+`?([a-zA-Z0-9_]+)`?\s+)?foreign\s+key\s*\(([^)]+)\)\s+references\s+`?([a-zA-Z0-9_]+)`?\s*\(([^)]+)\)(?:\s+on\s+delete\s+([a-z\s]+?))?(?:\s+on\s+update\s+([a-z\s]+?))?$/i);
  if (!match) {
    return undefined;
  }

  return {
    name: match[1] ?? "",
    columns: splitIdentifierList(match[2]),
    referencedTable: match[3],
    referencedColumns: splitIdentifierList(match[4]),
    onDelete: match[5]?.trim().toLowerCase(),
    onUpdate: match[6]?.trim().toLowerCase()
  };
}

function sqlTypeToSchemaType(sqlType: string): LegacySqlColumnType {
  if (/^(tinyint\(1\)|bool|boolean)/i.test(sqlType)) {
    return "boolean";
  }
  if (/^(int|integer|bigint|smallint|mediumint|tinyint|decimal|numeric|float|double)/i.test(sqlType)) {
    return "number";
  }
  return "string";
}

function splitSqlStatements(sql: string): string[] {
  return sql
    .replace(/--.*$/gm, "")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

function splitSqlList(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < body.length; index += 1) {
    const char = body[index];
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === "," && depth === 0) {
      parts.push(body.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(body.slice(start));
  return parts;
}

function normalizeSql(statement: string): string {
  return statement.trim().replace(/\s+/g, " ").toLowerCase();
}

function cleanIdentifier(value: string): string {
  return value.trim().replace(/`/g, "");
}

function splitIdentifierList(value: string): string[] {
  return value.split(",").map(cleanIdentifier).filter(Boolean);
}

function sqlEntityType(tableName: string): string {
  return `sql_${tableName}`;
}
