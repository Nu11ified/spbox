import {
  type AuditLogEntry,
  type AccountOwnerType,
  type AccountStatement,
  type AccountStatementCriteria,
  type AccountSearchCriteria,
  type AceMirrorRule,
  accountStatementToCsv,
  buildAccountStatement,
  type EconomyLedger,
  findSuspiciousEconomyActivity,
  type GrantPermissionInput,
  hashPluginManifest,
  type LedgerEntry,
  type PermissionDefinition,
  type PermissionEngine,
  type PermissionSnapshot,
  type PermissionStore,
  type PolicyConstraint,
  type PluginCapability,
  type PluginBundleRecord,
  type PluginDeploymentFailureResult,
  type PluginDeploymentManager,
  type PluginDeploymentRecord,
  type PluginManifest,
  type PluginPackageInstallInput,
  type PluginPackageRecord,
  type PluginRecord,
  type PluginRegistry,
  type PluginSandboxEvent,
  type PluginSidecarInstance,
  type Principal,
  type PrincipalEdge,
  type RuntimeConfigRecord,
  type RuntimeControlPlane,
  type RuntimeHealthRecord,
  type SetRuntimeConfigInput,
  type SuspiciousActivityCriteria,
  type SuspiciousEconomyActivity,
  type Transaction,
  type TransactionHistoryCriteria,
  type SimpleJsonSchema,
  validateEconomyAccountCreation,
  validateEconomyAmount,
  validateEconomyLimitJson,
  validateEconomyReason,
  validateLedgerDirection,
  validateSchema,
  validatePluginSchemaJson,
  validatePluginSchemaMigrationPlanJson
} from "../core/index.js";
import {
  DiscordRoleConnector,
  type DiscordMemberSnapshot,
  type DiscordRoleMapping,
  type DiscordSyncPlan
} from "../connectors/discord.js";
import {
  type AccountTransactionReducerInput,
  type AddPrincipalEdgeReducerInput,
  type AdminAdjustBalanceReducerInput,
  type AuditLogRow,
  type BusinessPayoutReducerInput,
  type BuyItemReducerInput,
  type ChargeTaxReducerInput,
  type CreateAccountInput,
  type EconomyAccountRow,
  type EconomyLimitRow,
  type EconomyLedgerEntryRow,
  type EconomyTransactionRow,
  type FinePlayerReducerInput,
  type CharacterRow,
  type CharacterJobRow,
  type GameplayItemRow,
  type GameplayJobRow,
  type GameplayLocationRow,
  type GameplayVehicleRow,
  type InventoryStackRow,
  type MenuActionRow,
  type MenuDefinitionRow,
  type RuntimeCommandRow,
  type RuntimePanelRow,
  type MenuSessionRow,
  type MenuVisibilityPolicyRow,
  type PluginCapabilityRow,
  type PluginConfigValueRow,
  type PluginEntityRow,
  type PluginManifestRow,
  type PluginPackageSignerRevocationRow,
  type PluginRuntimeInstanceRow,
  type PluginSandboxEventRow,
  type PluginSchemaRow,
  type PermissionGrantRow,
  type PolicyConstraintRow,
  type PrincipalEdgeRow,
  type PrincipalRow,
  type AssignJobReducerInput,
  type GrantItemReducerInput,
  type RemoveItemReducerInput,
  type RemovePrincipalEdgeReducerInput,
  type RegisterItemReducerInput,
  type RegisterLocationReducerInput,
  type RevokePluginBundleReducerInput,
  type RegisterPluginBundleReducerInput,
  type RegisterPluginManifestReducerInput,
  type RegisterPluginHookReducerInput,
  type RegisterPermissionReducerInput,
  type RegisterPluginSchemaReducerInput,
  type RecordPluginSandboxEventReducerInput,
  type RegisterVehicleReducerInput,
  type IssueInvoiceReducerInput,
  type OpenMenuSessionReducerInput,
  type PayInvoiceReducerInput,
  type PaySalaryReducerInput,
  type SellItemReducerInput,
  type SpacetimeRuntimeAdapter,
  type TransferMoneyReducerInput,
  type UpsertEconomyLimitReducerInput,
  type VoidTransactionReducerInput,
  type UpsertPluginEntityReducerInput,
  type UpsertPluginRuntimeInstanceReducerInput,
  type SetPluginHooksEnabledReducerInput,
  type SetPluginConfigValueReducerInput,
  type UpsertPluginCapabilityReducerInput,
  type UpsertMenuActionReducerInput,
  type UpsertMenuDefinitionReducerInput,
  type UpsertRuntimeCommandReducerInput,
  type UpsertRuntimePanelReducerInput,
  type UpsertMenuVisibilityPolicyReducerInput,
  type UpsertCharacterReducerInput,
  type UpsertPolicyConstraintReducerInput,
  type UpsertAceMirrorRuleReducerInput
} from "../spacetime/adapter.js";

export interface AdminServiceOptions {
  runtime: RuntimeControlPlane;
  permissions: PermissionStore;
  plugins: PluginRegistry;
  deployments?: PluginDeploymentManager;
  economy?: EconomyLedger;
  spacetime?: SpacetimeRuntimeAdapter;
  serverId?: string;
  legacyResourceReconciler?: () => Promise<unknown>;
}

export interface AdminDashboard {
  health: RuntimeHealthRecord;
  config: RuntimeConfigRecord[];
  plugins: PluginRecord[];
  auditLogs: AuditLogEntry[];
}

export interface AuditSearchCriteria {
  serverId?: string;
  actorId?: string;
  actionType?: string;
  status?: string;
}

export interface RegisterGameplayJobInput {
  key: string;
  pluginId: string;
  label: string;
  grades: string[];
}

export interface AdminMenuRegistrySnapshot {
  definitions: MenuDefinitionRow[];
  actions: MenuActionRow[];
  commands: RuntimeCommandRow[];
  panels: RuntimePanelRow[];
  policies: MenuVisibilityPolicyRow[];
  sessions: MenuSessionRow[];
}

export interface MenuRefreshTarget {
  serverId: string;
  playerId: string;
  sessionId: string;
  cacheVersion: number;
}

export interface ReplicatedStateUpdate {
  serverId: string;
  key: string;
  value: unknown;
  playerId?: string | number;
  authoritative?: boolean;
}

export interface VehicleSpawnDispatch {
  serverId: string;
  targetSource: string | number;
  model: string;
  label: string;
  category: string;
  location?: {
    key: string;
    label: string;
    x: number;
    y: number;
    z: number;
  };
  heading?: number;
  warpIntoVehicle?: boolean;
}

export interface VehicleRepairDispatch {
  serverId: string;
  targetSource: string | number;
  targetVehicleNetId: number;
}

export interface WorldStateUpdate {
  serverId: string;
  world: {
    weatherType?: string;
    hour?: number;
    minute?: number;
  };
}

export interface TeleportDispatch {
  serverId: string;
  targetSource: string | number;
  x: number;
  y: number;
  z: number;
  heading?: number;
}

export interface KickDispatch {
  serverId: string;
  targetSource: string | number;
  reason: string;
}

export interface AdminGameplaySnapshot {
  items: GameplayItemRow[];
  jobs: GameplayJobRow[];
  vehicles: GameplayVehicleRow[];
  locations: GameplayLocationRow[];
  characters: CharacterRow[];
  inventory: InventoryStackRow[];
  characterJobs: CharacterJobRow[];
}

export interface QbCorePlayerDataSnapshot {
  serverId: string;
  source: string;
  characterId: string;
  citizenid: string;
  cid: number;
  license: string;
  name: string;
  charinfo: Record<string, unknown>;
  money: Record<string, number>;
  job: Record<string, unknown>;
  gang: Record<string, unknown>;
  metadata: Record<string, unknown>;
  position?: Record<string, unknown>;
  items: Array<Record<string, unknown>>;
}

export interface QbCoreRuntimeCharacterUpdate {
  characterId: string;
  playerPrincipalId: string;
  citizenId: string;
  cid: number;
  slot: number;
  license: string;
  name: string;
  charinfoJson: string;
  metadataJson: string;
  gangJson?: string;
  positionJson: string;
  phoneNumber: string;
  accountNumber: string;
  selected: boolean;
}

export interface QbCoreRuntimeCharacterSelection {
  characterId: string;
}

export interface QbCoreRuntimeMoneyUpdate {
  transactionId: string;
  actorId: string;
  characterId: string;
  moneyType: string;
  operation: "add" | "remove" | "set";
  amount: number;
  reason: string;
  idempotencyKey: string;
}

export interface QbCoreRuntimeInventoryUpdate {
  id: string;
  characterId: string;
  itemKey: string;
  operation: "add" | "remove";
  amount: number;
}

export interface AdminDeploymentSnapshot {
  bundles: PluginBundleRecord[];
  capabilities: PluginCapabilityRow[];
  deployments: PluginDeploymentRecord[];
  sandboxEvents: PluginSandboxEventRow[];
}

export interface AdminPluginRegistrySnapshot {
  plugins: PluginRecord[];
  packages: PluginPackageRecord[];
  packageSignerRevocations: PluginPackageSignerRevocationRow[];
  manifests: PluginManifestRow[];
  runtimeInstances: PluginRuntimeInstanceRow[];
  configValues: PluginConfigValueRow[];
}

export interface AdminPluginDataSnapshot {
  schemas: PluginSchemaRow[];
  entities: PluginEntityRow[];
}

export interface SyncDiscordRolesInput {
  guildId: string;
  serverId: string;
  roleMappings: DiscordRoleMapping[];
  members: DiscordMemberSnapshot[];
  edgeTtlMs?: number;
}

export class AdminService {
  private readonly runtime: RuntimeControlPlane;
  private readonly permissions: PermissionStore;
  private readonly plugins: PluginRegistry;
  private readonly deployments?: PluginDeploymentManager;
  private readonly economy?: EconomyLedger;
  private readonly spacetime?: SpacetimeRuntimeAdapter;
  private readonly controlPlaneServerId: string;
  private legacyResourceReconciler?: () => Promise<unknown>;
  private readonly mirroredSandboxEventIds = new Set<string>();
  private readonly localSandboxEventsById = new Map<string, PluginSandboxEventRow>();
  private readonly mirroredDeploymentAuditIds = new Set<string>();
  private readonly mirroredPluginAuditIds = new Set<string>();
  private readonly mirroredRuntimeAuditIds = new Set<string>();
  private readonly pendingMenuRefreshTargets = new Map<string, MenuRefreshTarget>();
  private readonly pendingReplicatedStateUpdates = new Map<string, ReplicatedStateUpdate>();
  private readonly pendingVehicleSpawns = new Map<string, VehicleSpawnDispatch>();
  private readonly pendingVehicleRepairs = new Map<string, VehicleRepairDispatch>();
  private readonly pendingWorldStateUpdates = new Map<string, WorldStateUpdate>();
  private readonly pendingTeleports = new Map<string, TeleportDispatch>();
  private readonly pendingKicks = new Map<string, KickDispatch>();
  private readonly activePluginSchemasByKey = new Map<string, SimpleJsonSchema>();
  private writeQueue: Promise<unknown> = Promise.resolve();

  public constructor(options: AdminServiceOptions) {
    this.runtime = options.runtime;
    this.permissions = options.permissions;
    this.plugins = options.plugins;
    this.deployments = options.deployments;
    this.economy = options.economy;
    this.spacetime = options.spacetime;
    this.controlPlaneServerId = options.serverId ?? "control-plane";
    this.legacyResourceReconciler = options.legacyResourceReconciler;
  }

  public setLegacyResourceReconciler(reconciler: () => Promise<unknown>): void {
    this.legacyResourceReconciler = reconciler;
  }

  public async reconcileLegacyResources(): Promise<unknown> {
    if (!this.legacyResourceReconciler) {
      return {
        ok: false,
        reason: "legacy resource auto-import is not configured"
      };
    }

    return this.legacyResourceReconciler();
  }

  public setConfig(input: SetRuntimeConfigInput): RuntimeConfigRecord {
    const record = this.runtime.setRuntimeConfig(input);
    this.enqueueWrite(() =>
      this.spacetime?.setRuntimeConfig({
        id: record.id,
        serverId: record.serverId,
        namespace: record.namespace,
        key: record.key,
        value: record.value,
        version: record.version
      } as SetRuntimeConfigInput & { id: string; version: number })
    );
    return record;
  }

  public getDashboard(serverId: string): AdminDashboard {
    const liveDashboard = this.getSpacetimeDashboard(serverId);
    if (liveDashboard) {
      return liveDashboard;
    }

    return {
      health: this.runtime.getHealth(serverId),
      config: this.runtime.getConfigSnapshot(serverId),
      plugins: this.plugins.listPlugins(),
      auditLogs: [
        ...this.runtime.getAuditLogs(serverId),
        ...this.plugins.getAuditEvents(),
        ...this.getEconomyAuditLogs()
      ]
    };
  }

  public searchAuditLogs(criteria: AuditSearchCriteria = {}): AuditLogEntry[] {
    if (this.spacetime) {
      return this.spacetime.cache.getAuditLogs({
        actorId: criteria.actorId,
        actionType: criteria.actionType,
        status: criteria.status
      }).map(toAuditLogEntry);
    }

    const serverId = criteria.serverId;
    const localLogs = serverId ? this.runtime.getAuditLogs(serverId) : [];
    return [
      ...localLogs,
      ...this.plugins.getAuditEvents(),
      ...this.getEconomyAuditLogs()
    ].filter((entry) =>
      (!criteria.actorId || entry.actorId === criteria.actorId) &&
      (!criteria.actionType || entry.actionType === criteria.actionType) &&
      (!criteria.status || entry.status === criteria.status)
    );
  }

  public installPlugin(manifest: PluginManifest): PluginRecord {
    const record = this.plugins.install(manifest);
    const manifestHash = hashPluginManifest(manifest);
    if (!this.spacetime?.cache.getPlugin(record.id)) {
      this.enqueueWrite(() =>
        this.spacetime?.registerPlugin({
          id: record.id,
          name: record.name,
          version: record.version,
          status: record.status,
          trustLevel: "manifest",
          signature: `manifest:${manifestHash}`,
          bundleHash: manifestHash,
          createdBy: "admin"
        })
      );
    }
    this.mirrorPluginManifest(manifest);
    this.mirrorPluginHooks(record.id);
    this.mirrorApprovedPluginSchemas(manifest.pluginId);
    this.mirrorPluginAuditLogs();
    this.queueMenuRefreshes();
    return record;
  }

  public installPluginPackage(input: PluginPackageInstallInput): PluginRecord {
    this.assertPackageSignerNotRevoked(input.signerId);
    const record = this.plugins.installPackage(input);
    this.enqueueWrite(() =>
      this.spacetime?.registerPlugin({
        id: record.id,
        name: record.name,
        version: record.version,
        status: record.status,
        trustLevel: input.trustLevel,
        signature: input.signature,
        bundleHash: input.manifestHash,
        createdBy: input.publisher
      })
    );
    this.enqueueWrite(() =>
      this.spacetime?.registerPluginPackage({
        packageId: input.packageId,
        pluginId: input.pluginId,
        version: input.version,
        source: input.source,
        publisher: input.publisher,
        trustLevel: input.trustLevel,
        signerId: input.signerId,
        signature: input.signature,
        manifestHash: input.manifestHash
      })
    );
    this.mirrorPluginManifest(input.manifest);
    this.mirrorPluginHooks(record.id);
    this.mirrorApprovedPluginSchemas(input.manifest.pluginId);
    this.mirrorPluginAuditLogs();
    this.queueMenuRefreshes();
    return record;
  }

  public getPluginPackages(): PluginPackageRecord[] {
    return this.plugins.listPackages();
  }

  public revokePackageSigner(signerId: string, actorId: string, reason: string): PluginRecord[] {
    const disabled = this.plugins.revokePackageSigner(signerId, actorId, reason);
    this.enqueueWrite(() =>
      this.spacetime?.revokePackageSigner({
        signerId,
        actorId,
        reason
      })
    );
    for (const plugin of disabled) {
      this.enqueueWrite(() =>
        this.spacetime?.setPluginStatus({
          pluginId: plugin.id,
          status: plugin.status
        })
      );
    }
    this.mirrorPluginAuditLogs();
    this.queueMenuRefreshes();
    return disabled;
  }

  public uninstallPlugin(pluginId: string): void {
    const before = new Map(this.plugins.listPlugins().map((plugin) => [plugin.id, plugin.status]));
    try {
      this.plugins.uninstall(pluginId);
    } catch (error) {
      if (!(error instanceof Error) || !error.message.startsWith("Unknown plugin:")) {
        throw error;
      }
    }
    for (const plugin of this.plugins.listPlugins()) {
      if (before.get(plugin.id) !== plugin.status) {
        this.enqueueWrite(() =>
          this.spacetime?.setPluginStatus({
            pluginId: plugin.id,
            status: plugin.status
          })
        );
      }
    }
    this.enqueueWrite(() => this.spacetime?.uninstallPlugin(pluginId));
    this.mirrorPluginAuditLogs();
    this.queueMenuRefreshes();
  }

  public enablePlugin(pluginId: string): PluginRecord {
    const record = this.plugins.enable(pluginId);
    this.mirrorPluginHooks(record.id);
    this.enqueueWrite(() =>
      this.spacetime?.setPluginStatus({
        pluginId: record.id,
        status: record.status
      })
    );
    this.mirrorPluginAuditLogs();
    this.queueMenuRefreshes();
    return record;
  }

  public disablePlugin(pluginId: string): PluginRecord {
    const before = new Map(this.plugins.listPlugins().map((plugin) => [plugin.id, plugin.status]));
    const pluginsWithHooks = new Set(
      this.plugins
        .listPlugins()
        .filter((plugin) => (this.plugins.getManifest(plugin.id)?.hooks?.length ?? 0) > 0)
        .map((plugin) => plugin.id)
    );
    const record = this.plugins.disable(pluginId);
    for (const plugin of this.plugins.listPlugins()) {
      if (before.get(plugin.id) !== plugin.status) {
        if (pluginsWithHooks.has(plugin.id) && plugin.status !== "active") {
          this.mirrorPluginHooksEnabled(plugin.id, false);
        }
        if (plugin.status !== "active") {
          this.killDeploymentsForDisabledPlugin(plugin.id);
        }
        this.enqueueWrite(() =>
          this.spacetime?.setPluginStatus({
            pluginId: plugin.id,
            status: plugin.status
          })
        );
      }
    }
    this.mirrorPluginAuditLogs();
    this.queueMenuRefreshes();
    return record;
  }

  public getPlugins(): PluginRecord[] {
    const cached = this.spacetime?.cache.listPlugins() ?? [];
    if (cached.length > 0) {
      return cached;
    }

    return this.plugins.listPlugins();
  }

  public getPluginRegistrySnapshot(): AdminPluginRegistrySnapshot {
    if (this.spacetime) {
      return {
        plugins: this.spacetime.cache.listPlugins(),
        packages: this.spacetime.cache.listPluginPackages().length > 0
          ? this.spacetime.cache.listPluginPackages()
          : this.plugins.listPackages(),
        packageSignerRevocations: this.spacetime.cache.listPackageSignerRevocations(),
        manifests: this.spacetime.cache.getPluginManifests(),
        runtimeInstances: this.spacetime.cache.getPluginRuntimeInstances(),
        configValues: this.spacetime.cache.getPluginConfigValues()
      };
    }

    return {
      plugins: this.plugins.listPlugins(),
      packages: this.plugins.listPackages(),
      packageSignerRevocations: [],
      manifests: [],
      runtimeInstances: [],
      configValues: []
    };
  }

  public upsertPluginRuntimeInstance(input: UpsertPluginRuntimeInstanceReducerInput): void {
    this.enqueueWrite(() => this.spacetime?.upsertPluginRuntimeInstance(input));
  }

  public setPluginConfigValue(input: {
    pluginId: string;
    serverId: string;
    key: string;
    value: unknown;
    version: number;
  }): void {
    this.plugins.assertConfigValue(input.pluginId, input.key, input.value);
    this.enqueueWrite(() =>
      this.spacetime?.setPluginConfigValue({
        pluginId: input.pluginId,
        serverId: input.serverId,
        key: input.key,
        valueJson: JSON.stringify(input.value),
        version: input.version
      } satisfies SetPluginConfigValueReducerInput)
    );
  }

  public upsertPrincipal(principal: Principal): Principal {
    const record = this.permissions.upsertPrincipal(principal);
    this.enqueueWrite(() =>
      this.spacetime?.upsertPrincipal({
        id: record.id,
        principalType: record.type,
        externalId: record.externalId,
        name: record.name
      })
    );
    return record;
  }

  public registerPermissionDefinition(permission: PermissionDefinition): PermissionDefinition {
    const record = this.permissions.registerPermission(permission);
    this.enqueueWrite(() =>
      this.spacetime?.registerPermission({
        id: record.id,
        key: record.key,
        description: record.description,
        pluginId: record.pluginId
      } satisfies RegisterPermissionReducerInput)
    );
    return record;
  }

  public upsertAceMirrorRule(rule: AceMirrorRule & { id: string }): AceMirrorRule {
    const record = this.permissions.upsertAceMirrorRule(rule);
    this.enqueueWrite(() =>
      this.spacetime?.upsertAceMirrorRule({
        id: record.id ?? `${record.permissionKey}:${record.aceObject}`,
        permissionKey: record.permissionKey,
        aceObject: record.aceObject,
        enabled: record.enabled,
        mode: record.mode
      } satisfies UpsertAceMirrorRuleReducerInput)
    );
    return record;
  }

  public ackPermissionCacheVersion(serverId: string, version: number): void {
    this.enqueueWrite(() =>
      this.spacetime?.ackPermissionCacheVersion({
        serverId,
        version
      })
    );
  }

  public grantPermission(input: GrantPermissionInput): void {
    const grant = this.permissions.grantPermission(input);
    this.enqueueWrite(() =>
      this.spacetime?.grantPermission({
        id: `${grant.principalId}:${grant.permissionKey}:${grant.effect}`,
        principalId: grant.principalId,
        permissionKey: grant.permissionKey,
        effect: grant.effect,
        source: grant.source,
        expiresAt: grant.expiresAt
      })
    );
  }

  private addPrincipalEdge(edge: PrincipalEdge): void {
    const record = this.permissions.addPrincipalEdge(edge);
    this.enqueueWrite(() =>
      this.spacetime?.addPrincipalEdge({
        id: principalEdgeId(record),
        parentPrincipalId: record.parentPrincipalId,
        childPrincipalId: record.childPrincipalId,
        source: record.source,
        expiresAt: record.expiresAt
      } satisfies AddPrincipalEdgeReducerInput)
    );
  }

  private removePrincipalEdge(edge: PrincipalEdge): void {
    this.permissions.removePrincipalEdge(edge.parentPrincipalId, edge.childPrincipalId, edge.source);
    this.enqueueWrite(() =>
      this.spacetime?.removePrincipalEdge({
        edgeId: principalEdgeId(edge)
      } satisfies RemovePrincipalEdgeReducerInput)
    );
  }

  private writeDiscordSyncAudit(serverId: string, plan: DiscordSyncPlan): void {
    const entry = {
      id: `discord.role_sync:${plan.audit.guildId}`,
      serverId,
      actorId: `connector:discord:${plan.audit.guildId}`,
      pluginId: "connector.discord",
      actionType: "discord.role_sync",
      permissionKey: "",
      targetType: "discord_guild",
      targetId: plan.audit.guildId,
      beforeJson: "{}",
      afterJson: JSON.stringify(plan.audit),
      status: "succeeded"
    };
    this.enqueueWrite(() => this.spacetime?.writeAuditLog(entry));
  }

  public upsertPolicyConstraint(input: PolicyConstraint): PolicyConstraint {
    const policy = this.permissions.upsertPolicyConstraint(input);
    this.enqueueWrite(() =>
      this.spacetime?.upsertPolicyConstraint(toPolicyConstraintReducerInput(policy))
    );
    return policy;
  }

  public removePolicyConstraint(policyId: string): void {
    this.permissions.removePolicyConstraint(policyId);
    this.enqueueWrite(() => this.spacetime?.removePolicyConstraint(policyId));
  }

  public getPermissionEngine(): PermissionEngine {
    return this.permissions.toEngine();
  }

  public getPermissionSnapshot(): PermissionSnapshot {
    const cached = this.getSpacetimePermissionSnapshot();
    if (cached) {
      return cached;
    }

    return this.permissions.snapshot();
  }

  public getPermissionAudit(): AuditLogEntry[] {
    return this.permissions.getAuditEvents();
  }

  public syncDiscordRoles(input: SyncDiscordRolesInput): DiscordSyncPlan {
    const connector = new DiscordRoleConnector({
      guildId: input.guildId,
      roleMappings: input.roleMappings,
      existingEdges: this.getPermissionSnapshot().edges,
      serverId: input.serverId,
      edgeTtlMs: input.edgeTtlMs
    });
    const plan = connector.planSync(input.members);

    for (const principal of plan.upsertPrincipals) {
      this.upsertPrincipal(principal);
    }
    for (const edge of plan.addEdges) {
      this.addPrincipalEdge(edge);
    }
    for (const edge of plan.removeEdges) {
      this.removePrincipalEdge(edge);
    }
    this.writeDiscordSyncAudit(input.serverId, plan);

    return plan;
  }

  public async createEconomyAccount(input: CreateAccountInput & { ownerType: AccountOwnerType }): Promise<void> {
    validateEconomyAccountCreation(input);
    await this.requireSpacetimeForEconomy().createAccount(input);
  }

  public async upsertEconomyLimit(input: UpsertEconomyLimitReducerInput): Promise<void> {
    validateEconomyLimitJson(input.limitJson);
    await this.requireSpacetimeForEconomy().upsertEconomyLimit(input);
  }

  public getEconomyLimits(): EconomyLimitRow[] {
    return this.requireSpacetimeForEconomy().cache.getEconomyLimits();
  }

  public async transferEconomyMoney(input: TransferMoneyReducerInput): Promise<void> {
    validateEconomyAmount(input.amount);
    validateEconomyReason(input.reason);
    await this.requireSpacetimeForEconomy().transferMoney(input);
  }

  public async depositEconomyCash(input: AccountTransactionReducerInput): Promise<void> {
    validateEconomyAmount(input.amount);
    validateEconomyReason(input.reason);
    await this.requireSpacetimeForEconomy().depositCash(input);
  }

  public async withdrawEconomyCash(input: AccountTransactionReducerInput): Promise<void> {
    validateEconomyAmount(input.amount);
    validateEconomyReason(input.reason);
    await this.requireSpacetimeForEconomy().withdrawCash(input);
  }

  public async adjustEconomyBalance(input: AdminAdjustBalanceReducerInput): Promise<void> {
    validateLedgerDirection(input.direction);
    validateEconomyAmount(input.amount);
    validateEconomyReason(input.reason);
    await this.requireSpacetimeForEconomy().adminAdjustBalance(input);
  }

  public async payEconomySalary(input: PaySalaryReducerInput): Promise<void> {
    validateEconomyAmount(input.amount);
    validateEconomyReason(input.reason);
    await this.requireSpacetimeForEconomy().paySalary(input);
  }

  public async fineEconomyPlayer(input: FinePlayerReducerInput): Promise<void> {
    validateEconomyAmount(input.amount);
    validateEconomyReason(input.reason);
    await this.requireSpacetimeForEconomy().finePlayer(input);
  }

  public async chargeEconomyTax(input: ChargeTaxReducerInput): Promise<void> {
    validateEconomyAmount(input.amount);
    validateEconomyReason(input.reason);
    await this.requireSpacetimeForEconomy().chargeTax(input);
  }

  public async payEconomyBusinessPayout(input: BusinessPayoutReducerInput): Promise<void> {
    validateEconomyAmount(input.amount);
    validateEconomyReason(input.reason);
    await this.requireSpacetimeForEconomy().businessPayout(input);
  }

  public async issueEconomyInvoice(input: IssueInvoiceReducerInput): Promise<void> {
    validateEconomyAmount(input.amount);
    validateEconomyReason(input.reason);
    await this.requireSpacetimeForEconomy().issueInvoice(input);
  }

  public async payEconomyInvoice(input: PayInvoiceReducerInput): Promise<void> {
    await this.requireSpacetimeForEconomy().payInvoice(input);
  }

  public async buyEconomyItem(input: BuyItemReducerInput): Promise<void> {
    validateEconomyAmount(input.amount);
    validateEconomyQuantity(input.quantity);
    await this.requireSpacetimeForEconomy().buyItem(input);
  }

  public async sellEconomyItem(input: SellItemReducerInput): Promise<void> {
    validateEconomyAmount(input.amount);
    validateEconomyQuantity(input.quantity);
    await this.requireSpacetimeForEconomy().sellItem(input);
  }

  public async voidEconomyTransaction(input: VoidTransactionReducerInput): Promise<void> {
    validateEconomyReason(input.reason);
    await this.requireSpacetimeForEconomy().voidTransaction(input);
  }

  public searchEconomyAccounts(criteria: AccountSearchCriteria = {}): ReturnType<EconomyLedger["searchAccounts"]> {
    if (this.spacetime) {
      return this.spacetime.cache.getAccounts(criteria).map(toEconomyAccount);
    }

    return this.requireEconomyLedgerForReads().searchAccounts(criteria);
  }

  public listEconomyTransactions(criteria: TransactionHistoryCriteria = {}): Transaction[] {
    if (this.spacetime) {
      const transactions = this.spacetime.cache.getTransactions({
        actorId: criteria.actorId,
        transactionType: criteria.type,
        status: criteria.status
      });
      const transactionIdsForAccount = criteria.accountId
        ? new Set(this.spacetime.cache.getLedgerEntriesForAccount(criteria.accountId).map((entry) => entry.transactionId))
        : undefined;

      return transactions
        .filter((transaction) => !transactionIdsForAccount || transactionIdsForAccount.has(transaction.id))
        .map(toEconomyTransaction);
    }

    return this.requireEconomyLedgerForReads().listTransactions(criteria);
  }

  public getEconomyLedgerEntries(transactionId: string): LedgerEntry[] {
    if (this.spacetime) {
      return this.spacetime.cache.getLedgerEntriesForTransaction(transactionId).map(toEconomyLedgerEntry);
    }

    return this.requireEconomyLedgerForReads().getLedgerEntriesForTransaction(transactionId);
  }

  public getEconomyAccountStatement(criteria: AccountStatementCriteria): AccountStatement {
    if (this.spacetime) {
      const account = this.spacetime.cache.getAccount(criteria.accountId);
      if (!account) {
        throw new Error(`Unknown account: ${criteria.accountId}`);
      }

      return buildAccountStatement({
        account: toEconomyAccount(account),
        entries: this.spacetime.cache.getLedgerEntriesForAccount(criteria.accountId).map(toEconomyLedgerEntry),
        from: criteria.from,
        to: criteria.to
      });
    }

    return this.requireEconomyLedgerForReads().getAccountStatement(criteria);
  }

  public exportEconomyAccountStatementCsv(criteria: AccountStatementCriteria): string {
    return accountStatementToCsv(this.getEconomyAccountStatement(criteria));
  }

  public findSuspiciousEconomyActivity(criteria: SuspiciousActivityCriteria = {}): SuspiciousEconomyActivity[] {
    if (this.spacetime) {
      const transactions = this.spacetime.cache.getTransactions({
        actorId: criteria.actorId,
        transactionType: criteria.type
      });
      return findSuspiciousEconomyActivity(
        transactions.map((transaction) => ({
          transaction: toEconomyTransaction(transaction),
          entries: this.spacetime!.cache.getLedgerEntriesForTransaction(transaction.id).map(toEconomyLedgerEntry)
        })),
        criteria
      );
    }

    return this.requireEconomyLedgerForReads().findSuspiciousActivity(criteria);
  }

  public async registerGameplayItem(input: RegisterItemReducerInput): Promise<void> {
    await this.requireSpacetimeForGameplay().registerItem(input);
  }

  public async registerGameplayJob(input: RegisterGameplayJobInput): Promise<void> {
    await this.requireSpacetimeForGameplay().registerJob({
      key: input.key,
      pluginId: input.pluginId,
      label: input.label,
      gradesJson: JSON.stringify(input.grades)
    });
  }

  public async registerGameplayVehicle(input: RegisterVehicleReducerInput): Promise<void> {
    await this.requireSpacetimeForGameplay().registerVehicle(input);
  }

  public async registerGameplayLocation(input: RegisterLocationReducerInput): Promise<void> {
    await this.requireSpacetimeForGameplay().registerLocation(input);
  }

  public async upsertGameplayCharacter(input: UpsertCharacterReducerInput): Promise<void> {
    await this.requireSpacetimeForGameplay().upsertCharacter({
      ...input,
      gangJson: input.gangJson ?? "{}"
    });
  }

  public async selectGameplayCharacter(characterId: string): Promise<void> {
    const spacetime = this.requireSpacetimeForGameplay();
    const character = spacetime.cache.getCharacter(characterId);
    if (!character) {
      throw new Error(`Unknown character: ${characterId}`);
    }

    await spacetime.upsertCharacter({
      id: character.id,
      playerPrincipalId: character.playerPrincipalId,
      citizenId: character.citizenId,
      cid: character.cid,
      slot: character.slot,
      license: character.license,
      name: character.name,
      charinfoJson: character.charinfoJson,
      metadataJson: character.metadataJson,
      gangJson: character.gangJson ?? "{}",
      positionJson: character.positionJson,
      phoneNumber: character.phoneNumber,
      accountNumber: character.accountNumber,
      selected: true
    });
  }

  public async applyQbCoreRuntimeCharacterUpdates(updates: QbCoreRuntimeCharacterUpdate[]): Promise<number> {
    for (const update of updates) {
      await this.upsertGameplayCharacter({
        id: update.characterId,
        playerPrincipalId: update.playerPrincipalId,
        citizenId: update.citizenId,
        cid: update.cid,
        slot: update.slot,
        license: update.license,
        name: update.name,
        charinfoJson: update.charinfoJson,
        metadataJson: update.metadataJson,
        gangJson: update.gangJson ?? "{}",
        positionJson: update.positionJson,
        phoneNumber: update.phoneNumber,
        accountNumber: update.accountNumber,
        selected: update.selected
      });
    }

    return updates.length;
  }

  public async applyQbCoreRuntimeCharacterSelections(selections: QbCoreRuntimeCharacterSelection[]): Promise<number> {
    for (const selection of selections) {
      await this.selectGameplayCharacter(selection.characterId);
    }

    return selections.length;
  }

  public async applyQbCoreRuntimeMoneyUpdates(updates: QbCoreRuntimeMoneyUpdate[]): Promise<number> {
    const spacetime = this.requireSpacetimeForEconomy();
    let applied = 0;

    for (const update of updates) {
      validateEconomyAmount(update.amount);
      validateEconomyReason(update.reason);
      const account = spacetime.cache.getAccountsForOwner("character", update.characterId)
        .find((candidate) => candidate.currency === update.moneyType && candidate.status === "active");
      if (!account) {
        throw new Error(`Unknown active QBCore money account: ${update.characterId}:${update.moneyType}`);
      }

      const currentBalance = Number(account.balance);
      const adjustment = update.operation === "set"
        ? update.amount - currentBalance
        : update.amount;
      if (adjustment === 0) {
        continue;
      }

      await this.adjustEconomyBalance({
        transactionId: update.transactionId,
        actorId: update.actorId,
        accountId: account.id,
        direction: update.operation === "remove" || adjustment < 0 ? "debit" : "credit",
        amount: Math.abs(adjustment),
        reason: update.reason,
        idempotencyKey: update.idempotencyKey
      });
      applied += 1;
    }

    return applied;
  }

  public async applyQbCoreRuntimeInventoryUpdates(updates: QbCoreRuntimeInventoryUpdate[]): Promise<number> {
    let applied = 0;

    for (const update of updates) {
      validateEconomyAmount(update.amount);
      const input = {
        id: update.id,
        ownerId: update.characterId,
        itemKey: update.itemKey,
        quantity: update.amount
      };

      if (update.operation === "add") {
        await this.grantGameplayItem(input);
      } else {
        await this.removeGameplayItem(input);
      }
      applied += 1;
    }

    return applied;
  }

  public async grantGameplayItem(input: GrantItemReducerInput): Promise<void> {
    await this.requireSpacetimeForGameplay().grantItem(input);
  }

  public async removeGameplayItem(input: RemoveItemReducerInput): Promise<void> {
    await this.requireSpacetimeForGameplay().removeItem(input);
  }

  public async assignGameplayJob(input: AssignJobReducerInput): Promise<void> {
    await this.requireSpacetimeForGameplay().assignJob(input);
  }

  public getGameplaySnapshot(): AdminGameplaySnapshot {
    const spacetime = this.requireSpacetimeForGameplay();
    return {
      items: spacetime.cache.getItems(),
      jobs: spacetime.cache.getJobs(),
      vehicles: spacetime.cache.getVehicles(),
      locations: spacetime.cache.getLocations(),
      characters: spacetime.cache.getCharacters(),
      inventory: spacetime.cache.getInventoryStacks(),
      characterJobs: spacetime.cache.getCharacterJobs()
    };
  }

  public getQbCorePlayerDataSnapshots(input: { serverId?: string } = {}): QbCorePlayerDataSnapshot[] {
    const spacetime = this.requireSpacetimeForGameplay();
    const sessions = spacetime.cache.getMenuSessions()
      .filter((session) => !input.serverId || session.serverId === input.serverId);

    return sessions
      .sort((left, right) => left.serverId.localeCompare(right.serverId) || left.playerId.localeCompare(right.playerId))
      .map((session) => this.buildQbCorePlayerDataSnapshot(session));
  }

  public async upsertMenuDefinition(input: UpsertMenuDefinitionReducerInput): Promise<void> {
    await this.requireSpacetimeForMenus().upsertMenuDefinition(input);
  }

  public async upsertMenuAction(input: UpsertMenuActionReducerInput): Promise<void> {
    await this.requireSpacetimeForMenus().upsertMenuAction(input);
  }

  public async upsertRuntimeCommand(input: UpsertRuntimeCommandReducerInput): Promise<void> {
    await this.requireSpacetimeForMenus().upsertRuntimeCommand(input);
  }

  public async upsertRuntimePanel(input: UpsertRuntimePanelReducerInput): Promise<void> {
    await this.requireSpacetimeForMenus().upsertRuntimePanel(input);
  }

  public async upsertMenuVisibilityPolicy(input: UpsertMenuVisibilityPolicyReducerInput): Promise<void> {
    await this.requireSpacetimeForMenus().upsertMenuVisibilityPolicy(input);
  }

  public async openMenuSession(input: OpenMenuSessionReducerInput): Promise<void> {
    await this.requireSpacetimeForMenus().openMenuSession(input);
  }

  public async closeMenuSession(sessionId: string): Promise<void> {
    await this.requireSpacetimeForMenus().closeMenuSession(sessionId);
  }

  public getMenuRegistry(): AdminMenuRegistrySnapshot {
    const spacetime = this.requireSpacetimeForMenus();
    return {
      definitions: spacetime.cache.getMenuDefinitions(),
      actions: spacetime.cache.getMenuActions(),
      commands: spacetime.cache.getRuntimeCommands(),
      panels: spacetime.cache.getRuntimePanels(),
      policies: spacetime.cache.getMenuVisibilityPolicies(),
      sessions: spacetime.cache.getMenuSessions()
    };
  }

  public planActiveMenuRefreshes(input: { serverId?: string } = {}): MenuRefreshTarget[] {
    const sessions = this.spacetime?.cache.getMenuSessions() ?? [];
    return sessions
      .filter((session) => !input.serverId || session.serverId === input.serverId)
      .map((session) => ({
        serverId: session.serverId,
        playerId: session.playerId,
        sessionId: session.id,
        cacheVersion: session.cacheVersion
      }))
      .sort(compareMenuRefreshTargets);
  }

  public drainPendingMenuRefreshes(input: { serverId?: string } = {}): MenuRefreshTarget[] {
    const targets = [...this.pendingMenuRefreshTargets.values()]
      .filter((target) => !input.serverId || target.serverId === input.serverId)
      .sort(compareMenuRefreshTargets);

    for (const target of targets) {
      this.pendingMenuRefreshTargets.delete(menuRefreshTargetKey(target));
    }

    return targets;
  }

  public queueReplicatedState(updates: ReplicatedStateUpdate[]): ReplicatedStateUpdate[] {
    const queued = updates.map(validateReplicatedStateUpdate);
    for (const update of queued) {
      this.pendingReplicatedStateUpdates.set(replicatedStateUpdateKey(update), update);
    }

    return queued;
  }

  public drainReplicatedState(input: { serverId?: string } = {}): ReplicatedStateUpdate[] {
    const updates = [...this.pendingReplicatedStateUpdates.values()]
      .filter((update) => !input.serverId || update.serverId === input.serverId)
      .sort(compareReplicatedStateUpdates);

    for (const update of updates) {
      this.pendingReplicatedStateUpdates.delete(replicatedStateUpdateKey(update));
    }

    return updates;
  }

  public queueVehicleSpawns(spawns: VehicleSpawnDispatch[]): VehicleSpawnDispatch[] {
    const queued = spawns.map(validateVehicleSpawnDispatch);
    for (const spawn of queued) {
      this.pendingVehicleSpawns.set(vehicleSpawnDispatchKey(spawn), spawn);
    }

    return queued;
  }

  public drainVehicleSpawns(input: { serverId?: string } = {}): VehicleSpawnDispatch[] {
    const spawns = [...this.pendingVehicleSpawns.values()]
      .filter((spawn) => !input.serverId || spawn.serverId === input.serverId)
      .sort(compareVehicleSpawnDispatches);

    for (const spawn of spawns) {
      this.pendingVehicleSpawns.delete(vehicleSpawnDispatchKey(spawn));
    }

    return spawns;
  }

  public queueVehicleRepairs(repairs: VehicleRepairDispatch[]): VehicleRepairDispatch[] {
    const queued = repairs.map(validateVehicleRepairDispatch);
    for (const repair of queued) {
      this.pendingVehicleRepairs.set(vehicleRepairDispatchKey(repair), repair);
    }

    return queued;
  }

  public drainVehicleRepairs(input: { serverId?: string } = {}): VehicleRepairDispatch[] {
    const repairs = [...this.pendingVehicleRepairs.values()]
      .filter((repair) => !input.serverId || repair.serverId === input.serverId)
      .sort(compareVehicleRepairDispatches);

    for (const repair of repairs) {
      this.pendingVehicleRepairs.delete(vehicleRepairDispatchKey(repair));
    }

    return repairs;
  }

  public queueWorldState(updates: WorldStateUpdate[]): WorldStateUpdate[] {
    const queued = updates.map(validateWorldStateUpdate);
    for (const update of queued) {
      this.pendingWorldStateUpdates.set(worldStateUpdateKey(update), update);
    }

    return queued;
  }

  public drainWorldState(input: { serverId?: string } = {}): WorldStateUpdate[] {
    const updates = [...this.pendingWorldStateUpdates.values()]
      .filter((update) => !input.serverId || update.serverId === input.serverId)
      .sort(compareWorldStateUpdates);

    for (const update of updates) {
      this.pendingWorldStateUpdates.delete(worldStateUpdateKey(update));
    }

    return updates;
  }

  public queueTeleports(teleports: TeleportDispatch[]): TeleportDispatch[] {
    const queued = teleports.map(validateTeleportDispatch);
    for (const teleport of queued) {
      this.pendingTeleports.set(teleportDispatchKey(teleport), teleport);
    }

    return queued;
  }

  public drainTeleports(input: { serverId?: string } = {}): TeleportDispatch[] {
    const teleports = [...this.pendingTeleports.values()]
      .filter((teleport) => !input.serverId || teleport.serverId === input.serverId)
      .sort(compareTeleportDispatches);

    for (const teleport of teleports) {
      this.pendingTeleports.delete(teleportDispatchKey(teleport));
    }

    return teleports;
  }

  public queueKicks(kicks: KickDispatch[]): KickDispatch[] {
    const queued = kicks.map(validateKickDispatch);
    for (const kick of queued) {
      this.pendingKicks.set(kickDispatchKey(kick), kick);
    }

    return queued;
  }

  public drainKicks(input: { serverId?: string } = {}): KickDispatch[] {
    const kicks = [...this.pendingKicks.values()]
      .filter((kick) => !input.serverId || kick.serverId === input.serverId)
      .sort(compareKickDispatches);

    for (const kick of kicks) {
      this.pendingKicks.delete(kickDispatchKey(kick));
    }

    return kicks;
  }

  public async registerPluginSchema(input: RegisterPluginSchemaReducerInput): Promise<void> {
    const schema = validatePluginSchemaJson(input.entityType, input.schemaJson);
    validatePluginSchemaMigrationPlanJson(input.entityType, input.migrationPlanJson);
    await this.requireSpacetimeForPluginData().registerPluginSchema(input);
    const key = this.pluginSchemaKey(input.pluginId, input.entityType);
    if (input.status === "active") {
      this.activePluginSchemasByKey.set(key, schema);
    } else {
      this.activePluginSchemasByKey.delete(key);
    }
  }

  public async upsertPluginEntity(input: UpsertPluginEntityReducerInput): Promise<void> {
    const schema = this.getActivePluginSchema(input.pluginId, input.entityType);
    const data = parsePluginEntityData(input.entityType, input.dataJson);
    validateSchema(schema, data);
    await this.requireSpacetimeForPluginData().upsertPluginEntity(input);
  }

  public getPluginDataSnapshot(input: { pluginId?: string; entityType?: string } = {}): AdminPluginDataSnapshot {
    const spacetime = this.requireSpacetimeForPluginData();
    return {
      schemas: spacetime.cache.getPluginSchemas(input.pluginId)
        .filter((schema) => !input.entityType || schema.entityType === input.entityType),
      entities: spacetime.cache.getPluginEntities(input.pluginId, input.entityType)
    };
  }

  public async flushWrites(): Promise<void> {
    await this.writeQueue;
  }

  private getActivePluginSchema(pluginId: string, entityType: string): SimpleJsonSchema {
    const key = this.pluginSchemaKey(pluginId, entityType);
    const local = this.activePluginSchemasByKey.get(key);
    if (local) {
      return local;
    }

    const cached = this.spacetime?.cache
      .getPluginSchemas(pluginId)
      .filter((schema) => schema.entityType === entityType && schema.status === "active")
      .sort((left, right) => right.schemaVersion - left.schemaVersion)[0];
    if (!cached) {
      throw new Error(`No active schema registered for ${pluginId}:${entityType}`);
    }

    return validatePluginSchemaJson(cached.entityType, cached.schemaJson);
  }

  private pluginSchemaKey(pluginId: string, entityType: string): string {
    return `${pluginId}:${entityType}`;
  }

  private buildQbCorePlayerDataSnapshot(session: MenuSessionRow): QbCorePlayerDataSnapshot {
    const spacetime = this.requireSpacetimeForGameplay();
    const source = session.playerId;
    const principal = spacetime.cache.getPrincipal(`player:${source}`);
    const character = spacetime.cache.getSelectedCharacterForPlayer(`player:${source}`);
    const characterId = character?.id ?? (source.startsWith("char:") ? source : `char:${source}`);
    const name = character?.name ?? principal?.name ?? source;
    const money: Record<string, number> = {};

    for (const account of spacetime.cache.getAccountsForOwner("character", characterId)) {
      if (account.status === "active") {
        money[account.currency] = Number(account.balance);
      }
    }

    const characterJob = spacetime.cache.getCharacterJob(characterId);
    const jobDefinition = characterJob ? spacetime.cache.getJob(characterJob.jobKey) : undefined;
    const grades = parseQbCoreJobGrades(jobDefinition?.gradesJson);
    const gradeLevel = characterJob ? Math.max(0, grades.indexOf(characterJob.grade)) : 0;

    const position = character ? parseOptionalQbCoreJsonObject(character.positionJson) : undefined;
    const snapshot: QbCorePlayerDataSnapshot = {
      serverId: session.serverId,
      source,
      characterId,
      citizenid: character?.citizenId ?? characterId,
      cid: character?.cid ?? (Number(source) || 0),
      license: character?.license || principal?.externalId || source,
      name,
      charinfo: character ? parseQbCoreJsonObject(character.charinfoJson) : qbCoreCharInfoFromName(name),
      money,
      job: characterJob
        ? {
            name: characterJob.jobKey,
            label: jobDefinition?.label ?? characterJob.jobKey,
            payment: 0,
            onduty: characterJob.onDuty,
            isboss: false,
            grade: {
              name: characterJob.grade,
              level: gradeLevel
            }
          }
        : defaultQbCoreJob(),
      gang: character?.gangJson ? parseQbCoreJsonObject(character.gangJson) : defaultQbCoreGang(),
      metadata: character ? parseQbCoreJsonObject(character.metadataJson) : {},
      items: spacetime.cache.getInventoryForOwner(characterId).map((stack, index) => {
        const item = spacetime.cache.getItem(stack.itemKey);
        return {
          name: stack.itemKey,
          label: item?.label ?? stack.itemKey,
          amount: stack.quantity,
          slot: index + 1,
          info: {},
          type: "item"
        };
      })
    };
    if (position) {
      snapshot.position = position;
    }
    return snapshot;
  }

  public mirrorRuntimeAuditLogs(serverId: string): void {
    for (const entry of this.runtime.getAuditLogs(serverId)) {
      if (this.mirroredRuntimeAuditIds.has(entry.id)) {
        continue;
      }
      this.mirroredRuntimeAuditIds.add(entry.id);
      this.enqueueWrite(() =>
        this.spacetime?.writeAuditLog({
          id: entry.id,
          serverId: entry.serverId ?? serverId,
          actorId: entry.actorId,
          pluginId: entry.pluginId ?? "",
          actionType: entry.actionType,
          permissionKey: entry.permissionKey ?? "",
          targetType: entry.targetType ?? "",
          targetId: entry.targetId ?? "",
          beforeJson: JSON.stringify(entry.before ?? {}),
          afterJson: JSON.stringify(entry.after ?? {}),
          status: entry.status
        })
      );
    }
  }

  public requestPluginDeployment(input: {
    pluginId: string;
    bundleId: string;
    serverId: string;
    bundleBytes: string | Buffer;
    requestedBy: string;
  }): PluginDeploymentRecord {
    const deployment = this.requireDeployments().requestDeployment(input);
    this.mirrorDeployment(deployment);
    this.mirrorDeploymentAuditLogs(deployment.serverId);
    return deployment;
  }

  public async requestPluginDeploymentFromArtifact(input: {
    pluginId: string;
    bundleId: string;
    serverId: string;
    requestedBy: string;
  }): Promise<PluginDeploymentRecord> {
    const deployment = await this.requireDeployments().requestDeploymentFromArtifact(input);
    this.mirrorDeployment(deployment);
    this.mirrorDeploymentAuditLogs(deployment.serverId);
    return deployment;
  }

  public approvePluginDeployment(deploymentId: string, approvedBy: string): PluginDeploymentRecord {
    const deployments = this.requireDeployments();
    const before = new Map(deployments.listDeployments().map((deployment) => [deployment.id, deployment.status]));
    const deployment = deployments.approveDeployment(deploymentId, approvedBy);
    for (const candidate of deployments.listDeployments()) {
      if (candidate.id === deployment.id || before.get(candidate.id) !== candidate.status) {
        this.mirrorDeployment(candidate);
      }
    }
    this.mirrorDeploymentAuditLogs(deployment.serverId);
    return deployment;
  }

  public rollbackPluginDeployment(pluginId: string, serverId: string): PluginDeploymentRecord {
    const deployments = this.requireDeployments();
    const before = new Map(deployments.listDeployments().map((deployment) => [deployment.id, deployment.status]));
    const rollback = deployments.rollback(pluginId, serverId);
    for (const deployment of deployments.listDeployments()) {
      if (deployment.id === rollback.id || before.get(deployment.id) !== deployment.status) {
        this.mirrorDeployment(deployment);
      }
    }
    this.mirrorDeploymentAuditLogs(serverId);
    return rollback;
  }

  public failPluginDeployment(
    deploymentId: string,
    actorId: string,
    reason: string
  ): PluginDeploymentFailureResult {
    const result = this.requireDeployments().failDeployment(deploymentId, actorId, reason);
    this.mirrorDeployment(result.failed);
    if (result.rollback) {
      this.mirrorDeployment(result.rollback);
    }
    this.mirrorDeploymentAuditLogs(result.failed.serverId);
    return result;
  }

  public failPluginSidecarDeployments(
    instances: PluginSidecarInstance[],
    sandboxEvents: PluginSandboxEvent[] = []
  ): PluginDeploymentFailureResult[] {
    this.mirrorPluginSandboxEvents(sandboxEvents);
    const deployments = this.requireDeployments();
    const deploymentStatusById = new Map(
      deployments.listDeployments().map((deployment) => [deployment.id, deployment.status])
    );
    const results: PluginDeploymentFailureResult[] = [];
    for (const instance of instances) {
      const status = deploymentStatusById.get(instance.deploymentId);
      if (status !== "active" && status !== "pending") {
        continue;
      }
      results.push(this.failPluginDeployment(
        instance.deploymentId,
        `runtime:${instance.serverId}`,
        `sidecar ${instance.errorMessage ?? "failed"}`
      ));
    }
    return results;
  }

  public killPlugin(pluginId: string, actorId: string, reason: string): PluginDeploymentRecord[] {
    const deployments = this.requireDeployments().killSwitch(pluginId, actorId, reason);
    deployments.forEach((deployment) => this.mirrorDeployment(deployment));
    for (const deployment of deployments) {
      this.mirrorDeploymentAuditLogs(deployment.serverId);
    }
    return deployments;
  }

  public revokePluginSigner(
    signerId: string,
    actorId: string,
    reason: string,
    serverId: string
  ): PluginDeploymentRecord[] {
    const deployments = this.requireDeployments();
    const killed = deployments.revokeSigner(signerId, actorId, reason);
    killed.forEach((deployment) => this.mirrorDeployment(deployment));
    this.mirrorDeploymentAuditLogs(serverId);
    return killed;
  }

  public revokePluginBundle(
    bundleId: string,
    actorId: string,
    reason: string,
    serverId: string
  ): PluginDeploymentRecord[] {
    const deployments = this.requireDeployments();
    const killed = deployments.revokeBundle(bundleId, actorId, reason);
    const bundle = deployments.listBundles().find((candidate) => candidate.id === bundleId);
    if (bundle) {
      this.mirrorBundleRevocation(bundle, actorId, reason);
    }
    killed.forEach((deployment) => this.mirrorDeployment(deployment));
    this.mirrorDeploymentAuditLogs(serverId);
    return killed;
  }

  public registerPluginBundle(input: {
    id: string;
    pluginId: string;
    version: string;
    artifactUrl: string;
    bundleHash: string;
    signature: string;
    signerId: string;
    runtimeType: "wasm" | "js_sidecar" | "native_sidecar";
    capabilities: PluginCapability[];
  }): PluginBundleRecord {
    const bundle = this.requireDeployments().registerBundle(input);
    this.mirrorBundle(bundle);
    bundle.capabilities.forEach((capability) => this.mirrorCapability(bundle, capability));
    return bundle;
  }

  public getPluginCapability(pluginId: string, capabilityKey: string, serverId?: string): PluginCapability {
    if (this.spacetime) {
      return this.getSpacetimePluginCapability(pluginId, capabilityKey, serverId);
    }

    const deployments = this.requireDeployments();
    return serverId
      ? deployments.assertCapabilityForServer(pluginId, serverId, capabilityKey)
      : deployments.assertCapability(pluginId, capabilityKey);
  }

  public getDeploymentSnapshot(): AdminDeploymentSnapshot {
    if (this.spacetime) {
      return {
        bundles: this.spacetime.cache.getBundles(),
        capabilities: this.spacetime.cache.getCapabilities(),
        deployments: this.spacetime.cache.getDeployments(),
        sandboxEvents: this.spacetime.cache.getPluginSandboxEvents()
      };
    }

    const deployments = this.requireDeployments();
    return {
      bundles: deployments.listBundles(),
      capabilities: deployments.listBundles().flatMap((bundle) =>
        bundle.capabilities.map((capability) => ({
          id: `${bundle.id}:${capability.key}`,
          pluginId: bundle.pluginId,
          bundleId: bundle.id,
          capabilityKey: capability.key,
          constraintsJson: JSON.stringify(capability.constraints ?? {}),
          status: bundle.status === "registered" ? "enabled" : "disabled"
        }))
      ),
      deployments: deployments.listDeployments(),
      sandboxEvents: [...this.localSandboxEventsById.values()]
    };
  }

  public mirrorPluginSandboxEvents(events: PluginSandboxEvent[]): void {
    for (const event of events) {
      if (this.mirroredSandboxEventIds.has(event.id)) {
        continue;
      }
      this.mirroredSandboxEventIds.add(event.id);
      this.localSandboxEventsById.set(event.id, {
        id: event.id,
        pluginId: event.pluginId,
        serverId: event.serverId,
        eventType: event.eventType,
        payloadHash: event.payloadHash,
        status: event.status,
        createdAt: event.createdAt
      });
      this.enqueueWrite(() =>
        this.spacetime?.recordPluginSandboxEvent({
          id: event.id,
          pluginId: event.pluginId,
          serverId: event.serverId,
          eventType: event.eventType,
          payloadHash: event.payloadHash,
          status: event.status
        } satisfies RecordPluginSandboxEventReducerInput)
      );
    }
  }

  private requireDeployments(): PluginDeploymentManager {
    if (!this.deployments) {
      throw new Error("Plugin deployment manager is not configured");
    }

    return this.deployments;
  }

  private getSpacetimePluginCapability(
    pluginId: string,
    capabilityKey: string,
    serverId?: string
  ): PluginCapability {
    const deployments = this.spacetime?.cache.getDeployments() ?? [];
    const activeDeployment = deployments
      .filter((deployment) =>
        deployment.pluginId === pluginId &&
        deployment.status === "active" &&
        (!serverId || deployment.serverId === serverId)
      )
      .sort((left, right) => {
        const leftTime = timestampMs(left.deployedAt);
        const rightTime = timestampMs(right.deployedAt);
        return rightTime - leftTime || right.id.localeCompare(left.id);
      })
      .at(0);

    if (!activeDeployment) {
      throw new Error(serverId
        ? `Plugin is not active on server ${serverId}: ${pluginId}`
        : `Plugin is not active: ${pluginId}`);
    }

    const capability = (this.spacetime?.cache.getCapabilities() ?? [])
      .find((candidate) =>
        candidate.pluginId === pluginId &&
        candidate.bundleId === activeDeployment.bundleId &&
        candidate.capabilityKey === capabilityKey &&
        candidate.status === "enabled"
      );
    if (!capability) {
      throw new Error(`Plugin lacks capability: ${capabilityKey}`);
    }

    const constraints = parsePluginCapabilityConstraints(capability);
    return constraints === undefined
      ? { key: capability.capabilityKey }
      : { key: capability.capabilityKey, constraints };
  }

  private getSpacetimeDashboard(serverId: string): AdminDashboard | undefined {
    if (!this.spacetime) {
      return undefined;
    }

    const server = this.spacetime.cache.getServer(serverId);
    if (!server) {
      return undefined;
    }

    const latestInstance = this.spacetime.cache.getRuntimeInstances()
      .filter((instance) => instance.serverId === serverId)
      .sort((left, right) => timestampMs(right.lastSeenAt) - timestampMs(left.lastSeenAt) || right.id.localeCompare(left.id))[0];

    return {
      health: {
        serverId: server.id,
        serverName: server.name,
        environment: server.environment,
        status: latestInstance?.status === "online" ? "online" : "degraded",
        reason: latestInstance ? "runtime heartbeat current" : "no runtime heartbeat",
        resourceVersion: latestInstance?.resourceVersion,
        fxserverBuild: latestInstance?.fxserverBuild,
        gameBuild: latestInstance?.gameBuild,
        lastHeartbeatAt: server.lastHeartbeatAt,
        lastSeenAt: latestInstance?.lastSeenAt
      },
      config: this.spacetime.cache.getConfigSnapshot(),
      plugins: this.spacetime.cache.listPlugins(),
      auditLogs: this.spacetime.cache.getAuditLogs().map(toAuditLogEntry)
    };
  }

  private getSpacetimePermissionSnapshot(): PermissionSnapshot | undefined {
    if (!this.spacetime) {
      return undefined;
    }

    const principals = this.spacetime.cache.getPrincipals();
    const permissions = this.spacetime.cache.getPermissions();
    const edges = this.spacetime.cache.getPrincipalEdges();
    const grants = this.spacetime.cache.getPermissionGrants();
    const policies = this.spacetime.cache.getPolicyConstraints();
    const aceMirrorRules = this.spacetime.cache.getAceMirrorRules();
    if (
      principals.length === 0 &&
      permissions.length === 0 &&
      edges.length === 0 &&
      grants.length === 0 &&
      policies.length === 0 &&
      aceMirrorRules.length === 0
    ) {
      return undefined;
    }

    return {
      permissions,
      principals: principals.map(toPrincipal),
      edges: edges.map(toPrincipalEdge),
      grants: grants.map(toPermissionGrant),
      policies: policies.map(toPolicyConstraint),
      aceMirrorRules
    };
  }

  private requireSpacetimeForEconomy(): SpacetimeRuntimeAdapter {
    if (!this.spacetime) {
      throw new Error("SpacetimeDB adapter is required for economy admin mutations");
    }

    return this.spacetime;
  }

  private requireEconomyLedgerForReads(): EconomyLedger {
    if (!this.economy) {
      throw new Error("Economy ledger is required for economy dashboard reads");
    }

    return this.economy;
  }

  private getEconomyAuditLogs(): AuditLogEntry[] {
    return this.economy?.getAuditLogs() ?? [];
  }

  private requireSpacetimeForGameplay(): SpacetimeRuntimeAdapter {
    if (!this.spacetime) {
      throw new Error("SpacetimeDB adapter is required for gameplay admin mutations");
    }

    return this.spacetime;
  }

  private requireSpacetimeForMenus(): SpacetimeRuntimeAdapter {
    if (!this.spacetime) {
      throw new Error("SpacetimeDB adapter is required for menu admin mutations");
    }

    return this.spacetime;
  }

  private requireSpacetimeForPluginData(): SpacetimeRuntimeAdapter {
    if (!this.spacetime) {
      throw new Error("SpacetimeDB adapter is required for plugin data admin mutations");
    }

    return this.spacetime;
  }

  private enqueueWrite(write: () => Promise<unknown> | undefined): void {
    if (!this.spacetime) {
      return;
    }

    this.writeQueue = this.writeQueue.then(() => write());
    this.writeQueue.catch(() => undefined);
  }

  private queueMenuRefreshes(): void {
    for (const target of this.planActiveMenuRefreshes()) {
      this.pendingMenuRefreshTargets.set(menuRefreshTargetKey(target), target);
    }
  }

  private mirrorDeployment(deployment: PluginDeploymentRecord): void {
    this.enqueueWrite(() =>
      this.spacetime?.upsertPluginDeployment({
        id: deployment.id,
        pluginId: deployment.pluginId,
        bundleId: deployment.bundleId,
        serverId: deployment.serverId,
        status: deployment.status,
        desiredVersion: deployment.desiredVersion,
        activeVersion: deployment.activeVersion ?? "",
        errorMessage: deployment.errorMessage ?? ""
      })
    );
  }

  private mirrorDeploymentAuditLogs(serverId: string): void {
    if (!this.deployments) {
      return;
    }

    for (const entry of this.deployments.getAuditLogs()) {
      if (this.mirroredDeploymentAuditIds.has(entry.id)) {
        continue;
      }
      this.mirroredDeploymentAuditIds.add(entry.id);
      this.enqueueWrite(() =>
        this.spacetime?.writeAuditLog({
          id: entry.id,
          serverId: entry.serverId ?? serverId,
          actorId: entry.actorId,
          pluginId: entry.pluginId ?? "",
          actionType: entry.actionType,
          permissionKey: entry.permissionKey ?? "",
          targetType: entry.targetType ?? "",
          targetId: entry.targetId ?? "",
          beforeJson: JSON.stringify(entry.before ?? {}),
          afterJson: JSON.stringify(entry.after ?? { revoked: entry.actionType === "plugin.signer_revoked" }),
          status: entry.status
        })
      );
    }
  }

  private mirrorPluginAuditLogs(): void {
    const existingRemoteAuditIds = new Set(this.spacetime?.cache.getAuditLogs().map((entry) => entry.id) ?? []);
    for (const entry of this.plugins.getAuditEvents()) {
      if (this.mirroredPluginAuditIds.has(entry.id) || existingRemoteAuditIds.has(entry.id)) {
        continue;
      }

      this.mirroredPluginAuditIds.add(entry.id);
      this.enqueueWrite(() =>
        this.spacetime?.writeAuditLog({
          id: entry.id,
          serverId: this.controlPlaneServerId,
          actorId: entry.actorId,
          pluginId: entry.pluginId ?? "",
          actionType: entry.actionType,
          permissionKey: entry.permissionKey ?? "",
          targetType: entry.targetType ?? "",
          targetId: entry.targetId ?? "",
          beforeJson: JSON.stringify(entry.before ?? {}),
          afterJson: JSON.stringify(entry.after ?? {}),
          status: entry.status
        })
      );
    }
  }

  private assertPackageSignerNotRevoked(signerId: string): void {
    if (this.spacetime?.cache.getPackageSignerRevocation(signerId)) {
      throw new Error(`Package signer has been revoked: ${signerId}`);
    }
  }

  private mirrorBundle(bundle: PluginBundleRecord): void {
    this.enqueueWrite(() =>
      this.spacetime?.registerPluginBundle({
        id: bundle.id,
        pluginId: bundle.pluginId,
        version: bundle.version,
        artifactUrl: bundle.artifactUrl,
        bundleHash: bundle.bundleHash,
        signature: bundle.signature,
        signerId: bundle.signerId,
        runtimeType: bundle.runtimeType,
        status: bundle.status
      } satisfies RegisterPluginBundleReducerInput)
    );
  }

  private mirrorBundleRevocation(bundle: PluginBundleRecord, actorId: string, reason: string): void {
    this.enqueueWrite(() =>
      this.spacetime?.revokePluginBundle({
        bundleId: bundle.id,
        status: bundle.status,
        actorId,
        reason
      } satisfies RevokePluginBundleReducerInput)
    );
  }

  private mirrorPluginManifest(manifest: PluginManifest): void {
    if (this.spacetime?.cache.getPluginManifest(manifest.pluginId)) {
      return;
    }

    this.enqueueWrite(() =>
      this.spacetime?.registerPluginManifest({
        pluginId: manifest.pluginId,
        manifestJson: JSON.stringify(manifest),
        requiredPermissions: (manifest.permissions ?? []).map((permission) => permission.key).join(","),
        requiredTables: "plugin_entities",
        requiredHooks: (manifest.hooks ?? []).map((hook) => hook.hookName).join(","),
        requiredConnectors: "",
        schemaVersion: 1
      } satisfies RegisterPluginManifestReducerInput)
    );
  }

  private mirrorApprovedPluginSchemas(pluginId: string): void {
    for (const schema of this.plugins.getApprovedSchemaDeclarations().filter((entry) => entry.pluginId === pluginId)) {
      if (this.spacetime?.cache.getPluginSchema(schema.pluginId, schema.entityType, schema.schemaVersion)) {
        continue;
      }

      this.enqueueWrite(() =>
        this.spacetime?.registerPluginSchema({
          pluginId: schema.pluginId,
          entityType: schema.entityType,
          schemaVersion: schema.schemaVersion,
          schemaJson: JSON.stringify(schema.schema),
          migrationPlanJson: JSON.stringify(schema.migrationPlan),
          status: "active"
        } satisfies RegisterPluginSchemaReducerInput)
      );
    }
  }

  private mirrorPluginHooks(pluginId: string): void {
    for (const hook of this.plugins.getActiveHooks().filter((entry) => entry.pluginId === pluginId)) {
      this.enqueueWrite(() =>
        this.spacetime?.registerPluginHook({
          id: hook.id,
          pluginId: hook.pluginId,
          hookName: hook.hookName,
          capability: hook.capability,
          handlerType: hook.handlerType,
          handlerRef: hook.handlerRef,
          priority: hook.priority
        } satisfies RegisterPluginHookReducerInput)
      );
    }
  }

  private mirrorPluginHooksEnabled(pluginId: string, enabled: boolean): void {
    this.enqueueWrite(() =>
      this.spacetime?.setPluginHooksEnabled({
        pluginId,
        enabled
      } satisfies SetPluginHooksEnabledReducerInput)
    );
  }

  private killDeploymentsForDisabledPlugin(pluginId: string): void {
    if (!this.deployments) {
      return;
    }

    const hasActionableDeployment = this.deployments.listDeployments().some((deployment) =>
      deployment.pluginId === pluginId &&
      (deployment.status === "active" || deployment.status === "pending")
    );
    if (!hasActionableDeployment) {
      return;
    }

    const killed = this.deployments.killSwitch(pluginId, "system", "plugin disabled");
    killed.forEach((deployment) => this.mirrorDeployment(deployment));
    for (const deployment of killed) {
      this.mirrorDeploymentAuditLogs(deployment.serverId);
    }
  }

  private mirrorCapability(bundle: PluginBundleRecord, capability: PluginCapability): void {
    this.enqueueWrite(() =>
      this.spacetime?.upsertPluginCapability({
        id: `${bundle.id}:${capability.key}`,
        pluginId: bundle.pluginId,
        bundleId: bundle.id,
        capabilityKey: capability.key,
        constraintsJson: JSON.stringify(capability.constraints ?? {}),
        status: bundle.status === "registered" ? "enabled" : "disabled"
      } satisfies UpsertPluginCapabilityReducerInput)
    );
  }
}

function toPolicyConstraintReducerInput(policy: PolicyConstraint): UpsertPolicyConstraintReducerInput {
  return {
    id: policy.id,
    permissionKey: policy.permissionKey,
    constraintType: policy.constraintType,
    constraintJson: JSON.stringify(policy.constraint),
    priority: policy.priority,
    enabled: policy.enabled
  };
}

function toAuditLogEntry(row: AuditLogRow): AuditLogEntry {
  return {
    id: row.id,
    serverId: row.serverId,
    actorId: row.actorId,
    pluginId: row.pluginId || undefined,
    actionType: row.actionType,
    permissionKey: row.permissionKey || undefined,
    targetType: row.targetType || undefined,
    targetId: row.targetId || undefined,
    before: parseAuditJson(row.beforeJson),
    after: parseAuditJson(row.afterJson),
    status: row.status as AuditLogEntry["status"],
    createdAt: row.createdAt
  };
}

function toEconomyAccount(row: EconomyAccountRow): ReturnType<EconomyLedger["searchAccounts"]>[number] {
  return {
    id: row.id,
    ownerType: row.ownerType as never,
    ownerId: row.ownerId,
    currency: row.currency,
    balance: Number(row.balance),
    status: row.status as never
  };
}

function toEconomyTransaction(row: EconomyTransactionRow): Transaction {
  return {
    id: row.id,
    type: row.transactionType,
    actorId: row.actorId,
    status: row.status as never,
    idempotencyKey: row.idempotencyKey,
    metadata: parseAuditJson(row.metadataJson),
    createdAt: row.createdAt,
    completedAt: row.completedAt
  };
}

function toEconomyLedgerEntry(row: EconomyLedgerEntryRow): LedgerEntry {
  return {
    id: row.id,
    transactionId: row.transactionId,
    accountId: row.accountId,
    direction: row.direction as never,
    amount: Number(row.amount),
    reason: row.reason,
    metadata: parseAuditJson(row.metadataJson),
    createdAt: row.createdAt
  };
}

function toPrincipal(row: PrincipalRow): Principal {
  return {
    id: row.id,
    type: row.principalType as Principal["type"],
    externalId: row.externalId,
    name: row.name
  };
}

function toPrincipalEdge(row: PrincipalEdgeRow): PermissionSnapshot["edges"][number] {
  return {
    parentPrincipalId: row.parentPrincipalId,
    childPrincipalId: row.childPrincipalId,
    source: row.source,
    expiresAt: row.expiresAt
  };
}

function toPermissionGrant(row: PermissionGrantRow): PermissionSnapshot["grants"][number] {
  return {
    principalId: row.principalId,
    permissionKey: row.permissionKey,
    effect: row.effect as PermissionSnapshot["grants"][number]["effect"],
    source: row.source,
    expiresAt: row.expiresAt
  };
}

function toPolicyConstraint(row: PolicyConstraintRow): PolicyConstraint {
  const constraint = parseAuditJson(row.constraintJson);
  return {
    id: row.id,
    permissionKey: row.permissionKey,
    constraintType: row.constraintType as PolicyConstraint["constraintType"],
    constraint: constraint && typeof constraint === "object" && !Array.isArray(constraint)
      ? constraint as Record<string, unknown>
      : {},
    priority: row.priority,
    enabled: row.enabled
  };
}

function compareMenuRefreshTargets(left: MenuRefreshTarget, right: MenuRefreshTarget): number {
  return left.serverId.localeCompare(right.serverId) ||
    left.playerId.localeCompare(right.playerId) ||
    left.sessionId.localeCompare(right.sessionId);
}

function menuRefreshTargetKey(target: MenuRefreshTarget): string {
  return `${target.serverId}:${target.sessionId}`;
}

function validateReplicatedStateUpdate(update: ReplicatedStateUpdate): ReplicatedStateUpdate {
  if (!update || typeof update !== "object" || Array.isArray(update)) {
    throw new Error("replicated state update must be an object");
  }
  if (typeof update.serverId !== "string" || update.serverId.length === 0) {
    throw new Error("serverId must be a non-empty string");
  }
  if (typeof update.key !== "string" || update.key.length === 0) {
    throw new Error("key must be a non-empty string");
  }
  if (update.authoritative === true) {
    throw new Error("authoritative state cannot be replicated");
  }
  if (
    update.playerId !== undefined &&
    (typeof update.playerId !== "string" || update.playerId.length === 0) &&
    (typeof update.playerId !== "number" || !Number.isFinite(update.playerId))
  ) {
    throw new Error("playerId must be a non-empty string or finite number");
  }

  const validated: ReplicatedStateUpdate = {
    serverId: update.serverId,
    key: update.key,
    value: update.value
  };
  if (update.playerId !== undefined) {
    validated.playerId = update.playerId;
  }
  return validated;
}

function compareReplicatedStateUpdates(left: ReplicatedStateUpdate, right: ReplicatedStateUpdate): number {
  return left.serverId.localeCompare(right.serverId) ||
    String(left.playerId ?? "").localeCompare(String(right.playerId ?? "")) ||
    left.key.localeCompare(right.key);
}

function replicatedStateUpdateKey(update: ReplicatedStateUpdate): string {
  return `${update.serverId}:${String(update.playerId ?? "global")}:${update.key}`;
}

function validateVehicleSpawnDispatch(spawn: VehicleSpawnDispatch): VehicleSpawnDispatch {
  if (!spawn || typeof spawn !== "object" || Array.isArray(spawn)) {
    throw new Error("vehicle spawn dispatch must be an object");
  }
  if (typeof spawn.serverId !== "string" || spawn.serverId.length === 0) {
    throw new Error("serverId must be a non-empty string");
  }
  if (
    (typeof spawn.targetSource !== "string" || spawn.targetSource.length === 0) &&
    (typeof spawn.targetSource !== "number" || !Number.isFinite(spawn.targetSource))
  ) {
    throw new Error("targetSource must be a non-empty string or finite number");
  }
  if (typeof spawn.model !== "string" || spawn.model.length === 0) {
    throw new Error("model must be a non-empty string");
  }
  if (typeof spawn.label !== "string" || spawn.label.length === 0) {
    throw new Error("label must be a non-empty string");
  }
  if (typeof spawn.category !== "string" || spawn.category.length === 0) {
    throw new Error("category must be a non-empty string");
  }
  if (spawn.heading !== undefined && (typeof spawn.heading !== "number" || !Number.isFinite(spawn.heading))) {
    throw new Error("heading must be a finite number");
  }
  if (spawn.warpIntoVehicle !== undefined && typeof spawn.warpIntoVehicle !== "boolean") {
    throw new Error("warpIntoVehicle must be a boolean");
  }

  const validated: VehicleSpawnDispatch = {
    serverId: spawn.serverId,
    targetSource: spawn.targetSource,
    model: spawn.model,
    label: spawn.label,
    category: spawn.category
  };
  if (spawn.location !== undefined) {
    validated.location = validateVehicleSpawnLocation(spawn.location);
  }
  if (spawn.heading !== undefined) {
    validated.heading = spawn.heading;
  }
  if (spawn.warpIntoVehicle !== undefined) {
    validated.warpIntoVehicle = spawn.warpIntoVehicle;
  }
  return validated;
}

function validateVehicleSpawnLocation(location: VehicleSpawnDispatch["location"]): NonNullable<VehicleSpawnDispatch["location"]> {
  if (!location || typeof location !== "object" || Array.isArray(location)) {
    throw new Error("location must be an object");
  }
  if (typeof location.key !== "string" || location.key.length === 0) {
    throw new Error("location.key must be a non-empty string");
  }
  if (typeof location.label !== "string" || location.label.length === 0) {
    throw new Error("location.label must be a non-empty string");
  }
  for (const axis of ["x", "y", "z"] as const) {
    if (typeof location[axis] !== "number" || !Number.isFinite(location[axis])) {
      throw new Error(`location.${axis} must be a finite number`);
    }
  }

  return {
    key: location.key,
    label: location.label,
    x: location.x,
    y: location.y,
    z: location.z
  };
}

function compareVehicleSpawnDispatches(left: VehicleSpawnDispatch, right: VehicleSpawnDispatch): number {
  return left.serverId.localeCompare(right.serverId) ||
    String(left.targetSource).localeCompare(String(right.targetSource)) ||
    left.model.localeCompare(right.model);
}

function vehicleSpawnDispatchKey(spawn: VehicleSpawnDispatch): string {
  return `${spawn.serverId}:${String(spawn.targetSource)}:${spawn.model}`;
}

function validateVehicleRepairDispatch(repair: VehicleRepairDispatch): VehicleRepairDispatch {
  if (!repair || typeof repair !== "object" || Array.isArray(repair)) {
    throw new Error("vehicle repair dispatch must be an object");
  }
  if (typeof repair.serverId !== "string" || repair.serverId.length === 0) {
    throw new Error("serverId must be a non-empty string");
  }
  if (
    (typeof repair.targetSource !== "string" || repair.targetSource.length === 0) &&
    (typeof repair.targetSource !== "number" || !Number.isFinite(repair.targetSource))
  ) {
    throw new Error("targetSource must be a non-empty string or finite number");
  }
  if (!Number.isFinite(repair.targetVehicleNetId)) {
    throw new Error("targetVehicleNetId must be a finite number");
  }

  return {
    serverId: repair.serverId,
    targetSource: repair.targetSource,
    targetVehicleNetId: repair.targetVehicleNetId
  };
}

function compareVehicleRepairDispatches(left: VehicleRepairDispatch, right: VehicleRepairDispatch): number {
  return left.serverId.localeCompare(right.serverId) ||
    String(left.targetSource).localeCompare(String(right.targetSource)) ||
    left.targetVehicleNetId - right.targetVehicleNetId;
}

function vehicleRepairDispatchKey(repair: VehicleRepairDispatch): string {
  return `${repair.serverId}:${String(repair.targetSource)}:${repair.targetVehicleNetId}`;
}

function validateWorldStateUpdate(update: WorldStateUpdate): WorldStateUpdate {
  if (!update || typeof update !== "object" || Array.isArray(update)) {
    throw new Error("world state update must be an object");
  }
  if (typeof update.serverId !== "string" || update.serverId.length === 0) {
    throw new Error("serverId must be a non-empty string");
  }
  if (!update.world || typeof update.world !== "object" || Array.isArray(update.world)) {
    throw new Error("world must be an object");
  }

  const world: WorldStateUpdate["world"] = {};
  if (update.world.weatherType !== undefined) {
    if (typeof update.world.weatherType !== "string" || update.world.weatherType.length === 0) {
      throw new Error("weatherType must be a non-empty string");
    }
    world.weatherType = update.world.weatherType;
  }
  if (update.world.hour !== undefined) {
    if (!Number.isSafeInteger(update.world.hour) || update.world.hour < 0 || update.world.hour > 23) {
      throw new Error("hour must be an integer between 0 and 23");
    }
    world.hour = update.world.hour;
  }
  if (update.world.minute !== undefined) {
    if (!Number.isSafeInteger(update.world.minute) || update.world.minute < 0 || update.world.minute > 59) {
      throw new Error("minute must be an integer between 0 and 59");
    }
    world.minute = update.world.minute;
  }
  if (Object.keys(world).length === 0) {
    throw new Error("world state update must include weatherType, hour, or minute");
  }

  return {
    serverId: update.serverId,
    world
  };
}

function compareWorldStateUpdates(left: WorldStateUpdate, right: WorldStateUpdate): number {
  return left.serverId.localeCompare(right.serverId) ||
    worldStateUpdateKey(left).localeCompare(worldStateUpdateKey(right));
}

function worldStateUpdateKey(update: WorldStateUpdate): string {
  return `${update.serverId}:${Object.keys(update.world).sort().join(",")}`;
}

function validateTeleportDispatch(teleport: TeleportDispatch): TeleportDispatch {
  if (!teleport || typeof teleport !== "object" || Array.isArray(teleport)) {
    throw new Error("teleport dispatch must be an object");
  }
  if (typeof teleport.serverId !== "string" || teleport.serverId.length === 0) {
    throw new Error("serverId must be a non-empty string");
  }
  if (
    (typeof teleport.targetSource !== "string" || teleport.targetSource.length === 0) &&
    (typeof teleport.targetSource !== "number" || !Number.isFinite(teleport.targetSource))
  ) {
    throw new Error("targetSource must be a non-empty string or finite number");
  }
  for (const axis of ["x", "y", "z"] as const) {
    if (typeof teleport[axis] !== "number" || !Number.isFinite(teleport[axis])) {
      throw new Error(`${axis} must be a finite number`);
    }
  }
  if (teleport.heading !== undefined && (typeof teleport.heading !== "number" || !Number.isFinite(teleport.heading))) {
    throw new Error("heading must be a finite number");
  }

  const validated: TeleportDispatch = {
    serverId: teleport.serverId,
    targetSource: teleport.targetSource,
    x: teleport.x,
    y: teleport.y,
    z: teleport.z
  };
  if (teleport.heading !== undefined) {
    validated.heading = teleport.heading;
  }
  return validated;
}

function compareTeleportDispatches(left: TeleportDispatch, right: TeleportDispatch): number {
  return left.serverId.localeCompare(right.serverId) ||
    String(left.targetSource).localeCompare(String(right.targetSource));
}

function teleportDispatchKey(teleport: TeleportDispatch): string {
  return `${teleport.serverId}:${String(teleport.targetSource)}`;
}

function validateKickDispatch(kick: KickDispatch): KickDispatch {
  if (!kick || typeof kick !== "object" || Array.isArray(kick)) {
    throw new Error("kick dispatch must be an object");
  }
  if (typeof kick.serverId !== "string" || kick.serverId.length === 0) {
    throw new Error("serverId must be a non-empty string");
  }
  if (
    (typeof kick.targetSource !== "string" || kick.targetSource.length === 0) &&
    (typeof kick.targetSource !== "number" || !Number.isFinite(kick.targetSource))
  ) {
    throw new Error("targetSource must be a non-empty string or finite number");
  }
  if (typeof kick.reason !== "string" || kick.reason.length === 0) {
    throw new Error("reason must be a non-empty string");
  }

  return {
    serverId: kick.serverId,
    targetSource: kick.targetSource,
    reason: kick.reason
  };
}

function compareKickDispatches(left: KickDispatch, right: KickDispatch): number {
  return left.serverId.localeCompare(right.serverId) ||
    String(left.targetSource).localeCompare(String(right.targetSource));
}

function kickDispatchKey(kick: KickDispatch): string {
  return `${kick.serverId}:${String(kick.targetSource)}`;
}

function qbCoreCharInfoFromName(name: string): Record<string, unknown> {
  const [firstname = name, ...rest] = name.split(" ").filter((part) => part.length > 0);

  return {
    firstname,
    lastname: rest.join(" ")
  };
}

function parseQbCoreJsonObject(json: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(json) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function parseOptionalQbCoreJsonObject(json: string): Record<string, unknown> | undefined {
  const parsed = parseQbCoreJsonObject(json);
  return Object.keys(parsed).length > 0 ? parsed : undefined;
}

function parseQbCoreJobGrades(gradesJson?: string): string[] {
  if (!gradesJson) {
    return [];
  }

  try {
    const parsed = JSON.parse(gradesJson) as unknown;
    return Array.isArray(parsed) ? parsed.filter((grade): grade is string => typeof grade === "string") : [];
  } catch {
    return [];
  }
}

function defaultQbCoreJob(): Record<string, unknown> {
  return {
    name: "unemployed",
    label: "Civilian",
    payment: 0,
    onduty: false,
    isboss: false,
    grade: {
      name: "Freelancer",
      level: 0
    }
  };
}

function defaultQbCoreGang(): Record<string, unknown> {
  return {
    name: "none",
    label: "No Gang",
    isboss: false,
    grade: {
      name: "none",
      level: 0
    }
  };
}

function parsePluginCapabilityConstraints(capability: PluginCapabilityRow): unknown {
  if (!capability.constraintsJson) {
    return undefined;
  }

  const parsed = JSON.parse(capability.constraintsJson) as unknown;
  if (
    parsed &&
    typeof parsed === "object" &&
    !Array.isArray(parsed) &&
    Object.keys(parsed).length === 0
  ) {
    return undefined;
  }

  return parsed;
}

function principalEdgeId(edge: PrincipalEdge): string {
  return `${edge.parentPrincipalId}:${edge.childPrincipalId}:${edge.source}`;
}

function parsePluginEntityData(entityType: string, dataJson: string): unknown {
  try {
    return JSON.parse(dataJson);
  } catch {
    throw new Error(`Plugin entity ${entityType} dataJson must be valid JSON`);
  }
}

function timestampMs(value: Date | string | number | undefined): number {
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function validateEconomyQuantity(quantity: number): void {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new Error("Quantity must be a positive integer");
  }
}

function parseAuditJson(value: string): unknown {
  if (!value) {
    return undefined;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
