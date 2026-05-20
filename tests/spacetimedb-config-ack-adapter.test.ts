import { describe, expect, it } from "vitest";
import { FakeSpacetimeClient, SpacetimeRuntimeAdapter } from "../src/spacetime/adapter.js";

describe("SpacetimeRuntimeAdapter config acknowledgement reducer", () => {
  it("subscribes to config acknowledgement rows", async () => {
    const client = new FakeSpacetimeClient({
      runtime_config_acks: [
        {
          serverId: "server-1",
          namespace: "economy",
          key: "enabled",
          version: 2,
          acknowledgedAt: new Date("2026-05-18T12:00:00.000Z")
        },
        {
          serverId: "server-2",
          namespace: "economy",
          key: "enabled",
          version: 9,
          acknowledgedAt: new Date("2026-05-18T12:00:00.000Z")
        }
      ]
    });
    const adapter = new SpacetimeRuntimeAdapter(client);

    await adapter.connectAndSubscribe("server-1");

    expect(client.subscribedTables).toContain("runtime_config_acks");
    expect(adapter.cache.getConfigAck("economy", "enabled")?.version).toBe(2);

    client.emitUpdate("runtime_config_acks", {
      serverId: "server-2",
      namespace: "economy",
      key: "enabled",
      version: 10,
      acknowledgedAt: new Date("2026-05-18T12:01:00.000Z")
    });
    client.emitUpdate("runtime_config_acks", {
      serverId: "server-1",
      namespace: "economy",
      key: "enabled",
      version: 3,
      acknowledgedAt: new Date("2026-05-18T12:02:00.000Z")
    });

    expect(adapter.cache.getConfigAck("economy", "enabled")?.version).toBe(3);
  });

  it("calls ack_config_version with server, config key, and version", async () => {
    const client = new FakeSpacetimeClient({});
    const adapter = new SpacetimeRuntimeAdapter(client);

    await adapter.ackConfigVersion({
      serverId: "server-1",
      namespace: "economy",
      key: "enabled",
      version: 2
    });

    expect(client.reducerCalls).toEqual([
      {
        name: "ack_config_version",
        args: {
          serverId: "server-1",
          namespace: "economy",
          key: "enabled",
          version: 2
        }
      }
    ]);
  });
});
