import { describe, expect, it } from "vitest";
import { PermissionStore } from "../src/core/permission-store.js";

const now = new Date("2026-05-18T12:00:00.000Z");

describe("PermissionStore", () => {
  it("stores permission definitions and ACE mirror rules in snapshots", () => {
    const store = new PermissionStore({ now: () => now });

    store.registerPermission({
      id: "perm:vehicle.repair",
      key: "vehicle.repair",
      description: "Repair vehicles",
      pluginId: "mechanic_core"
    });
    store.upsertAceMirrorRule({
      id: "ace:vehicle.repair",
      permissionKey: "vehicle.repair",
      aceObject: "sdb.vehicle.repair",
      enabled: true,
      mode: "allow_and_deny"
    });

    expect(store.snapshot().permissions).toEqual([
      {
        id: "perm:vehicle.repair",
        key: "vehicle.repair",
        description: "Repair vehicles",
        pluginId: "mechanic_core"
      }
    ]);
    expect(store.snapshot().aceMirrorRules).toEqual([
      {
        id: "ace:vehicle.repair",
        permissionKey: "vehicle.repair",
        aceObject: "sdb.vehicle.repair",
        enabled: true,
        mode: "allow_and_deny"
      }
    ]);
    expect(store.getAuditEvents()).toEqual([
      expect.objectContaining({ actionType: "permission.register_permission" }),
      expect.objectContaining({ actionType: "permission.upsert_ace_mirror_rule" })
    ]);
  });

  it("upserts principals, edges, and grants then builds an evaluatable engine snapshot", () => {
    const store = new PermissionStore({ now: () => now });

    store.upsertPrincipal({
      id: "player:license:abc",
      type: "player",
      externalId: "license:abc",
      name: "Ada"
    });
    store.upsertPrincipal({
      id: "group.admin",
      type: "group",
      externalId: "admin",
      name: "Admin"
    });
    store.addPrincipalEdge({
      parentPrincipalId: "group.admin",
      childPrincipalId: "player:license:abc",
      source: "manual"
    });
    store.grantPermission({
      principalId: "group.admin",
      permissionKey: "menu.vehicle.repair",
      effect: "allow",
      source: "manual"
    });

    expect(store.toEngine().hasPermission("player:license:abc", "menu.vehicle.repair").allowed).toBe(true);
    expect(store.getAuditEvents()).toEqual([
      expect.objectContaining({ actionType: "permission.upsert_principal", targetId: "player:license:abc" }),
      expect.objectContaining({ actionType: "permission.upsert_principal", targetId: "group.admin" }),
      expect.objectContaining({ actionType: "permission.add_edge", targetId: "group.admin->player:license:abc" }),
      expect.objectContaining({ actionType: "permission.grant", targetId: "group.admin:menu.vehicle.repair" })
    ]);
  });

  it("revokes grants and removes edges from future engine snapshots", () => {
    const store = new PermissionStore({ now: () => now });
    store.upsertPrincipal({
      id: "player:license:abc",
      type: "player",
      externalId: "license:abc",
      name: "Ada"
    });
    store.addPrincipalEdge({
      parentPrincipalId: "group.admin",
      childPrincipalId: "player:license:abc",
      source: "manual"
    });
    store.grantPermission({
      principalId: "group.admin",
      permissionKey: "menu.vehicle.repair",
      effect: "allow",
      source: "manual"
    });

    store.revokePermission("group.admin", "menu.vehicle.repair");
    store.removePrincipalEdge("group.admin", "player:license:abc", "manual");

    expect(store.toEngine().hasPermission("player:license:abc", "menu.vehicle.repair").allowed).toBe(false);
    expect(store.snapshot().edges).toEqual([]);
    expect(store.snapshot().grants).toEqual([]);
  });

  it("keeps deny grants effective over allow grants in snapshots", () => {
    const store = new PermissionStore();
    store.grantPermission({
      principalId: "player:license:abc",
      permissionKey: "economy.give_money",
      effect: "allow",
      source: "manual"
    });
    store.grantPermission({
      principalId: "player:license:abc",
      permissionKey: "economy.give_money",
      effect: "deny",
      source: "manual"
    });

    expect(store.toEngine().hasPermission("player:license:abc", "economy.give_money").allowed).toBe(false);
  });

  it("stores contextual policy constraints in engine snapshots and audits changes", () => {
    const store = new PermissionStore({ now: () => now });

    store.grantPermission({
      principalId: "group.staff",
      permissionKey: "economy.admin.give_money",
      effect: "allow",
      source: "manual"
    });
    store.upsertPolicyConstraint({
      id: "staff-give-limit",
      permissionKey: "economy.admin.give_money",
      constraintType: "max_amount",
      constraint: { amount: 10_000, currency: "cash" },
      priority: 10,
      enabled: true
    });

    expect(store.snapshot().policies).toEqual([
      {
        id: "staff-give-limit",
        permissionKey: "economy.admin.give_money",
        constraintType: "max_amount",
        constraint: { amount: 10_000, currency: "cash" },
        priority: 10,
        enabled: true
      }
    ]);
    expect(
      store.toEngine().hasPermission("group.staff", "economy.admin.give_money", {
        amount: 15_000,
        currency: "cash"
      }).allowed
    ).toBe(false);
    expect(store.getAuditEvents()).toEqual([
      expect.objectContaining({ actionType: "permission.grant" }),
      expect.objectContaining({
        actionType: "permission.upsert_policy_constraint",
        targetId: "staff-give-limit"
      })
    ]);

    store.removePolicyConstraint("staff-give-limit");

    expect(store.snapshot().policies).toEqual([]);
    expect(store.toEngine().hasPermission("group.staff", "economy.admin.give_money", {
      amount: 15_000,
      currency: "cash"
    }).allowed).toBe(true);
  });
});
