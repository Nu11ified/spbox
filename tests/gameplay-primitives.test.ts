import { describe, expect, it } from "vitest";
import { GameplayRegistry } from "../src/core/gameplay.js";
import { PermissionEngine, type PermissionGrant } from "../src/core/permissions.js";

const grants: PermissionGrant[] = [
  { principalId: "plugin:mechanic", permissionKey: "inventory.grant_item", effect: "allow", source: "manual" },
  { principalId: "plugin:mechanic", permissionKey: "jobs.assign", effect: "allow", source: "manual" },
  { principalId: "player:admin", permissionKey: "vehicles.spawn", effect: "allow", source: "manual" }
];

function createRegistry() {
  return new GameplayRegistry({
    permissions: new PermissionEngine({ principals: [], edges: [], grants }),
    now: () => new Date("2026-05-18T12:00:00.000Z"),
    idFactory: () => "audit-1"
  });
}

describe("GameplayRegistry", () => {
  it("registers items, jobs, vehicles, and locations from plugin primitives", () => {
    const registry = createRegistry();

    registry.registerPluginPrimitives({
      pluginId: "mechanic_core",
      items: [{ key: "repair_kit", label: "Repair Kit", stackable: true, maxStack: 10 }],
      jobs: [{ key: "mechanic", label: "Mechanic", grades: ["trainee", "lead"] }],
      vehicles: [{ model: "flatbed", label: "Flatbed", category: "service" }],
      locations: [{ key: "mechanic_shop", label: "Mechanic Shop", x: 1, y: 2, z: 3 }]
    });

    expect(registry.getItem("repair_kit")).toEqual(
      expect.objectContaining({ key: "repair_kit", pluginId: "mechanic_core" })
    );
    expect(registry.getJob("mechanic")?.grades).toEqual(["trainee", "lead"]);
    expect(registry.getVehicle("flatbed")?.category).toBe("service");
    expect(registry.getLocation("mechanic_shop")).toEqual(
      expect.objectContaining({ x: 1, y: 2, z: 3 })
    );
  });

  it("mutates inventory and job assignment through permission-checked actions", () => {
    const registry = createRegistry();
    registry.registerPluginPrimitives({
      pluginId: "mechanic_core",
      items: [{ key: "repair_kit", label: "Repair Kit", stackable: true, maxStack: 10 }],
      jobs: [{ key: "mechanic", label: "Mechanic", grades: ["trainee", "lead"] }]
    });

    const itemAudit = registry.grantItem({
      actorPrincipalId: "plugin:mechanic",
      ownerId: "char:1",
      itemKey: "repair_kit",
      quantity: 2
    });
    const jobAudit = registry.assignJob({
      actorPrincipalId: "plugin:mechanic",
      characterId: "char:1",
      jobKey: "mechanic",
      grade: "trainee",
      onDuty: true
    });

    expect(registry.getInventory("char:1")).toEqual([{ itemKey: "repair_kit", quantity: 2 }]);
    expect(registry.getCharacterJob("char:1")).toEqual({
      characterId: "char:1",
      jobKey: "mechanic",
      grade: "trainee",
      onDuty: true
    });
    expect(itemAudit.actionType).toBe("inventory.grant_item");
    expect(jobAudit.actionType).toBe("jobs.assign");
  });

  it("plans vehicle spawn actions from registered vehicles", () => {
    const registry = createRegistry();
    registry.registerPluginPrimitives({
      pluginId: "garage_core",
      vehicles: [{ model: "sultan", label: "Sultan", category: "car" }]
    });

    const spawn = registry.planVehicleSpawn({
      actorPrincipalId: "player:admin",
      model: "sultan",
      locationKey: undefined
    });

    expect(spawn).toEqual({
      model: "sultan",
      label: "Sultan",
      category: "car",
      audit: expect.objectContaining({
        actorId: "player:admin",
        actionType: "vehicles.spawn",
        permissionKey: "vehicles.spawn",
        status: "succeeded"
      })
    });
  });

  it("rejects unknown primitives and missing permissions", () => {
    const registry = createRegistry();

    expect(() =>
      registry.grantItem({
        actorPrincipalId: "plugin:mechanic",
        ownerId: "char:1",
        itemKey: "missing",
        quantity: 1
      })
    ).toThrow("Unknown item: missing");

    expect(() =>
      registry.planVehicleSpawn({
        actorPrincipalId: "player:user",
        model: "sultan",
        locationKey: undefined
      })
    ).toThrow("Permission denied: vehicles.spawn");
  });
});
