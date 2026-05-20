import { describe, expect, it } from "vitest";
import { RuntimeCommandRegistry, type RuntimeCommandDefinition } from "../src/core/commands.js";
import { PermissionEngine } from "../src/core/permissions.js";

const commands: RuntimeCommandDefinition[] = [
  {
    id: "repair-vehicle-command",
    pluginId: "admin_tools",
    name: "sdb_repair",
    aliases: ["repairveh"],
    actionId: "vehicle.repair",
    requiredPermission: "command.vehicle.repair",
    payloadSchema: {
      type: "object",
      required: ["targetVehicleNetId"],
      properties: {
        targetVehicleNetId: { type: "number" }
      }
    },
    auditLevel: "standard",
    enabled: true
  }
];

function registry() {
  return new RuntimeCommandRegistry({
    commands,
    permissions: new PermissionEngine({
      principals: [],
      edges: [],
      grants: [
        {
          principalId: "player:admin",
          permissionKey: "command.vehicle.repair",
          effect: "allow",
          source: "manual"
        }
      ]
    }),
    now: () => new Date("2026-05-18T12:00:00.000Z")
  });
}

describe("RuntimeCommandRegistry", () => {
  it("rejects blank command names and aliases before registration", () => {
    expect(() =>
      new RuntimeCommandRegistry({
        commands: [{ ...commands[0], name: " " }],
        permissions: new PermissionEngine({ principals: [], edges: [], grants: [] })
      })
    ).toThrow("Runtime command name must be a non-empty string");

    expect(() =>
      new RuntimeCommandRegistry({
        commands: [{ ...commands[0], aliases: ["repairveh", " "] }],
        permissions: new PermissionEngine({ principals: [], edges: [], grants: [] })
      })
    ).toThrow("Runtime command alias must be a non-empty string");
  });

  it("rejects duplicate command names and aliases before one command can shadow another", () => {
    expect(() =>
      new RuntimeCommandRegistry({
        commands: [
          commands[0],
          {
            ...commands[0],
            id: "repair-vehicle-command-copy",
            name: "REPAIRVEH",
            aliases: []
          }
        ],
        permissions: new PermissionEngine({ principals: [], edges: [], grants: [] })
      })
    ).toThrow("Duplicate runtime command name or alias: repairveh");

    expect(() =>
      new RuntimeCommandRegistry({
        commands: [
          commands[0],
          {
            ...commands[0],
            id: "other-command",
            name: "other",
            aliases: ["sdb_repair"]
          }
        ],
        permissions: new PermissionEngine({ principals: [], edges: [], grants: [] })
      })
    ).toThrow("Duplicate runtime command name or alias: sdb_repair");
  });

  it("resolves command aliases into permission-checked runtime action requests", () => {
    expect(registry().executeCommand("player:admin", "repairveh", { targetVehicleNetId: 44 }, "server-1")).toEqual({
      command: commands[0],
      actionId: "vehicle.repair",
      payload: { targetVehicleNetId: 44 },
      audit: expect.objectContaining({
        serverId: "server-1",
        actorId: "player:admin",
        pluginId: "admin_tools",
        actionType: "command:sdb_repair",
        permissionKey: "command.vehicle.repair",
        status: "succeeded"
      })
    });
  });

  it("rejects disabled or unknown commands before action dispatch", () => {
    expect(() => registry().executeCommand("player:admin", "missing", {}, "server-1")).toThrow(
      "Unknown or disabled command: missing"
    );

    const disabled = new RuntimeCommandRegistry({
      commands: [{ ...commands[0], enabled: false }],
      permissions: new PermissionEngine({ principals: [], edges: [], grants: [] })
    });

    expect(() => disabled.executeCommand("player:admin", "sdb_repair", {}, "server-1")).toThrow(
      "Unknown or disabled command: sdb_repair"
    );
  });

  it("re-checks permissions and payload schemas before producing an action request", () => {
    const denied = new RuntimeCommandRegistry({
      commands,
      permissions: new PermissionEngine({
        principals: [],
        edges: [],
        grants: [
          {
            principalId: "player:admin",
            permissionKey: "command.vehicle.repair",
            effect: "deny",
            source: "manual"
          }
        ]
      })
    });

    expect(() =>
      denied.executeCommand("player:admin", "sdb_repair", { targetVehicleNetId: 44 }, "server-1")
    ).toThrow("Permission denied: command.vehicle.repair");

    expect(() =>
      registry().executeCommand("player:admin", "sdb_repair", { targetVehicleNetId: "44" }, "server-1")
    ).toThrow("Expected targetVehicleNetId to be number");
  });
});
