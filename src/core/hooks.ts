import { type AuditLogEntry } from "./audit.js";
import { validateSchema, type SimpleJsonSchema } from "./plugin-data.js";

export type HookHandler = (payload: unknown) => Promise<unknown> | unknown;

export interface HookRegistration {
  id: string;
  pluginId: string;
  hookName: string;
  capability: string;
  priority: number;
  enabled: boolean;
  payloadSchema?: SimpleJsonSchema;
  handler: HookHandler;
}

export interface HookDispatchResult {
  results: Array<{
    hookId: string;
    pluginId: string;
    result?: unknown;
    error?: string;
  }>;
  audit: AuditLogEntry[];
}

export interface HookRuntimeOptions {
  capabilities: Map<string, Set<string>>;
  now?: () => Date;
  idFactory?: () => string;
}

export class HookRuntime {
  private readonly hooksByName = new Map<string, HookRegistration[]>();
  private readonly capabilities: Map<string, Set<string>>;
  private readonly now: () => Date;
  private readonly idFactory: () => string;

  public constructor(options: HookRuntimeOptions) {
    this.capabilities = options.capabilities;
    this.now = options.now ?? (() => new Date());
    this.idFactory = options.idFactory ?? (() => crypto.randomUUID());
  }

  public registerHook(hook: HookRegistration): void {
    if (!this.capabilities.get(hook.pluginId)?.has(hook.capability)) {
      throw new Error(`Plugin ${hook.pluginId} lacks hook capability: ${hook.capability}`);
    }

    const hooks = this.hooksByName.get(hook.hookName) ?? [];
    hooks.push(hook);
    hooks.sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
    this.hooksByName.set(hook.hookName, hooks);
  }

  public async dispatch(hookName: string, payload: unknown): Promise<HookDispatchResult> {
    const hooks = (this.hooksByName.get(hookName) ?? []).filter((hook) => hook.enabled);
    const results: HookDispatchResult["results"] = [];
    const audit: AuditLogEntry[] = [];

    for (const hook of hooks) {
      try {
        if (hook.payloadSchema) {
          validateSchema(hook.payloadSchema, payload);
        }
        const result = await hook.handler(payload);
        results.push({
          hookId: hook.id,
          pluginId: hook.pluginId,
          result
        });
        audit.push(this.createAudit(hook, hookName, "succeeded"));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Hook handler failed";
        results.push({
          hookId: hook.id,
          pluginId: hook.pluginId,
          error: message
        });
        audit.push(this.createAudit(hook, hookName, "failed", { error: message }));
      }
    }

    return { results, audit };
  }

  private createAudit(
    hook: HookRegistration,
    hookName: string,
    status: AuditLogEntry["status"],
    after?: unknown
  ): AuditLogEntry {
    return {
      id: this.idFactory(),
      actorId: hook.pluginId,
      pluginId: hook.pluginId,
      actionType: `hook.${hookName}`,
      permissionKey: hook.capability,
      targetType: "hook",
      targetId: hook.id,
      status,
      after,
      createdAt: this.now()
    };
  }
}
