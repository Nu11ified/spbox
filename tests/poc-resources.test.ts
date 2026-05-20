import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  expect(existsSync(path), `missing ${path}`).toBe(true);
  return readFileSync(path, "utf8");
}

describe("proof-of-concept FiveM resources", () => {
  it("ships optional POC plugins outside the core runtime resources", () => {
    const manifest = read("resources/[poc]/sdb_poc_suite/fxmanifest.lua");
    const client = read("resources/[poc]/sdb_poc_suite/client/main.lua");
    const server = read("resources/[poc]/sdb_poc_suite/server/main.lua");
    const html = read("resources/[poc]/sdb_poc_suite/web/index.html");
    const app = read("resources/[poc]/sdb_poc_suite/web/app.js");
    const css = read("resources/[poc]/sdb_poc_suite/web/styles.css");
    const docs = read("docs/poc-plugins.md");

    expect(manifest).toContain("description 'SPBox optional proof-of-concept gameplay plugins'");
    expect(manifest).toContain("ui_page 'web/index.html'");
    expect(manifest).toContain("client_script 'client/main.lua'");
    expect(manifest).toContain("server_script 'server/main.lua'");
    expect(manifest).toContain("'web/styles.css'");

    expect(client).toContain("RegisterCommand('pocmenu'");
    expect(client).toContain("RegisterCommand('pocspawn'");
    expect(client).toContain("RegisterKeyMapping('pocmenu'");
    expect(client).toContain("NetworkResurrectLocalPlayer");
    expect(client).toContain("SetPedDefaultComponentVariation");
    expect(client).toContain("ShutdownLoadingScreen");
    expect(client).toContain("sdb_poc:spawned");
    expect(client).toContain("RegisterNUICallback('spawnVehicle'");
    expect(client).toContain("RegisterNUICallback('spawnPlayer'");
    expect(client).toContain("RegisterNUICallback('repairVehicle'");
    expect(client).toContain("RegisterNUICallback('teleportWaypoint'");
    expect(client).toContain("RegisterNUICallback('setWeather'");
    expect(client).toContain("RegisterNUICallback('toggleNoclip'");

    expect(server).toContain("RegisterNetEvent('sdb_poc:economy:deposit'");
    expect(server).toContain("local adminEndpoint = GetConvar('sdb_poc_admin_endpoint', '')");
    expect(server).toContain("PostAdmin('/plugins/install'");
    expect(server).toContain("PostAdmin('/plugins/entities'");
    expect(server).toContain("entityType = 'economy_account'");
    expect(server).toContain("entityType = 'player_session'");
    expect(server).toContain("RegisterNetEvent('sdb_poc:economy:withdraw'");
    expect(server).toContain("RegisterNetEvent('sdb_poc:economy:maxMoney'");
    expect(server).toContain("RegisterNetEvent('sdb_poc:economy:paycheck'");
    expect(server).toContain("RegisterNetEvent('sdb_poc:economy:setJob'");
    expect(server).toContain("cash = 750");
    expect(server).toContain("bank = 2500");

    expect(html).toContain("SPBox POC");
    expect(app).toContain('post("spawnVehicle"');
    expect(app).toContain('post("economyDeposit"');
    expect(app).toContain('post("economyMaxMoney"');
    expect(app).toContain('post("spawnPlayer"');
    expect(app).toContain('post("setWeather"');
    expect(app).toContain("fetch(`https://${GetParentResourceName()}/${action}`");
    expect(css).toContain(".panel");

    expect(docs).toContain("resources/[poc]/sdb_poc_suite");
    expect(docs).toContain("not a core runtime dependency");
  });

  it("ships an optional POC text chat resource", () => {
    const manifest = read("resources/[poc]/sdb_poc_chat/fxmanifest.lua");
    const client = read("resources/[poc]/sdb_poc_chat/client/main.lua");
    const server = read("resources/[poc]/sdb_poc_chat/server/main.lua");
    const html = read("resources/[poc]/sdb_poc_chat/web/index.html");
    const app = read("resources/[poc]/sdb_poc_chat/web/app.js");
    const css = read("resources/[poc]/sdb_poc_chat/web/styles.css");
    const docs = read("docs/poc-plugins.md");

    expect(manifest).toContain("description 'SPBox optional proof-of-concept text chat'");
    expect(manifest).toContain("ui_page 'web/index.html'");
    expect(client).toContain("RegisterCommand('pocchat'");
    expect(client).toContain("RegisterCommand('pocslash'");
    expect(client).toContain("RegisterKeyMapping('pocchat'");
    expect(client).toContain("RegisterKeyMapping('pocslash'");
    expect(client).toContain("RegisterNUICallback('submit'");
    expect(client).toContain("ExecuteCommand(message:sub(2))");
    expect(server).toContain("RegisterNetEvent('sdb_poc_chat:message'");
    expect(server).toContain("local adminEndpoint = GetConvar('sdb_poc_admin_endpoint', '')");
    expect(server).toContain("PostAdmin('/plugins/install'");
    expect(server).toContain("PostAdmin('/plugins/entities'");
    expect(server).toContain("entityType = 'chat_message'");
    expect(server).toContain("TriggerClientEvent('sdb_poc_chat:message'");
    expect(html).toContain("SPBox Chat");
    expect(app).toContain("fetch(`https://${GetParentResourceName()}/submit`");
    expect(css).toContain(".chat");
    expect(docs).toContain("resources/[poc]/sdb_poc_chat");
  });
});
