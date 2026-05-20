import { type AdminHttpApi } from "../admin/http-api.js";
import {
  type AdminDeploymentSnapshot,
  type AdminGameplaySnapshot,
  type AdminMenuRegistrySnapshot,
  type KickDispatch,
  type MenuRefreshTarget,
  type ReplicatedStateUpdate,
  type TeleportDispatch,
  type VehicleRepairDispatch,
  type VehicleSpawnDispatch,
  type WorldStateUpdate
} from "../admin/service.js";
import {
  planAceMirrorCommands,
  type AceMirrorDesiredState,
  type AceMirrorPlanInput,
  type AceMirrorState
} from "../core/ace.js";
import { MenuRuntime, type MenuAction, type MenuDefinition, type MenuTreeNode, type MenuVisibilityPolicy } from "../core/menu.js";
import {
  type AceMirrorRule,
  PermissionEngine,
  type PermissionEffect,
  type PermissionDefinition,
  type PermissionGrant,
  type PrincipalEdge
} from "../core/permissions.js";
import { type PermissionSnapshot } from "../core/permission-store.js";
import { type RuntimeConfigRecord, type RuntimeHealthRecord } from "../core/runtime.js";

export interface FiveMRefreshEventPlan {
  serverId: string;
  eventName: "sdb_runtime:syncMenuRefresh";
  targets: MenuRefreshTarget[];
}

export interface FiveMAceMirrorEventPlan {
  eventName: "sdb_runtime:applyAceMirror";
  commands: string[];
  desired: AceMirrorState;
}

export interface FiveMConfigEventPlan {
  eventName: "sdb_runtime:syncConfig";
  namespace: string;
  values: Record<string, unknown>;
  versions: Record<string, number>;
}

export interface FiveMPermissionEventPlan {
  eventName: "sdb_runtime:syncPermissions";
  principalId: string;
  permissions: Record<string, true>;
}

export interface FiveMHealthEventPlan {
  eventName: "sdb_runtime:syncHealth";
  health: FiveMRuntimeHealthPayload;
}

export interface FiveMMenuTreeEventPlan {
  eventName: "sdb_runtime:syncMenuTree";
  principalId: string;
  tree: MenuTreeNode[];
}

export interface FiveMReplicatedStateEventPlan {
  serverId: string;
  eventName: "sdb_runtime:syncReplicatedState";
  updates: FiveMReplicatedStatePayloadUpdate[];
}

export interface FiveMReplicatedStatePayloadUpdate {
  key: string;
  value: unknown;
  playerId?: string | number;
}

export interface FiveMVehicleRepairEventPlan {
  serverId: string;
  eventName: "sdb_runtime:repairVehicle";
  repairs: FiveMVehicleRepairPayload[];
}

export interface FiveMVehicleRepairPayload {
  targetSource: string | number;
  targetVehicleNetId: number;
}

export interface FiveMVehicleSpawnEventPlan {
  serverId: string;
  eventName: "sdb_runtime:spawnVehicles";
  spawns: FiveMVehicleSpawnPayload[];
}

export interface FiveMVehicleSpawnPayload {
  targetSource: string | number;
  model: string;
  label: string;
  category: string;
  location?: VehicleSpawnDispatch["location"];
  heading?: number;
  warpIntoVehicle?: boolean;
}

export interface FiveMWorldStateEventPlan {
  serverId: string;
  eventName: "sdb_runtime:syncWorldState";
  world: WorldStateUpdate["world"];
}

export interface FiveMTeleportEventPlan {
  serverId: string;
  eventName: "sdb_runtime:teleportPlayer";
  teleport: FiveMTeleportPayload;
}

export interface FiveMTeleportPayload {
  targetSource: string | number;
  x: number;
  y: number;
  z: number;
  heading?: number;
}

export interface FiveMKickEventPlan {
  serverId: string;
  eventName: "sdb_runtime:kickPlayer";
  kick: FiveMKickPayload;
}

export interface FiveMQbPlayerDataEventPlan {
  serverId: string;
  eventName: "sdb_runtime:syncQbPlayerData";
  players: FiveMQbPlayerDataPayload[];
}

export interface FiveMQbSharedEventPlan {
  serverId: string;
  eventName: "sdb_runtime:syncQbShared";
  shared: FiveMQbSharedPayload;
}

export interface FiveMQbSharedPayload {
  Items: Record<string, Record<string, unknown>>;
  Jobs: Record<string, Record<string, unknown>>;
  Gangs: Record<string, Record<string, unknown>>;
  Vehicles: Record<string, Record<string, unknown>>;
  StarterItems: Record<string, unknown>;
  MoneyTypes: Record<string, number>;
  DefaultMetadata: Record<string, unknown>;
}

export interface FiveMQbCharacterUpdatePayload {
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

export interface FiveMQbCharacterSelectionPayload {
  characterId: string;
}

export interface FiveMQbMoneyUpdatePayload {
  transactionId: string;
  actorId: string;
  characterId: string;
  moneyType: string;
  operation: "add" | "remove" | "set";
  amount: number;
  reason: string;
  idempotencyKey: string;
}

export interface FiveMQbInventoryUpdatePayload {
  id: string;
  characterId: string;
  itemKey: string;
  operation: "add" | "remove";
  amount: number;
}

export interface FiveMQbPlayerDataPayload {
  source: string | number;
  characterId?: string;
  citizenid: string;
  cid: number;
  license: string;
  name: string;
  charinfo: Record<string, unknown>;
  money: Record<string, number>;
  job: Record<string, unknown>;
  gang: Record<string, unknown>;
  metadata: Record<string, unknown>;
  items: unknown[];
  position?: Record<string, unknown>;
}

export interface FiveMQbPlayerDataSnapshot {
  serverId: string;
  source: string | number;
  characterId?: string;
  citizenid: string;
  cid: number;
  license: string;
  name: string;
  charinfo?: Record<string, unknown>;
  money?: Record<string, number>;
  job?: Record<string, unknown>;
  gang?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  items?: unknown[];
  position?: Record<string, unknown>;
}

export interface FiveMDeploymentDiagnosticsEventPlan {
  serverId: string;
  eventName: "sdb_runtime:syncDeployments";
  deployments: FiveMDeploymentPayload[];
  sandboxEvents: FiveMSandboxEventPayload[];
}

export interface FiveMDeploymentPayload {
  id: string;
  pluginId: string;
  bundleId: string;
  serverId: string;
  status: string;
  desiredVersion: string;
  activeVersion?: string;
  errorMessage?: string;
}

export interface FiveMSandboxEventPayload {
  id: string;
  pluginId: string;
  serverId: string;
  eventType: string;
  payloadHash: string;
  status: string;
  createdAt?: string;
}

export interface FiveMKickPayload {
  targetSource: string | number;
  reason: string;
}

export interface FiveMRuntimeHealthPayload {
  serverId: string;
  serverName: string;
  environment: string;
  status: string;
  reason: string;
  resourceVersion?: string;
  fxserverBuild?: string;
  gameBuild?: string;
  lastHeartbeatAt: string;
  lastSeenAt?: string;
}

export interface FiveMServerEventEmitter {
  emitServerEvent(serverId: string, eventName: string, payload?: unknown): Promise<void>;
}

export interface FiveMRuntimeClient {
  drainQbCharacterUpdates?(serverId: string): Promise<unknown[]> | unknown[];
  drainQbCharacterSelections?(serverId: string): Promise<unknown[]> | unknown[];
  drainQbMoneyUpdates?(serverId: string): Promise<unknown[]> | unknown[];
  drainQbInventoryUpdates?(serverId: string): Promise<unknown[]> | unknown[];
}

export interface FiveMSidecarReconciler {
  reconcile(
    deployments: AdminDeploymentSnapshot["deployments"],
    bundlesById: Map<string, AdminDeploymentSnapshot["bundles"][number]>
  ): Promise<void>;
}

export interface FiveMRuntimeConnectorOptions {
  admin: AdminHttpApi;
  emitter: FiveMServerEventEmitter;
  serverId?: string;
  runtimeClient?: FiveMRuntimeClient;
  sidecarReconciler?: FiveMSidecarReconciler;
}

export interface MenuRefreshFlushResult {
  drainedTargets: MenuRefreshTarget[];
  emittedEvents: FiveMRefreshEventPlan[];
}

export interface AceMirrorSyncResult {
  commands: string[];
  emitted: boolean;
}

export interface RuntimeConfigSyncResult {
  emittedEvents: FiveMConfigEventPlan[];
}

export interface NativePermissionSyncResult {
  emittedEvents: FiveMPermissionEventPlan[];
}

export interface RuntimeHealthSyncResult {
  emittedEvent?: FiveMHealthEventPlan;
}

export interface MenuTreeSyncResult {
  emittedEvents: FiveMMenuTreeEventPlan[];
}

export interface ReplicatedStateSyncResult {
  drainedUpdates: ReplicatedStateUpdate[];
  emittedEvents: FiveMReplicatedStateEventPlan[];
}

export interface VehicleRepairSyncResult {
  drainedRepairs: VehicleRepairDispatch[];
  emittedEvents: FiveMVehicleRepairEventPlan[];
}

export interface VehicleSpawnSyncResult {
  drainedSpawns: VehicleSpawnDispatch[];
  emittedEvents: FiveMVehicleSpawnEventPlan[];
}

export interface WorldStateSyncResult {
  drainedUpdates: WorldStateUpdate[];
  emittedEvents: FiveMWorldStateEventPlan[];
}

export interface TeleportSyncResult {
  drainedTeleports: TeleportDispatch[];
  emittedEvents: FiveMTeleportEventPlan[];
}

export interface KickSyncResult {
  drainedKicks: KickDispatch[];
  emittedEvents: FiveMKickEventPlan[];
}

export interface RuntimeAuditMirrorSyncResult {
  mirrored: boolean;
}

export interface DeploymentDiagnosticsSyncResult {
  emittedEvent?: FiveMDeploymentDiagnosticsEventPlan;
}

export interface QbPlayerDataSyncResult {
  emittedEvent?: FiveMQbPlayerDataEventPlan;
}

export interface QbSharedSyncResult {
  emittedEvent?: FiveMQbSharedEventPlan;
}

export interface QbCharacterUpdateSyncResult {
  drainedUpdates: FiveMQbCharacterUpdatePayload[];
  applied: number;
}

export interface QbCharacterSelectionSyncResult {
  drainedSelections: FiveMQbCharacterSelectionPayload[];
  applied: number;
}

export interface QbMoneyUpdateSyncResult {
  drainedUpdates: FiveMQbMoneyUpdatePayload[];
  applied: number;
}

export interface QbInventoryUpdateSyncResult {
  drainedUpdates: FiveMQbInventoryUpdatePayload[];
  applied: number;
}

export interface FiveMRuntimeSyncAllResult {
  health: RuntimeHealthSyncResult;
  config: RuntimeConfigSyncResult;
  nativePermissions: NativePermissionSyncResult;
  aceMirror: AceMirrorSyncResult;
  menuTrees: MenuTreeSyncResult;
  menuRefreshes: MenuRefreshFlushResult;
  replicatedState: ReplicatedStateSyncResult;
  worldState: WorldStateSyncResult;
  vehicleSpawns: VehicleSpawnSyncResult;
  vehicleRepairs: VehicleRepairSyncResult;
  teleports: TeleportSyncResult;
  kicks: KickSyncResult;
  qbMoneyUpdates: QbMoneyUpdateSyncResult;
  qbInventoryUpdates: QbInventoryUpdateSyncResult;
  qbCharacterSelections: QbCharacterSelectionSyncResult;
  qbCharacterUpdates: QbCharacterUpdateSyncResult;
  qbPlayerData: QbPlayerDataSyncResult;
  qbShared: QbSharedSyncResult;
  deploymentDiagnostics: DeploymentDiagnosticsSyncResult;
  runtimeAudit: RuntimeAuditMirrorSyncResult;
}

export class FiveMRuntimeConnector {
  private readonly admin: AdminHttpApi;
  private readonly emitter: FiveMServerEventEmitter;
  private readonly serverId?: string;
  private readonly runtimeClient?: FiveMRuntimeClient;
  private readonly sidecarReconciler?: FiveMSidecarReconciler;
  private currentAceMirrorState: AceMirrorState = {
    aces: [],
    principals: []
  };
  private appliedHealthSignature = "";
  private readonly appliedConfigVersions = new Map<string, number>();
  private readonly appliedNativePermissionSignatures = new Map<string, string>();
  private readonly appliedMenuTreeSignatures = new Map<string, string>();
  private appliedDeploymentDiagnosticsSignature = "";
  private appliedQbPlayerDataSignature = "";
  private appliedQbSharedSignature = "";

  public constructor(options: FiveMRuntimeConnectorOptions) {
    this.admin = options.admin;
    this.emitter = options.emitter;
    this.serverId = options.serverId;
    this.runtimeClient = options.runtimeClient;
    this.sidecarReconciler = options.sidecarReconciler;
  }

  public async syncAll(): Promise<FiveMRuntimeSyncAllResult> {
    return {
      health: await this.syncRuntimeHealth(),
      config: await this.syncRuntimeConfig(),
      nativePermissions: await this.syncNativePermissions(),
      aceMirror: await this.syncAceMirror(),
      menuTrees: await this.syncMenuTrees(),
      menuRefreshes: await this.flushMenuRefreshes(),
      replicatedState: await this.syncReplicatedState(),
      worldState: await this.syncWorldState(),
      vehicleSpawns: await this.syncVehicleSpawns(),
      vehicleRepairs: await this.syncVehicleRepairs(),
      teleports: await this.syncTeleports(),
      kicks: await this.syncKicks(),
      qbMoneyUpdates: await this.syncQbMoneyUpdates(),
      qbInventoryUpdates: await this.syncQbInventoryUpdates(),
      qbCharacterSelections: await this.syncQbCharacterSelections(),
      qbCharacterUpdates: await this.syncQbCharacterUpdates(),
      qbPlayerData: await this.syncQbPlayerData(),
      qbShared: await this.syncQbShared(),
      deploymentDiagnostics: await this.syncDeploymentDiagnostics(),
      runtimeAudit: await this.syncRuntimeAudit()
    };
  }

  public async syncQbMoneyUpdates(): Promise<QbMoneyUpdateSyncResult> {
    const serverId = this.serverId ?? "server-1";
    if (!this.runtimeClient?.drainQbMoneyUpdates) {
      return {
        drainedUpdates: [],
        applied: 0
      };
    }

    const drainedUpdates = parseQbMoneyUpdates(await this.runtimeClient.drainQbMoneyUpdates(serverId));
    if (drainedUpdates.length === 0) {
      return {
        drainedUpdates,
        applied: 0
      };
    }

    const response = await this.admin.handle({
      method: "POST",
      path: "/qbcore/money-updates",
      body: {
        updates: drainedUpdates
      }
    });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Failed to persist QBCore money updates: HTTP ${response.status}`);
    }

    return {
      drainedUpdates,
      applied: parseAppliedCount(response.body)
    };
  }

  public async syncQbInventoryUpdates(): Promise<QbInventoryUpdateSyncResult> {
    const serverId = this.serverId ?? "server-1";
    if (!this.runtimeClient?.drainQbInventoryUpdates) {
      return {
        drainedUpdates: [],
        applied: 0
      };
    }

    const drainedUpdates = parseQbInventoryUpdates(await this.runtimeClient.drainQbInventoryUpdates(serverId));
    if (drainedUpdates.length === 0) {
      return {
        drainedUpdates,
        applied: 0
      };
    }

    const response = await this.admin.handle({
      method: "POST",
      path: "/qbcore/inventory-updates",
      body: {
        updates: drainedUpdates
      }
    });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Failed to persist QBCore inventory updates: HTTP ${response.status}`);
    }

    return {
      drainedUpdates,
      applied: parseAppliedCount(response.body)
    };
  }

  public async syncQbCharacterSelections(): Promise<QbCharacterSelectionSyncResult> {
    const serverId = this.serverId ?? "server-1";
    if (!this.runtimeClient?.drainQbCharacterSelections) {
      return {
        drainedSelections: [],
        applied: 0
      };
    }

    const drainedSelections = parseQbCharacterSelections(await this.runtimeClient.drainQbCharacterSelections(serverId));
    if (drainedSelections.length === 0) {
      return {
        drainedSelections,
        applied: 0
      };
    }

    const response = await this.admin.handle({
      method: "POST",
      path: "/qbcore/character-selections",
      body: {
        selections: drainedSelections
      }
    });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Failed to persist QBCore character selections: HTTP ${response.status}`);
    }

    return {
      drainedSelections,
      applied: parseAppliedCount(response.body)
    };
  }

  public async syncQbCharacterUpdates(): Promise<QbCharacterUpdateSyncResult> {
    const serverId = this.serverId ?? "server-1";
    if (!this.runtimeClient?.drainQbCharacterUpdates) {
      return {
        drainedUpdates: [],
        applied: 0
      };
    }

    const drainedUpdates = parseQbCharacterUpdates(await this.runtimeClient.drainQbCharacterUpdates(serverId));
    if (drainedUpdates.length === 0) {
      return {
        drainedUpdates,
        applied: 0
      };
    }

    const response = await this.admin.handle({
      method: "POST",
      path: "/qbcore/character-updates",
      body: {
        updates: drainedUpdates
      }
    });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Failed to persist QBCore character updates: HTTP ${response.status}`);
    }

    return {
      drainedUpdates,
      applied: parseAppliedCount(response.body)
    };
  }

  public async syncQbPlayerData(): Promise<QbPlayerDataSyncResult> {
    const serverId = this.serverId ?? "server-1";
    const response = await this.admin.handle({
      method: "GET",
      path: `/qbcore/player-data?serverId=${encodeURIComponent(serverId)}`
    });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Failed to read QBCore PlayerData snapshots: HTTP ${response.status}`);
    }

    const [event] = planQbPlayerDataEvents(parseQbPlayerDataSnapshots(response.body));
    const signature = stableJsonArray(event?.players ?? []);
    if (!event || this.appliedQbPlayerDataSignature === signature) {
      return {
        emittedEvent: undefined
      };
    }

    await this.emitter.emitServerEvent(serverId, event.eventName, {
      players: event.players
    });
    this.appliedQbPlayerDataSignature = signature;
    return {
      emittedEvent: event
    };
  }

  public async syncQbShared(): Promise<QbSharedSyncResult> {
    const serverId = this.serverId ?? "server-1";
    const response = await this.admin.handle({
      method: "GET",
      path: "/gameplay"
    });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Failed to read gameplay primitives for QBCore shared data: HTTP ${response.status}`);
    }

    const event = planQbSharedEvent(serverId, parseGameplaySnapshot(response.body));
    const signature = stableJsonArray([event.shared]);
    if (this.appliedQbSharedSignature === signature) {
      return {
        emittedEvent: undefined
      };
    }

    await this.emitter.emitServerEvent(serverId, event.eventName, {
      shared: event.shared
    });
    this.appliedQbSharedSignature = signature;
    return {
      emittedEvent: event
    };
  }

  public async syncDeploymentDiagnostics(): Promise<DeploymentDiagnosticsSyncResult> {
    const serverId = this.serverId ?? "server-1";
    const response = await this.admin.handle({ method: "GET", path: "/deployments" });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Failed to read deployment diagnostics: HTTP ${response.status}`);
    }

    const snapshot = parseDeploymentSnapshot(response.body);
    await this.reconcileSidecars(serverId, snapshot);
    const event = planDeploymentDiagnosticsEvent(serverId, snapshot);
    const signature = stableJsonArray([event.deployments, event.sandboxEvents]);
    if (this.appliedDeploymentDiagnosticsSignature === signature) {
      return {
        emittedEvent: undefined
      };
    }

    await this.emitter.emitServerEvent(serverId, event.eventName, {
      deployments: event.deployments,
      sandboxEvents: event.sandboxEvents
    });
    this.appliedDeploymentDiagnosticsSignature = signature;
    return {
      emittedEvent: event
    };
  }

  private async reconcileSidecars(serverId: string, snapshot: AdminDeploymentSnapshot): Promise<void> {
    if (!this.sidecarReconciler) {
      return;
    }

    await this.sidecarReconciler.reconcile(
      snapshot.deployments.filter((deployment) => deployment.serverId === serverId),
      new Map(snapshot.bundles.map((bundle) => [bundle.id, bundle]))
    );
  }

  public async syncRuntimeAudit(): Promise<RuntimeAuditMirrorSyncResult> {
    if (!this.serverId) {
      return { mirrored: false };
    }

    const response = await this.admin.handle({
      method: "POST",
      path: `/servers/${encodeURIComponent(this.serverId)}/audit/mirror`
    });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Failed to mirror runtime audit logs: HTTP ${response.status}`);
    }

    return { mirrored: true };
  }

  public async flushMenuRefreshes(): Promise<MenuRefreshFlushResult> {
    const path = this.serverId
      ? `/menus/refresh-targets/drain?serverId=${encodeURIComponent(this.serverId)}`
      : "/menus/refresh-targets/drain";
    const response = await this.admin.handle({ method: "POST", path });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Failed to drain menu refresh targets: HTTP ${response.status}`);
    }

    const drainedTargets = parseMenuRefreshTargets(response.body);
    const emittedEvents = planMenuRefreshEvents(drainedTargets);
    for (const event of emittedEvents) {
      await this.emitter.emitServerEvent(event.serverId, event.eventName, {
        targets: event.targets
      });
    }

    return {
      drainedTargets,
      emittedEvents
    };
  }

  public async syncReplicatedState(): Promise<ReplicatedStateSyncResult> {
    const path = this.serverId
      ? `/runtime/replicated-state/drain?serverId=${encodeURIComponent(this.serverId)}`
      : "/runtime/replicated-state/drain";
    const response = await this.admin.handle({ method: "POST", path });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Failed to drain replicated state updates: HTTP ${response.status}`);
    }

    const drainedUpdates = parseReplicatedStateUpdates(response.body);
    const emittedEvents = planReplicatedStateEvents(drainedUpdates);
    for (const event of emittedEvents) {
      await this.emitter.emitServerEvent(event.serverId, event.eventName, {
        updates: event.updates
      });
    }

    return {
      drainedUpdates,
      emittedEvents
    };
  }

  public async syncVehicleSpawns(): Promise<VehicleSpawnSyncResult> {
    const path = this.serverId
      ? `/gameplay/vehicle-spawns/drain?serverId=${encodeURIComponent(this.serverId)}`
      : "/gameplay/vehicle-spawns/drain";
    const response = await this.admin.handle({ method: "POST", path });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Failed to drain vehicle spawns: HTTP ${response.status}`);
    }

    const drainedSpawns = parseVehicleSpawnDispatches(response.body);
    const emittedEvents = planVehicleSpawnEvents(drainedSpawns);
    for (const event of emittedEvents) {
      await this.emitter.emitServerEvent(event.serverId, event.eventName, {
        spawns: event.spawns
      });
    }

    return {
      drainedSpawns,
      emittedEvents
    };
  }

  public async syncVehicleRepairs(): Promise<VehicleRepairSyncResult> {
    const path = this.serverId
      ? `/gameplay/vehicle-repairs/drain?serverId=${encodeURIComponent(this.serverId)}`
      : "/gameplay/vehicle-repairs/drain";
    const response = await this.admin.handle({ method: "POST", path });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Failed to drain vehicle repairs: HTTP ${response.status}`);
    }

    const drainedRepairs = parseVehicleRepairDispatches(response.body);
    const emittedEvents = planVehicleRepairEvents(drainedRepairs);
    for (const event of emittedEvents) {
      await this.emitter.emitServerEvent(event.serverId, event.eventName, {
        repairs: event.repairs
      });
    }

    return {
      drainedRepairs,
      emittedEvents
    };
  }

  public async syncWorldState(): Promise<WorldStateSyncResult> {
    const path = this.serverId
      ? `/runtime/world-state/drain?serverId=${encodeURIComponent(this.serverId)}`
      : "/runtime/world-state/drain";
    const response = await this.admin.handle({ method: "POST", path });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Failed to drain world state updates: HTTP ${response.status}`);
    }

    const drainedUpdates = parseWorldStateUpdates(response.body);
    const emittedEvents = planWorldStateEvents(drainedUpdates);
    for (const event of emittedEvents) {
      await this.emitter.emitServerEvent(event.serverId, event.eventName, {
        world: event.world
      });
    }

    return {
      drainedUpdates,
      emittedEvents
    };
  }

  public async syncTeleports(): Promise<TeleportSyncResult> {
    const path = this.serverId
      ? `/gameplay/teleports/drain?serverId=${encodeURIComponent(this.serverId)}`
      : "/gameplay/teleports/drain";
    const response = await this.admin.handle({ method: "POST", path });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Failed to drain teleports: HTTP ${response.status}`);
    }

    const drainedTeleports = parseTeleportDispatches(response.body);
    const emittedEvents = planTeleportEvents(drainedTeleports);
    for (const event of emittedEvents) {
      await this.emitter.emitServerEvent(event.serverId, event.eventName, {
        teleport: event.teleport
      });
    }

    return {
      drainedTeleports,
      emittedEvents
    };
  }

  public async syncKicks(): Promise<KickSyncResult> {
    const path = this.serverId
      ? `/gameplay/kicks/drain?serverId=${encodeURIComponent(this.serverId)}`
      : "/gameplay/kicks/drain";
    const response = await this.admin.handle({ method: "POST", path });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Failed to drain kicks: HTTP ${response.status}`);
    }

    const drainedKicks = parseKickDispatches(response.body);
    const emittedEvents = planKickEvents(drainedKicks);
    for (const event of emittedEvents) {
      await this.emitter.emitServerEvent(event.serverId, event.eventName, {
        kick: event.kick
      });
    }

    return {
      drainedKicks,
      emittedEvents
    };
  }

  public async syncAceMirror(): Promise<AceMirrorSyncResult> {
    const response = await this.admin.handle({ method: "GET", path: "/permissions" });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Failed to read permission snapshot: HTTP ${response.status}`);
    }

    const event = planAceMirrorEvent({
      current: this.currentAceMirrorState,
      desired: toAceMirrorDesiredState(parsePermissionSnapshot(response.body))
    });
    if (event.commands.length === 0) {
      return {
        commands: [],
        emitted: false
      };
    }

    await this.emitter.emitServerEvent(this.serverId ?? "server-1", event.eventName, {
      commands: event.commands
    });
    this.currentAceMirrorState = event.desired;
    return {
      commands: event.commands,
      emitted: true
    };
  }

  public async syncRuntimeConfig(): Promise<RuntimeConfigSyncResult> {
    const serverId = this.serverId ?? "server-1";
    const response = await this.admin.handle({ method: "GET", path: `/servers/${serverId}/dashboard` });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Failed to read runtime dashboard: HTTP ${response.status}`);
    }

    const changedConfig = parseDashboardConfig(response.body)
      .filter((record) => this.appliedConfigVersions.get(configVersionKey(record)) !== record.version);
    const emittedEvents = planRuntimeConfigEvents(changedConfig);
    for (const event of emittedEvents) {
      await this.emitter.emitServerEvent(serverId, event.eventName, {
        namespace: event.namespace,
        values: event.values,
        versions: event.versions
      });
    }
    for (const record of changedConfig) {
      this.appliedConfigVersions.set(configVersionKey(record), record.version);
    }

    return {
      emittedEvents
    };
  }

  public async syncRuntimeHealth(): Promise<RuntimeHealthSyncResult> {
    const serverId = this.serverId ?? "server-1";
    const response = await this.admin.handle({ method: "GET", path: `/servers/${serverId}/dashboard` });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Failed to read runtime dashboard: HTTP ${response.status}`);
    }

    const event = planRuntimeHealthEvent(parseDashboardHealth(response.body));
    const signature = stableJson(event.health);
    if (this.appliedHealthSignature === signature) {
      return {
        emittedEvent: undefined
      };
    }

    await this.emitter.emitServerEvent(serverId, event.eventName, {
      health: event.health
    });
    this.appliedHealthSignature = signature;
    return {
      emittedEvent: event
    };
  }

  public async syncMenuTrees(): Promise<MenuTreeSyncResult> {
    const serverId = this.serverId ?? "server-1";
    const [menuResponse, permissionResponse] = await Promise.all([
      this.admin.handle({ method: "GET", path: "/menus" }),
      this.admin.handle({ method: "GET", path: "/permissions" })
    ]);
    if (menuResponse.status < 200 || menuResponse.status >= 300) {
      throw new Error(`Failed to read menu registry: HTTP ${menuResponse.status}`);
    }
    if (permissionResponse.status < 200 || permissionResponse.status >= 300) {
      throw new Error(`Failed to read permission snapshot: HTTP ${permissionResponse.status}`);
    }

    const plannedEvents = planMenuTreeEvents({
      registry: parseMenuRegistry(menuResponse.body),
      permissions: parsePermissionSnapshot(permissionResponse.body)
    });
    const plannedByPrincipal = new Map(plannedEvents.map((event) => [event.principalId, event]));
    const principalIds = new Set([
      ...plannedByPrincipal.keys(),
      ...this.appliedMenuTreeSignatures.keys()
    ]);
    const emittedEvents: FiveMMenuTreeEventPlan[] = [];

    for (const principalId of [...principalIds].sort()) {
      const event = plannedByPrincipal.get(principalId) ?? {
        eventName: "sdb_runtime:syncMenuTree" as const,
        principalId,
        tree: []
      };
      const signature = stableJsonArray(event.tree);
      if (this.appliedMenuTreeSignatures.get(principalId) === signature) {
        continue;
      }

      await this.emitter.emitServerEvent(serverId, event.eventName, {
        principalId: event.principalId,
        tree: event.tree
      });
      this.appliedMenuTreeSignatures.set(principalId, signature);
      emittedEvents.push(event);
    }

    return {
      emittedEvents
    };
  }

  public async syncNativePermissions(): Promise<NativePermissionSyncResult> {
    const serverId = this.serverId ?? "server-1";
    const response = await this.admin.handle({ method: "GET", path: "/permissions" });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Failed to read permission snapshot: HTTP ${response.status}`);
    }

    const plannedEvents = planNativePermissionEvents(parsePermissionSnapshot(response.body));
    const plannedByPrincipal = new Map(plannedEvents.map((event) => [event.principalId, event]));
    const principalIds = new Set([
      ...plannedByPrincipal.keys(),
      ...this.appliedNativePermissionSignatures.keys()
    ]);
    const emittedEvents: FiveMPermissionEventPlan[] = [];

    for (const principalId of [...principalIds].sort()) {
      const event = plannedByPrincipal.get(principalId) ?? {
        eventName: "sdb_runtime:syncPermissions" as const,
        principalId,
        permissions: {}
      };
      const signature = stableJson(event.permissions);
      if (this.appliedNativePermissionSignatures.get(principalId) === signature) {
        continue;
      }

      await this.emitter.emitServerEvent(serverId, event.eventName, {
        principalId: event.principalId,
        permissions: event.permissions
      });
      this.appliedNativePermissionSignatures.set(principalId, signature);
      emittedEvents.push(event);
    }

    return {
      emittedEvents
    };
  }
}

export function planAceMirrorEvent(input: AceMirrorPlanInput): FiveMAceMirrorEventPlan {
  const plan = planAceMirrorCommands(input);
  return {
    eventName: "sdb_runtime:applyAceMirror",
    commands: plan.commands,
    desired: plan.desired
  };
}

export function planMenuRefreshEvents(targets: MenuRefreshTarget[]): FiveMRefreshEventPlan[] {
  const targetsByServer = new Map<string, MenuRefreshTarget[]>();
  for (const target of [...targets].sort(compareMenuRefreshTargets)) {
    const serverTargets = targetsByServer.get(target.serverId) ?? [];
    serverTargets.push(target);
    targetsByServer.set(target.serverId, serverTargets);
  }

  return [...targetsByServer.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([serverId, serverTargets]) => ({
      serverId,
      eventName: "sdb_runtime:syncMenuRefresh",
      targets: serverTargets
    }));
}

export function planReplicatedStateEvents(updates: ReplicatedStateUpdate[]): FiveMReplicatedStateEventPlan[] {
  const updatesByServer = new Map<string, FiveMReplicatedStatePayloadUpdate[]>();
  for (const update of [...updates].map(validateReplicatedStateUpdate).sort(compareReplicatedStateUpdates)) {
    const serverUpdates = updatesByServer.get(update.serverId) ?? [];
    const payloadUpdate: FiveMReplicatedStatePayloadUpdate = {
      key: update.key,
      value: update.value
    };
    if (update.playerId !== undefined) {
      payloadUpdate.playerId = update.playerId;
    }
    serverUpdates.push(payloadUpdate);
    updatesByServer.set(update.serverId, serverUpdates);
  }

  return [...updatesByServer.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([serverId, serverUpdates]) => ({
      serverId,
      eventName: "sdb_runtime:syncReplicatedState",
      updates: serverUpdates
    }));
}

export function planVehicleSpawnEvents(spawns: VehicleSpawnDispatch[]): FiveMVehicleSpawnEventPlan[] {
  const spawnsByServer = new Map<string, FiveMVehicleSpawnPayload[]>();
  for (const spawn of [...spawns].map(validateVehicleSpawnDispatch).sort(compareVehicleSpawnDispatches)) {
    const serverSpawns = spawnsByServer.get(spawn.serverId) ?? [];
    const payload: FiveMVehicleSpawnPayload = {
      targetSource: spawn.targetSource,
      model: spawn.model,
      label: spawn.label,
      category: spawn.category
    };
    if (spawn.location !== undefined) {
      payload.location = { ...spawn.location };
    }
    if (spawn.heading !== undefined) {
      payload.heading = spawn.heading;
    }
    if (spawn.warpIntoVehicle !== undefined) {
      payload.warpIntoVehicle = spawn.warpIntoVehicle;
    }
    serverSpawns.push(payload);
    spawnsByServer.set(spawn.serverId, serverSpawns);
  }

  return [...spawnsByServer.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([serverId, serverSpawns]) => ({
      serverId,
      eventName: "sdb_runtime:spawnVehicles",
      spawns: serverSpawns
    }));
}

export function planVehicleRepairEvents(repairs: VehicleRepairDispatch[]): FiveMVehicleRepairEventPlan[] {
  const repairsByServer = new Map<string, FiveMVehicleRepairPayload[]>();
  for (const repair of [...repairs].map(validateVehicleRepairDispatch).sort(compareVehicleRepairDispatches)) {
    const serverRepairs = repairsByServer.get(repair.serverId) ?? [];
    serverRepairs.push({
      targetSource: repair.targetSource,
      targetVehicleNetId: repair.targetVehicleNetId
    });
    repairsByServer.set(repair.serverId, serverRepairs);
  }

  return [...repairsByServer.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([serverId, serverRepairs]) => ({
      serverId,
      eventName: "sdb_runtime:repairVehicle",
      repairs: serverRepairs
    }));
}

export function planWorldStateEvents(updates: WorldStateUpdate[]): FiveMWorldStateEventPlan[] {
  const worldsByServer = new Map<string, WorldStateUpdate["world"]>();
  for (const update of [...updates].map(validateWorldStateUpdate).sort(compareWorldStateUpdates)) {
    worldsByServer.set(update.serverId, {
      ...(worldsByServer.get(update.serverId) ?? {}),
      ...update.world
    });
  }

  return [...worldsByServer.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([serverId, world]) => ({
      serverId,
      eventName: "sdb_runtime:syncWorldState",
      world
    }));
}

export function planTeleportEvents(teleports: TeleportDispatch[]): FiveMTeleportEventPlan[] {
  return [...teleports].map(validateTeleportDispatch)
    .sort(compareTeleportDispatches)
    .map((teleport) => {
      const payload: FiveMTeleportPayload = {
        targetSource: teleport.targetSource,
        x: teleport.x,
        y: teleport.y,
        z: teleport.z
      };
      if (teleport.heading !== undefined) {
        payload.heading = teleport.heading;
      }

      return {
        serverId: teleport.serverId,
        eventName: "sdb_runtime:teleportPlayer" as const,
        teleport: payload
      };
    });
}

export function planKickEvents(kicks: KickDispatch[]): FiveMKickEventPlan[] {
  return [...kicks].map(validateKickDispatch)
    .sort(compareKickDispatches)
    .map((kick) => ({
      serverId: kick.serverId,
      eventName: "sdb_runtime:kickPlayer" as const,
      kick: {
        targetSource: kick.targetSource,
        reason: kick.reason
      }
    }));
}

export function planQbPlayerDataEvents(players: FiveMQbPlayerDataSnapshot[]): FiveMQbPlayerDataEventPlan[] {
  const playersByServer = new Map<string, FiveMQbPlayerDataPayload[]>();
  for (const player of [...players].map(validateQbPlayerDataSnapshot).sort(compareQbPlayerDataSnapshots)) {
    const serverPlayers = playersByServer.get(player.serverId) ?? [];
    serverPlayers.push(stripQbPlayerServerId(player));
    playersByServer.set(player.serverId, serverPlayers);
  }

  return [...playersByServer.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([serverId, serverPlayers]) => ({
      serverId,
      eventName: "sdb_runtime:syncQbPlayerData" as const,
      players: serverPlayers
    }));
}

export function planQbSharedEvent(serverId: string, snapshot: AdminGameplaySnapshot): FiveMQbSharedEventPlan {
  if (typeof serverId !== "string" || serverId.length === 0) {
    throw new Error("QBCore shared serverId must be a non-empty string");
  }

  return {
    serverId,
    eventName: "sdb_runtime:syncQbShared",
    shared: {
      Items: Object.fromEntries([...snapshot.items]
        .sort((left, right) => left.key.localeCompare(right.key))
        .map((item) => [item.key, {
          name: item.key,
          label: item.label,
          weight: 0,
          type: "item",
          image: `${item.key}.png`,
          unique: !item.stackable,
          useable: false,
          shouldClose: true,
          combinable: null,
          description: "",
          maxStack: item.maxStack,
          pluginId: item.pluginId
        }])),
      Jobs: Object.fromEntries([...snapshot.jobs]
        .sort((left, right) => left.key.localeCompare(right.key))
        .map((job) => [job.key, {
          name: job.key,
          label: job.label,
          defaultDuty: false,
          offDutyPay: false,
          grades: qbcGradesFromJson(job.gradesJson),
          pluginId: job.pluginId
        }])),
      Gangs: {},
      Vehicles: Object.fromEntries([...snapshot.vehicles]
        .sort((left, right) => left.model.localeCompare(right.model))
        .map((vehicle) => [vehicle.model, {
          model: vehicle.model,
          name: vehicle.label,
          brand: "",
          price: 0,
          category: vehicle.category,
          type: "automobile",
          shop: "",
          pluginId: vehicle.pluginId
        }])),
      StarterItems: {},
      MoneyTypes: {
        cash: 500,
        bank: 5000,
        crypto: 0
      },
      DefaultMetadata: {}
    }
  };
}

export function planDeploymentDiagnosticsEvent(
  serverId: string,
  snapshot: AdminDeploymentSnapshot
): FiveMDeploymentDiagnosticsEventPlan {
  const deployments = snapshot.deployments
    .filter((deployment) => deployment.serverId === serverId)
    .sort(compareDeploymentPayloads)
    .map((deployment) => {
      const payload: FiveMDeploymentPayload = {
        id: deployment.id,
        pluginId: deployment.pluginId,
        bundleId: deployment.bundleId,
        serverId: deployment.serverId,
        status: deployment.status,
        desiredVersion: deployment.desiredVersion
      };
      if (deployment.activeVersion) {
        payload.activeVersion = deployment.activeVersion;
      }
      if (deployment.errorMessage) {
        payload.errorMessage = deployment.errorMessage;
      }
      return payload;
    });
  const sandboxEvents = snapshot.sandboxEvents
    .filter((event) => event.serverId === serverId)
    .sort(compareSandboxEventPayloads)
    .map((event) => ({
      id: event.id,
      pluginId: event.pluginId,
      serverId: event.serverId,
      eventType: event.eventType,
      payloadHash: event.payloadHash,
      status: event.status,
      createdAt: event.createdAt instanceof Date ? event.createdAt.toISOString() : undefined
    }));

  return {
    serverId,
    eventName: "sdb_runtime:syncDeployments",
    deployments,
    sandboxEvents
  };
}

export function planRuntimeConfigEvents(config: RuntimeConfigRecord[]): FiveMConfigEventPlan[] {
  const byNamespace = new Map<string, RuntimeConfigRecord[]>();
  for (const record of [...config].sort(compareConfigRecords)) {
    const records = byNamespace.get(record.namespace) ?? [];
    records.push(record);
    byNamespace.set(record.namespace, records);
  }

  return [...byNamespace.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([namespace, records]) => {
      const values: Record<string, unknown> = {};
      const versions: Record<string, number> = {};
      for (const record of records) {
        values[record.key] = record.value;
        versions[record.key] = record.version;
      }

      return {
        eventName: "sdb_runtime:syncConfig",
        namespace,
        values,
        versions
      };
    });
}

export function planRuntimeHealthEvent(health: RuntimeHealthRecord): FiveMHealthEventPlan {
  const payload: FiveMRuntimeHealthPayload = {
    serverId: health.serverId,
    serverName: health.serverName,
    environment: health.environment,
    status: health.status,
    reason: health.reason,
    lastHeartbeatAt: health.lastHeartbeatAt.toISOString()
  };

  if (health.resourceVersion) {
    payload.resourceVersion = health.resourceVersion;
  }
  if (health.fxserverBuild) {
    payload.fxserverBuild = health.fxserverBuild;
  }
  if (health.gameBuild) {
    payload.gameBuild = health.gameBuild;
  }
  if (health.lastSeenAt) {
    payload.lastSeenAt = health.lastSeenAt.toISOString();
  }

  return {
    eventName: "sdb_runtime:syncHealth",
    health: payload
  };
}

export function planMenuTreeEvents(input: {
  registry: AdminMenuRegistrySnapshot;
  permissions: PermissionSnapshot;
}): FiveMMenuTreeEventPlan[] {
  const permissionEngine = new PermissionEngine({
    principals: input.permissions.principals,
    edges: input.permissions.edges,
    grants: input.permissions.grants,
    policies: input.permissions.policies
  });
  const runtime = new MenuRuntime({
    menus: input.registry.definitions.map(toMenuDefinition),
    actions: input.registry.actions.map(toMenuAction),
    visibilityPolicies: input.registry.policies.map(toMenuVisibilityPolicy),
    permissions: permissionEngine
  });

  return [...collectNativePrincipalIds(input.permissions)].sort()
    .map((principalId) => ({
      eventName: "sdb_runtime:syncMenuTree" as const,
      principalId,
      tree: runtime.buildTreeForPrincipal(principalId)
    }))
    .filter((event) => event.tree.length > 0);
}

export function planNativePermissionEvents(snapshot: PermissionSnapshot): FiveMPermissionEventPlan[] {
  const principalIds = collectNativePrincipalIds(snapshot);
  const permissionKeys = collectPermissionKeys(snapshot.permissions, snapshot.grants);
  const engine = new PermissionEngine({
    principals: snapshot.principals,
    edges: snapshot.edges,
    grants: snapshot.grants,
    policies: snapshot.policies
  });

  return [...principalIds].sort()
    .map((principalId) => {
      const permissions: Record<string, true> = {};
      for (const permissionKey of permissionKeys) {
        if (engine.hasPermission(principalId, permissionKey).allowed) {
          permissions[permissionKey] = true;
        }
      }

      return {
        eventName: "sdb_runtime:syncPermissions" as const,
        principalId,
        permissions
      };
    })
    .filter((event) => Object.keys(event.permissions).length > 0);
}

function parseMenuRefreshTargets(value: unknown): MenuRefreshTarget[] {
  if (!Array.isArray(value)) {
    throw new Error("Menu refresh drain response must be an array");
  }

  return value.map((target) => {
    if (!target || typeof target !== "object" || Array.isArray(target)) {
      throw new Error("Menu refresh target must be an object");
    }

    const candidate = target as Record<string, unknown>;
    return {
      serverId: requireString(candidate.serverId, "serverId"),
      playerId: requireString(candidate.playerId, "playerId"),
      sessionId: requireString(candidate.sessionId, "sessionId"),
      cacheVersion: requireNumber(candidate.cacheVersion, "cacheVersion")
    };
  });
}

function parseReplicatedStateUpdates(value: unknown): ReplicatedStateUpdate[] {
  if (!Array.isArray(value)) {
    throw new Error("Replicated state drain response must be an array");
  }

  return value.map((update) => {
    if (!update || typeof update !== "object" || Array.isArray(update)) {
      throw new Error("Replicated state update must be an object");
    }

    return validateReplicatedStateUpdate(update as ReplicatedStateUpdate);
  });
}

function parseVehicleSpawnDispatches(value: unknown): VehicleSpawnDispatch[] {
  if (!Array.isArray(value)) {
    throw new Error("Vehicle spawn drain response must be an array");
  }

  return value.map((spawn) => {
    if (!spawn || typeof spawn !== "object" || Array.isArray(spawn)) {
      throw new Error("Vehicle spawn dispatch must be an object");
    }

    return validateVehicleSpawnDispatch(spawn as VehicleSpawnDispatch);
  });
}

function parseVehicleRepairDispatches(value: unknown): VehicleRepairDispatch[] {
  if (!Array.isArray(value)) {
    throw new Error("Vehicle repair drain response must be an array");
  }

  return value.map((repair) => {
    if (!repair || typeof repair !== "object" || Array.isArray(repair)) {
      throw new Error("Vehicle repair dispatch must be an object");
    }

    return validateVehicleRepairDispatch(repair as VehicleRepairDispatch);
  });
}

function parseWorldStateUpdates(value: unknown): WorldStateUpdate[] {
  if (!Array.isArray(value)) {
    throw new Error("World state drain response must be an array");
  }

  return value.map((update) => {
    if (!update || typeof update !== "object" || Array.isArray(update)) {
      throw new Error("World state update must be an object");
    }

    return validateWorldStateUpdate(update as WorldStateUpdate);
  });
}

function parseTeleportDispatches(value: unknown): TeleportDispatch[] {
  if (!Array.isArray(value)) {
    throw new Error("Teleport drain response must be an array");
  }

  return value.map((teleport) => {
    if (!teleport || typeof teleport !== "object" || Array.isArray(teleport)) {
      throw new Error("Teleport dispatch must be an object");
    }

    return validateTeleportDispatch(teleport as TeleportDispatch);
  });
}

function parseKickDispatches(value: unknown): KickDispatch[] {
  if (!Array.isArray(value)) {
    throw new Error("Kick drain response must be an array");
  }

  return value.map((kick) => {
    if (!kick || typeof kick !== "object" || Array.isArray(kick)) {
      throw new Error("Kick dispatch must be an object");
    }

    return validateKickDispatch(kick as KickDispatch);
  });
}

function parseQbPlayerDataSnapshots(value: unknown): FiveMQbPlayerDataSnapshot[] {
  if (!Array.isArray(value)) {
    throw new Error("QBCore PlayerData response must be an array");
  }

  return value.map((player) => {
    if (!player || typeof player !== "object" || Array.isArray(player)) {
      throw new Error("QBCore PlayerData snapshot must be an object");
    }

    return validateQbPlayerDataSnapshot(player as FiveMQbPlayerDataSnapshot);
  });
}

function parseGameplaySnapshot(value: unknown): AdminGameplaySnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Gameplay snapshot must be an object");
  }

  const snapshot = value as AdminGameplaySnapshot;
  if (!Array.isArray(snapshot.items)) {
    throw new Error("Gameplay snapshot items must be an array");
  }
  if (!Array.isArray(snapshot.jobs)) {
    throw new Error("Gameplay snapshot jobs must be an array");
  }
  if (!Array.isArray(snapshot.vehicles)) {
    throw new Error("Gameplay snapshot vehicles must be an array");
  }

  return {
    items: snapshot.items.map((item) => ({
      key: requireString(item.key, "item.key"),
      pluginId: requireString(item.pluginId, "item.pluginId"),
      label: requireString(item.label, "item.label"),
      stackable: requireBoolean(item.stackable, "item.stackable"),
      maxStack: requireNumber(item.maxStack, "item.maxStack")
    })),
    jobs: snapshot.jobs.map((job) => ({
      key: requireString(job.key, "job.key"),
      pluginId: requireString(job.pluginId, "job.pluginId"),
      label: requireString(job.label, "job.label"),
      gradesJson: requireString(job.gradesJson, "job.gradesJson")
    })),
    vehicles: snapshot.vehicles.map((vehicle) => ({
      model: requireString(vehicle.model, "vehicle.model"),
      pluginId: requireString(vehicle.pluginId, "vehicle.pluginId"),
      label: requireString(vehicle.label, "vehicle.label"),
      category: requireString(vehicle.category, "vehicle.category")
    })),
    locations: Array.isArray(snapshot.locations) ? [...snapshot.locations] : [],
    characters: Array.isArray(snapshot.characters) ? [...snapshot.characters] : [],
    inventory: Array.isArray(snapshot.inventory) ? [...snapshot.inventory] : [],
    characterJobs: Array.isArray(snapshot.characterJobs) ? [...snapshot.characterJobs] : []
  };
}

function parseQbCharacterUpdates(value: unknown): FiveMQbCharacterUpdatePayload[] {
  if (!Array.isArray(value)) {
    throw new Error("QBCore character update drain response must be an array");
  }

  return value.map((update) => {
    if (!update || typeof update !== "object" || Array.isArray(update)) {
      throw new Error("QBCore character update must be an object");
    }

    return validateQbCharacterUpdate(update as Record<string, unknown>);
  });
}

function parseQbCharacterSelections(value: unknown): FiveMQbCharacterSelectionPayload[] {
  if (!Array.isArray(value)) {
    throw new Error("QBCore character selection drain response must be an array");
  }

  return value.map((selection) => {
    if (!selection || typeof selection !== "object" || Array.isArray(selection)) {
      throw new Error("QBCore character selection must be an object");
    }

    return validateQbCharacterSelection(selection as Record<string, unknown>);
  });
}

function parseQbMoneyUpdates(value: unknown): FiveMQbMoneyUpdatePayload[] {
  if (!Array.isArray(value)) {
    throw new Error("QBCore money update drain response must be an array");
  }

  return value.map((update) => {
    if (!update || typeof update !== "object" || Array.isArray(update)) {
      throw new Error("QBCore money update must be an object");
    }

    return validateQbMoneyUpdate(update as Record<string, unknown>);
  });
}

function parseQbInventoryUpdates(value: unknown): FiveMQbInventoryUpdatePayload[] {
  if (!Array.isArray(value)) {
    throw new Error("QBCore inventory update drain response must be an array");
  }

  return value.map((update) => {
    if (!update || typeof update !== "object" || Array.isArray(update)) {
      throw new Error("QBCore inventory update must be an object");
    }

    return validateQbInventoryUpdate(update as Record<string, unknown>);
  });
}

function validateQbMoneyUpdate(update: Record<string, unknown>): FiveMQbMoneyUpdatePayload {
  return {
    transactionId: requireQbString(update.transactionId, "money update transactionId"),
    actorId: requireQbString(update.actorId, "money update actorId"),
    characterId: requireQbString(update.characterId, "money update characterId"),
    moneyType: requireQbString(update.moneyType, "money update moneyType"),
    operation: requireQbMoneyOperation(update.operation),
    amount: requireNumber(update.amount, "amount"),
    reason: requireQbString(update.reason, "money update reason"),
    idempotencyKey: requireQbString(update.idempotencyKey, "money update idempotencyKey")
  };
}

function validateQbCharacterSelection(selection: Record<string, unknown>): FiveMQbCharacterSelectionPayload {
  return {
    characterId: requireQbString(selection.characterId, "character selection characterId")
  };
}

function validateQbInventoryUpdate(update: Record<string, unknown>): FiveMQbInventoryUpdatePayload {
  return {
    id: requireQbString(update.id, "inventory update id"),
    characterId: requireQbString(update.characterId, "inventory update characterId"),
    itemKey: requireQbString(update.itemKey, "inventory update itemKey"),
    operation: requireQbInventoryOperation(update.operation),
    amount: requireNumber(update.amount, "amount")
  };
}

function requireQbMoneyOperation(value: unknown): "add" | "remove" | "set" {
  if (value === "add" || value === "remove" || value === "set") {
    return value;
  }

  throw new Error("QBCore money update operation must be add, remove, or set");
}

function requireQbInventoryOperation(value: unknown): "add" | "remove" {
  if (value === "add" || value === "remove") {
    return value;
  }

  throw new Error("QBCore inventory update operation must be add or remove");
}

function requireQbString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`QBCore ${field} must be a non-empty string`);
  }

  return value.trim();
}

function validateQbCharacterUpdate(update: Record<string, unknown>): FiveMQbCharacterUpdatePayload {
  return {
    characterId: requireQbString(update.characterId, "character update characterId"),
    playerPrincipalId: requireQbString(update.playerPrincipalId, "character update playerPrincipalId"),
    citizenId: requireQbString(update.citizenId, "character update citizenId"),
    cid: requireNumber(update.cid, "cid"),
    slot: requireNumber(update.slot, "slot"),
    license: requireQbString(update.license, "character update license"),
    name: requireQbString(update.name, "character update name"),
    charinfoJson: requireQbString(update.charinfoJson, "character update charinfoJson"),
    metadataJson: requireQbString(update.metadataJson, "character update metadataJson"),
    gangJson: update.gangJson === undefined ? undefined : requireQbString(update.gangJson, "character update gangJson"),
    positionJson: requireQbString(update.positionJson, "character update positionJson"),
    phoneNumber: requireQbString(update.phoneNumber, "character update phoneNumber"),
    accountNumber: requireQbString(update.accountNumber, "character update accountNumber"),
    selected: update.selected === true
  };
}

function parseAppliedCount(value: unknown): number {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("QBCore character update response must be an object");
  }

  return requireNumber((value as Record<string, unknown>).applied, "applied");
}

function parseDeploymentSnapshot(value: unknown): AdminDeploymentSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Deployment snapshot response must be an object");
  }

  const candidate = value as Record<string, unknown>;
  return {
    bundles: Array.isArray(candidate.bundles) ? candidate.bundles as AdminDeploymentSnapshot["bundles"] : [],
    capabilities: Array.isArray(candidate.capabilities) ? candidate.capabilities as AdminDeploymentSnapshot["capabilities"] : [],
    deployments: Array.isArray(candidate.deployments)
      ? candidate.deployments.map(parseDeploymentRecord)
      : [],
    sandboxEvents: Array.isArray(candidate.sandboxEvents)
      ? candidate.sandboxEvents.map(parseSandboxEventRecord)
      : []
  };
}

function parseDeploymentRecord(value: unknown): AdminDeploymentSnapshot["deployments"][number] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Deployment record must be an object");
  }

  const candidate = value as Record<string, unknown>;
  return {
    id: requireString(candidate.id, "deployment.id"),
    pluginId: requireString(candidate.pluginId, "deployment.pluginId"),
    bundleId: requireString(candidate.bundleId, "deployment.bundleId"),
    serverId: requireString(candidate.serverId, "deployment.serverId"),
    status: requireString(candidate.status, "deployment.status") as AdminDeploymentSnapshot["deployments"][number]["status"],
    desiredVersion: requireString(candidate.desiredVersion, "deployment.desiredVersion"),
    activeVersion: typeof candidate.activeVersion === "string" && candidate.activeVersion.length > 0
      ? candidate.activeVersion
      : undefined,
    errorMessage: typeof candidate.errorMessage === "string" && candidate.errorMessage.length > 0
      ? candidate.errorMessage
      : undefined
  };
}

function parseSandboxEventRecord(value: unknown): AdminDeploymentSnapshot["sandboxEvents"][number] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Sandbox event record must be an object");
  }

  const candidate = value as Record<string, unknown>;
  return {
    id: requireString(candidate.id, "sandboxEvent.id"),
    pluginId: requireString(candidate.pluginId, "sandboxEvent.pluginId"),
    serverId: requireString(candidate.serverId, "sandboxEvent.serverId"),
    eventType: requireString(candidate.eventType, "sandboxEvent.eventType"),
    payloadHash: requireString(candidate.payloadHash, "sandboxEvent.payloadHash"),
    status: requireString(candidate.status, "sandboxEvent.status"),
    createdAt: candidate.createdAt === undefined
      ? new Date(0)
      : parseDate(candidate.createdAt, "sandboxEvent.createdAt")
  };
}

function parsePermissionSnapshot(value: unknown): PermissionSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Permission snapshot response must be an object");
  }

  const candidate = value as Record<string, unknown>;
  return {
    permissions: Array.isArray(candidate.permissions) ? candidate.permissions as PermissionSnapshot["permissions"] : [],
    principals: Array.isArray(candidate.principals) ? candidate.principals as PermissionSnapshot["principals"] : [],
    edges: parsePrincipalEdges(candidate.edges),
    grants: parsePermissionGrants(candidate.grants),
    policies: Array.isArray(candidate.policies) ? candidate.policies as PermissionSnapshot["policies"] : [],
    aceMirrorRules: parseAceMirrorRules(candidate.aceMirrorRules)
  };
}

function parseDashboardConfig(value: unknown): RuntimeConfigRecord[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Runtime dashboard response must be an object");
  }

  const candidate = value as Record<string, unknown>;
  if (!Array.isArray(candidate.config)) {
    return [];
  }

  return candidate.config.map(parseConfigRecord);
}

function parseDashboardHealth(value: unknown): RuntimeHealthRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Runtime dashboard response must be an object");
  }

  const candidate = value as Record<string, unknown>;
  return parseHealthRecord(candidate.health);
}

function parseMenuRegistry(value: unknown): AdminMenuRegistrySnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Menu registry response must be an object");
  }

  const candidate = value as Record<string, unknown>;
  return {
    definitions: Array.isArray(candidate.definitions) ? candidate.definitions as AdminMenuRegistrySnapshot["definitions"] : [],
    actions: Array.isArray(candidate.actions) ? candidate.actions as AdminMenuRegistrySnapshot["actions"] : [],
    commands: Array.isArray(candidate.commands) ? candidate.commands as AdminMenuRegistrySnapshot["commands"] : [],
    panels: Array.isArray(candidate.panels) ? candidate.panels as AdminMenuRegistrySnapshot["panels"] : [],
    policies: Array.isArray(candidate.policies) ? candidate.policies as AdminMenuRegistrySnapshot["policies"] : [],
    sessions: Array.isArray(candidate.sessions) ? candidate.sessions as AdminMenuRegistrySnapshot["sessions"] : []
  };
}

function parseHealthRecord(value: unknown): RuntimeHealthRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Runtime dashboard health must be an object");
  }

  const candidate = value as Record<string, unknown>;
  const status = requireString(candidate.status, "status");
  if (status !== "online" && status !== "degraded" && status !== "offline") {
    throw new Error("Runtime dashboard health status must be online, degraded, or offline");
  }

  const health: RuntimeHealthRecord = {
    serverId: requireString(candidate.serverId, "serverId"),
    serverName: requireString(candidate.serverName, "serverName"),
    environment: requireString(candidate.environment, "environment"),
    status,
    reason: requireString(candidate.reason, "reason"),
    lastHeartbeatAt: parseDate(candidate.lastHeartbeatAt, "lastHeartbeatAt")
  };
  if (typeof candidate.resourceVersion === "string" && candidate.resourceVersion.length > 0) {
    health.resourceVersion = candidate.resourceVersion;
  }
  if (typeof candidate.fxserverBuild === "string" && candidate.fxserverBuild.length > 0) {
    health.fxserverBuild = candidate.fxserverBuild;
  }
  if (typeof candidate.gameBuild === "string" && candidate.gameBuild.length > 0) {
    health.gameBuild = candidate.gameBuild;
  }
  if (candidate.lastSeenAt !== undefined) {
    health.lastSeenAt = parseDate(candidate.lastSeenAt, "lastSeenAt");
  }

  return health;
}

function parseConfigRecord(value: unknown): RuntimeConfigRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Runtime config record must be an object");
  }

  const candidate = value as Record<string, unknown>;
  return {
    id: requireString(candidate.id, "id"),
    serverId: requireString(candidate.serverId, "serverId"),
    namespace: requireString(candidate.namespace, "namespace"),
    key: requireString(candidate.key, "key"),
    value: candidate.value,
    version: requireNumber(candidate.version, "version"),
    updatedAt: parseDate(candidate.updatedAt, "updatedAt")
  };
}

function toAceMirrorDesiredState(snapshot: PermissionSnapshot): AceMirrorDesiredState {
  return {
    edges: snapshot.edges,
    grants: snapshot.grants,
    rules: snapshot.aceMirrorRules
  };
}

function parsePrincipalEdges(value: unknown): PrincipalEdge[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((edge) => {
    if (!edge || typeof edge !== "object" || Array.isArray(edge)) {
      throw new Error("Permission snapshot edge must be an object");
    }

    const candidate = edge as Record<string, unknown>;
    const parsed: PrincipalEdge = {
      parentPrincipalId: requireString(candidate.parentPrincipalId, "parentPrincipalId"),
      childPrincipalId: requireString(candidate.childPrincipalId, "childPrincipalId"),
      source: requireString(candidate.source, "source")
    };
    if (candidate.expiresAt instanceof Date) {
      parsed.expiresAt = candidate.expiresAt;
    }
    return parsed;
  });
}

function parsePermissionGrants(value: unknown): PermissionGrant[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((grant) => {
    if (!grant || typeof grant !== "object" || Array.isArray(grant)) {
      throw new Error("Permission snapshot grant must be an object");
    }

    const candidate = grant as Record<string, unknown>;
    const effect = requireString(candidate.effect, "effect");
    if (effect !== "allow" && effect !== "deny") {
      throw new Error("Permission snapshot grant effect must be allow or deny");
    }

    const parsed: PermissionGrant = {
      principalId: requireString(candidate.principalId, "principalId"),
      permissionKey: requireString(candidate.permissionKey, "permissionKey"),
      effect: effect as PermissionEffect,
      source: requireString(candidate.source, "source")
    };
    if (candidate.expiresAt instanceof Date) {
      parsed.expiresAt = candidate.expiresAt;
    }
    return parsed;
  });
}

function parseAceMirrorRules(value: unknown): AceMirrorRule[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((rule) => {
    if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
      throw new Error("Permission snapshot ACE mirror rule must be an object");
    }

    const candidate = rule as Record<string, unknown>;
    const mode = requireString(candidate.mode, "mode");
    if (mode !== "allow_only" && mode !== "allow_and_deny") {
      throw new Error("Permission snapshot ACE mirror rule mode must be allow_only or allow_and_deny");
    }

    return {
      id: typeof candidate.id === "string" ? candidate.id : undefined,
      permissionKey: requireString(candidate.permissionKey, "permissionKey"),
      aceObject: requireString(candidate.aceObject, "aceObject"),
      enabled: requireBoolean(candidate.enabled, "enabled"),
      mode
    };
  });
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Menu refresh target ${field} must be a non-empty string`);
  }

  return value;
}

function requireNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Menu refresh target ${field} must be a finite number`);
  }

  return value;
}

function requireBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`Menu refresh target ${field} must be a boolean`);
  }

  return value;
}

function requireRecord(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`QBCore PlayerData ${field} must be an object`);
  }

  return { ...(value as Record<string, unknown>) };
}

function requireNumberRecord(value: unknown, field: string): Record<string, number> {
  const record = requireRecord(value, field);
  for (const [key, amount] of Object.entries(record)) {
    if (typeof amount !== "number" || !Number.isFinite(amount)) {
      throw new Error(`QBCore PlayerData ${field}.${key} must be a finite number`);
    }
  }

  return record as Record<string, number>;
}

function parseDate(value: unknown, field: string): Date {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "string") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  throw new Error(`Runtime config record ${field} must be a Date or ISO date string`);
}

function compareMenuRefreshTargets(left: MenuRefreshTarget, right: MenuRefreshTarget): number {
  return left.serverId.localeCompare(right.serverId) ||
    left.playerId.localeCompare(right.playerId) ||
    left.sessionId.localeCompare(right.sessionId);
}

function validateReplicatedStateUpdate(update: ReplicatedStateUpdate): ReplicatedStateUpdate {
  if (typeof update.serverId !== "string" || update.serverId.length === 0) {
    throw new Error("Replicated state update serverId must be a non-empty string");
  }
  if (typeof update.key !== "string" || update.key.length === 0) {
    throw new Error("Replicated state update key must be a non-empty string");
  }
  if (update.authoritative === true) {
    throw new Error("authoritative state cannot be replicated");
  }
  if (
    update.playerId !== undefined &&
    (typeof update.playerId !== "string" || update.playerId.length === 0) &&
    (typeof update.playerId !== "number" || !Number.isFinite(update.playerId))
  ) {
    throw new Error("Replicated state update playerId must be a non-empty string or finite number");
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

function validateVehicleSpawnDispatch(spawn: VehicleSpawnDispatch): VehicleSpawnDispatch {
  if (typeof spawn.serverId !== "string" || spawn.serverId.length === 0) {
    throw new Error("Vehicle spawn serverId must be a non-empty string");
  }
  if (
    (typeof spawn.targetSource !== "string" || spawn.targetSource.length === 0) &&
    (typeof spawn.targetSource !== "number" || !Number.isFinite(spawn.targetSource))
  ) {
    throw new Error("Vehicle spawn targetSource must be a non-empty string or finite number");
  }
  if (typeof spawn.model !== "string" || spawn.model.length === 0) {
    throw new Error("Vehicle spawn model must be a non-empty string");
  }
  if (typeof spawn.label !== "string" || spawn.label.length === 0) {
    throw new Error("Vehicle spawn label must be a non-empty string");
  }
  if (typeof spawn.category !== "string" || spawn.category.length === 0) {
    throw new Error("Vehicle spawn category must be a non-empty string");
  }
  if (spawn.heading !== undefined && (typeof spawn.heading !== "number" || !Number.isFinite(spawn.heading))) {
    throw new Error("Vehicle spawn heading must be a finite number");
  }
  if (spawn.warpIntoVehicle !== undefined && typeof spawn.warpIntoVehicle !== "boolean") {
    throw new Error("Vehicle spawn warpIntoVehicle must be a boolean");
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
    throw new Error("Vehicle spawn location must be an object");
  }
  if (typeof location.key !== "string" || location.key.length === 0) {
    throw new Error("Vehicle spawn location key must be a non-empty string");
  }
  if (typeof location.label !== "string" || location.label.length === 0) {
    throw new Error("Vehicle spawn location label must be a non-empty string");
  }
  if (typeof location.x !== "number" || !Number.isFinite(location.x)) {
    throw new Error("Vehicle spawn location x must be a finite number");
  }
  if (typeof location.y !== "number" || !Number.isFinite(location.y)) {
    throw new Error("Vehicle spawn location y must be a finite number");
  }
  if (typeof location.z !== "number" || !Number.isFinite(location.z)) {
    throw new Error("Vehicle spawn location z must be a finite number");
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

function validateVehicleRepairDispatch(repair: VehicleRepairDispatch): VehicleRepairDispatch {
  if (typeof repair.serverId !== "string" || repair.serverId.length === 0) {
    throw new Error("Vehicle repair serverId must be a non-empty string");
  }
  if (
    (typeof repair.targetSource !== "string" || repair.targetSource.length === 0) &&
    (typeof repair.targetSource !== "number" || !Number.isFinite(repair.targetSource))
  ) {
    throw new Error("Vehicle repair targetSource must be a non-empty string or finite number");
  }
  if (typeof repair.targetVehicleNetId !== "number" || !Number.isFinite(repair.targetVehicleNetId)) {
    throw new Error("Vehicle repair targetVehicleNetId must be a finite number");
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

function validateWorldStateUpdate(update: WorldStateUpdate): WorldStateUpdate {
  if (typeof update.serverId !== "string" || update.serverId.length === 0) {
    throw new Error("World state serverId must be a non-empty string");
  }
  if (!update.world || typeof update.world !== "object" || Array.isArray(update.world)) {
    throw new Error("World state world must be an object");
  }

  const world: WorldStateUpdate["world"] = {};
  if (update.world.weatherType !== undefined) {
    if (typeof update.world.weatherType !== "string" || update.world.weatherType.length === 0) {
      throw new Error("World state weatherType must be a non-empty string");
    }
    world.weatherType = update.world.weatherType;
  }
  if (update.world.hour !== undefined) {
    if (!Number.isSafeInteger(update.world.hour) || update.world.hour < 0 || update.world.hour > 23) {
      throw new Error("World state hour must be an integer between 0 and 23");
    }
    world.hour = update.world.hour;
  }
  if (update.world.minute !== undefined) {
    if (!Number.isSafeInteger(update.world.minute) || update.world.minute < 0 || update.world.minute > 59) {
      throw new Error("World state minute must be an integer between 0 and 59");
    }
    world.minute = update.world.minute;
  }
  if (Object.keys(world).length === 0) {
    throw new Error("World state update must include weatherType, hour, or minute");
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
  if (typeof teleport.serverId !== "string" || teleport.serverId.length === 0) {
    throw new Error("Teleport serverId must be a non-empty string");
  }
  if (
    (typeof teleport.targetSource !== "string" || teleport.targetSource.length === 0) &&
    (typeof teleport.targetSource !== "number" || !Number.isFinite(teleport.targetSource))
  ) {
    throw new Error("Teleport targetSource must be a non-empty string or finite number");
  }
  if (typeof teleport.x !== "number" || !Number.isFinite(teleport.x)) {
    throw new Error("Teleport x must be a finite number");
  }
  if (typeof teleport.y !== "number" || !Number.isFinite(teleport.y)) {
    throw new Error("Teleport y must be a finite number");
  }
  if (typeof teleport.z !== "number" || !Number.isFinite(teleport.z)) {
    throw new Error("Teleport z must be a finite number");
  }
  if (teleport.heading !== undefined && (typeof teleport.heading !== "number" || !Number.isFinite(teleport.heading))) {
    throw new Error("Teleport heading must be a finite number");
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

function validateKickDispatch(kick: KickDispatch): KickDispatch {
  if (typeof kick.serverId !== "string" || kick.serverId.length === 0) {
    throw new Error("Kick serverId must be a non-empty string");
  }
  if (
    (typeof kick.targetSource !== "string" || kick.targetSource.length === 0) &&
    (typeof kick.targetSource !== "number" || !Number.isFinite(kick.targetSource))
  ) {
    throw new Error("Kick targetSource must be a non-empty string or finite number");
  }
  if (typeof kick.reason !== "string" || kick.reason.length === 0) {
    throw new Error("Kick reason must be a non-empty string");
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

function validateQbPlayerDataSnapshot(player: FiveMQbPlayerDataSnapshot): FiveMQbPlayerDataSnapshot {
  if (typeof player.serverId !== "string" || player.serverId.length === 0) {
    throw new Error("QBCore PlayerData serverId must be a non-empty string");
  }
  if (
    (typeof player.source !== "string" || player.source.length === 0) &&
    (typeof player.source !== "number" || !Number.isFinite(player.source))
  ) {
    throw new Error("QBCore PlayerData source must be a non-empty string or finite number");
  }

  const validated: FiveMQbPlayerDataSnapshot = {
    serverId: player.serverId,
    source: player.source,
    citizenid: requireString(player.citizenid, "citizenid"),
    cid: requireNumber(player.cid, "cid"),
    license: requireString(player.license, "license"),
    name: requireString(player.name, "name"),
    charinfo: player.charinfo === undefined ? {} : requireRecord(player.charinfo, "charinfo"),
    money: player.money === undefined ? {} : requireNumberRecord(player.money, "money"),
    job: player.job === undefined ? {} : requireRecord(player.job, "job"),
    gang: player.gang === undefined ? {} : requireRecord(player.gang, "gang"),
    metadata: player.metadata === undefined ? {} : requireRecord(player.metadata, "metadata"),
    items: Array.isArray(player.items) ? [...player.items] : []
  };
  if (player.characterId !== undefined) {
    validated.characterId = requireString(player.characterId, "characterId");
  }
  if (player.position !== undefined) {
    validated.position = requireRecord(player.position, "position");
  }
  return validated;
}

function stripQbPlayerServerId(player: FiveMQbPlayerDataSnapshot): FiveMQbPlayerDataPayload {
  const payload: FiveMQbPlayerDataPayload = {
    source: player.source,
    citizenid: player.citizenid,
    cid: player.cid,
    license: player.license,
    name: player.name,
    charinfo: player.charinfo ?? {},
    money: player.money ?? {},
    job: player.job ?? {},
    gang: player.gang ?? {},
    metadata: player.metadata ?? {},
    items: player.items ?? []
  };
  if (player.characterId !== undefined) {
    payload.characterId = player.characterId;
  }
  if (player.position !== undefined) {
    payload.position = player.position;
  }
  return payload;
}

function qbcGradesFromJson(gradesJson: string): Record<string, Record<string, unknown>> {
  let grades: unknown;
  try {
    grades = JSON.parse(gradesJson);
  } catch {
    grades = [];
  }

  if (!Array.isArray(grades)) {
    return {};
  }

  return Object.fromEntries(grades.map((grade, index) => {
    const name = typeof grade === "string"
      ? grade
      : grade && typeof grade === "object" && "name" in grade && typeof grade.name === "string"
        ? grade.name
        : String(index);
    const payment = grade && typeof grade === "object" && "payment" in grade && typeof grade.payment === "number"
      ? grade.payment
      : 0;
    const isboss = grade && typeof grade === "object" && "isboss" in grade && grade.isboss === true;
    return [String(index), {
      name,
      level: index,
      payment,
      isboss
    }];
  }));
}

function compareQbPlayerDataSnapshots(left: FiveMQbPlayerDataSnapshot, right: FiveMQbPlayerDataSnapshot): number {
  return left.serverId.localeCompare(right.serverId) ||
    String(left.source).localeCompare(String(right.source));
}

function compareDeploymentPayloads(
  left: AdminDeploymentSnapshot["deployments"][number],
  right: AdminDeploymentSnapshot["deployments"][number]
): number {
  return left.pluginId.localeCompare(right.pluginId) ||
    left.serverId.localeCompare(right.serverId) ||
    left.id.localeCompare(right.id);
}

function compareSandboxEventPayloads(
  left: AdminDeploymentSnapshot["sandboxEvents"][number],
  right: AdminDeploymentSnapshot["sandboxEvents"][number]
): number {
  return left.createdAt.getTime() - right.createdAt.getTime() ||
    left.pluginId.localeCompare(right.pluginId) ||
    left.id.localeCompare(right.id);
}

function compareConfigRecords(left: RuntimeConfigRecord, right: RuntimeConfigRecord): number {
  return left.namespace.localeCompare(right.namespace) ||
    left.key.localeCompare(right.key);
}

function configVersionKey(record: RuntimeConfigRecord): string {
  return `${record.serverId}:${record.namespace}:${record.key}`;
}

function collectNativePrincipalIds(snapshot: PermissionSnapshot): Set<string> {
  const principalIds = new Set<string>();
  for (const principal of snapshot.principals) {
    principalIds.add(principal.id);
  }
  for (const edge of snapshot.edges) {
    principalIds.add(edge.parentPrincipalId);
    principalIds.add(edge.childPrincipalId);
  }
  for (const grant of snapshot.grants) {
    principalIds.add(grant.principalId);
  }
  return principalIds;
}

function collectPermissionKeys(permissions: PermissionDefinition[], grants: PermissionGrant[]): string[] {
  return [...new Set([
    ...permissions.map((permission) => permission.key),
    ...grants.map((grant) => grant.permissionKey)
  ])].sort();
}

function stableJson(value: object): string {
  const source = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(source).sort()) {
    sorted[key] = source[key];
  }
  return JSON.stringify(sorted);
}

function stableJsonArray(value: unknown[]): string {
  return JSON.stringify(value);
}

function optionalString(value: string): string | undefined {
  return value.length > 0 ? value : undefined;
}

function parseJsonOrUndefined(value: string): unknown {
  if (value.length === 0) {
    return undefined;
  }

  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function toMenuDefinition(row: AdminMenuRegistrySnapshot["definitions"][number]): MenuDefinition {
  return {
    id: row.id,
    pluginId: row.pluginId,
    label: row.label,
    parentId: optionalString(row.parentId),
    icon: optionalString(row.icon),
    order: row.order,
    requiredPermission: optionalString(row.requiredPermission),
    actionId: optionalString(row.actionId),
    enabled: row.enabled,
    visibilityPolicyId: optionalString(row.visibilityPolicyId)
  };
}

function toMenuAction(row: AdminMenuRegistrySnapshot["actions"][number]): MenuAction {
  return {
    id: row.id,
    pluginId: row.pluginId,
    actionType: row.actionType as MenuAction["actionType"],
    reducerName: optionalString(row.reducerName),
    payloadSchema: parseJsonOrUndefined(row.payloadSchemaJson),
    confirmationRequired: row.confirmationRequired,
    auditLevel: row.auditLevel as MenuAction["auditLevel"],
    requiredPermission: optionalString(row.requiredPermission),
    enabled: row.enabled
  };
}

function toMenuVisibilityPolicy(row: AdminMenuRegistrySnapshot["policies"][number]): MenuVisibilityPolicy {
  return {
    id: row.id,
    pluginId: row.pluginId,
    policyJson: row.policyJson,
    enabled: row.enabled
  };
}
