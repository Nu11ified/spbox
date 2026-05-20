import { describe, expect, it } from "vitest";
import { FakeSpacetimeClient, SpacetimeRuntimeAdapter } from "../src/spacetime/adapter.js";

describe("SpacetimeRuntimeAdapter runtime state cache", () => {
  it("caches servers, runtime instances, and server-scoped audit logs", async () => {
    const client = new FakeSpacetimeClient({
      servers: [
        {
          id: "server-1",
          name: "Roleplay Dev",
          environment: "development",
          publicKey: "public-key",
          status: "online",
          lastHeartbeatAt: new Date("2026-05-18T12:00:00.000Z")
        }
      ],
      runtime_instances: [
        {
          id: "runtime-1",
          serverId: "server-1",
          resourceVersion: "0.1.0",
          fxserverBuild: "12345",
          gameBuild: "3095",
          status: "online",
          startedAt: new Date("2026-05-18T12:00:00.000Z"),
          lastSeenAt: new Date("2026-05-18T12:01:00.000Z")
        },
        {
          id: "runtime-2",
          serverId: "server-2",
          resourceVersion: "0.1.0",
          fxserverBuild: "12345",
          gameBuild: "3095",
          status: "online",
          startedAt: new Date("2026-05-18T12:00:00.000Z"),
          lastSeenAt: new Date("2026-05-18T12:01:00.000Z")
        }
      ],
      audit_logs: [
        {
          id: "audit-2",
          serverId: "server-1",
          actorId: "player:2",
          pluginId: "admin_tools",
          actionType: "vehicle.spawn",
          permissionKey: "admin.vehicles.spawn",
          targetType: "vehicle",
          targetId: "sultan",
          beforeJson: "{}",
          afterJson: "{\"spawned\":true}",
          status: "completed",
          createdAt: new Date("2026-05-18T12:02:00.000Z")
        },
        {
          id: "audit-1",
          serverId: "server-1",
          actorId: "player:1",
          pluginId: "admin_tools",
          actionType: "vehicle.repair",
          permissionKey: "admin.vehicles.repair",
          targetType: "vehicle",
          targetId: "net:10",
          beforeJson: "{}",
          afterJson: "{\"repaired\":true}",
          status: "completed",
          createdAt: new Date("2026-05-18T12:01:00.000Z")
        },
        {
          id: "audit-other-server",
          serverId: "server-2",
          actorId: "player:3",
          pluginId: "admin_tools",
          actionType: "vehicle.repair",
          permissionKey: "admin.vehicles.repair",
          targetType: "vehicle",
          targetId: "net:11",
          beforeJson: "{}",
          afterJson: "{}",
          status: "completed",
          createdAt: new Date("2026-05-18T12:03:00.000Z")
        }
      ]
    });
    const adapter = new SpacetimeRuntimeAdapter(client);

    await adapter.connectAndSubscribe("server-1");

    expect(client.subscribedTables).toContain("servers");
    expect(client.subscribedTables).toContain("runtime_instances");
    expect(client.subscribedTables).toContain("audit_logs");
    expect(adapter.cache.getServer("server-1")?.name).toBe("Roleplay Dev");
    expect(adapter.cache.getRuntimeInstance("runtime-1")?.serverId).toBe("server-1");
    expect(adapter.cache.getRuntimeInstance("runtime-2")).toBeUndefined();
    expect(adapter.cache.getAuditLogs().map((row) => row.id)).toEqual(["audit-1", "audit-2"]);
    expect(adapter.cache.getAuditLogs({ actorId: "player:2" }).map((row) => row.id)).toEqual(["audit-2"]);

    client.emitUpdate("runtime_instances", {
      id: "runtime-1",
      serverId: "server-1",
      resourceVersion: "0.1.1",
      fxserverBuild: "12345",
      gameBuild: "3095",
      status: "online",
      startedAt: new Date("2026-05-18T12:00:00.000Z"),
      lastSeenAt: new Date("2026-05-18T12:04:00.000Z")
    });

    expect(adapter.cache.getRuntimeInstance("runtime-1")?.resourceVersion).toBe("0.1.1");
  });
});
