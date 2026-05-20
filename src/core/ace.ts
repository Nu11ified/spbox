import {
  type AceMirrorRule,
  type PermissionEffect,
  type PermissionGrant,
  type PrincipalEdge
} from "./permissions.js";

export interface MirroredAce {
  principalId: string;
  aceObject: string;
  effect: PermissionEffect;
}

export interface MirroredPrincipal {
  childPrincipalId: string;
  parentPrincipalId: string;
}

export interface AceMirrorState {
  aces: MirroredAce[];
  principals: MirroredPrincipal[];
}

export interface AceMirrorDesiredState {
  edges: PrincipalEdge[];
  grants: PermissionGrant[];
  rules: AceMirrorRule[];
}

export interface AceMirrorPlanInput {
  current: AceMirrorState;
  desired: AceMirrorDesiredState;
  now?: () => Date;
}

export interface AceMirrorPlan {
  commands: string[];
  desired: AceMirrorState;
}

export function planAceMirrorCommands(input: AceMirrorPlanInput): AceMirrorPlan {
  validateMirrorState(input.current);
  validateDesiredMirrorState(input.desired);
  const desired = buildDesiredMirrorState(input.desired, input.now ?? (() => new Date()));
  validateMirrorState(desired);

  const removeCommands = [
    ...difference(input.current.aces, desired.aces, aceKey).map(
      (ace) => `remove_ace ${ace.principalId} ${ace.aceObject} ${ace.effect}`
    ),
    ...difference(input.current.principals, desired.principals, principalKey).map(
      (principal) => `remove_principal ${principal.childPrincipalId} ${principal.parentPrincipalId}`
    )
  ];

  const addCommands = [
    ...difference(desired.aces, input.current.aces, aceKey).map(
      (ace) => `add_ace ${ace.principalId} ${ace.aceObject} ${ace.effect}`
    ),
    ...difference(desired.principals, input.current.principals, principalKey).map(
      (principal) => `add_principal ${principal.childPrincipalId} ${principal.parentPrincipalId}`
    )
  ];

  return {
    desired,
    commands: [...removeCommands, ...addCommands].sort()
  };
}

function buildDesiredMirrorState(desired: AceMirrorDesiredState, now: () => Date): AceMirrorState {
  const rulesByPermission = new Map(
    desired.rules.filter((rule) => rule.enabled).map((rule) => [rule.permissionKey, rule])
  );
  const aces: MirroredAce[] = [];

  for (const grant of desired.grants.filter((candidate) => !isExpired(candidate.expiresAt, now))) {
    const rule = rulesByPermission.get(grant.permissionKey);
    if (!rule) {
      continue;
    }

    if (grant.effect === "deny" && rule.mode === "allow_only") {
      continue;
    }

    aces.push({
      principalId: grant.principalId,
      aceObject: rule.aceObject,
      effect: grant.effect
    });
  }

  const principals = desired.edges
    .filter((edge) => !isExpired(edge.expiresAt, now))
    .map((edge) => ({
      childPrincipalId: edge.childPrincipalId,
      parentPrincipalId: edge.parentPrincipalId
    }));

  return {
    aces: uniqueBy(aces, aceKey).sort(compareBy(aceKey)),
    principals: uniqueBy(principals, principalKey).sort(compareBy(principalKey))
  };
}

function validateDesiredMirrorState(desired: AceMirrorDesiredState): void {
  for (const rule of desired.rules) {
    validateAceToken(rule.permissionKey, "ACE permission key");
    validateAceToken(rule.aceObject, "ACE object");
    if (rule.mode !== "allow_only" && rule.mode !== "allow_and_deny") {
      throw new Error(`Unknown ACE mirror mode: ${rule.mode}`);
    }
  }

  for (const grant of desired.grants) {
    validateAceToken(grant.principalId, "ACE principal id");
    validateAceToken(grant.permissionKey, "ACE permission key");
    validateAceEffect(grant.effect);
  }

  for (const edge of desired.edges) {
    validateAceToken(edge.childPrincipalId, "ACE child principal id");
    validateAceToken(edge.parentPrincipalId, "ACE parent principal id");
  }
}

function validateMirrorState(state: AceMirrorState): void {
  for (const ace of state.aces) {
    validateAceToken(ace.principalId, "ACE principal id");
    validateAceToken(ace.aceObject, "ACE object");
    validateAceEffect(ace.effect);
  }

  for (const principal of state.principals) {
    validateAceToken(principal.childPrincipalId, "ACE child principal id");
    validateAceToken(principal.parentPrincipalId, "ACE parent principal id");
  }
}

function validateAceToken(value: string, label: string): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  if (/\s/.test(value)) {
    throw new Error(`${label} must not contain whitespace`);
  }
}

function validateAceEffect(effect: PermissionEffect): void {
  if (effect !== "allow" && effect !== "deny") {
    throw new Error(`Unknown ACE effect: ${effect}`);
  }
}

function difference<T>(left: T[], right: T[], getKey: (value: T) => string): T[] {
  const rightKeys = new Set(right.map(getKey));
  return left.filter((value) => !rightKeys.has(getKey(value))).sort(compareBy(getKey));
}

function uniqueBy<T>(values: T[], getKey: (value: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const value of values) {
    const key = getKey(value);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(value);
    }
  }

  return result;
}

function compareBy<T>(getKey: (value: T) => string): (a: T, b: T) => number {
  return (a, b) => getKey(a).localeCompare(getKey(b));
}

function aceKey(ace: MirroredAce): string {
  return `${ace.principalId}:${ace.aceObject}:${ace.effect}`;
}

function principalKey(principal: MirroredPrincipal): string {
  return `${principal.childPrincipalId}:${principal.parentPrincipalId}`;
}

function isExpired(expiresAt: Date | undefined, now: () => Date): boolean {
  return expiresAt !== undefined && expiresAt.getTime() <= now().getTime();
}
