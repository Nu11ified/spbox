export type PrincipalType = "player" | "group" | "discord_role" | "resource" | "server" | "temp";
export type PermissionEffect = "allow" | "deny";
export type PolicyConstraintType = "max_amount" | "requires_state" | "namespace_scope";
export type AceMirrorMode = "allow_only" | "allow_and_deny";

export interface Principal {
  id: string;
  type: PrincipalType;
  externalId: string;
  name: string;
}

export interface PrincipalEdge {
  parentPrincipalId: string;
  childPrincipalId: string;
  source: string;
  expiresAt?: Date;
}

export interface PermissionGrant {
  principalId: string;
  permissionKey: string;
  effect: PermissionEffect;
  source: string;
  expiresAt?: Date;
}

export interface PermissionDefinition {
  id: string;
  key: string;
  description: string;
  pluginId: string;
}

export interface PermissionCacheVersion {
  serverId: string;
  version: number;
  updatedAt?: Date;
}

export interface AceMirrorRule {
  id?: string;
  permissionKey: string;
  aceObject: string;
  enabled: boolean;
  mode: AceMirrorMode;
}

export interface PolicyConstraint {
  id: string;
  permissionKey: string;
  constraintType: PolicyConstraintType;
  constraint: Record<string, unknown>;
  priority: number;
  enabled: boolean;
}

export interface PermissionEvaluationContext {
  amount?: number;
  currency?: string;
  namespace?: string;
  state?: Record<string, unknown>;
}

export interface PermissionDecision {
  allowed: boolean;
  permissionKey: string;
  matchedGrant?: PermissionGrant;
  resolvedPrincipals: string[];
  policyResults?: PolicyConstraintResult[];
  deniedByPolicy?: PolicyConstraint;
}

export interface PermissionEngineOptions {
  principals: Principal[];
  edges: PrincipalEdge[];
  grants: PermissionGrant[];
  policies?: PolicyConstraint[];
  now?: () => Date;
}

export interface PolicyConstraintResult {
  policy: PolicyConstraint;
  passed: boolean;
  reason?: string;
}

export class PermissionDeniedError extends Error {
  public readonly decision: PermissionDecision;

  public constructor(decision: PermissionDecision) {
    super(`Permission denied: ${decision.permissionKey}`);
    this.name = "PermissionDeniedError";
    this.decision = decision;
  }
}

export class PermissionEngine {
  private readonly edges: PrincipalEdge[];
  private readonly grants: PermissionGrant[];
  private readonly policies: PolicyConstraint[];
  private readonly now: () => Date;

  public constructor(options: PermissionEngineOptions) {
    this.edges = options.edges;
    this.grants = options.grants;
    this.policies = options.policies ?? [];
    this.now = options.now ?? (() => new Date());
  }

  public hasPermission(
    principalId: string,
    permissionKey: string,
    context: PermissionEvaluationContext = {}
  ): PermissionDecision {
    const resolvedPrincipals = this.resolvePrincipals(principalId);
    const matchingGrants = this.grants.filter(
      (grant) =>
        grant.permissionKey === permissionKey &&
        resolvedPrincipals.includes(grant.principalId) &&
        !this.isExpired(grant.expiresAt)
    );

    const denyGrant = matchingGrants.find((grant) => grant.effect === "deny");
    if (denyGrant) {
      return {
        allowed: false,
        permissionKey,
        matchedGrant: denyGrant,
        resolvedPrincipals
      };
    }

    const allowGrant = matchingGrants.find((grant) => grant.effect === "allow");
    if (!allowGrant) {
      return {
        allowed: false,
        permissionKey,
        matchedGrant: undefined,
        resolvedPrincipals
      };
    }

    const policyResults = this.evaluatePolicies(permissionKey, context);
    const failedPolicy = policyResults.find((result) => !result.passed);
    if (failedPolicy) {
      return {
        allowed: false,
        permissionKey,
        matchedGrant: allowGrant,
        resolvedPrincipals,
        policyResults,
        deniedByPolicy: failedPolicy.policy
      };
    }

    return {
      allowed: true,
      permissionKey,
      matchedGrant: allowGrant,
      resolvedPrincipals,
      policyResults: policyResults.length > 0 ? policyResults : undefined
    };
  }

  public assertPermission(
    principalId: string,
    permissionKey: string,
    context: PermissionEvaluationContext = {}
  ): PermissionDecision {
    const decision = this.hasPermission(principalId, permissionKey, context);
    if (!decision.allowed) {
      throw new PermissionDeniedError(decision);
    }

    return decision;
  }

  private resolvePrincipals(principalId: string): string[] {
    const visited = new Set<string>();
    const stack = [principalId];

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current || visited.has(current)) {
        continue;
      }

      visited.add(current);

      for (const edge of this.edges) {
        if (edge.childPrincipalId === current && !this.isExpired(edge.expiresAt)) {
          stack.push(edge.parentPrincipalId);
        }
      }
    }

    return [...visited].sort();
  }

  private isExpired(expiresAt: Date | undefined): boolean {
    return expiresAt !== undefined && expiresAt.getTime() <= this.now().getTime();
  }

  private evaluatePolicies(permissionKey: string, context: PermissionEvaluationContext): PolicyConstraintResult[] {
    return this.policies
      .filter((policy) => policy.enabled && policy.permissionKey === permissionKey)
      .sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id))
      .map((policy) => this.evaluatePolicy(policy, context));
  }

  private evaluatePolicy(policy: PolicyConstraint, context: PermissionEvaluationContext): PolicyConstraintResult {
    if (policy.constraintType === "max_amount") {
      const maxAmount = policy.constraint.amount;
      const expectedCurrency = policy.constraint.currency;
      const currencyMatches =
        expectedCurrency === undefined || expectedCurrency === context.currency;
      const amountMatches =
        typeof maxAmount === "number" &&
        typeof context.amount === "number" &&
        context.amount <= maxAmount;

      return {
        policy,
        passed: amountMatches && currencyMatches,
        reason: amountMatches && currencyMatches ? undefined : "amount exceeds policy"
      };
    }

    if (policy.constraintType === "requires_state") {
      const key = policy.constraint.key;
      const expected = policy.constraint.equals;
      const passed =
        typeof key === "string" &&
        context.state !== undefined &&
        context.state[key] === expected;

      return {
        policy,
        passed,
        reason: passed ? undefined : "required state missing"
      };
    }

    if (policy.constraintType === "namespace_scope") {
      const namespace = policy.constraint.namespace;
      const passed = typeof namespace === "string" && context.namespace === namespace;
      return {
        policy,
        passed,
        reason: passed ? undefined : "namespace outside policy scope"
      };
    }

    return {
      policy,
      passed: false,
      reason: "unknown policy constraint type"
    };
  }
}
