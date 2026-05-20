import { describe, expect, it } from "vitest";
import { createAdminHttpApi } from "../src/admin/http-api.js";
import { AdminService } from "../src/admin/service.js";
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

describe("AdminService gameplay write-through", () => {
  it("registers gameplay primitives through SpacetimeDB reducers", async () => {
    const { admin, client } = createAdmin();

    await admin.registerGameplayItem({
      key: "repair_kit",
      pluginId: "mechanic_core",
      label: "Repair Kit",
      stackable: true,
      maxStack: 10
    });
    await admin.registerGameplayJob({
      key: "mechanic",
      pluginId: "mechanic_core",
      label: "Mechanic",
      grades: ["trainee", "lead"]
    });
    await admin.registerGameplayVehicle({
      model: "flatbed",
      pluginId: "mechanic_core",
      label: "Flatbed",
      category: "service"
    });
    await admin.registerGameplayLocation({
      key: "mechanic_shop",
      pluginId: "mechanic_core",
      label: "Mechanic Shop",
      x: 1,
      y: 2,
      z: 3
    });

    expect(client.reducerCalls).toEqual([
      {
        name: "register_item",
        args: {
          key: "repair_kit",
          pluginId: "mechanic_core",
          label: "Repair Kit",
          stackable: true,
          maxStack: 10
        }
      },
      {
        name: "register_job",
        args: {
          key: "mechanic",
          pluginId: "mechanic_core",
          label: "Mechanic",
          gradesJson: "[\"trainee\",\"lead\"]"
        }
      },
      {
        name: "register_vehicle",
        args: {
          model: "flatbed",
          pluginId: "mechanic_core",
          label: "Flatbed",
          category: "service"
        }
      },
      {
        name: "register_location",
        args: {
          key: "mechanic_shop",
          pluginId: "mechanic_core",
          label: "Mechanic Shop",
          x: 1,
          y: 2,
          z: 3
        }
      }
    ]);
  });

  it("grants inventory and assigns jobs through SpacetimeDB reducers", async () => {
    const { admin, client } = createAdmin();

    await admin.grantGameplayItem({
      id: "grant-1",
      ownerId: "char:1",
      itemKey: "repair_kit",
      quantity: 2
    });
    await admin.assignGameplayJob({
      characterId: "char:1",
      jobKey: "mechanic",
      grade: "trainee",
      onDuty: true
    });

    expect(client.reducerCalls).toEqual([
      {
        name: "grant_item",
        args: {
          id: "grant-1",
          ownerId: "char:1",
          itemKey: "repair_kit",
          quantity: 2
        }
      },
      {
        name: "assign_job",
        args: {
          characterId: "char:1",
          jobKey: "mechanic",
          grade: "trainee",
          onDuty: true
        }
      }
    ]);
  });

  it("upserts and selects QBCore characters through SpacetimeDB reducers", async () => {
    const client = new FakeSpacetimeClient({
      characters: [
        {
          id: "char:one",
          playerPrincipalId: "player:7",
          citizenId: "CITIZEN-ONE",
          cid: 1,
          slot: 1,
          license: "license:abc",
          name: "Ada One",
          charinfoJson: "{\"firstname\":\"Ada\",\"lastname\":\"One\"}",
          metadataJson: "{}",
          positionJson: "{}",
          phoneNumber: "555-0001",
          accountNumber: "ACCT-ONE",
          selected: true,
          updatedAt: new Date("2026-05-18T12:00:00.000Z")
        },
        {
          id: "char:two",
          playerPrincipalId: "player:7",
          citizenId: "CITIZEN-TWO",
          cid: 2,
          slot: 2,
          license: "license:abc",
          name: "Ada Two",
          charinfoJson: "{\"firstname\":\"Ada\",\"lastname\":\"Two\"}",
          metadataJson: "{}",
          positionJson: "{}",
          phoneNumber: "555-0002",
          accountNumber: "ACCT-TWO",
          selected: false,
          updatedAt: new Date("2026-05-18T12:00:00.000Z")
        }
      ]
    });
    const spacetime = new SpacetimeRuntimeAdapter(client);
    await spacetime.connectAndSubscribe("server-1");
    const admin = new AdminService({
      runtime: new RuntimeControlPlane(),
      permissions: new PermissionStore(),
      plugins: new PluginRegistry(),
      spacetime
    });

    await admin.upsertGameplayCharacter({
      id: "char:three",
      playerPrincipalId: "player:7",
      citizenId: "CITIZEN-THREE",
      cid: 3,
      slot: 3,
      license: "license:abc",
      name: "Ada Three",
      charinfoJson: "{\"firstname\":\"Ada\",\"lastname\":\"Three\"}",
      metadataJson: "{\"hunger\":90}",
      positionJson: "{\"x\":1,\"y\":2,\"z\":3}",
      phoneNumber: "555-0003",
      accountNumber: "ACCT-THREE",
      selected: false
    });
    await admin.selectGameplayCharacter("char:two");

    expect(client.reducerCalls).toEqual([
      {
        name: "upsert_character",
        args: {
          id: "char:three",
          playerPrincipalId: "player:7",
          citizenId: "CITIZEN-THREE",
          cid: 3,
          slot: 3,
          license: "license:abc",
          name: "Ada Three",
          charinfoJson: "{\"firstname\":\"Ada\",\"lastname\":\"Three\"}",
          metadataJson: "{\"hunger\":90}",
          gangJson: "{}",
          positionJson: "{\"x\":1,\"y\":2,\"z\":3}",
          phoneNumber: "555-0003",
          accountNumber: "ACCT-THREE",
          selected: false
        }
      },
      {
        name: "upsert_character",
        args: {
          id: "char:two",
          playerPrincipalId: "player:7",
          citizenId: "CITIZEN-TWO",
          cid: 2,
          slot: 2,
          license: "license:abc",
          name: "Ada Two",
          charinfoJson: "{\"firstname\":\"Ada\",\"lastname\":\"Two\"}",
          metadataJson: "{}",
          gangJson: "{}",
          positionJson: "{}",
          phoneNumber: "555-0002",
          accountNumber: "ACCT-TWO",
          selected: true
        }
      }
    ]);
  });

  it("exposes gameplay registration and mutation HTTP routes", async () => {
    const { admin, client } = createAdmin();
    const api = createAdminHttpApi(admin);

    const item = await api.handle({
      method: "POST",
      path: "/gameplay/items",
      body: {
        key: "repair_kit",
        pluginId: "mechanic_core",
        label: "Repair Kit",
        stackable: true,
        maxStack: 10
      }
    });
    const grant = await api.handle({
      method: "POST",
      path: "/gameplay/inventory/grants",
      body: {
        id: "grant-1",
        ownerId: "char:1",
        itemKey: "repair_kit",
        quantity: 2
      }
    });

    expect(item).toEqual({ status: 200, body: { ok: true } });
    expect(grant).toEqual({ status: 200, body: { ok: true } });
    expect(client.reducerCalls.map((call) => call.name)).toEqual([
      "register_item",
      "grant_item"
    ]);
  });

  it("exposes QBCore character HTTP write and selection routes", async () => {
    const client = new FakeSpacetimeClient({
      characters: [
        {
          id: "char:two",
          playerPrincipalId: "player:7",
          citizenId: "CITIZEN-TWO",
          cid: 2,
          slot: 2,
          license: "license:abc",
          name: "Ada Two",
          charinfoJson: "{\"firstname\":\"Ada\",\"lastname\":\"Two\"}",
          metadataJson: "{}",
          positionJson: "{}",
          phoneNumber: "555-0002",
          accountNumber: "ACCT-TWO",
          selected: false,
          updatedAt: new Date("2026-05-18T12:00:00.000Z")
        }
      ]
    });
    const spacetime = new SpacetimeRuntimeAdapter(client);
    await spacetime.connectAndSubscribe("server-1");
    const admin = new AdminService({
      runtime: new RuntimeControlPlane(),
      permissions: new PermissionStore(),
      plugins: new PluginRegistry(),
      spacetime
    });
    const api = createAdminHttpApi(admin);

    const character = await api.handle({
      method: "POST",
      path: "/gameplay/characters",
      body: {
        id: "char:three",
        playerPrincipalId: "player:7",
        citizenId: "CITIZEN-THREE",
        cid: 3,
        slot: 3,
        license: "license:abc",
        name: "Ada Three",
        charinfoJson: "{\"firstname\":\"Ada\",\"lastname\":\"Three\"}",
        metadataJson: "{\"hunger\":90}",
        positionJson: "{\"x\":1,\"y\":2,\"z\":3}",
        phoneNumber: "555-0003",
        accountNumber: "ACCT-THREE",
        selected: false
      }
    });
    const selected = await api.handle({
      method: "POST",
      path: "/gameplay/characters/char%3Atwo/select"
    });

    expect(character).toEqual({ status: 200, body: { ok: true } });
    expect(selected).toEqual({ status: 200, body: { ok: true } });
    expect(client.reducerCalls.map((call) => call.name)).toEqual([
      "upsert_character",
      "upsert_character"
    ]);
    expect(client.reducerCalls[1]?.args).toEqual(expect.objectContaining({
      id: "char:two",
      selected: true
    }));
  });

  it("ingests runtime-originated QBCore character selections through HTTP", async () => {
    const client = new FakeSpacetimeClient({
      characters: [
        {
          id: "char:one",
          playerPrincipalId: "player:7",
          citizenId: "CITIZEN-ONE",
          cid: 1,
          slot: 1,
          license: "license:abc",
          name: "Ada One",
          charinfoJson: "{}",
          metadataJson: "{}",
          gangJson: "{}",
          positionJson: "{}",
          phoneNumber: "",
          accountNumber: "",
          selected: false,
          updatedAt: new Date("2026-05-18T12:00:00.000Z")
        }
      ]
    });
    const spacetime = new SpacetimeRuntimeAdapter(client);
    await spacetime.connectAndSubscribe("server-1");
    const admin = new AdminService({
      runtime: new RuntimeControlPlane(),
      permissions: new PermissionStore(),
      plugins: new PluginRegistry(),
      spacetime
    });
    const api = createAdminHttpApi(admin);

    await expect(api.handle({
      method: "POST",
      path: "/qbcore/character-selections",
      body: {
        selections: [
          {
            characterId: "char:one"
          }
        ]
      }
    })).resolves.toEqual({
      status: 200,
      body: { applied: 1 }
    });

    expect(client.reducerCalls).toEqual([
      {
        name: "upsert_character",
        args: expect.objectContaining({
          id: "char:one",
          selected: true
        })
      }
    ]);
  });

  it("ingests runtime-originated QBCore character updates through HTTP", async () => {
    const { admin, client } = createAdmin();
    const api = createAdminHttpApi(admin);

    await expect(api.handle({
      method: "POST",
      path: "/qbcore/character-updates",
      body: {
        updates: [
          {
            characterId: "char:ada",
            playerPrincipalId: "player:7",
            citizenId: "CITIZEN-ADA",
            cid: 2,
            slot: 2,
            license: "license:abc",
            name: "Ada Byron",
            charinfoJson: "{\"firstname\":\"Ada\",\"lastname\":\"Byron\"}",
            metadataJson: "{\"hunger\":80}",
            gangJson: "{\"name\":\"ballas\",\"label\":\"Ballas\",\"isboss\":false,\"grade\":{\"name\":\"soldier\",\"level\":1}}",
            positionJson: "{\"x\":1,\"y\":2,\"z\":3}",
            phoneNumber: "555-0101",
            accountNumber: "ACCT-ADA",
            selected: true
          }
        ]
      }
    })).resolves.toEqual({
      status: 200,
      body: { applied: 1 }
    });

    expect(client.reducerCalls).toEqual([
      {
        name: "upsert_character",
        args: {
          id: "char:ada",
          playerPrincipalId: "player:7",
          citizenId: "CITIZEN-ADA",
          cid: 2,
          slot: 2,
          license: "license:abc",
          name: "Ada Byron",
          charinfoJson: "{\"firstname\":\"Ada\",\"lastname\":\"Byron\"}",
          metadataJson: "{\"hunger\":80}",
          gangJson: "{\"name\":\"ballas\",\"label\":\"Ballas\",\"isboss\":false,\"grade\":{\"name\":\"soldier\",\"level\":1}}",
          positionJson: "{\"x\":1,\"y\":2,\"z\":3}",
          phoneNumber: "555-0101",
          accountNumber: "ACCT-ADA",
          selected: true
        }
      }
    ]);
  });

  it("ingests runtime-originated QBCore inventory updates through HTTP", async () => {
    const { admin, client } = createAdmin();
    const api = createAdminHttpApi(admin);

    await expect(api.handle({
      method: "POST",
      path: "/qbcore/inventory-updates",
      body: {
        updates: [
          {
            id: "inv:add",
            characterId: "char:ada",
            itemKey: "repair_kit",
            operation: "add",
            amount: 2
          },
          {
            id: "inv:remove",
            characterId: "char:ada",
            itemKey: "repair_kit",
            operation: "remove",
            amount: 1
          }
        ]
      }
    })).resolves.toEqual({
      status: 200,
      body: { applied: 2 }
    });

    expect(client.reducerCalls).toEqual([
      {
        name: "grant_item",
        args: {
          id: "inv:add",
          ownerId: "char:ada",
          itemKey: "repair_kit",
          quantity: 2
        }
      },
      {
        name: "remove_item",
        args: {
          id: "inv:remove",
          ownerId: "char:ada",
          itemKey: "repair_kit",
          quantity: 1
        }
      }
    ]);
  });

  it("serves gameplay primitive reads from SpacetimeDB live cache", async () => {
    const client = new FakeSpacetimeClient({
      items: [
        {
          key: "repair_kit",
          pluginId: "mechanic_core",
          label: "Repair Kit",
          stackable: true,
          maxStack: 10
        }
      ],
      jobs: [
        {
          key: "mechanic",
          pluginId: "mechanic_core",
          label: "Mechanic",
          gradesJson: "[\"trainee\",\"lead\"]"
        }
      ],
      vehicles: [
        {
          model: "flatbed",
          pluginId: "mechanic_core",
          label: "Flatbed",
          category: "service"
        }
      ],
      locations: [
        {
          key: "mechanic_shop",
          pluginId: "mechanic_core",
          label: "Mechanic Shop",
          x: 1,
          y: 2,
          z: 3
        }
      ],
      inventory_stacks: [
        {
          id: "char:1:repair_kit",
          ownerId: "char:1",
          itemKey: "repair_kit",
          quantity: 2,
          updatedAt: new Date("2026-05-18T12:00:00.000Z")
        }
      ],
      character_jobs: [
        {
          characterId: "char:1",
          jobKey: "mechanic",
          grade: "trainee",
          onDuty: true,
          updatedAt: new Date("2026-05-18T12:00:00.000Z")
        }
      ]
    });
    const spacetime = new SpacetimeRuntimeAdapter(client);
    await spacetime.connectAndSubscribe("server-1");
    const api = createAdminHttpApi(new AdminService({
      runtime: new RuntimeControlPlane(),
      permissions: new PermissionStore(),
      plugins: new PluginRegistry(),
      spacetime
    }));

    await expect(api.handle({ method: "GET", path: "/gameplay" })).resolves.toEqual({
      status: 200,
      body: {
        items: [expect.objectContaining({ key: "repair_kit", maxStack: 10 })],
        jobs: [expect.objectContaining({ key: "mechanic", gradesJson: "[\"trainee\",\"lead\"]" })],
        vehicles: [expect.objectContaining({ model: "flatbed", category: "service" })],
        locations: [expect.objectContaining({ key: "mechanic_shop", x: 1, y: 2, z: 3 })],
        characters: [],
        inventory: [expect.objectContaining({ ownerId: "char:1", itemKey: "repair_kit", quantity: 2 })],
        characterJobs: [expect.objectContaining({ characterId: "char:1", jobKey: "mechanic", onDuty: true })]
      }
    });
  });

  it("builds QBCore PlayerData snapshots from SpacetimeDB gameplay and economy cache rows", async () => {
    const client = new FakeSpacetimeClient({
      principals: [
        {
          id: "player:7",
          principalType: "player",
          externalId: "license:abc",
          name: "Ada Lovelace",
          createdAt: new Date("2026-05-18T12:00:00.000Z")
        }
      ],
      menu_sessions: [
        {
          id: "session-7",
          serverId: "server-1",
          playerId: "7",
          cacheVersion: 1
        },
        {
          id: "session-12",
          serverId: "server-2",
          playerId: "12",
          cacheVersion: 1
        }
      ],
      characters: [
        {
          id: "char:ada",
          playerPrincipalId: "player:7",
          citizenId: "CITIZEN-ADA",
          cid: 2,
          slot: 2,
          license: "license:character",
          name: "Ada Byron",
          charinfoJson: "{\"firstname\":\"Ada\",\"lastname\":\"Byron\",\"birthdate\":\"1815-12-10\",\"gender\":1,\"nationality\":\"British\",\"phone\":\"555-0101\",\"account\":\"ACCT-ADA\"}",
          metadataJson: "{\"hunger\":87,\"thirst\":64,\"isdead\":false}",
          gangJson: "{\"name\":\"ballas\",\"label\":\"Ballas\",\"isboss\":false,\"grade\":{\"name\":\"soldier\",\"level\":1}}",
          positionJson: "{\"x\":10,\"y\":20,\"z\":30,\"heading\":90}",
          phoneNumber: "555-0101",
          accountNumber: "ACCT-ADA",
          selected: true,
          updatedAt: new Date("2026-05-18T12:00:00.000Z")
        }
      ],
      accounts: [
        {
          id: "acct:cash",
          ownerType: "character",
          ownerId: "char:ada",
          currency: "cash",
          balance: 250,
          status: "active",
          createdAt: new Date("2026-05-18T12:00:00.000Z"),
          updatedAt: new Date("2026-05-18T12:00:00.000Z")
        },
        {
          id: "acct:bank",
          ownerType: "character",
          ownerId: "char:ada",
          currency: "bank",
          balance: 1000,
          status: "active",
          createdAt: new Date("2026-05-18T12:00:00.000Z"),
          updatedAt: new Date("2026-05-18T12:00:00.000Z")
        }
      ],
      items: [
        {
          key: "repair_kit",
          pluginId: "mechanic_core",
          label: "Repair Kit",
          stackable: true,
          maxStack: 10
        }
      ],
      inventory_stacks: [
        {
          id: "char:ada:repair_kit",
          ownerId: "char:ada",
          itemKey: "repair_kit",
          quantity: 2,
          updatedAt: new Date("2026-05-18T12:00:00.000Z")
        }
      ],
      jobs: [
        {
          key: "mechanic",
          pluginId: "mechanic_core",
          label: "Mechanic",
          gradesJson: "[\"trainee\",\"lead\"]"
        }
      ],
      character_jobs: [
        {
          characterId: "char:ada",
          jobKey: "mechanic",
          grade: "trainee",
          onDuty: true,
          updatedAt: new Date("2026-05-18T12:00:00.000Z")
        }
      ]
    });
    const spacetime = new SpacetimeRuntimeAdapter(client);
    await spacetime.connectAndSubscribe("server-1");
    const api = createAdminHttpApi(new AdminService({
      runtime: new RuntimeControlPlane(),
      permissions: new PermissionStore(),
      plugins: new PluginRegistry(),
      spacetime
    }));

    await expect(api.handle({ method: "GET", path: "/qbcore/player-data?serverId=server-1" })).resolves.toEqual({
      status: 200,
      body: [
        {
          serverId: "server-1",
          source: "7",
          characterId: "char:ada",
          citizenid: "CITIZEN-ADA",
          cid: 2,
          license: "license:character",
          name: "Ada Byron",
          charinfo: {
            firstname: "Ada",
            lastname: "Byron",
            birthdate: "1815-12-10",
            gender: 1,
            nationality: "British",
            phone: "555-0101",
            account: "ACCT-ADA"
          },
          money: {
            bank: 1000,
            cash: 250
          },
          job: {
            name: "mechanic",
            label: "Mechanic",
            payment: 0,
            onduty: true,
            isboss: false,
            grade: {
              name: "trainee",
              level: 0
            }
          },
          gang: {
            name: "ballas",
            label: "Ballas",
            isboss: false,
            grade: {
              name: "soldier",
              level: 1
            }
          },
          metadata: {
            hunger: 87,
            thirst: 64,
            isdead: false
          },
          position: {
            x: 10,
            y: 20,
            z: 30,
            heading: 90
          },
          items: [
            {
              name: "repair_kit",
              label: "Repair Kit",
              amount: 2,
              slot: 1,
              info: {},
              type: "item"
            }
          ]
        }
      ]
    });
  });

  it("queues and drains trusted vehicle spawn dispatches over HTTP", async () => {
    const api = createAdminHttpApi(new AdminService({
      runtime: new RuntimeControlPlane(),
      permissions: new PermissionStore(),
      plugins: new PluginRegistry()
    }));

    await expect(api.handle({
      method: "POST",
      path: "/gameplay/vehicle-spawns",
      body: {
        spawns: [
          {
            serverId: "server-1",
            targetSource: "7",
            model: "sultan",
            label: "Sultan",
            category: "car",
            location: {
              key: "garage",
              label: "Garage",
              x: 1,
              y: 2,
              z: 3
            },
            warpIntoVehicle: true
          },
          {
            serverId: "server-2",
            targetSource: 12,
            model: "flatbed",
            label: "Flatbed",
            category: "service",
            heading: 90
          }
        ]
      }
    })).resolves.toEqual({
      status: 200,
      body: {
        queued: 2
      }
    });

    await expect(api.handle({
      method: "POST",
      path: "/gameplay/vehicle-spawns/drain?serverId=server-1"
    })).resolves.toEqual({
      status: 200,
      body: [
        {
          serverId: "server-1",
          targetSource: "7",
          model: "sultan",
          label: "Sultan",
          category: "car",
          location: {
            key: "garage",
            label: "Garage",
            x: 1,
            y: 2,
            z: 3
          },
          warpIntoVehicle: true
        }
      ]
    });
    await expect(api.handle({
      method: "POST",
      path: "/gameplay/vehicle-spawns/drain?serverId=server-1"
    })).resolves.toEqual({
      status: 200,
      body: []
    });
  });

  it("queues and drains trusted vehicle repair dispatches over HTTP", async () => {
    const api = createAdminHttpApi(new AdminService({
      runtime: new RuntimeControlPlane(),
      permissions: new PermissionStore(),
      plugins: new PluginRegistry()
    }));

    await expect(api.handle({
      method: "POST",
      path: "/gameplay/vehicle-repairs",
      body: {
        repairs: [
          {
            serverId: "server-1",
            targetSource: "7",
            targetVehicleNetId: 44
          },
          {
            serverId: "server-2",
            targetSource: 12,
            targetVehicleNetId: 55
          }
        ]
      }
    })).resolves.toEqual({
      status: 200,
      body: {
        queued: 2
      }
    });

    await expect(api.handle({
      method: "POST",
      path: "/gameplay/vehicle-repairs/drain?serverId=server-1"
    })).resolves.toEqual({
      status: 200,
      body: [
        {
          serverId: "server-1",
          targetSource: "7",
          targetVehicleNetId: 44
        }
      ]
    });
    await expect(api.handle({
      method: "POST",
      path: "/gameplay/vehicle-repairs/drain?serverId=server-1"
    })).resolves.toEqual({
      status: 200,
      body: []
    });
  });

  it("queues and drains trusted teleport dispatches over HTTP", async () => {
    const api = createAdminHttpApi(new AdminService({
      runtime: new RuntimeControlPlane(),
      permissions: new PermissionStore(),
      plugins: new PluginRegistry()
    }));

    await expect(api.handle({
      method: "POST",
      path: "/gameplay/teleports",
      body: {
        teleports: [
          {
            serverId: "server-1",
            targetSource: "7",
            x: 100,
            y: 200,
            z: 30,
            heading: 90
          },
          {
            serverId: "server-2",
            targetSource: 12,
            x: 5,
            y: 6,
            z: 7
          }
        ]
      }
    })).resolves.toEqual({
      status: 200,
      body: {
        queued: 2
      }
    });

    await expect(api.handle({
      method: "POST",
      path: "/gameplay/teleports/drain?serverId=server-1"
    })).resolves.toEqual({
      status: 200,
      body: [
        {
          serverId: "server-1",
          targetSource: "7",
          x: 100,
          y: 200,
          z: 30,
          heading: 90
        }
      ]
    });
    await expect(api.handle({
      method: "POST",
      path: "/gameplay/teleports/drain?serverId=server-1"
    })).resolves.toEqual({
      status: 200,
      body: []
    });
  });

  it("queues and drains trusted kick dispatches over HTTP", async () => {
    const api = createAdminHttpApi(new AdminService({
      runtime: new RuntimeControlPlane(),
      permissions: new PermissionStore(),
      plugins: new PluginRegistry()
    }));

    await expect(api.handle({
      method: "POST",
      path: "/gameplay/kicks",
      body: {
        kicks: [
          {
            serverId: "server-1",
            targetSource: "7",
            reason: "Rule violation"
          },
          {
            serverId: "server-2",
            targetSource: 12,
            reason: "Staff decision"
          }
        ]
      }
    })).resolves.toEqual({
      status: 200,
      body: {
        queued: 2
      }
    });

    await expect(api.handle({
      method: "POST",
      path: "/gameplay/kicks/drain?serverId=server-1"
    })).resolves.toEqual({
      status: 200,
      body: [
        {
          serverId: "server-1",
          targetSource: "7",
          reason: "Rule violation"
        }
      ]
    });
    await expect(api.handle({
      method: "POST",
      path: "/gameplay/kicks/drain?serverId=server-1"
    })).resolves.toEqual({
      status: 200,
      body: []
    });
  });

  it("requires SpacetimeDB for gameplay admin mutations", async () => {
    const admin = new AdminService({
      runtime: new RuntimeControlPlane(),
      permissions: new PermissionStore(),
      plugins: new PluginRegistry()
    });

    await expect(
      admin.registerGameplayItem({
        key: "repair_kit",
        pluginId: "mechanic_core",
        label: "Repair Kit",
        stackable: true,
        maxStack: 10
      })
    ).rejects.toThrow("SpacetimeDB adapter is required for gameplay admin mutations");
  });
});
