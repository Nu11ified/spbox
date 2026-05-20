import { validateSchema, type SimpleJsonSchema } from "./plugin-data.js";
import { type PluginActionBroker } from "./plugin-action-broker.js";
import { type PluginDeploymentManager } from "./plugin-deployment.js";
import { type PluginSidecarSupervisor } from "./plugin-sidecar.js";
import { type RuntimeBridgeActionResult } from "../runtime/bridge.js";

export interface PluginSidecarHookRegistration {
  id: string;
  pluginId: string;
  hookName: string;
  capability: string;
  handlerRef: string;
  priority: number;
  enabled: boolean;
  payloadSchema?: SimpleJsonSchema;
}

export interface PluginSidecarHookDispatchResult {
  results: Array<{
    hookId: string;
    pluginId: string;
    actionResults: RuntimeBridgeActionResult[];
    error?: string;
  }>;
}

export interface PluginSidecarHookBrokerOptions {
  serverId: string;
  deployments: PluginDeploymentManager;
  supervisor: PluginSidecarSupervisor;
  actionBroker: PluginActionBroker;
  hooks: PluginSidecarHookRegistration[];
  maxActionsPerHook?: number;
}

export class PluginSidecarHookBroker {
  private readonly serverId: string;
  private readonly deployments: PluginDeploymentManager;
  private readonly supervisor: PluginSidecarSupervisor;
  private readonly actionBroker: PluginActionBroker;
  private readonly hooksByName = new Map<string, PluginSidecarHookRegistration[]>();
  private readonly maxActionsPerHook: number;

  public constructor(options: PluginSidecarHookBrokerOptions) {
    if (isBlankString(options.serverId)) {
      throw new Error("serverId is required");
    }
    this.serverId = options.serverId;
    this.deployments = options.deployments;
    this.supervisor = options.supervisor;
    this.actionBroker = options.actionBroker;
    this.maxActionsPerHook = nonNegativeInteger(options.maxActionsPerHook ?? 8, "maxActionsPerHook");

    for (const hook of options.hooks) {
      validateHookRegistration(hook);
      const hooks = this.hooksByName.get(hook.hookName) ?? [];
      hooks.push({ ...hook, payloadSchema: hook.payloadSchema ? structuredClone(hook.payloadSchema) : undefined });
      hooks.sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
      this.hooksByName.set(hook.hookName, hooks);
    }
  }

  public async dispatch(
    hookName: string,
    payload: unknown,
    actorPrincipalId: string
  ): Promise<PluginSidecarHookDispatchResult> {
    if (isBlankString(hookName)) {
      throw new Error("hookName is required");
    }
    if (isBlankString(actorPrincipalId)) {
      throw new Error("actorPrincipalId is required");
    }
    const hooks = (this.hooksByName.get(hookName) ?? []).filter((hook) => hook.enabled);
    const results: PluginSidecarHookDispatchResult["results"] = [];

    for (const hook of hooks) {
      const actionResults: RuntimeBridgeActionResult[] = [];
      try {
        if (hook.payloadSchema) {
          validateSchema(hook.payloadSchema, payload);
        }
        this.deployments.assertCapabilityForServer(hook.pluginId, this.serverId, hook.capability);
        const instance = this.requireRunningInstance(hook);
        const response = await this.supervisor.dispatchHook(instance.id, {
          hookName,
          handlerRef: hook.handlerRef,
          payload,
          actorPrincipalId
        });
        const actions = response.actions ?? [];
        if (actions.length > this.maxActionsPerHook) {
          throw new Error(
            `Sidecar hook ${hook.id} returned ${actions.length} actions, exceeding limit ${this.maxActionsPerHook}`
          );
        }

        for (const action of actions) {
          actionResults.push(await this.actionBroker.requestAction({
            pluginId: hook.pluginId,
            actorPrincipalId,
            actionId: action.actionId,
            payload: action.payload
          }));
        }

        results.push({
          hookId: hook.id,
          pluginId: hook.pluginId,
          actionResults
        });
        this.actionBroker.recordHookAudit({
          actorPrincipalId,
          pluginId: hook.pluginId,
          hookName,
          hookId: hook.id,
          capability: hook.capability,
          status: "succeeded",
          after: { actionCount: actionResults.length }
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Sidecar hook dispatch failed";
        this.actionBroker.recordHookAudit({
          actorPrincipalId,
          pluginId: hook.pluginId,
          hookName,
          hookId: hook.id,
          capability: hook.capability,
          status: isCapabilityDenial(message) ? "denied" : "failed",
          after: { error: message }
        });
        results.push({
          hookId: hook.id,
          pluginId: hook.pluginId,
          actionResults,
          error: message
        });
      }
    }

    return { results };
  }

  private requireRunningInstance(hook: PluginSidecarHookRegistration) {
    const activeDeployment = this.deployments.getActiveDeployment(hook.pluginId, this.serverId);
    const instance = this.supervisor
      .getRunningInstances(hook.pluginId, this.serverId)
      .find((candidate) => candidate.deploymentId === activeDeployment?.id);
    if (!instance) {
      throw new Error(`No running sidecar for plugin ${hook.pluginId} on server ${this.serverId}`);
    }

    return instance;
  }
}

function validateHookRegistration(hook: PluginSidecarHookRegistration): void {
  if (isBlankString(hook.id)) {
    throw new Error("Sidecar hook registration id is required");
  }
  if (isBlankString(hook.pluginId)) {
    throw new Error("Sidecar hook registration pluginId is required");
  }
  if (isBlankString(hook.hookName)) {
    throw new Error("Sidecar hook registration hookName is required");
  }
  if (isBlankString(hook.capability)) {
    throw new Error("Sidecar hook registration capability is required");
  }
  if (isBlankString(hook.handlerRef)) {
    throw new Error("Sidecar hook registration handlerRef is required");
  }
  if (!Number.isFinite(hook.priority)) {
    throw new Error("Sidecar hook registration priority must be finite");
  }
}

function isBlankString(value: unknown): value is string {
  return typeof value !== "string" || value.trim().length === 0;
}

function nonNegativeInteger(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative integer`);
  }

  return value;
}

function isCapabilityDenial(message: string): boolean {
  return (
    message.startsWith("Plugin lacks capability:") ||
    message.startsWith("Plugin is not active") ||
    message.startsWith("Capability ") ||
    message.startsWith("Invalid payload limit") ||
    message.startsWith("Invalid payload limits") ||
    message.startsWith("Invalid allowed actor principals") ||
    message.startsWith("No capability mapping for runtime action:")
  );
}
