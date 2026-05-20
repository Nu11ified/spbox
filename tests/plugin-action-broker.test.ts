import { createHash, createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { PluginActionBroker } from "../src/core/plugin-action-broker.js";
import {
  PluginDeploymentManager,
  pluginBundleSigningPayload,
  type PluginBundleSigningPayloadInput,
  type PluginCapability
} from "../src/core/plugin-deployment.js";
import { RuntimeBridge } from "../src/runtime/bridge.js";
import { MenuRuntime, type MenuAction } from "../src/core/menu.js";
import { PermissionStore } from "../src/core/permission-store.js";
import { RuntimeControlPlane } from "../src/core/runtime.js";

const now = new Date("2026-05-18T12:00:00.000Z");
const bundleBytes = "console.log('vehicle plugin')";
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

function createBroker(
  capabilities: PluginCapability[] = [{ key: "vehicle.repair" }],
  deploymentServerId = "server-1",
  includeBrokerPayloadSchema = true
) {
  let nextId = 0;
  const deployments = new PluginDeploymentManager({
    signers: [{ id: "trusted-signer", secret: "secret" }],
    now: () => now,
    idFactory: () => `deployment-${++nextId}`
  });
  deployments.registerBundle({
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
  deployments.deploy({
    pluginId: "mechanic_core",
    bundleId: "bundle-1",
    serverId: deploymentServerId,
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

  return {
    deployments,
    bridge,
    runtime,
    broker: new PluginActionBroker({
      deployments,
      bridge,
      actionCapabilities: {
        "vehicle.repair": "vehicle.repair"
      },
      payloadSchemas: includeBrokerPayloadSchema ? {
        "vehicle.repair": {
          type: "object",
          required: ["targetVehicleNetId"],
          properties: {
            targetVehicleNetId: { type: "number" }
          }
        }
      } : undefined
    })
  };
}

describe("PluginActionBroker", () => {
  it("rejects blank action capability mappings before accepting sidecar actions", () => {
    const { deployments, bridge } = createBroker();

    expect(() =>
      new PluginActionBroker({
        deployments,
        bridge,
        actionCapabilities: {
          " ": "vehicle.repair"
        }
      })
    ).toThrow("action capability mapping actionId is required");

    expect(() =>
      new PluginActionBroker({
        deployments,
        bridge,
        actionCapabilities: {
          "vehicle.repair": " "
        }
      })
    ).toThrow("action capability mapping capability is required");
  });

  it("rejects blank payload schema mappings before accepting sidecar actions", () => {
    const { deployments, bridge } = createBroker();

    expect(() =>
      new PluginActionBroker({
        deployments,
        bridge,
        actionCapabilities: {
          "vehicle.repair": "vehicle.repair"
        },
        payloadSchemas: {
          " ": {
            type: "object"
          }
        }
      })
    ).toThrow("payload schema mapping actionId is required");
  });

  it("rejects blank sidecar action request identities before capability lookup", async () => {
    const { broker, runtime } = createBroker();

    await expect(
      broker.requestAction({
        pluginId: " ",
        actorPrincipalId: "player:mechanic",
        actionId: "vehicle.repair",
        payload: { targetVehicleNetId: 44 }
      })
    ).rejects.toThrow("pluginId is required");

    await expect(
      broker.requestAction({
        pluginId: "mechanic_core",
        actorPrincipalId: " ",
        actionId: "vehicle.repair",
        payload: { targetVehicleNetId: 44 }
      })
    ).rejects.toThrow("actorPrincipalId is required");

    await expect(
      broker.requestAction({
        pluginId: "mechanic_core",
        actorPrincipalId: "player:mechanic",
        actionId: " ",
        payload: { targetVehicleNetId: 44 }
      })
    ).rejects.toThrow("actionId is required");

    expect(runtime.getAuditLogs("server-1")).toEqual([]);
  });

  it("rejects blank sidecar hook audit identities before writing audit rows", () => {
    const { broker, runtime } = createBroker();

    expect(() =>
      broker.recordHookAudit({
        actorPrincipalId: " ",
        pluginId: "mechanic_core",
        hookName: "on_vehicle_damaged",
        hookId: "hook-1",
        capability: "vehicle.inspect",
        status: "failed"
      })
    ).toThrow("actorPrincipalId is required");

    expect(() =>
      broker.recordHookAudit({
        actorPrincipalId: "player:mechanic",
        pluginId: " ",
        hookName: "on_vehicle_damaged",
        hookId: "hook-1",
        capability: "vehicle.inspect",
        status: "failed"
      })
    ).toThrow("pluginId is required");

    expect(() =>
      broker.recordHookAudit({
        actorPrincipalId: "player:mechanic",
        pluginId: "mechanic_core",
        hookName: " ",
        hookId: "hook-1",
        capability: "vehicle.inspect",
        status: "failed"
      })
    ).toThrow("hookName is required");

    expect(() =>
      broker.recordHookAudit({
        actorPrincipalId: "player:mechanic",
        pluginId: "mechanic_core",
        hookName: "on_vehicle_damaged",
        hookId: " ",
        capability: "vehicle.inspect",
        status: "failed"
      })
    ).toThrow("hookId is required");

    expect(() =>
      broker.recordHookAudit({
        actorPrincipalId: "player:mechanic",
        pluginId: "mechanic_core",
        hookName: "on_vehicle_damaged",
        hookId: "hook-1",
        capability: " ",
        status: "failed"
      })
    ).toThrow("capability is required");

    expect(runtime.getAuditLogs("server-1")).toEqual([]);
  });

  it("rejects invalid sidecar hook audit statuses before writing audit rows", () => {
    const { broker, runtime } = createBroker();

    expect(() =>
      broker.recordHookAudit({
        actorPrincipalId: "player:mechanic",
        pluginId: "mechanic_core",
        hookName: "on_vehicle_damaged",
        hookId: "hook-1",
        capability: "vehicle.inspect",
        status: "queued" as never
      })
    ).toThrow("hook audit status must be succeeded, failed, or denied");

    expect(runtime.getAuditLogs("server-1")).toEqual([]);
  });

  it("executes approved sidecar runtime actions through the runtime bridge", async () => {
    const { broker, runtime } = createBroker();

    const result = await broker.requestAction({
      pluginId: "mechanic_core",
      actorPrincipalId: "player:mechanic",
      actionId: "vehicle.repair",
      payload: { targetVehicleNetId: 44 }
    });

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      result: { repaired: 44 },
      actionId: expect.any(String)
    }));
    expect(runtime.getAuditLogs("server-1")).toEqual([
      expect.objectContaining({
        pluginId: "mechanic_core",
        actionType: "vehicle.repair",
        permissionKey: "menu.vehicle.repair",
        status: "succeeded"
      })
    ]);
  });

  it("rejects sidecar actions when the plugin lacks the required capability", async () => {
    const { broker, runtime } = createBroker([{ key: "vehicle.inspect" }]);

    await expect(
      broker.requestAction({
        pluginId: "mechanic_core",
        actorPrincipalId: "player:mechanic",
        actionId: "vehicle.repair",
        payload: { targetVehicleNetId: 44 }
      })
    ).rejects.toThrow("Plugin lacks capability: vehicle.repair");
    expect(runtime.getAuditLogs("server-1")).toEqual([
      expect.objectContaining({
        pluginId: "mechanic_core",
        actorId: "player:mechanic",
        actionType: "vehicle.repair",
        permissionKey: "vehicle.repair",
        status: "denied",
        after: { error: "Plugin lacks capability: vehicle.repair" }
      })
    ]);
  });

  it("rejects sidecar actions when the plugin is active only on a different server", async () => {
    const { broker, runtime } = createBroker([{ key: "vehicle.repair" }], "server-2");

    await expect(
      broker.requestAction({
        pluginId: "mechanic_core",
        actorPrincipalId: "player:mechanic",
        actionId: "vehicle.repair",
        payload: { targetVehicleNetId: 44 }
      })
    ).rejects.toThrow("Plugin is not active on server server-1: mechanic_core");
    expect(runtime.getAuditLogs("server-1")).toEqual([
      expect.objectContaining({
        pluginId: "mechanic_core",
        actorId: "player:mechanic",
        actionType: "vehicle.repair",
        permissionKey: "vehicle.repair",
        status: "denied",
        after: { error: "Plugin is not active on server server-1: mechanic_core" }
      })
    ]);
  });

  it("validates payload schema before runtime dispatch", async () => {
    const { broker, runtime } = createBroker();

    await expect(
      broker.requestAction({
        pluginId: "mechanic_core",
        actorPrincipalId: "player:mechanic",
        actionId: "vehicle.repair",
        payload: { targetVehicleNetId: "bad" }
      })
    ).rejects.toThrow("Expected targetVehicleNetId to be number");
    expect(runtime.getAuditLogs("server-1")).toEqual([
      expect.objectContaining({
        pluginId: "mechanic_core",
        actorId: "player:mechanic",
        actionType: "vehicle.repair",
        permissionKey: "vehicle.repair",
        status: "denied",
        after: { error: "Expected targetVehicleNetId to be number" }
      })
    ]);
  });

  it("enforces numeric payload limits declared on plugin capabilities before runtime dispatch", async () => {
    const { broker, runtime } = createBroker([
      {
        key: "vehicle.repair",
        constraints: {
          payloadLimits: {
            targetVehicleNetId: 50
          }
        }
      }
    ], "server-1", false);

    await expect(
      broker.requestAction({
        pluginId: "mechanic_core",
        actorPrincipalId: "player:mechanic",
        actionId: "vehicle.repair",
        payload: { targetVehicleNetId: 99 }
      })
    ).rejects.toThrow("Capability vehicle.repair payload limit targetVehicleNetId <= 50 exceeded");
    expect(runtime.getAuditLogs("server-1")).toEqual([
      expect.objectContaining({
        pluginId: "mechanic_core",
        actorId: "player:mechanic",
        actionType: "vehicle.repair",
        permissionKey: "vehicle.repair",
        status: "denied",
        after: {
          error: "Capability vehicle.repair payload limit targetVehicleNetId <= 50 exceeded"
        }
      })
    ]);
  });

  it("fails closed when numeric payload limits reference missing payload fields", async () => {
    const { broker, runtime } = createBroker([
      {
        key: "vehicle.repair",
        constraints: {
          payloadLimits: {
            targetVehicleNetId: 50
          }
        }
      }
    ], "server-1", false);

    await expect(
      broker.requestAction({
        pluginId: "mechanic_core",
        actorPrincipalId: "player:mechanic",
        actionId: "vehicle.repair",
        payload: {}
      })
    ).rejects.toThrow("Capability vehicle.repair payload limit targetVehicleNetId requires a number");
    expect(runtime.getAuditLogs("server-1")).toEqual([
      expect.objectContaining({
        pluginId: "mechanic_core",
        actorId: "player:mechanic",
        actionType: "vehicle.repair",
        permissionKey: "vehicle.repair",
        status: "denied",
        after: {
          error: "Capability vehicle.repair payload limit targetVehicleNetId requires a number"
        }
      })
    ]);
  });

  it("fails closed when numeric payload limits receive non-number payload fields", async () => {
    const { broker, runtime } = createBroker([
      {
        key: "vehicle.repair",
        constraints: {
          payloadLimits: {
            targetVehicleNetId: 50
          }
        }
      }
    ], "server-1", false);

    await expect(
      broker.requestAction({
        pluginId: "mechanic_core",
        actorPrincipalId: "player:mechanic",
        actionId: "vehicle.repair",
        payload: { targetVehicleNetId: "44" }
      })
    ).rejects.toThrow("Capability vehicle.repair payload limit targetVehicleNetId requires a number");
    expect(runtime.getAuditLogs("server-1")).toEqual([
      expect.objectContaining({
        pluginId: "mechanic_core",
        actorId: "player:mechanic",
        actionType: "vehicle.repair",
        permissionKey: "vehicle.repair",
        status: "denied",
        after: {
          error: "Capability vehicle.repair payload limit targetVehicleNetId requires a number"
        }
      })
    ]);
  });

  it("enforces actor principal constraints declared on plugin capabilities before runtime dispatch", async () => {
    const { broker, runtime } = createBroker([
      {
        key: "vehicle.repair",
        constraints: {
          allowedActorPrincipals: ["player:supervisor"]
        }
      }
    ]);

    await expect(
      broker.requestAction({
        pluginId: "mechanic_core",
        actorPrincipalId: "player:mechanic",
        actionId: "vehicle.repair",
        payload: { targetVehicleNetId: 44 }
      })
    ).rejects.toThrow("Capability vehicle.repair does not allow actor principal player:mechanic");
    expect(runtime.getAuditLogs("server-1")).toEqual([
      expect.objectContaining({
        pluginId: "mechanic_core",
        actorId: "player:mechanic",
        actionType: "vehicle.repair",
        permissionKey: "vehicle.repair",
        status: "denied",
        after: {
          error: "Capability vehicle.repair does not allow actor principal player:mechanic"
        }
      })
    ]);
  });

  it("rejects malformed actor principal capability constraints before runtime dispatch", () => {
    expect(() => createBroker([
      {
        key: "vehicle.repair",
        constraints: {
          allowed_actor_principals: ["player:mechanic", ""]
        }
      }
    ])).toThrow("Invalid allowed actor principals for capability vehicle.repair");

    expect(() => createBroker([
      {
        key: "vehicle.repair",
        constraints: {
          allowed_actor_principals: ["player:mechanic", " "]
        }
      }
    ])).toThrow("Invalid allowed actor principals for capability vehicle.repair");
  });

  it("rejects malformed capability payload limit constraints before runtime dispatch", () => {
    expect(() => createBroker([
      {
        key: "vehicle.repair",
        constraints: {
          payloadLimits: {
            targetVehicleNetId: "large"
          }
        }
      }
    ])).toThrow("Invalid payload limit targetVehicleNetId for capability vehicle.repair");

    expect(() => createBroker([
      {
        key: "vehicle.repair",
        constraints: {
          payloadLimits: {
            " ": 50
          }
        }
      }
    ])).toThrow("Invalid payload limit field for capability vehicle.repair");

    expect(() => createBroker([
      {
        key: "vehicle.repair",
        constraints: {
          payloadLimits: {
            " targetVehicleNetId ": 50
          }
        }
      }
    ])).toThrow("Invalid payload limit field for capability vehicle.repair");
  });
});
