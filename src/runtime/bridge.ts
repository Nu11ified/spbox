import { randomUUID } from "node:crypto";
import { createActionEnvelope, signActionEnvelope } from "../core/actions.js";
import { type AuditLogEntry } from "../core/audit.js";
import { type RuntimeCommandRegistry } from "../core/commands.js";
import { type HookRuntime } from "../core/hooks.js";
import { type MenuRuntime, type MenuTreeNode } from "../core/menu.js";
import { type PermissionStore } from "../core/permission-store.js";
import { PermissionDeniedError, type PermissionDecision } from "../core/permissions.js";
import {
  signHeartbeat,
  type HeartbeatInput,
  type RuntimeControlPlane,
  type RuntimeHealthRecord,
  type RuntimeInstanceRecord
} from "../core/runtime.js";

export type RuntimeLocalHandler = (principalId: string, payload: unknown) => Promise<unknown> | unknown;
export type RuntimeServerCommandExecutor = (command: string) => Promise<unknown> | unknown;
export type RuntimeReducerDispatcher = (reducerName: string, payload: unknown) => Promise<unknown> | unknown;
export type RuntimeServerHandlerDispatcher = (
  handlerName: string,
  principalId: string,
  payload: unknown
) => Promise<unknown> | unknown;
export type RuntimeClientEventDispatcher = (
  eventName: string,
  targetPrincipalId: string,
  payload: unknown
) => Promise<unknown> | unknown;
export type RuntimeVehicleRepairDispatcher = (
  principalId: string,
  payload: unknown
) => Promise<unknown> | unknown;
export type RuntimeVehicleSpawnDispatcher = (
  principalId: string,
  payload: unknown
) => Promise<unknown> | unknown;
export type RuntimeWorldStateDispatcher = (
  principalId: string,
  payload: unknown
) => Promise<unknown> | unknown;
export type RuntimeTeleportDispatcher = (
  principalId: string,
  payload: unknown
) => Promise<unknown> | unknown;
export type RuntimeKickDispatcher = (
  principalId: string,
  payload: unknown
) => Promise<unknown> | unknown;
export type RuntimeEconomyAdminAdjustDispatcher = (
  principalId: string,
  payload: unknown
) => Promise<unknown> | unknown;
export type RuntimePluginStatusDispatcher = (
  principalId: string,
  payload: unknown
) => Promise<unknown> | unknown;

export interface RuntimeBridgeOptions {
  serverId: string;
  runtime: RuntimeControlPlane;
  permissions: PermissionStore;
  menu: MenuRuntime;
  commands?: RuntimeCommandRegistry;
  hooks?: HookRuntime;
  idFactory?: () => string;
  heartbeatSecret?: string;
  actionSecret?: string;
  serverCommandExecutor?: RuntimeServerCommandExecutor;
  allowedServerCommandPrefixes?: string[];
  reducerDispatcher?: RuntimeReducerDispatcher;
  serverHandlerDispatcher?: RuntimeServerHandlerDispatcher;
  clientEventDispatcher?: RuntimeClientEventDispatcher;
  vehicleRepairDispatcher?: RuntimeVehicleRepairDispatcher;
  vehicleSpawnDispatcher?: RuntimeVehicleSpawnDispatcher;
  worldStateDispatcher?: RuntimeWorldStateDispatcher;
  teleportDispatcher?: RuntimeTeleportDispatcher;
  kickDispatcher?: RuntimeKickDispatcher;
  economyAdminAdjustDispatcher?: RuntimeEconomyAdminAdjustDispatcher;
  pluginStatusDispatcher?: RuntimePluginStatusDispatcher;
}

export interface RuntimeBridgeActionResult {
  ok: boolean;
  result?: unknown;
  error?: string;
  actionId?: string;
}

export type RuntimeBridgeHeartbeatInput = Pick<
  HeartbeatInput,
  "resourceVersion" | "fxserverBuild" | "gameBuild"
>;

export class RuntimeBridge {
  private readonly serverId: string;
  private readonly runtime: RuntimeControlPlane;
  private readonly permissions: PermissionStore;
  private menu: MenuRuntime;
  private commands?: RuntimeCommandRegistry;
  private hooks?: HookRuntime;
  private readonly handlersByActionId = new Map<string, RuntimeLocalHandler>();
  private readonly idFactory: () => string;
  private readonly heartbeatSecret?: string;
  private readonly actionSecret?: string;
  private readonly serverCommandExecutor?: RuntimeServerCommandExecutor;
  private readonly allowedServerCommandPrefixes: string[];
  private readonly reducerDispatcher?: RuntimeReducerDispatcher;
  private readonly serverHandlerDispatcher?: RuntimeServerHandlerDispatcher;
  private readonly clientEventDispatcher?: RuntimeClientEventDispatcher;
  private readonly vehicleRepairDispatcher?: RuntimeVehicleRepairDispatcher;
  private readonly vehicleSpawnDispatcher?: RuntimeVehicleSpawnDispatcher;
  private readonly worldStateDispatcher?: RuntimeWorldStateDispatcher;
  private readonly teleportDispatcher?: RuntimeTeleportDispatcher;
  private readonly kickDispatcher?: RuntimeKickDispatcher;
  private readonly economyAdminAdjustDispatcher?: RuntimeEconomyAdminAdjustDispatcher;
  private readonly pluginStatusDispatcher?: RuntimePluginStatusDispatcher;

  public constructor(options: RuntimeBridgeOptions) {
    this.serverId = options.serverId;
    this.runtime = options.runtime;
    this.permissions = options.permissions;
    this.menu = options.menu;
    this.commands = options.commands;
    this.hooks = options.hooks;
    this.idFactory = options.idFactory ?? (() => randomUUID());
    this.heartbeatSecret = options.heartbeatSecret;
    this.actionSecret = options.actionSecret;
    this.serverCommandExecutor = options.serverCommandExecutor;
    this.allowedServerCommandPrefixes = [...(options.allowedServerCommandPrefixes ?? [])];
    this.reducerDispatcher = options.reducerDispatcher;
    this.serverHandlerDispatcher = options.serverHandlerDispatcher;
    this.clientEventDispatcher = options.clientEventDispatcher;
    this.vehicleRepairDispatcher = options.vehicleRepairDispatcher;
    this.vehicleSpawnDispatcher = options.vehicleSpawnDispatcher;
    this.worldStateDispatcher = options.worldStateDispatcher;
    this.teleportDispatcher = options.teleportDispatcher;
    this.kickDispatcher = options.kickDispatcher;
    this.economyAdminAdjustDispatcher = options.economyAdminAdjustDispatcher;
    this.pluginStatusDispatcher = options.pluginStatusDispatcher;
  }

  public hasPermission(principalId: string, permissionKey: string): boolean {
    return this.permissions.toEngine().hasPermission(principalId, permissionKey).allowed;
  }

  public getServerId(): string {
    return this.serverId;
  }

  public getConfig(namespace: string, key: string): unknown {
    return this.runtime.getRuntimeConfig(this.serverId, namespace, key)?.value;
  }

  public getMenuTree(principalId: string): MenuTreeNode[] {
    return this.menu.buildTreeForPrincipal(principalId);
  }

  public updateMenuRuntime(menu: MenuRuntime): void {
    this.menu = menu;
  }

  public updateCommandRegistry(commands: RuntimeCommandRegistry | undefined): void {
    this.commands = commands;
  }

  public updateHookRuntime(hooks: HookRuntime | undefined): void {
    this.hooks = hooks;
  }

  public refreshPermissionEngine(): void {
    const permissions = this.permissions.toEngine();
    this.menu.updatePermissions(permissions);
    this.commands?.updatePermissions(permissions);
  }

  public recordHeartbeat(input: RuntimeBridgeHeartbeatInput): RuntimeInstanceRecord {
    const heartbeat: HeartbeatInput = {
      serverId: this.serverId,
      resourceVersion: input.resourceVersion,
      fxserverBuild: input.fxserverBuild,
      gameBuild: input.gameBuild
    };

    if (this.heartbeatSecret) {
      heartbeat.nonce = this.idFactory();
      heartbeat.signature = signHeartbeat(heartbeat, this.heartbeatSecret);
    }

    return this.runtime.heartbeat(heartbeat);
  }

  public getHealth(heartbeatTimeoutMs?: number): RuntimeHealthRecord {
    return this.runtime.getHealth(this.serverId, heartbeatTimeoutMs);
  }

  public registerLocalHandler(actionId: string, handler: RuntimeLocalHandler): void {
    if (!actionId) {
      throw new Error("actionId must be a non-empty string");
    }

    this.handlersByActionId.set(actionId, handler);
  }

  public async callAction(
    principalId: string,
    actionId: string,
    payload: unknown
  ): Promise<RuntimeBridgeActionResult> {
    try {
      const execution = await this.menu.executeAction(principalId, actionId, payload, {
        confirmed: true,
        serverId: this.serverId
      });
      return await this.dispatchAuthorizedAction(
        principalId,
        actionId,
        payload,
        execution.audit,
        execution.action.pluginId,
        execution.action.requiredPermission,
        execution.action.actionType,
        execution.action.reducerName
      );
    } catch (error) {
      if (error instanceof PermissionDeniedError) {
        this.recordPermissionDenied(principalId, actionId, this.menu.getAction(actionId), error);
      }
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Runtime action failed"
      };
    }
  }

  public async callCommand(
    principalId: string,
    commandName: string,
    payload: unknown
  ): Promise<RuntimeBridgeActionResult> {
    try {
      if (!this.commands) {
        throw new Error("Runtime command registry is not configured");
      }

      const execution = this.commands.executeCommand(principalId, commandName, payload, this.serverId);
      return await this.dispatchAuthorizedAction(
        principalId,
        execution.actionId,
        payload,
        execution.audit,
        execution.command.pluginId,
        execution.command.requiredPermission
      );
    } catch (error) {
      if (error instanceof PermissionDeniedError) {
        this.recordPermissionDenied(principalId, commandName, this.commands?.getCommand(commandName), error);
      }
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Runtime command failed"
      };
    }
  }

  private async dispatchAuthorizedAction(
    principalId: string,
    actionId: string,
    payload: unknown,
    audit: AuditLogEntry | undefined,
    pluginId: string | undefined,
    permissionKey: string | undefined,
    actionType: string = "runtime_action",
    reducerName?: string
  ): Promise<RuntimeBridgeActionResult> {
      const handler = this.handlersByActionId.get(actionId);
      if (!handler && actionType === "runtime_action") {
        throw new Error(`Unknown runtime action: ${actionId}`);
      }

      const action = this.runtime.submitAction({
        serverId: this.serverId,
        actorId: principalId,
        actionType: actionId,
        payload,
        ...this.actionEnvelopeProof(principalId, actionId, payload)
      });

      let result: unknown;
      try {
        result = await this.executeTypedAction(actionType, handler, principalId, payload, reducerName);
      } catch (error) {
        this.runtime.completeAction({
          actionId: action.id,
          status: "failed",
          pluginId: audit?.pluginId ?? pluginId,
          permissionKey: audit?.permissionKey ?? permissionKey,
          targetType: audit?.targetType,
          targetId: audit?.targetId,
          before: audit?.before,
          after: {
            error: error instanceof Error ? error.message : "Runtime action failed"
          }
        });
        throw error;
      }

      const hookResult = await this.hooks?.dispatch(`after_action.${actionId}`, {
        actionId,
        actorId: principalId,
        payload,
        result
      });
      for (const hookAudit of hookResult?.audit ?? []) {
        this.runtime.writeAuditLog({
          ...hookAudit,
          serverId: this.serverId
        });
      }

      this.runtime.completeAction({
        actionId: action.id,
        status: "completed",
        pluginId: audit?.pluginId ?? pluginId,
        permissionKey: audit?.permissionKey ?? permissionKey,
        targetType: audit?.targetType,
        targetId: audit?.targetId,
        before: audit?.before,
        after: result
      });

      return {
        ok: true,
        result,
        actionId: action.id
      };
  }

  private recordPermissionDenied(
    principalId: string,
    requestedAction: string,
    definition: { pluginId?: string; id?: string; actionId?: string; requiredPermission?: string; name?: string } | undefined,
    error: PermissionDeniedError
  ): void {
    this.runtime.writeAuditLog({
      serverId: this.serverId,
      actorId: principalId,
      pluginId: definition?.pluginId,
      actionType: definition?.actionId ?? definition?.id ?? requestedAction,
      permissionKey: definition?.requiredPermission ?? error.decision.permissionKey,
      after: permissionDeniedAuditPayload(error.message, error.decision),
      status: "denied"
    });
  }

  private actionEnvelopeProof(
    principalId: string,
    actionId: string,
    payload: unknown
  ): {
    nonce: string;
    idempotencyKey: string;
    signature?: string;
  } {
    const nonce = this.idFactory();
    const idempotencyKey = this.idFactory();
    if (!this.actionSecret) {
      return { nonce, idempotencyKey };
    }

    const unsigned = createActionEnvelope({
      id: "signature-preview",
      serverId: this.serverId,
      actorId: principalId,
      actionType: actionId,
      payload,
      nonce,
      idempotencyKey,
      createdAt: new Date(0)
    });

    return {
      nonce,
      idempotencyKey,
      signature: signActionEnvelope(unsigned, this.actionSecret)
    };
  }

  private async executeTypedAction(
    actionType: string,
    handler: RuntimeLocalHandler | undefined,
    principalId: string,
    payload: unknown,
    reducerName?: string
  ): Promise<unknown> {
    if (actionType === "set_runtime_config") {
      const input = this.runtimeConfigPayload(payload);
      return this.runtime.setRuntimeConfig({
        serverId: this.serverId,
        namespace: input.namespace,
        key: input.key,
        value: input.value
      });
    }

    if (actionType === "open_panel") {
      const input = this.openPanelPayload(payload);
      return {
        type: "open_panel",
        panelId: input.panelId,
        route: input.route,
        payload: input.payload
      };
    }

    if (actionType === "execute_server_command") {
      const input = this.serverCommandPayload(payload);
      await this.executeServerCommand(input.command);
      return {
        command: input.command,
        executed: true
      };
    }

    if (actionType === "toggle_feature") {
      const input = this.toggleFeaturePayload(payload);
      return this.runtime.setRuntimeConfig({
        serverId: this.serverId,
        namespace: input.namespace,
        key: input.key,
        value: input.enabled
      });
    }

    if (actionType === "call_reducer") {
      return this.callReducer(reducerName, payload);
    }

    if (actionType === "trigger_server_handler") {
      return this.triggerServerHandler(reducerName, principalId, payload);
    }

    if (actionType === "trigger_client_event") {
      return this.triggerClientEvent(reducerName, principalId, payload);
    }

    if (actionType === "repair_vehicle") {
      return this.repairVehicle(principalId, payload);
    }

    if (actionType === "spawn_vehicle") {
      return this.spawnVehicle(principalId, payload);
    }

    if (actionType === "set_weather" || actionType === "set_time") {
      return this.setWorldState(principalId, payload);
    }

    if (actionType === "teleport_player") {
      return this.teleportPlayer(principalId, payload);
    }

    if (actionType === "kick_player") {
      return this.kickPlayer(principalId, payload);
    }

    if (actionType === "economy_admin_adjust_balance") {
      return this.economyAdminAdjustBalance(principalId, payload);
    }

    if (actionType === "set_plugin_status") {
      return this.setPluginStatus(principalId, payload);
    }

    if (!handler) {
      throw new Error(`Unsupported typed action: ${actionType}`);
    }

    return handler(principalId, payload);
  }

  private runtimeConfigPayload(payload: unknown): { namespace: string; key: string; value: unknown } {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error("set_runtime_config payload must be an object");
    }

    const record = payload as Record<string, unknown>;
    if (typeof record.namespace !== "string" || record.namespace === "") {
      throw new Error("set_runtime_config payload requires namespace");
    }
    if (typeof record.key !== "string" || record.key === "") {
      throw new Error("set_runtime_config payload requires key");
    }
    if (!("value" in record)) {
      throw new Error("set_runtime_config payload requires value");
    }

    return {
      namespace: record.namespace,
      key: record.key,
      value: structuredClone(record.value)
    };
  }

  private openPanelPayload(payload: unknown): { panelId: string; route?: string; payload: unknown } {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error("open_panel payload must be an object");
    }

    const record = payload as Record<string, unknown>;
    if (typeof record.panelId !== "string" || record.panelId === "") {
      throw new Error("open_panel payload requires panelId");
    }
    if (record.route !== undefined && typeof record.route !== "string") {
      throw new Error("open_panel route must be a string");
    }

    return {
      panelId: record.panelId,
      route: record.route,
      payload: structuredClone(payload)
    };
  }

  private async callReducer(reducerName: string | undefined, payload: unknown): Promise<unknown> {
    if (!reducerName) {
      throw new Error("call_reducer action requires reducerName");
    }
    if (!this.reducerDispatcher) {
      throw new Error("Reducer dispatcher is not configured");
    }

    return this.reducerDispatcher(reducerName, payload);
  }

  private async triggerServerHandler(
    handlerName: string | undefined,
    principalId: string,
    payload: unknown
  ): Promise<unknown> {
    if (!handlerName) {
      throw new Error("trigger_server_handler action requires reducerName");
    }
    if (!this.serverHandlerDispatcher) {
      throw new Error("Server handler dispatcher is not configured");
    }

    return this.serverHandlerDispatcher(handlerName, principalId, payload);
  }

  private async triggerClientEvent(
    eventName: string | undefined,
    targetPrincipalId: string,
    payload: unknown
  ): Promise<unknown> {
    if (!eventName) {
      throw new Error("trigger_client_event action requires reducerName");
    }
    if (!this.clientEventDispatcher) {
      throw new Error("Client event dispatcher is not configured");
    }

    return this.clientEventDispatcher(eventName, targetPrincipalId, payload);
  }

  private async repairVehicle(principalId: string, payload: unknown): Promise<unknown> {
    if (!this.vehicleRepairDispatcher) {
      throw new Error("Vehicle repair dispatcher is not configured");
    }

    return this.vehicleRepairDispatcher(principalId, payload);
  }

  private async spawnVehicle(principalId: string, payload: unknown): Promise<unknown> {
    if (!this.vehicleSpawnDispatcher) {
      throw new Error("Vehicle spawn dispatcher is not configured");
    }

    return this.vehicleSpawnDispatcher(principalId, payload);
  }

  private async setWorldState(principalId: string, payload: unknown): Promise<unknown> {
    if (!this.worldStateDispatcher) {
      throw new Error("World state dispatcher is not configured");
    }

    return this.worldStateDispatcher(principalId, payload);
  }

  private async teleportPlayer(principalId: string, payload: unknown): Promise<unknown> {
    if (!this.teleportDispatcher) {
      throw new Error("Teleport dispatcher is not configured");
    }

    return this.teleportDispatcher(principalId, payload);
  }

  private async kickPlayer(principalId: string, payload: unknown): Promise<unknown> {
    if (!this.kickDispatcher) {
      throw new Error("Kick dispatcher is not configured");
    }

    return this.kickDispatcher(principalId, payload);
  }

  private async economyAdminAdjustBalance(principalId: string, payload: unknown): Promise<unknown> {
    if (!this.economyAdminAdjustDispatcher) {
      throw new Error("Economy admin adjustment dispatcher is not configured");
    }

    return this.economyAdminAdjustDispatcher(principalId, payload);
  }

  private async setPluginStatus(principalId: string, payload: unknown): Promise<unknown> {
    if (!this.pluginStatusDispatcher) {
      throw new Error("Plugin status dispatcher is not configured");
    }

    return this.pluginStatusDispatcher(principalId, payload);
  }

  private serverCommandPayload(payload: unknown): { command: string } {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error("execute_server_command payload must be an object");
    }

    const record = payload as Record<string, unknown>;
    if (typeof record.command !== "string" || record.command === "") {
      throw new Error("execute_server_command payload requires command");
    }

    return { command: record.command };
  }

  private async executeServerCommand(command: string): Promise<void> {
    const allowlisted = this.allowedServerCommandPrefixes.some((prefix) => command.startsWith(prefix));
    if (!allowlisted) {
      throw new Error(`Server command is not allowlisted: ${command}`);
    }

    if (!this.serverCommandExecutor) {
      throw new Error("Server command executor is not configured");
    }

    await this.serverCommandExecutor(command);
  }

  private toggleFeaturePayload(payload: unknown): { namespace: string; key: string; enabled: boolean } {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error("toggle_feature payload must be an object");
    }

    const record = payload as Record<string, unknown>;
    const namespace = typeof record.namespace === "string" && record.namespace !== ""
      ? record.namespace
      : "features";
    if (typeof record.key !== "string" || record.key === "") {
      throw new Error("toggle_feature payload requires key");
    }
    if (record.enabled !== undefined && typeof record.enabled !== "boolean") {
      throw new Error("toggle_feature enabled must be a boolean");
    }

    const current = this.runtime.getRuntimeConfig(this.serverId, namespace, record.key)?.value;
    return {
      namespace,
      key: record.key,
      enabled: typeof record.enabled === "boolean" ? record.enabled : !Boolean(current)
    };
  }

  public recordDeniedAction(input: {
    actorPrincipalId: string;
    pluginId: string;
    actionId: string;
    permissionKey?: string;
    error: string;
  }): void {
    this.runtime.writeAuditLog({
      serverId: this.serverId,
      actorId: input.actorPrincipalId,
      pluginId: input.pluginId,
      actionType: input.actionId,
      permissionKey: input.permissionKey,
      after: { error: input.error },
      status: "denied"
    });
  }

  public recordPluginHookAudit(input: {
    actorPrincipalId: string;
    pluginId: string;
    hookName: string;
    hookId: string;
    capability: string;
    status: AuditLogEntry["status"];
    after?: unknown;
  }): void {
    this.runtime.writeAuditLog({
      serverId: this.serverId,
      actorId: input.actorPrincipalId,
      pluginId: input.pluginId,
      actionType: `hook.${input.hookName}`,
      permissionKey: input.capability,
      targetType: "hook",
      targetId: input.hookId,
      after: input.after,
      status: input.status
    });
  }
}

function permissionDeniedAuditPayload(error: string, decision: PermissionDecision): Record<string, unknown> {
  return {
    error,
    resolvedPrincipals: [...decision.resolvedPrincipals],
    matchedGrant: decision.matchedGrant
      ? {
          principalId: decision.matchedGrant.principalId,
          permissionKey: decision.matchedGrant.permissionKey,
          effect: decision.matchedGrant.effect,
          source: decision.matchedGrant.source,
          expiresAt: decision.matchedGrant.expiresAt
        }
      : undefined,
    policyResults: decision.policyResults?.map((result) => ({
      policyId: result.policy.id,
      constraintType: result.policy.constraintType,
      passed: result.passed,
      reason: result.reason
    })),
    deniedByPolicyId: decision.deniedByPolicy?.id
  };
}
