import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  expect(existsSync(path), `missing ${path}`).toBe(true);
  return readFileSync(path, "utf8");
}

describe("real QBCore hybrid demo resources", () => {
  it("ships oxmysql and qb-inventory facades for upstream QBCore resources", () => {
    const oxManifest = read("resources/[compat]/oxmysql/fxmanifest.lua");
    const mysql = read("resources/[compat]/oxmysql/lib/MySQL.lua");
    const mysqlServer = read("resources/[compat]/oxmysql/server/main.lua");
    const inventoryManifest = read("resources/[compat]/qb-inventory/fxmanifest.lua");
    const inventoryServer = read("resources/[compat]/qb-inventory/server/main.lua");

    expect(oxManifest).toContain("description 'oxmysql compatibility facade backed by SPBox plugin data'");
    expect(mysql).toContain("MySQL.query = callable('query')");
    expect(mysql).toContain("MySQL.insert = callable('insert')");
    expect(mysql).toContain("MySQL.scalar = callable('scalar')");
    expect(mysqlServer).toContain("local pluginId = 'sdb_qbcore_real_plugins'");
    expect(mysqlServer).toContain("entityType = 'sql_row'");
    expect(mysqlServer).toContain("exports('SpboxExecute', Execute)");
    expect(mysqlServer).toContain("exports('SpboxUpsertRow', UpsertRow)");
    expect(mysqlServer).toContain("exports('SpboxSelectRows', SelectRows)");
    expect(mysqlServer.indexOf("count(*) as count from apartments where name = ?")).toBeLessThan(
      mysqlServer.indexOf("from apartments where name = ?")
    );

    expect(inventoryManifest).toContain("dependency 'sdb_runtime'");
    expect(inventoryServer).toContain("exports.sdb_runtime:GetQbPlayer(source)");
    expect(inventoryServer).toContain("exports('AddItem', AddItem)");
    expect(inventoryServer).toContain("exports('OpenInventory', OpenInventory)");
  });

  it("extends qb-core with real multicharacter-facing player and shared APIs", () => {
    const manifest = read("resources/[compat]/qb-core/fxmanifest.lua");
    const server = read("resources/[compat]/qb-core/server/main.lua");
    const locale = read("resources/[compat]/qb-core/shared/locale.lua");

    expect(manifest).toContain("shared_script 'shared/locale.lua'");
    expect(server).toContain("Player = {}");
    expect(server).toContain("function QBCore.Functions.GetShared(name)");
    expect(server).toContain("function QBCore.Player.Login(source, citizenid, newData)");
    expect(server).toContain("exports.sdb_runtime:SelectQbCharacter");
    expect(server).toContain("TriggerEvent('QBCore:Server:PlayerLoaded', player)");
    expect(server).toContain("function QBCore.Player.Logout(source)");
    expect(server).toContain("function QBCore.Player.DeleteCharacter(source, citizenid)");
    expect(server).toContain("exports('GetShared', function(name)");
    expect(locale).toContain("Locale = Locale or {}");
    expect(locale).toContain("function Locale:t(key, substitutions)");
  });

  it("installs pinned upstream QBCore resources into a cache demo server", () => {
    const script = read("scripts/install-qbcore-demo-resources.mjs");
    const packageJson = read("package.json");

    for (const resource of [
      "qb-multicharacter",
      "qb-spawn",
      "qb-apartments",
      "qb-clothing",
      "qb-adminmenu",
      "qb-banking",
      "qb-vehicleshop",
      "qb-garages",
      "PolyZone",
      "qb-vehiclekeys"
    ]) {
      expect(script).toContain(resource);
    }

    expect(script).toContain('"oxmysql"');
    expect(script).toContain('"menuv"');
    expect(script).toContain("buildLegacySqlImportManifest");
    expect(script).toContain("spbox-sql-manifest.json");
    expect(read("scripts/import-legacy-sql.mjs")).toContain("buildLegacySqlImportManifest");
    expect(read("resources/[compat]/menuv/menuv.lua")).toContain("function MenuV:CreateMenu");
    expect(script).toContain("ensure qb-multicharacter");
    expect(script).toContain("ensure qb-clothing");
    expect(script).toContain("ensure qb-adminmenu");
    expect(packageJson).toContain('"install:qbcore-demo": "npm run build && node scripts/install-qbcore-demo-resources.mjs"');
    expect(packageJson).toContain('"import:legacy-sql": "npm run build && node scripts/import-legacy-sql.mjs"');
    expect(read("docs/legacy-sql-compat.md")).toContain("MySQL does not become authoritative");
    expect(read("docs/legacy-sql-compat.md")).toContain("npm run import:legacy-sql");
  });
});
