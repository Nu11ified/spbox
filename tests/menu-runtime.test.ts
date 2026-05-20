import { describe, expect, it } from "vitest";
import {
  MenuRuntime,
  type MenuAction,
  type MenuDefinition,
  type MenuVisibilityPolicy
} from "../src/core/menu.js";
import { PermissionEngine } from "../src/core/permissions.js";

describe("MenuRuntime", () => {
  it("builds a permission-filtered menu tree", () => {
    const permissions = new PermissionEngine({
      principals: [],
      edges: [],
      grants: [
        {
          principalId: "player:1",
          permissionKey: "menu.vehicle.repair",
          effect: "allow",
          source: "manual"
        }
      ]
    });
    const menus: MenuDefinition[] = [
      { id: "root", pluginId: "core", label: "Admin", order: 0, enabled: true },
      {
        id: "repair",
        pluginId: "core",
        label: "Repair Vehicle",
        parentId: "root",
        order: 1,
        requiredPermission: "menu.vehicle.repair",
        actionId: "vehicle.repair",
        enabled: true
      },
      {
        id: "give-money",
        pluginId: "economy",
        label: "Give Money",
        parentId: "root",
        order: 2,
        requiredPermission: "economy.give_money",
        actionId: "economy.give_money",
        enabled: true
      }
    ];

    const actions: MenuAction[] = [
      {
        id: "vehicle.repair",
        pluginId: "core",
        actionType: "runtime_action",
        requiredPermission: "menu.vehicle.repair",
        enabled: true,
        auditLevel: "standard"
      },
      {
        id: "economy.give_money",
        pluginId: "economy",
        actionType: "runtime_action",
        requiredPermission: "economy.give_money",
        enabled: true,
        auditLevel: "standard"
      }
    ];
    const runtime = new MenuRuntime({ menus, actions, permissions });

    expect(runtime.buildTreeForPrincipal("player:1")).toEqual([
      {
        id: "root",
        label: "Admin",
        pluginId: "core",
        order: 0,
        children: [
          {
            id: "repair",
            label: "Repair Vehicle",
            pluginId: "core",
            order: 1,
            actionId: "vehicle.repair",
            requiredPermission: "menu.vehicle.repair",
            children: []
          }
        ]
      }
    ]);
  });

  it("re-checks permission before executing an action", async () => {
    const permissions = new PermissionEngine({
      principals: [],
      edges: [],
      grants: [
        {
          principalId: "player:1",
          permissionKey: "menu.vehicle.repair",
          effect: "deny",
          source: "manual"
        }
      ]
    });
    const actions: MenuAction[] = [
      {
        id: "vehicle.repair",
        pluginId: "core",
        actionType: "runtime_action",
        reducerName: "repair_vehicle",
        requiredPermission: "menu.vehicle.repair",
        enabled: true,
        auditLevel: "standard"
      }
    ];
    const runtime = new MenuRuntime({ menus: [], actions, permissions });

    await expect(runtime.executeAction("player:1", "vehicle.repair", {})).rejects.toThrow(
      "Permission denied: menu.vehicle.repair"
    );
  });

  it("filters menu entries through enabled visibility policies and caller state", () => {
    const permissions = new PermissionEngine({
      principals: [],
      edges: [],
      grants: []
    });
    const menus: MenuDefinition[] = [
      { id: "root", pluginId: "core", label: "Admin", order: 0, enabled: true },
      {
        id: "mechanic",
        pluginId: "mechanic_core",
        label: "Mechanic",
        parentId: "root",
        order: 1,
        actionId: "mechanic.open",
        enabled: true,
        visibilityPolicyId: "policy:on-duty"
      },
      {
        id: "staff",
        pluginId: "admin_tools",
        label: "Staff",
        parentId: "root",
        order: 2,
        actionId: "staff.open",
        enabled: true,
        visibilityPolicyId: "policy:staff-mode"
      },
      {
        id: "broken",
        pluginId: "admin_tools",
        label: "Broken",
        parentId: "root",
        order: 3,
        actionId: "broken.open",
        enabled: true,
        visibilityPolicyId: "policy:broken"
      },
      {
        id: "missing",
        pluginId: "admin_tools",
        label: "Missing",
        parentId: "root",
        order: 4,
        actionId: "missing.open",
        enabled: true,
        visibilityPolicyId: "policy:missing"
      }
    ];
    const visibilityPolicies: MenuVisibilityPolicy[] = [
      {
        id: "policy:on-duty",
        pluginId: "mechanic_core",
        policyJson: JSON.stringify({ requiresState: { key: "onDuty", equals: true } }),
        enabled: true
      },
      {
        id: "policy:staff-mode",
        pluginId: "admin_tools",
        policy: { requiresState: { key: "staffMode", equals: true } },
        enabled: false
      },
      {
        id: "policy:broken",
        pluginId: "admin_tools",
        policyJson: "{not-json",
        enabled: true
      }
    ];
    const actions: MenuAction[] = [
      {
        id: "mechanic.open",
        pluginId: "mechanic_core",
        actionType: "open_panel",
        enabled: true,
        auditLevel: "standard"
      },
      {
        id: "staff.open",
        pluginId: "admin_tools",
        actionType: "open_panel",
        enabled: true,
        auditLevel: "standard"
      },
      {
        id: "broken.open",
        pluginId: "admin_tools",
        actionType: "open_panel",
        enabled: true,
        auditLevel: "standard"
      },
      {
        id: "missing.open",
        pluginId: "admin_tools",
        actionType: "open_panel",
        enabled: true,
        auditLevel: "standard"
      }
    ];
    const runtime = new MenuRuntime({
      menus,
      actions,
      permissions,
      visibilityPolicies
    });

    expect(runtime.buildTreeForPrincipal("player:1", { state: { onDuty: false } })).toEqual([
      {
        id: "root",
        label: "Admin",
        pluginId: "core",
        order: 0,
        children: []
      }
    ]);

    expect(runtime.buildTreeForPrincipal("player:1", { state: { onDuty: true } })).toEqual([
      {
        id: "root",
        label: "Admin",
        pluginId: "core",
        order: 0,
        children: [
          {
            id: "mechanic",
            label: "Mechanic",
            pluginId: "mechanic_core",
            order: 1,
            actionId: "mechanic.open",
            children: []
          }
        ]
      }
    ]);
  });

  it("hides menu entries when their action row is missing, disabled, or unauthorized", () => {
    const permissions = new PermissionEngine({
      principals: [],
      edges: [],
      grants: [
        {
          principalId: "player:1",
          permissionKey: "menu.visible",
          effect: "allow",
          source: "manual"
        }
      ]
    });
    const menus: MenuDefinition[] = [
      { id: "root", pluginId: "core", label: "Admin", order: 0, enabled: true },
      {
        id: "enabled",
        pluginId: "core",
        label: "Enabled",
        parentId: "root",
        order: 1,
        actionId: "action.enabled",
        requiredPermission: "menu.visible",
        enabled: true
      },
      {
        id: "disabled",
        pluginId: "core",
        label: "Disabled",
        parentId: "root",
        order: 2,
        actionId: "action.disabled",
        requiredPermission: "menu.visible",
        enabled: true
      },
      {
        id: "missing-action",
        pluginId: "core",
        label: "Missing",
        parentId: "root",
        order: 3,
        actionId: "action.missing",
        requiredPermission: "menu.visible",
        enabled: true
      },
      {
        id: "action-permission",
        pluginId: "core",
        label: "Action Permission",
        parentId: "root",
        order: 4,
        actionId: "action.permission",
        requiredPermission: "menu.visible",
        enabled: true
      }
    ];
    const actions: MenuAction[] = [
      {
        id: "action.enabled",
        pluginId: "core",
        actionType: "runtime_action",
        requiredPermission: "menu.visible",
        enabled: true,
        auditLevel: "standard"
      },
      {
        id: "action.disabled",
        pluginId: "core",
        actionType: "runtime_action",
        requiredPermission: "menu.visible",
        enabled: false,
        auditLevel: "standard"
      },
      {
        id: "action.permission",
        pluginId: "core",
        actionType: "runtime_action",
        requiredPermission: "menu.hidden",
        enabled: true,
        auditLevel: "standard"
      }
    ];
    const runtime = new MenuRuntime({ menus, actions, permissions });

    expect(runtime.buildTreeForPrincipal("player:1")).toEqual([
      {
        id: "root",
        label: "Admin",
        pluginId: "core",
        order: 0,
        children: [
          {
            id: "enabled",
            label: "Enabled",
            pluginId: "core",
            order: 1,
            actionId: "action.enabled",
            requiredPermission: "menu.visible",
            children: []
          }
        ]
      }
    ]);
  });
});
