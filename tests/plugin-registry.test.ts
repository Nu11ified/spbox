import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { hashPluginManifest, PluginRegistry, type PluginManifest } from "../src/core/plugins.js";

const packageSigner = { id: "trusted-marketplace", secret: "package-secret" };

function signPackageManifest(manifestHash: string): string {
  return createHmac("sha256", packageSigner.secret).update(manifestHash).digest("hex");
}

describe("PluginRegistry", () => {
  it("installs and enables manifest-defined runtime primitives", () => {
    const registry = new PluginRegistry();

    registry.install({
      pluginId: "mechanic_core",
      name: "Mechanic Core",
      version: "1.0.0",
      permissions: [
        {
          key: "mechanic.repair",
          description: "Repair vehicles"
        }
      ],
      menus: [
        {
          id: "mechanic.repair",
          label: "Repair Vehicle",
          permission: "mechanic.repair",
          action: "vehicle.repair"
        }
      ],
      commands: [
        {
          id: "mechanic.repair.command",
          name: "repairveh",
          aliases: ["fixveh"],
          action: "vehicle.repair",
          permission: "mechanic.repair",
          payloadSchema: { type: "object" },
          auditLevel: "standard"
        }
      ],
      panels: [
        {
          id: "mechanic.work_orders",
          title: "Work Orders",
          route: "/plugins/mechanic/work-orders",
          requiredPermission: "mechanic.repair",
          icon: "clipboard-list",
          order: 20
        }
      ],
      configSchema: {
        hourlyRate: { type: "number", default: 75 }
      }
    });

    registry.enable("mechanic_core");

    expect(registry.getPlugin("mechanic_core")).toEqual(
      expect.objectContaining({
        id: "mechanic_core",
        status: "active",
        version: "1.0.0"
      })
    );
    expect(registry.getActivePermissions()).toEqual([
      {
        key: "mechanic.repair",
        description: "Repair vehicles",
        pluginId: "mechanic_core"
      }
    ]);
    expect(registry.getActiveMenus()).toEqual([
      {
        id: "mechanic.repair",
        pluginId: "mechanic_core",
        label: "Repair Vehicle",
        requiredPermission: "mechanic.repair",
        actionId: "vehicle.repair",
        enabled: true
      }
    ]);
    expect(registry.getActiveCommands()).toEqual([
      {
        id: "mechanic.repair.command",
        pluginId: "mechanic_core",
        name: "repairveh",
        aliases: ["fixveh"],
        actionId: "vehicle.repair",
        requiredPermission: "mechanic.repair",
        payloadSchema: { type: "object" },
        auditLevel: "standard",
        enabled: true
      }
    ]);
    expect(registry.getActivePanels()).toEqual([
      {
        id: "mechanic.work_orders",
        pluginId: "mechanic_core",
        title: "Work Orders",
        route: "/plugins/mechanic/work-orders",
        requiredPermission: "mechanic.repair",
        icon: "clipboard-list",
        order: 20,
        enabled: true
      }
    ]);
  });

  it("removes active primitives when a plugin is disabled while retaining the manifest", () => {
    const registry = new PluginRegistry();
    registry.install({
      pluginId: "economy_core",
      name: "Economy Core",
      version: "1.0.0",
      permissions: [{ key: "economy.transfer", description: "Transfer money" }],
      menus: [
        {
          id: "economy.transfer",
          label: "Transfer",
          permission: "economy.transfer",
          action: "economy.transfer"
        }
      ],
      commands: [
        {
          id: "economy.transfer.command",
          name: "pay",
          action: "economy.transfer",
          permission: "economy.transfer"
        }
      ],
      panels: [
        {
          id: "economy.panel",
          title: "Economy",
          route: "/plugins/economy"
        }
      ]
    });
    registry.enable("economy_core");
    registry.disable("economy_core");

    expect(registry.getPlugin("economy_core")?.status).toBe("disabled");
    expect(registry.getActivePermissions()).toEqual([]);
    expect(registry.getActiveMenus()).toEqual([]);
    expect(registry.getActiveCommands()).toEqual([]);
    expect(registry.getActivePanels()).toEqual([]);
    expect(registry.getManifest("economy_core")).toEqual(
      expect.objectContaining({ pluginId: "economy_core", version: "1.0.0" })
    );
  });

  it("uninstalls plugin records and manifests", () => {
    const registry = new PluginRegistry();
    registry.install({
      pluginId: "weather_core",
      name: "Weather Core",
      version: "1.0.0"
    });

    registry.uninstall("weather_core");

    expect(registry.getPlugin("weather_core")).toBeUndefined();
    expect(registry.getManifest("weather_core")).toBeUndefined();
    expect(registry.listPlugins()).toEqual([]);
  });

  it("rejects blank plugin ids before lifecycle status or uninstall mutation", () => {
    const registry = new PluginRegistry();
    registry.install({
      pluginId: "mechanic_core",
      name: "Mechanic Core",
      version: "1.0.0"
    });

    expect(() => registry.enable(" ")).toThrow("Plugin id is required");
    expect(() => registry.disable(" ")).toThrow("Plugin id is required");
    expect(() => registry.uninstall(" ")).toThrow("Plugin id is required");
    expect(registry.getPlugin("mechanic_core")).toEqual(expect.objectContaining({ status: "installed" }));
    expect(registry.getAuditEvents()).toEqual([
      expect.objectContaining({ actionType: "plugin.install", pluginId: "mechanic_core" })
    ]);
  });

  it("records plugin lifecycle audit events", () => {
    const registry = new PluginRegistry({
      now: () => new Date("2026-05-18T12:00:00.000Z"),
      packageSigners: [packageSigner]
    });

    registry.install({
      pluginId: "mechanic_core",
      name: "Mechanic Core",
      version: "1.0.0"
    });
    registry.enable("mechanic_core");
    registry.disable("mechanic_core");
    registry.uninstall("mechanic_core");

    expect(registry.getAuditEvents()).toEqual([
      expect.objectContaining({
        actorId: "system",
        pluginId: "mechanic_core",
        actionType: "plugin.install",
        targetType: "plugin",
        targetId: "mechanic_core",
        status: "succeeded"
      }),
      expect.objectContaining({ actionType: "plugin.enable", pluginId: "mechanic_core" }),
      expect.objectContaining({ actionType: "plugin.disable", pluginId: "mechanic_core" }),
      expect.objectContaining({ actionType: "plugin.uninstall", pluginId: "mechanic_core" })
    ]);
  });

  it("installs marketplace packages through validated manifest metadata", () => {
    const registry = new PluginRegistry({
      now: () => new Date("2026-05-18T12:00:00.000Z"),
      packageSigners: [packageSigner]
    });
    const manifest: PluginManifest = {
      pluginId: "mechanic_core",
      name: "Mechanic Core",
      version: "1.0.0",
      permissions: [{ key: "mechanic.repair", description: "Repair vehicles" }]
    };

    const record = registry.installPackage({
      packageId: "marketplace:mechanic_core",
      pluginId: "mechanic_core",
      version: "1.0.0",
      source: "https://plugins.example.test/mechanic_core",
      publisher: "SDB Labs",
      trustLevel: "marketplace",
      signerId: packageSigner.id,
      signature: signPackageManifest(hashPluginManifest(manifest)),
      manifestHash: hashPluginManifest(manifest),
      manifest
    });

    expect(record).toEqual(expect.objectContaining({
      id: "mechanic_core",
      status: "installed",
      version: "1.0.0"
    }));
    expect(registry.listPackages()).toEqual([
      {
        packageId: "marketplace:mechanic_core",
        pluginId: "mechanic_core",
        version: "1.0.0",
        source: "https://plugins.example.test/mechanic_core",
        publisher: "SDB Labs",
        trustLevel: "marketplace",
        signerId: packageSigner.id,
        signature: signPackageManifest(hashPluginManifest(manifest)),
        manifestHash: hashPluginManifest(manifest),
        installedAt: new Date("2026-05-18T12:00:00.000Z"),
        updatedAt: new Date("2026-05-18T12:00:00.000Z")
      }
    ]);
    expect(registry.getAuditEvents()).toContainEqual(
      expect.objectContaining({
        actionType: "plugin.package_install",
        pluginId: "mechanic_core",
        after: expect.objectContaining({
          packageId: "marketplace:mechanic_core",
          source: "https://plugins.example.test/mechanic_core",
          trustLevel: "marketplace"
        })
      })
    );
  });

  it("rejects marketplace packages whose manifest identity does not match package metadata", () => {
    const registry = new PluginRegistry();

    expect(() =>
      registry.installPackage({
        packageId: "marketplace:mechanic_core",
        pluginId: "mechanic_core",
        version: "1.0.0",
        source: "https://plugins.example.test/mechanic_core",
        publisher: "SDB Labs",
        trustLevel: "marketplace",
        signerId: packageSigner.id,
        signature: "sig:mechanic",
        manifestHash: "sha256:manifest",
        manifest: {
          pluginId: "other_core",
          name: "Other Core",
          version: "1.0.0"
        }
      })
    ).toThrow("Plugin package marketplace:mechanic_core manifest pluginId does not match mechanic_core");

    expect(registry.listPlugins()).toEqual([]);
    expect(registry.listPackages()).toEqual([]);
  });

  it("rejects marketplace packages whose manifest hash does not match the manifest", () => {
    const registry = new PluginRegistry();

    expect(() =>
      registry.installPackage({
        packageId: "marketplace:mechanic_core",
        pluginId: "mechanic_core",
        version: "1.0.0",
        source: "https://plugins.example.test/mechanic_core",
        publisher: "SDB Labs",
        trustLevel: "marketplace",
        signerId: packageSigner.id,
        signature: "sig:mechanic",
        manifestHash: "sha256:wrong",
        manifest: {
          pluginId: "mechanic_core",
          name: "Mechanic Core",
          version: "1.0.0"
        }
      })
    ).toThrow("Plugin package marketplace:mechanic_core manifest hash mismatch");

    expect(registry.listPlugins()).toEqual([]);
    expect(registry.listPackages()).toEqual([]);
  });

  it("rejects marketplace packages whose signature does not match the trusted signer", () => {
    const registry = new PluginRegistry({ packageSigners: [packageSigner] });
    const manifest: PluginManifest = {
      pluginId: "mechanic_core",
      name: "Mechanic Core",
      version: "1.0.0"
    };

    expect(() =>
      registry.installPackage({
        packageId: "marketplace:mechanic_core",
        pluginId: "mechanic_core",
        version: "1.0.0",
        source: "https://plugins.example.test/mechanic_core",
        publisher: "SDB Labs",
        trustLevel: "marketplace",
        signerId: packageSigner.id,
        signature: "bad-signature",
        manifestHash: hashPluginManifest(manifest),
        manifest
      })
    ).toThrow("Plugin package marketplace:mechanic_core signature mismatch");

    expect(registry.listPlugins()).toEqual([]);
    expect(registry.listPackages()).toEqual([]);
  });

  it("revokes package signers, disables installed packages from that signer, and blocks future trust", () => {
    const registry = new PluginRegistry({ packageSigners: [packageSigner] });
    const manifest: PluginManifest = {
      pluginId: "mechanic_core",
      name: "Mechanic Core",
      version: "1.0.0"
    };
    const manifestHash = hashPluginManifest(manifest);

    registry.installPackage({
      packageId: "marketplace:mechanic_core",
      pluginId: "mechanic_core",
      version: "1.0.0",
      source: "https://plugins.example.test/mechanic_core",
      publisher: "SDB Labs",
      trustLevel: "marketplace",
      signerId: packageSigner.id,
      signature: signPackageManifest(manifestHash),
      manifestHash,
      manifest
    });
    registry.enable("mechanic_core");

    expect(registry.revokePackageSigner(packageSigner.id, "owner:1", "compromised marketplace key")).toEqual([
      expect.objectContaining({
        id: "mechanic_core",
        status: "disabled"
      })
    ]);
    expect(() => registry.enable("mechanic_core")).toThrow("Package signer has been revoked: trusted-marketplace");
    expect(() =>
      registry.installPackage({
        packageId: "marketplace:mechanic_core_2",
        pluginId: "mechanic_core",
        version: "1.0.0",
        source: "https://plugins.example.test/mechanic_core",
        publisher: "SDB Labs",
        trustLevel: "marketplace",
        signerId: packageSigner.id,
        signature: signPackageManifest(manifestHash),
        manifestHash,
        manifest
      })
    ).toThrow("Package signer has been revoked: trusted-marketplace");
    expect(registry.getAuditEvents()).toContainEqual(
      expect.objectContaining({
        actionType: "plugin.package_signer_revoked",
        targetType: "package_signer",
        targetId: packageSigner.id,
        actorId: "owner:1",
        after: expect.objectContaining({
          signerId: packageSigner.id,
          disabledPluginIds: ["mechanic_core"],
          reason: "compromised marketplace key"
        })
      })
    );
    expect(registry.getAuditEvents()).toContainEqual(
      expect.objectContaining({
        actionType: "plugin.disable",
        pluginId: "mechanic_core",
        after: expect.objectContaining({
          reason: "package_signer_revoked",
          signerId: packageSigner.id
        })
      })
    );
  });

  it("records package signer revocation audit events even when no package is installed", () => {
    const registry = new PluginRegistry({ packageSigners: [packageSigner] });

    expect(registry.revokePackageSigner(packageSigner.id, "owner:1", "compromised marketplace key")).toEqual([]);

    expect(registry.getAuditEvents()).toContainEqual(
      expect.objectContaining({
        actionType: "plugin.package_signer_revoked",
        targetType: "package_signer",
        targetId: packageSigner.id,
        actorId: "owner:1",
        after: {
          signerId: packageSigner.id,
          disabledPluginIds: [],
          reason: "compromised marketplace key"
        }
      })
    );
  });

  it("rejects blank package signer revocation ids before writing audit events", () => {
    const registry = new PluginRegistry({ packageSigners: [packageSigner] });

    expect(() =>
      registry.revokePackageSigner(" ", "owner:1", "compromised marketplace key")
    ).toThrow("Package signer id is required");
    expect(registry.getAuditEvents()).toEqual([]);
  });

  it("exposes active config schemas and validates plugin config values", () => {
    const registry = new PluginRegistry();
    registry.install({
      pluginId: "mechanic_core",
      name: "Mechanic Core",
      version: "1.0.0",
      configSchema: {
        hourlyRate: { type: "number", default: 75 },
        callsignPrefix: { type: "string", default: "MECH" }
      }
    });

    expect(registry.getActiveConfigSchemas()).toEqual([]);

    registry.enable("mechanic_core");

    expect(registry.getActiveConfigSchemas()).toEqual([
      {
        pluginId: "mechanic_core",
        key: "callsignPrefix",
        schema: { type: "string", default: "MECH" },
        defaultValue: "MECH"
      },
      {
        pluginId: "mechanic_core",
        key: "hourlyRate",
        schema: { type: "number", default: 75 },
        defaultValue: 75
      }
    ]);
    expect(() => registry.assertConfigValue("mechanic_core", "hourlyRate", "75")).toThrow(
      "Expected hourlyRate to be number"
    );
    expect(() => registry.assertConfigValue("mechanic_core", "missing", true)).toThrow(
      "Unknown plugin config key: mechanic_core:missing"
    );
    expect(() => registry.assertConfigValue("mechanic_core", "hourlyRate", 80)).not.toThrow();
  });

  it("rejects config writes for installed but inactive plugins", () => {
    const registry = new PluginRegistry();
    registry.install({
      pluginId: "mechanic_core",
      name: "Mechanic Core",
      version: "1.0.0",
      configSchema: {
        hourlyRate: { type: "number", default: 75 }
      }
    });

    expect(() => registry.assertConfigValue("mechanic_core", "hourlyRate", 75)).toThrow(
      "Plugin config is not active: mechanic_core"
    );
  });

  it("understands FiveM compatibility metadata for active plugins", () => {
    const registry = new PluginRegistry();
    registry.install({
      pluginId: "base_core",
      name: "Base Core",
      version: "1.0.0",
      providedCapabilities: ["identity"]
    });
    registry.install({
      pluginId: "legacy_banking_bridge",
      name: "Legacy Banking Bridge",
      version: "1.0.0",
      permissions: [{ key: "economy.read", description: "Read balances" }],
      fivem: {
        dependencies: ["base_core"],
        files: ["ui/index.html", "ui/app.js"],
        nuiPage: "ui/index.html",
        provides: ["legacy_banking"],
        exports: [
          {
            name: "GetBalance",
            action: "economy.get_balance",
            permission: "economy.read"
          }
        ],
        serverCommands: [
          {
            name: "balance",
            action: "economy.balance",
            permission: "economy.read"
          }
        ]
      }
    });

    expect(() => registry.enable("legacy_banking_bridge")).toThrow(
      "Plugin legacy_banking_bridge requires active FiveM dependency base_core"
    );

    registry.enable("base_core");
    registry.enable("legacy_banking_bridge");

    expect(registry.getActiveFivemCompatibility()).toEqual([
      {
        pluginId: "legacy_banking_bridge",
        dependencies: ["base_core"],
        files: ["ui/index.html", "ui/app.js"],
        nuiPage: "ui/index.html",
        provides: ["legacy_banking"],
        exports: [
          {
            name: "GetBalance",
            actionId: "economy.get_balance",
            requiredPermission: "economy.read"
          }
        ],
        serverCommands: [
          {
            name: "balance",
            actionId: "economy.balance",
            requiredPermission: "economy.read"
          }
        ],
        enabled: true
      }
    ]);
  });

  it("allows FiveM dependencies to be satisfied by active provide shims", () => {
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

    expect(registry.getPlugin("qb_banking_adapter")?.status).toBe("active");
  });

  it("rejects FiveM compatibility entries that reference undeclared permissions", () => {
    const registry = new PluginRegistry();

    expect(() =>
      registry.install({
        pluginId: "bad_bridge",
        name: "Bad Bridge",
        version: "1.0.0",
        fivem: {
          exports: [
            {
              name: "GiveMoney",
              action: "economy.give_money",
              permission: "economy.admin"
            }
          ]
        }
      })
    ).toThrow("FiveM export GiveMoney references undeclared permission: economy.admin");
  });

  it("exposes approved plugin schema declarations from manifests", () => {
    const registry = new PluginRegistry();
    registry.install({
      pluginId: "mechanic_core",
      name: "Mechanic Core",
      version: "1.0.0",
      schemas: [
        {
          entityType: "work_order",
          schemaVersion: 1,
          schema: {
            type: "object",
            required: ["status"],
            properties: {
              status: { type: "string" }
            }
          },
          migrationPlan: [{ step: "create_json_entity_type", entityType: "work_order" }],
          approved: true
        },
        {
          entityType: "private_note",
          schemaVersion: 1,
          schema: { type: "object" },
          approved: false
        }
      ]
    });

    expect(registry.getApprovedSchemaDeclarations()).toEqual([
      {
        pluginId: "mechanic_core",
        entityType: "work_order",
        schemaVersion: 1,
        schema: {
          type: "object",
          required: ["status"],
          properties: {
            status: { type: "string" }
          }
        },
        migrationPlan: [{ step: "create_json_entity_type", entityType: "work_order" }],
        status: "approved"
      }
    ]);
  });

  it("rejects malformed plugin schema declarations", () => {
    const registry = new PluginRegistry();

    expect(() =>
      registry.install({
        pluginId: "bad_schema",
        name: "Bad Schema",
        version: "1.0.0",
        schemas: [
          {
            entityType: "work_order",
            schemaVersion: 0,
            schema: { type: "object" },
            approved: true
          }
        ]
      })
    ).toThrow("Plugin schema work_order requires a positive schemaVersion");

    expect(() =>
      registry.install({
        pluginId: "bad_nested_schema",
        name: "Bad Nested Schema",
        version: "1.0.0",
        schemas: [
          {
            entityType: "work_order",
            schemaVersion: 1,
            schema: {
              type: "object",
              properties: {
                status: { type: "integer" as never }
              }
            },
            approved: true
          }
        ]
      })
    ).toThrow("Plugin schema work_order.properties.status has invalid schema type: integer");
  });

  it("rejects unsafe plugin schema migration plans", () => {
    const registry = new PluginRegistry();

    expect(() =>
      registry.install({
        pluginId: "bad_migration",
        name: "Bad Migration",
        version: "1.0.0",
        schemas: [
          {
            entityType: "work_order",
            schemaVersion: 1,
            schema: { type: "object" },
            migrationPlan: [{ step: "run_sql", sql: "drop table accounts" }],
            approved: true
          }
        ]
      })
    ).toThrow("Plugin schema work_order migration step run_sql is not supported");

    expect(() =>
      registry.install({
        pluginId: "wrong_entity_migration",
        name: "Wrong Entity Migration",
        version: "1.0.0",
        schemas: [
          {
            entityType: "work_order",
            schemaVersion: 1,
            schema: { type: "object" },
            migrationPlan: [{ step: "create_json_entity_type", entityType: "invoice" }],
            approved: true
          }
        ]
      })
    ).toThrow("Plugin schema work_order migration step create_json_entity_type targets invoice");

    expect(() =>
      registry.install({
        pluginId: "bad_property_migration",
        name: "Bad Property Migration",
        version: "1.0.0",
        schemas: [
          {
            entityType: "work_order",
            schemaVersion: 1,
            schema: { type: "object" },
            migrationPlan: [
              {
                step: "add_optional_property",
                property: "status",
                schema: { type: "integer" as never }
              }
            ],
            approved: true
          }
        ]
      })
    ).toThrow("Plugin schema work_order migration add_optional_property.status has invalid schema type: integer");
  });

  it("rejects malformed config schema declarations", () => {
    const registry = new PluginRegistry();

    expect(() =>
      registry.install({
        pluginId: "bad_config",
        name: "Bad Config",
        version: "1.0.0",
        configSchema: {
          hourlyRate: { type: "integer" }
        }
      })
    ).toThrow("Config schema hourlyRate has invalid schema type: integer");

    expect(() =>
      registry.install({
        pluginId: "bad_nested_config",
        name: "Bad Nested Config",
        version: "1.0.0",
        configSchema: {
          vehicleRules: {
            type: "object",
            properties: {
              maxDistance: "number"
            }
          }
        }
      })
    ).toThrow("Config schema vehicleRules.properties.maxDistance must be an object");
  });

  it("rejects malformed or duplicate capability declarations", () => {
    const registry = new PluginRegistry();

    expect(() =>
      registry.install({
        pluginId: "bad_provided_capabilities",
        name: "Bad Provided Capabilities",
        version: "1.0.0",
        providedCapabilities: ["economy.transfer", "economy.transfer"]
      })
    ).toThrow("Duplicate provided capability in plugin bad_provided_capabilities: economy.transfer");

    expect(() =>
      registry.install({
        pluginId: "bad_required_capabilities",
        name: "Bad Required Capabilities",
        version: "1.0.0",
        requiredCapabilities: ["", "economy.transfer"]
      })
    ).toThrow("Plugin bad_required_capabilities required capability must be a non-empty string");
  });

  it("rejects malformed runtime primitive declarations", () => {
    const registry = new PluginRegistry();

    expect(() =>
      registry.install({
        pluginId: "bad_menu_action",
        name: "Bad Menu Action",
        version: "1.0.0",
        menus: [
          { id: "menu.repair", label: "Repair", action: "" }
        ]
      })
    ).toThrow("Menu menu.repair action must be a non-empty string");

    expect(() =>
      registry.install({
        pluginId: "bad_command_payload",
        name: "Bad Command Payload",
        version: "1.0.0",
        commands: [
          {
            id: "cmd.repair",
            name: "repairveh",
            action: "vehicle.repair",
            payloadSchema: { type: "integer" }
          }
        ]
      })
    ).toThrow("Command cmd.repair payloadSchema has invalid schema type: integer");

    expect(() =>
      registry.install({
        pluginId: "bad_panel_route",
        name: "Bad Panel Route",
        version: "1.0.0",
        panels: [
          { id: "panel.bad", title: "Bad", route: "" }
        ]
      })
    ).toThrow("Panel panel.bad route must be a non-empty string");

    expect(() =>
      registry.install({
        pluginId: "bad_fivem_export",
        name: "Bad FiveM Export",
        version: "1.0.0",
        fivem: {
          exports: [{ name: "GetBalance", action: "" }]
        }
      })
    ).toThrow("FiveM export GetBalance action must be a non-empty string");

    expect(() =>
      registry.install({
        pluginId: "bad_fivem_server_command",
        name: "Bad FiveM Server Command",
        version: "1.0.0",
        fivem: {
          serverCommands: [{ name: "givecash", action: "economy.admin.give_cash" }]
        }
      })
    ).toThrow("FiveM server command givecash requires a permission");
  });

  it("rejects duplicate manifest primitive identifiers before install", () => {
    const registry = new PluginRegistry();

    expect(() =>
      registry.install({
        pluginId: "bad_permissions",
        name: "Bad Permissions",
        version: "1.0.0",
        permissions: [
          { key: "mechanic.repair", description: "Repair vehicles" },
          { key: "mechanic.repair", description: "Repair again" }
        ]
      })
    ).toThrow("Duplicate permission key in plugin bad_permissions: mechanic.repair");

    expect(() =>
      registry.install({
        pluginId: "bad_menus",
        name: "Bad Menus",
        version: "1.0.0",
        menus: [
          { id: "mechanic.repair", label: "Repair", action: "vehicle.repair" },
          { id: "mechanic.repair", label: "Repair Duplicate", action: "vehicle.repair" }
        ]
      })
    ).toThrow("Duplicate menu id in plugin bad_menus: mechanic.repair");

    expect(() =>
      registry.install({
        pluginId: "bad_commands",
        name: "Bad Commands",
        version: "1.0.0",
        commands: [
          { id: "cmd.repair", name: "repairveh", aliases: ["fixveh"], action: "vehicle.repair" },
          { id: "cmd.fix", name: "fixveh", action: "vehicle.fix" }
        ]
      })
    ).toThrow("Duplicate command name or alias in plugin bad_commands: fixveh");

    expect(() =>
      registry.install({
        pluginId: "bad_panels",
        name: "Bad Panels",
        version: "1.0.0",
        panels: [
          { id: "mechanic.panel", title: "Mechanic", route: "/mechanic" },
          { id: "mechanic.panel", title: "Mechanic Duplicate", route: "/mechanic/duplicate" }
        ]
      })
    ).toThrow("Duplicate panel id in plugin bad_panels: mechanic.panel");
  });
});
