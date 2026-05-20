import { describe, expect, it } from "vitest";
import { PluginRegistry } from "../src/core/plugins.js";

describe("PluginRegistry hook manifests", () => {
  it("exposes active hook declarations from plugin manifests", () => {
    const registry = new PluginRegistry();
    registry.install({
      pluginId: "mechanic_core",
      name: "Mechanic Core",
      version: "1.0.0",
      hooks: [
        {
          hookName: "on_vehicle_damaged",
          capability: "vehicle.inspect",
          handlerType: "reducer",
          handlerRef: "mechanic.inspect_damage",
          priority: 10
        }
      ]
    });

    expect(registry.getActiveHooks()).toEqual([]);

    registry.enable("mechanic_core");

    expect(registry.getActiveHooks()).toEqual([
      {
        id: "mechanic_core:on_vehicle_damaged:mechanic.inspect_damage",
        pluginId: "mechanic_core",
        hookName: "on_vehicle_damaged",
        capability: "vehicle.inspect",
        handlerType: "reducer",
        handlerRef: "mechanic.inspect_damage",
        priority: 10,
        enabled: true
      }
    ]);
  });

  it("defaults hook handler type and rejects malformed hook declarations", () => {
    const registry = new PluginRegistry();
    registry.install({
      pluginId: "weather_core",
      name: "Weather Core",
      version: "1.0.0",
      hooks: [{ hookName: "on_weather_changed", capability: "weather.sync", handlerRef: "weather.sync" }]
    });
    registry.enable("weather_core");

    expect(registry.getActiveHooks()).toEqual([
      expect.objectContaining({
        handlerType: "action",
        handlerRef: "weather.sync"
      })
    ]);

    expect(() =>
      registry.install({
        pluginId: "bad_hooks",
        name: "Bad Hooks",
        version: "1.0.0",
        hooks: [
          {
            hookName: "on_vehicle_damaged",
            capability: "vehicle.inspect",
            handlerType: "lua" as never,
            handlerRef: "mechanic.inspect_damage"
          }
        ]
      })
    ).toThrow("Plugin hook on_vehicle_damaged has invalid handler type: lua");
  });
});
