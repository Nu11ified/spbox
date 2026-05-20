import { describe, expect, it } from "vitest";
import { FakeSpacetimeClient, SpacetimeRuntimeAdapter } from "../src/spacetime/adapter.js";

describe("SpacetimeRuntimeAdapter sandbox event reducers", () => {
  it("caches sandbox events for the connected server", async () => {
    const client = new FakeSpacetimeClient({
      plugin_sandbox_events: [
        {
          id: "event-2",
          pluginId: "mechanic_core",
          serverId: "server-1",
          eventType: "sidecar.heartbeat",
          payloadHash: "payload-hash-2",
          status: "succeeded",
          createdAt: new Date("2026-05-18T12:01:00.000Z")
        },
        {
          id: "event-1",
          pluginId: "mechanic_core",
          serverId: "server-1",
          eventType: "sidecar.started",
          payloadHash: "payload-hash-1",
          status: "succeeded",
          createdAt: new Date("2026-05-18T12:00:00.000Z")
        },
        {
          id: "event-other-server",
          pluginId: "mechanic_core",
          serverId: "server-2",
          eventType: "sidecar.failed",
          payloadHash: "payload-hash-3",
          status: "failed",
          createdAt: new Date("2026-05-18T12:02:00.000Z")
        }
      ]
    });
    const adapter = new SpacetimeRuntimeAdapter(client);

    await adapter.connectAndSubscribe("server-1");

    expect(client.subscribedTables).toContain("plugin_sandbox_events");
    expect(adapter.cache.getPluginSandboxEvent("event-1")).toEqual(
      expect.objectContaining({
        pluginId: "mechanic_core",
        eventType: "sidecar.started"
      })
    );
    expect(adapter.cache.getPluginSandboxEvent("event-other-server")).toBeUndefined();
    expect(adapter.cache.getPluginSandboxEventsForPlugin("mechanic_core").map((event) => event.id)).toEqual([
      "event-1",
      "event-2"
    ]);

    client.emitUpdate("plugin_sandbox_events", {
      id: "event-3",
      pluginId: "mechanic_core",
      serverId: "server-1",
      eventType: "sidecar.failed",
      payloadHash: "payload-hash-4",
      status: "failed",
      createdAt: new Date("2026-05-18T12:03:00.000Z")
    });

    expect(adapter.cache.getPluginSandboxEventsForPlugin("mechanic_core").map((event) => event.status)).toEqual([
      "succeeded",
      "succeeded",
      "failed"
    ]);
  });

  it("records sandbox events through SpacetimeDB reducers", async () => {
    const client = new FakeSpacetimeClient({});
    const adapter = new SpacetimeRuntimeAdapter(client);

    await adapter.recordPluginSandboxEvent({
      id: "event-1",
      pluginId: "mechanic_core",
      serverId: "server-1",
      eventType: "sidecar.started",
      payloadHash: "payload-hash",
      status: "succeeded"
    });

    expect(client.reducerCalls).toEqual([
      {
        name: "record_plugin_sandbox_event",
        args: {
          id: "event-1",
          pluginId: "mechanic_core",
          serverId: "server-1",
          eventType: "sidecar.started",
          payloadHash: "payload-hash",
          status: "succeeded"
        }
      }
    ]);
  });
});
