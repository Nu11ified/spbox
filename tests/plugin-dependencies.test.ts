import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { hashPluginManifest, PluginRegistry, type PluginManifest } from "../src/core/plugins.js";

const packageSigner = { id: "trusted-marketplace", secret: "package-secret" };

function signPackageManifest(manifestHash: string): string {
  return createHmac("sha256", packageSigner.secret).update(manifestHash).digest("hex");
}

describe("PluginRegistry dependencies", () => {
  it("blocks enabling a plugin when required plugins are not active", () => {
    const registry = new PluginRegistry();
    registry.install({
      pluginId: "mechanic_plus",
      name: "Mechanic Plus",
      version: "1.0.0",
      requiredPlugins: ["mechanic_core"]
    });

    expect(() => registry.enable("mechanic_plus")).toThrow(
      "Plugin mechanic_plus requires active plugin mechanic_core"
    );
  });

  it("enables plugins when dependencies are active", () => {
    const registry = new PluginRegistry();
    registry.install({
      pluginId: "mechanic_core",
      name: "Mechanic Core",
      version: "1.0.0"
    });
    registry.install({
      pluginId: "mechanic_plus",
      name: "Mechanic Plus",
      version: "1.0.0",
      requiredPlugins: ["mechanic_core"]
    });

    registry.enable("mechanic_core");
    registry.enable("mechanic_plus");

    expect(registry.getPlugin("mechanic_plus")?.status).toBe("active");
  });

  it("validates required capabilities against active plugin manifests", () => {
    const registry = new PluginRegistry();
    registry.install({
      pluginId: "economy_core",
      name: "Economy Core",
      version: "1.0.0",
      providedCapabilities: ["economy.transfer"]
    });
    registry.install({
      pluginId: "shop_core",
      name: "Shop Core",
      version: "1.0.0",
      requiredCapabilities: ["economy.transfer"]
    });

    expect(() => registry.enable("shop_core")).toThrow(
      "Plugin shop_core requires active capability economy.transfer"
    );

    registry.enable("economy_core");
    registry.enable("shop_core");

    expect(registry.getPlugin("shop_core")?.status).toBe("active");
  });

  it("disables active dependents when a required plugin is disabled", () => {
    const registry = new PluginRegistry();
    registry.install({
      pluginId: "economy_core",
      name: "Economy Core",
      version: "1.0.0",
      providedCapabilities: ["economy.transfer"]
    });
    registry.install({
      pluginId: "shop_core",
      name: "Shop Core",
      version: "1.0.0",
      requiredPlugins: ["economy_core"],
      requiredCapabilities: ["economy.transfer"],
      menus: [{ id: "shop.buy", label: "Buy", action: "shop.buy" }],
      commands: [{ id: "shop.buy.command", name: "buy", action: "shop.buy" }],
      panels: [{ id: "shop.panel", title: "Shop", route: "/plugins/shop" }]
    });

    registry.enable("economy_core");
    registry.enable("shop_core");
    registry.disable("economy_core");

    expect(registry.getPlugin("economy_core")?.status).toBe("disabled");
    expect(registry.getPlugin("shop_core")?.status).toBe("disabled");
    expect(registry.getActiveMenus()).toEqual([]);
    expect(registry.getActiveCommands()).toEqual([]);
    expect(registry.getActivePanels()).toEqual([]);
    expect(registry.getAuditEvents()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionType: "plugin.disable",
          pluginId: "shop_core",
          after: expect.objectContaining({
            reason: "dependency_disabled",
            dependencyPluginId: "economy_core"
          })
        })
      ])
    );
  });

  it("disables active dependents when a FiveM dependency is disabled", () => {
    const registry = new PluginRegistry();
    registry.install({
      pluginId: "base_core",
      name: "Base Core",
      version: "1.0.0"
    });
    registry.install({
      pluginId: "legacy_bridge",
      name: "Legacy Bridge",
      version: "1.0.0",
      fivem: {
        dependencies: ["base_core"],
        provides: ["legacy_core"]
      }
    });

    registry.enable("base_core");
    registry.enable("legacy_bridge");
    registry.disable("base_core");

    expect(registry.getPlugin("legacy_bridge")?.status).toBe("disabled");
    expect(registry.getActiveFivemCompatibility()).toEqual([]);
  });

  it("disables active dependents when a FiveM provide shim is disabled", () => {
    const registry = new PluginRegistry();
    registry.install({
      pluginId: "sdb_qb_bridge",
      name: "SDB QB Bridge",
      version: "1.0.0",
      fivem: {
        provides: ["qb-core"]
      }
    });
    registry.install({
      pluginId: "qb_banking_adapter",
      name: "QB Banking Adapter",
      version: "1.0.0",
      fivem: {
        dependencies: ["qb-core"]
      }
    });

    registry.enable("sdb_qb_bridge");
    registry.enable("qb_banking_adapter");
    registry.disable("sdb_qb_bridge");

    expect(registry.getPlugin("qb_banking_adapter")?.status).toBe("disabled");
    expect(registry.getAuditEvents()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionType: "plugin.disable",
          pluginId: "qb_banking_adapter",
          after: expect.objectContaining({
            reason: "dependency_disabled",
            dependencyPluginId: "sdb_qb_bridge"
          })
        })
      ])
    );
  });

  it("disables active dependents when a required plugin is uninstalled", () => {
    const registry = new PluginRegistry();
    registry.install({
      pluginId: "economy_core",
      name: "Economy Core",
      version: "1.0.0",
      providedCapabilities: ["economy.transfer"]
    });
    registry.install({
      pluginId: "shop_core",
      name: "Shop Core",
      version: "1.0.0",
      requiredPlugins: ["economy_core"],
      requiredCapabilities: ["economy.transfer"],
      menus: [{ id: "shop.buy", label: "Buy", action: "shop.buy" }]
    });

    registry.enable("economy_core");
    registry.enable("shop_core");
    registry.uninstall("economy_core");

    expect(registry.getPlugin("economy_core")).toBeUndefined();
    expect(registry.getPlugin("shop_core")?.status).toBe("disabled");
    expect(registry.getActiveMenus()).toEqual([]);
    expect(registry.getAuditEvents()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionType: "plugin.disable",
          pluginId: "shop_core",
          after: expect.objectContaining({
            reason: "dependency_disabled",
            dependencyPluginId: "economy_core"
          })
        }),
        expect.objectContaining({
          actionType: "plugin.uninstall",
          pluginId: "economy_core"
        })
      ])
    );
  });

  it("disables active dependents when a package signer revokes a required package plugin", () => {
    const registry = new PluginRegistry({ packageSigners: [packageSigner] });
    const economyManifest: PluginManifest = {
      pluginId: "economy_core",
      name: "Economy Core",
      version: "1.0.0",
      providedCapabilities: ["economy.transfer"]
    };
    const economyManifestHash = hashPluginManifest(economyManifest);

    registry.installPackage({
      packageId: "marketplace:economy_core",
      pluginId: "economy_core",
      version: "1.0.0",
      source: "https://plugins.example.test/economy_core",
      publisher: "SDB Labs",
      trustLevel: "marketplace",
      signerId: packageSigner.id,
      signature: signPackageManifest(economyManifestHash),
      manifestHash: economyManifestHash,
      manifest: economyManifest
    });
    registry.install({
      pluginId: "shop_core",
      name: "Shop Core",
      version: "1.0.0",
      requiredPlugins: ["economy_core"],
      requiredCapabilities: ["economy.transfer"],
      menus: [{ id: "shop.buy", label: "Buy", action: "shop.buy" }]
    });

    registry.enable("economy_core");
    registry.enable("shop_core");

    expect(registry.revokePackageSigner(packageSigner.id, "owner:1", "compromised marketplace key")).toEqual([
      expect.objectContaining({ id: "economy_core", status: "disabled" }),
      expect.objectContaining({ id: "shop_core", status: "disabled" })
    ]);
    expect(registry.getActiveMenus()).toEqual([]);
    expect(registry.getAuditEvents()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionType: "plugin.disable",
          pluginId: "shop_core",
          after: expect.objectContaining({
            reason: "dependency_disabled",
            dependencyPluginId: "economy_core"
          })
        }),
        expect.objectContaining({
          actionType: "plugin.package_signer_revoked",
          targetId: packageSigner.id,
          actorId: "owner:1",
          after: expect.objectContaining({
            disabledPluginIds: ["economy_core", "shop_core"],
            reason: "compromised marketplace key"
          })
        })
      ])
    );
  });
});
