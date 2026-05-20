import { type Principal, type PrincipalEdge } from "../core/index.js";

export interface DiscordRoleMapping {
  discordRoleId: string;
  targetPrincipalId: string;
}

export interface DiscordMemberSnapshot {
  userId: string;
  displayName: string;
  roleIds: string[];
}

export interface DiscordSyncAuditSummary {
  guildId: string;
  scannedMembers: number;
  mappedRoles: number;
  addedEdges: number;
  removedEdges: number;
}

export interface DiscordSyncPlan {
  upsertPrincipals: Principal[];
  addEdges: PrincipalEdge[];
  removeEdges: PrincipalEdge[];
  audit: DiscordSyncAuditSummary;
}

export interface DiscordRoleConnectorOptions {
  guildId: string;
  roleMappings: DiscordRoleMapping[];
  existingEdges: PrincipalEdge[];
  serverId?: string;
  edgeTtlMs?: number;
  now?: () => Date;
}

export type ReducerCaller = (name: string, args: unknown) => Promise<unknown>;

export class DiscordRoleConnector {
  private readonly guildId: string;
  private readonly roleMappings: DiscordRoleMapping[];
  private readonly existingEdges: PrincipalEdge[];
  private readonly serverId: string;
  private readonly edgeTtlMs: number | undefined;
  private readonly now: () => Date;

  public constructor(options: DiscordRoleConnectorOptions) {
    this.guildId = requireNonEmpty(options.guildId, "Discord connector guildId");
    this.roleMappings = options.roleMappings.map((mapping) => ({
      discordRoleId: requireNonEmpty(mapping.discordRoleId, "Discord role mapping role id"),
      targetPrincipalId: requireNonEmpty(mapping.targetPrincipalId, "Discord role mapping target principal")
    })).sort((a, b) => a.discordRoleId.localeCompare(b.discordRoleId));
    this.existingEdges = [...options.existingEdges];
    this.serverId = options.serverId === undefined
      ? "server-1"
      : requireNonEmpty(options.serverId, "Discord connector serverId");
    this.edgeTtlMs = options.edgeTtlMs;
    this.now = options.now ?? (() => new Date());
  }

  public planSync(members: DiscordMemberSnapshot[]): DiscordSyncPlan {
    validateMembers(members);
    const desiredEdges: PrincipalEdge[] = [];
    const principalsById = new Map<string, Principal>();
    const source = this.source();

    for (const mapping of this.roleMappings) {
      principalsById.set(this.rolePrincipalId(mapping.discordRoleId), {
        id: this.rolePrincipalId(mapping.discordRoleId),
        type: "discord_role",
        externalId: `${this.guildId}:${mapping.discordRoleId}`,
        name: `Discord Role ${mapping.discordRoleId}`
      });
    }

    for (const member of members) {
      const memberRoles = new Set(member.roleIds);
      for (const mapping of this.roleMappings) {
        if (!memberRoles.has(mapping.discordRoleId)) {
          continue;
        }

        const childPrincipalId = this.memberRolePrincipalId(member.userId, mapping.discordRoleId);
        principalsById.set(childPrincipalId, {
          id: childPrincipalId,
          type: "discord_role",
          externalId: `${this.guildId}:${member.userId}:${mapping.discordRoleId}`,
          name: `${member.displayName} ${mapping.discordRoleId}`
        });
        const edge: PrincipalEdge = {
          parentPrincipalId: mapping.targetPrincipalId,
          childPrincipalId,
          source
        };
        if (this.edgeTtlMs !== undefined) {
          edge.expiresAt = new Date(this.now().getTime() + this.edgeTtlMs);
        }
        desiredEdges.push(edge);
      }
    }

    const existingConnectorEdges = this.existingEdges.filter((edge) => edge.source === source);
    const activeExistingConnectorEdges = existingConnectorEdges.filter((edge) => !this.isExpired(edge.expiresAt));
    const addEdges = difference(desiredEdges, activeExistingConnectorEdges, edgeKey);
    const removeEdges = difference(existingConnectorEdges, desiredEdges, edgeKey);

    return {
      upsertPrincipals: [...principalsById.values()].sort((a, b) => a.id.localeCompare(b.id)),
      addEdges,
      removeEdges,
      audit: {
        guildId: this.guildId,
        scannedMembers: members.length,
        mappedRoles: this.roleMappings.length,
        addedEdges: addEdges.length,
        removedEdges: removeEdges.length
      }
    };
  }

  public async applyPlan(plan: DiscordSyncPlan, callReducer: ReducerCaller): Promise<void> {
    for (const principal of plan.upsertPrincipals) {
      await callReducer("upsert_principal", principal);
    }

    for (const edge of plan.addEdges) {
      await callReducer("add_principal_edge", {
        id: edgeKey(edge),
        ...edge
      });
    }

    for (const edge of plan.removeEdges) {
      await callReducer("remove_principal_edge", {
        edgeId: edgeKey(edge)
      });
    }

    await callReducer("write_audit_log", {
      id: `discord.role_sync:${this.guildId}`,
      serverId: this.serverId,
      actorId: `connector:discord:${this.guildId}`,
      pluginId: "connector.discord",
      actionType: "discord.role_sync",
      permissionKey: "",
      targetType: "discord_guild",
      targetId: this.guildId,
      beforeJson: "{}",
      afterJson: JSON.stringify(plan.audit),
      status: "succeeded",
    });
  }

  private source(): string {
    return `discord:${this.guildId}`;
  }

  private rolePrincipalId(roleId: string): string {
    return `discord:${this.guildId}:${roleId}`;
  }

  private memberRolePrincipalId(userId: string, roleId: string): string {
    return `discord:${this.guildId}:${userId}:${roleId}`;
  }

  private isExpired(expiresAt: Date | undefined): boolean {
    return expiresAt !== undefined && expiresAt.getTime() <= this.now().getTime();
  }
}

function difference<T>(left: T[], right: T[], getKey: (value: T) => string): T[] {
  const rightKeys = new Set(right.map(getKey));
  return left.filter((value) => !rightKeys.has(getKey(value))).sort((a, b) => getKey(a).localeCompare(getKey(b)));
}

function edgeKey(edge: PrincipalEdge): string {
  return `${edge.parentPrincipalId}:${edge.childPrincipalId}:${edge.source}`;
}

function validateMembers(members: DiscordMemberSnapshot[]): void {
  for (const member of members) {
    requireNonEmpty(member.userId, "Discord member userId");
    for (const roleId of member.roleIds) {
      requireNonEmpty(roleId, "Discord member role id");
    }
  }
}

function requireNonEmpty(value: string, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }

  return value.trim();
}
