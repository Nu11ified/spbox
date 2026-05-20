export type AuditStatus = "succeeded" | "failed" | "denied";

export interface AuditLogEntry {
  id: string;
  serverId?: string;
  actorId: string;
  pluginId?: string;
  actionType: string;
  permissionKey?: string;
  targetType?: string;
  targetId?: string;
  before?: unknown;
  after?: unknown;
  status: AuditStatus;
  createdAt: Date;
}
