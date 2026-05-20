import { type AuditLogEntry } from "./audit.js";
import { validateSchema, type SimpleJsonSchema } from "./plugin-data.js";
import { type PermissionEngine, type PermissionEvaluationContext } from "./permissions.js";

export interface RuntimeCommandDefinition {
  id: string;
  pluginId: string;
  name: string;
  aliases?: string[];
  actionId: string;
  requiredPermission?: string;
  payloadSchema?: unknown;
  auditLevel: "none" | "standard" | "high";
  enabled: boolean;
}

export interface RuntimeCommandRegistryOptions {
  commands: RuntimeCommandDefinition[];
  permissions: PermissionEngine;
  now?: () => Date;
}

export interface RuntimeCommandExecutionResult {
  command: RuntimeCommandDefinition;
  actionId: string;
  payload: unknown;
  audit?: AuditLogEntry;
}

export class RuntimeCommandRegistry {
  private readonly commandsByName = new Map<string, RuntimeCommandDefinition>();
  private permissions: PermissionEngine;
  private readonly now: () => Date;

  public constructor(options: RuntimeCommandRegistryOptions) {
    this.permissions = options.permissions;
    this.now = options.now ?? (() => new Date());

    for (const command of options.commands) {
      const name = normalizeRequiredCommandName(command.name, "Runtime command name");
      const aliases = (command.aliases ?? []).map((alias) =>
        normalizeRequiredCommandName(alias, "Runtime command alias")
      );
      if (!command.enabled) {
        continue;
      }

      this.registerCommandName(name, command);
      for (const alias of aliases) {
        this.registerCommandName(alias, command);
      }
    }
  }

  public updatePermissions(permissions: PermissionEngine): void {
    this.permissions = permissions;
  }

  public getCommand(commandName: string): RuntimeCommandDefinition | undefined {
    const command = this.commandsByName.get(normalizeCommandName(commandName));
    return command ? structuredClone(command) : undefined;
  }

  public executeCommand(
    principalId: string,
    commandName: string,
    payload: unknown,
    serverId?: string
  ): RuntimeCommandExecutionResult {
    const normalized = normalizeCommandName(commandName);
    const command = this.commandsByName.get(normalized);
    if (!command) {
      throw new Error(`Unknown or disabled command: ${commandName}`);
    }

    if (command.requiredPermission) {
      this.permissions.assertPermission(
        principalId,
        command.requiredPermission,
        permissionContextFromPayload(payload)
      );
    }

    if (command.payloadSchema) {
      validateSchema(command.payloadSchema as SimpleJsonSchema, payload);
    }

    return {
      command,
      actionId: command.actionId,
      payload,
      audit: this.createAudit(principalId, command, serverId)
    };
  }

  private createAudit(
    principalId: string,
    command: RuntimeCommandDefinition,
    serverId: string | undefined
  ): AuditLogEntry | undefined {
    if (command.auditLevel === "none") {
      return undefined;
    }

    return {
      id: `command:${command.id}:${this.now().getTime()}`,
      serverId,
      actorId: principalId,
      pluginId: command.pluginId,
      actionType: `command:${command.name}`,
      permissionKey: command.requiredPermission,
      status: "succeeded",
      createdAt: this.now()
    };
  }

  private registerCommandName(name: string, command: RuntimeCommandDefinition): void {
    if (this.commandsByName.has(name)) {
      throw new Error(`Duplicate runtime command name or alias: ${name}`);
    }

    this.commandsByName.set(name, command);
  }
}

function normalizeCommandName(commandName: string): string {
  return commandName.trim().toLowerCase();
}

function normalizeRequiredCommandName(commandName: string, label: string): string {
  const normalized = normalizeCommandName(commandName);
  if (normalized.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }

  return normalized;
}

function permissionContextFromPayload(payload: unknown): PermissionEvaluationContext {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {};
  }

  const record = payload as Record<string, unknown>;
  return {
    amount: typeof record.amount === "number" ? record.amount : undefined,
    currency: typeof record.currency === "string" ? record.currency : undefined,
    namespace: typeof record.namespace === "string" ? record.namespace : undefined,
    state: record.state && typeof record.state === "object" && !Array.isArray(record.state)
      ? record.state as Record<string, unknown>
      : undefined
  };
}
