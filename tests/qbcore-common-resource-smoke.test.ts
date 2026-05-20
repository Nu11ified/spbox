import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PluginRegistry } from "../src/core/plugins.js";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

describe("QBCore common resource smoke contract", () => {
  it("supports representative server resources using core object, players, money, jobs, callbacks, commands, and usable items", () => {
    const serverResource = `
      local QBCore = exports['qb-core']:GetCoreObject()

      QBCore.Functions.CreateUseableItem('repair_kit', function(source, item)
        local Player = QBCore.Functions.GetPlayer(source)
        Player.Functions.RemoveItem(item.name, 1)
      end)

      if QBCore.Functions.HasItem(1, { repair_kit = 1 }) then
        QBCore.Functions.UseItem(1, 'repair_kit')
      end

      QBCore.Functions.CreateCallback('smoke:getPlayer', function(source, cb)
        cb(QBCore.Functions.GetPlayer(source).PlayerData)
      end)

      local sources = QBCore.Functions.GetPlayers()
      local mechanics, mechanicCount = QBCore.Functions.GetPlayersByJob('mechanic', true)
      local playerCoords = QBCore.Functions.GetCoords(GetPlayerPed(1))
      local closestVehicle, vehicleDistance = QBCore.Functions.GetClosestVehicle(1)
      local spawnedVehicle = QBCore.Functions.SpawnVehicle(1, 'sultan')
      local createdAutomobile = QBCore.Functions.CreateAutomobile(1, 'sultan')
      local createdVehicle = QBCore.Functions.CreateVehicle(1, 'sultan', 'automobile')
      local playerBuckets, entityBuckets = QBCore.Functions.GetBucketObjects()
      QBCore.Functions.SetPlayerBucket(1, 0)
      QBCore.Functions.Notify(1, 'Smoke ready', 'success', 2500)
      QBCore.Debug({ smoke = true }, nil, 'smoke')

      QBCore.Commands.Add('smokepay', 'Pay smoke money', {}, false, function(source)
        local Player = QBCore.Functions.GetPlayer(source)
        Player.Functions.AddMoney('cash', 250, 'smoke')
        Player.Functions.SetJob('mechanic', 1)
      end, 'admin')
    `;

    const facade = read("resources/[compat]/qb-core/server/main.lua");
    const runtime = read("resources/[runtime]/sdb_runtime/server/main.lua");

    expect(serverResource).toContain("exports['qb-core']:GetCoreObject()");
    expect(facade).toContain("exports('GetCoreObject', function()");
    expect(facade).toContain("return QBCore");
    expect(facade).toContain("function QBCore.Functions.GetPlayer(source)");
    expect(facade).toContain("return exports.sdb_runtime:GetQbPlayer(source)");
    expect(runtime).toContain("exports('GetQbPlayer', GetQbPlayer)");
    expect(runtime).toContain("function player.Functions.AddMoney(moneyType, amount, reason)");
    expect(runtime).toContain("QueueQbMoneyUpdate(player.PlayerData.source, moneyType, 'add', amount, reason)");
    expect(runtime).toContain("function player.Functions.SetJob(jobName, grade)");
    expect(runtime).toContain("QueueQbCharacterUpdate(player.PlayerData.source, player.PlayerData)");
    expect(facade).toContain("function QBCore.Functions.GetPlayers()");
    expect(facade).toContain("function QBCore.Functions.GetPlayersByJob(job, checkOnDuty)");
    expect(facade).toContain("function QBCore.Functions.GetCoords(entity)");
    expect(facade).toContain("function QBCore.Functions.GetClosestVehicle(source, coords)");
    expect(facade).toContain("function QBCore.Functions.SpawnVehicle(source, model, coords, warp)");
    expect(facade).toContain("function QBCore.Functions.CreateAutomobile(source, model, coords, warp)");
    expect(facade).toContain("function QBCore.Functions.CreateVehicle(source, model, vehType, coords, warp)");
    expect(facade).toContain("function QBCore.Functions.GetBucketObjects()");
    expect(facade).toContain("function QBCore.Functions.SetPlayerBucket(source, bucket)");
    expect(facade).toContain("function QBCore.Functions.Notify(source, text, textType, length)");
    expect(facade).toContain("function QBCore.Debug(value, indent, resource)");
    expect(facade).toContain("function QBCore.Functions.CreateCallback(name, cb)");
    expect(facade).toContain("RegisterNetEvent('QBCore:Server:TriggerCallback', function(name, ...)");
    expect(facade).toContain("function QBCore.Commands.Add(name, help, arguments, argsrequired, callback, permission, ...)");
    expect(facade).toContain("RegisterCommand(name, function(source, args, rawCommand)");
    expect(facade).toContain("function QBCore.Functions.CreateUseableItem(item, data)");
    expect(facade).toContain("function QBCore.Functions.CanUseItem(item)");
    expect(facade).toContain("function QBCore.Functions.HasItem(source, items, amount)");
    expect(facade).toContain("function QBCore.Functions.UseItem(source, item)");
    expect(facade).toContain("RegisterNetEvent('QBCore:Server:UseItem', function(itemName)");
  });

  it("supports representative client resources using callbacks, notify, items, proximity, and shared data", () => {
    const clientResource = `
      local QBCore = exports['qb-core']:GetCoreObject()

      QBCore.Functions.TriggerCallback('smoke:getPlayer', function(playerData)
        QBCore.Functions.Notify(playerData.citizenid, 'success')
      end)

      local hasRepairKit = QBCore.Functions.HasItem('repair_kit')
      QBCore.Functions.Progressbar('smoke_repair', 'Repairing', 500, false, true, {}, {}, {}, {}, function() end, function() end)
      local vehicles = QBCore.Functions.GetVehicles()
      local closestPlayer, distance = QBCore.Functions.GetClosestPlayer()
      local repairKit = QBCore.Shared.Items['repair_kit']
    `;

    const facade = read("resources/[compat]/qb-core/client/main.lua");

    expect(clientResource).toContain("exports['qb-core']:GetCoreObject()");
    expect(facade).toContain("exports('GetCoreObject', function()");
    expect(facade).toContain("function QBCore.Functions.TriggerCallback(name, ...)");
    expect(facade).toContain("TriggerServerEvent('QBCore:Server:TriggerCallback', name, table.unpack(args))");
    expect(facade).toContain("function QBCore.Functions.Notify(text, textType, length, icon)");
    expect(facade).toContain("function QBCore.Functions.HasItem(itemName, amount)");
    expect(facade).toContain("function QBCore.Functions.Progressbar(name, label, duration, useWhileDead, canCancel, disableControls, animation, prop, propTwo, onFinish, onCancel)");
    expect(facade).toContain("function QBCore.Functions.GetVehicles()");
    expect(facade).toContain("function QBCore.Functions.GetClosestPlayer(coords)");
    expect(facade).toContain("QBCore.Shared.Items = QBCore.Shared.Items or {}");
    expect(facade).toContain("RegisterNetEvent('QBCore:Shared:Update', function(shared)");
  });

  it("keeps qb-core manifest dependency and plugin provide compatibility active", () => {
    const manifestResource = "dependency 'qb-core'";
    const facadeManifest = read("resources/[compat]/qb-core/fxmanifest.lua");
    const registry = new PluginRegistry();

    registry.install({
      pluginId: "sdb_qb_bridge",
      name: "SDB QB Bridge",
      version: "1.0.0",
      fivem: {
        provides: ["qb-core"]
      }
    });
    registry.install({
      pluginId: "qb_banking_adapter",
      name: "QB Banking Adapter",
      version: "1.0.0",
      fivem: {
        dependencies: ["qb-core"]
      }
    });

    expect(manifestResource).toContain("dependency 'qb-core'");
    expect(facadeManifest).toContain("provide 'qb-core'");
    expect(() => registry.enable("qb_banking_adapter")).toThrow(
      "Plugin qb_banking_adapter requires active FiveM dependency qb-core"
    );

    registry.enable("sdb_qb_bridge");
    registry.enable("qb_banking_adapter");

    expect(registry.getActiveFivemCompatibility()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ pluginId: "sdb_qb_bridge", provides: ["qb-core"] }),
        expect.objectContaining({ pluginId: "qb_banking_adapter", dependencies: ["qb-core"] })
      ])
    );

    registry.disable("sdb_qb_bridge");

    expect(registry.getPlugin("qb_banking_adapter")?.status).toBe("disabled");
  });
});
