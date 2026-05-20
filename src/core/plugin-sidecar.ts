import { createHash } from "node:crypto";
import {
  type PluginBundleRecord,
  type PluginDeploymentRecord,
  type PluginRuntimeType,
  validateForbiddenSandboxCapability
} from "./plugin-deployment.js";

export type PluginSidecarStatus = "running" | "failed" | "stopped";
export type PluginSandboxEventStatus = "succeeded" | "failed";

export interface PluginSidecarInstance {
  id: string;
  deploymentId: string;
  pluginId: string;
  serverId: string;
  bundleId: string;
  runtimeType: PluginRuntimeType;
  status: PluginSidecarStatus;
  startedAt: Date;
  lastHeartbeatAt: Date;
  metadata?: unknown;
  errorMessage?: string;
}

export interface PluginSandboxEvent {
  id: string;
  pluginId: string;
  serverId: string;
  eventType: string;
  payloadHash: string;
  status: PluginSandboxEventStatus;
  createdAt: Date;
}

export interface PluginSandboxDriverStartInput {
  deployment: PluginDeploymentRecord;
  bundle: PluginBundleRecord;
  sandboxPolicy: PluginSandboxPolicy;
}

export interface PluginSandboxHookInput {
  instance: PluginSidecarInstance;
  hookName: string;
  handlerRef: string;
  payload: unknown;
  actorPrincipalId: string;
}

export interface PluginSandboxActionRequest {
  actorPrincipalId?: string;
  actionId: string;
  payload: unknown;
}

export interface PluginSandboxHookResponse {
  actions?: PluginSandboxActionRequest[];
}

export interface PluginSandboxPolicy {
  allowedCapabilities: string[];
  requestedCapabilities: string[];
}

export interface PluginSandboxDriver {
  start(input: PluginSandboxDriverStartInput): Promise<unknown>;
  stop(instance: PluginSidecarInstance): Promise<void>;
  dispatchHook?(input: PluginSandboxHookInput): Promise<PluginSandboxHookResponse>;
}

export interface PluginSidecarSupervisorOptions {
  driver: PluginSandboxDriver;
  now?: () => Date;
  idFactory?: () => string;
  heartbeatTimeoutMs?: number;
  hookDispatchTimeoutMs?: number;
  allowedSandboxCapabilities?: string[];
}

export class PluginSidecarSupervisor {
  private readonly instancesById = new Map<string, PluginSidecarInstance>();
  private readonly instanceIdByDeploymentId = new Map<string, string>();
  private readonly sandboxEvents: PluginSandboxEvent[] = [];
  private readonly driver: PluginSandboxDriver;
  private readonly now: () => Date;
  private readonly idFactory: () => string;
  private readonly heartbeatTimeoutMs: number;
  private readonly hookDispatchTimeoutMs: number;
  private readonly allowedSandboxCapabilities: Set<string>;

  public constructor(options: PluginSidecarSupervisorOptions) {
    this.driver = options.driver;
    this.now = options.now ?? (() => new Date());
    this.idFactory = options.idFactory ?? (() => crypto.randomUUID());
    this.heartbeatTimeoutMs = positiveFiniteNumber(options.heartbeatTimeoutMs ?? 60_000, "heartbeatTimeoutMs");
    this.hookDispatchTimeoutMs = positiveFiniteNumber(options.hookDispatchTimeoutMs ?? 30_000, "hookDispatchTimeoutMs");
    this.allowedSandboxCapabilities = new Set(options.allowedSandboxCapabilities ?? []);
  }

  public async start(
    deployment: PluginDeploymentRecord,
    bundle: PluginBundleRecord
  ): Promise<PluginSidecarInstance> {
    if (deployment.status !== "active") {
      throw new Error(`Deployment is not active: ${deployment.id}`);
    }
    if (deployment.bundleId !== bundle.id || deployment.pluginId !== bundle.pluginId) {
      throw new Error(`Bundle ${bundle.id} does not match deployment ${deployment.id}`);
    }

    const existingId = this.instanceIdByDeploymentId.get(deployment.id);
    if (existingId) {
      const existing = this.requireInstance(existingId);
      if (existing.status === "running") {
        return this.cloneInstance(existing);
      }
      this.instanceIdByDeploymentId.delete(deployment.id);
    }

    const timestamp = this.now();
    const instance: PluginSidecarInstance = {
      id: this.idFactory(),
      deploymentId: deployment.id,
      pluginId: deployment.pluginId,
      serverId: deployment.serverId,
      bundleId: bundle.id,
      runtimeType: bundle.runtimeType,
      status: "running",
      startedAt: timestamp,
      lastHeartbeatAt: timestamp
    };

    try {
      assertSidecarRuntimeType(bundle.runtimeType);
      const sandboxPolicy = this.buildSandboxPolicy(bundle);
      instance.metadata = await this.driver.start({ deployment, bundle, sandboxPolicy });
    } catch (error) {
      instance.status = "failed";
      instance.errorMessage = error instanceof Error ? error.message : String(error);
      this.recordEvent(instance, "sidecar.start_failed", "failed");
      throw error;
    }

    this.instancesById.set(instance.id, instance);
    this.instanceIdByDeploymentId.set(deployment.id, instance.id);
    this.recordEvent(instance, "sidecar.started", "succeeded");
    return this.cloneInstance(instance);
  }

  public heartbeat(instanceId: string): PluginSidecarInstance {
    const instance = this.requireInstance(instanceId);
    if (instance.status !== "running") {
      throw new Error(`Sidecar is not running: ${instanceId}`);
    }

    instance.lastHeartbeatAt = this.now();
    this.recordEvent(instance, "sidecar.heartbeat", "succeeded");
    return this.cloneInstance(instance);
  }

  public async failStaleInstances(): Promise<PluginSidecarInstance[]> {
    const failed: PluginSidecarInstance[] = [];
    const now = this.now().getTime();

    for (const instance of this.instancesById.values()) {
      if (
        instance.status === "running" &&
        now - instance.lastHeartbeatAt.getTime() > this.heartbeatTimeoutMs
      ) {
        instance.status = "failed";
        instance.errorMessage = "heartbeat timeout";
        this.recordEvent(instance, "sidecar.failed", "failed");
        failed.push(this.cloneInstance(instance));
      }
    }

    return failed;
  }

  public async reconcile(
    deployments: PluginDeploymentRecord[],
    bundlesById: Map<string, PluginBundleRecord>
  ): Promise<void> {
    const desiredDeployments = latestActiveDeployments(deployments);
    const activeDeploymentIds = new Set(desiredDeployments.map((deployment) => deployment.id));

    for (const deployment of desiredDeployments) {
      const existingId = this.instanceIdByDeploymentId.get(deployment.id);
      const existing = existingId ? this.instancesById.get(existingId) : undefined;
      if (existing?.status === "running") {
        continue;
      }

      const bundle = bundlesById.get(deployment.bundleId);
      if (!bundle) {
        throw new Error(`Unknown bundle for deployment: ${deployment.bundleId}`);
      }
      await this.start(deployment, bundle);
    }

    for (const instance of this.instancesById.values()) {
      if (instance.status !== "stopped" && !activeDeploymentIds.has(instance.deploymentId)) {
        await this.stop(instance.id);
      }
    }
  }

  public async stop(instanceId: string): Promise<PluginSidecarInstance> {
    const instance = this.requireInstance(instanceId);
    if (instance.status !== "stopped") {
      try {
        await this.driver.stop(instance);
      } catch (error) {
        instance.errorMessage = error instanceof Error ? error.message : String(error);
        this.recordEvent(instance, "sidecar.stop_failed", "failed");
        throw error;
      }
      instance.status = "stopped";
      this.instanceIdByDeploymentId.delete(instance.deploymentId);
      this.recordEvent(instance, "sidecar.stopped", "succeeded");
    }

    return this.cloneInstance(instance);
  }

  public async dispatchHook(
    instanceId: string,
    input: Omit<PluginSandboxHookInput, "instance">
  ): Promise<PluginSandboxHookResponse> {
    const instance = this.requireInstance(instanceId);
    if (instance.status !== "running") {
      throw new Error(`Sidecar is not running: ${instanceId}`);
    }
    if (!this.driver.dispatchHook) {
      throw new Error("Sandbox driver does not support hook dispatch");
    }

    try {
      const response = await withTimeout(this.driver.dispatchHook({
        ...input,
        instance: this.cloneInstance(instance)
      }), this.hookDispatchTimeoutMs, "Sidecar hook dispatch");
      validateHookResponse(response);
      this.recordEvent(instance, "sidecar.hook_dispatched", "succeeded");
      return {
        actions: response.actions?.map((action) => ({ ...action }))
      };
    } catch (error) {
      instance.errorMessage = error instanceof Error ? error.message : String(error);
      this.recordEvent(instance, "sidecar.hook_failed", "failed");
      throw error;
    }
  }

  public getInstance(instanceId: string): PluginSidecarInstance | undefined {
    const instance = this.instancesById.get(instanceId);
    return instance ? this.cloneInstance(instance) : undefined;
  }

  public getRunningInstances(pluginId: string, serverId: string): PluginSidecarInstance[] {
    return [...this.instancesById.values()]
      .filter((instance) =>
        instance.pluginId === pluginId &&
        instance.serverId === serverId &&
        instance.status === "running"
      )
      .map((instance) => this.cloneInstance(instance));
  }

  public getSandboxEvents(): PluginSandboxEvent[] {
    return this.sandboxEvents.map((event) => ({ ...event }));
  }

  private requireInstance(instanceId: string): PluginSidecarInstance {
    const instance = this.instancesById.get(instanceId);
    if (!instance) {
      throw new Error(`Unknown sidecar instance: ${instanceId}`);
    }

    return instance;
  }

  private buildSandboxPolicy(bundle: PluginBundleRecord): PluginSandboxPolicy {
    const requestedCapabilities = bundle.capabilities
      .map((capability) => capability.key)
      .filter((key) => key.startsWith("sandbox."))
      .sort();
    const allowedCapabilities = [...this.allowedSandboxCapabilities].sort();
    for (const capability of requestedCapabilities) {
      const forbidden = validateForbiddenSandboxCapability(capability);
      if (forbidden) {
        throw new Error(forbidden);
      }
      if (!this.allowedSandboxCapabilities.has(capability)) {
        throw new Error(`Sandbox capability is not allowed for plugin ${bundle.pluginId}: ${capability}`);
      }
    }

    return {
      allowedCapabilities,
      requestedCapabilities
    };
  }

  private recordEvent(
    instance: PluginSidecarInstance,
    eventType: string,
    status: PluginSandboxEventStatus
  ): void {
    this.sandboxEvents.push({
      id: this.idFactory(),
      pluginId: instance.pluginId,
      serverId: instance.serverId,
      eventType,
      payloadHash: hashPayload({
        instanceId: instance.id,
        deploymentId: instance.deploymentId,
        status: instance.status,
        errorMessage: instance.errorMessage
      }),
      status,
      createdAt: this.now()
    });
  }

  private cloneInstance(instance: PluginSidecarInstance): PluginSidecarInstance {
    return {
      ...instance,
      metadata: structuredClone(instance.metadata)
    };
  }
}

function hashPayload(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function positiveFiniteNumber(value: number, field: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${field} must be a positive finite number`);
  }

  return value;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timeout = setTimeout(() => {
          reject(new Error(`${label} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function assertSidecarRuntimeType(runtimeType: PluginRuntimeType): void {
  if (runtimeType !== "js_sidecar" && runtimeType !== "native_sidecar") {
    throw new Error(`Runtime type is not supported by sidecar supervisor: ${runtimeType}`);
  }
}

function validateHookResponse(response: PluginSandboxHookResponse): void {
  if (!response || typeof response !== "object" || Array.isArray(response)) {
    throw new Error("Invalid sidecar hook response");
  }
  if (response.actions === undefined) {
    return;
  }
  if (!Array.isArray(response.actions)) {
    throw new Error("Invalid sidecar hook response: actions must be an array");
  }

  response.actions.forEach((action, index) => {
    if (!action || typeof action !== "object" || Array.isArray(action)) {
      throw new Error(`Invalid sidecar hook action at index ${index}`);
    }
    if (typeof action.actionId !== "string" || action.actionId.trim().length === 0) {
      throw new Error(`Invalid sidecar hook action at index ${index}: actionId is required`);
    }
    if (
      action.actorPrincipalId !== undefined &&
      (typeof action.actorPrincipalId !== "string" || action.actorPrincipalId.trim().length === 0)
    ) {
      throw new Error(`Invalid sidecar hook action at index ${index}: actorPrincipalId must be a string`);
    }
  });
}

function latestActiveDeployments(deployments: PluginDeploymentRecord[]): PluginDeploymentRecord[] {
  const byPluginServer = new Map<string, PluginDeploymentRecord>();
  for (const deployment of deployments) {
    if (deployment.status !== "active") {
      continue;
    }

    const key = `${deployment.pluginId}:${deployment.serverId}`;
    const existing = byPluginServer.get(key);
    if (!existing || compareDeploymentFreshness(deployment, existing) > 0) {
      byPluginServer.set(key, deployment);
    }
  }

  return [...byPluginServer.values()];
}

function compareDeploymentFreshness(left: PluginDeploymentRecord, right: PluginDeploymentRecord): number {
  const leftTime = left.deployedAt?.getTime() ?? 0;
  const rightTime = right.deployedAt?.getTime() ?? 0;
  if (leftTime !== rightTime) {
    return leftTime - rightTime;
  }

  return left.id.localeCompare(right.id);
}
