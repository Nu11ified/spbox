import { describe, expect, it } from "vitest";
import { MenuRuntime, type MenuAction } from "../src/core/menu.js";
import { PermissionEngine } from "../src/core/permissions.js";

const permissions = new PermissionEngine({
  principals: [],
  edges: [],
  grants: [
    {
      principalId: "player:admin",
      permissionKey: "menu.vehicle.repair",
      effect: "allow",
      source: "manual"
    },
    {
      principalId: "player:admin",
      permissionKey: "economy.admin.give_money",
      effect: "allow",
      source: "manual"
    }
  ]
});

describe("MenuRuntime action safety", () => {
  it("validates payload schemas before action dispatch", async () => {
    const actions: MenuAction[] = [
      {
        id: "vehicle.repair",
        pluginId: "admin_tools",
        actionType: "runtime_action",
        requiredPermission: "menu.vehicle.repair",
        reducerName: "repair_vehicle",
        payloadSchema: {
          type: "object",
          required: ["targetVehicleNetId"],
          properties: {
            targetVehicleNetId: { type: "number" }
          }
        },
        enabled: true,
        auditLevel: "standard"
      }
    ];
    const runtime = new MenuRuntime({ menus: [], actions, permissions });

    await expect(
      runtime.executeAction("player:admin", "vehicle.repair", { targetVehicleNetId: "not-a-number" })
    ).rejects.toThrow("Expected targetVehicleNetId to be number");
  });

  it("enforces enum payload options before action dispatch", async () => {
    const actions: MenuAction[] = [
      {
        id: "world.weather",
        pluginId: "admin_tools",
        actionType: "runtime_action",
        requiredPermission: "menu.vehicle.repair",
        reducerName: "set_weather",
        payloadSchema: {
          type: "object",
          required: ["weatherType"],
          properties: {
            weatherType: { type: "string", enum: ["EXTRASUNNY", "CLEAR", "RAIN"] }
          }
        },
        enabled: true,
        auditLevel: "standard"
      }
    ];
    const runtime = new MenuRuntime({ menus: [], actions, permissions });

    await expect(
      runtime.executeAction("player:admin", "world.weather", { weatherType: "SNOWLIGHT" })
    ).rejects.toThrow("Expected weatherType to be one of EXTRASUNNY, CLEAR, RAIN");
  });

  it("requires confirmation for dangerous actions", async () => {
    const actions: MenuAction[] = [
      {
        id: "economy.give_money",
        pluginId: "economy",
        actionType: "runtime_action",
        requiredPermission: "economy.admin.give_money",
        reducerName: "admin_give_money",
        confirmationRequired: true,
        payloadSchema: {
          type: "object",
          required: ["targetAccountId", "amount"],
          properties: {
            targetAccountId: { type: "string" },
            amount: { type: "number" }
          }
        },
        enabled: true,
        auditLevel: "high"
      }
    ];
    const runtime = new MenuRuntime({ menus: [], actions, permissions });

    await expect(
      runtime.executeAction("player:admin", "economy.give_money", {
        targetAccountId: "acct:1",
        amount: 1000
      })
    ).rejects.toThrow("Action requires confirmation: economy.give_money");
  });

  it("returns audit metadata for an authorized confirmed action", async () => {
    const actions: MenuAction[] = [
      {
        id: "economy.give_money",
        pluginId: "economy",
        actionType: "runtime_action",
        requiredPermission: "economy.admin.give_money",
        reducerName: "admin_give_money",
        confirmationRequired: true,
        payloadSchema: {
          type: "object",
          required: ["targetAccountId", "amount"],
          properties: {
            targetAccountId: { type: "string" },
            amount: { type: "number" }
          }
        },
        enabled: true,
        auditLevel: "high"
      }
    ];
    const runtime = new MenuRuntime({ menus: [], actions, permissions });

    await expect(
      runtime.executeAction(
        "player:admin",
        "economy.give_money",
        {
          targetAccountId: "acct:1",
          amount: 1000
        },
        { confirmed: true, serverId: "server-1" }
      )
    ).resolves.toEqual({
      action: actions[0],
      payload: {
        targetAccountId: "acct:1",
        amount: 1000
      },
      audit: expect.objectContaining({
        serverId: "server-1",
        actorId: "player:admin",
        pluginId: "economy",
        actionType: "economy.give_money",
        permissionKey: "economy.admin.give_money",
        status: "succeeded"
      })
    });
  });

  it("enforces contextual permission policies from action payloads", async () => {
    const runtime = new MenuRuntime({
      menus: [],
      actions: [
        {
          id: "economy.give_money",
          pluginId: "economy",
          actionType: "runtime_action",
          requiredPermission: "economy.admin.give_money",
          reducerName: "admin_give_money",
          payloadSchema: {
            type: "object",
            required: ["targetAccountId", "amount", "currency"],
            properties: {
              targetAccountId: { type: "string" },
              amount: { type: "number" },
              currency: { type: "string" }
            }
          },
          enabled: true,
          auditLevel: "high"
        }
      ],
      permissions: new PermissionEngine({
        principals: [],
        edges: [],
        grants: [
          {
            principalId: "player:admin",
            permissionKey: "economy.admin.give_money",
            effect: "allow",
            source: "manual"
          }
        ],
        policies: [
          {
            id: "staff-give-limit",
            permissionKey: "economy.admin.give_money",
            constraintType: "max_amount",
            constraint: { amount: 10_000, currency: "cash" },
            priority: 10,
            enabled: true
          }
        ]
      })
    });

    await expect(
      runtime.executeAction("player:admin", "economy.give_money", {
        targetAccountId: "acct:1",
        amount: 12_000,
        currency: "cash"
      })
    ).rejects.toThrow("Permission denied: economy.admin.give_money");

    await expect(
      runtime.executeAction("player:admin", "economy.give_money", {
        targetAccountId: "acct:1",
        amount: 9_500,
        currency: "cash"
      })
    ).resolves.toEqual(expect.objectContaining({
      action: expect.objectContaining({ id: "economy.give_money" })
    }));
  });

  it("rejects server command menu actions without an explicit required permission", async () => {
    const runtime = new MenuRuntime({
      menus: [],
      actions: [
        {
          id: "server.command.weather",
          pluginId: "admin_tools",
          actionType: "execute_server_command",
          enabled: true,
          auditLevel: "high"
        }
      ],
      permissions
    });

    await expect(
      runtime.executeAction("player:admin", "server.command.weather", {
        command: "weather EXTRASUNNY"
      })
    ).rejects.toThrow("execute_server_command actions require an explicit permission");
  });
});
