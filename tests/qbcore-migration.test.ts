import { describe, expect, it } from "vitest";
import { AdminService } from "../src/admin/service.js";
import { applyQbCoreMigrationPlan, planQbCoreMigration } from "../src/core/qbcore-migration.js";
import { PermissionStore } from "../src/core/permission-store.js";
import { PluginRegistry } from "../src/core/plugins.js";
import { RuntimeControlPlane } from "../src/core/runtime.js";
import { FakeSpacetimeClient, SpacetimeRuntimeAdapter } from "../src/spacetime/adapter.js";

function createAdmin(client = new FakeSpacetimeClient({})): { admin: AdminService; client: FakeSpacetimeClient } {
  return {
    client,
    admin: new AdminService({
      runtime: new RuntimeControlPlane(),
      permissions: new PermissionStore(),
      plugins: new PluginRegistry(),
      spacetime: new SpacetimeRuntimeAdapter(client)
    })
  };
}

describe("QBCore migration tooling", () => {
  it("plans QBCore shared items, jobs, gangs, and vehicles as authoritative runtime primitives", () => {
    const plan = planQbCoreMigration({
      pluginId: "qbcore_import",
      items: {
        repair_kit: { label: "Repair Kit", weight: 1000, unique: false },
        radio: { label: "Radio", unique: true }
      },
      jobs: {
        mechanic: {
          label: "Mechanic",
          grades: {
            "0": { name: "recruit", label: "Recruit" },
            "1": { name: "boss", label: "Boss" }
          }
        }
      },
      gangs: {
        ballas: {
          label: "Ballas",
          grades: {
            "0": { name: "runner", label: "Runner" },
            "1": { name: "shotcaller", label: "Shot Caller" }
          }
        }
      },
      vehicles: {
        sultan: { name: "Sultan", brand: "Karin", category: "sports" },
        flatbed: { label: "Flatbed", category: "service" }
      }
    });

    expect(plan.items).toEqual([
      { key: "repair_kit", pluginId: "qbcore_import", label: "Repair Kit", stackable: true, maxStack: 100 },
      { key: "radio", pluginId: "qbcore_import", label: "Radio", stackable: false, maxStack: 1 }
    ]);
    expect(plan.jobs).toEqual([
      { key: "mechanic", pluginId: "qbcore_import", label: "Mechanic", grades: ["recruit", "boss"] }
    ]);
    expect(plan.vehicles).toEqual([
      { model: "sultan", pluginId: "qbcore_import", label: "Karin Sultan", category: "sports" },
      { model: "flatbed", pluginId: "qbcore_import", label: "Flatbed", category: "service" }
    ]);
    expect(plan.pluginSchemas).toEqual([
      expect.objectContaining({
        pluginId: "qbcore_import",
        entityType: "qbcore_gang",
        status: "active"
      })
    ]);
    expect(plan.pluginEntities).toEqual([
      {
        id: "qbcore_import:gang:ballas",
        pluginId: "qbcore_import",
        entityType: "qbcore_gang",
        ownerType: "plugin",
        ownerId: "qbcore_import",
        dataJson: JSON.stringify({
          key: "ballas",
          label: "Ballas",
          grades: ["runner", "shotcaller"]
        })
      }
    ]);
  });

  it("plans QBCore player money, metadata, jobs, and gangs as characters, accounts, and assignments", () => {
    const plan = planQbCoreMigration({
      pluginId: "qbcore_import",
      players: [
        {
          source: 7,
          citizenid: "CITIZEN-7",
          cid: 2,
          license: "license:abc",
          name: "Ada Lovelace",
          charinfo: {
            firstname: "Ada",
            lastname: "Lovelace",
            phone: "555-0007",
            account: "ACCT-7"
          },
          metadata: { hunger: 72 },
          position: { x: 1, y: 2, z: 3, w: 90 },
          money: { cash: 250, bank: 5000 },
          job: {
            name: "mechanic",
            label: "Mechanic",
            onduty: true,
            grade: { name: "boss", level: 1 }
          },
          gang: {
            name: "ballas",
            label: "Ballas",
            grade: { name: "shotcaller", level: 1 }
          }
        }
      ]
    });

    expect(plan.characters).toEqual([
      {
        id: "char:CITIZEN-7",
        playerPrincipalId: "player:7",
        citizenId: "CITIZEN-7",
        cid: 2,
        slot: 2,
        license: "license:abc",
        name: "Ada Lovelace",
        charinfoJson: JSON.stringify({
          firstname: "Ada",
          lastname: "Lovelace",
          phone: "555-0007",
          account: "ACCT-7"
        }),
        metadataJson: JSON.stringify({ hunger: 72 }),
        gangJson: JSON.stringify({
          name: "ballas",
          label: "Ballas",
          grade: { name: "shotcaller", level: 1 }
        }),
        positionJson: JSON.stringify({ x: 1, y: 2, z: 3, w: 90 }),
        phoneNumber: "555-0007",
        accountNumber: "ACCT-7",
        selected: true
      }
    ]);
    expect(plan.accounts).toEqual([
      {
        id: "acct:char:CITIZEN-7:cash",
        ownerType: "character",
        ownerId: "char:CITIZEN-7",
        currency: "cash",
        balance: 250
      },
      {
        id: "acct:char:CITIZEN-7:bank",
        ownerType: "character",
        ownerId: "char:CITIZEN-7",
        currency: "bank",
        balance: 5000
      }
    ]);
    expect(plan.jobAssignments).toEqual([
      {
        characterId: "char:CITIZEN-7",
        jobKey: "mechanic",
        grade: "boss",
        onDuty: true
      }
    ]);
  });

  it("applies a QBCore migration plan through existing admin write-through reducers", async () => {
    const { admin, client } = createAdmin();
    const plan = planQbCoreMigration({
      pluginId: "qbcore_import",
      items: {
        repair_kit: { label: "Repair Kit" }
      },
      jobs: {
        mechanic: {
          label: "Mechanic",
          grades: {
            "0": { name: "recruit" }
          }
        }
      },
      gangs: {
        ballas: { label: "Ballas", grades: { "0": { name: "runner" } } }
      },
      vehicles: {
        sultan: { name: "Sultan", category: "sports" }
      },
      players: [
        {
          source: 7,
          citizenid: "CITIZEN-7",
          money: { cash: 250 },
          job: { name: "mechanic", grade: { name: "recruit" } }
        }
      ]
    });

    await applyQbCoreMigrationPlan(admin, plan);

    expect(client.reducerCalls.map((call) => call.name)).toEqual([
      "register_item",
      "register_job",
      "register_vehicle",
      "register_plugin_schema",
      "upsert_plugin_entity",
      "upsert_character",
      "create_account",
      "assign_job"
    ]);
    expect(client.reducerCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "create_account",
          args: expect.objectContaining({
            id: "acct:char:CITIZEN-7:cash",
            ownerId: "char:CITIZEN-7",
            currency: "cash",
            balance: 250
          })
        }),
        expect.objectContaining({
          name: "assign_job",
          args: {
            characterId: "char:CITIZEN-7",
            jobKey: "mechanic",
            grade: "recruit",
            onDuty: false
          }
        })
      ])
    );
  });

  it("rejects malformed QBCore imports before partial migration writes", async () => {
    const { admin, client } = createAdmin();

    expect(() =>
      planQbCoreMigration({
        pluginId: "qbcore_import",
        items: {
          " ": { label: "Broken" }
        }
      })
    ).toThrow("QBCore import item key must be a non-empty string");

    await expect(
      applyQbCoreMigrationPlan(admin, {
        pluginId: "qbcore_import",
        items: [
          { key: "repair_kit", pluginId: "qbcore_import", label: "Repair Kit", stackable: true, maxStack: 100 }
        ],
        jobs: [],
        vehicles: [],
        pluginSchemas: [],
        pluginEntities: [],
        characters: [],
        accounts: [
          {
            id: "acct:bad",
            ownerType: "character",
            ownerId: "char:bad",
            currency: "cash",
            balance: -1
          }
        ],
        jobAssignments: []
      })
    ).rejects.toThrow("Account balance cannot be negative");
    expect(client.reducerCalls).toEqual([]);
  });
});
