import { createHash, createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  PluginDeploymentManager,
  pluginBundleSigningPayload,
  type PluginBundleSigningPayloadInput,
  type PluginCapability
} from "../src/core/plugin-deployment.js";

const secret = "test-signer-secret";
const bundleBytes = "console.log('admin tools')";
const bundleHash = createHash("sha256").update(bundleBytes).digest("hex");
const defaultCapabilities: PluginCapability[] = [{ key: "vehicle.repair" }];

function signBundle(overrides: Partial<PluginBundleSigningPayloadInput> = {}) {
  return createHmac("sha256", secret).update(pluginBundleSigningPayload({
    id: "bundle-1",
    pluginId: "admin_tools",
    version: "1.0.0",
    bundleHash,
    signerId: "trusted-signer",
    runtimeType: "js_sidecar",
    capabilities: defaultCapabilities,
    ...overrides
  })).digest("hex");
}

function createManager() {
  let nextId = 0;
  const manager = new PluginDeploymentManager({
    now: () => new Date("2026-05-18T12:00:00.000Z"),
    idFactory: () => `id-${++nextId}`,
    signers: [{ id: "trusted-signer", secret }]
  });
  manager.registerBundle({
    id: "bundle-1",
    pluginId: "admin_tools",
    version: "1.0.0",
    artifactUrl: "memory://admin_tools-1.0.0.js",
    bundleHash,
    signature: signBundle(),
    signerId: "trusted-signer",
    runtimeType: "js_sidecar",
    capabilities: defaultCapabilities
  });
  return manager;
}

describe("PluginDeploymentManager lifecycle controls", () => {
  it("keeps deployments pending until explicitly approved", () => {
    const manager = createManager();

    const pending = manager.requestDeployment({
      pluginId: "admin_tools",
      bundleId: "bundle-1",
      serverId: "server-1",
      bundleBytes,
      requestedBy: "owner:1"
    });

    expect(pending.status).toBe("pending");
    expect(() => manager.assertCapability("admin_tools", "vehicle.repair")).toThrow(
      "Plugin is not active: admin_tools"
    );

    const active = manager.approveDeployment(pending.id, "owner:1");

    expect(active.status).toBe("active");
    expect(manager.assertCapability("admin_tools", "vehicle.repair")).toEqual({ key: "vehicle.repair" });
  });

  it("kill switch disables active deployments and capabilities", () => {
    const manager = createManager();
    const pending = manager.requestDeployment({
      pluginId: "admin_tools",
      bundleId: "bundle-1",
      serverId: "server-1",
      bundleBytes,
      requestedBy: "owner:1"
    });
    manager.approveDeployment(pending.id, "owner:1");

    const killed = manager.killSwitch("admin_tools", "owner:1", "compromised plugin");

    expect(killed).toEqual([
      expect.objectContaining({
        pluginId: "admin_tools",
        status: "killed",
        errorMessage: "compromised plugin"
      })
    ]);
    expect(() => manager.assertCapability("admin_tools", "vehicle.repair")).toThrow(
      "Plugin is not active: admin_tools"
    );
    expect(manager.getAuditLogs()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        actorId: "owner:1",
        actionType: "plugin.deployment_killed",
        targetId: pending.id,
        after: { reason: "compromised plugin" }
      })
    ]));
  });

  it("kill switch cancels pending deployments before they can be approved", () => {
    const manager = createManager();
    const pending = manager.requestDeployment({
      pluginId: "admin_tools",
      bundleId: "bundle-1",
      serverId: "server-1",
      bundleBytes,
      requestedBy: "owner:1"
    });

    const killed = manager.killSwitch("admin_tools", "owner:2", "compromised plugin");

    expect(killed).toEqual([
      expect.objectContaining({
        id: pending.id,
        pluginId: "admin_tools",
        status: "killed",
        errorMessage: "compromised plugin"
      })
    ]);
    expect(() => manager.approveDeployment(pending.id, "owner:1")).toThrow(
      `Deployment is not pending: ${pending.id}`
    );
    expect(() => manager.assertCapability("admin_tools", "vehicle.repair")).toThrow(
      "Plugin is not active: admin_tools"
    );
    expect(manager.getAuditLogs()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        actorId: "owner:2",
        actionType: "plugin.deployment_killed",
        targetId: pending.id,
        after: { reason: "compromised plugin" }
      })
    ]));
  });

  it("rejects blank kill switch actors and reasons before mutating deployments", () => {
    const manager = createManager();
    const pending = manager.requestDeployment({
      pluginId: "admin_tools",
      bundleId: "bundle-1",
      serverId: "server-1",
      bundleBytes,
      requestedBy: "owner:1"
    });

    expect(() => manager.killSwitch("admin_tools", " ", "compromised plugin")).toThrow(
      "Plugin kill switch actor is required"
    );
    expect(() => manager.killSwitch("admin_tools", "owner:2", " ")).toThrow(
      "Plugin kill switch reason is required"
    );
    expect(manager.listDeployments()).toEqual([
      expect.objectContaining({ id: pending.id, status: "pending" })
    ]);
    expect(manager.getAuditLogs()).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ actionType: "plugin.deployment_killed" }),
      expect.objectContaining({ actionType: "plugin.kill_switch" })
    ]));
  });

  it("revoking a signer blocks future deployment requests", () => {
    const manager = createManager();
    manager.revokeSigner("trusted-signer", "owner:1", "compromised signer");

    expect(() =>
      manager.requestDeployment({
        pluginId: "admin_tools",
        bundleId: "bundle-1",
        serverId: "server-1",
        bundleBytes,
        requestedBy: "owner:1"
      })
    ).toThrow(
      "Bundle signer has been revoked: trusted-signer"
    );
  });

  it("revoking a signer blocks future bundle registration", () => {
    const manager = createManager();
    manager.revokeSigner("trusted-signer", "owner:1", "compromised signer");

    expect(() =>
      manager.registerBundle({
        id: "bundle-2",
        pluginId: "admin_tools",
        version: "2.0.0",
        artifactUrl: "memory://admin_tools-2.0.0.js",
        bundleHash,
        signature: signBundle({ id: "bundle-2", version: "2.0.0", capabilities: [] }),
        signerId: "trusted-signer",
        runtimeType: "js_sidecar",
        capabilities: []
      })
    ).toThrow("Bundle signer has been revoked: trusted-signer");
  });

  it("rejects blank signer revocation actors and reasons before mutating signer trust or deployments", () => {
    const manager = createManager();
    const pending = manager.requestDeployment({
      pluginId: "admin_tools",
      bundleId: "bundle-1",
      serverId: "server-1",
      bundleBytes,
      requestedBy: "owner:1"
    });

    expect(() => manager.revokeSigner(" ", "owner:1", "compromised signer")).toThrow(
      "Plugin signer id is required"
    );
    expect(() => manager.revokeSigner("trusted-signer", " ", "compromised signer")).toThrow(
      "Plugin signer revocation actor is required"
    );
    expect(() => manager.revokeSigner("trusted-signer", "owner:1", " ")).toThrow(
      "Plugin signer revocation reason is required"
    );
    expect(manager.listDeployments()).toEqual([
      expect.objectContaining({ id: pending.id, status: "pending" })
    ]);
    expect(() =>
      manager.requestDeployment({
        pluginId: "admin_tools",
        bundleId: "bundle-1",
        serverId: "server-2",
        bundleBytes,
        requestedBy: "owner:2"
      })
    ).not.toThrow();
    expect(manager.getAuditLogs()).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ actionType: "plugin.signer_revoked" })
    ]));
  });

  it("revoking a signer kills pending deployments signed by that signer", () => {
    const manager = createManager();
    const pending = manager.requestDeployment({
      pluginId: "admin_tools",
      bundleId: "bundle-1",
      serverId: "server-1",
      bundleBytes,
      requestedBy: "owner:1"
    });

    const killed = manager.revokeSigner("trusted-signer", "owner:2", "compromised signer");

    expect(killed).toEqual([
      expect.objectContaining({
        id: pending.id,
        status: "killed",
        errorMessage: "signer revoked: compromised signer"
      })
    ]);
    expect(() => manager.approveDeployment(pending.id, "owner:1")).toThrow(
      `Deployment is not pending: ${pending.id}`
    );
    expect(manager.getAuditLogs()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        actionType: "plugin.deployment_killed",
        targetId: pending.id,
        after: { reason: "compromised signer", signerId: "trusted-signer" }
      }),
      expect.objectContaining({
        actionType: "plugin.signer_revoked",
        targetId: "trusted-signer",
        after: { reason: "compromised signer" }
      })
    ]));
  });

  it("revoking a signer kills already-active deployments signed by that signer", () => {
    const manager = createManager();
    const pending = manager.requestDeployment({
      pluginId: "admin_tools",
      bundleId: "bundle-1",
      serverId: "server-1",
      bundleBytes,
      requestedBy: "owner:1"
    });
    const active = manager.approveDeployment(pending.id, "owner:1");

    manager.revokeSigner("trusted-signer", "owner:1", "compromised signer");

    expect(manager.listDeployments()).toContainEqual({
      ...active,
      status: "killed",
      errorMessage: "signer revoked: compromised signer"
    });
    expect(() => manager.assertCapability("admin_tools", "vehicle.repair")).toThrow(
      "Plugin is not active: admin_tools"
    );
  });

  it("revoking a bundle kills only deployments for that bundle and blocks future use", () => {
    const manager = createManager();
    const secondBytes = "console.log('admin tools v2')";
    const secondHash = createHash("sha256").update(secondBytes).digest("hex");
    manager.registerBundle({
      id: "bundle-2",
      pluginId: "admin_tools",
      version: "2.0.0",
      artifactUrl: "memory://admin_tools-2.0.0.js",
      bundleHash: secondHash,
      signature: signBundle({
        id: "bundle-2",
        version: "2.0.0",
        bundleHash: secondHash,
        capabilities: [{ key: "vehicle.invoice" }]
      }),
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [{ key: "vehicle.invoice" }]
    });
    const pendingFirst = manager.requestDeployment({
      pluginId: "admin_tools",
      bundleId: "bundle-1",
      serverId: "server-1",
      bundleBytes,
      requestedBy: "owner:1"
    });
    const pendingSecond = manager.requestDeployment({
      pluginId: "admin_tools",
      bundleId: "bundle-2",
      serverId: "server-2",
      bundleBytes: secondBytes,
      requestedBy: "owner:1"
    });
    const activeSecond = manager.approveDeployment(pendingSecond.id, "owner:1");

    const killed = manager.revokeBundle("bundle-2", "owner:2", "compromised version");

    expect(killed).toEqual([
      expect.objectContaining({
        id: activeSecond.id,
        bundleId: "bundle-2",
        status: "killed",
        errorMessage: "bundle revoked: compromised version"
      })
    ]);
    expect(manager.listBundles()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "bundle-2", status: "revoked" }),
      expect.objectContaining({ id: "bundle-1", status: "registered" })
    ]));
    expect(manager.approveDeployment(pendingFirst.id, "owner:1")).toEqual(expect.objectContaining({
      status: "active",
      bundleId: "bundle-1"
    }));
    expect(() =>
      manager.requestDeployment({
        pluginId: "admin_tools",
        bundleId: "bundle-2",
        serverId: "server-3",
        bundleBytes: secondBytes,
        requestedBy: "owner:3"
      })
    ).toThrow("Unknown or inactive bundle: bundle-2");
    expect(manager.getAuditLogs()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        actorId: "owner:2",
        actionType: "plugin.bundle_revoked",
        targetId: "bundle-2",
        after: { reason: "compromised version" }
      }),
      expect.objectContaining({
        actorId: "owner:2",
        actionType: "plugin.deployment_killed",
        targetId: activeSecond.id
      })
    ]));
  });

  it("rejects blank bundle revocation actors and reasons before mutating bundle or deployments", () => {
    const manager = createManager();
    const pending = manager.requestDeployment({
      pluginId: "admin_tools",
      bundleId: "bundle-1",
      serverId: "server-1",
      bundleBytes,
      requestedBy: "owner:1"
    });

    expect(() => manager.revokeBundle("bundle-1", " ", "compromised version")).toThrow(
      "Plugin bundle revocation actor is required"
    );
    expect(() => manager.revokeBundle("bundle-1", "owner:2", " ")).toThrow(
      "Plugin bundle revocation reason is required"
    );
    expect(manager.listBundles()).toEqual([
      expect.objectContaining({ id: "bundle-1", status: "registered" })
    ]);
    expect(manager.listDeployments()).toEqual([
      expect.objectContaining({ id: pending.id, status: "pending" })
    ]);
    expect(manager.getAuditLogs()).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ actionType: "plugin.bundle_revoked" }),
      expect.objectContaining({ actionType: "plugin.deployment_killed" })
    ]));
  });

  it("records deployment lifecycle audit events", () => {
    const manager = createManager();
    const pending = manager.requestDeployment({
      pluginId: "admin_tools",
      bundleId: "bundle-1",
      serverId: "server-1",
      bundleBytes,
      requestedBy: "owner:1"
    });
    manager.approveDeployment(pending.id, "owner:1");
    manager.killSwitch("admin_tools", "owner:1", "maintenance");

    expect(manager.getAuditLogs()).toEqual([
      expect.objectContaining({ actionType: "plugin.bundle_registered", targetId: "bundle-1" }),
      expect.objectContaining({ actionType: "plugin.deployment_requested", actorId: "owner:1" }),
      expect.objectContaining({ actionType: "plugin.deployment_approved", actorId: "owner:1" }),
      expect.objectContaining({ actionType: "plugin.deployment_killed", actorId: "owner:1" }),
      expect.objectContaining({ actionType: "plugin.kill_switch", actorId: "owner:1" })
    ]);
  });
});
