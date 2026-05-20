import { describe, expect, it } from "vitest";
import { DiscordRoleConnector } from "../src/connectors/discord.js";

describe("DiscordRoleConnector", () => {
  it("rejects malformed connector configuration before planning reducer writes", () => {
    expect(() =>
      new DiscordRoleConnector({
        guildId: " ",
        roleMappings: [{ discordRoleId: "role-admin", targetPrincipalId: "group.admin" }],
        existingEdges: []
      })
    ).toThrow("Discord connector guildId must be a non-empty string");

    expect(() =>
      new DiscordRoleConnector({
        guildId: "guild-1",
        roleMappings: [{ discordRoleId: " ", targetPrincipalId: "group.admin" }],
        existingEdges: []
      })
    ).toThrow("Discord role mapping role id must be a non-empty string");

    expect(() =>
      new DiscordRoleConnector({
        guildId: "guild-1",
        roleMappings: [{ discordRoleId: "role-admin", targetPrincipalId: " " }],
        existingEdges: []
      })
    ).toThrow("Discord role mapping target principal must be a non-empty string");
  });

  it("rejects malformed member snapshots before planning reducer writes", () => {
    const connector = new DiscordRoleConnector({
      guildId: "guild-1",
      roleMappings: [{ discordRoleId: "role-admin", targetPrincipalId: "group.admin" }],
      existingEdges: []
    });

    expect(() =>
      connector.planSync([
        {
          userId: " ",
          displayName: "Ada",
          roleIds: ["role-admin"]
        }
      ])
    ).toThrow("Discord member userId must be a non-empty string");

    expect(() =>
      connector.planSync([
        {
          userId: "user-1",
          displayName: "Ada",
          roleIds: ["role-admin", " "]
        }
      ])
    ).toThrow("Discord member role id must be a non-empty string");
  });

  it("plans principal and edge changes from Discord role membership", () => {
    const connector = new DiscordRoleConnector({
      guildId: "guild-1",
      roleMappings: [
        {
          discordRoleId: "role-admin",
          targetPrincipalId: "group.admin"
        },
        {
          discordRoleId: "role-staff",
          targetPrincipalId: "group.staff"
        }
      ],
      existingEdges: [
        {
          parentPrincipalId: "group.staff",
          childPrincipalId: "discord:guild-1:user-old:role-staff",
          source: "discord:guild-1"
        }
      ]
    });

    const plan = connector.planSync([
      {
        userId: "user-1",
        displayName: "Ada",
        roleIds: ["role-admin", "role-staff"]
      },
      {
        userId: "user-2",
        displayName: "Grace",
        roleIds: ["role-ignored"]
      }
    ]);

    expect(plan.upsertPrincipals).toEqual([
      {
        id: "discord:guild-1:role-admin",
        type: "discord_role",
        externalId: "guild-1:role-admin",
        name: "Discord Role role-admin"
      },
      {
        id: "discord:guild-1:role-staff",
        type: "discord_role",
        externalId: "guild-1:role-staff",
        name: "Discord Role role-staff"
      },
      {
        id: "discord:guild-1:user-1:role-admin",
        type: "discord_role",
        externalId: "guild-1:user-1:role-admin",
        name: "Ada role-admin"
      },
      {
        id: "discord:guild-1:user-1:role-staff",
        type: "discord_role",
        externalId: "guild-1:user-1:role-staff",
        name: "Ada role-staff"
      }
    ]);
    expect(plan.addEdges).toEqual([
      {
        parentPrincipalId: "group.admin",
        childPrincipalId: "discord:guild-1:user-1:role-admin",
        source: "discord:guild-1"
      },
      {
        parentPrincipalId: "group.staff",
        childPrincipalId: "discord:guild-1:user-1:role-staff",
        source: "discord:guild-1"
      }
    ]);
    expect(plan.removeEdges).toEqual([
      {
        parentPrincipalId: "group.staff",
        childPrincipalId: "discord:guild-1:user-old:role-staff",
        source: "discord:guild-1"
      }
    ]);
    expect(plan.audit).toEqual({
      guildId: "guild-1",
      scannedMembers: 2,
      mappedRoles: 2,
      addedEdges: 2,
      removedEdges: 1
    });
  });

  it("applies a sync plan through reducer-shaped callbacks", async () => {
    const calls: Array<{ name: string; args: unknown }> = [];
    const connector = new DiscordRoleConnector({
      guildId: "guild-1",
      roleMappings: [{ discordRoleId: "role-admin", targetPrincipalId: "group.admin" }],
      existingEdges: []
    });

    const plan = connector.planSync([
      {
        userId: "user-1",
        displayName: "Ada",
        roleIds: ["role-admin"]
      }
    ]);

    await connector.applyPlan(plan, async (name, args) => {
      calls.push({ name, args });
    });

    expect(calls.map((call) => call.name)).toEqual([
      "upsert_principal",
      "upsert_principal",
      "add_principal_edge",
      "write_audit_log"
    ]);
    expect(calls[2]).toEqual({
      name: "add_principal_edge",
      args: {
        id: "group.admin:discord:guild-1:user-1:role-admin:discord:guild-1",
        parentPrincipalId: "group.admin",
        childPrincipalId: "discord:guild-1:user-1:role-admin",
        source: "discord:guild-1"
      }
    });
    expect(calls[3]).toEqual({
      name: "write_audit_log",
      args: {
        id: "discord.role_sync:guild-1",
        serverId: "server-1",
        actorId: "connector:discord:guild-1",
        pluginId: "connector.discord",
        actionType: "discord.role_sync",
        permissionKey: "",
        targetType: "discord_guild",
        targetId: "guild-1",
        beforeJson: "{}",
        afterJson: "{\"guildId\":\"guild-1\",\"scannedMembers\":1,\"mappedRoles\":1,\"addedEdges\":1,\"removedEdges\":0}",
        status: "succeeded"
      }
    });
  });

  it("removes stale Discord edges by deterministic reducer edge id", async () => {
    const calls: Array<{ name: string; args: unknown }> = [];
    const connector = new DiscordRoleConnector({
      guildId: "guild-1",
      roleMappings: [{ discordRoleId: "role-admin", targetPrincipalId: "group.admin" }],
      existingEdges: [
        {
          parentPrincipalId: "group.admin",
          childPrincipalId: "discord:guild-1:user-old:role-admin",
          source: "discord:guild-1"
        }
      ]
    });

    await connector.applyPlan(connector.planSync([]), async (name, args) => {
      calls.push({ name, args });
    });

    expect(calls).toContainEqual({
      name: "remove_principal_edge",
      args: {
        edgeId: "group.admin:discord:guild-1:user-old:role-admin:discord:guild-1"
      }
    });
  });

  it("can attach expirations to Discord-derived role edges", async () => {
    const calls: Array<{ name: string; args: unknown }> = [];
    const connector = new DiscordRoleConnector({
      guildId: "guild-1",
      roleMappings: [{ discordRoleId: "role-admin", targetPrincipalId: "group.admin" }],
      existingEdges: [],
      edgeTtlMs: 7_200_000,
      now: () => new Date("2026-05-18T12:00:00.000Z")
    });

    const plan = connector.planSync([
      {
        userId: "user-1",
        displayName: "Ada",
        roleIds: ["role-admin"]
      }
    ]);
    await connector.applyPlan(plan, async (name, args) => {
      calls.push({ name, args });
    });

    expect(plan.addEdges).toEqual([
      {
        parentPrincipalId: "group.admin",
        childPrincipalId: "discord:guild-1:user-1:role-admin",
        source: "discord:guild-1",
        expiresAt: new Date("2026-05-18T14:00:00.000Z")
      }
    ]);
    expect(calls).toContainEqual({
      name: "add_principal_edge",
      args: {
        id: "group.admin:discord:guild-1:user-1:role-admin:discord:guild-1",
        parentPrincipalId: "group.admin",
        childPrincipalId: "discord:guild-1:user-1:role-admin",
        source: "discord:guild-1",
        expiresAt: new Date("2026-05-18T14:00:00.000Z")
      }
    });
  });

  it("refreshes expired Discord role edges when the member still has the role", () => {
    const connector = new DiscordRoleConnector({
      guildId: "guild-1",
      roleMappings: [{ discordRoleId: "role-admin", targetPrincipalId: "group.admin" }],
      existingEdges: [
        {
          parentPrincipalId: "group.admin",
          childPrincipalId: "discord:guild-1:user-1:role-admin",
          source: "discord:guild-1",
          expiresAt: new Date("2026-05-18T11:59:00.000Z")
        }
      ],
      edgeTtlMs: 7_200_000,
      now: () => new Date("2026-05-18T12:00:00.000Z")
    });

    const plan = connector.planSync([
      {
        userId: "user-1",
        displayName: "Ada",
        roleIds: ["role-admin"]
      }
    ]);

    expect(plan.addEdges).toEqual([
      {
        parentPrincipalId: "group.admin",
        childPrincipalId: "discord:guild-1:user-1:role-admin",
        source: "discord:guild-1",
        expiresAt: new Date("2026-05-18T14:00:00.000Z")
      }
    ]);
    expect(plan.removeEdges).toEqual([]);
    expect(plan.audit).toEqual({
      guildId: "guild-1",
      scannedMembers: 1,
      mappedRoles: 1,
      addedEdges: 1,
      removedEdges: 0
    });
  });
});
