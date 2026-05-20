import { validateSchema, type SimpleJsonSchema } from "./plugin-data.js";
import { type PluginCapability, type PluginDeploymentManager } from "./plugin-deployment.js";
import { type RuntimeBridge, type RuntimeBridgeActionResult } from "../runtime/bridge.js";

export interface PluginActionBrokerOptions {
  deployments: PluginDeploymentManager;
  bridge: RuntimeBridge;
  actionCapabilities: Record<string, string>;
  payloadSchemas?: Record<string, SimpleJsonSchema>;
}

export interface PluginActionRequest {
  pluginId: string;
  actorPrincipalId: string;
  actionId: string;
  payload: unknown;
}

export class PluginActionBroker {
  private readonly deployments: PluginDeploymentManager;
  private readonly bridge: RuntimeBridge;
  private readonly actionCapabilities: Record<string, string>;
  private readonly payloadSchemas: Record<string, SimpleJsonSchema>;

  public constructor(options: PluginActionBrokerOptions) {
    this.deployments = options.deployments;
    this.bridge = options.bridge;
    this.actionCapabilities = validateActionCapabilities(options.actionCapabilities);
    this.payloadSchemas = validatePayloadSchemas(options.payloadSchemas ?? {});
  }

  public async requestAction(input: PluginActionRequest): Promise<RuntimeBridgeActionResult> {
    validateActionRequest(input);
    const capability = this.actionCapabilities[input.actionId];
    if (!capability) {
      const error = `No capability mapping for runtime action: ${input.actionId}`;
      this.auditDenied(input, undefined, error);
      throw new Error(error);
    }

    try {
      const grantedCapability = this.deployments.assertCapabilityForServer(
        input.pluginId,
        this.bridge.getServerId(),
        capability
      );
      const schema = this.payloadSchemas[input.actionId];
      if (schema) {
        validateSchema(schema, input.payload);
      }
      enforceCapabilityConstraints(grantedCapability, input.payload, input.actorPrincipalId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Plugin action denied";
      this.auditDenied(input, capability, message);
      throw error;
    }

    return this.bridge.callAction(input.actorPrincipalId, input.actionId, input.payload);
  }

  public recordHookAudit(input: {
    actorPrincipalId: string;
    pluginId: string;
    hookName: string;
    hookId: string;
    capability: string;
    status: "succeeded" | "failed" | "denied";
    after?: unknown;
  }): void {
    validateHookAudit(input);
    this.bridge.recordPluginHookAudit(input);
  }

  private auditDenied(input: PluginActionRequest, capability: string | undefined, error: string): void {
    this.bridge.recordDeniedAction({
      actorPrincipalId: input.actorPrincipalId,
      pluginId: input.pluginId,
      actionId: input.actionId,
      permissionKey: capability,
      error
    });
  }
}

function validateActionRequest(input: PluginActionRequest): void {
  if (isBlankString(input.pluginId)) {
    throw new Error("pluginId is required");
  }
  if (isBlankString(input.actorPrincipalId)) {
    throw new Error("actorPrincipalId is required");
  }
  if (isBlankString(input.actionId)) {
    throw new Error("actionId is required");
  }
}

function validateHookAudit(input: {
  actorPrincipalId: string;
  pluginId: string;
  hookName: string;
  hookId: string;
  capability: string;
  status: string;
}): void {
  if (isBlankString(input.actorPrincipalId)) {
    throw new Error("actorPrincipalId is required");
  }
  if (isBlankString(input.pluginId)) {
    throw new Error("pluginId is required");
  }
  if (isBlankString(input.hookName)) {
    throw new Error("hookName is required");
  }
  if (isBlankString(input.hookId)) {
    throw new Error("hookId is required");
  }
  if (isBlankString(input.capability)) {
    throw new Error("capability is required");
  }
  if (input.status !== "succeeded" && input.status !== "failed" && input.status !== "denied") {
    throw new Error("hook audit status must be succeeded, failed, or denied");
  }
}

function validateActionCapabilities(actionCapabilities: Record<string, string>): Record<string, string> {
  const validated: Record<string, string> = {};
  for (const [actionId, capability] of Object.entries(actionCapabilities)) {
    if (isBlankString(actionId)) {
      throw new Error("action capability mapping actionId is required");
    }
    if (isBlankString(capability)) {
      throw new Error("action capability mapping capability is required");
    }
    validated[actionId] = capability;
  }

  return validated;
}

function validatePayloadSchemas(payloadSchemas: Record<string, SimpleJsonSchema>): Record<string, SimpleJsonSchema> {
  const validated: Record<string, SimpleJsonSchema> = {};
  for (const [actionId, schema] of Object.entries(payloadSchemas)) {
    if (isBlankString(actionId)) {
      throw new Error("payload schema mapping actionId is required");
    }
    validated[actionId] = structuredClone(schema);
  }

  return validated;
}

function isBlankString(value: unknown): value is string {
  return typeof value !== "string" || value.trim().length === 0;
}

function enforceCapabilityConstraints(
  capability: PluginCapability,
  payload: unknown,
  actorPrincipalId: string
): void {
  const limits = readPayloadLimits(capability);
  const allowedActorPrincipals = readAllowedActorPrincipals(capability);
  if (limits.size === 0 && allowedActorPrincipals === undefined) {
    return;
  }

  if (allowedActorPrincipals && !allowedActorPrincipals.has(actorPrincipalId)) {
    throw new Error(`Capability ${capability.key} does not allow actor principal ${actorPrincipalId}`);
  }

  if (limits.size > 0 && (!payload || typeof payload !== "object" || Array.isArray(payload))) {
    throw new Error(`Capability ${capability.key} payload limits require an object payload`);
  }

  const record = payload as Record<string, unknown>;
  for (const [field, limit] of limits) {
    const value = record[field];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(`Capability ${capability.key} payload limit ${field} requires a number`);
    }
    if (value > limit) {
      throw new Error(`Capability ${capability.key} payload limit ${field} <= ${limit} exceeded`);
    }
  }
}

function readPayloadLimits(capability: PluginCapability): Map<string, number> {
  if (!capability.constraints || typeof capability.constraints !== "object" || Array.isArray(capability.constraints)) {
    return new Map();
  }

  const constraints = capability.constraints as Record<string, unknown>;
  const rawLimits = constraints.payloadLimits ?? constraints.payload_limits;
  if (rawLimits === undefined) {
    return new Map();
  }
  if (!rawLimits || typeof rawLimits !== "object" || Array.isArray(rawLimits)) {
    throw new Error(`Invalid payload limits for capability ${capability.key}`);
  }

  const limits = new Map<string, number>();
  for (const [field, limit] of Object.entries(rawLimits as Record<string, unknown>)) {
    const trimmedField = field.trim();
    if (trimmedField.length === 0 || field !== trimmedField) {
      throw new Error(`Invalid payload limit field for capability ${capability.key}`);
    }
    if (typeof limit !== "number" || !Number.isFinite(limit) || limit <= 0) {
      throw new Error(`Invalid payload limit ${field} for capability ${capability.key}`);
    }
    limits.set(field, limit);
  }

  return limits;
}

function readAllowedActorPrincipals(capability: PluginCapability): Set<string> | undefined {
  if (!capability.constraints || typeof capability.constraints !== "object" || Array.isArray(capability.constraints)) {
    return undefined;
  }

  const constraints = capability.constraints as Record<string, unknown>;
  const rawAllowed = constraints.allowedActorPrincipals ?? constraints.allowed_actor_principals;
  if (rawAllowed === undefined) {
    return undefined;
  }
  if (
    !Array.isArray(rawAllowed) ||
    rawAllowed.length === 0 ||
    rawAllowed.some((principal) => isBlankString(principal))
  ) {
    throw new Error(`Invalid allowed actor principals for capability ${capability.key}`);
  }

  return new Set(rawAllowed);
}
