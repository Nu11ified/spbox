import { describe, expect, it } from "vitest";
import { FakeSpacetimeClient, SpacetimeRuntimeAdapter } from "../src/spacetime/adapter.js";

describe("SpacetimeRuntimeAdapter gameplay cache", () => {
  it("caches gameplay primitives, inventory/job state, and plugin hooks", async () => {
    const client = new FakeSpacetimeClient({
      items: [
        {
          key: "repair_kit",
          pluginId: "mechanic_core",
          label: "Repair Kit",
          stackable: true,
          maxStack: 10
        }
      ],
      jobs: [
        {
          key: "mechanic",
          pluginId: "mechanic_core",
          label: "Mechanic",
          gradesJson: "[\"trainee\",\"lead\"]"
        }
      ],
      vehicles: [
        {
          model: "flatbed",
          pluginId: "mechanic_core",
          label: "Flatbed",
          category: "service"
        }
      ],
      locations: [
        {
          key: "shop",
          pluginId: "mechanic_core",
          label: "Mechanic Shop",
          x: 1,
          y: 2,
          z: 3
        }
      ],
      characters: [
        {
          id: "char:ada",
          playerPrincipalId: "player:7",
          citizenId: "CITIZEN-ADA",
          cid: 2,
          slot: 2,
          license: "license:abc",
          name: "Ada Lovelace",
          charinfoJson: "{\"firstname\":\"Ada\",\"lastname\":\"Lovelace\",\"phone\":\"555-0101\"}",
          metadataJson: "{\"hunger\":87,\"thirst\":64}",
          positionJson: "{\"x\":10,\"y\":20,\"z\":30,\"heading\":90}",
          phoneNumber: "555-0101",
          accountNumber: "ACCT-ADA",
          selected: true,
          updatedAt: new Date("2026-05-18T12:00:00.000Z")
        }
      ],
      inventory_stacks: [
        {
          id: "char:1:repair_kit",
          ownerId: "char:1",
          itemKey: "repair_kit",
          quantity: 2,
          updatedAt: new Date("2026-05-18T12:00:00.000Z")
        }
      ],
      character_jobs: [
        {
          characterId: "char:1",
          jobKey: "mechanic",
          grade: "trainee",
          onDuty: true,
          updatedAt: new Date("2026-05-18T12:00:00.000Z")
        }
      ],
      plugin_hooks: [
        {
          id: "hook:late",
          pluginId: "mechanic_core",
          hookName: "on_vehicle_damaged",
          capability: "vehicle.repair",
          handlerType: "sidecar",
          handlerRef: "mechanic.late",
          priority: 20,
          enabled: true
        },
        {
          id: "hook:early",
          pluginId: "mechanic_core",
          hookName: "on_vehicle_damaged",
          capability: "vehicle.inspect",
          handlerType: "reducer",
          handlerRef: "mechanic.early",
          priority: 5,
          enabled: true
        }
      ]
    });
    const adapter = new SpacetimeRuntimeAdapter(client);

    await adapter.connectAndSubscribe("server-1");

    expect(adapter.cache.getItem("repair_kit")?.maxStack).toBe(10);
    expect(adapter.cache.getJob("mechanic")?.gradesJson).toBe("[\"trainee\",\"lead\"]");
    expect(adapter.cache.getVehicle("flatbed")?.category).toBe("service");
    expect(adapter.cache.getLocation("shop")).toEqual(expect.objectContaining({ x: 1, y: 2, z: 3 }));
    expect(adapter.cache.getSelectedCharacterForPlayer("player:7")).toEqual(
      expect.objectContaining({
        id: "char:ada",
        citizenId: "CITIZEN-ADA",
        cid: 2,
        selected: true
      })
    );
    expect(adapter.cache.getInventoryForOwner("char:1")).toEqual([
      expect.objectContaining({ itemKey: "repair_kit", quantity: 2 })
    ]);
    expect(adapter.cache.getCharacterJob("char:1")).toEqual(
      expect.objectContaining({ jobKey: "mechanic", onDuty: true })
    );
    expect(adapter.cache.getPluginHooksForHook("on_vehicle_damaged").map((row) => row.id)).toEqual([
      "hook:early",
      "hook:late"
    ]);
    expect(adapter.cache.getPluginHooksForHook("on_vehicle_damaged").map((row) => row.handlerType)).toEqual([
      "reducer",
      "sidecar"
    ]);

    client.emitUpdate("inventory_stacks", {
      id: "char:1:repair_kit",
      ownerId: "char:1",
      itemKey: "repair_kit",
      quantity: 4,
      updatedAt: new Date("2026-05-18T12:01:00.000Z")
    });

    expect(adapter.cache.getInventoryForOwner("char:1")[0]?.quantity).toBe(4);

    client.emitUpdate("characters", {
      id: "char:ada",
      playerPrincipalId: "player:7",
      citizenId: "CITIZEN-ADA",
      cid: 2,
      slot: 2,
      license: "license:abc",
      name: "Ada Byron",
      charinfoJson: "{\"firstname\":\"Ada\",\"lastname\":\"Byron\"}",
      metadataJson: "{\"hunger\":80}",
      positionJson: "{\"x\":11,\"y\":21,\"z\":31}",
      phoneNumber: "555-0101",
      accountNumber: "ACCT-ADA",
      selected: true,
      updatedAt: new Date("2026-05-18T12:02:00.000Z")
    });

    expect(adapter.cache.getSelectedCharacterForPlayer("player:7")?.name).toBe("Ada Byron");
  });
});
