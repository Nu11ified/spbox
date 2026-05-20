import { describe, expect, it } from "vitest";
import { buildLegacyResourceImportPlan } from "../src/core/legacy-resource-import.js";

describe("legacy resource import planner", () => {
  it("turns a QBCore resource folder into an SPBox plugin install plan", () => {
    const plan = buildLegacyResourceImportPlan({
      resourceName: "qb-example",
      version: "1.2.3",
      packageSource: "local:/resources/qb-example",
      files: [
        {
          path: "fxmanifest.lua",
          content: `
            fx_version 'cerulean'
            game 'gta5'
            dependency 'qb-core'
            dependencies { 'oxmysql', 'qb-menu' }
            shared_scripts { 'config.lua' }
            client_scripts { 'client/main.lua' }
            server_scripts { 'server/main.lua' }
            ui_page 'html/index.html'
            files { 'html/index.html', 'html/app.js' }
          `
        },
        {
          path: "example.sql",
          content: "CREATE TABLE IF NOT EXISTS example_rows (id int NOT NULL, label varchar(50), PRIMARY KEY (id));"
        }
      ]
    });

    expect(plan.pluginId).toBe("qb-example");
    expect(plan.manifest).toEqual(expect.objectContaining({
      pluginId: "qb-example",
      name: "qb-example",
      version: "1.2.3",
      fivem: expect.objectContaining({
        dependencies: ["oxmysql", "qb-core", "qb-menu"],
        nuiPage: "html/index.html"
      }),
      schemas: [
        expect.objectContaining({
          entityType: "sql_example_rows",
          approved: true
        })
      ]
    }));
    expect(plan.manifest.fivem?.files).toEqual(expect.arrayContaining([
      "client/main.lua",
      "config.lua",
      "html/app.js",
      "html/index.html",
      "server/main.lua"
    ]));
    expect(plan.package).toEqual(expect.objectContaining({
      packageId: "legacy:qb-example",
      trustLevel: "local",
      manifest: plan.manifest
    }));
    expect(plan.installSteps).toEqual([
      "copy_resource:qb-example",
      "install_plugin:qb-example",
      "register_schemas:1",
      "enable_plugin:qb-example",
      "ensure_resource:qb-example"
    ]);
    expect(plan.warnings).toEqual([
      "Dependency oxmysql is expected to be satisfied by an SPBox compatibility facade",
      "Dependency qb-core is expected to be satisfied by an SPBox compatibility facade"
    ]);
  });

  it("records SQL warnings instead of pretending arbitrary SQL is drop-in safe", () => {
    const plan = buildLegacyResourceImportPlan({
      resourceName: "legacy-danger",
      files: [
        {
          path: "fxmanifest.lua",
          content: "fx_version 'cerulean'"
        },
        {
          path: "danger.sql",
          content: "CREATE TABLE demo (id int primary key); DROP TABLE players;"
        }
      ]
    });

    expect(plan.sqlImport?.unsupportedStatements).toEqual(["DROP TABLE players"]);
    expect(plan.warnings).toEqual(["Unsupported SQL statement: DROP TABLE players"]);
  });
});
