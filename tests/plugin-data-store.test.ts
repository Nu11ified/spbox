import { describe, expect, it } from "vitest";
import { PluginDataStore } from "../src/core/plugin-data.js";

describe("PluginDataStore", () => {
  it("registers plugin schemas and validates namespaced entity writes", () => {
    const store = new PluginDataStore({
      now: () => new Date("2026-05-18T12:00:00.000Z"),
      idFactory: () => "entity-1"
    });

    store.registerSchema({
      pluginId: "mechanic_core",
      schemaVersion: 1,
      entityType: "work_order",
      schema: {
        type: "object",
        required: ["vehicleNetId", "status"],
        properties: {
          vehicleNetId: { type: "number" },
          status: { type: "string" }
        }
      }
    });

    const entity = store.upsertEntity({
      pluginId: "mechanic_core",
      entityType: "work_order",
      ownerType: "character",
      ownerId: "char:1",
      data: {
        vehicleNetId: 44,
        status: "open"
      }
    });

    expect(entity).toEqual({
      id: "entity-1",
      pluginId: "mechanic_core",
      entityType: "work_order",
      ownerType: "character",
      ownerId: "char:1",
      data: {
        vehicleNetId: 44,
        status: "open"
      },
      createdAt: new Date("2026-05-18T12:00:00.000Z"),
      updatedAt: new Date("2026-05-18T12:00:00.000Z")
    });
  });

  it("rejects writes for another plugin namespace or invalid schema data", () => {
    const store = new PluginDataStore();
    store.registerSchema({
      pluginId: "mechanic_core",
      schemaVersion: 1,
      entityType: "work_order",
      schema: {
        type: "object",
        required: ["status"],
        properties: {
          status: { type: "string" }
        }
      }
    });

    expect(() =>
      store.upsertEntity({
        pluginId: "economy_core",
        entityType: "work_order",
        ownerType: "character",
        ownerId: "char:1",
        data: { status: "open" }
      })
    ).toThrow("No schema registered for economy_core:work_order");

    expect(() =>
      store.upsertEntity({
        pluginId: "mechanic_core",
        entityType: "work_order",
        ownerType: "character",
        ownerId: "char:1",
        data: { status: 123 }
      })
    ).toThrow("Expected status to be string");
  });

  it("rejects changing the entity type for an existing plugin entity id", () => {
    const store = new PluginDataStore();
    store.registerSchema({
      pluginId: "mechanic_core",
      schemaVersion: 1,
      entityType: "work_order",
      schema: {
        type: "object",
        required: ["status"],
        properties: {
          status: { type: "string" }
        }
      }
    });
    store.registerSchema({
      pluginId: "mechanic_core",
      schemaVersion: 1,
      entityType: "inspection",
      schema: {
        type: "object",
        required: ["status"],
        properties: {
          status: { type: "string" }
        }
      }
    });
    store.upsertEntity({
      id: "entity-1",
      pluginId: "mechanic_core",
      entityType: "work_order",
      ownerType: "character",
      ownerId: "char:1",
      data: { status: "open" }
    });

    expect(() =>
      store.upsertEntity({
        id: "entity-1",
        pluginId: "mechanic_core",
        entityType: "inspection",
        ownerType: "character",
        ownerId: "char:1",
        data: { status: "ready" }
      })
    ).toThrow("Entity entity-1 belongs to entity type work_order");
  });
});
