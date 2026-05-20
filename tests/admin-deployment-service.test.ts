import { createHash, createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { AdminService } from "../src/admin/service.js";
import { PermissionStore } from "../src/core/permission-store.js";
import {
  PluginDeploymentManager,
  pluginBundleSigningPayload,
  type PluginBundleSigningPayloadInput,
  type PluginCapability
} from "../src/core/plugin-deployment.js";
import { PluginSidecarSupervisor } from "../src/core/plugin-sidecar.js";
import { PluginRegistry } from "../src/core/plugins.js";
import { RuntimeControlPlane } from "../src/core/runtime.js";

const secret = "test-signer-secret";
const bundleBytes = "console.log('economy plugin')";
const bundleHash = createHash("sha256").update(bundleBytes).digest("hex");
const secondBundleBytes = "console.log('economy plugin v2')";
const secondBundleHash = createHash("sha256").update(secondBundleBytes).digest("hex");

function signBundle(capabilities: PluginCapability[], overrides: Partial<PluginBundleSigningPayloadInput> = {}) {
  return createHmac("sha256", secret).update(pluginBundleSigningPayload({
    id: "bundle-1",
    pluginId: "economy_core",
    version: "1.0.0",
    bundleHash,
    signerId: "trusted-signer",
    runtimeType: "js_sidecar",
    capabilities,
    ...overrides
  })).digest("hex");
}

describe("AdminService deployment controls", () => {
  it("requests, approves, and kills plugin deployments", () => {
    let nextId = 0;
    const deployments = new PluginDeploymentManager({
      idFactory: () => `id-${++nextId}`,
      signers: [{ id: "trusted-signer", secret }]
    });
    deployments.registerBundle({
      id: "bundle-1",
      pluginId: "economy_core",
      version: "1.0.0",
      artifactUrl: "memory://economy_core.js",
      bundleHash,
      signature: signBundle([{ key: "economy.transfer" }]),
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [{ key: "economy.transfer" }]
    });
    const admin = new AdminService({
      runtime: new RuntimeControlPlane(),
      permissions: new PermissionStore(),
      plugins: new PluginRegistry(),
      deployments
    });

    const pending = admin.requestPluginDeployment({
      pluginId: "economy_core",
      bundleId: "bundle-1",
      serverId: "server-1",
      bundleBytes,
      requestedBy: "owner:1"
    });
    const active = admin.approvePluginDeployment(pending.id, "owner:1");

    expect(active.status).toBe("active");
    expect(admin.getPluginCapability("economy_core", "economy.transfer")).toEqual({
      key: "economy.transfer"
    });

    admin.killPlugin("economy_core", "owner:1", "disabled from admin");

    expect(() => admin.getPluginCapability("economy_core", "economy.transfer")).toThrow(
      "Plugin is not active: economy_core"
    );
  });

  it("disabling a plugin triggers the deployment kill switch", () => {
    let nextId = 0;
    const deployments = new PluginDeploymentManager({
      idFactory: () => `id-${++nextId}`,
      signers: [{ id: "trusted-signer", secret }]
    });
    deployments.registerBundle({
      id: "bundle-1",
      pluginId: "economy_core",
      version: "1.0.0",
      artifactUrl: "memory://economy_core.js",
      bundleHash,
      signature: signBundle([{ key: "economy.transfer" }]),
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [{ key: "economy.transfer" }]
    });
    const admin = new AdminService({
      runtime: new RuntimeControlPlane(),
      permissions: new PermissionStore(),
      plugins: new PluginRegistry(),
      deployments
    });

    admin.installPlugin({
      pluginId: "economy_core",
      name: "Economy Core",
      version: "1.0.0"
    });
    admin.enablePlugin("economy_core");
    const pending = admin.requestPluginDeployment({
      pluginId: "economy_core",
      bundleId: "bundle-1",
      serverId: "server-1",
      bundleBytes,
      requestedBy: "owner:1"
    });
    admin.approvePluginDeployment(pending.id, "owner:1");

    admin.disablePlugin("economy_core");

    expect(deployments.listDeployments()).toContainEqual(expect.objectContaining({
      id: pending.id,
      status: "killed",
      errorMessage: "plugin disabled"
    }));
    expect(() => admin.getPluginCapability("economy_core", "economy.transfer")).toThrow(
      "Plugin is not active: economy_core"
    );
    expect(deployments.getAuditLogs()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        actorId: "system",
        actionType: "plugin.kill_switch",
        pluginId: "economy_core",
        targetId: "economy_core"
      })
    ]));
  });

  it("exposes mirrored local sandbox events in deployment snapshots", () => {
    const admin = new AdminService({
      runtime: new RuntimeControlPlane(),
      permissions: new PermissionStore(),
      plugins: new PluginRegistry(),
      deployments: new PluginDeploymentManager({
        signers: [{ id: "trusted-signer", secret }]
      })
    });
    const events = [
      {
        id: "sandbox-event-1",
        pluginId: "economy_core",
        serverId: "server-1",
        eventType: "sidecar.started",
        payloadHash: "payload-hash-1",
        status: "succeeded" as const,
        createdAt: new Date("2026-05-18T12:00:00.000Z")
      },
      {
        id: "sandbox-event-2",
        pluginId: "economy_core",
        serverId: "server-1",
        eventType: "sidecar.heartbeat",
        payloadHash: "payload-hash-2",
        status: "succeeded" as const,
        createdAt: new Date("2026-05-18T12:00:10.000Z")
      }
    ];

    admin.mirrorPluginSandboxEvents(events);
    admin.mirrorPluginSandboxEvents(events);

    expect(admin.getDeploymentSnapshot().sandboxEvents).toEqual([
      expect.objectContaining({ id: "sandbox-event-1", eventType: "sidecar.started" }),
      expect.objectContaining({ id: "sandbox-event-2", eventType: "sidecar.heartbeat" })
    ]);
  });

  it("can scope plugin capability reads to a specific server", () => {
    let nextId = 0;
    const deployments = new PluginDeploymentManager({
      idFactory: () => `id-${++nextId}`,
      signers: [{ id: "trusted-signer", secret }]
    });
    deployments.registerBundle({
      id: "bundle-1",
      pluginId: "economy_core",
      version: "1.0.0",
      artifactUrl: "memory://economy_core.js",
      bundleHash,
      signature: signBundle([{ key: "economy.transfer" }]),
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [{ key: "economy.transfer" }]
    });
    const admin = new AdminService({
      runtime: new RuntimeControlPlane(),
      permissions: new PermissionStore(),
      plugins: new PluginRegistry(),
      deployments
    });

    admin.requestPluginDeployment({
      pluginId: "economy_core",
      bundleId: "bundle-1",
      serverId: "server-2",
      bundleBytes,
      requestedBy: "owner:1"
    });
    admin.approvePluginDeployment("id-1", "owner:1");

    expect(admin.getPluginCapability("economy_core", "economy.transfer", "server-2")).toEqual({
      key: "economy.transfer"
    });
    expect(() => admin.getPluginCapability("economy_core", "economy.transfer", "server-1")).toThrow(
      "Plugin is not active on server server-1: economy_core"
    );
  });

  it("revokes a single plugin bundle through admin controls", () => {
    let nextId = 0;
    const deployments = new PluginDeploymentManager({
      idFactory: () => `id-${++nextId}`,
      signers: [{ id: "trusted-signer", secret }]
    });
    deployments.registerBundle({
      id: "bundle-1",
      pluginId: "economy_core",
      version: "1.0.0",
      artifactUrl: "memory://economy_core.js",
      bundleHash,
      signature: signBundle([{ key: "economy.transfer" }]),
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [{ key: "economy.transfer" }]
    });
    const admin = new AdminService({
      runtime: new RuntimeControlPlane(),
      permissions: new PermissionStore(),
      plugins: new PluginRegistry(),
      deployments
    });
    const pending = admin.requestPluginDeployment({
      pluginId: "economy_core",
      bundleId: "bundle-1",
      serverId: "server-1",
      bundleBytes,
      requestedBy: "owner:1"
    });
    admin.approvePluginDeployment(pending.id, "owner:1");

    const killed = admin.revokePluginBundle("bundle-1", "owner:2", "bad release", "server-1");

    expect(killed).toEqual([
      expect.objectContaining({
        status: "killed",
        errorMessage: "bundle revoked: bad release"
      })
    ]);
    expect(admin.getDeploymentSnapshot().bundles).toEqual([
      expect.objectContaining({ id: "bundle-1", status: "revoked" })
    ]);
    expect(() => admin.getPluginCapability("economy_core", "economy.transfer", "server-1")).toThrow(
      "Plugin is not active on server server-1: economy_core"
    );
  });

  it("marks failed deployments and restores the previous server-scoped capability surface", () => {
    let nextId = 0;
    const deployments = new PluginDeploymentManager({
      idFactory: () => `deployment-${++nextId}`,
      signers: [{ id: "trusted-signer", secret }]
    });
    deployments.registerBundle({
      id: "bundle-1",
      pluginId: "economy_core",
      version: "1.0.0",
      artifactUrl: "memory://economy_core-1.0.0.js",
      bundleHash,
      signature: signBundle([{ key: "economy.transfer" }]),
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [{ key: "economy.transfer" }]
    });
    deployments.registerBundle({
      id: "bundle-2",
      pluginId: "economy_core",
      version: "2.0.0",
      artifactUrl: "memory://economy_core-2.0.0.js",
      bundleHash: secondBundleHash,
      signature: signBundle([{ key: "economy.transfer" }, { key: "economy.invoice" }], {
        id: "bundle-2",
        version: "2.0.0",
        bundleHash: secondBundleHash
      }),
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [{ key: "economy.transfer" }, { key: "economy.invoice" }]
    });
    deployments.deploy({
      pluginId: "economy_core",
      bundleId: "bundle-1",
      serverId: "server-1",
      bundleBytes
    });
    const active = deployments.deploy({
      pluginId: "economy_core",
      bundleId: "bundle-2",
      serverId: "server-1",
      bundleBytes: secondBundleBytes
    });
    const admin = new AdminService({
      runtime: new RuntimeControlPlane(),
      permissions: new PermissionStore(),
      plugins: new PluginRegistry(),
      deployments
    });

    const result = admin.failPluginDeployment(
      active.id,
      "runtime:server-1",
      "sidecar heartbeat timeout"
    );

    expect(result.failed).toEqual(expect.objectContaining({
      id: "deployment-2",
      status: "failed",
      errorMessage: "sidecar heartbeat timeout"
    }));
    expect(result.rollback).toEqual(expect.objectContaining({
      id: "deployment-3",
      status: "active",
      bundleId: "bundle-1",
      activeVersion: "1.0.0"
    }));
    expect(admin.getPluginCapability("economy_core", "economy.transfer", "server-1")).toEqual({
      key: "economy.transfer"
    });
    expect(() => admin.getPluginCapability("economy_core", "economy.invoice", "server-1")).toThrow(
      "Plugin lacks capability: economy.invoice"
    );
  });

  it("turns stale sidecar health failures into deployment failure rollback", async () => {
    let nextDeploymentId = 0;
    let currentTime = new Date("2026-05-18T12:00:00.000Z");
    const deployments = new PluginDeploymentManager({
      idFactory: () => `deployment-${++nextDeploymentId}`,
      signers: [{ id: "trusted-signer", secret }]
    });
    const firstBundle = deployments.registerBundle({
      id: "bundle-1",
      pluginId: "economy_core",
      version: "1.0.0",
      artifactUrl: "memory://economy_core-1.0.0.js",
      bundleHash,
      signature: signBundle([{ key: "economy.transfer" }]),
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [{ key: "economy.transfer" }]
    });
    const secondBundle = deployments.registerBundle({
      id: "bundle-2",
      pluginId: "economy_core",
      version: "2.0.0",
      artifactUrl: "memory://economy_core-2.0.0.js",
      bundleHash: secondBundleHash,
      signature: signBundle([{ key: "economy.transfer" }, { key: "economy.invoice" }], {
        id: "bundle-2",
        version: "2.0.0",
        bundleHash: secondBundleHash
      }),
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [{ key: "economy.transfer" }, { key: "economy.invoice" }]
    });
    deployments.deploy({
      pluginId: "economy_core",
      bundleId: firstBundle.id,
      serverId: "server-1",
      bundleBytes
    });
    const active = deployments.deploy({
      pluginId: "economy_core",
      bundleId: secondBundle.id,
      serverId: "server-1",
      bundleBytes: secondBundleBytes
    });
    const supervisor = new PluginSidecarSupervisor({
      driver: {
        async start() {
          return { pid: 1234 };
        },
        async stop() {}
      },
      now: () => currentTime,
      idFactory: () => "sidecar-1",
      heartbeatTimeoutMs: 30_000
    });
    await supervisor.start(active, secondBundle);
    const admin = new AdminService({
      runtime: new RuntimeControlPlane(),
      permissions: new PermissionStore(),
      plugins: new PluginRegistry(),
      deployments
    });

    currentTime = new Date("2026-05-18T12:01:00.000Z");
    const stale = await supervisor.failStaleInstances();
    const results = admin.failPluginSidecarDeployments(stale);

    expect(results).toEqual([
      {
        failed: expect.objectContaining({
          id: "deployment-2",
          status: "failed",
          errorMessage: "sidecar heartbeat timeout"
        }),
        rollback: expect.objectContaining({
          id: "deployment-3",
          bundleId: "bundle-1",
          status: "active",
          activeVersion: "1.0.0"
        })
      }
    ]);
    expect(admin.getPluginCapability("economy_core", "economy.transfer", "server-1")).toEqual({
      key: "economy.transfer"
    });
    expect(() => admin.getPluginCapability("economy_core", "economy.invoice", "server-1")).toThrow(
      "Plugin lacks capability: economy.invoice"
    );
  });

  it("skips stale sidecar failures for deployments that are no longer actionable", () => {
    let nextDeploymentId = 0;
    const deployments = new PluginDeploymentManager({
      idFactory: () => `deployment-${++nextDeploymentId}`,
      signers: [{ id: "trusted-signer", secret }]
    });
    deployments.registerBundle({
      id: "bundle-1",
      pluginId: "economy_core",
      version: "1.0.0",
      artifactUrl: "memory://economy_core.js",
      bundleHash,
      signature: signBundle([{ key: "economy.transfer" }]),
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [{ key: "economy.transfer" }]
    });
    const active = deployments.deploy({
      pluginId: "economy_core",
      bundleId: "bundle-1",
      serverId: "server-1",
      bundleBytes
    });
    deployments.failDeployment(active.id, "runtime:server-1", "already failed");
    const admin = new AdminService({
      runtime: new RuntimeControlPlane(),
      permissions: new PermissionStore(),
      plugins: new PluginRegistry(),
      deployments
    });

    const results = admin.failPluginSidecarDeployments([
      {
        id: "sidecar-1",
        deploymentId: active.id,
        pluginId: "economy_core",
        serverId: "server-1",
        bundleId: "bundle-1",
        runtimeType: "js_sidecar",
        status: "failed",
        startedAt: new Date("2026-05-18T12:00:00.000Z"),
        lastHeartbeatAt: new Date("2026-05-18T12:00:00.000Z"),
        errorMessage: "heartbeat timeout"
      }
    ]);

    expect(results).toEqual([]);
  });
});
