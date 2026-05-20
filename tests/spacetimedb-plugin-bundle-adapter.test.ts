import { describe, expect, it } from "vitest";
import { FakeSpacetimeClient, SpacetimeRuntimeAdapter } from "../src/spacetime/adapter.js";

describe("SpacetimeRuntimeAdapter plugin bundle registry", () => {
  it("subscribes to plugin bundle and capability rows", async () => {
    const client = new FakeSpacetimeClient({
      plugin_bundles: [
        {
          id: "bundle-1",
          pluginId: "mechanic_core",
          version: "1.0.0",
          artifactUrl: "https://example.test/mechanic_core.js",
          bundleHash: "sha256:abc",
          signature: "sig",
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
          pluginId: "mechanic_core",
          bundleId: "bundle-1",
          capabilityKey: "vehicle.repair",
          constraintsJson: "{\"maxDistance\":10}",
          status: "enabled"
        }
      ]
    });
    const adapter = new SpacetimeRuntimeAdapter(client);

    await adapter.connectAndSubscribe("server-1");

    expect(client.subscribedTables).toContain("plugin_bundles");
    expect(client.subscribedTables).toContain("plugin_capabilities");
    expect(adapter.cache.getBundle("bundle-1")).toEqual(expect.objectContaining({
      id: "bundle-1",
      pluginId: "mechanic_core"
    }));
    expect(adapter.cache.getCapabilitiesForBundle("bundle-1")).toEqual([
      expect.objectContaining({
        id: "bundle-1:vehicle.repair",
        capabilityKey: "vehicle.repair",
        status: "enabled"
      })
    ]);

    client.emitUpdate("plugin_capabilities", {
      id: "bundle-1:vehicle.invoice",
      pluginId: "mechanic_core",
      bundleId: "bundle-1",
      capabilityKey: "vehicle.invoice",
      constraintsJson: "{}",
      status: "enabled"
    });

    expect(adapter.cache.getCapabilitiesForBundle("bundle-1").map((capability) => capability.capabilityKey)).toEqual([
      "vehicle.invoice",
      "vehicle.repair"
    ]);
  });

  it("calls bundle and capability reducers with typed arguments", async () => {
    const client = new FakeSpacetimeClient({});
    const adapter = new SpacetimeRuntimeAdapter(client);

    await adapter.registerPluginBundle({
      id: "bundle-1",
      pluginId: "mechanic_core",
      version: "1.0.0",
      artifactUrl: "https://example.test/mechanic_core.js",
      bundleHash: "sha256:abc",
      signature: "sig",
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      status: "registered"
    });
    await adapter.upsertPluginCapability({
      id: "bundle-1:vehicle.repair",
      pluginId: "mechanic_core",
      bundleId: "bundle-1",
      capabilityKey: "vehicle.repair",
      constraintsJson: "{\"maxDistance\":10}",
      status: "enabled"
    });

    expect(client.reducerCalls).toEqual([
      {
        name: "register_plugin_bundle",
        args: {
          id: "bundle-1",
          pluginId: "mechanic_core",
          version: "1.0.0",
          artifactUrl: "https://example.test/mechanic_core.js",
          bundleHash: "sha256:abc",
          signature: "sig",
          signerId: "trusted-signer",
          runtimeType: "js_sidecar",
          status: "registered"
        }
      },
      {
        name: "upsert_plugin_capability",
        args: {
          id: "bundle-1:vehicle.repair",
          pluginId: "mechanic_core",
          bundleId: "bundle-1",
          capabilityKey: "vehicle.repair",
          constraintsJson: "{\"maxDistance\":10}",
          status: "enabled"
        }
      }
    ]);
  });
});
