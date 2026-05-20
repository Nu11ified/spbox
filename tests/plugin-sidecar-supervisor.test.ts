import { describe, expect, it } from "vitest";
import {
  PluginSidecarSupervisor,
  type PluginSandboxDriver
} from "../src/core/plugin-sidecar.js";
import {
  type PluginBundleRecord,
  type PluginDeploymentRecord
} from "../src/core/plugin-deployment.js";

const now = new Date("2026-05-18T12:00:00.000Z");

function bundle(overrides: Partial<PluginBundleRecord> = {}): PluginBundleRecord {
  return {
    id: "bundle-1",
    pluginId: "mechanic_core",
    version: "1.0.0",
    artifactUrl: "memory://mechanic_core.js",
    bundleHash: "hash",
    signature: "sig",
    signerId: "trusted-signer",
    runtimeType: "js_sidecar",
    capabilities: [{ key: "vehicle.repair" }],
    status: "registered",
    createdAt: now,
    ...overrides
  };
}

function deployment(overrides: Partial<PluginDeploymentRecord> = {}): PluginDeploymentRecord {
  return {
    id: "deployment-1",
    pluginId: "mechanic_core",
    bundleId: "bundle-1",
    serverId: "server-1",
    status: "active",
    desiredVersion: "1.0.0",
    activeVersion: "1.0.0",
    deployedAt: now,
    ...overrides
  };
}

function driver(): PluginSandboxDriver & { calls: string[] } {
  return {
    calls: [],
    async start(input) {
      this.calls.push(`start:${input.deployment.id}:${input.bundle.id}`);
      return { pid: 1234 };
    },
    async stop(instance) {
      this.calls.push(`stop:${instance.id}`);
    }
  };
}

describe("PluginSidecarSupervisor", () => {
  it("rejects non-positive timeout configuration", () => {
    expect(() =>
      new PluginSidecarSupervisor({
        driver: driver(),
        heartbeatTimeoutMs: 0
      })
    ).toThrow("heartbeatTimeoutMs must be a positive finite number");
    expect(() =>
      new PluginSidecarSupervisor({
        driver: driver(),
        hookDispatchTimeoutMs: -1
      })
    ).toThrow("hookDispatchTimeoutMs must be a positive finite number");
  });

  it("starts active sidecar deployments and records sandbox heartbeat events", async () => {
    const sandbox = driver();
    const supervisor = new PluginSidecarSupervisor({
      driver: sandbox,
      now: () => now,
      idFactory: () => "sidecar-1"
    });

    const instance = await supervisor.start(deployment(), bundle());
    supervisor.heartbeat(instance.id);

    expect(sandbox.calls).toEqual(["start:deployment-1:bundle-1"]);
    expect(supervisor.getInstance(instance.id)).toEqual({
      id: "sidecar-1",
      deploymentId: "deployment-1",
      pluginId: "mechanic_core",
      serverId: "server-1",
      bundleId: "bundle-1",
      runtimeType: "js_sidecar",
      status: "running",
      startedAt: now,
      lastHeartbeatAt: now,
      metadata: { pid: 1234 }
    });
    expect(supervisor.getSandboxEvents()).toEqual([
      expect.objectContaining({ eventType: "sidecar.started", status: "succeeded" }),
      expect.objectContaining({ eventType: "sidecar.heartbeat", status: "succeeded" })
    ]);
  });

  it("fails stale sidecars and stops killed deployments during reconciliation", async () => {
    let currentTime = new Date("2026-05-18T12:00:00.000Z");
    const sandbox = driver();
    const supervisor = new PluginSidecarSupervisor({
      driver: sandbox,
      now: () => currentTime,
      idFactory: () => "sidecar-1",
      heartbeatTimeoutMs: 30_000
    });
    const active = await supervisor.start(deployment(), bundle());

    currentTime = new Date("2026-05-18T12:01:00.000Z");
    const stale = await supervisor.failStaleInstances();
    await supervisor.reconcile([
      deployment({ status: "killed", errorMessage: "disabled" })
    ], new Map([["bundle-1", bundle()]]));

    expect(stale).toEqual([
      expect.objectContaining({ id: active.id, status: "failed", errorMessage: "heartbeat timeout" })
    ]);
    expect(sandbox.calls).toEqual([
      "start:deployment-1:bundle-1",
      "stop:sidecar-1"
    ]);
    expect(supervisor.getSandboxEvents().map((event) => event.eventType)).toEqual([
      "sidecar.started",
      "sidecar.failed",
      "sidecar.stopped"
    ]);
  });

  it("stops superseded active deployments during reconciliation and keeps the newest plugin/server sidecar", async () => {
    const sandbox = driver();
    const supervisor = new PluginSidecarSupervisor({
      driver: sandbox,
      now: () => now,
      idFactory: (() => {
        let nextId = 0;
        return () => `sidecar-${++nextId}`;
      })()
    });
    const firstDeployment = deployment({
      id: "deployment-1",
      bundleId: "bundle-1",
      desiredVersion: "1.0.0",
      activeVersion: "1.0.0",
      deployedAt: new Date("2026-05-18T12:00:00.000Z")
    });
    const secondDeployment = deployment({
      id: "deployment-2",
      bundleId: "bundle-2",
      desiredVersion: "2.0.0",
      activeVersion: "2.0.0",
      deployedAt: new Date("2026-05-18T12:01:00.000Z")
    });
    const firstBundle = bundle({
      id: "bundle-1",
      version: "1.0.0"
    });
    const secondBundle = bundle({
      id: "bundle-2",
      version: "2.0.0"
    });
    await supervisor.start(firstDeployment, firstBundle);

    await supervisor.reconcile([
      firstDeployment,
      secondDeployment
    ], new Map([
      [firstBundle.id, firstBundle],
      [secondBundle.id, secondBundle]
    ]));

    expect(sandbox.calls).toEqual([
      "start:deployment-1:bundle-1",
      "start:deployment-2:bundle-2",
      "stop:sidecar-1"
    ]);
    expect(supervisor.getRunningInstances("mechanic_core", "server-1")).toEqual([
      expect.objectContaining({
        id: "sidecar-3",
        deploymentId: "deployment-2",
        bundleId: "bundle-2",
        status: "running"
      })
    ]);
    expect(supervisor.getSandboxEvents().map((event) => event.eventType)).toEqual([
      "sidecar.started",
      "sidecar.started",
      "sidecar.stopped"
    ]);
  });

  it("records a failed sandbox event when driver startup fails", async () => {
    const supervisor = new PluginSidecarSupervisor({
      driver: {
        async start() {
          throw new Error("sandbox denied filesystem access");
        },
        async stop() {
          throw new Error("should not stop a failed start");
        }
      },
      now: () => now,
      idFactory: () => "sidecar-1"
    });

    await expect(supervisor.start(deployment(), bundle())).rejects.toThrow(
      "sandbox denied filesystem access"
    );

    expect(supervisor.getInstance("sidecar-1")).toBeUndefined();
    expect(supervisor.getSandboxEvents()).toEqual([
      expect.objectContaining({
        pluginId: "mechanic_core",
        serverId: "server-1",
        eventType: "sidecar.start_failed",
        status: "failed"
      })
    ]);
  });

  it("rejects sidecar bundles that request unapproved sandbox capabilities before driver startup", async () => {
    const sandbox = driver();
    const supervisor = new PluginSidecarSupervisor({
      driver: sandbox,
      now: () => now,
      idFactory: () => "sidecar-1"
    });

    await expect(
      supervisor.start(
        deployment(),
        bundle({
          capabilities: [
            { key: "vehicle.repair" },
            { key: "sandbox.filesystem" }
          ]
        })
      )
    ).rejects.toThrow("Sandbox capability is not allowed for plugin mechanic_core: sandbox.filesystem");

    expect(sandbox.calls).toEqual([]);
    expect(supervisor.getInstance("sidecar-1")).toBeUndefined();
    expect(supervisor.getSandboxEvents()).toEqual([
      expect.objectContaining({
        pluginId: "mechanic_core",
        serverId: "server-1",
        eventType: "sidecar.start_failed",
        status: "failed"
      })
    ]);
  });

  it("rejects direct database sandbox capabilities even when accidentally approved", async () => {
    const sandbox = driver();
    const supervisor = new PluginSidecarSupervisor({
      driver: sandbox,
      now: () => now,
      idFactory: () => "sidecar-1",
      allowedSandboxCapabilities: ["sandbox.database.write"]
    });

    await expect(
      supervisor.start(
        deployment(),
        bundle({
          capabilities: [
            { key: "vehicle.repair" },
            { key: "sandbox.database.write" }
          ]
        })
      )
    ).rejects.toThrow("Sandbox capability is forbidden: sandbox.database.write");

    expect(sandbox.calls).toEqual([]);
    expect(supervisor.getInstance("sidecar-1")).toBeUndefined();
    expect(supervisor.getSandboxEvents()).toEqual([
      expect.objectContaining({
        pluginId: "mechanic_core",
        serverId: "server-1",
        eventType: "sidecar.start_failed",
        status: "failed"
      })
    ]);
  });

  it("rejects non-sidecar runtime types before driver startup", async () => {
    const sandbox = driver();
    const supervisor = new PluginSidecarSupervisor({
      driver: sandbox,
      now: () => now,
      idFactory: () => "sidecar-1"
    });

    await expect(
      supervisor.start(
        deployment(),
        bundle({
          runtimeType: "wasm"
        })
      )
    ).rejects.toThrow("Runtime type is not supported by sidecar supervisor: wasm");

    expect(sandbox.calls).toEqual([]);
    expect(supervisor.getInstance("sidecar-1")).toBeUndefined();
    expect(supervisor.getSandboxEvents()).toEqual([
      expect.objectContaining({
        pluginId: "mechanic_core",
        serverId: "server-1",
        eventType: "sidecar.start_failed",
        status: "failed"
      })
    ]);
  });

  it("passes explicitly allowed sandbox capabilities to the driver policy", async () => {
    const policies: unknown[] = [];
    const supervisor = new PluginSidecarSupervisor({
      driver: {
        async start(input) {
          policies.push(input.sandboxPolicy);
          return { pid: 1234 };
        },
        async stop() {}
      },
      now: () => now,
      idFactory: () => "sidecar-1",
      allowedSandboxCapabilities: ["sandbox.network"]
    });

    await supervisor.start(
      deployment(),
      bundle({
        capabilities: [
          { key: "vehicle.repair" },
          { key: "sandbox.network" }
        ]
      })
    );

    expect(policies).toEqual([
      {
        allowedCapabilities: ["sandbox.network"],
        requestedCapabilities: ["sandbox.network"]
      }
    ]);
  });

  it("records a failed sandbox event when driver stop fails", async () => {
    const supervisor = new PluginSidecarSupervisor({
      driver: {
        async start() {
          return { pid: 1234 };
        },
        async stop() {
          throw new Error("sandbox refused termination");
        }
      },
      now: () => now,
      idFactory: () => "sidecar-1"
    });
    const instance = await supervisor.start(deployment(), bundle());

    await expect(supervisor.stop(instance.id)).rejects.toThrow("sandbox refused termination");

    expect(supervisor.getInstance(instance.id)).toEqual(expect.objectContaining({
      id: instance.id,
      status: "running",
      errorMessage: "sandbox refused termination"
    }));
    expect(supervisor.getSandboxEvents()).toEqual([
      expect.objectContaining({ eventType: "sidecar.started", status: "succeeded" }),
      expect.objectContaining({ eventType: "sidecar.stop_failed", status: "failed" })
    ]);
  });

  it("can restart a stopped active deployment with a fresh sidecar instance", async () => {
    let nextId = 0;
    const sandbox = driver();
    const supervisor = new PluginSidecarSupervisor({
      driver: sandbox,
      now: () => now,
      idFactory: () => `sidecar-${++nextId}`
    });
    const activeDeployment = deployment();

    const first = await supervisor.start(activeDeployment, bundle());
    await supervisor.stop(first.id);
    const restarted = await supervisor.start(activeDeployment, bundle());

    expect(restarted).toEqual(expect.objectContaining({
      id: "sidecar-4",
      deploymentId: activeDeployment.id,
      status: "running"
    }));
    expect(sandbox.calls).toEqual([
      "start:deployment-1:bundle-1",
      "stop:sidecar-1",
      "start:deployment-1:bundle-1"
    ]);
    expect(supervisor.getRunningInstances("mechanic_core", "server-1")).toEqual([
      expect.objectContaining({
        id: "sidecar-4",
        status: "running"
      })
    ]);
  });

  it("fails closed when a sidecar hook response contains malformed action requests", async () => {
    const supervisor = new PluginSidecarSupervisor({
      driver: {
        async start() {
          return { pid: 1234 };
        },
        async stop() {},
        async dispatchHook() {
          return {
            actions: [
              {
                payload: { targetVehicleNetId: 44 }
              }
            ]
          } as never;
        }
      },
      now: () => now,
      idFactory: () => "sidecar-1"
    });
    const instance = await supervisor.start(deployment(), bundle());

    await expect(
      supervisor.dispatchHook(instance.id, {
        hookName: "on_vehicle_damaged",
        handlerRef: "mechanic.inspect_damage",
        payload: { vehicleNetId: 44 },
        actorPrincipalId: "player:mechanic"
      })
    ).rejects.toThrow("Invalid sidecar hook action at index 0: actionId is required");

    expect(supervisor.getSandboxEvents()).toEqual([
      expect.objectContaining({ eventType: "sidecar.started", status: "succeeded" }),
      expect.objectContaining({ eventType: "sidecar.hook_failed", status: "failed" })
    ]);
  });

  it("fails closed when sidecar hook action identifiers are blank after trimming", async () => {
    const supervisor = new PluginSidecarSupervisor({
      driver: {
        async start() {
          return { pid: 1234 };
        },
        async stop() {},
        async dispatchHook() {
          return {
            actions: [
              {
                actionId: " ",
                actorPrincipalId: " ",
                payload: { targetVehicleNetId: 44 }
              }
            ]
          };
        }
      },
      now: () => now,
      idFactory: () => "sidecar-1"
    });
    const instance = await supervisor.start(deployment(), bundle());

    await expect(
      supervisor.dispatchHook(instance.id, {
        hookName: "on_vehicle_damaged",
        handlerRef: "mechanic.inspect_damage",
        payload: { vehicleNetId: 44 },
        actorPrincipalId: "player:mechanic"
      })
    ).rejects.toThrow("Invalid sidecar hook action at index 0: actionId is required");

    expect(supervisor.getSandboxEvents()).toEqual([
      expect.objectContaining({ eventType: "sidecar.started", status: "succeeded" }),
      expect.objectContaining({ eventType: "sidecar.hook_failed", status: "failed" })
    ]);
  });

  it("fails closed when sidecar hook dispatch exceeds the configured timeout", async () => {
    const supervisor = new PluginSidecarSupervisor({
      driver: {
        async start() {
          return { pid: 1234 };
        },
        async stop() {},
        async dispatchHook() {
          return new Promise(() => {});
        }
      },
      now: () => now,
      idFactory: () => "sidecar-1",
      hookDispatchTimeoutMs: 1
    });
    const instance = await supervisor.start(deployment(), bundle());

    await expect(
      supervisor.dispatchHook(instance.id, {
        hookName: "on_vehicle_damaged",
        handlerRef: "mechanic.inspect_damage",
        payload: { vehicleNetId: 44 },
        actorPrincipalId: "player:mechanic"
      })
    ).rejects.toThrow("Sidecar hook dispatch timed out after 1ms");

    expect(supervisor.getInstance(instance.id)).toEqual(expect.objectContaining({
      id: instance.id,
      status: "running",
      errorMessage: "Sidecar hook dispatch timed out after 1ms"
    }));
    expect(supervisor.getSandboxEvents()).toEqual([
      expect.objectContaining({ eventType: "sidecar.started", status: "succeeded" }),
      expect.objectContaining({ eventType: "sidecar.hook_failed", status: "failed" })
    ]);
  });
});
