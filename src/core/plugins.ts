import { createHash, createHmac } from "node:crypto";
import {
  type ItemDefinition,
  type JobDefinition,
  type LocationDefinition,
  type VehicleDefinition
} from "./gameplay.js";
import { type AuditLogEntry } from "./audit.js";
import { validateSchema, type SimpleJsonSchema } from "./plugin-data.js";

export type PluginStatus = "installed" | "active" | "disabled" | "failed";
export type PluginPackageTrustLevel = "marketplace" | "community" | "local";

export interface PluginManifestPermission {
  key: string;
  description: string;
}

export interface PluginManifestMenu {
  id: string;
  label: string;
  parentId?: string;
  icon?: string;
  order?: number;
  permission?: string;
  action: string;
}

export interface PluginManifestCommand {
  id: string;
  name: string;
  aliases?: string[];
  action: string;
  permission?: string;
  payloadSchema?: unknown;
  auditLevel?: "none" | "standard" | "high";
}

export interface PluginManifestPanel {
  id: string;
  title: string;
  route: string;
  requiredPermission?: string;
  icon?: string;
  order?: number;
}

export interface PluginManifestFivemActionMapping {
  name: string;
  action: string;
  permission?: string;
}

export interface PluginManifestFivemCompatibility {
  dependencies?: string[];
  files?: string[];
  nuiPage?: string;
  provides?: string[];
  exports?: PluginManifestFivemActionMapping[];
  serverCommands?: PluginManifestFivemActionMapping[];
}

export interface PluginManifestSchemaDeclaration {
  entityType: string;
  schemaVersion: number;
  schema: SimpleJsonSchema;
  migrationPlan?: unknown[];
  approved?: boolean;
}

export interface PluginManifestHook {
  hookName: string;
  capability: string;
  handlerType?: "action" | "reducer" | "sidecar";
  handlerRef: string;
  priority?: number;
}

export interface PluginManifest {
  pluginId: string;
  name: string;
  version: string;
  permissions?: PluginManifestPermission[];
  menus?: PluginManifestMenu[];
  commands?: PluginManifestCommand[];
  panels?: PluginManifestPanel[];
  configSchema?: Record<string, unknown>;
  hooks?: PluginManifestHook[];
  requiredPlugins?: string[];
  providedCapabilities?: string[];
  requiredCapabilities?: string[];
  fivem?: PluginManifestFivemCompatibility;
  schemas?: PluginManifestSchemaDeclaration[];
  items?: Array<Omit<ItemDefinition, "pluginId">>;
  jobs?: Array<Omit<JobDefinition, "pluginId">>;
  vehicles?: Array<Omit<VehicleDefinition, "pluginId">>;
  locations?: Array<Omit<LocationDefinition, "pluginId">>;
}

export interface PluginRecord {
  id: string;
  name: string;
  version: string;
  status: PluginStatus;
  installedAt: Date;
  updatedAt: Date;
}

export interface PluginPackageInstallInput {
  packageId: string;
  pluginId: string;
  version: string;
  source: string;
  publisher: string;
  trustLevel: PluginPackageTrustLevel;
  signerId: string;
  signature: string;
  manifestHash: string;
  manifest: PluginManifest;
}

export interface PluginPackageRecord {
  packageId: string;
  pluginId: string;
  version: string;
  source: string;
  publisher: string;
  trustLevel: PluginPackageTrustLevel;
  signerId: string;
  signature: string;
  manifestHash: string;
  installedAt: Date;
  updatedAt: Date;
}

export interface RegisteredPermission {
  key: string;
  description: string;
  pluginId: string;
}

export interface RegisteredMenu {
  id: string;
  pluginId: string;
  label: string;
  parentId?: string;
  icon?: string;
  order?: number;
  requiredPermission?: string;
  actionId: string;
  enabled: boolean;
}

export interface RegisteredCommand {
  id: string;
  pluginId: string;
  name: string;
  aliases?: string[];
  actionId: string;
  requiredPermission?: string;
  payloadSchema?: unknown;
  auditLevel: "none" | "standard" | "high";
  enabled: boolean;
}

export interface RegisteredPanel {
  id: string;
  pluginId: string;
  title: string;
  route: string;
  requiredPermission?: string;
  icon?: string;
  order?: number;
  enabled: boolean;
}

export interface RegisteredFivemActionMapping {
  name: string;
  actionId: string;
  requiredPermission?: string;
}

export interface RegisteredFivemCompatibility {
  pluginId: string;
  dependencies: string[];
  files: string[];
  nuiPage?: string;
  provides: string[];
  exports: RegisteredFivemActionMapping[];
  serverCommands: RegisteredFivemActionMapping[];
  enabled: boolean;
}

export interface ApprovedPluginSchemaDeclaration {
  pluginId: string;
  entityType: string;
  schemaVersion: number;
  schema: SimpleJsonSchema;
  migrationPlan: unknown[];
  status: "approved";
}

export interface PluginRegistryOptions {
  now?: () => Date;
  packageSigners?: PluginPackageSigner[];
}

export interface PluginPackageSigner {
  id: string;
  secret: string;
}

export interface ActiveGameplayPrimitives {
  items: ItemDefinition[];
  jobs: JobDefinition[];
  vehicles: VehicleDefinition[];
  locations: LocationDefinition[];
}

export interface RegisteredHook {
  id: string;
  pluginId: string;
  hookName: string;
  capability: string;
  handlerType: "action" | "reducer" | "sidecar";
  handlerRef: string;
  priority: number;
  enabled: boolean;
}

export interface RegisteredConfigSchema {
  pluginId: string;
  key: string;
  schema: Record<string, unknown>;
  defaultValue?: unknown;
}

export class PluginRegistry {
  private readonly manifestsByPluginId = new Map<string, PluginManifest>();
  private readonly pluginsById = new Map<string, PluginRecord>();
  private readonly packagesById = new Map<string, PluginPackageRecord>();
  private readonly packageSignersById: Map<string, PluginPackageSigner>;
  private readonly revokedPackageSignerIds = new Set<string>();
  private readonly auditEvents: AuditLogEntry[] = [];
  private readonly now: () => Date;

  public constructor(options: PluginRegistryOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.packageSignersById = new Map((options.packageSigners ?? []).map((signer) => [signer.id, signer]));
  }

  public install(manifest: PluginManifest): PluginRecord {
    this.validateManifest(manifest);

    const existing = this.pluginsById.get(manifest.pluginId);
    const timestamp = this.now();
    const record: PluginRecord = {
      id: manifest.pluginId,
      name: manifest.name,
      version: manifest.version,
      status: existing?.status ?? "installed",
      installedAt: existing?.installedAt ?? timestamp,
      updatedAt: timestamp
    };

    this.manifestsByPluginId.set(manifest.pluginId, structuredClone(manifest));
    this.pluginsById.set(manifest.pluginId, record);
    this.audit("plugin.install", manifest.pluginId, {
      name: manifest.name,
      version: manifest.version
    });
    return { ...record };
  }

  public installPackage(input: PluginPackageInstallInput): PluginRecord {
    this.validatePackage(input);

    const record = this.install(input.manifest);
    const timestamp = this.now();
    const existing = this.packagesById.get(input.packageId);
    const packageRecord: PluginPackageRecord = {
      packageId: input.packageId,
      pluginId: input.pluginId,
      version: input.version,
      source: input.source,
      publisher: input.publisher,
      trustLevel: input.trustLevel,
      signerId: input.signerId,
      signature: input.signature,
      manifestHash: input.manifestHash,
      installedAt: existing?.installedAt ?? timestamp,
      updatedAt: timestamp
    };

    this.packagesById.set(input.packageId, packageRecord);
    this.audit("plugin.package_install", input.pluginId, {
      packageId: input.packageId,
      source: input.source,
      publisher: input.publisher,
      trustLevel: input.trustLevel,
      manifestHash: input.manifestHash
    });
    return record;
  }

  public enable(pluginId: string): PluginRecord {
    validatePluginLifecycleId(pluginId);
    this.assertPackageSignerTrusted(pluginId);
    this.assertDependencies(pluginId);
    return this.setStatus(pluginId, "active");
  }

  public disable(pluginId: string): PluginRecord {
    validatePluginLifecycleId(pluginId);
    const disabled = this.setStatus(pluginId, "disabled");
    this.disableDependents(pluginId);
    return disabled;
  }

  public uninstall(pluginId: string): void {
    validatePluginLifecycleId(pluginId);
    if (!this.pluginsById.has(pluginId)) {
      throw new Error(`Unknown plugin: ${pluginId}`);
    }

    const removedCapabilities = this.manifestsByPluginId.get(pluginId)?.providedCapabilities ?? [];
    this.pluginsById.delete(pluginId);
    this.manifestsByPluginId.delete(pluginId);
    for (const [packageId, packageRecord] of this.packagesById.entries()) {
      if (packageRecord.pluginId === pluginId) {
        this.packagesById.delete(packageId);
      }
    }
    this.disableDependents(pluginId, removedCapabilities);
    this.audit("plugin.uninstall", pluginId);
  }

  public getPlugin(pluginId: string): PluginRecord | undefined {
    const plugin = this.pluginsById.get(pluginId);
    return plugin ? { ...plugin } : undefined;
  }

  public listPlugins(): PluginRecord[] {
    return [...this.pluginsById.values()]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((plugin) => ({ ...plugin }));
  }

  public getPackage(packageId: string): PluginPackageRecord | undefined {
    const packageRecord = this.packagesById.get(packageId);
    return packageRecord ? clonePackageRecord(packageRecord) : undefined;
  }

  public listPackages(): PluginPackageRecord[] {
    return [...this.packagesById.values()]
      .sort((left, right) => left.packageId.localeCompare(right.packageId))
      .map(clonePackageRecord);
  }

  public revokePackageSigner(signerId: string, actorId: string, reason: string): PluginRecord[] {
    validatePackageSignerRevocationInput(signerId, actorId, reason);
    if (!this.packageSignersById.has(signerId)) {
      throw new Error(`Unknown package signer: ${signerId}`);
    }

    this.revokedPackageSignerIds.add(signerId);
    const before = new Map(this.listPlugins().map((plugin) => [plugin.id, plugin.status]));
    const affectedPluginIds = new Set(
      [...this.packagesById.values()]
        .filter((packageRecord) => packageRecord.signerId === signerId)
        .map((packageRecord) => packageRecord.pluginId)
    );
    const disabled: PluginRecord[] = [];

    for (const pluginId of [...affectedPluginIds].sort()) {
      const plugin = this.pluginsById.get(pluginId);
      if (!plugin || plugin.status === "disabled") {
        continue;
      }

      disabled.push(this.setStatus(pluginId, "disabled", {
        reason: "package_signer_revoked",
        signerId
      }));
      this.disableDependents(pluginId);
    }

    const disabledPluginIds = new Set(disabled.map((plugin) => plugin.id));
    for (const plugin of this.pluginsById.values()) {
      if (before.get(plugin.id) !== "disabled" && plugin.status === "disabled" && !disabledPluginIds.has(plugin.id)) {
        disabled.push({ ...plugin });
        disabledPluginIds.add(plugin.id);
      }
    }

    this.auditPackageSignerRevocation(signerId, actorId, reason, [...disabledPluginIds]);
    return disabled;
  }

  public getManifest(pluginId: string): PluginManifest | undefined {
    const manifest = this.manifestsByPluginId.get(pluginId);
    return manifest ? structuredClone(manifest) : undefined;
  }

  public getActivePermissions(): RegisteredPermission[] {
    return this.getActiveManifests().flatMap(([pluginId, manifest]) =>
      (manifest.permissions ?? []).map((permission) => ({
        ...permission,
        pluginId
      }))
    );
  }

  public getActiveMenus(): RegisteredMenu[] {
    return this.getActiveManifests().flatMap(([pluginId, manifest]) =>
      (manifest.menus ?? []).map((menu) => ({
        id: menu.id,
        pluginId,
        label: menu.label,
        parentId: menu.parentId,
        icon: menu.icon,
        order: menu.order,
        requiredPermission: menu.permission,
        actionId: menu.action,
        enabled: true
      }))
    );
  }

  public getActiveCommands(): RegisteredCommand[] {
    return this.getActiveManifests().flatMap(([pluginId, manifest]) =>
      (manifest.commands ?? []).map((command) => ({
        id: command.id,
        pluginId,
        name: command.name,
        aliases: command.aliases ? [...command.aliases] : undefined,
        actionId: command.action,
        requiredPermission: command.permission,
        payloadSchema: structuredClone(command.payloadSchema),
        auditLevel: command.auditLevel ?? "standard",
        enabled: true
      }))
    );
  }

  public getActivePanels(): RegisteredPanel[] {
    return this.getActiveManifests().flatMap(([pluginId, manifest]) =>
      (manifest.panels ?? []).map((panel) => ({
        id: panel.id,
        pluginId,
        title: panel.title,
        route: panel.route,
        requiredPermission: panel.requiredPermission,
        icon: panel.icon,
        order: panel.order,
        enabled: true
      }))
    );
  }

  public getActiveFivemCompatibility(): RegisteredFivemCompatibility[] {
    return this.getActiveManifests()
      .filter(([, manifest]) => manifest.fivem)
      .map(([pluginId, manifest]) => ({
        pluginId,
        dependencies: [...(manifest.fivem?.dependencies ?? [])],
        files: [...(manifest.fivem?.files ?? [])],
        nuiPage: manifest.fivem?.nuiPage,
        provides: [...(manifest.fivem?.provides ?? [])],
        exports: (manifest.fivem?.exports ?? []).map(toRegisteredFivemActionMapping),
        serverCommands: (manifest.fivem?.serverCommands ?? []).map(toRegisteredFivemActionMapping),
        enabled: true
      }))
      .sort((a, b) => a.pluginId.localeCompare(b.pluginId));
  }

  public getApprovedSchemaDeclarations(): ApprovedPluginSchemaDeclaration[] {
    return [...this.manifestsByPluginId.entries()]
      .flatMap(([pluginId, manifest]) =>
        (manifest.schemas ?? [])
          .filter((schema) => schema.approved === true)
          .map((schema) => ({
            pluginId,
            entityType: schema.entityType,
            schemaVersion: schema.schemaVersion,
            schema: structuredClone(schema.schema),
            migrationPlan: structuredClone(schema.migrationPlan ?? []),
            status: "approved" as const
          }))
      )
      .sort((a, b) => a.pluginId.localeCompare(b.pluginId) || a.entityType.localeCompare(b.entityType));
  }

  public getActiveGameplayPrimitives(): ActiveGameplayPrimitives {
    const activeManifests = this.getActiveManifests();
    return {
      items: activeManifests.flatMap(([pluginId, manifest]) =>
        (manifest.items ?? []).map((item) => ({ ...item, pluginId }))
      ),
      jobs: activeManifests.flatMap(([pluginId, manifest]) =>
        (manifest.jobs ?? []).map((job) => ({ ...job, grades: [...job.grades], pluginId }))
      ),
      vehicles: activeManifests.flatMap(([pluginId, manifest]) =>
        (manifest.vehicles ?? []).map((vehicle) => ({ ...vehicle, pluginId }))
      ),
      locations: activeManifests.flatMap(([pluginId, manifest]) =>
        (manifest.locations ?? []).map((location) => ({ ...location, pluginId }))
      )
    };
  }

  public getActiveHooks(): RegisteredHook[] {
    return this.getActiveManifests().flatMap(([pluginId, manifest]) =>
      (manifest.hooks ?? []).map((hook) => ({
        id: `${pluginId}:${hook.hookName}:${hook.handlerRef}`,
        pluginId,
        hookName: hook.hookName,
        capability: hook.capability,
        handlerType: hook.handlerType ?? "action",
        handlerRef: hook.handlerRef,
        priority: hook.priority ?? 0,
        enabled: true
      }))
    );
  }

  public getActiveConfigSchemas(): RegisteredConfigSchema[] {
    return this.getActiveManifests()
      .flatMap(([pluginId, manifest]) => this.configSchemasForManifest(pluginId, manifest))
      .sort((a, b) => a.pluginId.localeCompare(b.pluginId) || a.key.localeCompare(b.key));
  }

  public assertConfigValue(pluginId: string, key: string, value: unknown): void {
    const manifest = this.manifestsByPluginId.get(pluginId);
    if (!manifest) {
      throw new Error(`Unknown plugin: ${pluginId}`);
    }
    if (this.pluginsById.get(pluginId)?.status !== "active") {
      throw new Error(`Plugin config is not active: ${pluginId}`);
    }

    const schema = manifest.configSchema?.[key];
    if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
      throw new Error(`Unknown plugin config key: ${pluginId}:${key}`);
    }

    validateSchema(schema as SimpleJsonSchema, value, key);
  }

  public getAuditEvents(): AuditLogEntry[] {
    return this.auditEvents.map((event) => ({
      ...event,
      before: structuredClone(event.before),
      after: structuredClone(event.after)
    }));
  }

  private setStatus(pluginId: string, status: PluginStatus, auditMetadata: Record<string, unknown> = {}): PluginRecord {
    validatePluginLifecycleId(pluginId);
    const existing = this.pluginsById.get(pluginId);
    if (!existing) {
      throw new Error(`Unknown plugin: ${pluginId}`);
    }

    const updated = {
      ...existing,
      status,
      updatedAt: this.now()
    };
    this.pluginsById.set(pluginId, updated);
    this.audit(`plugin.${lifecycleActionForStatus(status)}`, pluginId, {
      previousStatus: existing.status,
      status,
      ...auditMetadata
    });
    return { ...updated };
  }

  private getActiveManifests(): Array<[string, PluginManifest]> {
    return [...this.manifestsByPluginId.entries()].filter(([pluginId]) => {
      return this.pluginsById.get(pluginId)?.status === "active";
    });
  }

  private validateManifest(manifest: PluginManifest): void {
    if (!manifest.pluginId || !manifest.name || !manifest.version) {
      throw new Error("Plugin manifest requires pluginId, name, and version");
    }

    assertUnique(
      manifest.pluginId,
      "permission key",
      (manifest.permissions ?? []).map((permission) => permission.key)
    );
    assertUnique(
      manifest.pluginId,
      "menu id",
      (manifest.menus ?? []).map((menu) => menu.id)
    );
    assertUnique(
      manifest.pluginId,
      "command id",
      (manifest.commands ?? []).map((command) => command.id)
    );
    assertUnique(
      manifest.pluginId,
      "command name or alias",
      (manifest.commands ?? []).flatMap((command) => [command.name, ...(command.aliases ?? [])])
    );
    assertUnique(
      manifest.pluginId,
      "panel id",
      (manifest.panels ?? []).map((panel) => panel.id)
    );
    assertCapabilityDeclarations(manifest.pluginId, "provided", manifest.providedCapabilities ?? []);
    assertCapabilityDeclarations(manifest.pluginId, "required", manifest.requiredCapabilities ?? []);

    const permissionKeys = new Set((manifest.permissions ?? []).map((permission) => permission.key));
    for (const menu of manifest.menus ?? []) {
      assertNonEmptyString(menu.action, `Menu ${menu.id} action`);
      if (menu.permission && !permissionKeys.has(menu.permission)) {
        throw new Error(`Menu ${menu.id} references undeclared permission: ${menu.permission}`);
      }
    }

    for (const command of manifest.commands ?? []) {
      assertNonEmptyString(command.name, `Command ${command.id} name`);
      assertNonEmptyString(command.action, `Command ${command.id} action`);
      for (const alias of command.aliases ?? []) {
        assertNonEmptyString(alias, `Command ${command.id} alias`);
      }
      if (command.payloadSchema !== undefined) {
        assertSimpleJsonSchema(command.payloadSchema, `Command ${command.id} payloadSchema`);
      }
      if (command.permission && !permissionKeys.has(command.permission)) {
        throw new Error(`Command ${command.id} references undeclared permission: ${command.permission}`);
      }
    }

    for (const panel of manifest.panels ?? []) {
      assertNonEmptyString(panel.route, `Panel ${panel.id} route`);
      if (panel.requiredPermission && !permissionKeys.has(panel.requiredPermission)) {
        throw new Error(`Panel ${panel.id} references undeclared permission: ${panel.requiredPermission}`);
      }
    }

    for (const fivemExport of manifest.fivem?.exports ?? []) {
      assertNonEmptyString(fivemExport.name, "FiveM export name");
      assertNonEmptyString(fivemExport.action, `FiveM export ${fivemExport.name} action`);
      if (fivemExport.permission && !permissionKeys.has(fivemExport.permission)) {
        throw new Error(`FiveM export ${fivemExport.name} references undeclared permission: ${fivemExport.permission}`);
      }
    }

    for (const serverCommand of manifest.fivem?.serverCommands ?? []) {
      assertNonEmptyString(serverCommand.name, "FiveM server command name");
      assertNonEmptyString(serverCommand.action, `FiveM server command ${serverCommand.name} action`);
      if (!serverCommand.permission) {
        throw new Error(`FiveM server command ${serverCommand.name} requires a permission`);
      }
      if (serverCommand.permission && !permissionKeys.has(serverCommand.permission)) {
        throw new Error(`FiveM server command ${serverCommand.name} references undeclared permission: ${serverCommand.permission}`);
      }
    }

    for (const schema of manifest.schemas ?? []) {
      if (!schema.entityType) {
        throw new Error("Plugin schema requires entityType");
      }

      if (schema.schemaVersion < 1) {
        throw new Error(`Plugin schema ${schema.entityType} requires a positive schemaVersion`);
      }

      if (!schema.schema || typeof schema.schema !== "object" || Array.isArray(schema.schema)) {
        throw new Error(`Plugin schema ${schema.entityType} must include a schema object`);
      }
      assertSimpleJsonSchema(schema.schema, `Plugin schema ${schema.entityType}`);
      validatePluginSchemaMigrationPlan(schema.entityType, schema.migrationPlan);
    }

    for (const hook of manifest.hooks ?? []) {
      assertNonEmptyString(hook.hookName, "Plugin hook name");
      assertNonEmptyString(hook.capability, `Plugin hook ${hook.hookName} capability`);
      assertNonEmptyString(hook.handlerRef, `Plugin hook ${hook.hookName} handlerRef`);
      if (hook.handlerType !== undefined && !["action", "reducer", "sidecar"].includes(hook.handlerType)) {
        throw new Error(`Plugin hook ${hook.hookName} has invalid handler type: ${String(hook.handlerType)}`);
      }
    }

    for (const [key, schema] of Object.entries(manifest.configSchema ?? {})) {
      if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
        throw new Error(`Config schema ${key} must be an object`);
      }
      assertSimpleJsonSchema(schema, `Config schema ${key}`);
    }
  }

  private validatePackage(input: PluginPackageInstallInput): void {
    for (const [field, value] of [
      ["packageId", input.packageId],
      ["pluginId", input.pluginId],
      ["version", input.version],
      ["source", input.source],
      ["publisher", input.publisher],
      ["signerId", input.signerId],
      ["signature", input.signature],
      ["manifestHash", input.manifestHash]
    ] as const) {
      if (typeof value !== "string" || value.length === 0) {
        throw new Error(`Plugin package ${field} must be a non-empty string`);
      }
    }

    if (!["marketplace", "community", "local"].includes(input.trustLevel)) {
      throw new Error(`Plugin package ${input.packageId} has invalid trust level`);
    }

    if (input.manifest.pluginId !== input.pluginId) {
      throw new Error(`Plugin package ${input.packageId} manifest pluginId does not match ${input.pluginId}`);
    }

    if (input.manifest.version !== input.version) {
      throw new Error(`Plugin package ${input.packageId} manifest version does not match ${input.version}`);
    }

    if (input.manifestHash !== hashPluginManifest(input.manifest)) {
      throw new Error(`Plugin package ${input.packageId} manifest hash mismatch`);
    }

    if (input.trustLevel !== "local") {
      const signer = this.packageSignersById.get(input.signerId);
      if (!signer) {
        throw new Error(`Unknown package signer: ${input.signerId}`);
      }
      if (this.revokedPackageSignerIds.has(input.signerId)) {
        throw new Error(`Package signer has been revoked: ${input.signerId}`);
      }

      const expectedSignature = createHmac("sha256", signer.secret).update(input.manifestHash).digest("hex");
      if (input.signature !== expectedSignature) {
        throw new Error(`Plugin package ${input.packageId} signature mismatch`);
      }
    }
  }

  private configSchemasForManifest(pluginId: string, manifest: PluginManifest): RegisteredConfigSchema[] {
    return Object.entries(manifest.configSchema ?? {}).map(([key, rawSchema]) => {
      const schema = rawSchema as Record<string, unknown>;
      return {
        pluginId,
        key,
        schema: structuredClone(schema),
        defaultValue: structuredClone(schema.default)
      };
    });
  }

  private assertDependencies(pluginId: string): void {
    const manifest = this.manifestsByPluginId.get(pluginId);
    if (!manifest) {
      throw new Error(`Unknown plugin: ${pluginId}`);
    }

    for (const requiredPluginId of manifest.requiredPlugins ?? []) {
      if (this.pluginsById.get(requiredPluginId)?.status !== "active") {
        throw new Error(`Plugin ${pluginId} requires active plugin ${requiredPluginId}`);
      }
    }

    for (const dependency of manifest.fivem?.dependencies ?? []) {
      if (!this.activeFivemDependencyExists(dependency)) {
        throw new Error(`Plugin ${pluginId} requires active FiveM dependency ${dependency}`);
      }
    }

    const activeCapabilities = new Set(
      this.getActiveManifests().flatMap(([, activeManifest]) => activeManifest.providedCapabilities ?? [])
    );
    for (const capability of manifest.requiredCapabilities ?? []) {
      if (!activeCapabilities.has(capability)) {
        throw new Error(`Plugin ${pluginId} requires active capability ${capability}`);
      }
    }
  }

  private assertPackageSignerTrusted(pluginId: string): void {
    for (const packageRecord of this.packagesById.values()) {
      if (packageRecord.pluginId === pluginId && this.revokedPackageSignerIds.has(packageRecord.signerId)) {
        throw new Error(`Package signer has been revoked: ${packageRecord.signerId}`);
      }
    }
  }

  private disableDependents(disabledPluginId: string, initialDisabledCapabilities: string[] = []): void {
    const disabledCapabilities = new Set(
      [
        ...(this.manifestsByPluginId.get(disabledPluginId)?.providedCapabilities ?? []),
        ...initialDisabledCapabilities
      ]
    );
    let changed = true;

    while (changed) {
      changed = false;
      for (const [pluginId, plugin] of this.pluginsById.entries()) {
        if (plugin.status !== "active") {
          continue;
        }

        const manifest = this.manifestsByPluginId.get(pluginId);
        if (!manifest) {
          continue;
        }

        const requiredPluginDisabled = (manifest.requiredPlugins ?? []).some(
          (requiredPluginId) => this.pluginsById.get(requiredPluginId)?.status !== "active"
        );
        const fivemDependencyDisabled = (manifest.fivem?.dependencies ?? []).some(
          (dependency) => !this.activeFivemDependencyExists(dependency)
        );
        const requiredCapabilityDisabled = (manifest.requiredCapabilities ?? []).some((capability) => {
          if (disabledCapabilities.has(capability)) {
            return true;
          }

          return !this.activeCapabilityExists(capability);
        });

        if (requiredPluginDisabled || fivemDependencyDisabled || requiredCapabilityDisabled) {
          this.setStatus(pluginId, "disabled", {
            reason: "dependency_disabled",
            dependencyPluginId: disabledPluginId
          });
          for (const capability of manifest.providedCapabilities ?? []) {
            disabledCapabilities.add(capability);
          }
          changed = true;
        }
      }
    }
  }

  private activeCapabilityExists(capability: string): boolean {
    return this.getActiveManifests().some(([, manifest]) =>
      (manifest.providedCapabilities ?? []).includes(capability)
    );
  }

  private activeFivemDependencyExists(dependency: string): boolean {
    const directPlugin = this.pluginsById.get(dependency);
    if (directPlugin?.status === "active") {
      return true;
    }

    return this.getActiveManifests().some(([, manifest]) =>
      (manifest.fivem?.provides ?? []).includes(dependency)
    );
  }

  private audit(actionType: string, pluginId: string, after?: unknown): void {
    this.auditEvents.push({
      id: `${actionType}:${pluginId}:${this.auditEvents.length + 1}`,
      actorId: "system",
      pluginId,
      actionType,
      targetType: "plugin",
      targetId: pluginId,
      after: structuredClone(after),
      status: "succeeded",
      createdAt: this.now()
    });
  }

  private auditPackageSignerRevocation(
    signerId: string,
    actorId: string,
    reason: string,
    disabledPluginIds: string[]
  ): void {
    this.auditEvents.push({
      id: `plugin.package_signer_revoked:${signerId}:${this.auditEvents.length + 1}`,
      actorId,
      actionType: "plugin.package_signer_revoked",
      targetType: "package_signer",
      targetId: signerId,
      after: {
        signerId,
        disabledPluginIds,
        reason
      },
      status: "succeeded",
      createdAt: this.now()
    });
  }
}

function validatePackageSignerRevocationInput(signerId: string, actorId: string, reason: string): void {
  if (signerId.trim().length === 0) {
    throw new Error("Package signer id is required");
  }
  if (actorId.trim().length === 0) {
    throw new Error("Package signer revocation actor is required");
  }
  if (reason.trim().length === 0) {
    throw new Error("Package signer revocation reason is required");
  }
}

function validatePluginLifecycleId(pluginId: string): void {
  if (pluginId.trim().length === 0) {
    throw new Error("Plugin id is required");
  }
}

function lifecycleActionForStatus(status: PluginStatus): string {
  if (status === "active") {
    return "enable";
  }
  if (status === "disabled") {
    return "disable";
  }

  return status;
}

function assertUnique(pluginId: string, label: string, values: string[]): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      throw new Error(`Duplicate ${label} in plugin ${pluginId}: ${value}`);
    }
    seen.add(value);
  }
}

function assertNonEmptyString(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
}

function toRegisteredFivemActionMapping(
  action: PluginManifestFivemActionMapping
): RegisteredFivemActionMapping {
  return {
    name: action.name,
    actionId: action.action,
    requiredPermission: action.permission
  };
}

function clonePackageRecord(record: PluginPackageRecord): PluginPackageRecord {
  return {
    ...record,
    installedAt: new Date(record.installedAt.getTime()),
    updatedAt: new Date(record.updatedAt.getTime())
  };
}

function assertSimpleJsonSchema(value: unknown, label: string): asserts value is SimpleJsonSchema {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }

  const schema = value as Record<string, unknown>;
  const type = schema.type;
  if (!["object", "string", "number", "boolean", "array"].includes(String(type))) {
    throw new Error(`${label} has invalid schema type: ${String(type)}`);
  }

  if (schema.required !== undefined) {
    if (!Array.isArray(schema.required) || schema.required.some((entry) => typeof entry !== "string")) {
      throw new Error(`${label}.required must be an array of strings`);
    }
  }

  if (schema.enum !== undefined) {
    if (!Array.isArray(schema.enum) || schema.enum.length === 0) {
      throw new Error(`${label}.enum must be a non-empty array`);
    }
    if (schema.enum.some((entry) => typeof entry !== type)) {
      throw new Error(`${label}.enum entries must match schema type ${String(type)}`);
    }
  }

  if (schema.properties !== undefined) {
    if (!schema.properties || typeof schema.properties !== "object" || Array.isArray(schema.properties)) {
      throw new Error(`${label}.properties must be an object`);
    }
    for (const [propertyKey, propertySchema] of Object.entries(schema.properties as Record<string, unknown>)) {
      if (!propertySchema || typeof propertySchema !== "object" || Array.isArray(propertySchema)) {
        throw new Error(`${label}.properties.${propertyKey} must be an object`);
      }
      assertSimpleJsonSchema(propertySchema, `${label}.properties.${propertyKey}`);
    }
  }

  if (schema.items !== undefined) {
    if (!schema.items || typeof schema.items !== "object" || Array.isArray(schema.items)) {
      throw new Error(`${label}.items must be an object`);
    }
    assertSimpleJsonSchema(schema.items, `${label}.items`);
  }
}

export function validatePluginSchemaJson(entityType: string, schemaJson: string): SimpleJsonSchema {
  let parsed: unknown;
  try {
    parsed = JSON.parse(schemaJson);
  } catch {
    throw new Error(`Plugin schema ${entityType} schemaJson must be valid JSON`);
  }

  assertSimpleJsonSchema(parsed, `Plugin schema ${entityType}`);
  return structuredClone(parsed);
}

export function validatePluginSchemaMigrationPlanJson(entityType: string, migrationPlanJson: string): unknown[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(migrationPlanJson);
  } catch {
    throw new Error(`Plugin schema ${entityType} migrationPlanJson must be valid JSON`);
  }

  validatePluginSchemaMigrationPlan(entityType, parsed);
  return structuredClone(parsed as unknown[]);
}

export function validatePluginSchemaMigrationPlan(entityType: string, migrationPlan: unknown): void {
  if (migrationPlan === undefined) {
    return;
  }

  if (!Array.isArray(migrationPlan)) {
    throw new Error(`Plugin schema ${entityType} migrationPlan must be an array`);
  }

  for (const [index, rawStep] of migrationPlan.entries()) {
    if (!rawStep || typeof rawStep !== "object" || Array.isArray(rawStep)) {
      throw new Error(`Plugin schema ${entityType} migration step ${index} must be an object`);
    }

    const step = rawStep as Record<string, unknown>;
    const stepName = step.step;
    if (typeof stepName !== "string" || stepName.length === 0) {
      throw new Error(`Plugin schema ${entityType} migration step ${index} requires a non-empty step`);
    }

    if (stepName === "create_json_entity_type") {
      const targetEntityType = step.entityType;
      if (targetEntityType !== entityType) {
        throw new Error(`Plugin schema ${entityType} migration step create_json_entity_type targets ${String(targetEntityType)}`);
      }
      continue;
    }

    if (stepName === "add_optional_property" || stepName === "add_required_property") {
      const property = step.property;
      if (typeof property !== "string" || property.length === 0) {
        throw new Error(`Plugin schema ${entityType} migration ${stepName} requires a property`);
      }
      assertSimpleJsonSchema(step.schema, `Plugin schema ${entityType} migration ${stepName}.${property}`);
      continue;
    }

    if (stepName === "record_sql_index" || stepName === "record_sql_foreign_key") {
      const targetEntityType = step.entityType;
      if (targetEntityType !== undefined && targetEntityType !== entityType) {
        throw new Error(`Plugin schema ${entityType} migration step ${stepName} targets ${String(targetEntityType)}`);
      }
      continue;
    }

    throw new Error(`Plugin schema ${entityType} migration step ${stepName} is not supported`);
  }
}

function assertCapabilityDeclarations(pluginId: string, label: "provided" | "required", capabilities: string[]): void {
  const seen = new Set<string>();
  for (const capability of capabilities) {
    if (typeof capability !== "string" || capability.length === 0) {
      throw new Error(`Plugin ${pluginId} ${label} capability must be a non-empty string`);
    }
    if (seen.has(capability)) {
      throw new Error(`Duplicate ${label} capability in plugin ${pluginId}: ${capability}`);
    }
    seen.add(capability);
  }
}

export function hashPluginManifest(manifest: PluginManifest): string {
  const canonical = JSON.stringify(sortKeys(manifest));
  return `sha256:${createHash("sha256").update(canonical).digest("hex")}`;
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortKeys(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, sortKeys(child)])
    );
  }

  return value;
}
