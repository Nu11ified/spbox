import { describe, expect, it } from "vitest";
import { FakeSpacetimeClient, SpacetimeRuntimeAdapter } from "../src/spacetime/adapter.js";

describe("SpacetimeRuntimeAdapter", () => {
  it("subscribes to runtime tables and maintains a local cache", async () => {
    const client = new FakeSpacetimeClient({
      runtime_config: [
        {
          id: "config-1",
          serverId: "server-1",
          namespace: "economy",
          key: "enabled",
          value: true,
          version: 1,
          updatedAt: new Date("2026-05-18T12:00:00.000Z")
        }
      ],
      plugins: [
        {
          id: "economy_core",
          name: "Economy Core",
          version: "1.0.0",
          status: "active",
          installedAt: new Date("2026-05-18T12:00:00.000Z"),
          updatedAt: new Date("2026-05-18T12:00:00.000Z")
        }
      ]
    });
    const adapter = new SpacetimeRuntimeAdapter(client);

    await adapter.connectAndSubscribe("server-1");

    expect(adapter.cache.getConfig("economy", "enabled")?.value).toBe(true);
    expect(adapter.cache.getPlugin("economy_core")?.status).toBe("active");

    client.emitUpdate("runtime_config", {
      id: "config-1",
      serverId: "server-1",
      namespace: "economy",
      key: "enabled",
      value: false,
      version: 2,
      updatedAt: new Date("2026-05-18T12:01:00.000Z")
    });

    expect(adapter.cache.getConfig("economy", "enabled")?.value).toBe(false);
    expect(client.subscribedTables).toContain("runtime_config");
    expect(client.subscribedTables).toContain("plugins");
    expect(client.subscribedTables).toContain("plugin_deployments");
    expect(client.subscribedTables).toContain("accounts");
  });

  it("calls reducer-shaped client methods for registration, heartbeat, config, and actions", async () => {
    const client = new FakeSpacetimeClient({});
    const adapter = new SpacetimeRuntimeAdapter(client);

    await adapter.registerServer({
      id: "server-1",
      name: "Roleplay Dev",
      environment: "development",
      publicKey: "public-key"
    });
    await adapter.heartbeat({
      serverId: "server-1",
      resourceVersion: "0.1.0",
      fxserverBuild: "12345",
      gameBuild: "3095"
    });
    await adapter.setRuntimeConfig({
      serverId: "server-1",
      namespace: "economy",
      key: "enabled",
      value: true
    });
    await adapter.submitAction({
      serverId: "server-1",
      actorId: "player:1",
      actionType: "vehicle.repair",
      payload: { netId: 10 },
      nonce: "nonce-1",
      idempotencyKey: "repair-10"
    });
    await adapter.completeAction({
      actionId: "action-1",
      status: "completed"
    });
    await adapter.writeAuditLog({
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
      status: "succeeded"
    });

    expect(client.reducerCalls.map((call) => call.name)).toEqual([
      "register_server",
      "heartbeat",
      "set_runtime_config",
      "submit_action",
      "complete_action",
      "write_audit_log"
    ]);
  });

  it("keeps runtime config cache scoped to the connected server", async () => {
    const client = new FakeSpacetimeClient({
      runtime_config: [
        {
          id: "config-1",
          serverId: "server-1",
          namespace: "economy",
          key: "enabled",
          value: true,
          version: 1,
          updatedAt: new Date("2026-05-18T12:00:00.000Z")
        },
        {
          id: "config-2",
          serverId: "server-2",
          namespace: "economy",
          key: "enabled",
          value: false,
          version: 1,
          updatedAt: new Date("2026-05-18T12:00:00.000Z")
        }
      ]
    });
    const adapter = new SpacetimeRuntimeAdapter(client);

    await adapter.connectAndSubscribe("server-1");
    client.emitUpdate("runtime_config", {
      id: "config-2",
      serverId: "server-2",
      namespace: "economy",
      key: "enabled",
      value: false,
      version: 2,
      updatedAt: new Date("2026-05-18T12:01:00.000Z")
    });

    expect(adapter.cache.getConfig("economy", "enabled")?.serverId).toBe("server-1");
    expect(adapter.cache.getConfig("economy", "enabled")?.value).toBe(true);
  });
});
