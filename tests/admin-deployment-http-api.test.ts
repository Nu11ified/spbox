import { createHash, createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createAdminHttpApi } from "../src/admin/http-api.js";
import { AdminService } from "../src/admin/service.js";
import { PermissionStore } from "../src/core/permission-store.js";
import {
  PluginDeploymentManager,
  pluginBundleSigningPayload,
  type PluginBundleSigningPayloadInput,
  type PluginCapability
} from "../src/core/plugin-deployment.js";
import { PluginRegistry } from "../src/core/plugins.js";
import { RuntimeControlPlane } from "../src/core/runtime.js";
import { FakeSpacetimeClient, SpacetimeRuntimeAdapter } from "../src/spacetime/adapter.js";

const secret = "test-signer-secret";
const bundleBytes = "console.log('admin plugin')";
const bundleHash = createHash("sha256").update(bundleBytes).digest("hex");
const secondBundleBytes = "console.log('admin plugin v2')";
const secondBundleHash = createHash("sha256").update(secondBundleBytes).digest("hex");

function signBundle(capabilities: PluginCapability[], overrides: Partial<PluginBundleSigningPayloadInput> = {}) {
  return createHmac("sha256", secret).update(pluginBundleSigningPayload({
    id: "bundle-1",
    pluginId: "admin_tools",
    version: "1.0.0",
    bundleHash,
    signerId: "trusted-signer",
    runtimeType: "js_sidecar",
    capabilities,
    ...overrides
  })).digest("hex");
}

function createApi() {
  let nextId = 0;
  const deployments = new PluginDeploymentManager({
    idFactory: () => `id-${++nextId}`,
    signers: [{ id: "trusted-signer", secret }],
    artifactFetcher: {
      async fetch() {
        return bundleBytes;
      }
    }
  });
  deployments.registerBundle({
    id: "bundle-1",
    pluginId: "admin_tools",
    version: "1.0.0",
    artifactUrl: "memory://admin_tools.js",
    bundleHash,
    signature: signBundle([{ key: "vehicle.repair" }]),
    signerId: "trusted-signer",
    runtimeType: "js_sidecar",
    capabilities: [{ key: "vehicle.repair" }]
  });

  return createAdminHttpApi(new AdminService({
    runtime: new RuntimeControlPlane(),
    permissions: new PermissionStore(),
    plugins: new PluginRegistry(),
    deployments
  }));
}

describe("admin deployment HTTP API", () => {
  it("requests, approves, and kills deployments through routes", async () => {
    const api = createApi();

    const pending = await api.handle({
      method: "POST",
      path: "/deployments/request",
      body: {
        pluginId: "admin_tools",
        bundleId: "bundle-1",
        serverId: "server-1",
        bundleBytes,
        requestedBy: "owner:1"
      }
    });
    const approved = await api.handle({
      method: "POST",
      path: `/deployments/${(pending.body as { id: string }).id}/approve`,
      body: { approvedBy: "owner:1" }
    });
    const killed = await api.handle({
      method: "POST",
      path: "/plugins/admin_tools/kill",
      body: { actorId: "owner:1", reason: "disabled from web" }
    });

    expect(pending.body).toEqual(expect.objectContaining({ status: "pending" }));
    expect(approved.body).toEqual(expect.objectContaining({ status: "active" }));
    expect(killed.body).toEqual([
      expect.objectContaining({ status: "killed", errorMessage: "disabled from web" })
    ]);
  });

  it("requests deployments from registered artifact URLs through routes", async () => {
    const api = createApi();

    const pending = await api.handle({
      method: "POST",
      path: "/deployments/request-from-artifact",
      body: {
        pluginId: "admin_tools",
        bundleId: "bundle-1",
        serverId: "server-1",
        requestedBy: "owner:1"
      }
    });

    expect(pending.body).toEqual(expect.objectContaining({
      status: "pending",
      pluginId: "admin_tools",
      bundleId: "bundle-1"
    }));
  });

  it("reads plugin capabilities through a server-scoped admin route", async () => {
    const api = createApi();

    const pending = await api.handle({
      method: "POST",
      path: "/deployments/request",
      body: {
        pluginId: "admin_tools",
        bundleId: "bundle-1",
        serverId: "server-2",
        bundleBytes,
        requestedBy: "owner:1"
      }
    });
    await api.handle({
      method: "POST",
      path: `/deployments/${(pending.body as { id: string }).id}/approve`,
      body: { approvedBy: "owner:1" }
    });

    await expect(api.handle({
      method: "GET",
      path: "/plugins/admin_tools/capabilities/vehicle.repair?serverId=server-2"
    })).resolves.toEqual({
      status: 200,
      body: { key: "vehicle.repair" }
    });
    await expect(api.handle({
      method: "GET",
      path: "/plugins/admin_tools/capabilities/vehicle.repair?serverId=server-1"
    })).resolves.toEqual({
      status: 400,
      body: { error: "Plugin is not active on server server-1: admin_tools" }
    });
  });

  it("revokes plugin signers through an admin route", async () => {
    const api = createApi();

    await expect(api.handle({
      method: "POST",
      path: "/signers/trusted-signer/revoke",
      body: { actorId: "owner:1", reason: "compromised signer", serverId: "server-1" }
    })).resolves.toEqual({
      status: 200,
      body: []
    });

    await expect(api.handle({
      method: "POST",
      path: "/deployments/request",
      body: {
        pluginId: "admin_tools",
        bundleId: "bundle-1",
        serverId: "server-1",
        bundleBytes,
        requestedBy: "owner:1"
      }
    })).resolves.toEqual({
      status: 400,
      body: { error: "Bundle signer has been revoked: trusted-signer" }
    });
  });

  it("returns deployments killed by signer revocation through the admin route", async () => {
    const api = createApi();
    const pending = await api.handle({
      method: "POST",
      path: "/deployments/request",
      body: {
        pluginId: "admin_tools",
        bundleId: "bundle-1",
        serverId: "server-1",
        bundleBytes,
        requestedBy: "owner:1"
      }
    });
    await api.handle({
      method: "POST",
      path: `/deployments/${(pending.body as { id: string }).id}/approve`,
      body: { approvedBy: "owner:1" }
    });

    await expect(api.handle({
      method: "POST",
      path: "/signers/trusted-signer/revoke",
      body: { actorId: "owner:1", reason: "compromised signer", serverId: "server-1" }
    })).resolves.toEqual({
      status: 200,
      body: [
        expect.objectContaining({
          pluginId: "admin_tools",
          status: "killed",
          errorMessage: "signer revoked: compromised signer"
        })
      ]
    });
  });

  it("revokes a single bundle through an admin route", async () => {
    const api = createApi();
    const pending = await api.handle({
      method: "POST",
      path: "/deployments/request",
      body: {
        pluginId: "admin_tools",
        bundleId: "bundle-1",
        serverId: "server-1",
        bundleBytes,
        requestedBy: "owner:1"
      }
    });
    await api.handle({
      method: "POST",
      path: `/deployments/${(pending.body as { id: string }).id}/approve`,
      body: { approvedBy: "owner:1" }
    });

    await expect(api.handle({
      method: "POST",
      path: "/bundles/bundle-1/revoke",
      body: { actorId: "owner:1", reason: "bad release", serverId: "server-1" }
    })).resolves.toEqual({
      status: 200,
      body: [
        expect.objectContaining({
          bundleId: "bundle-1",
          status: "killed",
          errorMessage: "bundle revoked: bad release"
        })
      ]
    });
    await expect(api.handle({
      method: "POST",
      path: "/deployments/request",
      body: {
        pluginId: "admin_tools",
        bundleId: "bundle-1",
        serverId: "server-2",
        bundleBytes,
        requestedBy: "owner:2"
      }
    })).resolves.toEqual({
      status: 400,
      body: { error: "Unknown or inactive bundle: bundle-1" }
    });
  });

  it("returns pending deployments killed by signer revocation through the admin route", async () => {
    const api = createApi();
    const pending = await api.handle({
      method: "POST",
      path: "/deployments/request",
      body: {
        pluginId: "admin_tools",
        bundleId: "bundle-1",
        serverId: "server-1",
        bundleBytes,
        requestedBy: "owner:1"
      }
    });

    await expect(api.handle({
      method: "POST",
      path: "/signers/trusted-signer/revoke",
      body: { actorId: "owner:1", reason: "compromised signer", serverId: "server-1" }
    })).resolves.toEqual({
      status: 200,
      body: [
        expect.objectContaining({
          id: (pending.body as { id: string }).id,
          pluginId: "admin_tools",
          status: "killed",
          errorMessage: "signer revoked: compromised signer"
        })
      ]
    });

    await expect(api.handle({
      method: "POST",
      path: `/deployments/${(pending.body as { id: string }).id}/approve`,
      body: { approvedBy: "owner:1" }
    })).resolves.toEqual({
      status: 400,
      body: { error: `Deployment is not pending: ${(pending.body as { id: string }).id}` }
    });
  });

  it("serves deployment reads from SpacetimeDB live cache", async () => {
    const client = new FakeSpacetimeClient({
      plugin_bundles: [
        {
          id: "bundle-1",
          pluginId: "admin_tools",
          version: "1.0.0",
          artifactUrl: "https://example.test/admin_tools.js",
          bundleHash,
          signature: signBundle([{ key: "vehicle.repair" }]),
          signerId: "trusted-signer",
          runtimeType: "js_sidecar",
          capabilities: [],
          status: "registered",
          createdAt: new Date("2026-05-18T12:00:00.000Z")
        }
      ],
      plugin_capabilities: [
        {
          id: "bundle-1:vehicle.repair",
          pluginId: "admin_tools",
          bundleId: "bundle-1",
          capabilityKey: "vehicle.repair",
          constraintsJson: "{\"maxDistance\":10}",
          status: "enabled"
        }
      ],
      plugin_deployments: [
        {
          id: "deployment-1",
          pluginId: "admin_tools",
          bundleId: "bundle-1",
          serverId: "server-1",
          status: "active",
          desiredVersion: "1.0.0",
          activeVersion: "1.0.0",
          deployedAt: new Date("2026-05-18T12:01:00.000Z"),
          errorMessage: ""
        }
      ],
      plugin_sandbox_events: [
        {
          id: "sandbox-event-1",
          pluginId: "admin_tools",
          serverId: "server-1",
          eventType: "sidecar.started",
          payloadHash: "payload-hash",
          status: "succeeded",
          createdAt: new Date("2026-05-18T12:01:30.000Z")
        }
      ]
    });
    const spacetime = new SpacetimeRuntimeAdapter(client);
    await spacetime.connectAndSubscribe("server-1");
    const api = createAdminHttpApi(new AdminService({
      runtime: new RuntimeControlPlane(),
      permissions: new PermissionStore(),
      plugins: new PluginRegistry(),
      spacetime
    }));

    await expect(api.handle({ method: "GET", path: "/deployments" })).resolves.toEqual({
      status: 200,
      body: {
        bundles: [expect.objectContaining({ id: "bundle-1", pluginId: "admin_tools" })],
        capabilities: [expect.objectContaining({ capabilityKey: "vehicle.repair", status: "enabled" })],
        deployments: [expect.objectContaining({ id: "deployment-1", status: "active" })],
        sandboxEvents: [expect.objectContaining({ id: "sandbox-event-1", eventType: "sidecar.started" })]
      }
    });
    await expect(api.handle({
      method: "GET",
      path: "/plugins/admin_tools/capabilities/vehicle.repair?serverId=server-1"
    })).resolves.toEqual({
      status: 200,
      body: {
        key: "vehicle.repair",
        constraints: { maxDistance: 10 }
      }
    });
    await expect(api.handle({
      method: "GET",
      path: "/plugins/admin_tools/capabilities/vehicle.repair?serverId=server-2"
    })).resolves.toEqual({
      status: 400,
      body: { error: "Plugin is not active on server server-2: admin_tools" }
    });
  });

  it("rolls deployments back through an admin route", async () => {
    let nextId = 0;
    const deployments = new PluginDeploymentManager({
      idFactory: () => `deployment-${++nextId}`,
      signers: [{ id: "trusted-signer", secret }]
    });
    deployments.registerBundle({
      id: "bundle-1",
      pluginId: "admin_tools",
      version: "1.0.0",
      artifactUrl: "memory://admin_tools-1.0.0.js",
      bundleHash,
      signature: signBundle([{ key: "vehicle.repair" }]),
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [{ key: "vehicle.repair" }]
    });
    deployments.registerBundle({
      id: "bundle-2",
      pluginId: "admin_tools",
      version: "2.0.0",
      artifactUrl: "memory://admin_tools-2.0.0.js",
      bundleHash: secondBundleHash,
      signature: signBundle([{ key: "vehicle.repair" }, { key: "vehicle.invoice" }], {
        id: "bundle-2",
        version: "2.0.0",
        bundleHash: secondBundleHash
      }),
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [{ key: "vehicle.repair" }, { key: "vehicle.invoice" }]
    });
    deployments.deploy({
      pluginId: "admin_tools",
      bundleId: "bundle-1",
      serverId: "server-1",
      bundleBytes
    });
    deployments.deploy({
      pluginId: "admin_tools",
      bundleId: "bundle-2",
      serverId: "server-1",
      bundleBytes: secondBundleBytes
    });
    const api = createAdminHttpApi(new AdminService({
      runtime: new RuntimeControlPlane(),
      permissions: new PermissionStore(),
      plugins: new PluginRegistry(),
      deployments
    }));

    await expect(api.handle({
      method: "POST",
      path: "/plugins/admin_tools/rollback",
      body: { serverId: "server-1" }
    })).resolves.toEqual({
      status: 200,
      body: expect.objectContaining({
        pluginId: "admin_tools",
        bundleId: "bundle-1",
        status: "active",
        activeVersion: "1.0.0"
      })
    });
  });

  it("marks failed deployments through an admin route and returns restored rollback state", async () => {
    let nextId = 0;
    const deployments = new PluginDeploymentManager({
      idFactory: () => `deployment-${++nextId}`,
      signers: [{ id: "trusted-signer", secret }]
    });
    deployments.registerBundle({
      id: "bundle-1",
      pluginId: "admin_tools",
      version: "1.0.0",
      artifactUrl: "memory://admin_tools-1.0.0.js",
      bundleHash,
      signature: signBundle([{ key: "vehicle.repair" }]),
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [{ key: "vehicle.repair" }]
    });
    deployments.registerBundle({
      id: "bundle-2",
      pluginId: "admin_tools",
      version: "2.0.0",
      artifactUrl: "memory://admin_tools-2.0.0.js",
      bundleHash: secondBundleHash,
      signature: signBundle([{ key: "vehicle.repair" }, { key: "vehicle.invoice" }], {
        id: "bundle-2",
        version: "2.0.0",
        bundleHash: secondBundleHash
      }),
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [{ key: "vehicle.repair" }, { key: "vehicle.invoice" }]
    });
    deployments.deploy({
      pluginId: "admin_tools",
      bundleId: "bundle-1",
      serverId: "server-1",
      bundleBytes
    });
    const active = deployments.deploy({
      pluginId: "admin_tools",
      bundleId: "bundle-2",
      serverId: "server-1",
      bundleBytes: secondBundleBytes
    });
    const api = createAdminHttpApi(new AdminService({
      runtime: new RuntimeControlPlane(),
      permissions: new PermissionStore(),
      plugins: new PluginRegistry(),
      deployments
    }));

    await expect(api.handle({
      method: "POST",
      path: `/deployments/${active.id}/fail`,
      body: {
        actorId: "runtime:server-1",
        reason: "sidecar heartbeat timeout"
      }
    })).resolves.toEqual({
      status: 200,
      body: {
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
    });

    await expect(api.handle({
      method: "GET",
      path: "/plugins/admin_tools/capabilities/vehicle.invoice?serverId=server-1"
    })).resolves.toEqual({
      status: 400,
      body: { error: "Plugin lacks capability: vehicle.invoice" }
    });
  });
});
