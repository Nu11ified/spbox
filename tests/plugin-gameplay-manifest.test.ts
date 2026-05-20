import { describe, expect, it } from "vitest";
import { PluginRegistry } from "../src/core/plugins.js";

describe("PluginRegistry gameplay manifest primitives", () => {
  it("exposes active gameplay primitives from plugin manifests", () => {
    const registry = new PluginRegistry();
    registry.install({
      pluginId: "mechanic_core",
      name: "Mechanic Core",
      version: "1.0.0",
      items: [{ key: "repair_kit", label: "Repair Kit", stackable: true, maxStack: 10 }],
      jobs: [{ key: "mechanic", label: "Mechanic", grades: ["trainee", "lead"] }],
      vehicles: [{ model: "flatbed", label: "Flatbed", category: "service" }],
      locations: [{ key: "shop", label: "Shop", x: 1, y: 2, z: 3 }]
    });

    expect(registry.getActiveGameplayPrimitives()).toEqual({
      items: [],
      jobs: [],
      vehicles: [],
      locations: []
    });

    registry.enable("mechanic_core");

    expect(registry.getActiveGameplayPrimitives()).toEqual({
      items: [expect.objectContaining({ key: "repair_kit", pluginId: "mechanic_core" })],
      jobs: [expect.objectContaining({ key: "mechanic", pluginId: "mechanic_core" })],
      vehicles: [expect.objectContaining({ model: "flatbed", pluginId: "mechanic_core" })],
      locations: [expect.objectContaining({ key: "shop", pluginId: "mechanic_core" })]
    });
  });
});
