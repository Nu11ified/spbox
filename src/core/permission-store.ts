import { type AuditLogEntry } from "./audit.js";
import {
  PermissionEngine,
  type AceMirrorRule,
  type PermissionEffect,
  type PermissionDefinition,
  type PermissionGrant,
  type PolicyConstraint,
  type Principal,
  type PrincipalEdge
} from "./permissions.js";

export interface GrantPermissionInput {
  principalId: string;
  permissionKey: string;
  effect: PermissionEffect;
  source: string;
  expiresAt?: Date;
}

export interface PermissionStoreOptions {
  now?: () => Date;
}

export interface PermissionSnapshot {
  permissions: PermissionDefinition[];
  principals: Principal[];
  edges: PrincipalEdge[];
  grants: PermissionGrant[];
  policies: PolicyConstraint[];
  aceMirrorRules: AceMirrorRule[];
}

export class PermissionStore {
  private readonly principalsById = new Map<string, Principal>();
  private readonly permissionsById = new Map<string, PermissionDefinition>();
  private readonly edgesByKey = new Map<string, PrincipalEdge>();
  private readonly grantsByKey = new Map<string, PermissionGrant>();
  private readonly policiesById = new Map<string, PolicyConstraint>();
  private readonly aceMirrorRulesById = new Map<string, AceMirrorRule>();
  private readonly auditEvents: AuditLogEntry[] = [];
  private readonly now: () => Date;

  public constructor(options: PermissionStoreOptions = {}) {
    this.now = options.now ?? (() => new Date());
  }

  public upsertPrincipal(principal: Principal): Principal {
    this.principalsById.set(principal.id, { ...principal });
    this.audit("permission.upsert_principal", principal.id);
    return { ...principal };
  }

  public registerPermission(permission: PermissionDefinition): PermissionDefinition {
    this.permissionsById.set(permission.id, { ...permission });
    this.audit("permission.register_permission", permission.id);
    return { ...permission };
  }

  public upsertAceMirrorRule(rule: AceMirrorRule): AceMirrorRule {
    const id = rule.id ?? `${rule.permissionKey}:${rule.aceObject}`;
    const record = { ...rule, id };
    this.aceMirrorRulesById.set(id, record);
    this.audit("permission.upsert_ace_mirror_rule", id);
    return { ...record };
  }

  public addPrincipalEdge(edge: PrincipalEdge): PrincipalEdge {
    this.edgesByKey.set(this.edgeKey(edge.parentPrincipalId, edge.childPrincipalId, edge.source), {
      ...edge
    });
    this.audit("permission.add_edge", `${edge.parentPrincipalId}->${edge.childPrincipalId}`);
    return { ...edge };
  }

  public removePrincipalEdge(parentPrincipalId: string, childPrincipalId: string, source: string): void {
    this.edgesByKey.delete(this.edgeKey(parentPrincipalId, childPrincipalId, source));
    this.audit("permission.remove_edge", `${parentPrincipalId}->${childPrincipalId}`);
  }

  public grantPermission(input: GrantPermissionInput): PermissionGrant {
    const grant: PermissionGrant = { ...input };
    this.grantsByKey.set(this.grantKey(input.principalId, input.permissionKey, input.effect), grant);
    this.audit("permission.grant", `${input.principalId}:${input.permissionKey}`);
    return { ...grant };
  }

  public revokePermission(principalId: string, permissionKey: string): void {
    for (const key of [...this.grantsByKey.keys()]) {
      const grant = this.grantsByKey.get(key);
      if (grant?.principalId === principalId && grant.permissionKey === permissionKey) {
        this.grantsByKey.delete(key);
      }
    }
    this.audit("permission.revoke", `${principalId}:${permissionKey}`);
  }

  public upsertPolicyConstraint(policy: PolicyConstraint): PolicyConstraint {
    this.policiesById.set(policy.id, structuredClone(policy));
    this.audit("permission.upsert_policy_constraint", policy.id);
    return structuredClone(policy);
  }

  public removePolicyConstraint(policyId: string): void {
    this.policiesById.delete(policyId);
    this.audit("permission.remove_policy_constraint", policyId);
  }

  public snapshot(): PermissionSnapshot {
    return {
      permissions: [...this.permissionsById.values()].map((permission) => ({ ...permission })),
      principals: [...this.principalsById.values()].map((principal) => ({ ...principal })),
      edges: [...this.edgesByKey.values()].map((edge) => ({ ...edge })),
      grants: [...this.grantsByKey.values()].map((grant) => ({ ...grant })),
      policies: [...this.policiesById.values()].map((policy) => structuredClone(policy)),
      aceMirrorRules: [...this.aceMirrorRulesById.values()].map((rule) => ({ ...rule }))
    };
  }

  public toEngine(): PermissionEngine {
    const snapshot = this.snapshot();
    return new PermissionEngine({
      ...snapshot,
      now: this.now
    });
  }

  public getAuditEvents(): AuditLogEntry[] {
    return this.auditEvents.map((event) => ({ ...event }));
  }

  private audit(actionType: string, targetId: string): void {
    this.auditEvents.push({
      id: `${actionType}:${targetId}:${this.auditEvents.length + 1}`,
      actorId: "system",
      actionType,
      targetType: "permission",
      targetId,
      status: "succeeded",
      createdAt: this.now()
    });
  }

  private edgeKey(parentPrincipalId: string, childPrincipalId: string, source: string): string {
    return `${parentPrincipalId}:${childPrincipalId}:${source}`;
  }

  private grantKey(principalId: string, permissionKey: string, effect: PermissionEffect): string {
    return `${principalId}:${permissionKey}:${effect}`;
  }
}
