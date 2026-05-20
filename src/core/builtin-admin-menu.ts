import { type MenuAction, type MenuDefinition } from "./menu.js";

export interface BuiltinAdminMenuCatalog {
  menus: MenuDefinition[];
  actions: MenuAction[];
}

const pluginId = "sdb_admin";

export function createBuiltinAdminMenu(): BuiltinAdminMenuCatalog {
  const menus: MenuDefinition[] = [
    section("admin.root", "Admin", undefined, "shield", 0),
    section("admin.players", "Players", "admin.root", "users", 10),
    section("admin.vehicles", "Vehicles", "admin.root", "car", 20),
    section("admin.world", "World", "admin.root", "cloud-sun", 30),
    section("admin.teleport", "Teleport", "admin.root", "map-pin", 40),
    section("admin.economy", "Economy", "admin.root", "banknote", 50),
    section("admin.plugins", "Plugins", "admin.root", "package", 60),
    section("admin.runtime", "Runtime", "admin.root", "activity", 70),
    section("admin.audit", "Audit", "admin.root", "search", 80),
    item("admin.players.kick", "Kick Player", "admin.players", "user-x", 10, "admin.players.kick"),
    item("admin.vehicles.repair", "Repair Vehicle", "admin.vehicles", "wrench", 10, "admin.vehicles.repair"),
    item("admin.vehicles.spawn", "Spawn Vehicle", "admin.vehicles", "car-front", 20, "admin.vehicles.spawn"),
    item("admin.world.weather", "Set Weather", "admin.world", "cloud", 10, "admin.world.weather"),
    item("admin.world.time", "Set Time", "admin.world", "clock", 20, "admin.world.time"),
    item("admin.teleport.to_marker", "Teleport To Marker", "admin.teleport", "crosshair", 10, "admin.teleport.to_marker"),
    item("admin.economy.adjust_balance", "Adjust Balance", "admin.economy", "circle-dollar-sign", 10, "economy.admin.adjust_balance"),
    item("admin.plugins.toggle", "Toggle Plugin", "admin.plugins", "power", 10, "plugins.manage"),
    item("admin.runtime.health", "Runtime Health", "admin.runtime", "heart-pulse", 10, "runtime.health.view"),
    item("admin.audit.search", "Audit Search", "admin.audit", "search", 10, "audit.search")
  ];
  const actions: MenuAction[] = [
    {
      id: "admin.players.kick",
      pluginId,
      actionType: "kick_player",
      requiredPermission: "admin.players.kick",
      confirmationRequired: true,
      payloadSchema: objectSchema(["targetSource", "reason"], {
        targetSource: { type: "string" },
        reason: { type: "string" }
      }),
      auditLevel: "high",
      enabled: true
    },
    {
      id: "admin.vehicles.repair",
      pluginId,
      actionType: "repair_vehicle",
      requiredPermission: "admin.vehicles.repair",
      payloadSchema: objectSchema(["targetSource", "targetVehicleNetId"], {
        targetSource: { type: "string" },
        targetVehicleNetId: { type: "number" }
      }),
      auditLevel: "standard",
      enabled: true
    },
    {
      id: "admin.vehicles.spawn",
      pluginId,
      actionType: "spawn_vehicle",
      requiredPermission: "admin.vehicles.spawn",
      payloadSchema: objectSchema(["targetSource", "model"], {
        targetSource: { type: "string" },
        model: { type: "string" },
        heading: { type: "number" },
        warpIntoVehicle: { type: "boolean" }
      }),
      auditLevel: "standard",
      enabled: true
    },
    {
      id: "admin.world.weather",
      pluginId,
      actionType: "set_weather",
      requiredPermission: "admin.world.weather",
      payloadSchema: objectSchema(["weatherType"], {
        weatherType: {
          type: "string",
          enum: ["EXTRASUNNY", "CLEAR", "CLOUDS", "OVERCAST", "RAIN", "THUNDER", "FOGGY", "XMAS"]
        }
      }),
      auditLevel: "standard",
      enabled: true
    },
    {
      id: "admin.world.time",
      pluginId,
      actionType: "set_time",
      requiredPermission: "admin.world.time",
      payloadSchema: objectSchema(["hour", "minute"], {
        hour: { type: "number" },
        minute: { type: "number" }
      }),
      auditLevel: "standard",
      enabled: true
    },
    {
      id: "admin.teleport.to_marker",
      pluginId,
      actionType: "teleport_player",
      requiredPermission: "admin.teleport.to_marker",
      payloadSchema: objectSchema(["targetSource", "x", "y", "z"], {
        targetSource: { type: "string" },
        x: { type: "number" },
        y: { type: "number" },
        z: { type: "number" },
        heading: { type: "number" }
      }),
      auditLevel: "standard",
      enabled: true
    },
    {
      id: "admin.economy.adjust_balance",
      pluginId,
      actionType: "economy_admin_adjust_balance",
      requiredPermission: "economy.admin.adjust_balance",
      confirmationRequired: true,
      payloadSchema: objectSchema(["accountId", "direction", "amount", "currency", "reason", "idempotencyKey"], {
        accountId: { type: "string" },
        direction: { type: "string", enum: ["credit", "debit"] },
        amount: { type: "number" },
        currency: { type: "string", enum: ["cash", "bank"] },
        reason: { type: "string" },
        idempotencyKey: { type: "string" }
      }),
      auditLevel: "high",
      enabled: true
    },
    {
      id: "admin.plugins.toggle",
      pluginId,
      actionType: "set_plugin_status",
      requiredPermission: "plugins.manage",
      confirmationRequired: true,
      payloadSchema: objectSchema(["pluginId", "status"], {
        pluginId: { type: "string" },
        status: { type: "string", enum: ["active", "disabled"] }
      }),
      auditLevel: "high",
      enabled: true
    },
    {
      id: "admin.runtime.health",
      pluginId,
      actionType: "open_panel",
      requiredPermission: "runtime.health.view",
      payloadSchema: objectSchema([], {}),
      auditLevel: "none",
      enabled: true
    },
    {
      id: "admin.audit.search",
      pluginId,
      actionType: "open_panel",
      requiredPermission: "audit.search",
      payloadSchema: objectSchema(["query"], {
        query: { type: "string" },
        actorId: { type: "string" },
        actionType: { type: "string" }
      }),
      auditLevel: "standard",
      enabled: true
    }
  ];

  return { menus, actions };
}

function section(
  id: string,
  label: string,
  parentId: string | undefined,
  icon: string,
  order: number
): MenuDefinition {
  return {
    id,
    pluginId,
    label,
    parentId,
    icon,
    order,
    enabled: true
  };
}

function item(
  id: string,
  label: string,
  parentId: string,
  icon: string,
  order: number,
  requiredPermission: string
): MenuDefinition {
  return {
    id,
    pluginId,
    label,
    parentId,
    icon,
    order,
    requiredPermission,
    actionId: id,
    enabled: true
  };
}

function objectSchema(
  required: string[],
  properties: Record<string, { type: "string" | "number" | "boolean"; enum?: Array<string | number | boolean> }>
): unknown {
  return {
    type: "object",
    required,
    properties
  };
}
