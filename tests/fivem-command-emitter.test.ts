import { describe, expect, it } from "vitest";
import {
  FiveMCommandEmitter,
  formatFiveMRuntimeCommand
} from "../src/connectors/fivem-command-emitter.js";

describe("FiveM command emitter", () => {
  it("formats trusted runtime events as sdb_runtime_emit JSON commands", () => {
    expect(formatFiveMRuntimeCommand("sdb_runtime:syncConfig", {
      namespace: "features",
      values: { pvp: true }
    })).toBe(
      'sdb_runtime_emit {"eventName":"sdb_runtime:syncConfig","payload":{"namespace":"features","values":{"pvp":true}}}'
    );
  });

  it("executes formatted commands through the provided command transport", async () => {
    const commands: string[] = [];
    const emitter = new FiveMCommandEmitter({
      async execute(command) {
        commands.push(command);
      }
    });

    await emitter.emitServerEvent("server-1", "sdb_runtime:kickPlayer", {
      kick: {
        targetSource: "7",
        reason: "Rule violation"
      }
    });

    expect(commands).toEqual([
      'sdb_runtime_emit {"eventName":"sdb_runtime:kickPlayer","payload":{"kick":{"targetSource":"7","reason":"Rule violation"}}}'
    ]);
  });

  it("rejects empty event names before command execution", async () => {
    const commands: string[] = [];
    const emitter = new FiveMCommandEmitter({
      async execute(command) {
        commands.push(command);
      }
    });

    await expect(emitter.emitServerEvent("server-1", "", {}))
      .rejects.toThrow("eventName must be a non-empty string");
    expect(commands).toEqual([]);
  });

  it("rejects malformed runtime event names before command execution", async () => {
    const commands: string[] = [];
    const emitter = new FiveMCommandEmitter({
      async execute(command) {
        commands.push(command);
      }
    });

    await expect(emitter.emitServerEvent("server-1", " ", {}))
      .rejects.toThrow("eventName must be a non-empty string");
    await expect(emitter.emitServerEvent("server-1", "other:syncConfig", {}))
      .rejects.toThrow("eventName must be an sdb_runtime event");
    await expect(emitter.emitServerEvent("server-1", "sdb_runtime:sync Config", {}))
      .rejects.toThrow("eventName must not contain whitespace");
    expect(commands).toEqual([]);
  });

  it("rejects blank server ids before command execution", async () => {
    const commands: string[] = [];
    const emitter = new FiveMCommandEmitter({
      async execute(command) {
        commands.push(command);
      }
    });

    await expect(emitter.emitServerEvent(" ", "sdb_runtime:syncConfig", {}))
      .rejects.toThrow("FiveM command emitter serverId must be a non-empty string");
    expect(commands).toEqual([]);
  });

  it("rejects non-serializable runtime payloads before command execution", async () => {
    const commands: string[] = [];
    const emitter = new FiveMCommandEmitter({
      async execute(command) {
        commands.push(command);
      }
    });

    await expect(emitter.emitServerEvent("server-1", "sdb_runtime:syncConfig", { value: 1n }))
      .rejects.toThrow("payload must be JSON serializable");
    expect(commands).toEqual([]);
  });
});
