import { type AuditLogEntry } from "./audit.js";
import { validateSchema, type SimpleJsonSchema } from "./plugin-data.js";
import { type PermissionEngine, type PermissionEvaluationContext } from "./permissions.js";

export interface MenuDefinition {
  id: string;
  pluginId: string;
  label: string;
  parentId?: string;
  icon?: string;
  order: number;
  requiredPermission?: string;
  actionId?: string;
  enabled: boolean;
  visibilityPolicyId?: string;
}

export interface MenuAction {
  id: string;
  pluginId: string;
  actionType:
    | "runtime_action"
    | "call_reducer"
    | "trigger_server_handler"
    | "trigger_client_event"
    | "execute_server_command"
    | "set_runtime_config"
    | "open_panel"
    | "toggle_feature"
    | "repair_vehicle"
    | "spawn_vehicle"
    | "set_weather"
    | "set_time"
    | "teleport_player"
    | "kick_player"
    | "economy_admin_adjust_balance"
    | "set_plugin_status";
  reducerName?: string;
  payloadSchema?: unknown;
  confirmationRequired?: boolean;
  auditLevel: "none" | "standard" | "high";
  requiredPermission?: string;
  enabled: boolean;
}

export interface MenuTreeNode {
  id: string;
  pluginId: string;
  label: string;
  order: number;
  icon?: string;
  requiredPermission?: string;
  actionId?: string;
  payloadSchema?: unknown;
  confirmationRequired?: boolean;
  children: MenuTreeNode[];
}

export interface MenuVisibilityPolicy {
  id: string;
  pluginId: string;
  policy?: unknown;
  policyJson?: string;
  enabled: boolean;
}

export interface MenuVisibilityContext {
  state?: Record<string, unknown>;
}

export interface MenuRuntimeOptions {
  menus: MenuDefinition[];
  actions: MenuAction[];
  visibilityPolicies?: MenuVisibilityPolicy[];
  permissions: PermissionEngine;
  now?: () => Date;
}

export interface MenuActionExecutionOptions {
  confirmed?: boolean;
  serverId?: string;
}

export interface MenuActionExecutionResult {
  action: MenuAction;
  payload: unknown;
  audit?: AuditLogEntry;
}

export class MenuRuntime {
  private readonly menus: MenuDefinition[];
  private readonly actionsById: Map<string, MenuAction>;
  private readonly visibilityPoliciesById: Map<string, MenuVisibilityPolicy>;
  private permissions: PermissionEngine;
  private readonly now: () => Date;

  public constructor(options: MenuRuntimeOptions) {
    this.menus = options.menus;
    this.actionsById = new Map(options.actions.map((action) => [action.id, action]));
    this.visibilityPoliciesById = new Map(
      (options.visibilityPolicies ?? []).map((policy) => [policy.id, structuredClone(policy)])
    );
    this.permissions = options.permissions;
    this.now = options.now ?? (() => new Date());
  }

  public updatePermissions(permissions: PermissionEngine): void {
    this.permissions = permissions;
  }

  public getAction(actionId: string): MenuAction | undefined {
    const action = this.actionsById.get(actionId);
    return action ? structuredClone(action) : undefined;
  }

  public buildTreeForPrincipal(
    principalId: string,
    context: MenuVisibilityContext = {}
  ): MenuTreeNode[] {
    const visible = this.menus.filter((menu) => this.isVisible(principalId, menu, context));
    const byParent = new Map<string | undefined, MenuDefinition[]>();

    for (const menu of visible) {
      const siblings = byParent.get(menu.parentId) ?? [];
      siblings.push(menu);
      byParent.set(menu.parentId, siblings);
    }

    const build = (parentId: string | undefined): MenuTreeNode[] =>
      (byParent.get(parentId) ?? [])
        .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
        .map((menu): MenuTreeNode | undefined => {
          const children = build(menu.id);
          const action = menu.actionId ? this.actionsById.get(menu.actionId) : undefined;
          if (!menu.actionId && children.length === 0 && menu.parentId !== undefined) {
            return undefined;
          }

          const node: MenuTreeNode = {
            id: menu.id,
            pluginId: menu.pluginId,
            label: menu.label,
            order: menu.order,
            children
          };
          if (menu.icon !== undefined) {
            node.icon = menu.icon;
          }
          if (menu.requiredPermission !== undefined) {
            node.requiredPermission = menu.requiredPermission;
          }
          if (menu.actionId !== undefined) {
            node.actionId = menu.actionId;
          }
          if (action?.payloadSchema !== undefined) {
            node.payloadSchema = action.payloadSchema;
          }
          if (action?.confirmationRequired === true) {
            node.confirmationRequired = true;
          }
          return node;
        })
        .filter((node): node is MenuTreeNode => node !== undefined);

    return build(undefined);
  }

  public async executeAction(
    principalId: string,
    actionId: string,
    payload: unknown,
    options: MenuActionExecutionOptions = {}
  ): Promise<MenuActionExecutionResult> {
    const action = this.actionsById.get(actionId);
    if (!action || !action.enabled) {
      throw new Error(`Unknown or disabled action: ${actionId}`);
    }

    if (action.actionType === "execute_server_command" && !action.requiredPermission) {
      throw new Error("execute_server_command actions require an explicit permission");
    }

    if (action.requiredPermission) {
      this.permissions.assertPermission(
        principalId,
        action.requiredPermission,
        permissionContextFromPayload(payload)
      );
    }

    if (action.confirmationRequired && !options.confirmed) {
      throw new Error(`Action requires confirmation: ${action.id}`);
    }

    if (action.payloadSchema) {
      validateSchema(action.payloadSchema as SimpleJsonSchema, payload);
    }

    return {
      action,
      payload,
      audit: this.createAudit(principalId, action, options.serverId)
    };
  }

  private isVisible(principalId: string, menu: MenuDefinition, context: MenuVisibilityContext): boolean {
    if (!menu.enabled) {
      return false;
    }

    const action = menu.actionId ? this.actionsById.get(menu.actionId) : undefined;
    if (menu.actionId && (!action || !action.enabled)) {
      return false;
    }

    if (menu.visibilityPolicyId && !this.evaluateVisibilityPolicy(menu.visibilityPolicyId, context)) {
      return false;
    }

    if (
      menu.requiredPermission &&
      !this.permissions.hasPermission(principalId, menu.requiredPermission).allowed
    ) {
      return false;
    }

    return !action?.requiredPermission ||
      this.permissions.hasPermission(principalId, action.requiredPermission).allowed;
  }

  private evaluateVisibilityPolicy(policyId: string, context: MenuVisibilityContext): boolean {
    const policy = this.visibilityPoliciesById.get(policyId);
    if (!policy || !policy.enabled) {
      return false;
    }

    const body = parseVisibilityPolicy(policy);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return false;
    }

    const requiresState = (body as { requiresState?: unknown }).requiresState;
    if (requiresState && typeof requiresState === "object" && !Array.isArray(requiresState)) {
      const requirement = requiresState as { key?: unknown; equals?: unknown };
      if (typeof requirement.key !== "string" || requirement.key === "") {
        return false;
      }

      return context.state?.[requirement.key] === requirement.equals;
    }

    return false;
  }

  private createAudit(
    principalId: string,
    action: MenuAction,
    serverId: string | undefined
  ): AuditLogEntry | undefined {
    if (action.auditLevel === "none") {
      return undefined;
    }

    return {
      id: `menu:${action.id}:${this.now().getTime()}`,
      serverId,
      actorId: principalId,
      pluginId: action.pluginId,
      actionType: action.id,
      permissionKey: action.requiredPermission,
      status: "succeeded",
      createdAt: this.now()
    };
  }
}

function parseVisibilityPolicy(policy: MenuVisibilityPolicy): unknown {
  if (policy.policy !== undefined) {
    return structuredClone(policy.policy);
  }

  if (policy.policyJson === undefined) {
    return undefined;
  }

  try {
    return JSON.parse(policy.policyJson);
  } catch {
    return undefined;
  }
}

function permissionContextFromPayload(payload: unknown): PermissionEvaluationContext {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {};
  }

  const record = payload as Record<string, unknown>;
  return {
    amount: typeof record.amount === "number" ? record.amount : undefined,
    currency: typeof record.currency === "string" ? record.currency : undefined,
    namespace: typeof record.namespace === "string" ? record.namespace : undefined,
    state: record.state && typeof record.state === "object" && !Array.isArray(record.state)
      ? record.state as Record<string, unknown>
      : undefined
  };
}
