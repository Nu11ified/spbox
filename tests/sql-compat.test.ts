import { describe, expect, it } from "vitest";
import {
  buildLegacySqlImportManifest,
  legacySqlImportToPluginManifest
} from "../src/core/sql-compat.js";

describe("legacy SQL compatibility importer", () => {
  it("turns QBCore-style CREATE TABLE files into approved plugin schemas", () => {
    const manifest = buildLegacySqlImportManifest({
      pluginId: "qb-clothing",
      resourceName: "qb-clothing",
      sqlFiles: [
        {
          path: "qb-clothing.sql",
          sql: `
            CREATE TABLE IF NOT EXISTS playerskins (
              id int NOT NULL AUTO_INCREMENT,
              citizenid varchar(50) NOT NULL,
              model varchar(50) NOT NULL,
              skin longtext NOT NULL,
              active tinyint(1) NOT NULL DEFAULT 1,
              PRIMARY KEY (id)
            );

            CREATE TABLE player_outfits (
              id int NOT NULL AUTO_INCREMENT,
              citizenid varchar(50) NOT NULL,
              outfitname varchar(50) NOT NULL,
              model varchar(50) NOT NULL,
              skin longtext NOT NULL,
              outfitId varchar(50) NOT NULL,
              PRIMARY KEY (id)
            );
          `
        }
      ]
    });

    expect(manifest.sqlFiles).toEqual(["qb-clothing.sql"]);
    expect(manifest.unsupportedStatements).toEqual([]);
    expect(manifest.tables.map((table) => table.name)).toEqual(["playerskins", "player_outfits"]);
    expect(manifest.schemas).toEqual([
      expect.objectContaining({
        entityType: "sql_playerskins",
        schemaVersion: 1,
        approved: true,
        schema: expect.objectContaining({
          type: "object",
          required: ["id", "citizenid", "model", "skin", "active"],
          properties: expect.objectContaining({
            citizenid: { type: "string" },
            active: { type: "boolean" }
          })
        })
      }),
      expect.objectContaining({
        entityType: "sql_player_outfits",
        migrationPlan: [
          expect.objectContaining({
            step: "create_json_entity_type",
            entityType: "sql_player_outfits",
            sourceTable: "player_outfits",
            primaryKeys: ["id"]
          })
        ]
      })
    ]);
  });

  it("rejects unsafe SQL when converting directly to a plugin manifest", () => {
    expect(() =>
      legacySqlImportToPluginManifest({
        pluginId: "legacy-resource",
        name: "Legacy Resource",
        version: "1.0.0",
        resourceName: "legacy-resource",
        sqlFiles: [
          {
            path: "legacy.sql",
            sql: "CREATE TABLE demo (id int primary key); DROP TABLE players;"
          }
        ]
      })
    ).toThrow("Unsupported SQL statements in legacy-resource: 1");
  });

  it("builds a plugin manifest from safe SQL files", () => {
    const plugin = legacySqlImportToPluginManifest({
      pluginId: "qb-apartments",
      name: "qb-apartments",
      version: "2.2.1",
      resourceName: "qb-apartments",
      sqlFiles: [
        {
          path: "apartments.sql",
          sql: "CREATE TABLE apartments (name varchar(50) NOT NULL, type varchar(50), label varchar(50), citizenid varchar(50), PRIMARY KEY (name));"
        }
      ]
    });

    expect(plugin).toEqual({
      pluginId: "qb-apartments",
      name: "qb-apartments",
      version: "2.2.1",
      schemas: [
        expect.objectContaining({
          entityType: "sql_apartments",
          approved: true
        })
      ]
    });
  });

  it("records safe ALTER TABLE migrations as SPBox schema metadata", () => {
    const manifest = buildLegacySqlImportManifest({
      pluginId: "qb-vehicleshop",
      resourceName: "qb-vehicleshop",
      sqlFiles: [
        {
          path: "vehicles.sql",
          sql: `
            CREATE TABLE IF NOT EXISTS player_vehicles (
              id int NOT NULL AUTO_INCREMENT,
              citizenid varchar(50) DEFAULT NULL,
              plate varchar(15) NOT NULL,
              PRIMARY KEY (id),
              KEY plate (plate)
            );

            ALTER TABLE player_vehicles ADD UNIQUE INDEX UK_playervehicles_plate (plate);
            ALTER TABLE player_vehicles ADD CONSTRAINT FK_playervehicles_players FOREIGN KEY (citizenid)
              REFERENCES players (citizenid) ON DELETE CASCADE ON UPDATE CASCADE;
            ALTER TABLE player_vehicles ADD COLUMN balance int(11) NOT NULL DEFAULT 0;
          `
        }
      ]
    });

    expect(manifest.unsupportedStatements).toEqual([]);
    expect(manifest.tables[0]).toEqual(expect.objectContaining({
      indexes: [
        { name: "plate", columns: ["plate"], unique: false },
        { name: "UK_playervehicles_plate", columns: ["plate"], unique: true }
      ],
      foreignKeys: [
        {
          name: "FK_playervehicles_players",
          columns: ["citizenid"],
          referencedTable: "players",
          referencedColumns: ["citizenid"],
          onDelete: "cascade",
          onUpdate: "cascade"
        }
      ]
    }));
    expect(manifest.schemas[0]).toEqual(expect.objectContaining({
      entityType: "sql_player_vehicles",
      schema: expect.objectContaining({
        required: ["id", "plate", "balance"],
        properties: expect.objectContaining({
          balance: { type: "number" }
        })
      }),
      migrationPlan: expect.arrayContaining([
        expect.objectContaining({ step: "record_sql_index" }),
        expect.objectContaining({ step: "record_sql_foreign_key" }),
        expect.objectContaining({ step: "add_required_property", property: "balance" })
      ])
    }));
  });
});
