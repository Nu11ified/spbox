import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function serverLua(): string {
  return readFileSync("resources/[runtime]/sdb_runtime/server/main.lua", "utf8");
}

describe("sdb_runtime FiveM server smoke contract", () => {
  it("does not send raw Lua handler functions in the health event payload", () => {
    const server = serverLua();

    expect(server).toContain("local function GetHandlerNames()");
    expect(server).toContain("local function GetHealth()");
    expect(server).toContain("handlers = GetHandlerNames()");
    expect(server).not.toContain("handlers = Runtime.handlers");
  });

  it("serves synchronized runtime health through a read-only export and command payload", () => {
    const server = serverLua();

    expect(server).toContain("health = {");
    expect(server).toContain("RegisterNetEvent('sdb_runtime:syncHealth'");
    expect(server).toContain("Runtime.health = health");
    expect(server).toContain("local health = GetHealth()");
    expect(server).toContain("health.handlers = GetHandlerNames()");
    expect(server).toContain("exports('GetHealth'");
  });

  it("keeps client action dispatch source-scoped and result-shaped", () => {
    const server = serverLua();

    expect(server).toContain("RegisterNetEvent('sdb_runtime:clientAction'");
    expect(server).toContain("local requestSource = source");
    expect(server).toContain("if type(actionName) ~= 'string' or actionName == '' then");
    expect(server).toContain("result = 'actionName must be a non-empty string'");
    expect(server).toContain("if payload ~= nil and type(payload) ~= 'table' then");
    expect(server).toContain("result = 'payload must be a table'");
    expect(server).toContain("local dispatched, ok, result = pcall(CallAction, requestSource, actionName, payload)");
    expect(server).toContain("if not dispatched then");
    expect(server).toContain("result = tostring(ok)");
    expect(server).toContain("ok = false");
    expect(server).toContain("TriggerClientEvent('sdb_runtime:actionResult', requestSource");
    expect(server).toContain("ok = ok");
    expect(server).toContain("result = result");
  });

  it("keeps menu refreshes scoped to tracked active sessions", () => {
    const server = serverLua();

    expect(server).toContain("menuSessions = {}");
    expect(server).toContain("local function SendMenuTree(targetSource)");
    expect(server).toContain("local principal = normalizeSource(targetSource)");
    expect(server).toContain("Runtime.menuSessions[requestSource] = principal");
    expect(server).toContain("for targetSource in pairs(Runtime.menuSessions) do");
    expect(server).toContain("SendMenuTree(targetSource)");
    expect(server).toContain("RegisterNetEvent('sdb_runtime:syncMenuRefresh'");
    expect(server).toContain("if source ~= 0 then");
    expect(server).toContain("Runtime.menuSessions[source] = nil");
  });


  it("re-checks registered action permissions server-side before handler dispatch", () => {
    const server = serverLua();

    expect(server).toContain("actionPermissions = {}");
    expect(server).toContain("if type(actionName) ~= 'string' or actionName == '' then");
    expect(server).toContain("return false, 'actionName must be a non-empty string'");
    expect(server).toContain("if payload ~= nil and type(payload) ~= 'table' then");
    expect(server).toContain("return false, 'payload must be a table'");
    expect(server).toContain("local requiredPermission = Runtime.actionPermissions[actionName]");
    expect(server).toContain("if requiredPermission ~= nil and not HasPermission(source, requiredPermission) then");
    expect(server).toContain("return false, ('Permission denied: %s'):format(requiredPermission)");
    expect(server).toContain("local executed, ok, result = pcall(handler, normalizeSource(source), payload or {})");
    expect(server).toContain("if not executed then");
    expect(server).toContain("return false, tostring(ok)");
    expect(server).toContain("Runtime.actionPermissions[actionName] = options.requiredPermission");
  });

  it("validates local handler registration before mutating the handler table", () => {
    const server = serverLua();

    expect(server).toContain("error('actionName must be a non-empty string')");
    expect(server).toContain("error('handler must be a function')");
    expect(server.indexOf("error('handler must be a function')")).toBeLessThan(
      server.indexOf("Runtime.handlers[actionName] = handler")
    );
  });

  it("applies ACE mirror commands through a narrow server-side allowlist", () => {
    const server = serverLua();

    expect(server).toContain("local AceCommandPrefixes = {");
    expect(server).toContain("add_ace ");
    expect(server).toContain("remove_ace ");
    expect(server).toContain("add_principal ");
    expect(server).toContain("remove_principal ");
    expect(server).toContain("local function ApplyAceMirrorCommands(commands)");
    expect(server).toContain("ExecuteCommand(command)");
    expect(server).toContain("exports('ApplyAceMirrorCommands'");
    expect(server).toContain("RegisterNetEvent('sdb_runtime:applyAceMirror'");
  });

  it("dispatches client events only to explicit player sources from trusted server context", () => {
    const server = serverLua();

    expect(server).toContain("local function DispatchClientEvent(eventName, targetSource, payload)");
    expect(server).toContain("local function NormalizePlayerTarget(targetSource, errorMessage)");
    expect(server).toContain("local target = tonumber(targetSource)");
    expect(server).toContain("if target == nil or target <= 0 or target == -1 then");
    expect(server).toContain("local ok, target = NormalizePlayerTarget(targetSource, 'targetSource must be a player source')");
    expect(server).toContain("return false, 'broadcast client events are not allowed'");
    expect(server).toContain("TriggerClientEvent(eventName, target, payload or {})");
    expect(server).toContain("RegisterNetEvent('sdb_runtime:dispatchClientEvent'");
    expect(server).toContain("if source ~= 0 then");
    expect(server).toContain("exports('DispatchClientEvent'");
  });
});
