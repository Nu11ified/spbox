import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

describe("Qbox/QBX compatibility resource facade", () => {
  it("declares a qbx_core-compatible FiveM resource facade over sdb_runtime", () => {
    expect(existsSync("resources/[compat]/qbx_core/fxmanifest.lua")).toBe(true);

    const manifest = read("resources/[compat]/qbx_core/fxmanifest.lua");
    expect(manifest).toContain("fx_version 'cerulean'");
    expect(manifest).toContain("game 'gta5'");
    expect(manifest).toContain("provide 'qbx_core'");
    expect(manifest).toContain("dependency 'sdb_runtime'");
    expect(manifest).toContain("'shared/main.lua'");
    expect(manifest).toContain("'client/main.lua'");
    expect(manifest).toContain("'modules/playerdata.lua'");
    expect(manifest).toContain("server_script 'server/main.lua'");
  });

  it("exports Qbox server player, metadata, money, job, gang, and permission helpers through sdb_runtime", () => {
    const server = read("resources/[compat]/qbx_core/server/main.lua");

    expect(server).toContain("local function ResolvePlayer(identifier)");
    expect(server).toContain("return exports.sdb_runtime:GetQbPlayer(identifier)");
    expect(server).toContain("return exports.sdb_runtime:GetQbPlayerByCitizenId(identifier)");
    expect(server).toContain("exports('GetPlayer', ResolvePlayer)");
    expect(server).toContain("exports('GetPlayerByCitizenId', function(citizenid)");
    expect(server).toContain("exports('GetPlayerByPhone', function(number)");
    expect(server).toContain("exports('GetQBPlayers', function()");
    expect(server).toContain("exports.sdb_runtime:GetQbPlayers()");
    expect(server).toContain("exports('GetPlayersData', function()");
    expect(server).toContain("exports('SetPlayerData', function(identifier, key, value)");
    expect(server).toContain("player.Functions.SetPlayerData(key, value)");
    expect(server).toContain("exports('UpdatePlayerData', function(identifier)");
    expect(server).toContain("player.Functions.UpdatePlayerData()");
    expect(server).toContain("exports('GetMetadata', function(identifier, metadata)");
    expect(server).toContain("player.Functions.GetMetaData(metadata)");
    expect(server).toContain("exports('SetMetadata', function(identifier, metadata, value)");
    expect(server).toContain("player.Functions.SetMetaData(metadata, value)");
    expect(server).toContain("exports('SetCharInfo', function(identifier, charInfo, value)");
    expect(server).toContain("player.Functions.SetPlayerData('charinfo', playerData.charinfo)");
    expect(server).toContain("exports('GetDutyCountJob', function(job)");
    expect(server).toContain("exports.sdb_runtime:GetQbDutyCount(job)");
    expect(server).toContain("exports('CreateUseableItem', function(item, data)");
    expect(server).toContain("UseableItems[item] = data");
    expect(server).toContain("exports('CanUseItem', function(item)");
    expect(server).toContain("exports('HasPermission', function(source, permission)");
    expect(server).toContain("exports.sdb_runtime:HasPermission(source, permission)");
    expect(server).toContain("exports('SetJob', function(identifier, jobName, grade)");
    expect(server).toContain("player.Functions.SetJob(jobName, grade)");
    expect(server).toContain("exports('SetJobDuty', function(identifier, onDuty)");
    expect(server).toContain("player.Functions.SetJobDuty(onDuty)");
    expect(server).toContain("exports('SetGang', function(identifier, gangName, grade)");
    expect(server).toContain("player.Functions.SetGang(gangName, grade)");
    expect(server).toContain("exports('HasPrimaryGroup', function(source, filter)");
    expect(server).toContain("exports('HasGroup', function(source, filter)");
    expect(server).toContain("exports('GetGroups', function(source)");
    expect(server).toContain("exports('GetMoney', function(identifier, moneyType)");
    expect(server).toContain("player.Functions.GetMoney(moneyType)");
    expect(server).toContain("exports('AddMoney', function(identifier, moneyType, amount, reason)");
    expect(server).toContain("player.Functions.AddMoney(moneyType, amount, reason or 'qbx_core')");
    expect(server).toContain("exports('RemoveMoney', function(identifier, moneyType, amount, reason)");
    expect(server).toContain("exports('SetMoney', function(identifier, moneyType, amount, reason)");
    expect(server).toContain("exports('Login', function(source, citizenid, newData)");
    expect(server).toContain("exports.sdb_runtime:SelectQbCharacter(source, data.citizenid, data)");
    expect(server).toContain("exports('Save', function(source)");
    expect(server).toContain("player.Functions.Save()");
    expect(server).toContain("exports('Logout', function(source)");
    expect(server).toContain("player.Functions.Logout()");
  });

  it("exports Qbox shared data helpers from runtime shared state", () => {
    const shared = read("resources/[compat]/qbx_core/shared/main.lua");

    expect(shared).toContain("QBX = QBX or {}");
    expect(shared).toContain("return exports.sdb_runtime:GetQbShared() or {}");
    expect(shared).toContain("exports('GetJobs', function()");
    expect(shared).toContain("return Shared().Jobs or {}");
    expect(shared).toContain("exports('GetGangs', function()");
    expect(shared).toContain("exports('GetJob', function(jobName)");
    expect(shared).toContain("exports('GetGang', function(gangName)");
    expect(shared).toContain("exports('GetVehiclesByName', function(vehicle)");
    expect(shared).toContain("exports('GetVehiclesByHash', function(vehicle)");
    expect(shared).toContain("exports('GetVehiclesByCategory', function()");
    expect(shared).toContain("exports('GetWeapons', function(weapon)");
    expect(shared).toContain("exports('GetLocations', function()");
  });

  it("provides the Qbox playerdata module and client player data export", () => {
    const client = read("resources/[compat]/qbx_core/client/main.lua");
    const module = read("resources/[compat]/qbx_core/modules/playerdata.lua");

    expect(client).toContain("QBX = QBX or {}");
    expect(client).toContain("QBX.PlayerData = exports.sdb_runtime:GetQbPlayerData()");
    expect(client).toContain("exports('GetPlayerData', function()");
    expect(client).toContain("RegisterNetEvent('QBCore:Player:SetPlayerData', function(playerData)");
    expect(client).toContain("RegisterNetEvent('qbx_core:client:playerDataUpdated', function(playerData)");
    expect(module).toContain("QBX = QBX or {}");
    expect(module).toContain("QBX.PlayerData = exports.sdb_runtime:GetQbPlayerData()");
    expect(module).toContain("RegisterNetEvent('QBCore:Player:SetPlayerData', function(playerData)");
    expect(module).toContain("RegisterNetEvent('QBCore:Client:OnPlayerUnload', function()");
  });
});
