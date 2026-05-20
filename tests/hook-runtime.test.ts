import { describe, expect, it } from "vitest";
import { HookRuntime } from "../src/core/hooks.js";

describe("HookRuntime", () => {
  it("dispatches enabled hooks in priority order with audit entries", async () => {
    const calls: string[] = [];
    const runtime = new HookRuntime({
      capabilities: new Map([
        ["plugin:a", new Set(["vehicle.inspect"])],
        ["plugin:b", new Set(["vehicle.inspect"])]
      ]),
      now: () => new Date("2026-05-18T12:00:00.000Z"),
      idFactory: () => `audit-${calls.length + 1}`
    });

    runtime.registerHook({
      id: "hook-b",
      pluginId: "plugin:b",
      hookName: "on_vehicle_damaged",
      capability: "vehicle.inspect",
      priority: 20,
      enabled: true,
      payloadSchema: {
        type: "object",
        required: ["vehicleNetId"],
        properties: { vehicleNetId: { type: "number" } }
      },
      handler: async (payload) => {
        calls.push(`b:${(payload as { vehicleNetId: number }).vehicleNetId}`);
        return { plugin: "b" };
      }
    });
    runtime.registerHook({
      id: "hook-a",
      pluginId: "plugin:a",
      hookName: "on_vehicle_damaged",
      capability: "vehicle.inspect",
      priority: 10,
      enabled: true,
      handler: async () => {
        calls.push("a");
        return { plugin: "a" };
      }
    });

    const result = await runtime.dispatch("on_vehicle_damaged", { vehicleNetId: 44 });

    expect(calls).toEqual(["a", "b:44"]);
    expect(result.results).toEqual([
      { hookId: "hook-a", pluginId: "plugin:a", result: { plugin: "a" } },
      { hookId: "hook-b", pluginId: "plugin:b", result: { plugin: "b" } }
    ]);
    expect(result.audit).toEqual([
      expect.objectContaining({ pluginId: "plugin:a", actionType: "hook.on_vehicle_damaged" }),
      expect.objectContaining({ pluginId: "plugin:b", actionType: "hook.on_vehicle_damaged" })
    ]);
  });

  it("rejects hooks without required capabilities", () => {
    const runtime = new HookRuntime({
      capabilities: new Map([["plugin:a", new Set(["vehicle.inspect"])]])
    });

    expect(() =>
      runtime.registerHook({
        id: "hook-b",
        pluginId: "plugin:b",
        hookName: "on_vehicle_damaged",
        capability: "vehicle.inspect",
        priority: 0,
        enabled: true,
        handler: async () => ({ ok: true })
      })
    ).toThrow("Plugin plugin:b lacks hook capability: vehicle.inspect");
  });

  it("records failed hook audits for payload schema mismatches and continues dispatch", async () => {
    const calls: string[] = [];
    let nextAudit = 0;
    const runtime = new HookRuntime({
      capabilities: new Map([
        ["plugin:a", new Set(["vehicle.inspect"])],
        ["plugin:b", new Set(["vehicle.inspect"])]
      ]),
      now: () => new Date("2026-05-18T12:00:00.000Z"),
      idFactory: () => `audit-${++nextAudit}`
    });
    runtime.registerHook({
      id: "hook-a",
      pluginId: "plugin:a",
      hookName: "on_vehicle_damaged",
      capability: "vehicle.inspect",
      priority: 0,
      enabled: true,
      payloadSchema: {
        type: "object",
        required: ["vehicleNetId"],
        properties: { vehicleNetId: { type: "number" } }
      },
      handler: async () => {
        calls.push("a");
        return { ok: true };
      }
    });
    runtime.registerHook({
      id: "hook-b",
      pluginId: "plugin:b",
      hookName: "on_vehicle_damaged",
      capability: "vehicle.inspect",
      priority: 10,
      enabled: true,
      handler: async () => {
        calls.push("b");
        return { ok: true };
      }
    });

    const result = await runtime.dispatch("on_vehicle_damaged", { vehicleNetId: "bad" });

    expect(calls).toEqual(["b"]);
    expect(result.results).toEqual([
      {
        hookId: "hook-a",
        pluginId: "plugin:a",
        error: "Expected vehicleNetId to be number"
      },
      {
        hookId: "hook-b",
        pluginId: "plugin:b",
        result: { ok: true }
      }
    ]);
    expect(result.audit).toEqual([
      expect.objectContaining({
        id: "audit-1",
        pluginId: "plugin:a",
        targetId: "hook-a",
        status: "failed",
        after: { error: "Expected vehicleNetId to be number" }
      }),
      expect.objectContaining({
        id: "audit-2",
        pluginId: "plugin:b",
        targetId: "hook-b",
        status: "succeeded"
      })
    ]);
  });

  it("records failed hook audits and continues dispatching remaining hooks", async () => {
    const calls: string[] = [];
    let nextAudit = 0;
    const runtime = new HookRuntime({
      capabilities: new Map([
        ["plugin:a", new Set(["vehicle.inspect"])],
        ["plugin:b", new Set(["vehicle.inspect"])],
        ["plugin:c", new Set(["vehicle.inspect"])]
      ]),
      now: () => new Date("2026-05-18T12:00:00.000Z"),
      idFactory: () => `audit-${++nextAudit}`
    });

    runtime.registerHook({
      id: "hook-a",
      pluginId: "plugin:a",
      hookName: "on_vehicle_damaged",
      capability: "vehicle.inspect",
      priority: 10,
      enabled: true,
      handler: async () => {
        calls.push("a");
        return { plugin: "a" };
      }
    });
    runtime.registerHook({
      id: "hook-b",
      pluginId: "plugin:b",
      hookName: "on_vehicle_damaged",
      capability: "vehicle.inspect",
      priority: 20,
      enabled: true,
      handler: async () => {
        calls.push("b");
        throw new Error("sidecar handler crashed");
      }
    });
    runtime.registerHook({
      id: "hook-c",
      pluginId: "plugin:c",
      hookName: "on_vehicle_damaged",
      capability: "vehicle.inspect",
      priority: 30,
      enabled: true,
      handler: async () => {
        calls.push("c");
        return { plugin: "c" };
      }
    });

    const result = await runtime.dispatch("on_vehicle_damaged", { vehicleNetId: 44 });

    expect(calls).toEqual(["a", "b", "c"]);
    expect(result.results).toEqual([
      { hookId: "hook-a", pluginId: "plugin:a", result: { plugin: "a" } },
      {
        hookId: "hook-b",
        pluginId: "plugin:b",
        error: "sidecar handler crashed"
      },
      { hookId: "hook-c", pluginId: "plugin:c", result: { plugin: "c" } }
    ]);
    expect(result.audit).toEqual([
      expect.objectContaining({
        id: "audit-1",
        pluginId: "plugin:a",
        targetId: "hook-a",
        status: "succeeded"
      }),
      expect.objectContaining({
        id: "audit-2",
        pluginId: "plugin:b",
        targetId: "hook-b",
        status: "failed",
        after: { error: "sidecar handler crashed" }
      }),
      expect.objectContaining({
        id: "audit-3",
        pluginId: "plugin:c",
        targetId: "hook-c",
        status: "succeeded"
      })
    ]);
  });
});
