import {
  hashPayload,
  type HeartbeatInput,
  type AceMirrorRule,
  EconomyLedger,
  type Account,
  type AccountOwnerType,
  type AccountStatus,
  type EconomyLimit,
  type PermissionCacheVersion,
  type PermissionDefinition,
  type PermissionEngine,
  type PluginBundleRecord,
  type PluginDeploymentRecord,
  type PluginPackageRecord,
  type PluginRecord,
  type RegisterServerInput,
  type RuntimeConfigAckRecord,
  type RuntimeConfigRecord,
  MenuRuntime,
  type MenuAction,
  type MenuDefinition,
  type MenuVisibilityPolicy,
  type SetRuntimeConfigInput,
  type SubmitActionInput
} from "../core/index.js";

export type RuntimeTableName =
  | "servers"
  | "runtime_instances"
  | "audit_logs"
  | "runtime_config"
  | "runtime_config_acks"
  | "menu_definitions"
  | "menu_actions"
  | "runtime_commands"
  | "runtime_panels"
  | "menu_visibility_policies"
  | "menu_sessions"
  | "principals"
  | "principal_edges"
  | "permission_grants"
  | "permissions"
  | "permission_cache_versions"
  | "ace_mirror_rules"
  | "policy_constraints"
  | "plugins"
  | "plugin_packages"
  | "plugin_package_signer_revocations"
  | "plugin_bundles"
  | "plugin_capabilities"
  | "plugin_deployments"
  | "plugin_manifests"
  | "plugin_runtime_instances"
  | "plugin_config_values"
  | "plugin_schemas"
  | "plugin_entities"
  | "plugin_sandbox_events"
  | "accounts"
  | "transactions"
  | "ledger_entries"
  | "invoices"
  | "economy_limits"
  | "items"
  | "jobs"
  | "vehicles"
  | "locations"
  | "characters"
  | "inventory_stacks"
  | "character_jobs"
  | "plugin_hooks";

export interface RuntimeTableRows {
  servers: ServerRow[];
  runtime_instances: RuntimeInstanceRow[];
  audit_logs: AuditLogRow[];
  runtime_config: RuntimeConfigRecord[];
  runtime_config_acks: RuntimeConfigAckRecord[];
  menu_definitions: MenuDefinitionRow[];
  menu_actions: MenuActionRow[];
  runtime_commands: RuntimeCommandRow[];
  runtime_panels: RuntimePanelRow[];
  menu_visibility_policies: MenuVisibilityPolicyRow[];
  menu_sessions: MenuSessionRow[];
  principals: PrincipalRow[];
  principal_edges: PrincipalEdgeRow[];
  permission_grants: PermissionGrantRow[];
  permissions: PermissionDefinition[];
  permission_cache_versions: PermissionCacheVersion[];
  ace_mirror_rules: AceMirrorRule[];
  policy_constraints: PolicyConstraintRow[];
  plugins: PluginRecord[];
  plugin_packages: PluginPackageRecord[];
  plugin_package_signer_revocations: PluginPackageSignerRevocationRow[];
  plugin_bundles: PluginBundleRecord[];
  plugin_capabilities: PluginCapabilityRow[];
  plugin_deployments: PluginDeploymentRecord[];
  plugin_manifests: PluginManifestRow[];
  plugin_runtime_instances: PluginRuntimeInstanceRow[];
  plugin_config_values: PluginConfigValueRow[];
  plugin_schemas: PluginSchemaRow[];
  plugin_entities: PluginEntityRow[];
  plugin_sandbox_events: PluginSandboxEventRow[];
  accounts: EconomyAccountRow[];
  transactions: EconomyTransactionRow[];
  ledger_entries: EconomyLedgerEntryRow[];
  invoices: EconomyInvoiceRow[];
  economy_limits: EconomyLimitRow[];
  items: GameplayItemRow[];
  jobs: GameplayJobRow[];
  vehicles: GameplayVehicleRow[];
  locations: GameplayLocationRow[];
  characters: CharacterRow[];
  inventory_stacks: InventoryStackRow[];
  character_jobs: CharacterJobRow[];
  plugin_hooks: PluginHookRow[];
}

export interface ReducerCall {
  name: string;
  args: unknown;
}

export interface ServerRow {
  id: string;
  name: string;
  environment: string;
  publicKey: string;
  status: string;
  lastHeartbeatAt: Date;
}

export interface RuntimeInstanceRow {
  id: string;
  serverId: string;
  resourceVersion: string;
  fxserverBuild: string;
  gameBuild: string;
  status: string;
  startedAt: Date;
  lastSeenAt: Date;
}

export interface AuditLogRow {
  id: string;
  serverId: string;
  actorId: string;
  pluginId: string;
  actionType: string;
  permissionKey: string;
  targetType: string;
  targetId: string;
  beforeJson: string;
  afterJson: string;
  status: string;
  createdAt: Date;
}

export interface PluginCapabilityRow {
  id: string;
  pluginId: string;
  bundleId: string;
  capabilityKey: string;
  constraintsJson: string;
  status: string;
}

export interface MenuDefinitionRow {
  id: string;
  pluginId: string;
  label: string;
  parentId: string;
  icon: string;
  order: number;
  requiredPermission: string;
  actionId: string;
  enabled: boolean;
  visibilityPolicyId: string;
}

export interface MenuActionRow {
  id: string;
  pluginId: string;
  actionType: string;
  reducerName: string;
  payloadSchemaJson: string;
  confirmationRequired: boolean;
  auditLevel: string;
  requiredPermission: string;
  enabled: boolean;
}

export interface RuntimeCommandRow {
  id: string;
  pluginId: string;
  name: string;
  aliasesJson: string;
  actionId: string;
  requiredPermission: string;
  payloadSchemaJson: string;
  auditLevel: string;
  enabled: boolean;
}

export interface RuntimePanelRow {
  id: string;
  pluginId: string;
  title: string;
  route: string;
  requiredPermission: string;
  icon: string;
  order: number;
  enabled: boolean;
}

export interface MenuVisibilityPolicyRow {
  id: string;
  pluginId: string;
  policyJson: string;
  enabled: boolean;
}

export interface MenuSessionRow {
  id: string;
  serverId: string;
  playerId: string;
  cacheVersion: number;
}

export interface PolicyConstraintRow {
  id: string;
  permissionKey: string;
  constraintType: string;
  constraintJson: string;
  priority: number;
  enabled: boolean;
}

export interface PluginManifestRow {
  pluginId: string;
  manifestJson: string;
  requiredPermissions: string;
  requiredTables: string;
  requiredHooks: string;
  requiredConnectors: string;
  schemaVersion: number;
  updatedAt: Date;
}

export interface PluginRuntimeInstanceRow {
  id: string;
  pluginId: string;
  serverId: string;
  status: string;
  loadedAt?: Date;
  lastHeartbeat: Date;
  errorMessage: string;
}

export interface PluginConfigValueRow {
  id: string;
  pluginId: string;
  serverId: string;
  key: string;
  valueJson: string;
  version: number;
  updatedAt: Date;
}

export interface PluginPackageSignerRevocationRow {
  signerId: string;
  actorId: string;
  reason: string;
  affectedPluginIdsJson: string;
  revokedAt: Date;
}

export interface PluginSchemaRow {
  id: string;
  pluginId: string;
  schemaVersion: number;
  entityType: string;
  schemaJson: string;
  migrationPlanJson: string;
  status: string;
  registeredAt: Date;
}

export interface PluginEntityRow {
  id: string;
  pluginId: string;
  entityType: string;
  ownerType: string;
  ownerId: string;
  dataJson: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PluginSandboxEventRow {
  id: string;
  pluginId: string;
  serverId: string;
  eventType: string;
  payloadHash: string;
  status: string;
  createdAt: Date;
}

export interface EconomyAccountRow {
  id: string;
  ownerType: string;
  ownerId: string;
  currency: string;
  balance: number | bigint;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EconomyTransactionRow {
  id: string;
  transactionType: string;
  actorId: string;
  status: string;
  idempotencyKey: string;
  metadataJson: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface EconomyLedgerEntryRow {
  id: string;
  transactionId: string;
  accountId: string;
  direction: string;
  amount: number | bigint;
  reason: string;
  metadataJson: string;
  createdAt: Date;
}

export interface EconomyInvoiceRow {
  id: string;
  issuerAccountId: string;
  payerAccountId: string;
  amount: number | bigint;
  currency: string;
  reason: string;
  status: string;
  issuedBy: string;
  idempotencyKey: string;
  issuedAt: Date;
  dueAt?: Date;
  paidAt?: Date;
}

export interface EconomyLimitRow {
  id: string;
  permissionKey: string;
  actionType: string;
  limitJson: string;
  enabled: boolean;
}

export interface GameplayItemRow {
  key: string;
  pluginId: string;
  label: string;
  stackable: boolean;
  maxStack: number;
}

export interface GameplayJobRow {
  key: string;
  pluginId: string;
  label: string;
  gradesJson: string;
}

export interface GameplayVehicleRow {
  model: string;
  pluginId: string;
  label: string;
  category: string;
}

export interface GameplayLocationRow {
  key: string;
  pluginId: string;
  label: string;
  x: number;
  y: number;
  z: number;
}

export interface CharacterRow {
  id: string;
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
  updatedAt: Date;
}

export interface InventoryStackRow {
  id: string;
  ownerId: string;
  itemKey: string;
  quantity: number;
  updatedAt: Date;
}

export interface CharacterJobRow {
  characterId: string;
  jobKey: string;
  grade: string;
  onDuty: boolean;
  updatedAt: Date;
}

export interface PluginHookRow {
  id: string;
  pluginId: string;
  hookName: string;
  capability: string;
  handlerType: string;
  handlerRef: string;
  priority: number;
  enabled: boolean;
}

export interface PrincipalRow {
  id: string;
  principalType: string;
  externalId: string;
  name: string;
  createdAt: Date;
}

export interface PrincipalEdgeRow {
  id: string;
  parentPrincipalId: string;
  childPrincipalId: string;
  source: string;
  expiresAt?: Date;
}

export interface PermissionGrantRow {
  id: string;
  principalId: string;
  permissionKey: string;
  effect: string;
  source: string;
  expiresAt?: Date;
}

export interface CreateAccountInput {
  id: string;
  ownerType: string;
  ownerId: string;
  currency: string;
  balance: number;
}

export interface TransferMoneyReducerInput {
  transactionId: string;
  actorId: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  reason: string;
  idempotencyKey: string;
}

export interface UpsertEconomyLimitReducerInput {
  id: string;
  permissionKey: string;
  actionType: string;
  limitJson: string;
  enabled: boolean;
}

export interface AccountTransactionReducerInput {
  transactionId: string;
  actorId: string;
  accountId: string;
  amount: number;
  reason: string;
  idempotencyKey: string;
}

export interface AccountTransferReducerInput {
  transactionId: string;
  actorId: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  reason: string;
  idempotencyKey: string;
}

export interface PaySalaryReducerInput {
  transactionId: string;
  actorId: string;
  employerAccountId: string;
  employeeAccountId: string;
  amount: number;
  reason: string;
  idempotencyKey: string;
}

export interface FinePlayerReducerInput {
  transactionId: string;
  actorId: string;
  playerAccountId: string;
  destinationAccountId: string;
  amount: number;
  reason: string;
  idempotencyKey: string;
}

export interface ChargeTaxReducerInput {
  transactionId: string;
  actorId: string;
  payerAccountId: string;
  governmentAccountId: string;
  amount: number;
  reason: string;
  idempotencyKey: string;
}

export interface BusinessPayoutReducerInput {
  transactionId: string;
  actorId: string;
  businessAccountId: string;
  destinationAccountId: string;
  amount: number;
  reason: string;
  idempotencyKey: string;
}

export interface IssueInvoiceReducerInput {
  id: string;
  issuerAccountId: string;
  payerAccountId: string;
  amount: number;
  currency: string;
  reason: string;
  issuedBy: string;
  idempotencyKey: string;
  dueAt?: Date;
}

export interface PayInvoiceReducerInput {
  transactionId: string;
  actorId: string;
  invoiceId: string;
  idempotencyKey: string;
}

export interface BuyItemReducerInput {
  transactionId: string;
  actorId: string;
  buyerAccountId: string;
  sellerAccountId: string;
  amount: number;
  itemKey: string;
  quantity: number;
  idempotencyKey: string;
}

export interface SellItemReducerInput {
  transactionId: string;
  actorId: string;
  sellerAccountId: string;
  buyerAccountId: string;
  amount: number;
  itemKey: string;
  quantity: number;
  idempotencyKey: string;
}

export interface AdminAdjustBalanceReducerInput extends AccountTransactionReducerInput {
  direction: string;
}

export interface VoidTransactionReducerInput {
  transactionId: string;
  actorId: string;
  voidedTransactionId: string;
  reason: string;
  idempotencyKey: string;
}

export interface UpsertPrincipalReducerInput {
  id: string;
  principalType: string;
  externalId: string;
  name: string;
}

export interface AddPrincipalEdgeReducerInput {
  id: string;
  parentPrincipalId: string;
  childPrincipalId: string;
  source: string;
  expiresAt?: Date;
}

export interface RemovePrincipalEdgeReducerInput {
  edgeId: string;
}

export interface RegisterPermissionReducerInput {
  id: string;
  key: string;
  description: string;
  pluginId: string;
}

export interface AckPermissionCacheVersionReducerInput {
  serverId: string;
  version: number;
}

export interface AckConfigVersionReducerInput {
  serverId: string;
  namespace: string;
  key: string;
  version: number;
}

export interface CompleteActionReducerInput {
  actionId: string;
  status: string;
}

export interface WriteAuditLogReducerInput {
  id: string;
  serverId: string;
  actorId: string;
  pluginId: string;
  actionType: string;
  permissionKey: string;
  targetType: string;
  targetId: string;
  beforeJson: string;
  afterJson: string;
  status: string;
}

export interface UpsertAceMirrorRuleReducerInput {
  id: string;
  permissionKey: string;
  aceObject: string;
  enabled: boolean;
  mode: string;
}

export interface GrantPermissionReducerInput {
  id: string;
  principalId: string;
  permissionKey: string;
  effect: string;
  source: string;
  expiresAt?: Date;
}

export interface UpsertPolicyConstraintReducerInput {
  id: string;
  permissionKey: string;
  constraintType: string;
  constraintJson: string;
  priority: number;
  enabled: boolean;
}

export interface RegisterPluginReducerInput {
  id: string;
  name: string;
  version: string;
  status: string;
  trustLevel: string;
  signature: string;
  bundleHash: string;
  createdBy: string;
}

export interface RegisterPluginPackageReducerInput {
  packageId: string;
  pluginId: string;
  version: string;
  source: string;
  publisher: string;
  trustLevel: string;
  signerId: string;
  signature: string;
  manifestHash: string;
}

export interface RevokePackageSignerReducerInput {
  signerId: string;
  actorId: string;
  reason: string;
}

export interface SetPluginStatusReducerInput {
  pluginId: string;
  status: string;
}

export interface RegisterPluginManifestReducerInput {
  pluginId: string;
  manifestJson: string;
  requiredPermissions: string;
  requiredTables: string;
  requiredHooks: string;
  requiredConnectors: string;
  schemaVersion: number;
}

export interface UpsertPluginRuntimeInstanceReducerInput {
  pluginId: string;
  serverId: string;
  status: string;
  errorMessage: string;
}

export interface SetPluginConfigValueReducerInput {
  pluginId: string;
  serverId: string;
  key: string;
  valueJson: string;
  version: number;
}

export interface RegisterPluginBundleReducerInput {
  id: string;
  pluginId: string;
  version: string;
  artifactUrl: string;
  bundleHash: string;
  signature: string;
  signerId: string;
  runtimeType: string;
  status: string;
}

export interface RevokePluginBundleReducerInput {
  bundleId: string;
  status: string;
  actorId: string;
  reason: string;
}

export interface UpsertPluginCapabilityReducerInput {
  id: string;
  pluginId: string;
  bundleId: string;
  capabilityKey: string;
  constraintsJson: string;
  status: string;
}

export interface UpsertPluginDeploymentReducerInput {
  id: string;
  pluginId: string;
  bundleId: string;
  serverId: string;
  status: string;
  desiredVersion: string;
  activeVersion: string;
  errorMessage: string;
}

export interface RegisterPluginSchemaReducerInput {
  pluginId: string;
  schemaVersion: number;
  entityType: string;
  schemaJson: string;
  migrationPlanJson: string;
  status: string;
}

export interface UpsertPluginEntityReducerInput {
  id: string;
  pluginId: string;
  entityType: string;
  ownerType: string;
  ownerId: string;
  dataJson: string;
}

export interface RecordPluginSandboxEventReducerInput {
  id: string;
  pluginId: string;
  serverId: string;
  eventType: string;
  payloadHash: string;
  status: string;
}

export interface RegisterPluginHookReducerInput {
  id: string;
  pluginId: string;
  hookName: string;
  capability: string;
  handlerType: string;
  handlerRef: string;
  priority: number;
}

export interface SetPluginHooksEnabledReducerInput {
  pluginId: string;
  enabled: boolean;
}

export interface UpsertMenuDefinitionReducerInput {
  id: string;
  pluginId: string;
  label: string;
  parentId: string;
  icon: string;
  order: number;
  requiredPermission: string;
  actionId: string;
  enabled: boolean;
  visibilityPolicyId: string;
}

export interface UpsertMenuActionReducerInput {
  id: string;
  pluginId: string;
  actionType: string;
  reducerName: string;
  payloadSchemaJson: string;
  confirmationRequired: boolean;
  auditLevel: string;
  requiredPermission: string;
  enabled: boolean;
}

export interface UpsertRuntimeCommandReducerInput {
  id: string;
  pluginId: string;
  name: string;
  aliasesJson: string;
  actionId: string;
  requiredPermission: string;
  payloadSchemaJson: string;
  auditLevel: string;
  enabled: boolean;
}

export interface UpsertRuntimePanelReducerInput {
  id: string;
  pluginId: string;
  title: string;
  route: string;
  requiredPermission: string;
  icon: string;
  order: number;
  enabled: boolean;
}

export interface UpsertMenuVisibilityPolicyReducerInput {
  id: string;
  pluginId: string;
  policyJson: string;
  enabled: boolean;
}

export interface OpenMenuSessionReducerInput {
  id: string;
  serverId: string;
  playerId: string;
  cacheVersion: number;
}

export interface RegisterItemReducerInput {
  key: string;
  pluginId: string;
  label: string;
  stackable: boolean;
  maxStack: number;
}

export interface RegisterJobReducerInput {
  key: string;
  pluginId: string;
  label: string;
  gradesJson: string;
}

export interface RegisterVehicleReducerInput {
  model: string;
  pluginId: string;
  label: string;
  category: string;
}

export interface RegisterLocationReducerInput {
  key: string;
  pluginId: string;
  label: string;
  x: number;
  y: number;
  z: number;
}

export interface UpsertCharacterReducerInput {
  id: string;
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

export interface GrantItemReducerInput {
  id: string;
  ownerId: string;
  itemKey: string;
  quantity: number;
}

export interface RemoveItemReducerInput {
  id: string;
  ownerId: string;
  itemKey: string;
  quantity: number;
}

export interface AssignJobReducerInput {
  characterId: string;
  jobKey: string;
  grade: string;
  onDuty: boolean;
}

export interface SpacetimeClient {
  connect(): Promise<void>;
  subscribe<Table extends RuntimeTableName>(
    table: Table,
    onInsertOrUpdate: (row: RuntimeTableRows[Table][number]) => void
  ): Promise<RuntimeTableRows[Table]>;
  callReducer(name: string, args: unknown): Promise<unknown>;
}

export interface GeneratedTableHandle<Row = unknown> {
  iter(): Iterable<Row>;
  onInsert(callback: (ctx: unknown, row: Row) => void): void;
  onUpdate?(callback: (ctx: unknown, oldRow: Row, newRow: Row) => void): void;
}

export interface GeneratedSubscriptionBuilder {
  onApplied(callback: () => void): GeneratedSubscriptionBuilder;
  onError(callback: (ctx: unknown, error: Error) => void): GeneratedSubscriptionBuilder;
  subscribe(queries: unknown[]): unknown;
}

export interface GeneratedDbConnection {
  db: Record<string, GeneratedTableHandle | undefined>;
  reducers: Record<string, (...args: unknown[]) => unknown>;
  subscriptionBuilder(): GeneratedSubscriptionBuilder;
}

export interface GeneratedDbConnectionBuilder {
  withUri(uri: string): GeneratedDbConnectionBuilder;
  withDatabaseName(databaseName: string): GeneratedDbConnectionBuilder;
  withToken?(token?: string): GeneratedDbConnectionBuilder;
  withConfirmedReads?(confirmedReads: boolean): GeneratedDbConnectionBuilder;
  onConnect(
    callback: (connection: GeneratedDbConnection, identity: unknown, token: string) => void
  ): GeneratedDbConnectionBuilder;
  onConnectError?(callback: (ctx: unknown, error: Error) => void): GeneratedDbConnectionBuilder;
  build(): GeneratedDbConnection;
}

export interface GeneratedSpacetimeBindings {
  DbConnection: {
    builder(): GeneratedDbConnectionBuilder;
  };
  tables: Record<string, unknown>;
}

export interface GeneratedSpacetimeClientOptions {
  uri: string;
  databaseName: string;
  token?: string;
  confirmedReads?: boolean;
  bindings: GeneratedSpacetimeBindings;
  idFactory?: () => string;
}

export class GeneratedSpacetimeClient implements SpacetimeClient {
  private connection?: GeneratedDbConnection;
  private readonly idFactory: () => string;

  public constructor(private readonly options: GeneratedSpacetimeClientOptions) {
    this.idFactory = options.idFactory ?? (() => crypto.randomUUID());
  }

  public async connect(): Promise<void> {
    if (this.connection) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      let builder = this.options.bindings.DbConnection.builder()
        .withUri(this.options.uri)
        .withDatabaseName(this.options.databaseName);

      if (this.options.token !== undefined && builder.withToken) {
        builder = builder.withToken(this.options.token);
      }
      if (this.options.confirmedReads !== undefined && builder.withConfirmedReads) {
        builder = builder.withConfirmedReads(this.options.confirmedReads);
      }

      builder = builder.onConnect((connection) => {
        this.connection = connection;
        resolve();
      });
      if (builder.onConnectError) {
        builder = builder.onConnectError((_ctx, error) => reject(error));
      }

      const connection = builder.build();
      this.connection ??= connection;
    });
  }

  public async subscribe<Table extends RuntimeTableName>(
    table: Table,
    onInsertOrUpdate: (row: RuntimeTableRows[Table][number]) => void
  ): Promise<RuntimeTableRows[Table]> {
    const connection = this.requireConnection();
    const property = tableProperty(table);
    const handle = connection.db[property] ?? connection.db[table];
    const tableRef = this.options.bindings.tables[property] ?? this.options.bindings.tables[table];

    if (!handle) {
      throw new Error(`Generated bindings do not expose db.${property}`);
    }
    if (!tableRef) {
      throw new Error(`Generated bindings do not expose tables.${property}`);
    }

    handle.onInsert((_ctx, row) => onInsertOrUpdate(normalizeGeneratedRow(table, row) as RuntimeTableRows[Table][number]));
    handle.onUpdate?.((_ctx, _oldRow, newRow) =>
      onInsertOrUpdate(normalizeGeneratedRow(table, newRow) as RuntimeTableRows[Table][number])
    );

    await new Promise<void>((resolve, reject) => {
      connection
        .subscriptionBuilder()
        .onApplied(resolve)
        .onError((_ctx, error) => reject(error))
        .subscribe([tableRef]);
    });

    return [...handle.iter()].map((row) => normalizeGeneratedRow(table, row)) as RuntimeTableRows[Table];
  }

  public async callReducer(name: string, args: unknown): Promise<unknown> {
    const connection = this.requireConnection();
    const method = reducerMethod(name);
    const reducer = connection.reducers[method];
    if (!reducer) {
      throw new Error(`Generated bindings do not expose reducers.${method}`);
    }

    if (reducer.length === 1) {
      return reducer(this.reducerInput(name, args));
    }

    return reducer(...this.reducerArgs(name, args));
  }

  private requireConnection(): GeneratedDbConnection {
    if (!this.connection) {
      throw new Error("Client must connect before use");
    }

    return this.connection;
  }

  private reducerArgs(name: string, args: unknown): unknown[] {
    const input = requireRecord(args);

    switch (name) {
      case "register_server":
        return ordered(input, ["id", "name", "environment", "publicKey"]);
      case "heartbeat":
        return [
          input.id ?? this.idFactory(),
          input.serverId,
          input.resourceVersion,
          input.fxserverBuild,
          input.gameBuild,
          input.nonce,
          input.signature
        ];
      case "set_runtime_config":
        return [
          input.id ?? `config:${input.serverId}:${input.namespace}:${input.key}`,
          input.serverId,
          input.namespace,
          input.key,
          input.valueJson ?? JSON.stringify(input.value),
          input.version ?? 1
        ];
      case "ack_config_version":
        return ordered(input, ["serverId", "namespace", "key", "version"]);
      case "submit_action":
        return [
          input.id ?? this.idFactory(),
          input.serverId,
          input.actorId,
          input.actionType,
          input.payloadHash ?? hashPayload(input.payload),
          input.signature ?? "",
          input.nonce,
          input.idempotencyKey
        ];
      case "complete_action":
        return ordered(input, ["actionId", "status"]);
      case "write_audit_log":
        return ordered(input, [
          "id",
          "serverId",
          "actorId",
          "pluginId",
          "actionType",
          "permissionKey",
          "targetType",
          "targetId",
          "beforeJson",
          "afterJson",
          "status"
        ]);
      case "create_account":
        return ordered(input, ["id", "ownerType", "ownerId", "currency", "balance"]);
      case "register_permission":
        return ordered(input, ["id", "key", "description", "pluginId"]);
      case "ack_permission_cache_version":
        return ordered(input, ["serverId", "version"]);
      case "upsert_ace_mirror_rule":
        return ordered(input, ["id", "permissionKey", "aceObject", "enabled", "mode"]);
      case "upsert_principal":
        return ordered(input, ["id", "principalType", "externalId", "name"]);
      case "add_principal_edge":
        return ordered(input, ["id", "parentPrincipalId", "childPrincipalId", "source", "expiresAt"]);
      case "remove_principal_edge":
        return ordered(input, ["edgeId"]);
      case "grant_permission":
        return ordered(input, ["id", "principalId", "permissionKey", "effect", "source", "expiresAt"]);
      case "upsert_policy_constraint":
        return ordered(input, [
          "id",
          "permissionKey",
          "constraintType",
          "constraintJson",
          "priority",
          "enabled"
        ]);
      case "remove_policy_constraint":
        return ordered(input, ["policyId"]);
      case "register_plugin":
        return ordered(input, [
          "id",
          "name",
          "version",
          "status",
          "trustLevel",
          "signature",
          "bundleHash",
          "createdBy"
        ]);
      case "register_plugin_package":
        return ordered(input, [
          "packageId",
          "pluginId",
          "version",
          "source",
          "publisher",
          "trustLevel",
          "signerId",
          "signature",
          "manifestHash"
        ]);
      case "revoke_package_signer":
        return ordered(input, ["signerId", "actorId", "reason"]);
      case "set_plugin_status":
        return ordered(input, ["pluginId", "status"]);
      case "uninstall_plugin":
        return ordered(input, ["pluginId"]);
      case "register_plugin_manifest":
        return ordered(input, [
          "pluginId",
          "manifestJson",
          "requiredPermissions",
          "requiredTables",
          "requiredHooks",
          "requiredConnectors",
          "schemaVersion"
        ]);
      case "upsert_plugin_runtime_instance":
        return ordered(input, ["pluginId", "serverId", "status", "errorMessage"]);
      case "set_plugin_config_value":
        return ordered(input, ["pluginId", "serverId", "key", "valueJson", "version"]);
      case "register_plugin_bundle":
        return ordered(input, [
          "id",
          "pluginId",
          "version",
          "artifactUrl",
          "bundleHash",
          "signature",
          "signerId",
          "runtimeType",
          "status"
        ]);
      case "revoke_plugin_bundle":
        return ordered(input, ["bundleId", "status", "actorId", "reason"]);
      case "upsert_plugin_capability":
        return ordered(input, [
          "id",
          "pluginId",
          "bundleId",
          "capabilityKey",
          "constraintsJson",
          "status"
        ]);
      case "upsert_plugin_deployment":
        return ordered(input, [
          "id",
          "pluginId",
          "bundleId",
          "serverId",
          "status",
          "desiredVersion",
          "activeVersion",
          "errorMessage"
        ]);
      case "register_plugin_schema":
        return ordered(input, [
          "pluginId",
          "schemaVersion",
          "entityType",
          "schemaJson",
          "migrationPlanJson",
          "status"
        ]);
      case "upsert_plugin_entity":
        return ordered(input, ["id", "pluginId", "entityType", "ownerType", "ownerId", "dataJson"]);
      case "record_plugin_sandbox_event":
        return ordered(input, ["id", "pluginId", "serverId", "eventType", "payloadHash", "status"]);
      case "register_plugin_hook":
        return ordered(input, ["id", "pluginId", "hookName", "capability", "handlerType", "handlerRef", "priority"]);
      case "set_plugin_hooks_enabled":
        return ordered(input, ["pluginId", "enabled"]);
      case "upsert_menu_definition":
        return ordered(input, [
          "id",
          "pluginId",
          "label",
          "parentId",
          "icon",
          "order",
          "requiredPermission",
          "actionId",
          "enabled",
          "visibilityPolicyId"
        ]);
      case "upsert_menu_action":
        return ordered(input, [
          "id",
          "pluginId",
          "actionType",
          "reducerName",
          "payloadSchemaJson",
          "confirmationRequired",
          "auditLevel",
          "requiredPermission",
          "enabled"
        ]);
      case "upsert_runtime_command":
        return ordered(input, [
          "id",
          "pluginId",
          "name",
          "aliasesJson",
          "actionId",
          "requiredPermission",
          "payloadSchemaJson",
          "auditLevel",
          "enabled"
        ]);
      case "upsert_runtime_panel":
        return ordered(input, ["id", "pluginId", "title", "route", "requiredPermission", "icon", "order", "enabled"]);
      case "upsert_menu_visibility_policy":
        return ordered(input, ["id", "pluginId", "policyJson", "enabled"]);
      case "open_menu_session":
        return ordered(input, ["id", "serverId", "playerId", "cacheVersion"]);
      case "close_menu_session":
        return ordered(input, ["sessionId"]);
      case "transfer_money":
        return ordered(input, [
          "transactionId",
          "actorId",
          "fromAccountId",
          "toAccountId",
          "amount",
          "reason",
          "idempotencyKey"
        ]);
      case "upsert_economy_limit":
        return ordered(input, ["id", "permissionKey", "actionType", "limitJson", "enabled"]);
      case "pay_salary":
        return ordered(input, [
          "transactionId",
          "actorId",
          "employerAccountId",
          "employeeAccountId",
          "amount",
          "reason",
          "idempotencyKey"
        ]);
      case "fine_player":
        return ordered(input, [
          "transactionId",
          "actorId",
          "playerAccountId",
          "destinationAccountId",
          "amount",
          "reason",
          "idempotencyKey"
        ]);
      case "charge_tax":
        return ordered(input, [
          "transactionId",
          "actorId",
          "payerAccountId",
          "governmentAccountId",
          "amount",
          "reason",
          "idempotencyKey"
        ]);
      case "business_payout":
        return ordered(input, [
          "transactionId",
          "actorId",
          "businessAccountId",
          "destinationAccountId",
          "amount",
          "reason",
          "idempotencyKey"
        ]);
      case "issue_invoice":
        return ordered(input, [
          "id",
          "issuerAccountId",
          "payerAccountId",
          "amount",
          "currency",
          "reason",
          "issuedBy",
          "idempotencyKey",
          "dueAt"
        ]);
      case "pay_invoice":
        return ordered(input, [
          "transactionId",
          "actorId",
          "invoiceId",
          "idempotencyKey"
        ]);
      case "buy_item":
        return ordered(input, [
          "transactionId",
          "actorId",
          "buyerAccountId",
          "sellerAccountId",
          "amount",
          "itemKey",
          "quantity",
          "idempotencyKey"
        ]);
      case "sell_item":
        return ordered(input, [
          "transactionId",
          "actorId",
          "sellerAccountId",
          "buyerAccountId",
          "amount",
          "itemKey",
          "quantity",
          "idempotencyKey"
        ]);
      case "deposit_cash":
      case "withdraw_cash":
        return ordered(input, [
          "transactionId",
          "actorId",
          "accountId",
          "amount",
          "reason",
          "idempotencyKey"
        ]);
      case "admin_adjust_balance":
        return ordered(input, [
          "transactionId",
          "actorId",
          "accountId",
          "direction",
          "amount",
          "reason",
          "idempotencyKey"
        ]);
      case "void_transaction":
        return ordered(input, [
          "transactionId",
          "actorId",
          "voidedTransactionId",
          "reason",
          "idempotencyKey"
        ]);
      case "register_item":
        return ordered(input, ["key", "pluginId", "label", "stackable", "maxStack"]);
      case "register_job":
        return ordered(input, ["key", "pluginId", "label", "gradesJson"]);
      case "register_vehicle":
        return ordered(input, ["model", "pluginId", "label", "category"]);
      case "register_location":
        return ordered(input, ["key", "pluginId", "label", "x", "y", "z"]);
      case "upsert_character":
        return ordered(input, [
          "id",
          "playerPrincipalId",
          "citizenId",
          "cid",
          "slot",
          "license",
          "name",
          "charinfoJson",
          "metadataJson",
          "gangJson",
          "positionJson",
          "phoneNumber",
          "accountNumber",
          "selected"
        ]);
      case "grant_item":
        return ordered(input, ["id", "ownerId", "itemKey", "quantity"]);
      case "remove_item":
        return ordered(input, ["id", "ownerId", "itemKey", "quantity"]);
      case "assign_job":
        return ordered(input, ["characterId", "jobKey", "grade", "onDuty"]);
      default:
        return [args];
    }
  }

  private reducerInput(name: string, args: unknown): Record<string, unknown> {
    const input = requireRecord(args);

    switch (name) {
      case "heartbeat":
        return {
          ...input,
          id: input.id ?? this.idFactory()
        };
      case "set_runtime_config":
        return withBigIntFields({
          ...input,
          id: input.id ?? `config:${input.serverId}:${input.namespace}:${input.key}`,
          valueJson: input.valueJson ?? JSON.stringify(input.value),
          version: input.version ?? 1
        }, ["version"]);
      case "submit_action":
        return {
          ...input,
          id: input.id ?? this.idFactory(),
          payloadHash: input.payloadHash ?? hashPayload(input.payload),
          signature: input.signature ?? ""
        };
      case "ack_config_version":
      case "ack_permission_cache_version":
      case "set_plugin_config_value":
        return withBigIntFields(input, ["version"]);
      case "register_plugin_manifest":
      case "register_plugin_schema":
        return withBigIntFields(input, ["schemaVersion"]);
      case "open_menu_session":
        return withBigIntFields(input, ["cacheVersion"]);
      default:
        return input;
    }
  }
}

function withBigIntFields(input: Record<string, unknown>, fields: string[]): Record<string, unknown> {
  const output = { ...input };
  for (const field of fields) {
    const value = output[field];
    if (typeof value === "number") {
      output[field] = BigInt(value);
    }
  }
  return output;
}

export class RuntimeSubscriptionCache {
  private readonly serversById = new Map<string, ServerRow>();
  private readonly runtimeInstancesById = new Map<string, RuntimeInstanceRow>();
  private readonly auditLogsById = new Map<string, AuditLogRow>();
  private readonly configByKey = new Map<string, RuntimeConfigRecord>();
  private readonly configAcksByKey = new Map<string, RuntimeConfigAckRecord>();
  private readonly pluginsById = new Map<string, PluginRecord>();
  private readonly deploymentsByKey = new Map<string, PluginDeploymentRecord>();
  private readonly bundlesById = new Map<string, PluginBundleRecord>();
  private readonly capabilitiesById = new Map<string, PluginCapabilityRow>();
  private readonly pluginManifestsById = new Map<string, PluginManifestRow>();
  private readonly pluginPackagesById = new Map<string, PluginPackageRecord>();
  private readonly packageSignerRevocationsById = new Map<string, PluginPackageSignerRevocationRow>();
  private readonly pluginRuntimeInstancesById = new Map<string, PluginRuntimeInstanceRow>();
  private readonly pluginConfigValuesByKey = new Map<string, PluginConfigValueRow>();
  private readonly pluginSchemasByKey = new Map<string, PluginSchemaRow>();
  private readonly pluginEntitiesById = new Map<string, PluginEntityRow>();
  private readonly pluginSandboxEventsById = new Map<string, PluginSandboxEventRow>();
  private readonly accountsById = new Map<string, EconomyAccountRow>();
  private readonly transactionsById = new Map<string, EconomyTransactionRow>();
  private readonly ledgerEntriesById = new Map<string, EconomyLedgerEntryRow>();
  private readonly invoicesById = new Map<string, EconomyInvoiceRow>();
  private readonly economyLimitsById = new Map<string, EconomyLimitRow>();
  private readonly itemsByKey = new Map<string, GameplayItemRow>();
  private readonly jobsByKey = new Map<string, GameplayJobRow>();
  private readonly vehiclesByModel = new Map<string, GameplayVehicleRow>();
  private readonly locationsByKey = new Map<string, GameplayLocationRow>();
  private readonly charactersById = new Map<string, CharacterRow>();
  private readonly inventoryStacksById = new Map<string, InventoryStackRow>();
  private readonly characterJobsById = new Map<string, CharacterJobRow>();
  private readonly pluginHooksById = new Map<string, PluginHookRow>();
  private readonly principalsById = new Map<string, PrincipalRow>();
  private readonly principalEdgesById = new Map<string, PrincipalEdgeRow>();
  private readonly permissionGrantsById = new Map<string, PermissionGrantRow>();
  private readonly permissionsByKey = new Map<string, PermissionDefinition>();
  private readonly permissionCacheVersionsByServerId = new Map<string, PermissionCacheVersion>();
  private readonly aceMirrorRulesById = new Map<string, AceMirrorRule>();
  private readonly policyConstraintsById = new Map<string, PolicyConstraintRow>();
  private readonly menuDefinitionsById = new Map<string, MenuDefinitionRow>();
  private readonly menuActionsById = new Map<string, MenuActionRow>();
  private readonly runtimeCommandsById = new Map<string, RuntimeCommandRow>();
  private readonly runtimePanelsById = new Map<string, RuntimePanelRow>();
  private readonly menuVisibilityPoliciesById = new Map<string, MenuVisibilityPolicyRow>();
  private readonly menuSessionsById = new Map<string, MenuSessionRow>();
  private serverId?: string;

  public scopeToServer(serverId: string): void {
    this.serverId = serverId;
    for (const [key, row] of this.runtimeInstancesById.entries()) {
      if (row.serverId !== serverId) {
        this.runtimeInstancesById.delete(key);
      }
    }
    for (const [key, row] of this.auditLogsById.entries()) {
      if (row.serverId !== serverId) {
        this.auditLogsById.delete(key);
      }
    }
    for (const [key, row] of this.configByKey.entries()) {
      if (row.serverId !== serverId) {
        this.configByKey.delete(key);
      }
    }
    for (const [key, row] of this.configAcksByKey.entries()) {
      if (row.serverId !== serverId) {
        this.configAcksByKey.delete(key);
      }
    }
    for (const key of this.permissionCacheVersionsByServerId.keys()) {
      if (key !== serverId) {
        this.permissionCacheVersionsByServerId.delete(key);
      }
    }
    for (const [key, row] of this.menuSessionsById.entries()) {
      if (row.serverId !== serverId) {
        this.menuSessionsById.delete(key);
      }
    }
    for (const [key, row] of this.pluginRuntimeInstancesById.entries()) {
      if (row.serverId !== serverId) {
        this.pluginRuntimeInstancesById.delete(key);
      }
    }
    for (const [key, row] of this.pluginConfigValuesByKey.entries()) {
      if (row.serverId !== serverId) {
        this.pluginConfigValuesByKey.delete(key);
      }
    }
    for (const [key, row] of this.pluginSandboxEventsById.entries()) {
      if (row.serverId !== serverId) {
        this.pluginSandboxEventsById.delete(key);
      }
    }
  }

  public upsertConfig(row: RuntimeConfigRecord): void {
    if (this.serverId && row.serverId !== this.serverId) {
      return;
    }

    this.configByKey.set(`${row.namespace}:${row.key}`, structuredClone(row));
  }

  public upsertServer(row: ServerRow): void {
    this.serversById.set(row.id, structuredClone(row));
  }

  public getServer(id: string): ServerRow | undefined {
    const row = this.serversById.get(id);
    return row ? structuredClone(row) : undefined;
  }

  public upsertRuntimeInstance(row: RuntimeInstanceRow): void {
    if (this.serverId && row.serverId !== this.serverId) {
      return;
    }

    this.runtimeInstancesById.set(row.id, structuredClone(row));
  }

  public getRuntimeInstance(id: string): RuntimeInstanceRow | undefined {
    const row = this.runtimeInstancesById.get(id);
    return row ? structuredClone(row) : undefined;
  }

  public getRuntimeInstances(): RuntimeInstanceRow[] {
    return [...this.runtimeInstancesById.values()]
      .sort((left, right) => timestampMs(left.startedAt) - timestampMs(right.startedAt) || left.id.localeCompare(right.id))
      .map((row) => structuredClone(row));
  }

  public upsertAuditLog(row: AuditLogRow): void {
    if (this.serverId && row.serverId !== this.serverId) {
      return;
    }

    this.auditLogsById.set(row.id, structuredClone(row));
  }

  public getAuditLogs(filter: { actorId?: string; actionType?: string; status?: string } = {}): AuditLogRow[] {
    return [...this.auditLogsById.values()]
      .filter((row) => !filter.actorId || row.actorId === filter.actorId)
      .filter((row) => !filter.actionType || row.actionType === filter.actionType)
      .filter((row) => !filter.status || row.status === filter.status)
      .sort((left, right) => timestampMs(left.createdAt) - timestampMs(right.createdAt) || left.id.localeCompare(right.id))
      .map((row) => structuredClone(row));
  }

  public getConfig(namespace: string, key: string): RuntimeConfigRecord | undefined {
    const row = this.configByKey.get(`${namespace}:${key}`);
    return row ? structuredClone(row) : undefined;
  }

  public getConfigSnapshot(): RuntimeConfigRecord[] {
    return [...this.configByKey.values()]
      .sort((left, right) => left.namespace.localeCompare(right.namespace) || left.key.localeCompare(right.key))
      .map((row) => structuredClone(row));
  }

  public upsertConfigAck(row: RuntimeConfigAckRecord): void {
    if (this.serverId && row.serverId !== this.serverId) {
      return;
    }

    this.configAcksByKey.set(`${row.namespace}:${row.key}`, structuredClone(row));
  }

  public getConfigAck(namespace: string, key: string): RuntimeConfigAckRecord | undefined {
    const row = this.configAcksByKey.get(`${namespace}:${key}`);
    return row ? structuredClone(row) : undefined;
  }

  public upsertPlugin(row: PluginRecord): void {
    this.pluginsById.set(row.id, structuredClone(row));
  }

  public getPlugin(pluginId: string): PluginRecord | undefined {
    const row = this.pluginsById.get(pluginId);
    return row ? structuredClone(row) : undefined;
  }

  public listPlugins(): PluginRecord[] {
    return [...this.pluginsById.values()]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((row) => structuredClone(row));
  }

  public upsertPluginPackage(row: PluginPackageRecord): void {
    this.pluginPackagesById.set(row.packageId, structuredClone(row));
  }

  public getPluginPackage(packageId: string): PluginPackageRecord | undefined {
    const row = this.pluginPackagesById.get(packageId);
    return row ? structuredClone(row) : undefined;
  }

  public listPluginPackages(): PluginPackageRecord[] {
    return [...this.pluginPackagesById.values()]
      .sort((left, right) => left.packageId.localeCompare(right.packageId))
      .map((row) => structuredClone(row));
  }

  public upsertPackageSignerRevocation(row: PluginPackageSignerRevocationRow): void {
    this.packageSignerRevocationsById.set(row.signerId, structuredClone(row));
  }

  public getPackageSignerRevocation(signerId: string): PluginPackageSignerRevocationRow | undefined {
    const row = this.packageSignerRevocationsById.get(signerId);
    return row ? structuredClone(row) : undefined;
  }

  public listPackageSignerRevocations(): PluginPackageSignerRevocationRow[] {
    return [...this.packageSignerRevocationsById.values()]
      .sort((left, right) => left.signerId.localeCompare(right.signerId))
      .map((row) => structuredClone(row));
  }

  public upsertDeployment(row: PluginDeploymentRecord): void {
    this.deploymentsByKey.set(`${row.pluginId}:${row.serverId}`, structuredClone(row));
  }

  public getDeployment(pluginId: string, serverId: string): PluginDeploymentRecord | undefined {
    const row = this.deploymentsByKey.get(`${pluginId}:${serverId}`);
    return row ? structuredClone(row) : undefined;
  }

  public getDeployments(): PluginDeploymentRecord[] {
    return [...this.deploymentsByKey.values()]
      .sort((left, right) => left.pluginId.localeCompare(right.pluginId) || left.serverId.localeCompare(right.serverId) || left.id.localeCompare(right.id))
      .map((row) => structuredClone(row));
  }

  public upsertBundle(row: PluginBundleRecord): void {
    this.bundlesById.set(row.id, structuredClone(row));
  }

  public getBundle(bundleId: string): PluginBundleRecord | undefined {
    const row = this.bundlesById.get(bundleId);
    return row ? structuredClone(row) : undefined;
  }

  public getBundles(): PluginBundleRecord[] {
    return [...this.bundlesById.values()]
      .sort((left, right) => left.pluginId.localeCompare(right.pluginId) || left.version.localeCompare(right.version) || left.id.localeCompare(right.id))
      .map((row) => structuredClone(row));
  }

  public upsertCapability(row: PluginCapabilityRow): void {
    this.capabilitiesById.set(row.id, structuredClone(row));
  }

  public getCapabilities(): PluginCapabilityRow[] {
    return [...this.capabilitiesById.values()]
      .sort((left, right) => left.pluginId.localeCompare(right.pluginId) || left.bundleId.localeCompare(right.bundleId) || left.capabilityKey.localeCompare(right.capabilityKey) || left.id.localeCompare(right.id))
      .map((row) => structuredClone(row));
  }

  public getCapabilitiesForBundle(bundleId: string): PluginCapabilityRow[] {
    return [...this.capabilitiesById.values()]
      .filter((row) => row.bundleId === bundleId)
      .sort((left, right) => left.capabilityKey.localeCompare(right.capabilityKey) || left.id.localeCompare(right.id))
      .map((row) => structuredClone(row));
  }

  public upsertPluginManifest(row: PluginManifestRow): void {
    this.pluginManifestsById.set(row.pluginId, structuredClone(row));
  }

  public getPluginManifest(pluginId: string): PluginManifestRow | undefined {
    const row = this.pluginManifestsById.get(pluginId);
    return row ? structuredClone(row) : undefined;
  }

  public getPluginManifests(): PluginManifestRow[] {
    return [...this.pluginManifestsById.values()]
      .sort((left, right) => left.pluginId.localeCompare(right.pluginId))
      .map((row) => structuredClone(row));
  }

  public upsertPluginRuntimeInstance(row: PluginRuntimeInstanceRow): void {
    if (this.serverId && row.serverId !== this.serverId) {
      return;
    }

    this.pluginRuntimeInstancesById.set(row.id, structuredClone(row));
  }

  public getPluginRuntimeInstance(id: string): PluginRuntimeInstanceRow | undefined {
    const row = this.pluginRuntimeInstancesById.get(id);
    return row ? structuredClone(row) : undefined;
  }

  public getPluginRuntimeInstancesForPlugin(pluginId: string): PluginRuntimeInstanceRow[] {
    return [...this.pluginRuntimeInstancesById.values()]
      .filter((row) => row.pluginId === pluginId)
      .sort((left, right) => left.serverId.localeCompare(right.serverId) || left.id.localeCompare(right.id))
      .map((row) => structuredClone(row));
  }

  public getPluginRuntimeInstances(): PluginRuntimeInstanceRow[] {
    return [...this.pluginRuntimeInstancesById.values()]
      .sort((left, right) => left.pluginId.localeCompare(right.pluginId) || left.serverId.localeCompare(right.serverId) || left.id.localeCompare(right.id))
      .map((row) => structuredClone(row));
  }

  public upsertPluginConfigValue(row: PluginConfigValueRow): void {
    if (this.serverId && row.serverId !== this.serverId) {
      return;
    }

    this.pluginConfigValuesByKey.set(this.pluginConfigKey(row.pluginId, row.serverId, row.key), structuredClone(row));
  }

  public getPluginConfigValue(pluginId: string, serverId: string, key: string): PluginConfigValueRow | undefined {
    const row = this.pluginConfigValuesByKey.get(this.pluginConfigKey(pluginId, serverId, key));
    return row ? structuredClone(row) : undefined;
  }

  public getPluginConfigValuesForPlugin(pluginId: string): PluginConfigValueRow[] {
    return [...this.pluginConfigValuesByKey.values()]
      .filter((row) => row.pluginId === pluginId)
      .sort((left, right) => left.key.localeCompare(right.key) || left.id.localeCompare(right.id))
      .map((row) => structuredClone(row));
  }

  public getPluginConfigValues(): PluginConfigValueRow[] {
    return [...this.pluginConfigValuesByKey.values()]
      .sort((left, right) => left.pluginId.localeCompare(right.pluginId) || left.serverId.localeCompare(right.serverId) || left.key.localeCompare(right.key) || left.id.localeCompare(right.id))
      .map((row) => structuredClone(row));
  }

  public upsertPluginSchema(row: PluginSchemaRow): void {
    this.pluginSchemasByKey.set(this.pluginSchemaKey(row.pluginId, row.entityType, row.schemaVersion), structuredClone(row));
  }

  public getPluginSchema(pluginId: string, entityType: string, schemaVersion: number): PluginSchemaRow | undefined {
    const row = this.pluginSchemasByKey.get(this.pluginSchemaKey(pluginId, entityType, schemaVersion));
    return row ? structuredClone(row) : undefined;
  }

  public getPluginSchemasForPlugin(pluginId: string): PluginSchemaRow[] {
    return [...this.pluginSchemasByKey.values()]
      .filter((row) => row.pluginId === pluginId)
      .sort((left, right) =>
        left.entityType.localeCompare(right.entityType) ||
        left.schemaVersion - right.schemaVersion ||
        left.id.localeCompare(right.id)
      )
      .map((row) => structuredClone(row));
  }

  public getPluginSchemas(pluginId?: string): PluginSchemaRow[] {
    return [...this.pluginSchemasByKey.values()]
      .filter((row) => !pluginId || row.pluginId === pluginId)
      .sort((left, right) =>
        left.pluginId.localeCompare(right.pluginId) ||
        left.entityType.localeCompare(right.entityType) ||
        left.schemaVersion - right.schemaVersion ||
        left.id.localeCompare(right.id)
      )
      .map((row) => structuredClone(row));
  }

  public upsertPluginEntity(row: PluginEntityRow): void {
    this.pluginEntitiesById.set(row.id, structuredClone(row));
  }

  public getPluginEntity(id: string): PluginEntityRow | undefined {
    const row = this.pluginEntitiesById.get(id);
    return row ? structuredClone(row) : undefined;
  }

  public getPluginEntities(pluginId?: string, entityType?: string): PluginEntityRow[] {
    return [...this.pluginEntitiesById.values()]
      .filter((row) => (!pluginId || row.pluginId === pluginId) && (!entityType || row.entityType === entityType))
      .sort((left, right) => left.pluginId.localeCompare(right.pluginId) || timestampMs(left.createdAt) - timestampMs(right.createdAt) || left.id.localeCompare(right.id))
      .map((row) => structuredClone(row));
  }

  public upsertPluginSandboxEvent(row: PluginSandboxEventRow): void {
    if (this.serverId && row.serverId !== this.serverId) {
      return;
    }

    this.pluginSandboxEventsById.set(row.id, structuredClone(row));
  }

  public getPluginSandboxEvent(id: string): PluginSandboxEventRow | undefined {
    const row = this.pluginSandboxEventsById.get(id);
    return row ? structuredClone(row) : undefined;
  }

  public getPluginSandboxEvents(): PluginSandboxEventRow[] {
    return [...this.pluginSandboxEventsById.values()]
      .sort((left, right) => timestampMs(left.createdAt) - timestampMs(right.createdAt) || left.id.localeCompare(right.id))
      .map((row) => structuredClone(row));
  }

  public getPluginSandboxEventsForPlugin(pluginId: string): PluginSandboxEventRow[] {
    return [...this.pluginSandboxEventsById.values()]
      .filter((row) => row.pluginId === pluginId)
      .sort((left, right) => timestampMs(left.createdAt) - timestampMs(right.createdAt) || left.id.localeCompare(right.id))
      .map((row) => structuredClone(row));
  }

  public upsertAccount(row: EconomyAccountRow): void {
    this.accountsById.set(row.id, structuredClone(row));
  }

  public getAccount(id: string): EconomyAccountRow | undefined {
    const row = this.accountsById.get(id);
    return row ? structuredClone(row) : undefined;
  }

  public getAccounts(filter: { ownerType?: string; ownerId?: string; currency?: string; status?: string } = {}): EconomyAccountRow[] {
    return [...this.accountsById.values()]
      .filter((row) => !filter.ownerType || row.ownerType === filter.ownerType)
      .filter((row) => !filter.ownerId || row.ownerId === filter.ownerId)
      .filter((row) => !filter.currency || row.currency === filter.currency)
      .filter((row) => !filter.status || row.status === filter.status)
      .sort((left, right) => left.ownerType.localeCompare(right.ownerType) || left.ownerId.localeCompare(right.ownerId) || left.id.localeCompare(right.id))
      .map((row) => structuredClone(row));
  }

  public getAccountsForOwner(ownerType: string, ownerId: string): EconomyAccountRow[] {
    return [...this.accountsById.values()]
      .filter((row) => row.ownerType === ownerType && row.ownerId === ownerId)
      .sort((left, right) => left.currency.localeCompare(right.currency) || left.id.localeCompare(right.id))
      .map((row) => structuredClone(row));
  }

  public upsertTransaction(row: EconomyTransactionRow): void {
    this.transactionsById.set(row.id, structuredClone(row));
  }

  public getTransaction(id: string): EconomyTransactionRow | undefined {
    const row = this.transactionsById.get(id);
    return row ? structuredClone(row) : undefined;
  }

  public getTransactions(filter: { actorId?: string; transactionType?: string; status?: string } = {}): EconomyTransactionRow[] {
    return [...this.transactionsById.values()]
      .filter((row) => !filter.actorId || row.actorId === filter.actorId)
      .filter((row) => !filter.transactionType || row.transactionType === filter.transactionType)
      .filter((row) => !filter.status || row.status === filter.status)
      .sort((left, right) => timestampMs(left.createdAt) - timestampMs(right.createdAt) || left.id.localeCompare(right.id))
      .map((row) => structuredClone(row));
  }

  public getTransactionsForActor(actorId: string): EconomyTransactionRow[] {
    return [...this.transactionsById.values()]
      .filter((row) => row.actorId === actorId)
      .sort((left, right) => timestampMs(left.createdAt) - timestampMs(right.createdAt) || left.id.localeCompare(right.id))
      .map((row) => structuredClone(row));
  }

  public upsertLedgerEntry(row: EconomyLedgerEntryRow): void {
    this.ledgerEntriesById.set(row.id, structuredClone(row));
  }

  public getLedgerEntriesForAccount(accountId: string): EconomyLedgerEntryRow[] {
    return [...this.ledgerEntriesById.values()]
      .filter((row) => row.accountId === accountId)
      .sort((left, right) => timestampMs(left.createdAt) - timestampMs(right.createdAt) || left.id.localeCompare(right.id))
      .map((row) => structuredClone(row));
  }

  public getLedgerEntriesForTransaction(transactionId: string): EconomyLedgerEntryRow[] {
    return [...this.ledgerEntriesById.values()]
      .filter((row) => row.transactionId === transactionId)
      .sort((left, right) => timestampMs(left.createdAt) - timestampMs(right.createdAt) || left.id.localeCompare(right.id))
      .map((row) => structuredClone(row));
  }

  public upsertInvoice(row: EconomyInvoiceRow): void {
    this.invoicesById.set(row.id, structuredClone(row));
  }

  public getInvoice(id: string): EconomyInvoiceRow | undefined {
    const row = this.invoicesById.get(id);
    return row ? structuredClone(row) : undefined;
  }

  public getInvoicesForAccount(accountId: string): EconomyInvoiceRow[] {
    return [...this.invoicesById.values()]
      .filter((row) => row.issuerAccountId === accountId || row.payerAccountId === accountId)
      .sort((left, right) => timestampMs(left.issuedAt) - timestampMs(right.issuedAt) || left.id.localeCompare(right.id))
      .map((row) => structuredClone(row));
  }

  public upsertEconomyLimit(row: EconomyLimitRow): void {
    this.economyLimitsById.set(row.id, structuredClone(row));
  }

  public getEconomyLimit(id: string): EconomyLimitRow | undefined {
    const row = this.economyLimitsById.get(id);
    return row ? structuredClone(row) : undefined;
  }

  public getEconomyLimits(): EconomyLimitRow[] {
    return [...this.economyLimitsById.values()]
      .sort((left, right) => left.actionType.localeCompare(right.actionType) || left.id.localeCompare(right.id))
      .map((row) => structuredClone(row));
  }

  public buildEconomyLedger(permissions: PermissionEngine): EconomyLedger {
    return new EconomyLedger({
      permissions,
      accounts: this.getAccounts().map(toEconomyLedgerAccount),
      limits: this.getEconomyLimits().map(toEconomyLedgerLimit)
    });
  }

  public upsertItem(row: GameplayItemRow): void {
    this.itemsByKey.set(row.key, structuredClone(row));
  }

  public getItem(key: string): GameplayItemRow | undefined {
    const row = this.itemsByKey.get(key);
    return row ? structuredClone(row) : undefined;
  }

  public getItems(): GameplayItemRow[] {
    return [...this.itemsByKey.values()]
      .sort((left, right) => left.key.localeCompare(right.key))
      .map((row) => structuredClone(row));
  }

  public upsertJob(row: GameplayJobRow): void {
    this.jobsByKey.set(row.key, structuredClone(row));
  }

  public getJob(key: string): GameplayJobRow | undefined {
    const row = this.jobsByKey.get(key);
    return row ? structuredClone(row) : undefined;
  }

  public getJobs(): GameplayJobRow[] {
    return [...this.jobsByKey.values()]
      .sort((left, right) => left.key.localeCompare(right.key))
      .map((row) => structuredClone(row));
  }

  public upsertVehicle(row: GameplayVehicleRow): void {
    this.vehiclesByModel.set(row.model, structuredClone(row));
  }

  public getVehicle(model: string): GameplayVehicleRow | undefined {
    const row = this.vehiclesByModel.get(model);
    return row ? structuredClone(row) : undefined;
  }

  public getVehicles(): GameplayVehicleRow[] {
    return [...this.vehiclesByModel.values()]
      .sort((left, right) => left.model.localeCompare(right.model))
      .map((row) => structuredClone(row));
  }

  public upsertLocation(row: GameplayLocationRow): void {
    this.locationsByKey.set(row.key, structuredClone(row));
  }

  public getLocation(key: string): GameplayLocationRow | undefined {
    const row = this.locationsByKey.get(key);
    return row ? structuredClone(row) : undefined;
  }

  public getLocations(): GameplayLocationRow[] {
    return [...this.locationsByKey.values()]
      .sort((left, right) => left.key.localeCompare(right.key))
      .map((row) => structuredClone(row));
  }

  public upsertCharacter(row: CharacterRow): void {
    this.charactersById.set(row.id, structuredClone(row));
  }

  public getCharacter(id: string): CharacterRow | undefined {
    const row = this.charactersById.get(id);
    return row ? structuredClone(row) : undefined;
  }

  public getCharacters(): CharacterRow[] {
    return [...this.charactersById.values()]
      .sort((left, right) => left.playerPrincipalId.localeCompare(right.playerPrincipalId) || left.slot - right.slot || left.id.localeCompare(right.id))
      .map((row) => structuredClone(row));
  }

  public getSelectedCharacterForPlayer(playerPrincipalId: string): CharacterRow | undefined {
    const selected = [...this.charactersById.values()]
      .filter((row) => row.playerPrincipalId === playerPrincipalId && row.selected)
      .sort((left, right) => left.slot - right.slot || left.id.localeCompare(right.id))[0];
    return selected ? structuredClone(selected) : undefined;
  }

  public upsertInventoryStack(row: InventoryStackRow): void {
    this.inventoryStacksById.set(row.id, structuredClone(row));
  }

  public getInventoryStacks(): InventoryStackRow[] {
    return [...this.inventoryStacksById.values()]
      .sort((left, right) => left.ownerId.localeCompare(right.ownerId) || left.itemKey.localeCompare(right.itemKey) || left.id.localeCompare(right.id))
      .map((row) => structuredClone(row));
  }

  public getInventoryForOwner(ownerId: string): InventoryStackRow[] {
    return [...this.inventoryStacksById.values()]
      .filter((row) => row.ownerId === ownerId)
      .sort((left, right) => left.itemKey.localeCompare(right.itemKey) || left.id.localeCompare(right.id))
      .map((row) => structuredClone(row));
  }

  public upsertCharacterJob(row: CharacterJobRow): void {
    this.characterJobsById.set(row.characterId, structuredClone(row));
  }

  public getCharacterJob(characterId: string): CharacterJobRow | undefined {
    const row = this.characterJobsById.get(characterId);
    return row ? structuredClone(row) : undefined;
  }

  public getCharacterJobs(): CharacterJobRow[] {
    return [...this.characterJobsById.values()]
      .sort((left, right) => left.characterId.localeCompare(right.characterId))
      .map((row) => structuredClone(row));
  }

  public upsertPluginHook(row: PluginHookRow): void {
    this.pluginHooksById.set(row.id, structuredClone(row));
  }

  public getPluginHooksForHook(hookName: string): PluginHookRow[] {
    return [...this.pluginHooksById.values()]
      .filter((row) => row.hookName === hookName && row.enabled)
      .sort((left, right) => left.priority - right.priority || left.id.localeCompare(right.id))
      .map((row) => structuredClone(row));
  }

  public upsertPrincipal(row: PrincipalRow): void {
    this.principalsById.set(row.id, structuredClone(row));
  }

  public getPrincipal(id: string): PrincipalRow | undefined {
    const row = this.principalsById.get(id);
    return row ? structuredClone(row) : undefined;
  }

  public getPrincipals(): PrincipalRow[] {
    return [...this.principalsById.values()]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((row) => structuredClone(row));
  }

  public upsertPrincipalEdge(row: PrincipalEdgeRow): void {
    this.principalEdgesById.set(row.id, structuredClone(row));
  }

  public getPrincipalEdgesForChild(childPrincipalId: string): PrincipalEdgeRow[] {
    return [...this.principalEdgesById.values()]
      .filter((row) => row.childPrincipalId === childPrincipalId)
      .sort((left, right) => left.parentPrincipalId.localeCompare(right.parentPrincipalId) || left.id.localeCompare(right.id))
      .map((row) => structuredClone(row));
  }

  public getPrincipalEdgesForParent(parentPrincipalId: string): PrincipalEdgeRow[] {
    return [...this.principalEdgesById.values()]
      .filter((row) => row.parentPrincipalId === parentPrincipalId)
      .sort((left, right) => left.childPrincipalId.localeCompare(right.childPrincipalId) || left.id.localeCompare(right.id))
      .map((row) => structuredClone(row));
  }

  public getPrincipalEdges(): PrincipalEdgeRow[] {
    return [...this.principalEdgesById.values()]
      .sort((left, right) => left.parentPrincipalId.localeCompare(right.parentPrincipalId) || left.childPrincipalId.localeCompare(right.childPrincipalId) || left.id.localeCompare(right.id))
      .map((row) => structuredClone(row));
  }

  public upsertPermissionGrant(row: PermissionGrantRow): void {
    this.permissionGrantsById.set(row.id, structuredClone(row));
  }

  public getPermissionGrantsForPrincipal(principalId: string): PermissionGrantRow[] {
    return [...this.permissionGrantsById.values()]
      .filter((row) => row.principalId === principalId)
      .sort((left, right) => left.permissionKey.localeCompare(right.permissionKey) || left.id.localeCompare(right.id))
      .map((row) => structuredClone(row));
  }

  public getPermissionGrants(): PermissionGrantRow[] {
    return [...this.permissionGrantsById.values()]
      .sort((left, right) => left.principalId.localeCompare(right.principalId) || left.permissionKey.localeCompare(right.permissionKey) || left.id.localeCompare(right.id))
      .map((row) => structuredClone(row));
  }

  public upsertPermission(row: PermissionDefinition): void {
    this.permissionsByKey.set(row.key, structuredClone(row));
  }

  public getPermission(permissionKey: string): PermissionDefinition | undefined {
    const row = this.permissionsByKey.get(permissionKey);
    return row ? structuredClone(row) : undefined;
  }

  public getPermissions(): PermissionDefinition[] {
    return [...this.permissionsByKey.values()]
      .sort((left, right) => left.key.localeCompare(right.key))
      .map((row) => structuredClone(row));
  }

  public upsertPermissionCacheVersion(row: PermissionCacheVersion): void {
    if (this.serverId && row.serverId !== this.serverId) {
      return;
    }

    this.permissionCacheVersionsByServerId.set(row.serverId, structuredClone(row));
  }

  public getPermissionCacheVersion(serverId: string): PermissionCacheVersion | undefined {
    const row = this.permissionCacheVersionsByServerId.get(serverId);
    return row ? structuredClone(row) : undefined;
  }

  public upsertAceMirrorRule(row: AceMirrorRule): void {
    const id = row.id ?? `${row.permissionKey}:${row.aceObject}`;
    this.aceMirrorRulesById.set(id, structuredClone({ ...row, id }));
  }

  public getAceMirrorRules(): AceMirrorRule[] {
    return [...this.aceMirrorRulesById.values()]
      .sort((left, right) => (left.id ?? "").localeCompare(right.id ?? ""))
      .map((row) => structuredClone(row));
  }

  public upsertPolicyConstraint(row: PolicyConstraintRow): void {
    this.policyConstraintsById.set(row.id, structuredClone(row));
  }

  public getPolicyConstraint(id: string): PolicyConstraintRow | undefined {
    const row = this.policyConstraintsById.get(id);
    return row ? structuredClone(row) : undefined;
  }

  public getPolicyConstraintsForPermission(permissionKey: string): PolicyConstraintRow[] {
    return [...this.policyConstraintsById.values()]
      .filter((row) => row.permissionKey === permissionKey)
      .sort((left, right) => left.priority - right.priority || left.id.localeCompare(right.id))
      .map((row) => structuredClone(row));
  }

  public getPolicyConstraints(): PolicyConstraintRow[] {
    return [...this.policyConstraintsById.values()]
      .sort((left, right) => left.permissionKey.localeCompare(right.permissionKey) || left.priority - right.priority || left.id.localeCompare(right.id))
      .map((row) => structuredClone(row));
  }

  public upsertMenuDefinition(row: MenuDefinitionRow): void {
    this.menuDefinitionsById.set(row.id, structuredClone(row));
  }

  public getMenuDefinition(id: string): MenuDefinitionRow | undefined {
    const row = this.menuDefinitionsById.get(id);
    return row ? structuredClone(row) : undefined;
  }

  public getMenuDefinitionsForPlugin(pluginId: string): MenuDefinitionRow[] {
    return [...this.menuDefinitionsById.values()]
      .filter((row) => row.pluginId === pluginId)
      .sort((left, right) => left.order - right.order || left.label.localeCompare(right.label) || left.id.localeCompare(right.id))
      .map((row) => structuredClone(row));
  }

  public getMenuDefinitions(): MenuDefinitionRow[] {
    return [...this.menuDefinitionsById.values()]
      .sort((left, right) => left.order - right.order || left.label.localeCompare(right.label) || left.id.localeCompare(right.id))
      .map((row) => structuredClone(row));
  }

  public upsertMenuAction(row: MenuActionRow): void {
    this.menuActionsById.set(row.id, structuredClone(row));
  }

  public getMenuAction(id: string): MenuActionRow | undefined {
    const row = this.menuActionsById.get(id);
    return row ? structuredClone(row) : undefined;
  }

  public getMenuActionsForPlugin(pluginId: string): MenuActionRow[] {
    return [...this.menuActionsById.values()]
      .filter((row) => row.pluginId === pluginId)
      .sort((left, right) => left.actionType.localeCompare(right.actionType) || left.id.localeCompare(right.id))
      .map((row) => structuredClone(row));
  }

  public getMenuActions(): MenuActionRow[] {
    return [...this.menuActionsById.values()]
      .sort((left, right) => left.actionType.localeCompare(right.actionType) || left.id.localeCompare(right.id))
      .map((row) => structuredClone(row));
  }

  public upsertRuntimeCommand(row: RuntimeCommandRow): void {
    this.runtimeCommandsById.set(row.id, structuredClone(row));
  }

  public getRuntimeCommand(id: string): RuntimeCommandRow | undefined {
    const row = this.runtimeCommandsById.get(id);
    return row ? structuredClone(row) : undefined;
  }

  public getRuntimeCommandsForPlugin(pluginId: string): RuntimeCommandRow[] {
    return [...this.runtimeCommandsById.values()]
      .filter((row) => row.pluginId === pluginId)
      .sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id))
      .map((row) => structuredClone(row));
  }

  public getRuntimeCommands(): RuntimeCommandRow[] {
    return [...this.runtimeCommandsById.values()]
      .sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id))
      .map((row) => structuredClone(row));
  }

  public upsertRuntimePanel(row: RuntimePanelRow): void {
    this.runtimePanelsById.set(row.id, structuredClone(row));
  }

  public getRuntimePanel(id: string): RuntimePanelRow | undefined {
    const row = this.runtimePanelsById.get(id);
    return row ? structuredClone(row) : undefined;
  }

  public getRuntimePanelsForPlugin(pluginId: string): RuntimePanelRow[] {
    return [...this.runtimePanelsById.values()]
      .filter((row) => row.pluginId === pluginId)
      .sort((left, right) => left.order - right.order || left.title.localeCompare(right.title) || left.id.localeCompare(right.id))
      .map((row) => structuredClone(row));
  }

  public getRuntimePanels(): RuntimePanelRow[] {
    return [...this.runtimePanelsById.values()]
      .sort((left, right) => left.order - right.order || left.title.localeCompare(right.title) || left.id.localeCompare(right.id))
      .map((row) => structuredClone(row));
  }

  public upsertMenuVisibilityPolicy(row: MenuVisibilityPolicyRow): void {
    this.menuVisibilityPoliciesById.set(row.id, structuredClone(row));
  }

  public getMenuVisibilityPolicy(id: string): MenuVisibilityPolicyRow | undefined {
    const row = this.menuVisibilityPoliciesById.get(id);
    return row ? structuredClone(row) : undefined;
  }

  public getMenuVisibilityPolicies(): MenuVisibilityPolicyRow[] {
    return [...this.menuVisibilityPoliciesById.values()]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((row) => structuredClone(row));
  }

  public buildMenuRuntime(permissions: PermissionEngine): MenuRuntime {
    return new MenuRuntime({
      menus: this.getMenuDefinitions().map(toMenuDefinition),
      actions: this.getMenuActions().map(toMenuAction),
      visibilityPolicies: this.getMenuVisibilityPolicies().map(toMenuVisibilityPolicy),
      permissions
    });
  }

  public upsertMenuSession(row: MenuSessionRow): void {
    if (this.serverId && row.serverId !== this.serverId) {
      return;
    }

    this.menuSessionsById.set(row.id, structuredClone(row));
  }

  public getMenuSession(id: string): MenuSessionRow | undefined {
    const row = this.menuSessionsById.get(id);
    return row ? structuredClone(row) : undefined;
  }

  public getMenuSessionsForPlayer(playerId: string): MenuSessionRow[] {
    return [...this.menuSessionsById.values()]
      .filter((row) => row.playerId === playerId)
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((row) => structuredClone(row));
  }

  public getMenuSessions(): MenuSessionRow[] {
    return [...this.menuSessionsById.values()]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((row) => structuredClone(row));
  }

  private pluginConfigKey(pluginId: string, serverId: string, key: string): string {
    return `${pluginId}:${serverId}:${key}`;
  }

  private pluginSchemaKey(pluginId: string, entityType: string, schemaVersion: number): string {
    return `${pluginId}:${entityType}:${schemaVersion}`;
  }
}

export class SpacetimeRuntimeAdapter {
  public readonly cache = new RuntimeSubscriptionCache();

  public constructor(private readonly client: SpacetimeClient) {}

  public async connectAndSubscribe(serverId: string): Promise<void> {
    this.cache.scopeToServer(serverId);
    await this.client.connect();
    await this.subscribeRuntimeTable("servers", (row) => this.cache.upsertServer(row));
    await this.subscribeRuntimeTable("runtime_instances", (row) => this.cache.upsertRuntimeInstance(row));
    await this.subscribeRuntimeTable("audit_logs", (row) => this.cache.upsertAuditLog(row));
    await this.subscribeRuntimeTable("runtime_config", (row) => this.cache.upsertConfig(row));
    await this.subscribeRuntimeTable("runtime_config_acks", (row) => this.cache.upsertConfigAck(row));
    await this.subscribeRuntimeTable("menu_definitions", (row) => this.cache.upsertMenuDefinition(row));
    await this.subscribeRuntimeTable("menu_actions", (row) => this.cache.upsertMenuAction(row));
    await this.subscribeRuntimeTable("runtime_commands", (row) => this.cache.upsertRuntimeCommand(row));
    await this.subscribeRuntimeTable("runtime_panels", (row) => this.cache.upsertRuntimePanel(row));
    await this.subscribeRuntimeTable("menu_visibility_policies", (row) =>
      this.cache.upsertMenuVisibilityPolicy(row)
    );
    await this.subscribeRuntimeTable("menu_sessions", (row) => this.cache.upsertMenuSession(row));
    await this.subscribeRuntimeTable("principals", (row) => this.cache.upsertPrincipal(row));
    await this.subscribeRuntimeTable("principal_edges", (row) => this.cache.upsertPrincipalEdge(row));
    await this.subscribeRuntimeTable("permission_grants", (row) => this.cache.upsertPermissionGrant(row));
    await this.subscribeRuntimeTable("permissions", (row) => this.cache.upsertPermission(row));
    await this.subscribeRuntimeTable("permission_cache_versions", (row) => this.cache.upsertPermissionCacheVersion(row));
    await this.subscribeRuntimeTable("ace_mirror_rules", (row) => this.cache.upsertAceMirrorRule(row));
    await this.subscribeRuntimeTable("policy_constraints", (row) => this.cache.upsertPolicyConstraint(row));
    await this.subscribeRuntimeTable("plugins", (row) => this.cache.upsertPlugin(row));
    await this.subscribeRuntimeTable("plugin_packages", (row) => this.cache.upsertPluginPackage(row));
    await this.subscribeRuntimeTable("plugin_package_signer_revocations", (row) =>
      this.cache.upsertPackageSignerRevocation(row)
    );
    await this.subscribeRuntimeTable("plugin_bundles", (row) => this.cache.upsertBundle(row));
    await this.subscribeRuntimeTable("plugin_capabilities", (row) => this.cache.upsertCapability(row));
    await this.subscribeRuntimeTable("plugin_deployments", (row) => this.cache.upsertDeployment(row));
    await this.subscribeRuntimeTable("plugin_manifests", (row) => this.cache.upsertPluginManifest(row));
    await this.subscribeRuntimeTable("plugin_runtime_instances", (row) =>
      this.cache.upsertPluginRuntimeInstance(row)
    );
    await this.subscribeRuntimeTable("plugin_config_values", (row) => this.cache.upsertPluginConfigValue(row));
    await this.subscribeRuntimeTable("plugin_schemas", (row) => this.cache.upsertPluginSchema(row));
    await this.subscribeRuntimeTable("plugin_entities", (row) => this.cache.upsertPluginEntity(row));
    await this.subscribeRuntimeTable("plugin_sandbox_events", (row) => this.cache.upsertPluginSandboxEvent(row));
    await this.subscribeRuntimeTable("accounts", (row) => this.cache.upsertAccount(row));
    await this.subscribeRuntimeTable("transactions", (row) => this.cache.upsertTransaction(row));
    await this.subscribeRuntimeTable("ledger_entries", (row) => this.cache.upsertLedgerEntry(row));
    await this.subscribeRuntimeTable("invoices", (row) => this.cache.upsertInvoice(row));
    await this.subscribeRuntimeTable("economy_limits", (row) => this.cache.upsertEconomyLimit(row));
    await this.subscribeRuntimeTable("items", (row) => this.cache.upsertItem(row));
    await this.subscribeRuntimeTable("jobs", (row) => this.cache.upsertJob(row));
    await this.subscribeRuntimeTable("vehicles", (row) => this.cache.upsertVehicle(row));
    await this.subscribeRuntimeTable("locations", (row) => this.cache.upsertLocation(row));
    await this.subscribeRuntimeTable("characters", (row) => this.cache.upsertCharacter(row));
    await this.subscribeRuntimeTable("inventory_stacks", (row) => this.cache.upsertInventoryStack(row));
    await this.subscribeRuntimeTable("character_jobs", (row) => this.cache.upsertCharacterJob(row));
    await this.subscribeRuntimeTable("plugin_hooks", (row) => this.cache.upsertPluginHook(row));
  }

  public async registerServer(input: RegisterServerInput): Promise<unknown> {
    return this.client.callReducer("register_server", input);
  }

  public async heartbeat(input: HeartbeatInput): Promise<unknown> {
    return this.client.callReducer("heartbeat", input);
  }

  public async setRuntimeConfig(input: SetRuntimeConfigInput): Promise<unknown> {
    return this.client.callReducer("set_runtime_config", input);
  }

  public async ackConfigVersion(input: AckConfigVersionReducerInput): Promise<unknown> {
    return this.client.callReducer("ack_config_version", input);
  }

  public async submitAction(input: SubmitActionInput): Promise<unknown> {
    return this.client.callReducer("submit_action", input);
  }

  public async completeAction(input: CompleteActionReducerInput): Promise<unknown> {
    return this.client.callReducer("complete_action", input);
  }

  public async writeAuditLog(input: WriteAuditLogReducerInput): Promise<unknown> {
    return this.client.callReducer("write_audit_log", input);
  }

  public async createAccount(input: CreateAccountInput): Promise<unknown> {
    return this.client.callReducer("create_account", input);
  }

  public async transferMoney(input: TransferMoneyReducerInput): Promise<unknown> {
    return this.client.callReducer("transfer_money", input);
  }

  public async upsertEconomyLimit(input: UpsertEconomyLimitReducerInput): Promise<unknown> {
    return this.client.callReducer("upsert_economy_limit", input);
  }

  public async registerPermission(input: RegisterPermissionReducerInput): Promise<unknown> {
    return this.client.callReducer("register_permission", input);
  }

  public async ackPermissionCacheVersion(input: AckPermissionCacheVersionReducerInput): Promise<unknown> {
    return this.client.callReducer("ack_permission_cache_version", input);
  }

  public async upsertAceMirrorRule(input: UpsertAceMirrorRuleReducerInput): Promise<unknown> {
    return this.client.callReducer("upsert_ace_mirror_rule", input);
  }

  public async depositCash(input: AccountTransactionReducerInput): Promise<unknown> {
    return this.client.callReducer("deposit_cash", input);
  }

  public async withdrawCash(input: AccountTransactionReducerInput): Promise<unknown> {
    return this.client.callReducer("withdraw_cash", input);
  }

  public async paySalary(input: PaySalaryReducerInput): Promise<unknown> {
    return this.client.callReducer("pay_salary", input);
  }

  public async finePlayer(input: FinePlayerReducerInput): Promise<unknown> {
    return this.client.callReducer("fine_player", input);
  }

  public async chargeTax(input: ChargeTaxReducerInput): Promise<unknown> {
    return this.client.callReducer("charge_tax", input);
  }

  public async businessPayout(input: BusinessPayoutReducerInput): Promise<unknown> {
    return this.client.callReducer("business_payout", input);
  }

  public async issueInvoice(input: IssueInvoiceReducerInput): Promise<unknown> {
    return this.client.callReducer("issue_invoice", input);
  }

  public async payInvoice(input: PayInvoiceReducerInput): Promise<unknown> {
    return this.client.callReducer("pay_invoice", input);
  }

  public async buyItem(input: BuyItemReducerInput): Promise<unknown> {
    return this.client.callReducer("buy_item", input);
  }

  public async sellItem(input: SellItemReducerInput): Promise<unknown> {
    return this.client.callReducer("sell_item", input);
  }

  public async adminAdjustBalance(input: AdminAdjustBalanceReducerInput): Promise<unknown> {
    return this.client.callReducer("admin_adjust_balance", input);
  }

  public async voidTransaction(input: VoidTransactionReducerInput): Promise<unknown> {
    return this.client.callReducer("void_transaction", input);
  }

  public async upsertPrincipal(input: UpsertPrincipalReducerInput): Promise<unknown> {
    return this.client.callReducer("upsert_principal", input);
  }

  public async addPrincipalEdge(input: AddPrincipalEdgeReducerInput): Promise<unknown> {
    return this.client.callReducer("add_principal_edge", input);
  }

  public async removePrincipalEdge(input: RemovePrincipalEdgeReducerInput): Promise<unknown> {
    return this.client.callReducer("remove_principal_edge", input);
  }

  public async grantPermission(input: GrantPermissionReducerInput): Promise<unknown> {
    return this.client.callReducer("grant_permission", input);
  }

  public async upsertPolicyConstraint(input: UpsertPolicyConstraintReducerInput): Promise<unknown> {
    return this.client.callReducer("upsert_policy_constraint", input);
  }

  public async removePolicyConstraint(policyId: string): Promise<unknown> {
    return this.client.callReducer("remove_policy_constraint", { policyId });
  }

  public async registerPlugin(input: RegisterPluginReducerInput): Promise<unknown> {
    return this.client.callReducer("register_plugin", input);
  }

  public async registerPluginPackage(input: RegisterPluginPackageReducerInput): Promise<unknown> {
    return this.client.callReducer("register_plugin_package", input);
  }

  public async revokePackageSigner(input: RevokePackageSignerReducerInput): Promise<unknown> {
    return this.client.callReducer("revoke_package_signer", input);
  }

  public async setPluginStatus(input: SetPluginStatusReducerInput): Promise<unknown> {
    return this.client.callReducer("set_plugin_status", input);
  }

  public async uninstallPlugin(pluginId: string): Promise<unknown> {
    return this.client.callReducer("uninstall_plugin", { pluginId });
  }

  public async registerPluginManifest(input: RegisterPluginManifestReducerInput): Promise<unknown> {
    return this.client.callReducer("register_plugin_manifest", input);
  }

  public async upsertPluginRuntimeInstance(
    input: UpsertPluginRuntimeInstanceReducerInput
  ): Promise<unknown> {
    return this.client.callReducer("upsert_plugin_runtime_instance", input);
  }

  public async setPluginConfigValue(input: SetPluginConfigValueReducerInput): Promise<unknown> {
    return this.client.callReducer("set_plugin_config_value", input);
  }

  public async registerPluginBundle(input: RegisterPluginBundleReducerInput): Promise<unknown> {
    return this.client.callReducer("register_plugin_bundle", input);
  }

  public async revokePluginBundle(input: RevokePluginBundleReducerInput): Promise<unknown> {
    return this.client.callReducer("revoke_plugin_bundle", input);
  }

  public async upsertPluginCapability(input: UpsertPluginCapabilityReducerInput): Promise<unknown> {
    return this.client.callReducer("upsert_plugin_capability", input);
  }

  public async upsertPluginDeployment(input: UpsertPluginDeploymentReducerInput): Promise<unknown> {
    return this.client.callReducer("upsert_plugin_deployment", input);
  }

  public async registerPluginSchema(input: RegisterPluginSchemaReducerInput): Promise<unknown> {
    return this.client.callReducer("register_plugin_schema", input);
  }

  public async upsertPluginEntity(input: UpsertPluginEntityReducerInput): Promise<unknown> {
    return this.client.callReducer("upsert_plugin_entity", input);
  }

  public async recordPluginSandboxEvent(input: RecordPluginSandboxEventReducerInput): Promise<unknown> {
    return this.client.callReducer("record_plugin_sandbox_event", input);
  }

  public async registerPluginHook(input: RegisterPluginHookReducerInput): Promise<unknown> {
    return this.client.callReducer("register_plugin_hook", input);
  }

  public async setPluginHooksEnabled(input: SetPluginHooksEnabledReducerInput): Promise<unknown> {
    return this.client.callReducer("set_plugin_hooks_enabled", input);
  }

  public async upsertMenuDefinition(input: UpsertMenuDefinitionReducerInput): Promise<unknown> {
    return this.client.callReducer("upsert_menu_definition", input);
  }

  public async upsertMenuAction(input: UpsertMenuActionReducerInput): Promise<unknown> {
    return this.client.callReducer("upsert_menu_action", input);
  }

  public async upsertRuntimeCommand(input: UpsertRuntimeCommandReducerInput): Promise<unknown> {
    return this.client.callReducer("upsert_runtime_command", input);
  }

  public async upsertRuntimePanel(input: UpsertRuntimePanelReducerInput): Promise<unknown> {
    return this.client.callReducer("upsert_runtime_panel", input);
  }

  public async upsertMenuVisibilityPolicy(
    input: UpsertMenuVisibilityPolicyReducerInput
  ): Promise<unknown> {
    return this.client.callReducer("upsert_menu_visibility_policy", input);
  }

  public async openMenuSession(input: OpenMenuSessionReducerInput): Promise<unknown> {
    return this.client.callReducer("open_menu_session", input);
  }

  public async closeMenuSession(sessionId: string): Promise<unknown> {
    return this.client.callReducer("close_menu_session", { sessionId });
  }

  public async registerItem(input: RegisterItemReducerInput): Promise<unknown> {
    return this.client.callReducer("register_item", input);
  }

  public async registerJob(input: RegisterJobReducerInput): Promise<unknown> {
    return this.client.callReducer("register_job", input);
  }

  public async registerVehicle(input: RegisterVehicleReducerInput): Promise<unknown> {
    return this.client.callReducer("register_vehicle", input);
  }

  public async registerLocation(input: RegisterLocationReducerInput): Promise<unknown> {
    return this.client.callReducer("register_location", input);
  }

  public async upsertCharacter(input: UpsertCharacterReducerInput): Promise<unknown> {
    return this.client.callReducer("upsert_character", input);
  }

  public async grantItem(input: GrantItemReducerInput): Promise<unknown> {
    return this.client.callReducer("grant_item", input);
  }

  public async removeItem(input: RemoveItemReducerInput): Promise<unknown> {
    return this.client.callReducer("remove_item", input);
  }

  public async assignJob(input: AssignJobReducerInput): Promise<unknown> {
    return this.client.callReducer("assign_job", input);
  }

  private async subscribeRuntimeTable<Table extends RuntimeTableName>(
    table: Table,
    apply: (row: RuntimeTableRows[Table][number]) => void
  ): Promise<void> {
    const rows = await this.client.subscribe(table, apply);
    rows.forEach((row) => apply(row));
  }
}

export class FakeSpacetimeClient implements SpacetimeClient {
  public readonly subscribedTables: RuntimeTableName[] = [];
  public readonly reducerCalls: ReducerCall[] = [];
  private readonly callbacks = new Map<RuntimeTableName, (row: never) => void>();
  private readonly reducerFailures = new Map<string, Error>();
  private connected = false;

  public constructor(private readonly rows: Partial<RuntimeTableRows>) {}

  public async connect(): Promise<void> {
    this.connected = true;
  }

  public async subscribe<Table extends RuntimeTableName>(
    table: Table,
    onInsertOrUpdate: (row: RuntimeTableRows[Table][number]) => void
  ): Promise<RuntimeTableRows[Table]> {
    if (!this.connected) {
      throw new Error("Client must connect before subscribing");
    }

    this.subscribedTables.push(table);
    this.callbacks.set(table, onInsertOrUpdate as (row: never) => void);
    const rows = (this.rows[table] ?? []) as RuntimeTableRows[Table];
    return structuredClone(rows);
  }

  public async callReducer(name: string, args: unknown): Promise<unknown> {
    const failure = this.reducerFailures.get(name);
    if (failure) {
      throw failure;
    }

    this.reducerCalls.push({ name, args: structuredClone(args) });
    return { ok: true };
  }

  public failReducer(name: string, error: Error): void {
    this.reducerFailures.set(name, error);
  }

  public emitUpdate<Table extends RuntimeTableName>(
    table: Table,
    row: RuntimeTableRows[Table][number]
  ): void {
    const callback = this.callbacks.get(table);
    if (!callback) {
      throw new Error(`No subscription for table: ${table}`);
    }

    callback(structuredClone(row) as never);
  }
}

function tableProperty(table: string): string {
  return table.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

function toMenuDefinition(row: MenuDefinitionRow): MenuDefinition {
  return {
    id: row.id,
    pluginId: row.pluginId,
    label: row.label,
    parentId: optionalRowString(row.parentId),
    icon: optionalRowString(row.icon),
    order: row.order,
    requiredPermission: optionalRowString(row.requiredPermission),
    actionId: optionalRowString(row.actionId),
    enabled: row.enabled,
    visibilityPolicyId: optionalRowString(row.visibilityPolicyId)
  };
}

function toMenuAction(row: MenuActionRow): MenuAction {
  return {
    id: row.id,
    pluginId: row.pluginId,
    actionType: row.actionType as MenuAction["actionType"],
    reducerName: optionalRowString(row.reducerName),
    payloadSchema: parseOptionalJson(row.payloadSchemaJson),
    confirmationRequired: row.confirmationRequired,
    auditLevel: normalizeAuditLevel(row.auditLevel),
    requiredPermission: optionalRowString(row.requiredPermission),
    enabled: row.enabled
  };
}

function toMenuVisibilityPolicy(row: MenuVisibilityPolicyRow): MenuVisibilityPolicy {
  return {
    id: row.id,
    pluginId: row.pluginId,
    policyJson: row.policyJson,
    enabled: row.enabled
  };
}

function toEconomyLedgerAccount(row: EconomyAccountRow): Account {
  return {
    id: row.id,
    ownerType: row.ownerType as AccountOwnerType,
    ownerId: row.ownerId,
    currency: row.currency,
    balance: Number(row.balance),
    status: row.status as AccountStatus
  };
}

function toEconomyLedgerLimit(row: EconomyLimitRow): EconomyLimit {
  return {
    id: row.id,
    permissionKey: row.permissionKey,
    actionType: row.actionType,
    limit: parseEconomyLimitJson(row.limitJson),
    enabled: row.enabled
  };
}

function parseEconomyLimitJson(limitJson: string): EconomyLimit["limit"] {
  let raw: unknown;
  try {
    raw = JSON.parse(limitJson);
  } catch {
    return { maxAmount: 0 };
  }

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { maxAmount: 0 };
  }

  const record = raw as Record<string, unknown>;
  const maxAmount = record.maxAmount ?? record.max_amount;
  const allowedTypes = record.allowedAccountOwnerTypes ?? record.allowed_account_owner_types;
  return {
    maxAmount: typeof maxAmount === "number" ? maxAmount : undefined,
    allowedAccountOwnerTypes: Array.isArray(allowedTypes)
      ? allowedTypes.filter((value): value is AccountOwnerType => typeof value === "string") as AccountOwnerType[]
      : undefined
  };
}

function optionalRowString(value: string): string | undefined {
  return value === "" ? undefined : value;
}

function parseOptionalJson(value: string): unknown {
  if (value === "") {
    return undefined;
  }

  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function normalizeAuditLevel(value: string): MenuAction["auditLevel"] {
  if (value === "none" || value === "standard" || value === "high") {
    return value;
  }

  return "standard";
}

function reducerMethod(name: string): string {
  return tableProperty(name);
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Reducer arguments must be an object");
  }

  return value as Record<string, unknown>;
}

function ordered(input: Record<string, unknown>, keys: string[]): unknown[] {
  return keys.map((key) => input[key]);
}

function normalizeGeneratedRow(table: RuntimeTableName, row: unknown): unknown {
  const normalized = camelizeObject(row);

  if (table === "runtime_config") {
    const record = normalized as Record<string, unknown>;
    if ("valueJson" in record) {
      record.value = parseJsonValue(record.valueJson);
      delete record.valueJson;
    }
  }

  if (table === "plugins") {
    const record = normalized as Record<string, unknown>;
    if (!record.installedAt && record.createdAt) {
      record.installedAt = record.createdAt;
    }
  }

  return normalized;
}

function camelizeObject(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (value instanceof Date) {
    return new Date(value.getTime());
  }

  if (Array.isArray(value)) {
    return value.map((item) => camelizeObject(item));
  }

  const result: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value)) {
    const normalizedKey = tableProperty(key);
    result[normalizedKey] = normalizeScalar(normalizedKey, raw);
  }

  return result;
}

function normalizeScalar(key: string, value: unknown): unknown {
  if (key.endsWith("At") && typeof value === "string") {
    return new Date(value);
  }

  return camelizeObject(value);
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

function parseJsonValue(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
