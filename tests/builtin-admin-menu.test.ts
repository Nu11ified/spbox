import { describe, expect, it } from "vitest";
import { createBuiltinAdminMenu } from "../src/core/builtin-admin-menu.js";
import { MenuRuntime } from "../src/core/menu.js";
import { PermissionEngine } from "../src/core/permissions.js";

describe("built-in admin menu catalog", () => {
  it("ships the expected first-party admin sections and runtime actions", () => {
    const catalog = createBuiltinAdminMenu();

    expect(catalog.menus.map((menu) => menu.id)).toEqual([
      "admin.root",
      "admin.players",
      "admin.vehicles",
      "admin.world",
      "admin.teleport",
      "admin.economy",
      "admin.plugins",
      "admin.runtime",
      "admin.audit",
      "admin.players.kick",
      "admin.vehicles.repair",
      "admin.vehicles.spawn",
      "admin.world.weather",
      "admin.world.time",
      "admin.teleport.to_marker",
      "admin.economy.adjust_balance",
      "admin.plugins.toggle",
      "admin.runtime.health",
      "admin.audit.search"
    ]);
    expect(catalog.actions).toContainEqual(
      expect.objectContaining({
        id: "admin.players.kick",
        actionType: "kick_player",
        requiredPermission: "admin.players.kick",
        confirmationRequired: true,
        auditLevel: "high",
        payloadSchema: expect.objectContaining({
          required: ["targetSource", "reason"]
        })
      })
    );
    expect(catalog.actions).toContainEqual(
      expect.objectContaining({
        id: "admin.vehicles.repair",
        actionType: "repair_vehicle",
        requiredPermission: "admin.vehicles.repair",
        payloadSchema: expect.objectContaining({
          required: ["targetSource", "targetVehicleNetId"]
        })
      })
    );
    expect(catalog.actions).toContainEqual(
      expect.objectContaining({
        id: "admin.vehicles.spawn",
        actionType: "spawn_vehicle",
        requiredPermission: "admin.vehicles.spawn",
        payloadSchema: expect.objectContaining({
          required: ["targetSource", "model"]
        })
      })
    );
    expect(catalog.actions).toContainEqual(
      expect.objectContaining({
        id: "admin.world.weather",
        actionType: "set_weather",
        payloadSchema: expect.objectContaining({
          required: ["weatherType"],
          properties: expect.objectContaining({
            weatherType: expect.objectContaining({
              enum: ["EXTRASUNNY", "CLEAR", "CLOUDS", "OVERCAST", "RAIN", "THUNDER", "FOGGY", "XMAS"]
            })
          })
        })
      })
    );
    expect(catalog.actions).toContainEqual(
      expect.objectContaining({
        id: "admin.world.time",
        actionType: "set_time",
        payloadSchema: expect.objectContaining({
          required: ["hour", "minute"]
        })
      })
    );
    expect(catalog.actions).toContainEqual(
      expect.objectContaining({
        id: "admin.teleport.to_marker",
        actionType: "teleport_player",
        requiredPermission: "admin.teleport.to_marker",
        payloadSchema: expect.objectContaining({
          required: ["targetSource", "x", "y", "z"]
        })
      })
    );
    expect(catalog.actions).toContainEqual(
      expect.objectContaining({
        id: "admin.economy.adjust_balance",
        actionType: "economy_admin_adjust_balance",
        requiredPermission: "economy.admin.adjust_balance",
        confirmationRequired: true,
        auditLevel: "high",
        payloadSchema: expect.objectContaining({
          required: ["accountId", "direction", "amount", "currency", "reason", "idempotencyKey"],
          properties: expect.objectContaining({
            direction: expect.objectContaining({
              enum: ["credit", "debit"]
            }),
            currency: expect.objectContaining({
              enum: ["cash", "bank"]
            })
          })
        })
      })
    );
    expect(catalog.actions).toContainEqual(
      expect.objectContaining({
        id: "admin.plugins.toggle",
        actionType: "set_plugin_status",
        requiredPermission: "plugins.manage",
        confirmationRequired: true,
        payloadSchema: expect.objectContaining({
          required: ["pluginId", "status"],
          properties: expect.objectContaining({
            status: expect.objectContaining({
              enum: ["active", "disabled"]
            })
          })
        })
      })
    );
    expect(catalog.actions).toContainEqual(
      expect.objectContaining({
        id: "admin.audit.search",
        actionType: "open_panel",
        requiredPermission: "audit.search"
      })
    );
  });

  it("builds a permission-gated tree for the built-in admin menu", () => {
    const catalog = createBuiltinAdminMenu();
    const permissions = new PermissionEngine({
      principals: [],
      edges: [],
      grants: [
        {
          principalId: "player:admin",
          permissionKey: "admin.vehicles.repair",
          effect: "allow",
          source: "manual"
        },
        {
          principalId: "player:admin",
          permissionKey: "runtime.health.view",
          effect: "allow",
          source: "manual"
        }
      ]
    });
    const runtime = new MenuRuntime({
      menus: catalog.menus,
      actions: catalog.actions,
      permissions
    });

    const tree = runtime.buildTreeForPrincipal("player:admin");

    expect(tree[0]?.children.map((node) => node.id)).toEqual(["admin.vehicles", "admin.runtime"]);
    expect(tree[0]?.children[0]?.children).toEqual([
      expect.objectContaining({
        id: "admin.vehicles.repair",
        actionId: "admin.vehicles.repair",
        payloadSchema: expect.objectContaining({
          required: ["targetSource", "targetVehicleNetId"]
        })
      })
    ]);
    expect(tree[0]?.children[1]?.children).toEqual([
      expect.objectContaining({
        id: "admin.runtime.health",
        actionId: "admin.runtime.health"
      })
    ]);
  });

  it("validates built-in action payloads before dispatch", async () => {
    const catalog = createBuiltinAdminMenu();
    const permissions = new PermissionEngine({
      principals: [],
      edges: [],
      grants: [
        {
          principalId: "player:admin",
          permissionKey: "admin.world.weather",
          effect: "allow",
          source: "manual"
        }
      ]
    });
    const runtime = new MenuRuntime({
      menus: catalog.menus,
      actions: catalog.actions,
      permissions
    });

    await expect(
      runtime.executeAction("player:admin", "admin.world.weather", { weatherType: 7 })
    ).rejects.toThrow("Expected weatherType to be string");
  });
});
