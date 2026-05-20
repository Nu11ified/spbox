import { createHmac, timingSafeEqual } from "node:crypto";
import { createActionEnvelope, InMemoryActionBus, type RuntimeActionEnvelope } from "./actions.js";
import { type AuditLogEntry, type AuditStatus } from "./audit.js";

export type ServerStatus = "online" | "offline";
export type RuntimeInstanceStatus = "online" | "degraded" | "offline";
export type RuntimeHealthStatus = "online" | "degraded" | "offline";

export interface ServerRecord {
  id: string;
  name: string;
  environment: string;
  publicKey: string;
  status: ServerStatus;
  lastHeartbeatAt: Date;
}

export interface RuntimeInstanceRecord {
  id: string;
  serverId: string;
  resourceVersion: string;
  fxserverBuild: string;
  gameBuild: string;
  status: RuntimeInstanceStatus;
  startedAt: Date;
  lastSeenAt: Date;
}

export interface RuntimeConfigRecord {
  id: string;
  serverId: string;
  namespace: string;
  key: string;
  value: unknown;
  version: number;
  updatedAt: Date;
}

export interface RuntimeConfigAckRecord {
  serverId: string;
  namespace: string;
  key: string;
  version: number;
  acknowledgedAt: Date;
}

export interface RuntimeHealthRecord {
  serverId: string;
  serverName: string;
  environment: string;
  status: RuntimeHealthStatus;
  reason: string;
  resourceVersion?: string;
  fxserverBuild?: string;
  gameBuild?: string;
  lastHeartbeatAt: Date;
  lastSeenAt?: Date;
}

export interface RegisterServerInput {
  id: string;
  name: string;
  environment: string;
  publicKey: string;
}

export interface HeartbeatInput {
  serverId: string;
  resourceVersion: string;
  fxserverBuild: string;
  gameBuild: string;
  nonce?: string;
  signature?: string;
}

export type HeartbeatSigningInput = Omit<HeartbeatInput, "signature">;

export interface SetRuntimeConfigInput {
  serverId: string;
  namespace: string;
  key: string;
  value: unknown;
}

export interface AckConfigVersionInput {
  serverId: string;
  namespace: string;
  key: string;
  version: number;
}

export interface SubmitActionInput {
  serverId: string;
  actorId: string;
  actionType: string;
  payload: unknown;
  nonce: string;
  idempotencyKey: string;
  signature?: string;
}

export interface CompleteActionInput {
  actionId: string;
  status: "completed" | "failed";
  pluginId?: string;
  permissionKey?: string;
  targetType?: string;
  targetId?: string;
  before?: unknown;
  after?: unknown;
}

export interface WriteAuditLogInput {
  serverId: string;
  actorId: string;
  pluginId?: string;
  actionType: string;
  permissionKey?: string;
  targetType?: string;
  targetId?: string;
  before?: unknown;
  after?: unknown;
  status: AuditLogEntry["status"];
}

export interface RuntimeControlPlaneOptions {
  now?: () => Date;
  idFactory?: () => string;
  actionSignatureVerifier?: (envelope: RuntimeActionEnvelope) => boolean;
  heartbeatSignatureVerifier?: (server: ServerRecord, heartbeat: HeartbeatInput) => boolean;
}

export function signHeartbeat(heartbeat: HeartbeatSigningInput, secret: string): string {
  return createHmac("sha256", secret).update(heartbeatSigningPayload(heartbeat)).digest("hex");
}

export function verifyHeartbeatSignature(
  server: ServerRecord,
  heartbeat: HeartbeatInput,
  secret: string
): boolean {
  if (!heartbeat.signature || !heartbeat.nonce) {
    return false;
  }

  const expected = signHeartbeat(heartbeat, secret);
  const actual = Buffer.from(heartbeat.signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return server.id === heartbeat.serverId &&
    actual.length === expectedBuffer.length &&
    timingSafeEqual(actual, expectedBuffer);
}

export class RuntimeControlPlane {
  private readonly serversById = new Map<string, ServerRecord>();
  private readonly instancesByServerId = new Map<string, RuntimeInstanceRecord>();
  private readonly configByKey = new Map<string, RuntimeConfigRecord>();
  private readonly configAcksByKey = new Map<string, RuntimeConfigAckRecord>();
  private readonly actions: InMemoryActionBus;
  private readonly auditLogs: AuditLogEntry[] = [];
  private readonly heartbeatNoncesByServerId = new Map<string, Set<string>>();
  private readonly now: () => Date;
  private readonly idFactory: () => string;
  private readonly heartbeatSignatureVerifier?: (server: ServerRecord, heartbeat: HeartbeatInput) => boolean;

  public constructor(options: RuntimeControlPlaneOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.idFactory = options.idFactory ?? (() => crypto.randomUUID());
    this.heartbeatSignatureVerifier = options.heartbeatSignatureVerifier;
    this.actions = new InMemoryActionBus({
      verifySignature: options.actionSignatureVerifier
    });
  }

  public registerServer(input: RegisterServerInput): ServerRecord {
    const timestamp = this.now();
    const existing = this.serversById.get(input.id);
    const server: ServerRecord = {
      id: input.id,
      name: input.name,
      environment: input.environment,
      publicKey: input.publicKey,
      status: "online",
      lastHeartbeatAt: timestamp
    };

    this.serversById.set(input.id, {
      ...existing,
      ...server
    });

    return { ...server };
  }

  public heartbeat(input: HeartbeatInput): RuntimeInstanceRecord {
    const server = this.requireServer(input.serverId);
    this.verifyHeartbeat(server, input);

    const timestamp = this.now();
    const existing = this.instancesByServerId.get(input.serverId);
    const instance: RuntimeInstanceRecord = {
      id: existing?.id ?? this.idFactory(),
      serverId: input.serverId,
      resourceVersion: input.resourceVersion,
      fxserverBuild: input.fxserverBuild,
      gameBuild: input.gameBuild,
      status: "online",
      startedAt: existing?.startedAt ?? timestamp,
      lastSeenAt: timestamp
    };

    this.instancesByServerId.set(input.serverId, instance);
    this.serversById.set(input.serverId, {
      ...server,
      status: "online",
      lastHeartbeatAt: timestamp
    });

    return { ...instance };
  }

  private verifyHeartbeat(server: ServerRecord, input: HeartbeatInput): void {
    if (!this.heartbeatSignatureVerifier) {
      return;
    }

    if (!input.nonce || !input.signature) {
      throw new Error("Signed heartbeat requires nonce and signature");
    }

    const usedNonces = this.heartbeatNoncesByServerId.get(server.id) ?? new Set<string>();
    if (usedNonces.has(input.nonce)) {
      throw new Error("Heartbeat nonce replay");
    }

    if (!this.heartbeatSignatureVerifier(server, input)) {
      throw new Error("Invalid heartbeat signature");
    }

    usedNonces.add(input.nonce);
    this.heartbeatNoncesByServerId.set(server.id, usedNonces);
  }

  public setRuntimeConfig(input: SetRuntimeConfigInput): RuntimeConfigRecord {
    this.requireServer(input.serverId);

    const key = this.configKey(input.serverId, input.namespace, input.key);
    const existing = this.configByKey.get(key);
    const record: RuntimeConfigRecord = {
      id: existing?.id ?? this.idFactory(),
      serverId: input.serverId,
      namespace: input.namespace,
      key: input.key,
      value: structuredClone(input.value),
      version: (existing?.version ?? 0) + 1,
      updatedAt: this.now()
    };

    this.configByKey.set(key, record);
    return this.cloneConfig(record);
  }

  public getRuntimeConfig(
    serverId: string,
    namespace: string,
    key: string
  ): RuntimeConfigRecord | undefined {
    const record = this.configByKey.get(this.configKey(serverId, namespace, key));
    return record ? this.cloneConfig(record) : undefined;
  }

  public getConfigSnapshot(serverId: string): RuntimeConfigRecord[] {
    return [...this.configByKey.values()]
      .filter((record) => record.serverId === serverId)
      .sort((a, b) => a.namespace.localeCompare(b.namespace) || a.key.localeCompare(b.key))
      .map((record) => this.cloneConfig(record));
  }

  public getHealth(serverId: string, heartbeatTimeoutMs = 30_000): RuntimeHealthRecord {
    const server = this.requireServer(serverId);
    const instance = this.instancesByServerId.get(serverId);
    const now = this.now();
    const heartbeatAgeMs = now.getTime() - server.lastHeartbeatAt.getTime();

    if (!instance) {
      return {
        serverId: server.id,
        serverName: server.name,
        environment: server.environment,
        status: "degraded",
        reason: "no runtime heartbeat",
        lastHeartbeatAt: new Date(server.lastHeartbeatAt.getTime())
      };
    }

    const health: RuntimeHealthRecord = {
      serverId: server.id,
      serverName: server.name,
      environment: server.environment,
      status: instance.status,
      reason: "runtime heartbeat current",
      resourceVersion: instance.resourceVersion,
      fxserverBuild: instance.fxserverBuild,
      gameBuild: instance.gameBuild,
      lastHeartbeatAt: new Date(server.lastHeartbeatAt.getTime()),
      lastSeenAt: new Date(instance.lastSeenAt.getTime())
    };

    if (server.status === "offline" || instance.status === "offline") {
      return {
        ...health,
        status: "offline",
        reason: "runtime marked offline"
      };
    }
    if (heartbeatAgeMs > heartbeatTimeoutMs) {
      return {
        ...health,
        status: "offline",
        reason: "runtime heartbeat stale"
      };
    }
    if (instance.status === "degraded") {
      return {
        ...health,
        status: "degraded",
        reason: "runtime marked degraded"
      };
    }

    return health;
  }

  public ackConfigVersion(input: AckConfigVersionInput): RuntimeConfigAckRecord {
    this.requireServer(input.serverId);

    const configKey = this.configKey(input.serverId, input.namespace, input.key);
    const config = this.configByKey.get(configKey);
    if (!config) {
      throw new Error(`Unknown config: ${configKey}`);
    }
    if (config.version !== input.version) {
      throw new Error(
        `Cannot acknowledge config version ${input.version}; current version is ${config.version}`
      );
    }

    const ack: RuntimeConfigAckRecord = {
      serverId: input.serverId,
      namespace: input.namespace,
      key: input.key,
      version: input.version,
      acknowledgedAt: this.now()
    };
    this.configAcksByKey.set(configKey, ack);
    return this.cloneConfigAck(ack);
  }

  public getConfigAck(
    serverId: string,
    namespace: string,
    key: string
  ): RuntimeConfigAckRecord | undefined {
    const record = this.configAcksByKey.get(this.configKey(serverId, namespace, key));
    return record ? this.cloneConfigAck(record) : undefined;
  }

  public submitAction(input: SubmitActionInput): RuntimeActionEnvelope {
    this.requireServer(input.serverId);

    return this.actions.submit(
      createActionEnvelope({
        id: this.idFactory(),
        serverId: input.serverId,
        actorId: input.actorId,
        actionType: input.actionType,
        payload: input.payload,
        nonce: input.nonce,
        idempotencyKey: input.idempotencyKey,
        signature: input.signature,
        createdAt: this.now()
      })
    );
  }

  public getAction(actionId: string): RuntimeActionEnvelope | undefined {
    const action = this.actions.getById(actionId);
    return action ? { ...action } : undefined;
  }

  public completeAction(input: CompleteActionInput): RuntimeActionEnvelope {
    const action = this.actions.getById(input.actionId);
    if (!action) {
      throw new Error(`Unknown action: ${input.actionId}`);
    }

    const completedAt = this.now();
    const completed = this.actions.complete(action.id, input.status, completedAt);

    this.auditLogs.push({
      id: this.idFactory(),
      serverId: action.serverId,
      actorId: action.actorId,
      pluginId: input.pluginId,
      actionType: action.actionType,
      permissionKey: input.permissionKey,
      targetType: input.targetType,
      targetId: input.targetId,
      before: structuredClone(input.before),
      after: structuredClone(input.after),
      status: input.status === "completed" ? "succeeded" : "failed",
      createdAt: completedAt
    });

    return completed;
  }

  public writeAuditLog(input: WriteAuditLogInput): AuditLogEntry {
    this.requireServer(input.serverId);
    validateAuditStatus(input.status);

    const entry: AuditLogEntry = {
      id: this.idFactory(),
      serverId: input.serverId,
      actorId: input.actorId,
      pluginId: input.pluginId,
      actionType: input.actionType,
      permissionKey: input.permissionKey,
      targetType: input.targetType,
      targetId: input.targetId,
      before: structuredClone(input.before),
      after: structuredClone(input.after),
      status: input.status,
      createdAt: this.now()
    };
    this.auditLogs.push(entry);
    return {
      ...entry,
      before: structuredClone(entry.before),
      after: structuredClone(entry.after)
    };
  }

  public getAuditLogs(serverId: string): AuditLogEntry[] {
    return this.auditLogs
      .filter((entry) => entry.serverId === serverId)
      .map((entry) => ({
        ...entry,
        before: structuredClone(entry.before),
        after: structuredClone(entry.after)
      }));
  }

  private requireServer(serverId: string): ServerRecord {
    const server = this.serversById.get(serverId);
    if (!server) {
      throw new Error(`Unknown server: ${serverId}`);
    }

    return server;
  }

  private configKey(serverId: string, namespace: string, key: string): string {
    return `${serverId}:${namespace}:${key}`;
  }

  private cloneConfig(record: RuntimeConfigRecord): RuntimeConfigRecord {
    return {
      ...record,
      value: structuredClone(record.value)
    };
  }

  private cloneConfigAck(record: RuntimeConfigAckRecord): RuntimeConfigAckRecord {
    return {
      ...record,
      acknowledgedAt: new Date(record.acknowledgedAt.getTime())
    };
  }
}

function validateAuditStatus(status: AuditStatus): void {
  if (status !== "succeeded" && status !== "failed" && status !== "denied") {
    throw new Error(`Invalid audit status: ${status}`);
  }
}

function heartbeatSigningPayload(heartbeat: HeartbeatSigningInput): string {
  return [
    heartbeat.serverId,
    heartbeat.resourceVersion,
    heartbeat.fxserverBuild,
    heartbeat.gameBuild,
    heartbeat.nonce
  ].join("\n");
}
