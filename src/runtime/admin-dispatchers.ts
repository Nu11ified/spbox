import {
  type AdminService,
  type KickDispatch,
  type TeleportDispatch,
  type VehicleRepairDispatch,
  type VehicleSpawnDispatch,
  type WorldStateUpdate
} from "../admin/service.js";
import { type RuntimeBridgeOptions } from "./bridge.js";

type AdminGameplayRuntimeDispatchers = Pick<
  RuntimeBridgeOptions,
  | "vehicleRepairDispatcher"
  | "vehicleSpawnDispatcher"
  | "worldStateDispatcher"
  | "teleportDispatcher"
  | "kickDispatcher"
>;

type AdminRuntimeDispatchers = AdminGameplayRuntimeDispatchers & Pick<
  RuntimeBridgeOptions,
  | "economyAdminAdjustDispatcher"
  | "pluginStatusDispatcher"
>;

export function createAdminGameplayRuntimeDispatchers(input: {
  admin: AdminService;
  serverId: string;
}): AdminGameplayRuntimeDispatchers {
  return {
    vehicleSpawnDispatcher: (_principalId, payload) => {
      const spawn = withServerId<VehicleSpawnDispatch>(input.serverId, payload);
      return input.admin.queueVehicleSpawns([spawn])[0];
    },
    vehicleRepairDispatcher: (_principalId, payload) => {
      const repair = withServerId<VehicleRepairDispatch>(input.serverId, payload);
      return input.admin.queueVehicleRepairs([repair])[0];
    },
    worldStateDispatcher: (_principalId, payload) => {
      const world = requirePayloadObject(payload);
      const update: WorldStateUpdate = {
        serverId: input.serverId,
        world: {
          weatherType: world.weatherType as string | undefined,
          hour: world.hour as number | undefined,
          minute: world.minute as number | undefined
        }
      };
      return input.admin.queueWorldState([update])[0];
    },
    teleportDispatcher: (_principalId, payload) => {
      const teleport = withServerId<TeleportDispatch>(input.serverId, payload);
      return input.admin.queueTeleports([teleport])[0];
    },
    kickDispatcher: (_principalId, payload) => {
      const kick = withServerId<KickDispatch>(input.serverId, payload);
      return input.admin.queueKicks([kick])[0];
    }
  };
}

export function createAdminRuntimeDispatchers(input: {
  admin: AdminService;
  serverId: string;
}): AdminRuntimeDispatchers {
  return {
    ...createAdminGameplayRuntimeDispatchers(input),
    economyAdminAdjustDispatcher: async (principalId, payload) => {
      const adjustment = requirePayloadObject(payload);
      const idempotencyKey = requireString(adjustment.idempotencyKey, "idempotencyKey");
      const transactionId = `runtime:${input.serverId}:${principalId}:${idempotencyKey}`;
      await input.admin.adjustEconomyBalance({
        transactionId,
        actorId: principalId,
        accountId: requireString(adjustment.accountId, "accountId"),
        direction: requireString(adjustment.direction, "direction"),
        amount: requireNumber(adjustment.amount, "amount"),
        reason: requireString(adjustment.reason, "reason"),
        idempotencyKey
      });
      return {
        transactionId,
        accountId: adjustment.accountId,
        direction: adjustment.direction,
        amount: adjustment.amount,
        currency: adjustment.currency,
        reason: adjustment.reason,
        idempotencyKey
      };
    },
    pluginStatusDispatcher: async (_principalId, payload) => {
      const statusUpdate = requirePayloadObject(payload);
      const pluginId = requireString(statusUpdate.pluginId, "pluginId");
      const status = requireString(statusUpdate.status, "status");
      if (status === "active") {
        input.admin.enablePlugin(pluginId);
      } else if (status === "disabled") {
        input.admin.disablePlugin(pluginId);
      } else {
        throw new Error("Plugin status dispatcher only supports active or disabled status");
      }
      return {
        pluginId,
        status,
        menuRefreshQueued: true
      };
    }
  };
}

function withServerId<T>(serverId: string, payload: unknown): T {
  return {
    serverId,
    ...requirePayloadObject(payload)
  } as T;
}

function requirePayloadObject(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Runtime dispatcher payload must be an object");
  }

  return payload as Record<string, unknown>;
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${name} must be a non-empty string`);
  }

  return value;
}

function requireNumber(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number`);
  }

  return value;
}
