import { createHash, createHmac } from "node:crypto";
import { type AuditLogEntry } from "./audit.js";

export type PluginRuntimeType = "wasm" | "js_sidecar" | "native_sidecar";
export type PluginBundleStatus = "registered" | "revoked";
export type PluginDeploymentStatus = "pending" | "active" | "failed" | "rolled_back" | "killed";

export interface PluginSigner {
  id: string;
  secret: string;
}

export interface PluginCapability {
  key: string;
  constraints?: unknown;
}

export interface PluginBundleRecord {
  id: string;
  pluginId: string;
  version: string;
  artifactUrl: string;
  bundleHash: string;
  signature: string;
  signerId: string;
  runtimeType: PluginRuntimeType;
  capabilities: PluginCapability[];
  status: PluginBundleStatus;
  createdAt: Date;
}

export interface RegisterPluginBundleInput {
  id: string;
  pluginId: string;
  version: string;
  artifactUrl: string;
  bundleHash: string;
  signature: string;
  signerId: string;
  runtimeType: PluginRuntimeType;
  capabilities: PluginCapability[];
}

export interface PluginBundleSigningPayloadInput {
  id: string;
  pluginId: string;
  version: string;
  bundleHash: string;
  signerId: string;
  runtimeType: PluginRuntimeType;
  capabilities: PluginCapability[];
}

export interface PluginDeploymentRecord {
  id: string;
  pluginId: string;
  bundleId: string;
  serverId: string;
  status: PluginDeploymentStatus;
  desiredVersion: string;
  activeVersion?: string;
  deployedAt?: Date;
  errorMessage?: string;
  requestedBy?: string;
  approvedBy?: string;
}

export interface PluginDeploymentFailureResult {
  failed: PluginDeploymentRecord;
  rollback?: PluginDeploymentRecord;
}

export interface DeployPluginInput {
  pluginId: string;
  bundleId: string;
  serverId: string;
  bundleBytes: string | Buffer;
}

export interface DeployPluginFromArtifactInput {
  pluginId: string;
  bundleId: string;
  serverId: string;
}

export interface RequestPluginDeploymentInput extends DeployPluginInput {
  requestedBy: string;
}

export interface RequestPluginDeploymentFromArtifactInput extends DeployPluginFromArtifactInput {
  requestedBy: string;
}

export interface PluginArtifactFetcher {
  fetch(artifactUrl: string): Promise<string | Buffer>;
}

export interface PluginArtifactFetchResponse {
  ok: boolean;
  status: number;
  statusText: string;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export type PluginArtifactFetch = (artifactUrl: string) => Promise<PluginArtifactFetchResponse>;

const accountOwnerTypes = new Set(["character", "business", "government", "society", "plugin"]);
const pluginRuntimeTypes = new Set<PluginRuntimeType>(["wasm", "js_sidecar", "native_sidecar"]);

export class HttpPluginArtifactFetcher implements PluginArtifactFetcher {
  public constructor(private readonly fetchImpl: PluginArtifactFetch = defaultFetch) {}

  public async fetch(artifactUrl: string): Promise<Buffer> {
    if (artifactUrl.startsWith("http://")) {
      throw new Error(`Plugin artifact URL must use HTTPS: ${artifactUrl}`);
    }
    if (!artifactUrl.startsWith("https://")) {
      throw new Error(`Unsupported plugin artifact URL: ${artifactUrl}`);
    }

    const response = await this.fetchImpl(artifactUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch plugin artifact ${artifactUrl}: ${response.status} ${response.statusText}`);
    }

    return Buffer.from(await response.arrayBuffer());
  }
}

export interface PluginDeploymentManagerOptions {
  now?: () => Date;
  idFactory?: () => string;
  signers: PluginSigner[];
  artifactFetcher?: PluginArtifactFetcher;
  approvedSandboxCapabilities?: string[];
}

export class PluginDeploymentManager {
  private readonly bundlesById = new Map<string, PluginBundleRecord>();
  private readonly deploymentsByPluginServer = new Map<string, PluginDeploymentRecord[]>();
  private readonly signersById: Map<string, PluginSigner>;
  private readonly revokedSignerIds = new Set<string>();
  private readonly pendingBundleBytesByDeploymentId = new Map<string, string | Buffer>();
  private readonly auditLogs: AuditLogEntry[] = [];
  private readonly artifactFetcher: PluginArtifactFetcher;
  private readonly now: () => Date;
  private readonly idFactory: () => string;
  private readonly approvedSandboxCapabilities: Set<string>;

  public constructor(options: PluginDeploymentManagerOptions) {
    this.signersById = new Map(options.signers.map((signer) => [signer.id, signer]));
    this.artifactFetcher = options.artifactFetcher ?? new HttpPluginArtifactFetcher();
    this.now = options.now ?? (() => new Date());
    this.idFactory = options.idFactory ?? (() => crypto.randomUUID());
    this.approvedSandboxCapabilities = new Set(options.approvedSandboxCapabilities ?? []);
  }

  public registerBundle(input: RegisterPluginBundleInput): PluginBundleRecord {
    validateBundleRegistrationMetadata(input);
    if (this.bundlesById.has(input.id)) {
      throw new Error(`Bundle already exists: ${input.id}`);
    }
    if (!this.signersById.has(input.signerId)) {
      throw new Error(`Unknown signer: ${input.signerId}`);
    }
    if (this.revokedSignerIds.has(input.signerId)) {
      throw new Error(`Bundle signer has been revoked: ${input.signerId}`);
    }
    assertUniqueCapabilityKeys(input.id, input.capabilities);

    const bundle: PluginBundleRecord = {
      ...input,
      capabilities: structuredClone(input.capabilities),
      status: "registered",
      createdAt: this.now()
    };

    this.bundlesById.set(bundle.id, bundle);
    this.audit("system", "plugin.bundle_registered", bundle.pluginId, bundle.id);
    return this.cloneBundle(bundle);
  }

  public deploy(input: DeployPluginInput): PluginDeploymentRecord {
    validateDeploymentInput(input);
    const bundle = this.requireBundle(input.bundleId);
    if (bundle.pluginId !== input.pluginId) {
      throw new Error(`Bundle ${input.bundleId} does not belong to plugin ${input.pluginId}`);
    }

    const errorMessage = this.verifyDeploymentActivation(bundle, input.bundleBytes);
    const deployment: PluginDeploymentRecord = {
      id: this.idFactory(),
      pluginId: input.pluginId,
      bundleId: input.bundleId,
      serverId: input.serverId,
      status: errorMessage ? "failed" : "active",
      desiredVersion: bundle.version,
      activeVersion: errorMessage ? undefined : bundle.version,
      deployedAt: errorMessage ? undefined : this.now(),
      errorMessage
    };

    if (!errorMessage) {
      this.supersedeActiveDeployments(input.pluginId, input.serverId, deployment.id);
    }
    this.pushDeployment(deployment);
    if (errorMessage) {
      this.audit("system", "plugin.deployment_failed", input.pluginId, deployment.id, {
        error: errorMessage
      }, "failed");
    } else {
      this.audit("system", "plugin.deployment_direct", input.pluginId, deployment.id);
    }
    return this.cloneDeployment(deployment);
  }

  public async deployFromArtifact(input: DeployPluginFromArtifactInput): Promise<PluginDeploymentRecord> {
    validateDeploymentIdentity(input);
    const bundle = this.requireBundle(input.bundleId);
    if (bundle.pluginId !== input.pluginId) {
      throw new Error(`Bundle ${input.bundleId} does not belong to plugin ${input.pluginId}`);
    }
    this.assertBundleSignerNotRevoked(bundle);
    const bundleBytes = await this.fetchBundleArtifact(bundle);
    return this.deploy({
      ...input,
      bundleBytes
    });
  }

  public requestDeployment(input: RequestPluginDeploymentInput): PluginDeploymentRecord {
    validateDeploymentInput(input);
    validateDeploymentRequester(input.requestedBy);
    const bundle = this.requireBundle(input.bundleId);
    if (bundle.pluginId !== input.pluginId) {
      throw new Error(`Bundle ${input.bundleId} does not belong to plugin ${input.pluginId}`);
    }
    this.assertBundleSignerNotRevoked(bundle);

    const deployment: PluginDeploymentRecord = {
      id: this.idFactory(),
      pluginId: input.pluginId,
      bundleId: input.bundleId,
      serverId: input.serverId,
      status: "pending",
      desiredVersion: bundle.version,
      requestedBy: input.requestedBy
    };

    this.pushDeployment(deployment);
    this.pendingBundleBytesByDeploymentId.set(deployment.id, input.bundleBytes);
    this.audit(input.requestedBy, "plugin.deployment_requested", input.pluginId, deployment.id);
    return this.cloneDeployment(deployment);
  }

  public async requestDeploymentFromArtifact(
    input: RequestPluginDeploymentFromArtifactInput
  ): Promise<PluginDeploymentRecord> {
    validateDeploymentIdentity(input);
    validateDeploymentRequester(input.requestedBy);
    const bundle = this.requireBundle(input.bundleId);
    if (bundle.pluginId !== input.pluginId) {
      throw new Error(`Bundle ${input.bundleId} does not belong to plugin ${input.pluginId}`);
    }
    this.assertBundleSignerNotRevoked(bundle);
    const bundleBytes = await this.fetchBundleArtifact(bundle);
    return this.requestDeployment({
      ...input,
      bundleBytes
    });
  }

  public approveDeployment(deploymentId: string, approvedBy: string): PluginDeploymentRecord {
    validateDeploymentApprover(approvedBy);
    const deployment = this.findDeployment(deploymentId);
    if (!deployment) {
      throw new Error(`Unknown deployment: ${deploymentId}`);
    }

    if (deployment.status !== "pending") {
      throw new Error(`Deployment is not pending: ${deploymentId}`);
    }

    const bundle = this.requireBundle(deployment.bundleId);
    if (this.revokedSignerIds.has(bundle.signerId)) {
      throw new Error(`Bundle signer has been revoked: ${bundle.signerId}`);
    }

    const bundleBytes = this.pendingBundleBytesByDeploymentId.get(deploymentId);
    if (!bundleBytes) {
      throw new Error(`Missing pending bundle bytes for deployment: ${deploymentId}`);
    }

    const errorMessage = this.verifyDeploymentActivation(bundle, bundleBytes);
    if (errorMessage) {
      deployment.status = "failed";
      deployment.errorMessage = errorMessage;
      this.audit(approvedBy, "plugin.deployment_failed", deployment.pluginId, deployment.id, {
        error: errorMessage
      }, "failed");
      return this.cloneDeployment(deployment);
    }

    deployment.status = "active";
    deployment.activeVersion = bundle.version;
    deployment.deployedAt = this.now();
    deployment.approvedBy = approvedBy;
    this.supersedeActiveDeployments(deployment.pluginId, deployment.serverId, deployment.id);
    this.pendingBundleBytesByDeploymentId.delete(deploymentId);
    this.audit(approvedBy, "plugin.deployment_approved", deployment.pluginId, deployment.id);
    return this.cloneDeployment(deployment);
  }

  public killSwitch(pluginId: string, actorId: string, reason: string): PluginDeploymentRecord[] {
    validateKillSwitchInput(actorId, reason);
    const killed: PluginDeploymentRecord[] = [];
    for (const history of this.deploymentsByPluginServer.values()) {
      for (const deployment of history) {
        if (
          deployment.pluginId === pluginId &&
          (deployment.status === "active" || deployment.status === "pending")
        ) {
          deployment.status = "killed";
          deployment.errorMessage = reason;
          this.pendingBundleBytesByDeploymentId.delete(deployment.id);
          killed.push(this.cloneDeployment(deployment));
          this.audit(actorId, "plugin.deployment_killed", deployment.pluginId, deployment.id, { reason });
        }
      }
    }

    this.audit(actorId, "plugin.kill_switch", pluginId, pluginId);
    return killed;
  }

  public revokeSigner(signerId: string, actorId: string, reason: string): PluginDeploymentRecord[] {
    validateSignerRevocationInput(signerId, actorId, reason);
    if (!this.signersById.has(signerId)) {
      throw new Error(`Unknown signer: ${signerId}`);
    }

    this.revokedSignerIds.add(signerId);
    const killed: PluginDeploymentRecord[] = [];
    for (const history of this.deploymentsByPluginServer.values()) {
      for (const deployment of history) {
        if (deployment.status !== "active" && deployment.status !== "pending") {
          continue;
        }

        const bundle = this.bundlesById.get(deployment.bundleId);
        if (bundle?.signerId !== signerId) {
          continue;
        }

        deployment.status = "killed";
        deployment.errorMessage = `signer revoked: ${reason}`;
        this.pendingBundleBytesByDeploymentId.delete(deployment.id);
        killed.push(this.cloneDeployment(deployment));
        this.audit(actorId, "plugin.deployment_killed", deployment.pluginId, deployment.id, { reason, signerId });
      }
    }

    this.audit(actorId, "plugin.signer_revoked", undefined, signerId, { reason });
    return killed;
  }

  public revokeBundle(bundleId: string, actorId: string, reason: string): PluginDeploymentRecord[] {
    validateBundleRevocationInput(actorId, reason);
    const bundle = this.bundlesById.get(bundleId);
    if (!bundle || bundle.status !== "registered") {
      throw new Error(`Unknown or inactive bundle: ${bundleId}`);
    }

    bundle.status = "revoked";
    const killed: PluginDeploymentRecord[] = [];
    for (const history of this.deploymentsByPluginServer.values()) {
      for (const deployment of history) {
        if (
          deployment.bundleId !== bundleId ||
          (deployment.status !== "active" && deployment.status !== "pending")
        ) {
          continue;
        }

        deployment.status = "killed";
        deployment.errorMessage = `bundle revoked: ${reason}`;
        this.pendingBundleBytesByDeploymentId.delete(deployment.id);
        killed.push(this.cloneDeployment(deployment));
        this.audit(actorId, "plugin.deployment_killed", deployment.pluginId, deployment.id);
      }
    }

    this.audit(actorId, "plugin.bundle_revoked", bundle.pluginId, bundle.id, { reason });
    return killed;
  }

  public getAuditLogs(): AuditLogEntry[] {
    return this.auditLogs.map((entry) => ({ ...entry }));
  }

  public listBundles(): PluginBundleRecord[] {
    return [...this.bundlesById.values()]
      .sort((left, right) => left.pluginId.localeCompare(right.pluginId) || left.version.localeCompare(right.version) || left.id.localeCompare(right.id))
      .map((bundle) => this.cloneBundle(bundle));
  }

  public listDeployments(): PluginDeploymentRecord[] {
    return [...this.deploymentsByPluginServer.values()]
      .flat()
      .sort((left, right) => left.pluginId.localeCompare(right.pluginId) || left.serverId.localeCompare(right.serverId) || left.id.localeCompare(right.id))
      .map((deployment) => this.cloneDeployment(deployment));
  }

  public rollback(pluginId: string, serverId: string): PluginDeploymentRecord {
    const history = this.getHistory(pluginId, serverId);
    const active = [...history].reverse().find((deployment) => deployment.status === "active");
    const previous = [...history]
      .reverse()
      .find((deployment) =>
        deployment.id !== active?.id &&
        (deployment.status === "active" || deployment.status === "rolled_back") &&
        this.isRestorableBundle(deployment.bundleId)
      );

    if (!active || !previous) {
      throw new Error(`No previous active deployment for ${pluginId} on ${serverId}`);
    }

    active.status = "rolled_back";
    const rollback: PluginDeploymentRecord = {
      id: this.idFactory(),
      pluginId,
      bundleId: previous.bundleId,
      serverId,
      status: "active",
      desiredVersion: previous.desiredVersion,
      activeVersion: previous.activeVersion,
      deployedAt: this.now()
    };

    this.pushDeployment(rollback);
    this.audit("system", "plugin.deployment_rolled_back", pluginId, active.id, {
      rollbackDeploymentId: rollback.id,
      restoredBundleId: rollback.bundleId,
      restoredVersion: rollback.activeVersion
    });
    return this.cloneDeployment(rollback);
  }

  public failDeployment(
    deploymentId: string,
    actorId: string,
    reason: string
  ): PluginDeploymentFailureResult {
    validateDeploymentFailureInput(actorId, reason);
    const deployment = this.findDeployment(deploymentId);
    if (!deployment) {
      throw new Error(`Unknown deployment: ${deploymentId}`);
    }

    if (deployment.status !== "active" && deployment.status !== "pending") {
      throw new Error(`Deployment cannot be failed from status ${deployment.status}: ${deploymentId}`);
    }

    const wasActive = deployment.status === "active";
    deployment.status = "failed";
    deployment.errorMessage = reason;
    this.pendingBundleBytesByDeploymentId.delete(deploymentId);
    this.audit(actorId, "plugin.deployment_failed", deployment.pluginId, deployment.id, {
      error: reason
    }, "failed");

    const rollback = wasActive
      ? this.restorePreviousActiveDeployment(deployment, actorId)
      : undefined;
    return {
      failed: this.cloneDeployment(deployment),
      rollback: rollback ? this.cloneDeployment(rollback) : undefined
    };
  }

  public getActiveDeployment(pluginId: string, serverId: string): PluginDeploymentRecord | undefined {
    const active = [...this.getHistory(pluginId, serverId)]
      .reverse()
      .find((deployment) => deployment.status === "active");
    return active ? this.cloneDeployment(active) : undefined;
  }

  public assertCapability(pluginId: string, capabilityKey: string): PluginCapability {
    const activeDeployment = [...this.deploymentsByPluginServer.values()]
      .flat()
      .reverse()
      .find((deployment) => deployment.pluginId === pluginId && deployment.status === "active");

    if (!activeDeployment) {
      throw new Error(`Plugin is not active: ${pluginId}`);
    }

    const bundle = this.requireBundle(activeDeployment.bundleId);
    const capability = bundle.capabilities.find((candidate) => candidate.key === capabilityKey);
    if (!capability) {
      throw new Error(`Plugin lacks capability: ${capabilityKey}`);
    }

    return structuredClone(capability);
  }

  public assertCapabilityForServer(
    pluginId: string,
    serverId: string,
    capabilityKey: string
  ): PluginCapability {
    const activeDeployment = [...this.getHistory(pluginId, serverId)]
      .reverse()
      .find((deployment) => deployment.status === "active");

    if (!activeDeployment) {
      throw new Error(`Plugin is not active on server ${serverId}: ${pluginId}`);
    }

    const bundle = this.requireBundle(activeDeployment.bundleId);
    const capability = bundle.capabilities.find((candidate) => candidate.key === capabilityKey);
    if (!capability) {
      throw new Error(`Plugin lacks capability: ${capabilityKey}`);
    }

    return structuredClone(capability);
  }

  private verifyBundle(bundle: PluginBundleRecord, bundleBytes: string | Buffer): string | undefined {
    if (this.revokedSignerIds.has(bundle.signerId)) {
      return `Bundle signer has been revoked: ${bundle.signerId}`;
    }

    const actualHash = createHash("sha256").update(bundleBytes).digest("hex");
    if (actualHash !== expectedSha256Digest(bundle.bundleHash)) {
      return "Bundle hash mismatch";
    }

    const signer = this.signersById.get(bundle.signerId);
    if (!signer) {
      return "Unknown signer";
    }

    const expectedSignature = createHmac("sha256", signer.secret).update(pluginBundleSigningPayload(bundle)).digest("hex");
    if (expectedSignature !== bundle.signature) {
      return "Bundle signature mismatch";
    }

    return undefined;
  }

  private verifyDeploymentActivation(
    bundle: PluginBundleRecord,
    bundleBytes: string | Buffer
  ): string | undefined {
    return this.verifyBundle(bundle, bundleBytes) ?? this.verifySandboxCapabilities(bundle);
  }

  private verifySandboxCapabilities(bundle: PluginBundleRecord): string | undefined {
    const requested = bundle.capabilities
      .map((capability) => capability.key)
      .filter((key) => key.startsWith("sandbox."))
      .sort();
    for (const capability of requested) {
      const forbidden = validateForbiddenSandboxCapability(capability);
      if (forbidden) {
        return forbidden;
      }
      if (!this.approvedSandboxCapabilities.has(capability)) {
        return `Sandbox capability is not approved: ${capability}`;
      }
    }

    return undefined;
  }

  private requireBundle(bundleId: string): PluginBundleRecord {
    const bundle = this.bundlesById.get(bundleId);
    if (!bundle || bundle.status !== "registered") {
      throw new Error(`Unknown or inactive bundle: ${bundleId}`);
    }

    return bundle;
  }

  private isRestorableBundle(bundleId: string): boolean {
    const bundle = this.bundlesById.get(bundleId);
    return bundle?.status === "registered" && !this.revokedSignerIds.has(bundle.signerId);
  }

  private assertBundleSignerNotRevoked(bundle: PluginBundleRecord): void {
    if (this.revokedSignerIds.has(bundle.signerId)) {
      throw new Error(`Bundle signer has been revoked: ${bundle.signerId}`);
    }
  }

  private async fetchBundleArtifact(bundle: PluginBundleRecord): Promise<string | Buffer> {
    return this.artifactFetcher.fetch(bundle.artifactUrl);
  }

  private pushDeployment(deployment: PluginDeploymentRecord): void {
    const key = this.deploymentKey(deployment.pluginId, deployment.serverId);
    const history = this.deploymentsByPluginServer.get(key) ?? [];
    history.push(deployment);
    this.deploymentsByPluginServer.set(key, history);
  }

  private findDeployment(deploymentId: string): PluginDeploymentRecord | undefined {
    return [...this.deploymentsByPluginServer.values()]
      .flat()
      .find((deployment) => deployment.id === deploymentId);
  }

  private getHistory(pluginId: string, serverId: string): PluginDeploymentRecord[] {
    return this.deploymentsByPluginServer.get(this.deploymentKey(pluginId, serverId)) ?? [];
  }

  private restorePreviousActiveDeployment(
    failedDeployment: PluginDeploymentRecord,
    actorId: string
  ): PluginDeploymentRecord | undefined {
    const previous = [...this.getHistory(failedDeployment.pluginId, failedDeployment.serverId)]
      .reverse()
      .find((deployment) =>
        deployment.id !== failedDeployment.id &&
        (deployment.status === "active" || deployment.status === "rolled_back") &&
        this.isRestorableBundle(deployment.bundleId)
      );
    if (!previous) {
      return undefined;
    }

    const rollback: PluginDeploymentRecord = {
      id: this.idFactory(),
      pluginId: failedDeployment.pluginId,
      bundleId: previous.bundleId,
      serverId: failedDeployment.serverId,
      status: "active",
      desiredVersion: previous.desiredVersion,
      activeVersion: previous.activeVersion,
      deployedAt: this.now()
    };

    this.pushDeployment(rollback);
    this.audit(actorId, "plugin.deployment_rolled_back", failedDeployment.pluginId, failedDeployment.id, {
      rollbackDeploymentId: rollback.id,
      restoredBundleId: rollback.bundleId,
      restoredVersion: rollback.activeVersion
    });
    return rollback;
  }

  private supersedeActiveDeployments(pluginId: string, serverId: string, exceptDeploymentId: string): void {
    for (const deployment of this.getHistory(pluginId, serverId)) {
      if (deployment.id !== exceptDeploymentId && deployment.status === "active") {
        deployment.status = "rolled_back";
      }
    }
  }

  private deploymentKey(pluginId: string, serverId: string): string {
    return `${pluginId}:${serverId}`;
  }

  private cloneBundle(bundle: PluginBundleRecord): PluginBundleRecord {
    return {
      ...bundle,
      capabilities: structuredClone(bundle.capabilities)
    };
  }

  private cloneDeployment(deployment: PluginDeploymentRecord): PluginDeploymentRecord {
    return { ...deployment };
  }

  private audit(
    actorId: string,
    actionType: string,
    pluginId: string | undefined,
    targetId: string,
    after?: unknown,
    status: AuditLogEntry["status"] = "succeeded"
  ): void {
    this.auditLogs.push({
      id: `${actionType}:${targetId}:${this.auditLogs.length + 1}`,
      actorId,
      pluginId,
      actionType,
      targetType: "plugin",
      targetId,
      after,
      status,
      createdAt: this.now()
    });
  }
}

function validateBundleRegistrationMetadata(input: RegisterPluginBundleInput): void {
  if (input.id.trim().length === 0) {
    throw new Error("Bundle id is required");
  }
  if (input.pluginId.trim().length === 0) {
    throw new Error("Bundle plugin id is required");
  }
  if (input.version.trim().length === 0) {
    throw new Error("Bundle version is required");
  }
  if (input.artifactUrl.trim().length === 0) {
    throw new Error("Bundle artifact URL is required");
  }
  if (input.bundleHash.trim().length === 0) {
    throw new Error("Bundle hash is required");
  }
  validateBundleHash(input.bundleHash);
  if (input.signature.trim().length === 0) {
    throw new Error("Bundle signature is required");
  }
  if (input.signerId.trim().length === 0) {
    throw new Error("Bundle signer is required");
  }
  if (!pluginRuntimeTypes.has(input.runtimeType)) {
    throw new Error(`Invalid plugin bundle runtime type: ${input.runtimeType}`);
  }
}

function validateDeploymentInput(input: DeployPluginInput): void {
  validateDeploymentIdentity(input);
}

function validateDeploymentIdentity(input: DeployPluginFromArtifactInput): void {
  if (input.pluginId.trim().length === 0) {
    throw new Error("Plugin deployment plugin id is required");
  }
  if (input.bundleId.trim().length === 0) {
    throw new Error("Plugin deployment bundle id is required");
  }
  if (input.serverId.trim().length === 0) {
    throw new Error("Plugin deployment server id is required");
  }
}

function validateDeploymentRequester(requestedBy: string): void {
  if (requestedBy.trim().length === 0) {
    throw new Error("Plugin deployment requester is required");
  }
}

function validateDeploymentApprover(approvedBy: string): void {
  if (approvedBy.trim().length === 0) {
    throw new Error("Plugin deployment approver is required");
  }
}

function validateDeploymentFailureInput(actorId: string, reason: string): void {
  if (actorId.trim().length === 0) {
    throw new Error("Plugin deployment failure actor is required");
  }
  if (reason.trim().length === 0) {
    throw new Error("Plugin deployment failure reason is required");
  }
}

function validateKillSwitchInput(actorId: string, reason: string): void {
  if (actorId.trim().length === 0) {
    throw new Error("Plugin kill switch actor is required");
  }
  if (reason.trim().length === 0) {
    throw new Error("Plugin kill switch reason is required");
  }
}

function validateSignerRevocationInput(signerId: string, actorId: string, reason: string): void {
  if (signerId.trim().length === 0) {
    throw new Error("Plugin signer id is required");
  }
  if (actorId.trim().length === 0) {
    throw new Error("Plugin signer revocation actor is required");
  }
  if (reason.trim().length === 0) {
    throw new Error("Plugin signer revocation reason is required");
  }
}

function validateBundleRevocationInput(actorId: string, reason: string): void {
  if (actorId.trim().length === 0) {
    throw new Error("Plugin bundle revocation actor is required");
  }
  if (reason.trim().length === 0) {
    throw new Error("Plugin bundle revocation reason is required");
  }
}

async function defaultFetch(artifactUrl: string): Promise<PluginArtifactFetchResponse> {
  if (typeof globalThis.fetch !== "function") {
    throw new Error("Global fetch is not available for plugin artifact downloads");
  }

  return globalThis.fetch(artifactUrl) as Promise<PluginArtifactFetchResponse>;
}

function assertUniqueCapabilityKeys(bundleId: string, capabilities: PluginCapability[]): void {
  const seen = new Set<string>();
  for (const capability of capabilities) {
    if (capability.key.trim().length === 0) {
      throw new Error(`Capability key is required in bundle ${bundleId}`);
    }
    const forbidden = validateForbiddenSandboxCapability(capability.key);
    if (forbidden) {
      throw new Error(forbidden);
    }
    validateCapabilityConstraints(bundleId, capability);
    if (seen.has(capability.key)) {
      throw new Error(`Duplicate capability key in bundle ${bundleId}: ${capability.key}`);
    }
    seen.add(capability.key);
  }
}

function validateCapabilityConstraints(bundleId: string, capability: PluginCapability): void {
  if (capability.constraints === undefined || capability.constraints === null) {
    return;
  }
  if (typeof capability.constraints !== "object" || Array.isArray(capability.constraints)) {
    throw new Error(`Capability constraints must be an object in bundle ${bundleId}: ${capability.key}`);
  }

  const constraints = capability.constraints as Record<string, unknown>;
  const rawLimits = constraints.payloadLimits ?? constraints.payload_limits;
  if (rawLimits !== undefined) {
    if (!rawLimits || typeof rawLimits !== "object" || Array.isArray(rawLimits)) {
      throw new Error(`Invalid payload limits for capability ${capability.key}`);
    }
    for (const [field, limit] of Object.entries(rawLimits as Record<string, unknown>)) {
      if (field.trim().length === 0 || field !== field.trim()) {
        throw new Error(`Invalid payload limit field for capability ${capability.key}`);
      }
      if (typeof limit !== "number" || !Number.isFinite(limit) || limit <= 0) {
        throw new Error(`Invalid payload limit ${field} for capability ${capability.key}`);
      }
    }
  }

  const rawAllowed = constraints.allowedActorPrincipals ?? constraints.allowed_actor_principals;
  if (
    rawAllowed !== undefined &&
      (!Array.isArray(rawAllowed) ||
      rawAllowed.length === 0 ||
      rawAllowed.some((principal) => typeof principal !== "string" || principal.trim().length === 0))
  ) {
    throw new Error(`Invalid allowed actor principals for capability ${capability.key}`);
  }

  const rawMaxAmount = constraints.maxAmount ?? constraints.max_amount;
  if (
    rawMaxAmount !== undefined &&
    (typeof rawMaxAmount !== "number" || !Number.isSafeInteger(rawMaxAmount) || rawMaxAmount <= 0)
  ) {
    throw new Error(`Invalid maxAmount constraint for capability ${capability.key}`);
  }

  const rawAllowedOwnerTypes = constraints.allowedAccountOwnerTypes ?? constraints.allowed_account_owner_types;
  if (
    rawAllowedOwnerTypes !== undefined &&
    (!Array.isArray(rawAllowedOwnerTypes) ||
      rawAllowedOwnerTypes.length === 0 ||
      rawAllowedOwnerTypes.some((ownerType) => typeof ownerType !== "string" || !accountOwnerTypes.has(ownerType)))
  ) {
    throw new Error(`Invalid allowedAccountOwnerTypes constraint for capability ${capability.key}`);
  }

  const rawRequiresOnDuty = constraints.requiresOnDuty ?? constraints.requires_on_duty;
  if (rawRequiresOnDuty !== undefined && typeof rawRequiresOnDuty !== "boolean") {
    throw new Error(`Invalid requiresOnDuty constraint for capability ${capability.key}`);
  }
}

function validateBundleHash(bundleHash: string): void {
  const trimmed = bundleHash.trim();
  if (!trimmed.includes(":")) {
    return;
  }

  const [algorithm, digest] = trimmed.split(":", 2);
  if (algorithm !== "sha256") {
    throw new Error("Bundle hash algorithm must be sha256");
  }
  if (!/^[a-f0-9]{64}$/.test(digest ?? "")) {
    throw new Error("Bundle sha256 digest must be 64 lowercase hex characters");
  }
}

function expectedSha256Digest(bundleHash: string): string {
  const trimmed = bundleHash.trim();
  if (trimmed.startsWith("sha256:")) {
    return trimmed.slice("sha256:".length);
  }

  return trimmed;
}

export function pluginBundleSigningPayload(bundle: PluginBundleSigningPayloadInput): string {
  return stableJson({
    bundleHash: bundle.bundleHash,
    capabilities: bundle.capabilities
      .map((capability) => ({
        constraints: capability.constraints ?? null,
        key: capability.key
      }))
      .sort((left, right) => left.key.localeCompare(right.key)),
    id: bundle.id,
    pluginId: bundle.pluginId,
    runtimeType: bundle.runtimeType,
    signerId: bundle.signerId,
    version: bundle.version
  });
}

export function validateForbiddenSandboxCapability(capability: string): string | undefined {
  if (
    capability === "sandbox.database" ||
    capability.startsWith("sandbox.database.") ||
    capability === "sandbox.db" ||
    capability.startsWith("sandbox.db.") ||
    capability === "sandbox.spacetimedb" ||
    capability.startsWith("sandbox.spacetimedb.")
  ) {
    return `Sandbox capability is forbidden: ${capability}`;
  }

  return undefined;
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
    .join(",")}}`;
}
