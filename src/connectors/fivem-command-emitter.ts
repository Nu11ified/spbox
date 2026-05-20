import { type FiveMServerEventEmitter } from "./fivem-runtime.js";

export interface FiveMCommandExecutor {
  execute(command: string): Promise<void> | void;
}

export interface FiveMCommandEmitterOptions extends Partial<FiveMCommandExecutor> {
  executor?: FiveMCommandExecutor;
}

export class FiveMCommandEmitter implements FiveMServerEventEmitter {
  private readonly executor: FiveMCommandExecutor;

  public constructor(options: FiveMCommandEmitterOptions) {
    const executor = options.executor ?? (options.execute ? options as FiveMCommandExecutor : undefined);
    if (!executor) {
      throw new Error("FiveM command emitter requires a command executor");
    }
    this.executor = executor;
  }

  public async emitServerEvent(serverId: string, eventName: string, payload?: unknown): Promise<void> {
    requireNonEmptyString(serverId, "FiveM command emitter serverId");
    await this.executor.execute(formatFiveMRuntimeCommand(eventName, payload));
  }
}

export function formatFiveMRuntimeCommand(eventName: string, payload?: unknown): string {
  const normalizedEventName = requireNonEmptyString(eventName, "eventName");
  if (!normalizedEventName.startsWith("sdb_runtime:")) {
    throw new Error("eventName must be an sdb_runtime event");
  }
  if (/\s/.test(normalizedEventName)) {
    throw new Error("eventName must not contain whitespace");
  }

  return `sdb_runtime_emit ${stringifyRuntimeCommand({
    eventName: normalizedEventName,
    payload: payload ?? {}
  })}`;
}

function requireNonEmptyString(value: string, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value.trim();
}

function stringifyRuntimeCommand(command: { eventName: string; payload: unknown }): string {
  try {
    return JSON.stringify(command);
  } catch {
    throw new Error("payload must be JSON serializable");
  }
}
