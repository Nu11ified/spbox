import { describe, expect, it } from "vitest";
import { planAceMirrorCommands } from "../src/core/ace.js";

describe("ACE mirror planner", () => {
  it("creates add commands for selected permission grants and principal edges", () => {
    const plan = planAceMirrorCommands({
      current: {
        aces: [],
        principals: []
      },
      desired: {
        edges: [
          {
            childPrincipalId: "identifier.license:abc",
            parentPrincipalId: "group.admin",
            source: "manual"
          }
        ],
        grants: [
          {
            principalId: "group.admin",
            permissionKey: "menu.vehicle.repair",
            effect: "allow",
            source: "manual"
          },
          {
            principalId: "group.admin",
            permissionKey: "economy.give_money",
            effect: "deny",
            source: "manual"
          }
        ],
        rules: [
          {
            permissionKey: "menu.vehicle.repair",
            aceObject: "sdb.menu.vehicle.repair",
            enabled: true,
            mode: "allow_and_deny"
          },
          {
            permissionKey: "economy.give_money",
            aceObject: "sdb.economy.give_money",
            enabled: true,
            mode: "allow_and_deny"
          }
        ]
      }
    });

    expect(plan.commands).toEqual([
      "add_ace group.admin sdb.economy.give_money deny",
      "add_ace group.admin sdb.menu.vehicle.repair allow",
      "add_principal identifier.license:abc group.admin"
    ]);
  });

  it("removes stale mirrored ACE state and skips disabled rules", () => {
    const plan = planAceMirrorCommands({
      current: {
        aces: [
          {
            principalId: "group.admin",
            aceObject: "sdb.menu.vehicle.repair",
            effect: "allow"
          },
          {
            principalId: "group.admin",
            aceObject: "sdb.disabled",
            effect: "allow"
          }
        ],
        principals: [
          {
            childPrincipalId: "identifier.license:old",
            parentPrincipalId: "group.admin"
          }
        ]
      },
      desired: {
        edges: [],
        grants: [
          {
            principalId: "group.admin",
            permissionKey: "disabled.permission",
            effect: "allow",
            source: "manual"
          }
        ],
        rules: [
          {
            permissionKey: "disabled.permission",
            aceObject: "sdb.disabled",
            enabled: false,
            mode: "allow_only"
          }
        ]
      }
    });

    expect(plan.commands).toEqual([
      "remove_ace group.admin sdb.disabled allow",
      "remove_ace group.admin sdb.menu.vehicle.repair allow",
      "remove_principal identifier.license:old group.admin"
    ]);
  });

  it("uses the runtime clock when filtering expired mirrored grants and principal edges", () => {
    const plan = planAceMirrorCommands({
      now: () => new Date("2026-05-18T12:00:00.000Z"),
      current: {
        aces: [],
        principals: []
      },
      desired: {
        edges: [
          {
            childPrincipalId: "identifier.license:active",
            parentPrincipalId: "group.event_staff",
            source: "temp",
            expiresAt: new Date("2026-05-18T13:00:00.000Z")
          },
          {
            childPrincipalId: "identifier.license:expired",
            parentPrincipalId: "group.event_staff",
            source: "temp",
            expiresAt: new Date("2026-05-18T11:00:00.000Z")
          }
        ],
        grants: [
          {
            principalId: "group.event_staff",
            permissionKey: "event.manage",
            effect: "allow",
            source: "temp",
            expiresAt: new Date("2026-05-18T13:00:00.000Z")
          },
          {
            principalId: "group.event_staff",
            permissionKey: "server.shutdown",
            effect: "allow",
            source: "temp",
            expiresAt: new Date("2026-05-18T11:00:00.000Z")
          }
        ],
        rules: [
          {
            permissionKey: "event.manage",
            aceObject: "sdb.event.manage",
            enabled: true,
            mode: "allow_only"
          },
          {
            permissionKey: "server.shutdown",
            aceObject: "sdb.server.shutdown",
            enabled: true,
            mode: "allow_only"
          }
        ]
      }
    });

    expect(plan.commands).toEqual([
      "add_ace group.event_staff sdb.event.manage allow",
      "add_principal identifier.license:active group.event_staff"
    ]);
  });

  it("rejects malformed ACE command tokens before command emission", () => {
    expect(() =>
      planAceMirrorCommands({
        current: {
          aces: [],
          principals: []
        },
        desired: {
          edges: [],
          grants: [
            {
              principalId: "group.admin\nquit",
              permissionKey: "menu.vehicle.repair",
              effect: "allow",
              source: "manual"
            }
          ],
          rules: [
            {
              permissionKey: "menu.vehicle.repair",
              aceObject: "sdb.menu.vehicle.repair",
              enabled: true,
              mode: "allow_only"
            }
          ]
        }
      })
    ).toThrow("ACE principal id must not contain whitespace");

    expect(() =>
      planAceMirrorCommands({
        current: {
          aces: [
            {
              principalId: "group.admin",
              aceObject: "sdb.menu bad",
              effect: "allow"
            }
          ],
          principals: []
        },
        desired: {
          edges: [],
          grants: [],
          rules: []
        }
      })
    ).toThrow("ACE object must not contain whitespace");
  });

  it("rejects unknown ACE mirror rule modes before command emission", () => {
    expect(() =>
      planAceMirrorCommands({
        current: {
          aces: [],
          principals: []
        },
        desired: {
          edges: [],
          grants: [
            {
              principalId: "group.admin",
              permissionKey: "menu.vehicle.repair",
              effect: "allow",
              source: "manual"
            }
          ],
          rules: [
            {
              permissionKey: "menu.vehicle.repair",
              aceObject: "sdb.menu.vehicle.repair",
              enabled: true,
              mode: "allow" as never
            }
          ]
        }
      })
    ).toThrow("Unknown ACE mirror mode: allow");
  });
});
