import { describe, expect, it } from "vitest";
import { hashPayload } from "../src/core/actions.js";
import {
  RuntimeControlPlane,
  signHeartbeat,
  verifyHeartbeatSignature
} from "../src/core/runtime.js";

const now = new Date("2026-05-18T12:00:00.000Z");

describe("RuntimeControlPlane", () => {
  it("registers a server and records heartbeat/runtime instance status", () => {
    const runtime = new RuntimeControlPlane({
      now: () => now,
      idFactory: () => "runtime-1"
    });

    const server = runtime.registerServer({
      id: "server-1",
      name: "Roleplay Dev",
      environment: "development",
      publicKey: "public-key"
    });
    const instance = runtime.heartbeat({
      serverId: "server-1",
      resourceVersion: "0.1.0",
      fxserverBuild: "12345",
      gameBuild: "3095"
    });

    expect(server).toEqual({
      id: "server-1",
      name: "Roleplay Dev",
      environment: "development",
      publicKey: "public-key",
      status: "online",
      lastHeartbeatAt: now
    });
    expect(instance).toEqual({
      id: "runtime-1",
      serverId: "server-1",
      resourceVersion: "0.1.0",
      fxserverBuild: "12345",
      gameBuild: "3095",
      status: "online",
      startedAt: now,
      lastSeenAt: now
    });
    expect(runtime.getHealth("server-1")).toEqual({
      serverId: "server-1",
      serverName: "Roleplay Dev",
      environment: "development",
      status: "online",
      reason: "runtime heartbeat current",
      resourceVersion: "0.1.0",
      fxserverBuild: "12345",
      gameBuild: "3095",
      lastHeartbeatAt: now,
      lastSeenAt: now
    });
  });

  it("marks runtime health offline when heartbeat is stale", () => {
    let currentTime = now;
    const runtime = new RuntimeControlPlane({
      now: () => currentTime,
      idFactory: () => "runtime-1"
    });
    runtime.registerServer({
      id: "server-1",
      name: "Roleplay Dev",
      environment: "development",
      publicKey: "public-key"
    });
    runtime.heartbeat({
      serverId: "server-1",
      resourceVersion: "0.1.0",
      fxserverBuild: "12345",
      gameBuild: "3095"
    });

    currentTime = new Date("2026-05-18T12:01:00.000Z");

    expect(runtime.getHealth("server-1", 30_000)).toEqual(expect.objectContaining({
      serverId: "server-1",
      status: "offline",
      reason: "runtime heartbeat stale",
      lastSeenAt: now
    }));
  });

  it("verifies signed runtime heartbeats and rejects nonce replay", () => {
    const secret = "server-secret";
    const runtime = new RuntimeControlPlane({
      now: () => now,
      idFactory: () => "runtime-1",
      heartbeatSignatureVerifier: (server, heartbeat) =>
        verifyHeartbeatSignature(server, heartbeat, secret)
    });
    const server = runtime.registerServer({
      id: "server-1",
      name: "Roleplay Dev",
      environment: "development",
      publicKey: "server-public-key"
    });
    const heartbeatInput = {
      serverId: "server-1",
      resourceVersion: "0.1.0",
      fxserverBuild: "12345",
      gameBuild: "3095",
      nonce: "heartbeat-1"
    };

    const heartbeat = runtime.heartbeat({
      ...heartbeatInput,
      signature: signHeartbeat(heartbeatInput, secret)
    });

    expect(heartbeat.status).toBe("online");
    expect(verifyHeartbeatSignature(
      server,
      { ...heartbeatInput, signature: signHeartbeat(heartbeatInput, secret) },
      secret
    )).toBe(true);
    expect(() => runtime.heartbeat({
      ...heartbeatInput,
      signature: signHeartbeat(heartbeatInput, secret)
    })).toThrow("Heartbeat nonce replay");
    expect(() => runtime.heartbeat({
      ...heartbeatInput,
      nonce: "heartbeat-2",
      signature: "bad"
    })).toThrow("Invalid heartbeat signature");
  });

  it("versions runtime config and exposes updates for a server subscription", () => {
    const runtime = new RuntimeControlPlane({
      now: () => now,
      idFactory: () => "id"
    });
    runtime.registerServer({
      id: "server-1",
      name: "Roleplay Dev",
      environment: "development",
      publicKey: "public-key"
    });

    const first = runtime.setRuntimeConfig({
      serverId: "server-1",
      namespace: "economy",
      key: "enabled",
      value: true
    });
    const second = runtime.setRuntimeConfig({
      serverId: "server-1",
      namespace: "economy",
      key: "enabled",
      value: false
    });

    expect(first.version).toBe(1);
    expect(second.version).toBe(2);
    expect(runtime.getRuntimeConfig("server-1", "economy", "enabled")).toEqual(second);
    expect(runtime.getConfigSnapshot("server-1")).toEqual([second]);

    const ack = runtime.ackConfigVersion({
      serverId: "server-1",
      namespace: "economy",
      key: "enabled",
      version: second.version
    });

    expect(ack).toEqual({
      serverId: "server-1",
      namespace: "economy",
      key: "enabled",
      version: 2,
      acknowledgedAt: now
    });
    expect(runtime.getConfigAck("server-1", "economy", "enabled")).toEqual(ack);
  });

  it("rejects config acknowledgements for unknown or stale config versions", () => {
    const runtime = new RuntimeControlPlane({
      now: () => now,
      idFactory: () => "id"
    });
    runtime.registerServer({
      id: "server-1",
      name: "Roleplay Dev",
      environment: "development",
      publicKey: "public-key"
    });
    runtime.setRuntimeConfig({
      serverId: "server-1",
      namespace: "economy",
      key: "enabled",
      value: true
    });

    expect(() =>
      runtime.ackConfigVersion({
        serverId: "server-1",
        namespace: "economy",
        key: "enabled",
        version: 2
      })
    ).toThrow("Cannot acknowledge config version 2; current version is 1");
    expect(() =>
      runtime.ackConfigVersion({
        serverId: "server-1",
        namespace: "missing",
        key: "enabled",
        version: 1
      })
    ).toThrow("Unknown config: server-1:missing:enabled");
  });

  it("submits actions idempotently and records completion audit", () => {
    let nextId = 0;
    const runtime = new RuntimeControlPlane({
      now: () => now,
      idFactory: () => `id-${++nextId}`
    });
    runtime.registerServer({
      id: "server-1",
      name: "Roleplay Dev",
      environment: "development",
      publicKey: "public-key"
    });

    const action = runtime.submitAction({
      serverId: "server-1",
      actorId: "player:1",
      actionType: "vehicle.repair",
      payload: { netId: 10 },
      nonce: "nonce-1",
      idempotencyKey: "repair-10"
    });
    const duplicate = runtime.submitAction({
      serverId: "server-1",
      actorId: "player:1",
      actionType: "vehicle.repair",
      payload: { netId: 10 },
      nonce: "nonce-2",
      idempotencyKey: "repair-10"
    });

    expect(duplicate).toBe(action);

    const completed = runtime.completeAction({
      actionId: action.id,
      status: "completed",
      pluginId: "admin_tools",
      permissionKey: "menu.vehicle.repair",
      targetType: "vehicle",
      targetId: "net:10",
      before: { repaired: false },
      after: { repaired: true }
    });

    expect(completed.status).toBe("completed");
    expect(runtime.getAction(action.id)).toEqual(expect.objectContaining({
      id: action.id,
      status: "completed",
      completedAt: now
    }));
    expect(runtime.submitAction({
      serverId: "server-1",
      actorId: "player:1",
      actionType: "vehicle.repair",
      payload: { netId: 10 },
      nonce: "nonce-3",
      idempotencyKey: "repair-10"
    })).toEqual(expect.objectContaining({
      id: action.id,
      status: "completed",
      completedAt: now
    }));
    expect(runtime.getAuditLogs("server-1")).toEqual([
      expect.objectContaining({
        actorId: "player:1",
        pluginId: "admin_tools",
        actionType: "vehicle.repair",
        permissionKey: "menu.vehicle.repair",
        targetId: "net:10",
        status: "succeeded"
      })
    ]);
  });

  it("treats local runtime action completion as terminal", () => {
    let nextId = 0;
    const runtime = new RuntimeControlPlane({
      now: () => now,
      idFactory: () => `id-${++nextId}`
    });
    runtime.registerServer({
      id: "server-1",
      name: "Roleplay Dev",
      environment: "development",
      publicKey: "public-key"
    });
    const action = runtime.submitAction({
      serverId: "server-1",
      actorId: "player:1",
      actionType: "vehicle.repair",
      payload: { netId: 10 },
      nonce: "nonce-1",
      idempotencyKey: "repair-10"
    });

    runtime.completeAction({
      actionId: action.id,
      status: "completed",
      after: { repaired: true }
    });

    expect(() =>
      runtime.completeAction({
        actionId: action.id,
        status: "failed",
        after: { error: "late failure" }
      })
    ).toThrow("Action is already completed");
    expect(runtime.getAction(action.id)).toEqual(expect.objectContaining({
      status: "completed",
      completedAt: now
    }));
    expect(runtime.getAuditLogs("server-1")).toHaveLength(1);
  });

  it("rejects invalid direct audit status writes", () => {
    const runtime = new RuntimeControlPlane({
      now: () => now,
      idFactory: () => "audit-1"
    });
    runtime.registerServer({
      id: "server-1",
      name: "Roleplay Dev",
      environment: "development",
      publicKey: "public-key"
    });

    expect(() =>
      runtime.writeAuditLog({
        serverId: "server-1",
        actorId: "player:1",
        actionType: "vehicle.repair",
        status: "corrupt" as never
      })
    ).toThrow("Invalid audit status: corrupt");
    expect(runtime.getAuditLogs("server-1")).toEqual([]);
  });

  it("requires valid signed action envelopes when a verifier is configured", () => {
    let nextId = 0;
    const runtime = new RuntimeControlPlane({
      now: () => now,
      idFactory: () => `id-${++nextId}`,
      actionSignatureVerifier: (envelope) => envelope.signature === `signed:${envelope.payloadHash}:${envelope.nonce}`
    });
    runtime.registerServer({
      id: "server-1",
      name: "Roleplay Dev",
      environment: "development",
      publicKey: "public-key"
    });

    const action = runtime.submitAction({
      serverId: "server-1",
      actorId: "player:1",
      actionType: "vehicle.repair",
      payload: { netId: 10 },
      nonce: "nonce-1",
      idempotencyKey: "repair-10",
      signature: `signed:${hashPayload({ netId: 10 })}:nonce-1`
    });

    expect(action.signature).toBe(`signed:${action.payloadHash}:nonce-1`);
    expect(() =>
      runtime.submitAction({
        serverId: "server-1",
        actorId: "player:1",
        actionType: "vehicle.repair",
        payload: { netId: 10 },
        nonce: "nonce-2",
        idempotencyKey: "repair-11",
        signature: "bad"
      })
    ).toThrow("Invalid action signature");
  });
});
