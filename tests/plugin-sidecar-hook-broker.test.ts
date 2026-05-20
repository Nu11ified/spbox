import { createHash, createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { MenuRuntime, type MenuAction } from "../src/core/menu.js";
import { PermissionStore } from "../src/core/permission-store.js";
import { PluginActionBroker } from "../src/core/plugin-action-broker.js";
import {
  PluginDeploymentManager,
  pluginBundleSigningPayload,
  type PluginBundleSigningPayloadInput,
  type PluginCapability
} from "../src/core/plugin-deployment.js";
import { PluginSidecarHookBroker, type PluginSidecarHookRegistration } from "../src/core/plugin-sidecar-hooks.js";
import { PluginSidecarSupervisor, type PluginSandboxDriver } from "../src/core/plugin-sidecar.js";
import { RuntimeControlPlane } from "../src/core/runtime.js";
import { RuntimeBridge } from "../src/runtime/bridge.js";

const now = new Date("2026-05-18T12:00:00.000Z");
const bundleBytes = "console.log('mechanic plugin')";
const bundleHash = createHash("sha256").update(bundleBytes).digest("hex");

function signBundle(capabilities: PluginCapability[], overrides: Partial<PluginBundleSigningPayloadInput> = {}) {
  return createHmac("sha256", "secret").update(pluginBundleSigningPayload({
    id: "bundle-1",
    pluginId: "mechanic_core",
    version: "1.0.0",
    bundleHash,
    signerId: "trusted-signer",
    runtimeType: "js_sidecar",
    capabilities,
    ...overrides
  })).digest("hex");
}

function createHarness(capabilities: PluginCapability[] = [
  { key: "vehicle.inspect" },
  { key: "vehicle.repair" }
]) {
  let nextId = 0;
  const deployments = new PluginDeploymentManager({
    signers: [{ id: "trusted-signer", secret: "secret" }],
    now: () => now,
    idFactory: () => `deployment-${++nextId}`
  });
  const bundle = deployments.registerBundle({
    id: "bundle-1",
    pluginId: "mechanic_core",
    version: "1.0.0",
    artifactUrl: "memory://mechanic_core.js",
    bundleHash,
    signature: signBundle(capabilities),
    signerId: "trusted-signer",
    runtimeType: "js_sidecar",
    capabilities
  });
  const deployment = deployments.deploy({
    pluginId: "mechanic_core",
    bundleId: "bundle-1",
    serverId: "server-1",
    bundleBytes
  });

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

  const permissions = new PermissionStore({ now: () => now });
  permissions.grantPermission({
    principalId: "player:mechanic",
    permissionKey: "menu.vehicle.repair",
    effect: "allow",
    source: "manual"
  });
  const actions: MenuAction[] = [
    {
      id: "vehicle.repair",
      pluginId: "mechanic_core",
      actionType: "runtime_action",
      reducerName: "repair_vehicle",
      requiredPermission: "menu.vehicle.repair",
      payloadSchema: {
        type: "object",
        required: ["targetVehicleNetId"],
        properties: {
          targetVehicleNetId: { type: "number" }
        }
      },
      auditLevel: "standard",
      enabled: true
    }
  ];
  const bridge = new RuntimeBridge({
    serverId: "server-1",
    runtime,
    permissions,
    menu: new MenuRuntime({ menus: [], actions, permissions: permissions.toEngine(), now: () => now }),
    idFactory: () => `nonce-${++nextId}`
  });
  bridge.registerLocalHandler("vehicle.repair", (_principalId, payload) => ({
    repaired: (payload as { targetVehicleNetId: number }).targetVehicleNetId
  }));

  const calls: unknown[] = [];
  const driver: PluginSandboxDriver = {
    async start() {
      return { pid: 1234 };
    },
    async stop() {},
    async dispatchHook(input) {
      calls.push(input);
      return {
        actions: [
          {
            actionId: "vehicle.repair",
            payload: { targetVehicleNetId: (input.payload as { vehicleNetId: number }).vehicleNetId }
          }
        ]
      };
    }
  };
  const supervisor = new PluginSidecarSupervisor({
    driver,
    now: () => now,
    idFactory: () => `sidecar-${++nextId}`
  });

  const actionBroker = new PluginActionBroker({
    deployments,
    bridge,
    actionCapabilities: {
      "vehicle.repair": "vehicle.repair"
    },
    payloadSchemas: {
      "vehicle.repair": {
        type: "object",
        required: ["targetVehicleNetId"],
        properties: {
          targetVehicleNetId: { type: "number" }
        }
      }
    }
  });

  return {
    actionBroker,
    bundle,
    calls,
    deployment,
    deployments,
    runtime,
    supervisor
  };
}

const hook: PluginSidecarHookRegistration = {
  id: "mechanic_core:on_vehicle_damaged:mechanic.inspect_damage",
  pluginId: "mechanic_core",
  hookName: "on_vehicle_damaged",
  capability: "vehicle.inspect",
  handlerRef: "mechanic.inspect_damage",
  priority: 10,
  enabled: true,
  payloadSchema: {
    type: "object",
    required: ["vehicleNetId"],
    properties: {
      vehicleNetId: { type: "number" }
    }
  }
};

describe("PluginSidecarHookBroker", () => {
  it("rejects blank sidecar hook registration identifiers before indexing hooks", () => {
    const harness = createHarness();

    expect(() =>
      new PluginSidecarHookBroker({
        serverId: "server-1",
        deployments: harness.deployments,
        supervisor: harness.supervisor,
        actionBroker: harness.actionBroker,
        hooks: [
          {
            ...hook,
            hookName: " "
          }
        ]
      })
    ).toThrow("Sidecar hook registration hookName is required");

    expect(() =>
      new PluginSidecarHookBroker({
        serverId: "server-1",
        deployments: harness.deployments,
        supervisor: harness.supervisor,
        actionBroker: harness.actionBroker,
        hooks: [
          {
            ...hook,
            capability: " "
          }
        ]
      })
    ).toThrow("Sidecar hook registration capability is required");
  });

  it("rejects blank hook dispatch identities before sidecar lookup", async () => {
    const harness = createHarness();
    await harness.supervisor.start(harness.deployment, harness.bundle);
    const broker = new PluginSidecarHookBroker({
      serverId: "server-1",
      deployments: harness.deployments,
      supervisor: harness.supervisor,
      actionBroker: harness.actionBroker,
      hooks: [hook]
    });

    await expect(
      broker.dispatch(" ", { vehicleNetId: 44 }, "player:mechanic")
    ).rejects.toThrow("hookName is required");

    await expect(
      broker.dispatch("on_vehicle_damaged", { vehicleNetId: 44 }, " ")
    ).rejects.toThrow("actorPrincipalId is required");

    expect(harness.calls).toEqual([]);
  });

  it("rejects invalid sidecar hook fanout limits before dispatch", () => {
    const harness = createHarness();

    for (const maxActionsPerHook of [-1, 1.5, Number.POSITIVE_INFINITY, Number.NaN]) {
      expect(() =>
        new PluginSidecarHookBroker({
          serverId: "server-1",
          deployments: harness.deployments,
          supervisor: harness.supervisor,
          actionBroker: harness.actionBroker,
          hooks: [hook],
          maxActionsPerHook
        })
      ).toThrow("maxActionsPerHook must be a non-negative integer");
    }
  });

  it("dispatches hook events to running sidecars and executes returned runtime actions", async () => {
    const harness = createHarness();
    await harness.supervisor.start(harness.deployment, harness.bundle);
    const broker = new PluginSidecarHookBroker({
      serverId: "server-1",
      deployments: harness.deployments,
      supervisor: harness.supervisor,
      actionBroker: harness.actionBroker,
      hooks: [hook]
    });

    const result = await broker.dispatch("on_vehicle_damaged", {
      vehicleNetId: 44
    }, "player:mechanic");

    expect(result.results).toEqual([
      expect.objectContaining({
        hookId: hook.id,
        pluginId: "mechanic_core",
        actionResults: [
          expect.objectContaining({
            ok: true,
            result: { repaired: 44 }
          })
        ]
      })
    ]);
    expect(harness.calls).toEqual([
      expect.objectContaining({
        hookName: "on_vehicle_damaged",
        handlerRef: "mechanic.inspect_damage",
        payload: { vehicleNetId: 44 },
        actorPrincipalId: "player:mechanic"
      })
    ]);
    expect(harness.runtime.getAuditLogs("server-1")).toEqual(expect.arrayContaining([
      expect.objectContaining({
        pluginId: "mechanic_core",
        actionType: "vehicle.repair",
        status: "succeeded"
      }),
      expect.objectContaining({
        pluginId: "mechanic_core",
        actionType: "hook.on_vehicle_damaged",
        status: "succeeded",
        after: { actionCount: 1 }
      })
    ]));
    expect(harness.supervisor.getSandboxEvents()).toEqual([
      expect.objectContaining({ eventType: "sidecar.started", status: "succeeded" }),
      expect.objectContaining({ eventType: "sidecar.hook_dispatched", status: "succeeded" })
    ]);
  });

  it("dispatches sidecar hooks to the current active deployment instance", async () => {
    const harness = createHarness();
    await harness.supervisor.start(harness.deployment, harness.bundle);
    const secondBundleBytes = "console.log('mechanic plugin v2')";
    const secondBundleHash = createHash("sha256").update(secondBundleBytes).digest("hex");
    const secondCapabilities = [{ key: "vehicle.inspect" }, { key: "vehicle.repair" }];
    const secondBundle = harness.deployments.registerBundle({
      id: "bundle-2",
      pluginId: "mechanic_core",
      version: "2.0.0",
      artifactUrl: "memory://mechanic_core-v2.js",
      bundleHash: secondBundleHash,
      signature: signBundle(secondCapabilities, {
        id: "bundle-2",
        version: "2.0.0",
        bundleHash: secondBundleHash
      }),
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: secondCapabilities
    });
    const secondDeployment = harness.deployments.deploy({
      pluginId: "mechanic_core",
      bundleId: "bundle-2",
      serverId: "server-1",
      bundleBytes: secondBundleBytes
    });
    await harness.supervisor.start(secondDeployment, secondBundle);
    const broker = new PluginSidecarHookBroker({
      serverId: "server-1",
      deployments: harness.deployments,
      supervisor: harness.supervisor,
      actionBroker: harness.actionBroker,
      hooks: [hook]
    });

    await broker.dispatch("on_vehicle_damaged", {
      vehicleNetId: 44
    }, "player:mechanic");

    expect(harness.calls).toEqual([
      expect.objectContaining({
        instance: expect.objectContaining({
          deploymentId: secondDeployment.id,
          bundleId: "bundle-2"
        })
      })
    ]);
  });

  it("fails closed before sidecar dispatch when hook payload schema is invalid", async () => {
    const harness = createHarness();
    await harness.supervisor.start(harness.deployment, harness.bundle);
    const broker = new PluginSidecarHookBroker({
      serverId: "server-1",
      deployments: harness.deployments,
      supervisor: harness.supervisor,
      actionBroker: harness.actionBroker,
      hooks: [hook]
    });

    const result = await broker.dispatch("on_vehicle_damaged", {
      vehicleNetId: "bad"
    }, "player:mechanic");

    expect(result.results).toEqual([
      {
        hookId: hook.id,
        pluginId: "mechanic_core",
        error: "Expected vehicleNetId to be number",
        actionResults: []
      }
    ]);
    expect(harness.calls).toEqual([]);
    expect(harness.runtime.getAuditLogs("server-1")).toEqual([
      expect.objectContaining({
        actionType: "hook.on_vehicle_damaged",
        status: "failed",
        after: { error: "Expected vehicleNetId to be number" }
      })
    ]);
  });

  it("does not dispatch hook events for plugins missing the declared hook capability", async () => {
    const harness = createHarness([{ key: "vehicle.repair" }]);
    await harness.supervisor.start(harness.deployment, harness.bundle);
    const broker = new PluginSidecarHookBroker({
      serverId: "server-1",
      deployments: harness.deployments,
      supervisor: harness.supervisor,
      actionBroker: harness.actionBroker,
      hooks: [hook]
    });

    const result = await broker.dispatch("on_vehicle_damaged", {
      vehicleNetId: 44
    }, "player:mechanic");

    expect(result.results).toEqual([
      {
        hookId: hook.id,
        pluginId: "mechanic_core",
        error: "Plugin lacks capability: vehicle.inspect",
        actionResults: []
      }
    ]);
    expect(harness.calls).toEqual([]);
    expect(harness.runtime.getAuditLogs("server-1")).toEqual([
      expect.objectContaining({
        actionType: "hook.on_vehicle_damaged",
        status: "denied",
        after: { error: "Plugin lacks capability: vehicle.inspect" }
      })
    ]);
  });

  it("does not let sidecars escalate returned actions to a different actor principal", async () => {
    let nextId = 0;
    const deployments = new PluginDeploymentManager({
      signers: [{ id: "trusted-signer", secret: "secret" }],
      now: () => now,
      idFactory: () => `deployment-${++nextId}`
    });
    const bundle = deployments.registerBundle({
      id: "bundle-1",
      pluginId: "mechanic_core",
      version: "1.0.0",
      artifactUrl: "memory://mechanic_core.js",
      bundleHash,
    signature: signBundle([
      { key: "vehicle.inspect" },
      {
        key: "vehicle.repair",
        constraints: {
          allowedActorPrincipals: ["player:supervisor"]
        }
      }
    ]),
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [
        { key: "vehicle.inspect" },
        {
          key: "vehicle.repair",
          constraints: {
            allowedActorPrincipals: ["player:supervisor"]
          }
        }
      ]
    });
    const deployment = deployments.deploy({
      pluginId: "mechanic_core",
      bundleId: "bundle-1",
      serverId: "server-1",
      bundleBytes
    });
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
    const permissions = new PermissionStore({ now: () => now });
    permissions.grantPermission({
      principalId: "player:supervisor",
      permissionKey: "menu.vehicle.repair",
      effect: "allow",
      source: "manual"
    });
    const bridge = new RuntimeBridge({
      serverId: "server-1",
      runtime,
      permissions,
      menu: new MenuRuntime({
        menus: [],
        actions: [
          {
            id: "vehicle.repair",
            pluginId: "mechanic_core",
            actionType: "runtime_action",
            reducerName: "repair_vehicle",
            requiredPermission: "menu.vehicle.repair",
            payloadSchema: {
              type: "object",
              required: ["targetVehicleNetId"],
              properties: {
                targetVehicleNetId: { type: "number" }
              }
            },
            auditLevel: "standard",
            enabled: true
          }
        ],
        permissions: permissions.toEngine(),
        now: () => now
      }),
      idFactory: () => `nonce-${++nextId}`
    });
    bridge.registerLocalHandler("vehicle.repair", () => ({ repaired: true }));
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
                actorPrincipalId: "player:supervisor",
                actionId: "vehicle.repair",
                payload: { targetVehicleNetId: 44 }
              }
            ]
          };
        }
      },
      now: () => now,
      idFactory: () => `sidecar-${++nextId}`
    });
    await supervisor.start(deployment, bundle);
    const broker = new PluginSidecarHookBroker({
      serverId: "server-1",
      deployments,
      supervisor,
      actionBroker: new PluginActionBroker({
        deployments,
        bridge,
        actionCapabilities: {
          "vehicle.repair": "vehicle.repair"
        },
        payloadSchemas: {
          "vehicle.repair": {
            type: "object",
            required: ["targetVehicleNetId"],
            properties: {
              targetVehicleNetId: { type: "number" }
            }
          }
        }
      }),
      hooks: [hook]
    });

    const result = await broker.dispatch("on_vehicle_damaged", {
      vehicleNetId: 44
    }, "player:mechanic");

    expect(result.results).toEqual([
      {
        hookId: hook.id,
        pluginId: "mechanic_core",
        actionResults: [],
        error: "Capability vehicle.repair does not allow actor principal player:mechanic"
      }
    ]);
    expect(runtime.getAuditLogs("server-1")).toEqual(expect.arrayContaining([
      expect.objectContaining({
        actorId: "player:mechanic",
        pluginId: "mechanic_core",
        actionType: "vehicle.repair",
        status: "denied",
        after: {
          error: "Capability vehicle.repair does not allow actor principal player:mechanic"
        }
      }),
      expect.objectContaining({
        actorId: "player:mechanic",
        pluginId: "mechanic_core",
        actionType: "hook.on_vehicle_damaged",
        status: "denied",
        after: {
          error: "Capability vehicle.repair does not allow actor principal player:mechanic"
        }
      })
    ]));
  });

  it("preserves successful sidecar action results when a later returned action is denied", async () => {
    let nextId = 0;
    const deployments = new PluginDeploymentManager({
      signers: [{ id: "trusted-signer", secret: "secret" }],
      now: () => now,
      idFactory: () => `deployment-${++nextId}`
    });
    const bundle = deployments.registerBundle({
      id: "bundle-1",
      pluginId: "mechanic_core",
      version: "1.0.0",
      artifactUrl: "memory://mechanic_core.js",
      bundleHash,
    signature: signBundle([
      { key: "vehicle.inspect" },
      { key: "vehicle.repair" }
    ]),
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [
        { key: "vehicle.inspect" },
        { key: "vehicle.repair" }
      ]
    });
    const deployment = deployments.deploy({
      pluginId: "mechanic_core",
      bundleId: "bundle-1",
      serverId: "server-1",
      bundleBytes
    });
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
    const permissions = new PermissionStore({ now: () => now });
    permissions.grantPermission({
      principalId: "player:mechanic",
      permissionKey: "menu.vehicle.repair",
      effect: "allow",
      source: "manual"
    });
    const bridge = new RuntimeBridge({
      serverId: "server-1",
      runtime,
      permissions,
      menu: new MenuRuntime({
        menus: [],
        actions: [
          {
            id: "vehicle.repair",
            pluginId: "mechanic_core",
            actionType: "runtime_action",
            reducerName: "repair_vehicle",
            requiredPermission: "menu.vehicle.repair",
            payloadSchema: {
              type: "object",
              required: ["targetVehicleNetId"],
              properties: {
                targetVehicleNetId: { type: "number" }
              }
            },
            auditLevel: "standard",
            enabled: true
          }
        ],
        permissions: permissions.toEngine(),
        now: () => now
      }),
      idFactory: () => `nonce-${++nextId}`
    });
    bridge.registerLocalHandler("vehicle.repair", (_principalId, payload) => ({
      repaired: (payload as { targetVehicleNetId: number }).targetVehicleNetId
    }));
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
                actionId: "vehicle.repair",
                payload: { targetVehicleNetId: 44 }
              },
              {
                actionId: "vehicle.paint",
                payload: { targetVehicleNetId: 44, color: "red" }
              }
            ]
          };
        }
      },
      now: () => now,
      idFactory: () => `sidecar-${++nextId}`
    });
    await supervisor.start(deployment, bundle);
    const broker = new PluginSidecarHookBroker({
      serverId: "server-1",
      deployments,
      supervisor,
      actionBroker: new PluginActionBroker({
        deployments,
        bridge,
        actionCapabilities: {
          "vehicle.repair": "vehicle.repair",
          "vehicle.paint": "vehicle.paint"
        },
        payloadSchemas: {
          "vehicle.repair": {
            type: "object",
            required: ["targetVehicleNetId"],
            properties: {
              targetVehicleNetId: { type: "number" }
            }
          }
        }
      }),
      hooks: [hook]
    });

    const result = await broker.dispatch("on_vehicle_damaged", {
      vehicleNetId: 44
    }, "player:mechanic");

    expect(result.results).toEqual([
      {
        hookId: hook.id,
        pluginId: "mechanic_core",
        actionResults: [
          expect.objectContaining({
            ok: true,
            result: { repaired: 44 }
          })
        ],
        error: "Plugin lacks capability: vehicle.paint"
      }
    ]);
    expect(runtime.getAuditLogs("server-1")).toEqual(expect.arrayContaining([
      expect.objectContaining({
        actionType: "vehicle.repair",
        status: "succeeded"
      }),
      expect.objectContaining({
        actionType: "vehicle.paint",
        status: "denied",
        after: { error: "Plugin lacks capability: vehicle.paint" }
      }),
      expect.objectContaining({
        actionType: "hook.on_vehicle_damaged",
        status: "denied",
        after: { error: "Plugin lacks capability: vehicle.paint" }
      })
    ]));
  });

  it("marks hook audit denied when returned actions violate capability payload limits", async () => {
    let nextId = 0;
    const deployments = new PluginDeploymentManager({
      signers: [{ id: "trusted-signer", secret: "secret" }],
      now: () => now,
      idFactory: () => `deployment-${++nextId}`
    });
    const bundle = deployments.registerBundle({
      id: "bundle-1",
      pluginId: "mechanic_core",
      version: "1.0.0",
      artifactUrl: "memory://mechanic_core.js",
      bundleHash,
    signature: signBundle([
      { key: "vehicle.inspect" },
      {
        key: "vehicle.repair",
        constraints: {
          payloadLimits: {
            targetVehicleNetId: 50
          }
        }
      }
    ]),
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [
        { key: "vehicle.inspect" },
        {
          key: "vehicle.repair",
          constraints: {
            payloadLimits: {
              targetVehicleNetId: 50
            }
          }
        }
      ]
    });
    const deployment = deployments.deploy({
      pluginId: "mechanic_core",
      bundleId: "bundle-1",
      serverId: "server-1",
      bundleBytes
    });
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
    const permissions = new PermissionStore({ now: () => now });
    permissions.grantPermission({
      principalId: "player:mechanic",
      permissionKey: "menu.vehicle.repair",
      effect: "allow",
      source: "manual"
    });
    const bridge = new RuntimeBridge({
      serverId: "server-1",
      runtime,
      permissions,
      menu: new MenuRuntime({
        menus: [],
        actions: [
          {
            id: "vehicle.repair",
            pluginId: "mechanic_core",
            actionType: "runtime_action",
            reducerName: "repair_vehicle",
            requiredPermission: "menu.vehicle.repair",
            payloadSchema: {
              type: "object",
              required: ["targetVehicleNetId"],
              properties: {
                targetVehicleNetId: { type: "number" }
              }
            },
            auditLevel: "standard",
            enabled: true
          }
        ],
        permissions: permissions.toEngine(),
        now: () => now
      }),
      idFactory: () => `nonce-${++nextId}`
    });
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
                actionId: "vehicle.repair",
                payload: { targetVehicleNetId: 99 }
              }
            ]
          };
        }
      },
      now: () => now,
      idFactory: () => `sidecar-${++nextId}`
    });
    await supervisor.start(deployment, bundle);
    const broker = new PluginSidecarHookBroker({
      serverId: "server-1",
      deployments,
      supervisor,
      actionBroker: new PluginActionBroker({
        deployments,
        bridge,
        actionCapabilities: {
          "vehicle.repair": "vehicle.repair"
        },
        payloadSchemas: {
          "vehicle.repair": {
            type: "object",
            required: ["targetVehicleNetId"],
            properties: {
              targetVehicleNetId: { type: "number" }
            }
          }
        }
      }),
      hooks: [hook]
    });

    const result = await broker.dispatch("on_vehicle_damaged", {
      vehicleNetId: 44
    }, "player:mechanic");

    expect(result.results).toEqual([
      {
        hookId: hook.id,
        pluginId: "mechanic_core",
        actionResults: [],
        error: "Capability vehicle.repair payload limit targetVehicleNetId <= 50 exceeded"
      }
    ]);
    expect(runtime.getAuditLogs("server-1")).toEqual(expect.arrayContaining([
      expect.objectContaining({
        actionType: "vehicle.repair",
        status: "denied",
        after: {
          error: "Capability vehicle.repair payload limit targetVehicleNetId <= 50 exceeded"
        }
      }),
      expect.objectContaining({
        actionType: "hook.on_vehicle_damaged",
        status: "denied",
        after: {
          error: "Capability vehicle.repair payload limit targetVehicleNetId <= 50 exceeded"
        }
      })
    ]));
  });

  it("fails closed when a sidecar hook response exceeds the configured action fanout limit", async () => {
    const harness = createHarness();
    await harness.supervisor.start(harness.deployment, harness.bundle);
    const broker = new PluginSidecarHookBroker({
      serverId: "server-1",
      deployments: harness.deployments,
      supervisor: harness.supervisor,
      actionBroker: harness.actionBroker,
      hooks: [hook],
      maxActionsPerHook: 0
    });

    const result = await broker.dispatch("on_vehicle_damaged", {
      vehicleNetId: 44
    }, "player:mechanic");

    expect(result.results).toEqual([
      {
        hookId: hook.id,
        pluginId: "mechanic_core",
        actionResults: [],
        error: "Sidecar hook mechanic_core:on_vehicle_damaged:mechanic.inspect_damage returned 1 actions, exceeding limit 0"
      }
    ]);
    expect(harness.runtime.getAuditLogs("server-1")).toEqual([
      expect.objectContaining({
        actionType: "hook.on_vehicle_damaged",
        status: "failed",
        after: {
          error: "Sidecar hook mechanic_core:on_vehicle_damaged:mechanic.inspect_damage returned 1 actions, exceeding limit 0"
        }
      })
    ]);
  });

  it("writes hook-level audit records when a sidecar hook succeeds without actions", async () => {
    let nextId = 0;
    const deployments = new PluginDeploymentManager({
      signers: [{ id: "trusted-signer", secret: "secret" }],
      now: () => now,
      idFactory: () => `deployment-${++nextId}`
    });
    const bundle = deployments.registerBundle({
      id: "bundle-1",
      pluginId: "mechanic_core",
      version: "1.0.0",
      artifactUrl: "memory://mechanic_core.js",
      bundleHash,
    signature: signBundle([{ key: "vehicle.inspect" }]),
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [{ key: "vehicle.inspect" }]
    });
    const deployment = deployments.deploy({
      pluginId: "mechanic_core",
      bundleId: "bundle-1",
      serverId: "server-1",
      bundleBytes
    });
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
    const permissions = new PermissionStore({ now: () => now });
    const bridge = new RuntimeBridge({
      serverId: "server-1",
      runtime,
      permissions,
      menu: new MenuRuntime({ menus: [], actions: [], permissions: permissions.toEngine(), now: () => now }),
      idFactory: () => `nonce-${++nextId}`
    });
    const supervisor = new PluginSidecarSupervisor({
      driver: {
        async start() {
          return { pid: 1234 };
        },
        async stop() {},
        async dispatchHook() {
          return {};
        }
      },
      now: () => now,
      idFactory: () => `sidecar-${++nextId}`
    });
    await supervisor.start(deployment, bundle);
    const broker = new PluginSidecarHookBroker({
      serverId: "server-1",
      deployments,
      supervisor,
      actionBroker: new PluginActionBroker({
        deployments,
        bridge,
        actionCapabilities: {}
      }),
      hooks: [hook]
    });

    const result = await broker.dispatch("on_vehicle_damaged", {
      vehicleNetId: 44
    }, "player:mechanic");

    expect(result.results).toEqual([
      {
        hookId: hook.id,
        pluginId: "mechanic_core",
        actionResults: []
      }
    ]);
    expect(runtime.getAuditLogs("server-1")).toEqual([
      expect.objectContaining({
        actorId: "player:mechanic",
        pluginId: "mechanic_core",
        actionType: "hook.on_vehicle_damaged",
        permissionKey: "vehicle.inspect",
        targetType: "hook",
        targetId: hook.id,
        status: "succeeded",
        after: { actionCount: 0 }
      })
    ]);
  });

  it("writes denied hook-level audit records when the plugin lacks the hook capability", async () => {
    const harness = createHarness([{ key: "vehicle.repair" }]);
    await harness.supervisor.start(harness.deployment, harness.bundle);
    const broker = new PluginSidecarHookBroker({
      serverId: "server-1",
      deployments: harness.deployments,
      supervisor: harness.supervisor,
      actionBroker: harness.actionBroker,
      hooks: [hook]
    });

    await broker.dispatch("on_vehicle_damaged", {
      vehicleNetId: 44
    }, "player:mechanic");

    expect(harness.runtime.getAuditLogs("server-1")).toEqual([
      expect.objectContaining({
        actorId: "player:mechanic",
        pluginId: "mechanic_core",
        actionType: "hook.on_vehicle_damaged",
        permissionKey: "vehicle.inspect",
        targetType: "hook",
        targetId: hook.id,
        status: "denied",
        after: { error: "Plugin lacks capability: vehicle.inspect" }
      })
    ]);
  });
});
