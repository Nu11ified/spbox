import { describe, expect, it } from "vitest";
import {
  PermissionEngine,
  type PermissionGrant,
  type PrincipalEdge
} from "../src/core/permissions.js";

const baseTime = new Date("2026-05-18T00:00:00.000Z");

describe("PermissionEngine", () => {
  it("resolves inherited permissions through the principal graph", () => {
    const engine = new PermissionEngine({
      principals: [
        { id: "player:license:abc", type: "player", externalId: "license:abc", name: "Ada" },
        { id: "group:staff", type: "group", externalId: "staff", name: "Staff" }
      ],
      edges: [
        {
          parentPrincipalId: "group:staff",
          childPrincipalId: "player:license:abc",
          source: "manual"
        }
      ],
      grants: [
        {
          principalId: "group:staff",
          permissionKey: "menu.vehicle.repair",
          effect: "allow",
          source: "manual"
        }
      ],
      now: () => baseTime
    });

    expect(engine.hasPermission("player:license:abc", "menu.vehicle.repair")).toEqual({
      allowed: true,
      permissionKey: "menu.vehicle.repair",
      matchedGrant: expect.objectContaining({ principalId: "group:staff", effect: "allow" }),
      resolvedPrincipals: ["group:staff", "player:license:abc"]
    });
  });

  it("lets deny override allow and ignores expired edges/grants", () => {
    const edges: PrincipalEdge[] = [
      {
        parentPrincipalId: "group:staff",
        childPrincipalId: "player:license:abc",
        source: "manual"
      },
      {
        parentPrincipalId: "group:temp-admin",
        childPrincipalId: "player:license:abc",
        source: "temp",
        expiresAt: new Date("2026-05-17T23:00:00.000Z")
      }
    ];
    const grants: PermissionGrant[] = [
      {
        principalId: "group:staff",
        permissionKey: "economy.give_money",
        effect: "allow",
        source: "manual"
      },
      {
        principalId: "player:license:abc",
        permissionKey: "economy.give_money",
        effect: "deny",
        source: "manual"
      },
      {
        principalId: "group:temp-admin",
        permissionKey: "server.shutdown",
        effect: "allow",
        source: "temp",
        expiresAt: new Date("2026-05-17T23:00:00.000Z")
      }
    ];

    const engine = new PermissionEngine({
      principals: [],
      edges,
      grants,
      now: () => baseTime
    });

    expect(engine.hasPermission("player:license:abc", "economy.give_money").allowed).toBe(false);
    expect(engine.hasPermission("player:license:abc", "server.shutdown").allowed).toBe(false);
  });

  it("enforces contextual policy constraints after a permission grant allows the action", () => {
    const engine = new PermissionEngine({
      principals: [],
      edges: [],
      grants: [
        {
          principalId: "group:staff",
          permissionKey: "economy.admin.give_money",
          effect: "allow",
          source: "manual"
        },
        {
          principalId: "group:mechanic",
          permissionKey: "vehicle.repair",
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
        },
        {
          id: "mechanic-duty",
          permissionKey: "vehicle.repair",
          constraintType: "requires_state",
          constraint: { key: "job:on_duty", equals: true },
          priority: 10,
          enabled: true
        }
      ],
      now: () => baseTime
    });

    expect(
      engine.hasPermission("group:staff", "economy.admin.give_money", {
        amount: 12_000,
        currency: "cash"
      })
    ).toEqual(expect.objectContaining({
      allowed: false,
      deniedByPolicy: expect.objectContaining({ id: "staff-give-limit" })
    }));
    expect(
      engine.hasPermission("group:staff", "economy.admin.give_money", {
        amount: 9_500,
        currency: "cash"
      }).allowed
    ).toBe(true);
    expect(
      engine.hasPermission("group:mechanic", "vehicle.repair", {
        state: { "job:on_duty": false }
      })
    ).toEqual(expect.objectContaining({
      allowed: false,
      deniedByPolicy: expect.objectContaining({ id: "mechanic-duty" })
    }));
  });
});
