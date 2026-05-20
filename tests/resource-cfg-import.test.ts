import { describe, expect, it } from "vitest";
import {
  buildServerCfgResourceImportPlan,
  parseEnsuredResourcesFromCfg
} from "../src/core/resource-cfg-import.js";

describe("server.cfg resource import planning", () => {
  it("parses top-level ensure/start lines in order", () => {
    expect(parseEnsuredResourcesFromCfg(`
      # framework
      ensure sdb_runtime
      ensure "qb-core"
      start qb-banking
      // ignored
      ensure [standalone]
      ensure qb-banking
    `)).toEqual(["sdb_runtime", "qb-core", "qb-banking"]);
  });

  it("builds import plans only for resources ensured by server.cfg", () => {
    const plan = buildServerCfgResourceImportPlan({
      cfg: `
        ensure sdb_runtime
        ensure qb-core
        ensure qb-banking
        ensure missing-resource
      `,
      resources: [
        {
          resourceName: "sdb_runtime",
          files: [{ path: "fxmanifest.lua", content: "fx_version 'cerulean'" }]
        },
        {
          resourceName: "qb-core",
          files: [{ path: "fxmanifest.lua", content: "provide 'qb-core'" }]
        },
        {
          resourceName: "qb-banking",
          files: [
            {
              path: "fxmanifest.lua",
              content: "dependency 'qb-core'"
            },
            {
              path: "banking.sql",
              content: "CREATE TABLE bank_accounts (id int NOT NULL, account_name varchar(50), PRIMARY KEY (id));"
            }
          ]
        },
        {
          resourceName: "not-ensured",
          files: [{ path: "fxmanifest.lua", content: "fx_version 'cerulean'" }]
        }
      ]
    });

    expect(plan.ensuredResources).toEqual(["sdb_runtime", "qb-core", "qb-banking", "missing-resource"]);
    expect(plan.imports.map((entry) => entry.pluginId)).toEqual(["sdb_runtime", "qb-core", "qb-banking"]);
    expect(plan.imports[2].manifest.schemas).toEqual([
      expect.objectContaining({ entityType: "sql_bank_accounts", approved: true })
    ]);
    expect(plan.missingResources).toEqual(["missing-resource"]);
  });
});
