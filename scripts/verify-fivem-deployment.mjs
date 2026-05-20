import { existsSync, readFileSync } from "node:fs";

const runtimeManifestPath = "resources/[runtime]/sdb_runtime/fxmanifest.lua";
const runtimeServerPath = "resources/[runtime]/sdb_runtime/server/main.lua";
const runtimeClientPath = "resources/[runtime]/sdb_runtime/client/main.lua";
const runtimeNuiPath = "resources/[runtime]/sdb_runtime/web/index.html";
const runtimeNuiAppPath = "resources/[runtime]/sdb_runtime/web/app.js";
const runtimeBootstrapPath = "resources/[runtime]/sdb_runtime/config/bootstrap.example.json";
const qbManifestPath = "resources/[compat]/qb-core/fxmanifest.lua";
const qbServerPath = "resources/[compat]/qb-core/server/main.lua";
const qbClientPath = "resources/[compat]/qb-core/client/main.lua";
const qbxManifestPath = "resources/[compat]/qbx_core/fxmanifest.lua";
const qbxServerPath = "resources/[compat]/qbx_core/server/main.lua";
const qbxClientPath = "resources/[compat]/qbx_core/client/main.lua";
const qbxSharedPath = "resources/[compat]/qbx_core/shared/main.lua";
const qbxPlayerDataModulePath = "resources/[compat]/qbx_core/modules/playerdata.lua";
const smokeManifestPath = "resources/[test]/sdb_runtime_smoke/fxmanifest.lua";
const smokeServerPath = "resources/[test]/sdb_runtime_smoke/server/main.lua";
const smokeClientPath = "resources/[test]/sdb_runtime_smoke/client/main.lua";
const qbcoreFixtureManifestPath = "resources/[test]/sdb_qbcore_fixture/fxmanifest.lua";
const qbcoreFixtureServerPath = "resources/[test]/sdb_qbcore_fixture/server/main.lua";
const qbcoreFixtureClientPath = "resources/[test]/sdb_qbcore_fixture/client/main.lua";
const qboxFixtureManifestPath = "resources/[test]/sdb_qbox_fixture/fxmanifest.lua";
const qboxFixtureServerPath = "resources/[test]/sdb_qbox_fixture/server/main.lua";
const qboxFixtureClientPath = "resources/[test]/sdb_qbox_fixture/client/main.lua";

const trustedSyncEvents = [
  "sdb_runtime:syncPermissions",
  "sdb_runtime:syncConfig",
  "sdb_runtime:syncHealth",
  "sdb_runtime:syncMenuTree",
  "sdb_runtime:syncDeployments",
  "sdb_runtime:syncQbPlayerData",
  "sdb_runtime:syncQbShared",
  "sdb_runtime:syncReplicatedState",
  "sdb_runtime:dispatchClientEvent",
  "sdb_runtime:repairVehicle",
  "sdb_runtime:spawnVehicles",
  "sdb_runtime:syncWorldState",
  "sdb_runtime:teleportPlayer",
  "sdb_runtime:kickPlayer",
  "sdb_runtime:syncMenuRefresh",
  "sdb_runtime:applyAceMirror"
];

function read(path) {
  if (!existsSync(path)) {
    throw new Error(`Missing deployable file: ${path}`);
  }
  return readFileSync(path, "utf8");
}

function requireContains(label, content, expected) {
  if (!content.includes(expected)) {
    throw new Error(`${label} missing required content: ${expected}`);
  }
}

function eventBlock(source, eventName) {
  const start = source.indexOf(`RegisterNetEvent('${eventName}'`);
  if (start === -1) {
    throw new Error(`Missing trusted sync event: ${eventName}`);
  }
  const next = source.indexOf("RegisterNetEvent('", start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}

const runtimeManifest = read(runtimeManifestPath);
const runtimeServer = read(runtimeServerPath);
const runtimeClient = read(runtimeClientPath);
const qbManifest = read(qbManifestPath);
const qbServer = read(qbServerPath);
const qbClient = read(qbClientPath);
const qbxManifest = read(qbxManifestPath);
const qbxServer = read(qbxServerPath);
const qbxClient = read(qbxClientPath);
const qbxShared = read(qbxSharedPath);
const qbxPlayerDataModule = read(qbxPlayerDataModulePath);
const smokeManifest = read(smokeManifestPath);
const smokeServer = read(smokeServerPath);
const smokeClient = read(smokeClientPath);
const qbcoreFixtureManifest = read(qbcoreFixtureManifestPath);
const qbcoreFixtureServer = read(qbcoreFixtureServerPath);
const qbcoreFixtureClient = read(qbcoreFixtureClientPath);
const qboxFixtureManifest = read(qboxFixtureManifestPath);
const qboxFixtureServer = read(qboxFixtureServerPath);
const qboxFixtureClient = read(qboxFixtureClientPath);
read(runtimeNuiPath);
read(runtimeNuiAppPath);
read(runtimeBootstrapPath);

for (const expected of [
  "fx_version 'cerulean'",
  "game 'gta5'",
  "client_script 'client/main.lua'",
  "server_script 'server/main.lua'",
  "ui_page 'web/index.html'",
  "'web/index.html'",
  "'web/app.js'",
  "'config/bootstrap.example.json'"
]) {
  requireContains(runtimeManifestPath, runtimeManifest, expected);
}

for (const expected of [
  "fx_version 'cerulean'",
  "game 'gta5'",
  "provide 'qb-core'",
  "dependency 'sdb_runtime'",
  "client_script 'client/main.lua'",
  "server_script 'server/main.lua'"
]) {
  requireContains(qbManifestPath, qbManifest, expected);
}

for (const expected of [
  "fx_version 'cerulean'",
  "game 'gta5'",
  "provide 'qbx_core'",
  "dependency 'sdb_runtime'",
  "'shared/main.lua'",
  "'client/main.lua'",
  "'modules/playerdata.lua'",
  "server_script 'server/main.lua'"
]) {
  requireContains(qbxManifestPath, qbxManifest, expected);
}

for (const expected of [
  "exports('HasPermission'",
  "exports('CallAction'",
  "exports('GetConfig'",
  "exports('GetHealth'",
  "exports('GetDeployments'",
  "RegisterCommand('sdb_runtime_emit'",
  "pcall(json.decode, raw)",
  "DispatchRuntimeEvent(envelope.eventName, envelope.payload or {})"
]) {
  requireContains(runtimeServerPath, runtimeServer, expected);
}

for (const expected of [
  "RegisterNUICallback('callAction'",
  "TriggerServerEvent('sdb_runtime:clientAction'",
  "RegisterNetEvent('sdb_runtime:menuTree'",
  "exports('GetQbPlayerData'",
  "exports('GetQbShared'"
]) {
  requireContains(runtimeClientPath, runtimeClient, expected);
}

for (const eventName of trustedSyncEvents) {
  const block = eventBlock(runtimeServer, eventName);
  if (!block.includes("if source ~= 0 then") || !block.includes("return")) {
    throw new Error(`trusted sync event is not server-only guarded: ${eventName}`);
  }
}

for (const expected of [
  "exports('GetCoreObject', function()",
  "exports('GetPlayer', function(source)",
  "exports.sdb_runtime:GetQbPlayer(source)",
  "exports.sdb_runtime:GetQbPlayers()"
]) {
  requireContains(qbServerPath, qbServer, expected);
}

for (const expected of [
  "exports('GetCoreObject', function()",
  "exports('GetPlayerData', function()",
  "exports.sdb_runtime:GetQbPlayerData()",
  "Shared = exports.sdb_runtime:GetQbShared()",
  "QBCore.Shared = QBCore.Shared or exports.sdb_runtime:GetQbShared()"
]) {
  requireContains(qbClientPath, qbClient, expected);
}

for (const expected of [
  "exports('GetPlayer', ResolvePlayer)",
  "exports('GetPlayerByCitizenId'",
  "exports('GetPlayersData'",
  "exports('SetPlayerData'",
  "exports('SetMetadata'",
  "exports('SetJob'",
  "exports('SetGang'",
  "exports('GetMoney'",
  "exports('AddMoney'",
  "exports('RemoveMoney'",
  "exports('SetMoney'",
  "exports.sdb_runtime:GetQbPlayer",
  "exports.sdb_runtime:GetQbPlayers()",
  "exports.sdb_runtime:SelectQbCharacter"
]) {
  requireContains(qbxServerPath, qbxServer, expected);
}

for (const expected of [
  "exports('GetJobs'",
  "exports('GetGangs'",
  "exports('GetJob'",
  "exports('GetGang'",
  "exports('GetVehiclesByName'",
  "exports('GetVehiclesByHash'",
  "exports('GetLocations'",
  "exports.sdb_runtime:GetQbShared()"
]) {
  requireContains(qbxSharedPath, qbxShared, expected);
}

for (const expected of [
  "QBX.PlayerData = exports.sdb_runtime:GetQbPlayerData()",
  "exports('GetPlayerData'",
  "RegisterNetEvent('QBCore:Player:SetPlayerData'",
  "RegisterNetEvent('qbx_core:client:playerDataUpdated'"
]) {
  requireContains(qbxClientPath, qbxClient, expected);
}

for (const expected of [
  "QBX = QBX or {}",
  "QBX.PlayerData = exports.sdb_runtime:GetQbPlayerData()",
  "RegisterNetEvent('QBCore:Player:SetPlayerData'",
  "RegisterNetEvent('QBCore:Client:OnPlayerUnload'"
]) {
  requireContains(qbxPlayerDataModulePath, qbxPlayerDataModule, expected);
}

for (const expected of [
  "fx_version 'cerulean'",
  "game 'gta5'",
  "dependency 'sdb_runtime'",
  "client_script 'client/main.lua'",
  "server_script 'server/main.lua'"
]) {
  requireContains(smokeManifestPath, smokeManifest, expected);
}

for (const expected of [
  "RegisterCommand('sdb_runtime_smoke'",
  "exports.sdb_runtime:GetHealth()",
  "exports.sdb_runtime:GetConfig('runtime', 'missing')",
  "exports.sdb_runtime:HasPermission(0, 'sdb_runtime.smoke')",
  "exports.sdb_runtime:GetQbShared()",
  "exports['qb-core']:GetCoreObject()",
  "core.Functions.HasItem",
  "core.Functions.UseItem",
  "TriggerClientEvent('sdb_runtime_smoke:runClient'",
  "AddEventHandler('playerConnecting'",
  "AddEventHandler('playerJoining'",
  "sdb_runtime_smoke] INFO playerConnecting",
  "sdb_runtime_smoke] INFO playerJoining",
  "TriggerClientEvent('sdb_qbcore_fixture:run'",
  "TriggerClientEvent('sdb_qbox_fixture:run'",
  "exports('RunSmoke', runSmoke)"
]) {
  requireContains(smokeServerPath, smokeServer, expected);
}

for (const expected of [
  "RegisterNetEvent('sdb_runtime_smoke:runClient'",
  "CreateThread(function()",
  "runClientSmoke()",
  "sdb_runtime_smoke:loaded",
  "exports.sdb_runtime:GetQbPlayerData()",
  "exports.sdb_runtime:GetQbShared()",
  "exports['qb-core']:GetCoreObject()",
  "TriggerServerEvent('sdb_runtime_smoke:clientResult'"
]) {
  requireContains(smokeClientPath, smokeClient, expected);
}

for (const expected of [
  "dependency 'sdb_runtime'",
  "dependency 'qb-core'",
  "client_script 'client/main.lua'",
  "server_script 'server/main.lua'"
]) {
  requireContains(qbcoreFixtureManifestPath, qbcoreFixtureManifest, expected);
}

for (const expected of [
  "fixture:qbcore:",
  "exports['qb-core']:GetCoreObject()",
  "core.Functions.GetPlayer(1)",
  "core.Functions.CreateCallback",
  "core.Functions.CreateUseableItem",
  "core.Functions.SpawnVehicle",
  "TriggerClientEvent('sdb_qbcore_fixture:run'"
]) {
  requireContains(qbcoreFixtureServerPath, qbcoreFixtureServer, expected);
}

for (const expected of [
  "__cfx_functionReference",
  "isFunction(core.Functions.GetPlayerData)",
  "isFunction(core.Functions.TriggerCallback)",
  "isFunction(core.Functions.HasItem)",
  "CreateThread(function()",
  "runClientFixture()",
  "exports['qb-core']:GetCoreObject()",
  "core.Functions.GetPlayerData()",
  "core.Functions.TriggerCallback",
  "TriggerServerEvent('sdb_qbcore_fixture:clientResult'"
]) {
  requireContains(qbcoreFixtureClientPath, qbcoreFixtureClient, expected);
}

for (const expected of [
  "dependency 'sdb_runtime'",
  "dependency 'qbx_core'",
  "'@qbx_core/modules/playerdata.lua'",
  "'client/main.lua'",
  "server_script 'server/main.lua'"
]) {
  requireContains(qboxFixtureManifestPath, qboxFixtureManifest, expected);
}

for (const expected of [
  "fixture:qbox:",
  "exports.qbx_core:GetPlayer(1)",
  "exports.qbx_core:GetPlayersData()",
  "exports.qbx_core:AddMoney",
  "exports.qbx_core:SetJob",
  "exports.qbx_core:GetJobs()",
  "exports.qbx_core:CreateUseableItem",
  "TriggerClientEvent('sdb_qbox_fixture:run'"
]) {
  requireContains(qboxFixtureServerPath, qboxFixtureServer, expected);
}

for (const expected of [
  "CreateThread(function()",
  "runClientFixture()",
  "type(QBX) == 'table'",
  "type(QBX.PlayerData) == 'table'",
  "exports.qbx_core:GetPlayerData()",
  "TriggerServerEvent('sdb_qbox_fixture:clientResult'"
]) {
  requireContains(qboxFixtureClientPath, qboxFixtureClient, expected);
}

console.log("Verified FiveM deployment resource layout.");
console.log(`Verified ${trustedSyncEvents.length} trusted sync event guards.`);
console.log("Verified qb-core facade provide/dependency contract.");
console.log("Verified qbx_core facade provide/dependency contract.");
console.log("Verified sdb_runtime_smoke FXServer smoke resource.");
console.log("Verified QBCore and Qbox compatibility fixture resources.");
