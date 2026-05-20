import { createHash, createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  HttpPluginArtifactFetcher,
  PluginDeploymentManager,
  pluginBundleSigningPayload,
  type PluginBundleSigningPayloadInput
} from "../src/core/plugin-deployment.js";

const secret = "test-signer-secret";
const bundleBytes = "console.log('mechanic plugin')";
const bundleHash = createHash("sha256").update(bundleBytes).digest("hex");
const signature = signBundle({});

function signBundle(overrides: Partial<PluginBundleSigningPayloadInput>): string {
  return createHmac("sha256", secret).update(pluginBundleSigningPayload({
    id: "bundle-1",
    pluginId: "mechanic_core",
    version: "1.0.0",
    bundleHash,
    signerId: "trusted-signer",
    runtimeType: "js_sidecar",
    capabilities: [{ key: "vehicle.repair" }],
    ...overrides
  })).digest("hex");
}

describe("PluginDeploymentManager", () => {
  it("fetches HTTP artifact bytes for runtime download workflows", async () => {
    const fetcher = new HttpPluginArtifactFetcher(async (artifactUrl) => {
      expect(artifactUrl).toBe("https://plugins.example.test/mechanic_core-1.0.0.js");
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        async arrayBuffer() {
          const bytes = Buffer.from(bundleBytes);
          return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        }
      };
    });

    await expect(fetcher.fetch("https://plugins.example.test/mechanic_core-1.0.0.js")).resolves.toEqual(
      Buffer.from(bundleBytes)
    );
    await expect(fetcher.fetch("memory://mechanic_core.js")).rejects.toThrow(
      "Unsupported plugin artifact URL"
    );
    await expect(fetcher.fetch("http://plugins.example.test/mechanic_core-1.0.0.js")).rejects.toThrow(
      "Plugin artifact URL must use HTTPS"
    );
  });

  it("activates a deployment only after hash and signature verification", () => {
    const manager = new PluginDeploymentManager({
      now: () => new Date("2026-05-18T12:00:00.000Z"),
      idFactory: () => "deployment-1",
      signers: [{ id: "trusted-signer", secret }]
    });

    manager.registerBundle({
      id: "bundle-1",
      pluginId: "mechanic_core",
      version: "1.0.0",
      artifactUrl: "memory://mechanic_core-1.0.0.js",
      bundleHash,
      signature: signBundle({
        capabilities: [
          {
            key: "vehicle.repair",
            constraints: { maxDistance: 20 }
          }
        ]
      }),
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [
        {
          key: "vehicle.repair",
          constraints: { maxDistance: 20 }
        }
      ]
    });

    const deployment = manager.deploy({
      pluginId: "mechanic_core",
      bundleId: "bundle-1",
      serverId: "server-1",
      bundleBytes
    });

    expect(deployment).toEqual({
      id: "deployment-1",
      pluginId: "mechanic_core",
      bundleId: "bundle-1",
      serverId: "server-1",
      status: "active",
      desiredVersion: "1.0.0",
      activeVersion: "1.0.0",
      deployedAt: new Date("2026-05-18T12:00:00.000Z")
    });
    expect(manager.assertCapability("mechanic_core", "vehicle.repair")).toEqual({
      key: "vehicle.repair",
      constraints: { maxDistance: 20 }
    });
    expect(manager.assertCapabilityForServer("mechanic_core", "server-1", "vehicle.repair")).toEqual({
      key: "vehicle.repair",
      constraints: { maxDistance: 20 }
    });
    expect(() => manager.assertCapabilityForServer("mechanic_core", "server-2", "vehicle.repair")).toThrow(
      "Plugin is not active on server server-2: mechanic_core"
    );
  });

  it("accepts explicit sha256 bundle hash prefixes during local activation", () => {
    const prefixedHash = `sha256:${bundleHash}`;
    const manager = new PluginDeploymentManager({
      now: () => new Date("2026-05-18T12:00:00.000Z"),
      idFactory: () => "deployment-1",
      signers: [{ id: "trusted-signer", secret }]
    });

    manager.registerBundle({
      id: "bundle-1",
      pluginId: "mechanic_core",
      version: "1.0.0",
      artifactUrl: "memory://mechanic_core-1.0.0.js",
      bundleHash: prefixedHash,
      signature: signBundle({ bundleHash: prefixedHash }),
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [{ key: "vehicle.repair" }]
    });

    const deployment = manager.deploy({
      pluginId: "mechanic_core",
      bundleId: "bundle-1",
      serverId: "server-1",
      bundleBytes
    });

    expect(deployment.status).toBe("active");
  });

  it("fails deployment when capability metadata is expanded after signing", () => {
    const manager = new PluginDeploymentManager({
      idFactory: () => "deployment-1",
      signers: [{ id: "trusted-signer", secret }]
    });
    manager.registerBundle({
      id: "bundle-1",
      pluginId: "mechanic_core",
      version: "1.0.0",
      artifactUrl: "memory://mechanic_core-1.0.0.js",
      bundleHash,
      signature: signBundle({ capabilities: [] }),
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [{ key: "vehicle.repair" }, { key: "economy.give_money" }]
    });

    const deployment = manager.deploy({
      pluginId: "mechanic_core",
      bundleId: "bundle-1",
      serverId: "server-1",
      bundleBytes
    });

    expect(deployment).toEqual(expect.objectContaining({
      status: "failed",
      errorMessage: "Bundle signature mismatch"
    }));
    expect(() => manager.assertCapabilityForServer("mechanic_core", "server-1", "economy.give_money")).toThrow(
      "Plugin is not active on server server-1: mechanic_core"
    );
  });

  it("rejects bundle metadata with duplicate capability keys", () => {
    const manager = new PluginDeploymentManager({
      signers: [{ id: "trusted-signer", secret }]
    });

    expect(() =>
      manager.registerBundle({
        id: "bundle-duplicate-capability",
        pluginId: "mechanic_core",
        version: "1.0.0",
        artifactUrl: "memory://mechanic_core-1.0.0.js",
        bundleHash,
        signature,
        signerId: "trusted-signer",
        runtimeType: "js_sidecar",
        capabilities: [
          { key: "vehicle.repair", constraints: { maxDistance: 20 } },
          { key: "vehicle.repair", constraints: { maxDistance: 200 } }
        ]
      })
    ).toThrow("Duplicate capability key in bundle bundle-duplicate-capability: vehicle.repair");
  });

  it("rejects bundle metadata with blank capability keys", () => {
    const manager = new PluginDeploymentManager({
      signers: [{ id: "trusted-signer", secret }]
    });

    expect(() =>
      manager.registerBundle({
        id: "bundle-blank-capability",
        pluginId: "mechanic_core",
        version: "1.0.0",
        artifactUrl: "memory://mechanic_core-1.0.0.js",
        bundleHash,
        signature,
        signerId: "trusted-signer",
        runtimeType: "js_sidecar",
        capabilities: [{ key: "vehicle.repair" }, { key: " " }]
      })
    ).toThrow("Capability key is required in bundle bundle-blank-capability");
  });

  it("rejects blank signed bundle metadata before local registration", () => {
    const manager = new PluginDeploymentManager({
      signers: [{ id: "trusted-signer", secret }]
    });

    expect(() =>
      manager.registerBundle({
        id: " ",
        pluginId: "mechanic_core",
        version: "1.0.0",
        artifactUrl: "memory://mechanic_core-1.0.0.js",
        bundleHash,
        signature,
        signerId: "trusted-signer",
        runtimeType: "js_sidecar",
        capabilities: [{ key: "vehicle.repair" }]
      })
    ).toThrow("Bundle id is required");

    expect(() =>
      manager.registerBundle({
        id: "bundle-blank-version",
        pluginId: "mechanic_core",
        version: " ",
        artifactUrl: "memory://mechanic_core-1.0.0.js",
        bundleHash,
        signature,
        signerId: "trusted-signer",
        runtimeType: "js_sidecar",
        capabilities: [{ key: "vehicle.repair" }]
      })
    ).toThrow("Bundle version is required");

    expect(() =>
      manager.registerBundle({
        id: "bundle-blank-artifact",
        pluginId: "mechanic_core",
        version: "1.0.0",
        artifactUrl: " ",
        bundleHash,
        signature,
        signerId: "trusted-signer",
        runtimeType: "js_sidecar",
        capabilities: [{ key: "vehicle.repair" }]
      })
    ).toThrow("Bundle artifact URL is required");

    expect(() =>
      manager.registerBundle({
        id: "bundle-blank-hash",
        pluginId: "mechanic_core",
        version: "1.0.0",
        artifactUrl: "memory://mechanic_core-1.0.0.js",
        bundleHash: " ",
        signature,
        signerId: "trusted-signer",
        runtimeType: "js_sidecar",
        capabilities: [{ key: "vehicle.repair" }]
      })
    ).toThrow("Bundle hash is required");

    expect(() =>
      manager.registerBundle({
        id: "bundle-md5-hash",
        pluginId: "mechanic_core",
        version: "1.0.0",
        artifactUrl: "memory://mechanic_core-1.0.0.js",
        bundleHash: `md5:${bundleHash}`,
        signature,
        signerId: "trusted-signer",
        runtimeType: "js_sidecar",
        capabilities: [{ key: "vehicle.repair" }]
      })
    ).toThrow("Bundle hash algorithm must be sha256");

    expect(() =>
      manager.registerBundle({
        id: "bundle-bad-sha",
        pluginId: "mechanic_core",
        version: "1.0.0",
        artifactUrl: "memory://mechanic_core-1.0.0.js",
        bundleHash: "sha256:not-a-hex-digest",
        signature,
        signerId: "trusted-signer",
        runtimeType: "js_sidecar",
        capabilities: [{ key: "vehicle.repair" }]
      })
    ).toThrow("Bundle sha256 digest must be 64 lowercase hex characters");

    expect(() =>
      manager.registerBundle({
        id: "bundle-blank-signature",
        pluginId: "mechanic_core",
        version: "1.0.0",
        artifactUrl: "memory://mechanic_core-1.0.0.js",
        bundleHash,
        signature: " ",
        signerId: "trusted-signer",
        runtimeType: "js_sidecar",
        capabilities: [{ key: "vehicle.repair" }]
      })
    ).toThrow("Bundle signature is required");
  });

  it("rejects invalid bundle runtime types before local registration", () => {
    const manager = new PluginDeploymentManager({
      signers: [{ id: "trusted-signer", secret }]
    });

    expect(() =>
      manager.registerBundle({
        id: "bundle-invalid-runtime",
        pluginId: "mechanic_core",
        version: "1.0.0",
        artifactUrl: "memory://mechanic_core-1.0.0.js",
        bundleHash,
        signature,
        signerId: "trusted-signer",
        runtimeType: "lua" as never,
        capabilities: [{ key: "vehicle.repair" }]
      })
    ).toThrow("Invalid plugin bundle runtime type: lua");
  });

  it("rejects bundle metadata with forbidden direct database sandbox capabilities", () => {
    const manager = new PluginDeploymentManager({
      signers: [{ id: "trusted-signer", secret }],
      approvedSandboxCapabilities: ["sandbox.database.write"]
    });

    expect(() =>
      manager.registerBundle({
        id: "bundle-forbidden-capability",
        pluginId: "mechanic_core",
        version: "1.0.0",
        artifactUrl: "memory://mechanic_core-1.0.0.js",
        bundleHash,
        signature,
        signerId: "trusted-signer",
        runtimeType: "js_sidecar",
        capabilities: [{ key: "vehicle.repair" }, { key: "sandbox.database.write" }]
      })
    ).toThrow("Sandbox capability is forbidden: sandbox.database.write");
  });

  it("rejects bundle metadata with malformed known capability constraints", () => {
    const manager = new PluginDeploymentManager({
      signers: [{ id: "trusted-signer", secret }]
    });

    expect(() =>
      manager.registerBundle({
        id: "bundle-array-constraints",
        pluginId: "mechanic_core",
        version: "1.0.0",
        artifactUrl: "memory://mechanic_core-1.0.0.js",
        bundleHash,
        signature,
        signerId: "trusted-signer",
        runtimeType: "js_sidecar",
        capabilities: [{ key: "vehicle.repair", constraints: [] }]
      })
    ).toThrow("Capability constraints must be an object in bundle bundle-array-constraints: vehicle.repair");

    expect(() =>
      manager.registerBundle({
        id: "bundle-string-constraints",
        pluginId: "mechanic_core",
        version: "1.0.0",
        artifactUrl: "memory://mechanic_core-1.0.0.js",
        bundleHash,
        signature,
        signerId: "trusted-signer",
        runtimeType: "js_sidecar",
        capabilities: [{ key: "vehicle.repair", constraints: "wide-open" }]
      })
    ).toThrow("Capability constraints must be an object in bundle bundle-string-constraints: vehicle.repair");

    expect(() =>
      manager.registerBundle({
        id: "bundle-malformed-limits",
        pluginId: "mechanic_core",
        version: "1.0.0",
        artifactUrl: "memory://mechanic_core-1.0.0.js",
        bundleHash,
        signature,
        signerId: "trusted-signer",
        runtimeType: "js_sidecar",
        capabilities: [{ key: "vehicle.repair", constraints: { payloadLimits: { targetVehicleNetId: "large" } } }]
      })
    ).toThrow("Invalid payload limit targetVehicleNetId for capability vehicle.repair");

    expect(() =>
      manager.registerBundle({
        id: "bundle-blank-limit-field",
        pluginId: "mechanic_core",
        version: "1.0.0",
        artifactUrl: "memory://mechanic_core-1.0.0.js",
        bundleHash,
        signature,
        signerId: "trusted-signer",
        runtimeType: "js_sidecar",
        capabilities: [{ key: "vehicle.repair", constraints: { payloadLimits: { " ": 50 } } }]
      })
    ).toThrow("Invalid payload limit field for capability vehicle.repair");

    expect(() =>
      manager.registerBundle({
        id: "bundle-spaced-limit-field",
        pluginId: "mechanic_core",
        version: "1.0.0",
        artifactUrl: "memory://mechanic_core-1.0.0.js",
        bundleHash,
        signature,
        signerId: "trusted-signer",
        runtimeType: "js_sidecar",
        capabilities: [{ key: "vehicle.repair", constraints: { payloadLimits: { " targetVehicleNetId ": 50 } } }]
      })
    ).toThrow("Invalid payload limit field for capability vehicle.repair");

    expect(() =>
      manager.registerBundle({
        id: "bundle-malformed-actors",
        pluginId: "mechanic_core",
        version: "1.0.0",
        artifactUrl: "memory://mechanic_core-1.0.0.js",
        bundleHash,
        signature,
        signerId: "trusted-signer",
        runtimeType: "js_sidecar",
        capabilities: [{ key: "vehicle.repair", constraints: { allowedActorPrincipals: [""] } }]
      })
    ).toThrow("Invalid allowed actor principals for capability vehicle.repair");

    expect(() =>
      manager.registerBundle({
        id: "bundle-whitespace-actors",
        pluginId: "mechanic_core",
        version: "1.0.0",
        artifactUrl: "memory://mechanic_core-1.0.0.js",
        bundleHash,
        signature,
        signerId: "trusted-signer",
        runtimeType: "js_sidecar",
        capabilities: [{ key: "vehicle.repair", constraints: { allowedActorPrincipals: ["player:mechanic", " "] } }]
      })
    ).toThrow("Invalid allowed actor principals for capability vehicle.repair");
  });

  it("rejects bundle metadata with malformed economy capability constraints", () => {
    const manager = new PluginDeploymentManager({
      signers: [{ id: "trusted-signer", secret }]
    });

    expect(() =>
      manager.registerBundle({
        id: "bundle-malformed-economy-max",
        pluginId: "mechanic_core",
        version: "1.0.0",
        artifactUrl: "memory://mechanic_core-1.0.0.js",
        bundleHash,
        signature,
        signerId: "trusted-signer",
        runtimeType: "js_sidecar",
        capabilities: [{ key: "economy.buy_item", constraints: { maxAmount: 0 } }]
      })
    ).toThrow("Invalid maxAmount constraint for capability economy.buy_item");

    expect(() =>
      manager.registerBundle({
        id: "bundle-malformed-economy-owner-types",
        pluginId: "mechanic_core",
        version: "1.0.0",
        artifactUrl: "memory://mechanic_core-1.0.0.js",
        bundleHash,
        signature,
        signerId: "trusted-signer",
        runtimeType: "js_sidecar",
        capabilities: [{ key: "economy.buy_item", constraints: { allowedAccountOwnerTypes: ["character", "admin"] } }]
      })
    ).toThrow("Invalid allowedAccountOwnerTypes constraint for capability economy.buy_item");

    expect(() =>
      manager.registerBundle({
        id: "bundle-malformed-economy-duty",
        pluginId: "mechanic_core",
        version: "1.0.0",
        artifactUrl: "memory://mechanic_core-1.0.0.js",
        bundleHash,
        signature,
        signerId: "trusted-signer",
        runtimeType: "js_sidecar",
        capabilities: [{ key: "economy.buy_item", constraints: { requires_on_duty: "yes" } }]
      })
    ).toThrow("Invalid requiresOnDuty constraint for capability economy.buy_item");
  });

  it("rejects duplicate bundle ids to preserve immutable bundle provenance", () => {
    const manager = new PluginDeploymentManager({
      signers: [{ id: "trusted-signer", secret }]
    });
    manager.registerBundle({
      id: "bundle-1",
      pluginId: "mechanic_core",
      version: "1.0.0",
      artifactUrl: "memory://mechanic_core-1.0.0.js",
      bundleHash,
      signature: signBundle({
        capabilities: [{ key: "vehicle.repair" }, { key: "sandbox.os" }]
      }),
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [{ key: "vehicle.repair" }]
    });

    expect(() =>
      manager.registerBundle({
        id: "bundle-1",
        pluginId: "mechanic_core",
        version: "2.0.0",
        artifactUrl: "memory://mechanic_core-2.0.0.js",
        bundleHash: createHash("sha256").update("console.log('v2')").digest("hex"),
        signature,
        signerId: "trusted-signer",
        runtimeType: "js_sidecar",
        capabilities: [{ key: "vehicle.invoice" }]
      })
    ).toThrow("Bundle already exists: bundle-1");
    expect(manager.listBundles()).toEqual([
      expect.objectContaining({
        id: "bundle-1",
        version: "1.0.0",
        capabilities: [{ key: "vehicle.repair" }]
      })
    ]);
  });

  it("fails deployment on tampered bundle content", () => {
    const manager = new PluginDeploymentManager({
      idFactory: () => "deployment-1",
      signers: [{ id: "trusted-signer", secret }]
    });
    manager.registerBundle({
      id: "bundle-1",
      pluginId: "mechanic_core",
      version: "1.0.0",
      artifactUrl: "memory://mechanic_core-1.0.0.js",
      bundleHash,
      signature: signBundle({
        capabilities: [{ key: "vehicle.repair" }, { key: "sandbox.network" }]
      }),
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: []
    });

    const deployment = manager.deploy({
      pluginId: "mechanic_core",
      bundleId: "bundle-1",
      serverId: "server-1",
      bundleBytes: "tampered"
    });

    expect(deployment.status).toBe("failed");
    expect(deployment.errorMessage).toBe("Bundle hash mismatch");
    expect(() => manager.assertCapability("mechanic_core", "vehicle.repair")).toThrow(
      "Plugin is not active: mechanic_core"
    );
    expect(manager.getAuditLogs()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        actorId: "system",
        actionType: "plugin.deployment_failed",
        pluginId: "mechanic_core",
        targetId: "deployment-1",
        status: "failed",
        after: { error: "Bundle hash mismatch" }
      })
    ]));
  });

  it("rejects blank deployment identity fields before local deployment writes", () => {
    const manager = new PluginDeploymentManager({
      signers: [{ id: "trusted-signer", secret }]
    });
    manager.registerBundle({
      id: "bundle-1",
      pluginId: "mechanic_core",
      version: "1.0.0",
      artifactUrl: "memory://mechanic_core-1.0.0.js",
      bundleHash,
      signature,
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [{ key: "vehicle.repair" }]
    });

    expect(() =>
      manager.deploy({
        pluginId: " ",
        bundleId: "bundle-1",
        serverId: "server-1",
        bundleBytes
      })
    ).toThrow("Plugin deployment plugin id is required");

    expect(() =>
      manager.deploy({
        pluginId: "mechanic_core",
        bundleId: " ",
        serverId: "server-1",
        bundleBytes
      })
    ).toThrow("Plugin deployment bundle id is required");

    expect(() =>
      manager.deploy({
        pluginId: "mechanic_core",
        bundleId: "bundle-1",
        serverId: " ",
        bundleBytes
      })
    ).toThrow("Plugin deployment server id is required");
  });

  it("rejects blank pending deployment requester identity before local deployment writes", () => {
    const manager = new PluginDeploymentManager({
      signers: [{ id: "trusted-signer", secret }]
    });
    manager.registerBundle({
      id: "bundle-1",
      pluginId: "mechanic_core",
      version: "1.0.0",
      artifactUrl: "memory://mechanic_core-1.0.0.js",
      bundleHash,
      signature,
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [{ key: "vehicle.repair" }]
    });

    expect(() =>
      manager.requestDeployment({
        pluginId: "mechanic_core",
        bundleId: "bundle-1",
        serverId: "server-1",
        bundleBytes,
        requestedBy: " "
      })
    ).toThrow("Plugin deployment requester is required");
  });

  it("fails direct deployment when a signed bundle requests unapproved sandbox capabilities", () => {
    const manager = new PluginDeploymentManager({
      idFactory: () => "deployment-1",
      signers: [{ id: "trusted-signer", secret }]
    });
    manager.registerBundle({
      id: "bundle-1",
      pluginId: "mechanic_core",
      version: "1.0.0",
      artifactUrl: "memory://mechanic_core-1.0.0.js",
      bundleHash,
      signature: signBundle({
        capabilities: [{ key: "vehicle.repair" }, { key: "sandbox.os" }]
      }),
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [{ key: "vehicle.repair" }, { key: "sandbox.os" }]
    });

    const deployment = manager.deploy({
      pluginId: "mechanic_core",
      bundleId: "bundle-1",
      serverId: "server-1",
      bundleBytes
    });

    expect(deployment).toEqual(expect.objectContaining({
      status: "failed",
      errorMessage: "Sandbox capability is not approved: sandbox.os"
    }));
    expect(() => manager.assertCapabilityForServer("mechanic_core", "server-1", "vehicle.repair")).toThrow(
      "Plugin is not active on server server-1: mechanic_core"
    );
    expect(manager.getAuditLogs()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        actorId: "system",
        actionType: "plugin.deployment_failed",
        pluginId: "mechanic_core",
        targetId: "deployment-1",
        status: "failed",
        after: { error: "Sandbox capability is not approved: sandbox.os" }
      })
    ]));
  });

  it("downloads a registered artifact before activating deployment", async () => {
    const fetchedUrls: string[] = [];
    const manager = new PluginDeploymentManager({
      now: () => new Date("2026-05-18T12:00:00.000Z"),
      idFactory: () => "deployment-1",
      signers: [{ id: "trusted-signer", secret }],
      artifactFetcher: {
        async fetch(artifactUrl) {
          fetchedUrls.push(artifactUrl);
          return bundleBytes;
        }
      }
    });
    manager.registerBundle({
      id: "bundle-1",
      pluginId: "mechanic_core",
      version: "1.0.0",
      artifactUrl: "https://plugins.example.test/mechanic_core-1.0.0.js",
      bundleHash,
      signature,
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [{ key: "vehicle.repair" }]
    });

    const deployment = await manager.deployFromArtifact({
      pluginId: "mechanic_core",
      bundleId: "bundle-1",
      serverId: "server-1"
    });

    expect(fetchedUrls).toEqual(["https://plugins.example.test/mechanic_core-1.0.0.js"]);
    expect(deployment).toEqual({
      id: "deployment-1",
      pluginId: "mechanic_core",
      bundleId: "bundle-1",
      serverId: "server-1",
      status: "active",
      desiredVersion: "1.0.0",
      activeVersion: "1.0.0",
      deployedAt: new Date("2026-05-18T12:00:00.000Z")
    });
  });

  it("rejects artifact direct deployments for mismatched plugins before downloading bytes", async () => {
    const fetchedUrls: string[] = [];
    const manager = new PluginDeploymentManager({
      signers: [{ id: "trusted-signer", secret }],
      artifactFetcher: {
        async fetch(artifactUrl) {
          fetchedUrls.push(artifactUrl);
          return bundleBytes;
        }
      }
    });
    manager.registerBundle({
      id: "bundle-1",
      pluginId: "mechanic_core",
      version: "1.0.0",
      artifactUrl: "https://plugins.example.test/mechanic_core-1.0.0.js",
      bundleHash,
      signature: signBundle({
        capabilities: [{ key: "vehicle.repair" }, { key: "sandbox.network" }]
      }),
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [{ key: "vehicle.repair" }]
    });

    await expect(manager.deployFromArtifact({
      pluginId: "wrong_plugin",
      bundleId: "bundle-1",
      serverId: "server-1"
    })).rejects.toThrow("Bundle bundle-1 does not belong to plugin wrong_plugin");
    expect(fetchedUrls).toEqual([]);
  });

  it("rejects artifact direct deployments for revoked signers before downloading bytes", async () => {
    const fetchedUrls: string[] = [];
    const manager = new PluginDeploymentManager({
      signers: [{ id: "trusted-signer", secret }],
      artifactFetcher: {
        async fetch(artifactUrl) {
          fetchedUrls.push(artifactUrl);
          return bundleBytes;
        }
      }
    });
    manager.registerBundle({
      id: "bundle-1",
      pluginId: "mechanic_core",
      version: "1.0.0",
      artifactUrl: "https://plugins.example.test/mechanic_core-1.0.0.js",
      bundleHash,
      signature: signBundle({
        capabilities: [{ key: "vehicle.repair" }, { key: "sandbox.network" }]
      }),
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [{ key: "vehicle.repair" }]
    });

    manager.revokeSigner("trusted-signer", "owner-1", "compromised signer");

    await expect(manager.deployFromArtifact({
      pluginId: "mechanic_core",
      bundleId: "bundle-1",
      serverId: "server-1"
    })).rejects.toThrow("Bundle signer has been revoked: trusted-signer");
    expect(fetchedUrls).toEqual([]);
  });

  it("fails downloaded artifact deployment when sandbox capabilities are unapproved", async () => {
    const manager = new PluginDeploymentManager({
      idFactory: () => "deployment-1",
      signers: [{ id: "trusted-signer", secret }],
      artifactFetcher: {
        async fetch() {
          return bundleBytes;
        }
      }
    });
    manager.registerBundle({
      id: "bundle-1",
      pluginId: "mechanic_core",
      version: "1.0.0",
      artifactUrl: "https://plugins.example.test/mechanic_core-1.0.0.js",
      bundleHash,
      signature: signBundle({
        capabilities: [{ key: "vehicle.repair" }, { key: "sandbox.network" }]
      }),
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [{ key: "vehicle.repair" }, { key: "sandbox.network" }]
    });

    const deployment = await manager.deployFromArtifact({
      pluginId: "mechanic_core",
      bundleId: "bundle-1",
      serverId: "server-1"
    });

    expect(deployment).toEqual(expect.objectContaining({
      status: "failed",
      errorMessage: "Sandbox capability is not approved: sandbox.network"
    }));
  });

  it("requests approval from downloaded artifact bytes", async () => {
    const manager = new PluginDeploymentManager({
      idFactory: () => "deployment-1",
      signers: [{ id: "trusted-signer", secret }],
      artifactFetcher: {
        async fetch() {
          return bundleBytes;
        }
      }
    });
    manager.registerBundle({
      id: "bundle-1",
      pluginId: "mechanic_core",
      version: "1.0.0",
      artifactUrl: "https://plugins.example.test/mechanic_core-1.0.0.js",
      bundleHash,
      signature,
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [{ key: "vehicle.repair" }]
    });

    const requested = await manager.requestDeploymentFromArtifact({
      pluginId: "mechanic_core",
      bundleId: "bundle-1",
      serverId: "server-1",
      requestedBy: "owner-1"
    });
    const approved = manager.approveDeployment(requested.id, "owner-2");

    expect(requested.status).toBe("pending");
    expect(approved.status).toBe("active");
    expect(manager.assertCapability("mechanic_core", "vehicle.repair")).toEqual({
      key: "vehicle.repair"
    });
  });

  it("rejects artifact deployment requests for revoked signers before downloading bytes", async () => {
    const fetchedUrls: string[] = [];
    const manager = new PluginDeploymentManager({
      signers: [{ id: "trusted-signer", secret }],
      artifactFetcher: {
        async fetch(artifactUrl) {
          fetchedUrls.push(artifactUrl);
          return bundleBytes;
        }
      }
    });
    manager.registerBundle({
      id: "bundle-1",
      pluginId: "mechanic_core",
      version: "1.0.0",
      artifactUrl: "https://plugins.example.test/mechanic_core-1.0.0.js",
      bundleHash,
      signature,
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [{ key: "vehicle.repair" }]
    });

    manager.revokeSigner("trusted-signer", "owner-1", "compromised signer");

    await expect(manager.requestDeploymentFromArtifact({
      pluginId: "mechanic_core",
      bundleId: "bundle-1",
      serverId: "server-1",
      requestedBy: "owner-1"
    })).rejects.toThrow("Bundle signer has been revoked: trusted-signer");
    expect(fetchedUrls).toEqual([]);
  });

  it("fails approval when a bundle requests unapproved sandbox capabilities", () => {
    const manager = new PluginDeploymentManager({
      idFactory: () => "deployment-1",
      signers: [{ id: "trusted-signer", secret }]
    });
    manager.registerBundle({
      id: "bundle-1",
      pluginId: "mechanic_core",
      version: "1.0.0",
      artifactUrl: "memory://mechanic_core-1.0.0.js",
      bundleHash,
      signature: signBundle({
        capabilities: [{ key: "vehicle.repair" }, { key: "sandbox.filesystem" }]
      }),
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [{ key: "vehicle.repair" }, { key: "sandbox.filesystem" }]
    });
    const requested = manager.requestDeployment({
      pluginId: "mechanic_core",
      bundleId: "bundle-1",
      serverId: "server-1",
      bundleBytes,
      requestedBy: "owner-1"
    });

    const approved = manager.approveDeployment(requested.id, "owner-2");

    expect(approved).toEqual(expect.objectContaining({
      status: "failed",
      errorMessage: "Sandbox capability is not approved: sandbox.filesystem"
    }));
    expect(() => manager.assertCapabilityForServer("mechanic_core", "server-1", "vehicle.repair")).toThrow(
      "Plugin is not active on server server-1: mechanic_core"
    );
    expect(manager.getAuditLogs()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        actorId: "owner-2",
        actionType: "plugin.deployment_failed",
        pluginId: "mechanic_core",
        targetId: "deployment-1",
        status: "failed",
        after: { error: "Sandbox capability is not approved: sandbox.filesystem" }
      })
    ]));
  });

  it("rejects blank deployment approval actors before mutating pending deployments", () => {
    const manager = new PluginDeploymentManager({
      idFactory: () => "deployment-1",
      signers: [{ id: "trusted-signer", secret }]
    });
    manager.registerBundle({
      id: "bundle-1",
      pluginId: "mechanic_core",
      version: "1.0.0",
      artifactUrl: "memory://mechanic_core-1.0.0.js",
      bundleHash,
      signature,
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [{ key: "vehicle.repair" }]
    });
    const requested = manager.requestDeployment({
      pluginId: "mechanic_core",
      bundleId: "bundle-1",
      serverId: "server-1",
      bundleBytes,
      requestedBy: "owner-1"
    });

    expect(() => manager.approveDeployment(requested.id, " ")).toThrow("Plugin deployment approver is required");
    expect(manager.listDeployments()).toEqual([
      expect.objectContaining({ id: requested.id, status: "pending" })
    ]);
    expect(manager.getAuditLogs()).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ actionType: "plugin.deployment_approved" })
    ]));
  });

  it("activates approved sandbox capabilities after hash and signature verification", () => {
    const manager = new PluginDeploymentManager({
      idFactory: () => "deployment-1",
      signers: [{ id: "trusted-signer", secret }],
      approvedSandboxCapabilities: ["sandbox.network"]
    });
    manager.registerBundle({
      id: "bundle-1",
      pluginId: "mechanic_core",
      version: "1.0.0",
      artifactUrl: "memory://mechanic_core-1.0.0.js",
      bundleHash,
      signature: signBundle({
        capabilities: [{ key: "vehicle.repair" }, { key: "sandbox.network" }]
      }),
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [{ key: "vehicle.repair" }, { key: "sandbox.network" }]
    });
    const requested = manager.requestDeployment({
      pluginId: "mechanic_core",
      bundleId: "bundle-1",
      serverId: "server-1",
      bundleBytes,
      requestedBy: "owner-1"
    });

    const approved = manager.approveDeployment(requested.id, "owner-2");

    expect(approved.status).toBe("active");
    expect(manager.assertCapabilityForServer("mechanic_core", "server-1", "sandbox.network")).toEqual({
      key: "sandbox.network"
    });
  });

  it("rejects direct database sandbox capabilities even when accidentally approved", () => {
    const manager = new PluginDeploymentManager({
      idFactory: () => "deployment-1",
      signers: [{ id: "trusted-signer", secret }],
      approvedSandboxCapabilities: ["sandbox.database.write"]
    });

    expect(() =>
      manager.registerBundle({
        id: "bundle-1",
        pluginId: "mechanic_core",
        version: "1.0.0",
        artifactUrl: "memory://mechanic_core-1.0.0.js",
        bundleHash,
        signature: signBundle({
          capabilities: [{ key: "vehicle.repair" }, { key: "sandbox.database.write" }]
        }),
        signerId: "trusted-signer",
        runtimeType: "js_sidecar",
        capabilities: [{ key: "vehicle.repair" }, { key: "sandbox.database.write" }]
      })
    ).toThrow("Sandbox capability is forbidden: sandbox.database.write");
  });

  it("supersedes the previous active deployment when a newer bundle activates directly", () => {
    let nextId = 0;
    const manager = new PluginDeploymentManager({
      idFactory: () => `deployment-${++nextId}`,
      signers: [{ id: "trusted-signer", secret }]
    });
    manager.registerBundle({
      id: "bundle-1",
      pluginId: "mechanic_core",
      version: "1.0.0",
      artifactUrl: "memory://mechanic_core-1.0.0.js",
      bundleHash,
      signature,
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [{ key: "vehicle.repair" }]
    });
    const first = manager.deploy({
      pluginId: "mechanic_core",
      bundleId: "bundle-1",
      serverId: "server-1",
      bundleBytes
    });
    const secondBytes = "console.log('mechanic plugin v2')";
    const secondHash = createHash("sha256").update(secondBytes).digest("hex");
    manager.registerBundle({
      id: "bundle-2",
      pluginId: "mechanic_core",
      version: "2.0.0",
      artifactUrl: "memory://mechanic_core-2.0.0.js",
      bundleHash: secondHash,
      signature: signBundle({
        id: "bundle-2",
        version: "2.0.0",
        bundleHash: secondHash,
        capabilities: [{ key: "vehicle.repair" }, { key: "vehicle.invoice" }]
      }),
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [{ key: "vehicle.repair" }, { key: "vehicle.invoice" }]
    });

    const second = manager.deploy({
      pluginId: "mechanic_core",
      bundleId: "bundle-2",
      serverId: "server-1",
      bundleBytes: secondBytes
    });

    expect(second.status).toBe("active");
    expect(manager.listDeployments()).toEqual([
      expect.objectContaining({ id: first.id, status: "rolled_back" }),
      expect.objectContaining({ id: second.id, status: "active" })
    ]);
    expect(manager.getActiveDeployment("mechanic_core", "server-1")).toEqual(
      expect.objectContaining({ id: second.id, activeVersion: "2.0.0" })
    );
  });

  it("supersedes the previous active deployment when a pending rollout is approved", () => {
    let nextId = 0;
    const manager = new PluginDeploymentManager({
      idFactory: () => `deployment-${++nextId}`,
      signers: [{ id: "trusted-signer", secret }]
    });
    manager.registerBundle({
      id: "bundle-1",
      pluginId: "mechanic_core",
      version: "1.0.0",
      artifactUrl: "memory://mechanic_core-1.0.0.js",
      bundleHash,
      signature,
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [{ key: "vehicle.repair" }]
    });
    const first = manager.deploy({
      pluginId: "mechanic_core",
      bundleId: "bundle-1",
      serverId: "server-1",
      bundleBytes
    });
    const secondBytes = "console.log('mechanic plugin v2')";
    const secondHash = createHash("sha256").update(secondBytes).digest("hex");
    manager.registerBundle({
      id: "bundle-2",
      pluginId: "mechanic_core",
      version: "2.0.0",
      artifactUrl: "memory://mechanic_core-2.0.0.js",
      bundleHash: secondHash,
      signature: signBundle({
        id: "bundle-2",
        version: "2.0.0",
        bundleHash: secondHash,
        capabilities: [{ key: "vehicle.repair" }, { key: "vehicle.invoice" }]
      }),
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [{ key: "vehicle.repair" }, { key: "vehicle.invoice" }]
    });
    const pending = manager.requestDeployment({
      pluginId: "mechanic_core",
      bundleId: "bundle-2",
      serverId: "server-1",
      bundleBytes: secondBytes,
      requestedBy: "owner:1"
    });

    const second = manager.approveDeployment(pending.id, "owner:2");

    expect(second.status).toBe("active");
    expect(manager.listDeployments()).toEqual([
      expect.objectContaining({ id: first.id, status: "rolled_back" }),
      expect.objectContaining({ id: second.id, status: "active" })
    ]);
  });

  it("can rollback to the previous active deployment", () => {
    let nextId = 0;
    const manager = new PluginDeploymentManager({
      idFactory: () => `deployment-${++nextId}`,
      signers: [{ id: "trusted-signer", secret }]
    });
    manager.registerBundle({
      id: "bundle-1",
      pluginId: "mechanic_core",
      version: "1.0.0",
      artifactUrl: "memory://mechanic_core-1.0.0.js",
      bundleHash,
      signature,
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [{ key: "vehicle.repair" }]
    });
    manager.deploy({
      pluginId: "mechanic_core",
      bundleId: "bundle-1",
      serverId: "server-1",
      bundleBytes
    });

    const secondBytes = "console.log('mechanic plugin v2')";
    const secondHash = createHash("sha256").update(secondBytes).digest("hex");
    manager.registerBundle({
      id: "bundle-2",
      pluginId: "mechanic_core",
      version: "2.0.0",
      artifactUrl: "memory://mechanic_core-2.0.0.js",
      bundleHash: secondHash,
      signature: signBundle({
        id: "bundle-2",
        version: "2.0.0",
        bundleHash: secondHash,
        capabilities: [{ key: "vehicle.repair" }, { key: "vehicle.invoice" }]
      }),
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [{ key: "vehicle.repair" }, { key: "vehicle.invoice" }]
    });
    manager.deploy({
      pluginId: "mechanic_core",
      bundleId: "bundle-2",
      serverId: "server-1",
      bundleBytes: secondBytes
    });

    const rollback = manager.rollback("mechanic_core", "server-1");

    expect(rollback.status).toBe("active");
    expect(rollback.activeVersion).toBe("1.0.0");
    expect(manager.getActiveDeployment("mechanic_core", "server-1")?.activeVersion).toBe("1.0.0");
    expect(() => manager.assertCapability("mechanic_core", "vehicle.invoice")).toThrow(
      "Plugin lacks capability: vehicle.invoice"
    );
    expect(manager.getAuditLogs()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actorId: "system",
          actionType: "plugin.deployment_rolled_back",
          pluginId: "mechanic_core",
          targetId: "deployment-2",
          after: {
            rollbackDeploymentId: "deployment-3",
            restoredBundleId: "bundle-1",
            restoredVersion: "1.0.0"
          }
        })
      ])
    );
  });

  it("does not manually rollback to a revoked previous bundle", () => {
    let nextId = 0;
    const manager = new PluginDeploymentManager({
      idFactory: () => `deployment-${++nextId}`,
      signers: [{ id: "trusted-signer", secret }]
    });
    manager.registerBundle({
      id: "bundle-1",
      pluginId: "mechanic_core",
      version: "1.0.0",
      artifactUrl: "memory://mechanic_core-1.0.0.js",
      bundleHash,
      signature,
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [{ key: "vehicle.repair" }]
    });
    manager.deploy({
      pluginId: "mechanic_core",
      bundleId: "bundle-1",
      serverId: "server-1",
      bundleBytes
    });
    const secondBytes = "console.log('mechanic plugin v2')";
    const secondHash = createHash("sha256").update(secondBytes).digest("hex");
    manager.registerBundle({
      id: "bundle-2",
      pluginId: "mechanic_core",
      version: "2.0.0",
      artifactUrl: "memory://mechanic_core-2.0.0.js",
      bundleHash: secondHash,
      signature: signBundle({
        id: "bundle-2",
        version: "2.0.0",
        bundleHash: secondHash,
        capabilities: [{ key: "vehicle.repair" }, { key: "vehicle.invoice" }]
      }),
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [{ key: "vehicle.repair" }, { key: "vehicle.invoice" }]
    });
    manager.deploy({
      pluginId: "mechanic_core",
      bundleId: "bundle-2",
      serverId: "server-1",
      bundleBytes: secondBytes
    });
    manager.revokeBundle("bundle-1", "owner:1", "compromised previous bundle");

    expect(() => manager.rollback("mechanic_core", "server-1")).toThrow(
      "No previous active deployment for mechanic_core on server-1"
    );
    expect(manager.getActiveDeployment("mechanic_core", "server-1")).toEqual(
      expect.objectContaining({
        bundleId: "bundle-2",
        activeVersion: "2.0.0"
      })
    );
  });

  it("does not manually rollback to a previous bundle from a revoked signer", () => {
    let nextId = 0;
    const manager = new PluginDeploymentManager({
      idFactory: () => `deployment-${++nextId}`,
      signers: [
        { id: "previous-signer", secret },
        { id: "trusted-signer", secret }
      ]
    });
    manager.registerBundle({
      id: "bundle-1",
      pluginId: "mechanic_core",
      version: "1.0.0",
      artifactUrl: "memory://mechanic_core-1.0.0.js",
      bundleHash,
      signature: signBundle({ signerId: "previous-signer" }),
      signerId: "previous-signer",
      runtimeType: "js_sidecar",
      capabilities: [{ key: "vehicle.repair" }]
    });
    manager.deploy({
      pluginId: "mechanic_core",
      bundleId: "bundle-1",
      serverId: "server-1",
      bundleBytes
    });
    const secondBytes = "console.log('mechanic plugin v2')";
    const secondHash = createHash("sha256").update(secondBytes).digest("hex");
    manager.registerBundle({
      id: "bundle-2",
      pluginId: "mechanic_core",
      version: "2.0.0",
      artifactUrl: "memory://mechanic_core-2.0.0.js",
      bundleHash: secondHash,
      signature: signBundle({
        id: "bundle-2",
        version: "2.0.0",
        bundleHash: secondHash,
        capabilities: [{ key: "vehicle.repair" }, { key: "vehicle.invoice" }]
      }),
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [{ key: "vehicle.repair" }, { key: "vehicle.invoice" }]
    });
    manager.deploy({
      pluginId: "mechanic_core",
      bundleId: "bundle-2",
      serverId: "server-1",
      bundleBytes: secondBytes
    });
    manager.revokeSigner("previous-signer", "owner:1", "compromised signer");

    expect(() => manager.rollback("mechanic_core", "server-1")).toThrow(
      "No previous active deployment for mechanic_core on server-1"
    );
    expect(manager.getActiveDeployment("mechanic_core", "server-1")).toEqual(
      expect.objectContaining({
        bundleId: "bundle-2",
        activeVersion: "2.0.0"
      })
    );
  });

  it("marks a failed active deployment and restores the previous signed bundle", () => {
    let nextId = 0;
    const manager = new PluginDeploymentManager({
      idFactory: () => `deployment-${++nextId}`,
      signers: [{ id: "trusted-signer", secret }]
    });
    manager.registerBundle({
      id: "bundle-1",
      pluginId: "mechanic_core",
      version: "1.0.0",
      artifactUrl: "memory://mechanic_core-1.0.0.js",
      bundleHash,
      signature,
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [{ key: "vehicle.repair" }]
    });
    manager.deploy({
      pluginId: "mechanic_core",
      bundleId: "bundle-1",
      serverId: "server-1",
      bundleBytes
    });

    const secondBytes = "console.log('mechanic plugin v2')";
    const secondHash = createHash("sha256").update(secondBytes).digest("hex");
    manager.registerBundle({
      id: "bundle-2",
      pluginId: "mechanic_core",
      version: "2.0.0",
      artifactUrl: "memory://mechanic_core-2.0.0.js",
      bundleHash: secondHash,
      signature: signBundle({
        id: "bundle-2",
        version: "2.0.0",
        bundleHash: secondHash,
        capabilities: [{ key: "vehicle.repair" }, { key: "vehicle.invoice" }]
      }),
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [{ key: "vehicle.repair" }, { key: "vehicle.invoice" }]
    });
    const active = manager.deploy({
      pluginId: "mechanic_core",
      bundleId: "bundle-2",
      serverId: "server-1",
      bundleBytes: secondBytes
    });

    const result = manager.failDeployment(
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
    expect(manager.getActiveDeployment("mechanic_core", "server-1")).toEqual(
      expect.objectContaining({
        id: "deployment-3",
        activeVersion: "1.0.0"
      })
    );
    expect(() => manager.assertCapabilityForServer("mechanic_core", "server-1", "vehicle.invoice")).toThrow(
      "Plugin lacks capability: vehicle.invoice"
    );
    expect(manager.getAuditLogs()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actorId: "runtime:server-1",
          actionType: "plugin.deployment_failed",
          pluginId: "mechanic_core",
          targetId: "deployment-2",
          status: "failed",
          after: { error: "sidecar heartbeat timeout" }
        }),
        expect.objectContaining({
          actorId: "runtime:server-1",
          actionType: "plugin.deployment_rolled_back",
          pluginId: "mechanic_core",
          targetId: "deployment-2",
          after: {
            rollbackDeploymentId: "deployment-3",
            restoredBundleId: "bundle-1",
            restoredVersion: "1.0.0"
          }
        })
      ])
    );
  });

  it("rejects blank deployment failure actors and reasons before mutating deployments", () => {
    const manager = new PluginDeploymentManager({
      idFactory: () => "deployment-1",
      signers: [{ id: "trusted-signer", secret }]
    });
    manager.registerBundle({
      id: "bundle-1",
      pluginId: "mechanic_core",
      version: "1.0.0",
      artifactUrl: "memory://mechanic_core-1.0.0.js",
      bundleHash,
      signature,
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [{ key: "vehicle.repair" }]
    });
    const active = manager.deploy({
      pluginId: "mechanic_core",
      bundleId: "bundle-1",
      serverId: "server-1",
      bundleBytes
    });

    expect(() => manager.failDeployment(active.id, " ", "sidecar heartbeat timeout")).toThrow(
      "Plugin deployment failure actor is required"
    );
    expect(() => manager.failDeployment(active.id, "runtime:server-1", " ")).toThrow(
      "Plugin deployment failure reason is required"
    );
    expect(manager.getActiveDeployment("mechanic_core", "server-1")).toEqual(
      expect.objectContaining({ id: active.id, status: "active" })
    );
  });

  it("does not restore a revoked previous bundle after active deployment failure", () => {
    let nextId = 0;
    const manager = new PluginDeploymentManager({
      idFactory: () => `deployment-${++nextId}`,
      signers: [{ id: "trusted-signer", secret }]
    });
    manager.registerBundle({
      id: "bundle-1",
      pluginId: "mechanic_core",
      version: "1.0.0",
      artifactUrl: "memory://mechanic_core-1.0.0.js",
      bundleHash,
      signature,
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [{ key: "vehicle.repair" }]
    });
    manager.deploy({
      pluginId: "mechanic_core",
      bundleId: "bundle-1",
      serverId: "server-1",
      bundleBytes
    });
    const secondBytes = "console.log('mechanic plugin v2')";
    const secondHash = createHash("sha256").update(secondBytes).digest("hex");
    manager.registerBundle({
      id: "bundle-2",
      pluginId: "mechanic_core",
      version: "2.0.0",
      artifactUrl: "memory://mechanic_core-2.0.0.js",
      bundleHash: secondHash,
      signature: signBundle({
        id: "bundle-2",
        version: "2.0.0",
        bundleHash: secondHash,
        capabilities: [{ key: "vehicle.repair" }, { key: "vehicle.invoice" }]
      }),
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [{ key: "vehicle.repair" }, { key: "vehicle.invoice" }]
    });
    const active = manager.deploy({
      pluginId: "mechanic_core",
      bundleId: "bundle-2",
      serverId: "server-1",
      bundleBytes: secondBytes
    });
    manager.revokeBundle("bundle-1", "owner:1", "compromised previous bundle");

    const result = manager.failDeployment(
      active.id,
      "runtime:server-1",
      "sidecar heartbeat timeout"
    );

    expect(result.failed).toEqual(expect.objectContaining({
      id: "deployment-2",
      status: "failed",
      errorMessage: "sidecar heartbeat timeout"
    }));
    expect(result.rollback).toBeUndefined();
    expect(manager.getActiveDeployment("mechanic_core", "server-1")).toBeUndefined();
    expect(manager.getAuditLogs()).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionType: "plugin.deployment_rolled_back",
          after: expect.objectContaining({
            restoredBundleId: "bundle-1"
          })
        })
      ])
    );
  });

  it("does not restore a previous bundle from a revoked signer after active deployment failure", () => {
    let nextId = 0;
    const manager = new PluginDeploymentManager({
      idFactory: () => `deployment-${++nextId}`,
      signers: [
        { id: "previous-signer", secret },
        { id: "trusted-signer", secret }
      ]
    });
    manager.registerBundle({
      id: "bundle-1",
      pluginId: "mechanic_core",
      version: "1.0.0",
      artifactUrl: "memory://mechanic_core-1.0.0.js",
      bundleHash,
      signature: signBundle({ signerId: "previous-signer" }),
      signerId: "previous-signer",
      runtimeType: "js_sidecar",
      capabilities: [{ key: "vehicle.repair" }]
    });
    manager.deploy({
      pluginId: "mechanic_core",
      bundleId: "bundle-1",
      serverId: "server-1",
      bundleBytes
    });
    const secondBytes = "console.log('mechanic plugin v2')";
    const secondHash = createHash("sha256").update(secondBytes).digest("hex");
    manager.registerBundle({
      id: "bundle-2",
      pluginId: "mechanic_core",
      version: "2.0.0",
      artifactUrl: "memory://mechanic_core-2.0.0.js",
      bundleHash: secondHash,
      signature: signBundle({
        id: "bundle-2",
        version: "2.0.0",
        bundleHash: secondHash,
        capabilities: [{ key: "vehicle.repair" }, { key: "vehicle.invoice" }]
      }),
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [{ key: "vehicle.repair" }, { key: "vehicle.invoice" }]
    });
    const active = manager.deploy({
      pluginId: "mechanic_core",
      bundleId: "bundle-2",
      serverId: "server-1",
      bundleBytes: secondBytes
    });
    manager.revokeSigner("previous-signer", "owner:1", "compromised signer");

    const result = manager.failDeployment(
      active.id,
      "runtime:server-1",
      "sidecar heartbeat timeout"
    );

    expect(result.failed).toEqual(expect.objectContaining({
      id: "deployment-2",
      status: "failed",
      errorMessage: "sidecar heartbeat timeout"
    }));
    expect(result.rollback).toBeUndefined();
    expect(manager.getActiveDeployment("mechanic_core", "server-1")).toBeUndefined();
    expect(manager.getAuditLogs()).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionType: "plugin.deployment_rolled_back",
          after: expect.objectContaining({
            restoredBundleId: "bundle-1"
          })
        })
      ])
    );
  });

  it("marks pending deployments failed without creating a rollback deployment", () => {
    let nextId = 0;
    const manager = new PluginDeploymentManager({
      idFactory: () => `deployment-${++nextId}`,
      signers: [{ id: "trusted-signer", secret }]
    });
    manager.registerBundle({
      id: "bundle-1",
      pluginId: "mechanic_core",
      version: "1.0.0",
      artifactUrl: "memory://mechanic_core-1.0.0.js",
      bundleHash,
      signature,
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities: [{ key: "vehicle.repair" }]
    });
    manager.deploy({
      pluginId: "mechanic_core",
      bundleId: "bundle-1",
      serverId: "server-1",
      bundleBytes
    });
    const pending = manager.requestDeployment({
      pluginId: "mechanic_core",
      bundleId: "bundle-1",
      serverId: "server-1",
      bundleBytes,
      requestedBy: "owner:1"
    });

    const result = manager.failDeployment(
      pending.id,
      "owner:1",
      "cancelled pending rollout"
    );

    expect(result).toEqual({
      failed: expect.objectContaining({
        id: "deployment-2",
        status: "failed",
        errorMessage: "cancelled pending rollout"
      }),
      rollback: undefined
    });
    expect(manager.listDeployments()).toEqual([
      expect.objectContaining({ id: "deployment-1", status: "active" }),
      expect.objectContaining({ id: "deployment-2", status: "failed" })
    ]);
    expect(manager.getActiveDeployment("mechanic_core", "server-1")).toEqual(
      expect.objectContaining({
        id: "deployment-1",
        status: "active"
      })
    );
  });
});
