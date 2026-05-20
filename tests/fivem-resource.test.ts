import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("sdb_runtime FiveM resource", () => {
  it("declares the runtime resource manifest expected by phase 01", () => {
    const manifest = readFileSync("resources/[runtime]/sdb_runtime/fxmanifest.lua", "utf8");

    expect(manifest).toContain("fx_version 'cerulean'");
    expect(manifest).toContain("game 'gta5'");
    expect(manifest).toContain("server_script 'server/main.lua'");
    expect(manifest).toContain("client_script 'client/main.lua'");
    expect(manifest).toContain("ui_page 'web/index.html'");
  });

  it("exposes the stable server runtime API", () => {
    const server = readFileSync("resources/[runtime]/sdb_runtime/server/main.lua", "utf8");

    expect(server).toContain("exports('HasPermission'");
    expect(server).toContain("exports('CallAction'");
    expect(server).toContain("exports('GetConfig'");
    expect(server).toContain("exports('GetHealth'");
    expect(server).toContain("exports('GetDeployments'");
    expect(server).toContain("exports('RegisterLocalHandler'");
    expect(server).toContain("exports('ApplyAceMirrorCommands'");
    expect(server).toContain("exports('ApplyReplicatedState'");
    expect(server).toContain("exports('DispatchClientEvent'");
    expect(server).toContain("exports('RepairVehicle'");
    expect(server).toContain("exports('SpawnVehicles'");
    expect(server).toContain("exports('ApplyWorldState'");
    expect(server).toContain("exports('TeleportPlayer'");
    expect(server).toContain("exports('KickPlayer'");
  });

  it("requests resource auto-import reconciliation from the admin connector on start", () => {
    const server = readFileSync("resources/[runtime]/sdb_runtime/server/main.lua", "utf8");

    expect(server).toContain("local function RequestResourceReconcile()");
    expect(server).toContain("GetConvar('sdb_admin_endpoint'");
    expect(server).toContain("AdminEndpoint('/resources/reconcile')");
    expect(server).toContain("PerformHttpRequest(url");
    expect(server).toContain("SetTimeout(1000, RequestResourceReconcile)");
  });

  it("has server events for live permission/config cache updates and action dispatch", () => {
    const server = readFileSync("resources/[runtime]/sdb_runtime/server/main.lua", "utf8");

    expect(server).toContain("RegisterNetEvent('sdb_runtime:syncPermissions'");
    expect(server).toContain("RegisterNetEvent('sdb_runtime:syncConfig'");
    expect(server).toContain("RegisterNetEvent('sdb_runtime:syncHealth'");
    expect(server).toContain("RegisterNetEvent('sdb_runtime:syncMenuTree'");
    expect(server).toContain("RegisterNetEvent('sdb_runtime:syncDeployments'");
    expect(server).toContain("RegisterNetEvent('sdb_runtime:syncReplicatedState'");
    expect(server).toContain("RegisterNetEvent('sdb_runtime:dispatchClientEvent'");
    expect(server).toContain("RegisterNetEvent('sdb_runtime:repairVehicle'");
    expect(server).toContain("RegisterNetEvent('sdb_runtime:spawnVehicles'");
    expect(server).toContain("RegisterNetEvent('sdb_runtime:syncWorldState'");
    expect(server).toContain("RegisterNetEvent('sdb_runtime:teleportPlayer'");
    expect(server).toContain("RegisterNetEvent('sdb_runtime:kickPlayer'");
    expect(server).toContain("RegisterNetEvent('sdb_runtime:syncMenuRefresh'");
    expect(server).toContain("RegisterNetEvent('sdb_runtime:requestMenuTree'");
    expect(server).toContain("RegisterNetEvent('sdb_runtime:closeMenu'");
    expect(server).toContain("RegisterNetEvent('sdb_runtime:clientAction'");
    expect(server).toContain("RegisterNetEvent('sdb_runtime:applyAceMirror'");
    expect(server).toContain("TriggerClientEvent('sdb_runtime:menuTree'");
    expect(server).toContain("TriggerClientEvent('sdb_runtime:actionResult'");
  });

  it("guards trusted cache sync events against client spoofing", () => {
    const server = readFileSync("resources/[runtime]/sdb_runtime/server/main.lua", "utf8");

    for (const eventName of [
      "sdb_runtime:syncPermissions",
      "sdb_runtime:syncConfig",
      "sdb_runtime:syncHealth",
      "sdb_runtime:syncMenuTree",
      "sdb_runtime:syncDeployments"
    ]) {
      const start = server.indexOf(`RegisterNetEvent('${eventName}'`);
      expect(start).toBeGreaterThanOrEqual(0);
      const next = server.indexOf("RegisterNetEvent('", start + 1);
      const block = server.slice(start, next === -1 ? undefined : next);

      expect(block).toContain("if source ~= 0 then");
      expect(block).toContain("return");
    }
  });

  it("normalizes trusted connector event envelopes and exposes an RCON-safe command ingress", () => {
    const server = readFileSync("resources/[runtime]/sdb_runtime/server/main.lua", "utf8");

    expect(server).toContain("local function NormalizeRuntimeEventName(eventName)");
    expect(server).toContain("return nil, 'eventName must be an sdb_runtime event'");
    expect(server).toContain("return nil, 'eventName must not contain whitespace'");
    expect(server).toContain("local function DispatchRuntimeEvent(eventName, payload)");
    expect(server).toContain("payload.principalId");
    expect(server).toContain("payload.namespace");
    expect(server).toContain("payload.health");
    expect(server).toContain("payload.tree");
    expect(server).toContain("payload.deployments");
    expect(server).toContain("payload.sandboxEvents");
    expect(server).toContain("payload.updates");
    expect(server).toContain("payload.repairs");
    expect(server).toContain("payload.spawns");
    expect(server).toContain("payload.world");
    expect(server).toContain("payload.teleport");
    expect(server).toContain("payload.kick");
    expect(server).toContain("payload.commands");
    expect(server).toContain("RegisterCommand('sdb_runtime_emit'");
    expect(server).toContain("if source ~= 0 then");
    expect(server).toContain("pcall(json.decode, raw)");
    expect(server).toContain("if type(envelope.eventName) ~= 'string' then");
    expect(server).toContain("if envelope.payload ~= nil and type(envelope.payload) ~= 'table' then");
    expect(server).toContain("DispatchRuntimeEvent(envelope.eventName, envelope.payload or {})");
  });

  it("tracks active menu sessions and refreshes them from trusted sync events", () => {
    const server = readFileSync("resources/[runtime]/sdb_runtime/server/main.lua", "utf8");
    const client = readFileSync("resources/[runtime]/sdb_runtime/client/main.lua", "utf8");

    expect(server).toContain("menuSessions = {}");
    expect(server).toContain("local function SendMenuTree(targetSource)");
    expect(server).toContain("Runtime.menuSessions[requestSource] = principal");
    expect(server).toContain("local function RefreshMenuSessions()");
    expect(server).toContain("for targetSource in pairs(Runtime.menuSessions) do");
    expect(server).toContain("RegisterNetEvent('sdb_runtime:syncMenuRefresh'");
    expect(server).toContain("if source ~= 0 then");
    expect(server).toContain("RefreshMenuSessions()");
    expect(server).toContain("RegisterNetEvent('sdb_runtime:closeMenu'");
    expect(server).toContain("Runtime.menuSessions[source] = nil");
    expect(client).toContain("TriggerServerEvent('sdb_runtime:closeMenu')");
  });

  it("keeps a trusted deployment diagnostics cache from connector sync", () => {
    const server = readFileSync("resources/[runtime]/sdb_runtime/server/main.lua", "utf8");

    expect(server).toContain("deployments = {}");
    expect(server).toContain("sandboxEvents = {}");
    expect(server).toContain("local function GetDeployments()");
    expect(server).toContain("Runtime.deployments = payload.deployments");
    expect(server).toContain("Runtime.sandboxEvents = payload.sandboxEvents");
    expect(server).toContain("RegisterNetEvent('sdb_runtime:syncDeployments'");
    expect(server).toContain("if source ~= 0 then");
    expect(server).toContain("exports('GetDeployments'");
  });

  it("has a trusted, player-scoped client event dispatch path for typed menu actions", () => {
    const server = readFileSync("resources/[runtime]/sdb_runtime/server/main.lua", "utf8");

    expect(server).toContain("local function DispatchClientEvent(eventName, targetSource, payload)");
    expect(server).toContain("local function NormalizePlayerTarget(targetSource, errorMessage)");
    expect(server).toContain("return false, 'eventName must be a non-empty string'");
    expect(server).toContain("return false, errorMessage");
    expect(server).toContain("local ok, target = NormalizePlayerTarget(targetSource, 'targetSource must be a player source')");
    expect(server).toContain("return false, 'broadcast client events are not allowed'");
    expect(server).toContain("if target == nil or target <= 0 or target == -1 then");
    expect(server).toContain("TriggerClientEvent(eventName, target, payload or {})");
    expect(server).toContain("RegisterNetEvent('sdb_runtime:dispatchClientEvent'");
    expect(server).toContain("if source ~= 0 then");
    expect(server).toContain("exports('DispatchClientEvent'");
  });

  it("replicates only lightweight state bag hints from trusted server sync", () => {
    const server = readFileSync("resources/[runtime]/sdb_runtime/server/main.lua", "utf8");

    expect(server).toContain("replicatedState = {");
    expect(server).toContain("local function ApplyReplicatedState(updates)");
    expect(server).toContain("GlobalState[update.key] = update.value");
    expect(server).toContain("Player(update.playerId).state:set(update.key, update.value, true)");
    expect(server).toContain("if update.authoritative == true then");
    expect(server).toContain("return false, 'authoritative state cannot be replicated'");
    expect(server).toContain("RegisterNetEvent('sdb_runtime:syncReplicatedState'");
    expect(server).toContain("if source ~= 0 then");
  });

  it("spawns vehicles only from trusted server dispatch with validated player targets", () => {
    const server = readFileSync("resources/[runtime]/sdb_runtime/server/main.lua", "utf8");

    expect(server).toContain("local function SpawnVehicles(spawns)");
    expect(server).toContain("local ok, target = NormalizePlayerTarget(spawn.targetSource, 'vehicle spawn requires a player target')");
    expect(server).toContain("return false, 'vehicle spawn requires a model'");
    expect(server).toContain("CreateVehicle(GetHashKey(spawn.model)");
    expect(server).toContain("TaskWarpPedIntoVehicle(GetPlayerPed(target), vehicle, -1)");
    expect(server).toContain("RegisterNetEvent('sdb_runtime:spawnVehicles'");
    expect(server).toContain("if source ~= 0 then");
    expect(server).toContain("exports('SpawnVehicles'");
  });

  it("repairs vehicles only for explicit player targets through trusted server dispatch", () => {
    const server = readFileSync("resources/[runtime]/sdb_runtime/server/main.lua", "utf8");
    const client = readFileSync("resources/[runtime]/sdb_runtime/client/main.lua", "utf8");

    expect(server).toContain("local function RepairVehicle(repair)");
    expect(server).toContain("local ok, target = NormalizePlayerTarget(repair.targetSource, 'vehicle repair requires a player target')");
    expect(server).toContain("return false, 'vehicle repair requires a network id'");
    expect(server).toContain("TriggerClientEvent('sdb_runtime:repairVehicle', target");
    expect(server).toContain("RegisterNetEvent('sdb_runtime:repairVehicle'");
    expect(server).toContain("if source ~= 0 then");
    expect(server).toContain("exports('RepairVehicle'");
    expect(client).toContain("RegisterNetEvent('sdb_runtime:repairVehicle'");
    expect(client).toContain("NetworkGetEntityFromNetworkId(repair.targetVehicleNetId)");
    expect(client).toContain("SetVehicleFixed(vehicle)");
    expect(client).toContain("SetVehicleDeformationFixed(vehicle)");
    expect(client).toContain("SetVehicleEngineHealth(vehicle, 1000.0)");
  });

  it("registers first-party admin menu actions to built-in FiveM dispatchers", () => {
    const server = readFileSync("resources/[runtime]/sdb_runtime/server/main.lua", "utf8");

    expect(server).toContain("local function RegisterBuiltinAdminHandlers()");
    expect(server).toContain("RegisterLocalHandler('admin.vehicles.repair'");
    expect(server).toContain("RegisterLocalHandler('admin.vehicles.spawn'");
    expect(server).toContain("RegisterLocalHandler('admin.world.weather'");
    expect(server).toContain("RegisterLocalHandler('admin.world.time'");
    expect(server).toContain("RegisterLocalHandler('admin.teleport.to_marker'");
    expect(server).toContain("RegisterLocalHandler('admin.players.kick'");
    expect(server).toContain("requiredPermission = 'admin.vehicles.repair'");
    expect(server).toContain("requiredPermission = 'admin.vehicles.spawn'");
    expect(server).toContain("requiredPermission = 'admin.world.weather'");
    expect(server).toContain("requiredPermission = 'admin.world.time'");
    expect(server).toContain("requiredPermission = 'admin.teleport.to_marker'");
    expect(server).toContain("requiredPermission = 'admin.players.kick'");
    expect(server.indexOf("local function RegisterBuiltinAdminHandlers()")).toBeLessThan(
      server.indexOf("RegisterBuiltinAdminHandlers()")
    );
    expect(server.indexOf("RegisterBuiltinAdminHandlers()")).toBeLessThan(
      server.indexOf("exports('CallAction'")
    );
  });

  it("broadcasts trusted weather and clock updates as world state", () => {
    const server = readFileSync("resources/[runtime]/sdb_runtime/server/main.lua", "utf8");
    const client = readFileSync("resources/[runtime]/sdb_runtime/client/main.lua", "utf8");

    expect(server).toContain("worldState = {}");
    expect(server).toContain("local function ApplyWorldState(world)");
    expect(server).toContain("return false, 'world state must be a table'");
    expect(server).toContain("TriggerClientEvent('sdb_runtime:worldState', -1, Runtime.worldState)");
    expect(server).toContain("RegisterNetEvent('sdb_runtime:syncWorldState'");
    expect(server).toContain("if source ~= 0 then");
    expect(server).toContain("exports('ApplyWorldState'");
    expect(client).toContain("RegisterNetEvent('sdb_runtime:worldState'");
    expect(client).toContain("SetWeatherTypeNowPersist(world.weatherType)");
    expect(client).toContain("NetworkOverrideClockTime(world.hour, world.minute, 0)");
  });

  it("teleports only explicit player targets through trusted server dispatch", () => {
    const server = readFileSync("resources/[runtime]/sdb_runtime/server/main.lua", "utf8");
    const client = readFileSync("resources/[runtime]/sdb_runtime/client/main.lua", "utf8");

    expect(server).toContain("local function TeleportPlayer(teleport)");
    expect(server).toContain("local ok, target = NormalizePlayerTarget(teleport.targetSource, 'teleport requires a player target')");
    expect(server).toContain("return false, 'teleport requires finite x, y, and z'");
    expect(server).toContain("TriggerClientEvent('sdb_runtime:teleport', target");
    expect(server).toContain("RegisterNetEvent('sdb_runtime:teleportPlayer'");
    expect(server).toContain("if source ~= 0 then");
    expect(server).toContain("exports('TeleportPlayer'");
    expect(client).toContain("RegisterNetEvent('sdb_runtime:teleport'");
    expect(client).toContain("SetEntityCoords(PlayerPedId(), teleport.x, teleport.y, teleport.z, false, false, false, false)");
    expect(client).toContain("SetEntityHeading(PlayerPedId(), teleport.heading)");
  });

  it("kicks only explicit player targets through trusted server dispatch", () => {
    const server = readFileSync("resources/[runtime]/sdb_runtime/server/main.lua", "utf8");

    expect(server).toContain("local function KickPlayer(kick)");
    expect(server).toContain("local ok, target = NormalizePlayerTarget(kick.targetSource, 'kick requires a player target')");
    expect(server).toContain("return false, 'kick requires a reason'");
    expect(server).toContain("DropPlayer(target, kick.reason)");
    expect(server).toContain("RegisterNetEvent('sdb_runtime:kickPlayer'");
    expect(server).toContain("if source ~= 0 then");
    expect(server).toContain("exports('KickPlayer'");
  });

  it("renders NUI menu trees and posts selected menu actions", () => {
    const html = readFileSync("resources/[runtime]/sdb_runtime/web/index.html", "utf8");
    const app = readFileSync("resources/[runtime]/sdb_runtime/web/app.js", "utf8");
    const client = readFileSync("resources/[runtime]/sdb_runtime/client/main.lua", "utf8");

    expect(html).toContain('id="menu-tree"');
    expect(app).toContain("sdb_runtime:menuTree");
    expect(app).toContain("sdb_runtime:context");
    expect(app).toContain("let runtimeContext = {};");
    expect(app).toContain("runtimeContext = event.data.context || {};");
    expect(app).toContain("applyRuntimeContextDefaults();");
    expect(app).toContain("renderMenuTree");
    expect(app).toContain("applyPendingActionState();");
    expect(app).toContain("dataset.actionId");
    expect(app).toContain("renderActionPayloadFields(item, node.payloadSchema)");
    expect(app).toContain("collectActionPayload(button.closest(\"li\"))");
    expect(app).toContain("input.dataset.payloadKey = key");
    expect(app).toContain("input.dataset.payloadType = definition.type");
    expect(app).toContain("applyRuntimeContextDefault(input);");
    expect(app).toContain("const fieldKeys = [...new Set([...(schema.required || []), ...Object.keys(schema.properties)])];");
    expect(app).toContain("for (const key of fieldKeys)");
    expect(app).toContain("input.required = requiredKeys.has(key)");
    expect(app).toContain("const input = Array.isArray(definition.enum) ? document.createElement(\"select\") : document.createElement(\"input\");");
    expect(app).toContain("if (!input.required)");
    expect(app).toContain("emptyOption.value = \"\"");
    expect(app).toContain("for (const optionValue of definition.enum)");
    expect(app).toContain("option.value = String(optionValue)");
    expect(app).toContain("validateActionPayload(button.closest(\"li\"))");
    expect(app).toContain("return { ok: false, error: `${input.name} is required` };");
    expect(app).toContain("return { ok: false, error: `${input.name} must be a number` };");
    expect(app).toContain("renderValidationError(validation.error)");
    expect(app).toContain("result.textContent = message");
    expect(app).toContain("renderActionResult(event.data.result)");
    expect(app).toContain("result.className = actionResult.ok ? \"result success\" : \"result error\"");
    expect(app).toContain("result.textContent = actionResult.ok ? \"Action completed\" : formatActionError(actionResult.result)");
    expect(app).toContain("function formatActionError(value)");
    expect(app).toContain("if (!input.required && input.value.trim() === \"\")");
    expect(app).toContain("const numberValue = Number(input.value)");
    expect(app).toContain("payload[input.dataset.payloadKey] = numberValue");
    expect(app).toContain("label.dataset.confirmationRequired = \"true\"");
    expect(app).toContain("button.dataset.confirmationRequired === \"true\"");
    expect(app).toContain("window.confirm(`Run ${button.textContent}?`)");
    expect(app).toContain("let pendingActionId = null;");
    expect(app).toContain("if (pendingActionId !== null)");
    expect(app).toContain("pendingActionId = button.dataset.actionId;");
    expect(app).toContain("button.disabled = true;");
    expect(app).toContain("function applyPendingActionState()");
    expect(app).toContain("pendingButton.disabled = true;");
    expect(app).toContain("function applyRuntimeContextDefault(input)");
    expect(app).toContain("function applyRuntimeContextDefaults()");
    expect(app).toContain("for (const input of menuTree.querySelectorAll(\"[data-payload-key]\"))");
    expect(app).toContain("const contextValue = runtimeContext[input.dataset.payloadKey];");
    expect(app).toContain("input.value = String(contextValue);");
    expect(app).toContain(".catch(() => {");
    expect(app).toContain("renderValidationError(\"Action request failed\");");
    expect(app).toContain("clearPendingAction();");
    expect(html).toContain('id="result" class="result"');
    expect(html).toContain(".result.success");
    expect(html).toContain(".result.error");
    expect(app).toContain("fetch(`https://${GetParentResourceName()}/callAction`");
    expect(client).toContain("TriggerServerEvent('sdb_runtime:requestMenuTree'");
    expect(client).toContain("local function SendRuntimeContext()");
    expect(client).toContain("targetSource = tostring(GetPlayerServerId(PlayerId()))");
    expect(client).toContain("local coords = GetEntityCoords(PlayerPedId())");
    expect(client).toContain("x = coords.x");
    expect(client).toContain("y = coords.y");
    expect(client).toContain("z = coords.z");
    expect(client).toContain("heading = GetEntityHeading(PlayerPedId())");
    expect(client).toContain("local waypoint = GetFirstBlipInfoId(8)");
    expect(client).toContain("if DoesBlipExist(waypoint) then");
    expect(client).toContain("local waypointCoords = GetBlipInfoIdCoord(waypoint)");
    expect(client).toContain("context.x = waypointCoords.x");
    expect(client).toContain("context.y = waypointCoords.y");
    expect(client).toContain("local foundGround, groundZ = GetGroundZFor_3dCoord(waypointCoords.x, waypointCoords.y, 1000.0, false)");
    expect(client).toContain("if foundGround then");
    expect(client).toContain("context.z = groundZ");
    expect(client).toContain("local vehicle = GetVehiclePedIsIn(PlayerPedId(), false)");
    expect(client).toContain("context.targetVehicleNetId = VehToNet(vehicle)");
    expect(client).toContain("type = 'sdb_runtime:context'");
    expect(client).toContain("RegisterNetEvent('sdb_runtime:menuTree'");
    expect(client).toContain("type = 'sdb_runtime:menuTree'");
  });
});
