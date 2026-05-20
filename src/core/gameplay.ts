import { type AuditLogEntry } from "./audit.js";
import { type PermissionEngine } from "./permissions.js";

export interface ItemDefinition {
  key: string;
  label: string;
  stackable: boolean;
  maxStack?: number;
  pluginId?: string;
}

export interface JobDefinition {
  key: string;
  label: string;
  grades: string[];
  pluginId?: string;
}

export interface VehicleDefinition {
  model: string;
  label: string;
  category: string;
  pluginId?: string;
}

export interface LocationDefinition {
  key: string;
  label: string;
  x: number;
  y: number;
  z: number;
  pluginId?: string;
}

export interface PluginGameplayPrimitives {
  pluginId: string;
  items?: Array<Omit<ItemDefinition, "pluginId">>;
  jobs?: Array<Omit<JobDefinition, "pluginId">>;
  vehicles?: Array<Omit<VehicleDefinition, "pluginId">>;
  locations?: Array<Omit<LocationDefinition, "pluginId">>;
}

export interface InventoryStack {
  itemKey: string;
  quantity: number;
}

export interface CharacterJob {
  characterId: string;
  jobKey: string;
  grade: string;
  onDuty: boolean;
}

export interface GrantItemInput {
  actorPrincipalId: string;
  ownerId: string;
  itemKey: string;
  quantity: number;
}

export interface AssignJobInput {
  actorPrincipalId: string;
  characterId: string;
  jobKey: string;
  grade: string;
  onDuty: boolean;
}

export interface PlanVehicleSpawnInput {
  actorPrincipalId: string;
  model: string;
  locationKey?: string;
}

export interface VehicleSpawnPlan {
  model: string;
  label: string;
  category: string;
  location?: LocationDefinition;
  audit: AuditLogEntry;
}

export interface GameplayRegistryOptions {
  permissions: PermissionEngine;
  now?: () => Date;
  idFactory?: () => string;
}

export class GameplayRegistry {
  private readonly permissions: PermissionEngine;
  private readonly itemsByKey = new Map<string, ItemDefinition>();
  private readonly jobsByKey = new Map<string, JobDefinition>();
  private readonly vehiclesByModel = new Map<string, VehicleDefinition>();
  private readonly locationsByKey = new Map<string, LocationDefinition>();
  private readonly inventoryByOwner = new Map<string, InventoryStack[]>();
  private readonly jobsByCharacter = new Map<string, CharacterJob>();
  private readonly now: () => Date;
  private readonly idFactory: () => string;

  public constructor(options: GameplayRegistryOptions) {
    this.permissions = options.permissions;
    this.now = options.now ?? (() => new Date());
    this.idFactory = options.idFactory ?? (() => crypto.randomUUID());
  }

  public registerPluginPrimitives(input: PluginGameplayPrimitives): void {
    for (const item of input.items ?? []) {
      this.itemsByKey.set(item.key, { ...item, pluginId: input.pluginId });
    }

    for (const job of input.jobs ?? []) {
      this.jobsByKey.set(job.key, { ...job, pluginId: input.pluginId });
    }

    for (const vehicle of input.vehicles ?? []) {
      this.vehiclesByModel.set(vehicle.model, { ...vehicle, pluginId: input.pluginId });
    }

    for (const location of input.locations ?? []) {
      this.locationsByKey.set(location.key, { ...location, pluginId: input.pluginId });
    }
  }

  public getItem(itemKey: string): ItemDefinition | undefined {
    const item = this.itemsByKey.get(itemKey);
    return item ? { ...item } : undefined;
  }

  public getJob(jobKey: string): JobDefinition | undefined {
    const job = this.jobsByKey.get(jobKey);
    return job ? { ...job, grades: [...job.grades] } : undefined;
  }

  public getVehicle(model: string): VehicleDefinition | undefined {
    const vehicle = this.vehiclesByModel.get(model);
    return vehicle ? { ...vehicle } : undefined;
  }

  public getLocation(locationKey: string): LocationDefinition | undefined {
    const location = this.locationsByKey.get(locationKey);
    return location ? { ...location } : undefined;
  }

  public grantItem(input: GrantItemInput): AuditLogEntry {
    this.permissions.assertPermission(input.actorPrincipalId, "inventory.grant_item");
    this.validateQuantity(input.quantity);

    const item = this.itemsByKey.get(input.itemKey);
    if (!item) {
      throw new Error(`Unknown item: ${input.itemKey}`);
    }

    const inventory = this.inventoryByOwner.get(input.ownerId) ?? [];
    const existing = inventory.find((stack) => stack.itemKey === input.itemKey);
    if (existing && item.stackable) {
      const nextQuantity = existing.quantity + input.quantity;
      if (item.maxStack !== undefined && nextQuantity > item.maxStack) {
        throw new Error(`Item stack limit exceeded: ${input.itemKey}`);
      }
      existing.quantity = nextQuantity;
    } else {
      inventory.push({ itemKey: input.itemKey, quantity: input.quantity });
    }
    this.inventoryByOwner.set(input.ownerId, inventory);

    return this.audit(input.actorPrincipalId, "inventory.grant_item", "inventory", input.ownerId);
  }

  public getInventory(ownerId: string): InventoryStack[] {
    return (this.inventoryByOwner.get(ownerId) ?? []).map((stack) => ({ ...stack }));
  }

  public assignJob(input: AssignJobInput): AuditLogEntry {
    this.permissions.assertPermission(input.actorPrincipalId, "jobs.assign");

    const job = this.jobsByKey.get(input.jobKey);
    if (!job) {
      throw new Error(`Unknown job: ${input.jobKey}`);
    }

    if (!job.grades.includes(input.grade)) {
      throw new Error(`Unknown job grade: ${input.grade}`);
    }

    this.jobsByCharacter.set(input.characterId, {
      characterId: input.characterId,
      jobKey: input.jobKey,
      grade: input.grade,
      onDuty: input.onDuty
    });

    return this.audit(input.actorPrincipalId, "jobs.assign", "character", input.characterId);
  }

  public getCharacterJob(characterId: string): CharacterJob | undefined {
    const job = this.jobsByCharacter.get(characterId);
    return job ? { ...job } : undefined;
  }

  public planVehicleSpawn(input: PlanVehicleSpawnInput): VehicleSpawnPlan {
    this.permissions.assertPermission(input.actorPrincipalId, "vehicles.spawn");

    const vehicle = this.vehiclesByModel.get(input.model);
    if (!vehicle) {
      throw new Error(`Unknown vehicle: ${input.model}`);
    }

    const location = input.locationKey ? this.locationsByKey.get(input.locationKey) : undefined;
    if (input.locationKey && !location) {
      throw new Error(`Unknown location: ${input.locationKey}`);
    }

    return {
      model: vehicle.model,
      label: vehicle.label,
      category: vehicle.category,
      location: location ? { ...location } : undefined,
      audit: this.audit(input.actorPrincipalId, "vehicles.spawn", "vehicle", vehicle.model)
    };
  }

  private audit(
    actorId: string,
    actionType: string,
    targetType: string,
    targetId: string
  ): AuditLogEntry {
    return {
      id: this.idFactory(),
      actorId,
      actionType,
      permissionKey: actionType,
      targetType,
      targetId,
      status: "succeeded",
      createdAt: this.now()
    };
  }

  private validateQuantity(quantity: number): void {
    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      throw new Error("Quantity must be a positive integer");
    }
  }
}
