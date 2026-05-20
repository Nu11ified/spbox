export type PluginEntityOwnerType = "character" | "business" | "server" | "plugin" | "resource";
export type JsonSchemaType = "object" | "string" | "number" | "boolean" | "array";

export interface SimpleJsonSchema {
  type: JsonSchemaType;
  enum?: Array<string | number | boolean>;
  required?: string[];
  properties?: Record<string, SimpleJsonSchema>;
  items?: SimpleJsonSchema;
}

export interface PluginSchemaRecord {
  pluginId: string;
  schemaVersion: number;
  entityType: string;
  schema: SimpleJsonSchema;
  status: "active";
  registeredAt: Date;
}

export interface RegisterPluginSchemaInput {
  pluginId: string;
  schemaVersion: number;
  entityType: string;
  schema: SimpleJsonSchema;
}

export interface PluginEntity {
  id: string;
  pluginId: string;
  entityType: string;
  ownerType: PluginEntityOwnerType;
  ownerId: string;
  data: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertPluginEntityInput {
  id?: string;
  pluginId: string;
  entityType: string;
  ownerType: PluginEntityOwnerType;
  ownerId: string;
  data: unknown;
}

export interface PluginDataStoreOptions {
  now?: () => Date;
  idFactory?: () => string;
}

export class PluginDataStore {
  private readonly schemasByKey = new Map<string, PluginSchemaRecord>();
  private readonly entitiesById = new Map<string, PluginEntity>();
  private readonly now: () => Date;
  private readonly idFactory: () => string;

  public constructor(options: PluginDataStoreOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.idFactory = options.idFactory ?? (() => crypto.randomUUID());
  }

  public registerSchema(input: RegisterPluginSchemaInput): PluginSchemaRecord {
    if (!input.pluginId || !input.entityType || input.schemaVersion < 1) {
      throw new Error("Plugin schema requires pluginId, entityType, and positive schemaVersion");
    }

    const record: PluginSchemaRecord = {
      ...input,
      schema: structuredClone(input.schema),
      status: "active",
      registeredAt: this.now()
    };
    this.schemasByKey.set(this.schemaKey(input.pluginId, input.entityType), record);
    return this.cloneSchema(record);
  }

  public upsertEntity(input: UpsertPluginEntityInput): PluginEntity {
    const schema = this.schemasByKey.get(this.schemaKey(input.pluginId, input.entityType));
    if (!schema) {
      throw new Error(`No schema registered for ${input.pluginId}:${input.entityType}`);
    }

    validateSchema(schema.schema, input.data);

    const existing = input.id ? this.entitiesById.get(input.id) : undefined;
    if (existing && existing.pluginId !== input.pluginId) {
      throw new Error(`Entity ${input.id} belongs to plugin namespace ${existing.pluginId}`);
    }
    if (existing && existing.entityType !== input.entityType) {
      throw new Error(`Entity ${input.id} belongs to entity type ${existing.entityType}`);
    }

    const timestamp = this.now();
    const entity: PluginEntity = {
      id: existing?.id ?? input.id ?? this.idFactory(),
      pluginId: input.pluginId,
      entityType: input.entityType,
      ownerType: input.ownerType,
      ownerId: input.ownerId,
      data: structuredClone(input.data),
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp
    };

    this.entitiesById.set(entity.id, entity);
    return this.cloneEntity(entity);
  }

  public listEntities(pluginId: string, entityType?: string): PluginEntity[] {
    return [...this.entitiesById.values()]
      .filter((entity) => entity.pluginId === pluginId)
      .filter((entity) => entityType === undefined || entity.entityType === entityType)
      .map((entity) => this.cloneEntity(entity));
  }

  private schemaKey(pluginId: string, entityType: string): string {
    return `${pluginId}:${entityType}`;
  }

  private cloneSchema(record: PluginSchemaRecord): PluginSchemaRecord {
    return {
      ...record,
      schema: structuredClone(record.schema)
    };
  }

  private cloneEntity(entity: PluginEntity): PluginEntity {
    return {
      ...entity,
      data: structuredClone(entity.data)
    };
  }
}

export function validateSchema(schema: SimpleJsonSchema, value: unknown, path = ""): void {
  const label = path || "data";

  if (schema.type === "object") {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`Expected ${label} to be object`);
    }

    const record = value as Record<string, unknown>;
    for (const required of schema.required ?? []) {
      if (!(required in record)) {
        throw new Error(`Missing required field: ${required}`);
      }
    }

    for (const [key, childSchema] of Object.entries(schema.properties ?? {})) {
      if (key in record) {
        validateSchema(childSchema, record[key], path ? `${path}.${key}` : key);
      }
    }
    return;
  }

  if (schema.type === "array") {
    if (!Array.isArray(value)) {
      throw new Error(`Expected ${label} to be array`);
    }

    if (schema.items) {
      value.forEach((item, index) => validateSchema(schema.items as SimpleJsonSchema, item, `${label}[${index}]`));
    }
    return;
  }

  if (typeof value !== schema.type) {
    throw new Error(`Expected ${label} to be ${schema.type}`);
  }

  if (schema.enum !== undefined && !schema.enum.includes(value as string | number | boolean)) {
    throw new Error(`Expected ${label} to be one of ${schema.enum.join(", ")}`);
  }
}
