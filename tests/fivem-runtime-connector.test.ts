import { describe, expect, it } from "vitest";
import {
  FiveMRuntimeConnector,
  planAceMirrorEvent,
  planMenuTreeEvents,
  planNativePermissionEvents,
  planReplicatedStateEvents,
  planRuntimeHealthEvent,
  planRuntimeConfigEvents,
  planMenuRefreshEvents,
  planKickEvents,
  planQbSharedEvent,
  planQbPlayerDataEvents,
  planTeleportEvents,
  planVehicleRepairEvents,
  planVehicleSpawnEvents,
  planWorldStateEvents,
  type FiveMQbCharacterSelectionPayload,
  type FiveMQbCharacterUpdatePayload,
  type FiveMServerEventEmitter
} from "../src/connectors/fivem-runtime.js";
import { type AdminHttpApi } from "../src/admin/http-api.js";

describe("FiveM runtime connector", () => {
  it("runs a full control-plane sync pass across live state and queued gameplay actions", async () => {
    const calls: string[] = [];
    const emitted: Array<{ serverId: string; eventName: string; payload: unknown }> = [];
    const dashboard = {
      health: {
        serverId: "server-1",
        serverName: "Roleplay Dev",
        environment: "development",
        status: "online",
        reason: "runtime heartbeat current",
        lastHeartbeatAt: new Date("2026-05-19T00:00:00.000Z")
      },
      plugins: [],
      auditLogs: [],
      config: [
        {
          id: "server-1:features:pvp",
          serverId: "server-1",
          namespace: "features",
          key: "pvp",
          value: true,
          version: 1,
          updatedAt: new Date("2026-05-19T00:00:00.000Z")
        }
      ]
    };
    const permissions = {
      permissions: [
        {
          id: "perm.repair",
          key: "menu.vehicle.repair",
          description: "Repair vehicles",
          pluginId: "admin_tools"
        }
      ],
      principals: [
        {
          id: "player:1",
          type: "player",
          externalId: "license:abc",
          name: "Ada"
        }
      ],
      edges: [],
      grants: [
        {
          principalId: "player:1",
          permissionKey: "menu.vehicle.repair",
          effect: "allow",
          source: "manual"
        }
      ],
      policies: [],
      aceMirrorRules: []
    };
    const admin = fakeRoutedAdminApi({
      "/servers/server-1/dashboard": dashboard,
      "/permissions": permissions,
      "/menus": {
        definitions: [],
        actions: [
          {
            id: "vehicle.repair",
            pluginId: "admin_tools",
            actionType: "runtime_action",
            reducerName: "repair_vehicle",
            payloadSchemaJson: "",
            confirmationRequired: false,
            auditLevel: "standard",
            requiredPermission: "menu.vehicle.repair",
            enabled: true
          },
          {
            id: "economy.give_money",
            pluginId: "economy_core",
            actionType: "runtime_action",
            reducerName: "economy_give_money",
            payloadSchemaJson: "",
            confirmationRequired: false,
            auditLevel: "standard",
            requiredPermission: "economy.give_money",
            enabled: true
          }
        ],
        commands: [],
        panels: [],
        policies: [],
        sessions: []
      },
      "/menus/refresh-targets/drain?serverId=server-1": [
        {
          serverId: "server-1",
          playerId: "player:1",
          sessionId: "session-1",
          cacheVersion: 1
        }
      ],
      "/runtime/replicated-state/drain?serverId=server-1": [
        {
          serverId: "server-1",
          key: "feature:pvp",
          value: true
        }
      ],
      "/runtime/world-state/drain?serverId=server-1": [
        {
          serverId: "server-1",
          world: {
            weatherType: "EXTRASUNNY"
          }
        }
      ],
      "/gameplay/vehicle-spawns/drain?serverId=server-1": [
        {
          serverId: "server-1",
          targetSource: "7",
          model: "sultan",
          label: "Sultan",
          category: "car"
        }
      ],
      "/gameplay/vehicle-repairs/drain?serverId=server-1": [
        {
          serverId: "server-1",
          targetSource: "7",
          targetVehicleNetId: 44
        }
      ],
      "/gameplay/teleports/drain?serverId=server-1": [
        {
          serverId: "server-1",
          targetSource: "7",
          x: 100,
          y: 200,
          z: 30
        }
      ],
      "/gameplay/kicks/drain?serverId=server-1": [
        {
          serverId: "server-1",
          targetSource: "7",
          reason: "Rule violation"
        }
      ],
      "/qbcore/character-updates": {
        applied: 1
      },
      "/qbcore/money-updates": {
        applied: 1
      },
      "/qbcore/inventory-updates": {
        applied: 1
      },
      "/qbcore/character-selections": {
        applied: 1
      },
      "/qbcore/player-data?serverId=server-1": [
        {
          serverId: "server-1",
          source: "7",
          characterId: "char:ada",
          citizenid: "CID7",
          cid: 1,
          license: "license:abc",
          name: "Ada Lovelace",
          charinfo: {
            firstname: "Ada",
            lastname: "Lovelace"
          },
          money: {
            cash: 250,
            bank: 1000
          },
          job: {
            name: "mechanic",
            label: "Mechanic",
            payment: 100,
            onduty: true,
            isboss: false,
            grade: {
              name: "trainee",
              level: 0
            }
          },
          gang: {
            name: "none",
            label: "No Gang",
            isboss: false,
            grade: {
              name: "none",
              level: 0
            }
          },
          metadata: {
            hunger: 95
          },
          items: [
            {
              name: "repair_kit",
              amount: 2
            }
          ]
        }
      ],
      "/gameplay": {
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
            gradesJson: "[\"trainee\",\"boss\"]"
          }
        ],
        vehicles: [
          {
            model: "sultan",
            pluginId: "vehicle_core",
            label: "Sultan",
            category: "sports"
          }
        ],
        locations: [],
        characters: [],
        inventory: [],
        characterJobs: []
      },
      "/deployments": {
        bundles: [],
        capabilities: [],
        deployments: [
          {
            id: "deployment-1",
            pluginId: "admin_tools",
            bundleId: "bundle-1",
            serverId: "server-1",
            status: "active",
            desiredVersion: "1.0.0",
            activeVersion: "1.0.0",
            errorMessage: ""
          }
        ],
        sandboxEvents: [
          {
            id: "sandbox-event-1",
            pluginId: "admin_tools",
            serverId: "server-1",
            eventType: "sidecar.started",
            payloadHash: "payload-hash",
            status: "succeeded",
            createdAt: new Date("2026-05-19T00:00:00.000Z")
          }
        ]
      },
      "/servers/server-1/audit/mirror": { ok: true }
    }, calls);
    const connector = new FiveMRuntimeConnector({
      admin,
      emitter: {
        async emitServerEvent(serverId, eventName, payload) {
          emitted.push({ serverId, eventName, payload });
        }
      },
      runtimeClient: {
        async drainQbCharacterUpdates() {
          return [
            {
              characterId: "char:ada",
              playerPrincipalId: "player:7",
              citizenId: "CID7",
              cid: 1,
              slot: 1,
              license: "license:abc",
              name: "Ada Lovelace",
              charinfoJson: "{\"firstname\":\"Ada\",\"lastname\":\"Lovelace\"}",
              metadataJson: "{\"hunger\":90}",
              positionJson: "{\"x\":1,\"y\":2,\"z\":3}",
              phoneNumber: "555-0101",
              accountNumber: "ACCT-ADA",
              selected: true
            }
          ];
        },
        async drainQbMoneyUpdates() {
          return [
            {
              transactionId: "tx:money",
              actorId: "player:7",
              characterId: "char:ada",
              moneyType: "cash",
              operation: "add",
              amount: 25,
              reason: "job payout",
              idempotencyKey: "money:add"
            }
          ];
        },
        async drainQbInventoryUpdates() {
          return [
            {
              id: "inv:add",
              characterId: "char:ada",
              itemKey: "repair_kit",
              operation: "add",
              amount: 2
            }
          ];
        },
        async drainQbCharacterSelections() {
          return [
            {
              characterId: "char:ada"
            }
          ];
        }
      },
      serverId: "server-1"
    });

    await expect(connector.syncAll()).resolves.toEqual(expect.objectContaining({
      health: expect.objectContaining({
        emittedEvent: expect.objectContaining({ eventName: "sdb_runtime:syncHealth" })
      }),
      config: {
        emittedEvents: [expect.objectContaining({ eventName: "sdb_runtime:syncConfig" })]
      },
      nativePermissions: {
        emittedEvents: [expect.objectContaining({ principalId: "player:1" })]
      },
      aceMirror: {
        commands: [],
        emitted: false
      },
      menuTrees: {
        emittedEvents: []
      },
      menuRefreshes: {
        drainedTargets: [expect.objectContaining({ sessionId: "session-1" })],
        emittedEvents: [expect.objectContaining({ eventName: "sdb_runtime:syncMenuRefresh" })]
      },
      replicatedState: {
        drainedUpdates: [expect.objectContaining({ key: "feature:pvp" })],
        emittedEvents: [expect.objectContaining({ eventName: "sdb_runtime:syncReplicatedState" })]
      },
      worldState: {
        drainedUpdates: [expect.objectContaining({ world: { weatherType: "EXTRASUNNY" } })],
        emittedEvents: [expect.objectContaining({ eventName: "sdb_runtime:syncWorldState" })]
      },
      vehicleSpawns: {
        drainedSpawns: [expect.objectContaining({ model: "sultan" })],
        emittedEvents: [expect.objectContaining({ eventName: "sdb_runtime:spawnVehicles" })]
      },
      vehicleRepairs: {
        drainedRepairs: [expect.objectContaining({ targetVehicleNetId: 44 })],
        emittedEvents: [expect.objectContaining({ eventName: "sdb_runtime:repairVehicle" })]
      },
      teleports: {
        drainedTeleports: [expect.objectContaining({ x: 100 })],
        emittedEvents: [expect.objectContaining({ eventName: "sdb_runtime:teleportPlayer" })]
      },
      kicks: {
        drainedKicks: [expect.objectContaining({ reason: "Rule violation" })],
        emittedEvents: [expect.objectContaining({ eventName: "sdb_runtime:kickPlayer" })]
      },
      qbMoneyUpdates: {
        drainedUpdates: [expect.objectContaining({ transactionId: "tx:money" })],
        applied: 1
      },
      qbInventoryUpdates: {
        drainedUpdates: [expect.objectContaining({ id: "inv:add" })],
        applied: 1
      },
      qbCharacterSelections: {
        drainedSelections: [expect.objectContaining({ characterId: "char:ada" })],
        applied: 1
      },
      qbCharacterUpdates: {
        drainedUpdates: [expect.objectContaining({ characterId: "char:ada" })],
        applied: 1
      },
      qbPlayerData: {
        emittedEvent: expect.objectContaining({ eventName: "sdb_runtime:syncQbPlayerData" })
      },
      qbShared: {
        emittedEvent: expect.objectContaining({ eventName: "sdb_runtime:syncQbShared" })
      },
      deploymentDiagnostics: {
        emittedEvent: expect.objectContaining({ eventName: "sdb_runtime:syncDeployments" })
      },
      runtimeAudit: {
        mirrored: true
      }
    }));
    expect(calls).toEqual([
      "GET /servers/server-1/dashboard",
      "GET /servers/server-1/dashboard",
      "GET /permissions",
      "GET /permissions",
      "GET /menus",
      "GET /permissions",
      "POST /menus/refresh-targets/drain?serverId=server-1",
      "POST /runtime/replicated-state/drain?serverId=server-1",
      "POST /runtime/world-state/drain?serverId=server-1",
      "POST /gameplay/vehicle-spawns/drain?serverId=server-1",
      "POST /gameplay/vehicle-repairs/drain?serverId=server-1",
      "POST /gameplay/teleports/drain?serverId=server-1",
      "POST /gameplay/kicks/drain?serverId=server-1",
      "POST /qbcore/money-updates",
      "POST /qbcore/inventory-updates",
      "POST /qbcore/character-selections",
      "POST /qbcore/character-updates",
      "GET /qbcore/player-data?serverId=server-1",
      "GET /gameplay",
      "GET /deployments",
      "POST /servers/server-1/audit/mirror"
    ]);
    expect(emitted.map((event) => event.eventName)).toEqual([
      "sdb_runtime:syncHealth",
      "sdb_runtime:syncConfig",
      "sdb_runtime:syncPermissions",
      "sdb_runtime:syncMenuRefresh",
      "sdb_runtime:syncReplicatedState",
      "sdb_runtime:syncWorldState",
      "sdb_runtime:spawnVehicles",
      "sdb_runtime:repairVehicle",
      "sdb_runtime:teleportPlayer",
      "sdb_runtime:kickPlayer",
      "sdb_runtime:syncQbPlayerData",
      "sdb_runtime:syncQbShared",
      "sdb_runtime:syncDeployments"
    ]);
  });

  it("drains runtime QBCore character updates and posts them to the admin plane", async () => {
    const calls: Array<{ method: string; path: string; body?: unknown }> = [];
    const drained: FiveMQbCharacterUpdatePayload[] = [
      {
        characterId: "char:ada",
        playerPrincipalId: "player:7",
        citizenId: "CID7",
        cid: 1,
        slot: 1,
        license: "license:abc",
        name: "Ada Lovelace",
        charinfoJson: "{\"firstname\":\"Ada\",\"lastname\":\"Lovelace\"}",
        metadataJson: "{\"hunger\":90}",
        positionJson: "{\"x\":1,\"y\":2,\"z\":3}",
        phoneNumber: "555-0101",
        accountNumber: "ACCT-ADA",
        selected: true
      }
    ];
    const connector = new FiveMRuntimeConnector({
      admin: {
        async handle(request) {
          calls.push(request);
          return {
            status: 200,
            body: { applied: 1 }
          };
        }
      },
      emitter: {
        async emitServerEvent() {}
      },
      runtimeClient: {
        async drainQbCharacterUpdates(serverId) {
          expect(serverId).toBe("server-1");
          return drained;
        }
      },
      serverId: "server-1"
    });

    await expect(connector.syncQbCharacterUpdates()).resolves.toEqual({
      drainedUpdates: drained,
      applied: 1
    });
    expect(calls).toEqual([
      {
        method: "POST",
        path: "/qbcore/character-updates",
        body: { updates: drained }
      }
    ]);
  });

  it("drains runtime QBCore character selections and posts them to the admin plane", async () => {
    const calls: Array<{ method: string; path: string; body?: unknown }> = [];
    const drained: FiveMQbCharacterSelectionPayload[] = [
      {
        characterId: "char:ada"
      }
    ];
    const connector = new FiveMRuntimeConnector({
      admin: {
        async handle(request) {
          calls.push(request);
          return {
            status: 200,
            body: { applied: 1 }
          };
        }
      },
      emitter: {
        async emitServerEvent() {}
      },
      runtimeClient: {
        async drainQbCharacterSelections(serverId) {
          expect(serverId).toBe("server-1");
          return drained;
        }
      },
      serverId: "server-1"
    });

    await expect(connector.syncQbCharacterSelections()).resolves.toEqual({
      drainedSelections: drained,
      applied: 1
    });
    expect(calls).toEqual([
      {
        method: "POST",
        path: "/qbcore/character-selections",
        body: { selections: drained }
      }
    ]);
  });

  it("drains runtime QBCore money updates and posts them to the admin plane", async () => {
    const calls: Array<{ method: string; path: string; body?: unknown }> = [];
    const drained = [
      {
        transactionId: "tx:money",
        actorId: "player:7",
        characterId: "char:ada",
        moneyType: "cash",
        operation: "add",
        amount: 25,
        reason: "job payout",
        idempotencyKey: "money:add"
      }
    ];
    const connector = new FiveMRuntimeConnector({
      admin: {
        async handle(request) {
          calls.push(request);
          return {
            status: 200,
            body: { applied: 1 }
          };
        }
      },
      emitter: {
        async emitServerEvent() {}
      },
      runtimeClient: {
        async drainQbMoneyUpdates(serverId) {
          expect(serverId).toBe("server-1");
          return drained;
        }
      },
      serverId: "server-1"
    });

    await expect(connector.syncQbMoneyUpdates()).resolves.toEqual({
      drainedUpdates: drained,
      applied: 1
    });
    expect(calls).toEqual([
      {
        method: "POST",
        path: "/qbcore/money-updates",
        body: { updates: drained }
      }
    ]);
  });

  it("rejects blank QBCore money update identifiers before posting to the admin plane", async () => {
    const calls: Array<{ method: string; path: string; body?: unknown }> = [];
    const connector = new FiveMRuntimeConnector({
      admin: {
        async handle(request) {
          calls.push(request);
          return {
            status: 200,
            body: { applied: 1 }
          };
        }
      },
      emitter: {
        async emitServerEvent() {}
      },
      runtimeClient: {
        async drainQbMoneyUpdates() {
          return [
            {
              transactionId: "tx:money",
              actorId: "player:7",
              characterId: " ",
              moneyType: "cash",
              operation: "add",
              amount: 25,
              reason: "job payout",
              idempotencyKey: "money:add"
            }
          ];
        }
      },
      serverId: "server-1"
    });

    await expect(connector.syncQbMoneyUpdates())
      .rejects.toThrow("QBCore money update characterId must be a non-empty string");
    expect(calls).toEqual([]);
  });

  it("drains runtime QBCore inventory updates and posts them to the admin plane", async () => {
    const calls: Array<{ method: string; path: string; body?: unknown }> = [];
    const drained = [
      {
        id: "inv:add",
        characterId: "char:ada",
        itemKey: "repair_kit",
        operation: "add",
        amount: 2
      }
    ];
    const connector = new FiveMRuntimeConnector({
      admin: {
        async handle(request) {
          calls.push(request);
          return {
            status: 200,
            body: { applied: 1 }
          };
        }
      },
      emitter: {
        async emitServerEvent() {}
      },
      runtimeClient: {
        async drainQbInventoryUpdates(serverId) {
          expect(serverId).toBe("server-1");
          return drained;
        }
      },
      serverId: "server-1"
    });

    await expect(connector.syncQbInventoryUpdates()).resolves.toEqual({
      drainedUpdates: drained,
      applied: 1
    });
    expect(calls).toEqual([
      {
        method: "POST",
        path: "/qbcore/inventory-updates",
        body: { updates: drained }
      }
    ]);
  });

  it("skips QBCore character update posting when no runtime updates are drained", async () => {
    const calls: unknown[] = [];
    const connector = new FiveMRuntimeConnector({
      admin: {
        async handle(request) {
          calls.push(request);
          return {
            status: 200,
            body: { applied: 0 }
          };
        }
      },
      emitter: {
        async emitServerEvent() {}
      },
      runtimeClient: {
        async drainQbCharacterUpdates() {
          return [];
        }
      },
      serverId: "server-1"
    });

    await expect(connector.syncQbCharacterUpdates()).resolves.toEqual({
      drainedUpdates: [],
      applied: 0
    });
    expect(calls).toEqual([]);
  });

  it("plans authoritative QBCore PlayerData sync events grouped by server", () => {
    expect(planQbPlayerDataEvents([
      {
        serverId: "server-2",
        source: 12,
        citizenid: "CID12",
        cid: 2,
        license: "license:def",
        name: "Grace Hopper"
      },
      {
        serverId: "server-1",
        source: "7",
        characterId: "char:ada",
        citizenid: "CID7",
        cid: 1,
        license: "license:abc",
        name: "Ada Lovelace",
        money: {
          cash: 250,
          bank: 1000
        }
      }
    ])).toEqual([
      {
        serverId: "server-1",
        eventName: "sdb_runtime:syncQbPlayerData",
        players: [
          expect.objectContaining({
            source: "7",
            characterId: "char:ada",
            citizenid: "CID7",
            money: {
              cash: 250,
              bank: 1000
            }
          })
        ]
      },
      {
        serverId: "server-2",
        eventName: "sdb_runtime:syncQbPlayerData",
        players: [
          expect.objectContaining({
            source: 12,
            citizenid: "CID12"
          })
        ]
      }
    ]);
  });

  it("plans QBCore shared data from gameplay primitives", () => {
    expect(planQbSharedEvent("server-1", {
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
          gradesJson: "[\"trainee\",\"boss\"]"
        }
      ],
      vehicles: [
        {
          model: "sultan",
          pluginId: "vehicle_core",
          label: "Sultan",
          category: "sports"
        }
      ],
      locations: [],
      characters: [],
      inventory: [],
      characterJobs: []
    })).toEqual({
      serverId: "server-1",
      eventName: "sdb_runtime:syncQbShared",
      shared: {
        Items: {
          repair_kit: expect.objectContaining({
            name: "repair_kit",
            label: "Repair Kit",
            unique: false,
            shouldClose: true
          })
        },
        Jobs: {
          mechanic: expect.objectContaining({
            name: "mechanic",
            label: "Mechanic",
            grades: {
              "0": expect.objectContaining({ name: "trainee", level: 0 }),
              "1": expect.objectContaining({ name: "boss", level: 1 })
            }
          })
        },
        Gangs: {},
        Vehicles: {
          sultan: expect.objectContaining({
            model: "sultan",
            name: "Sultan",
            category: "sports"
          })
        },
        StarterItems: {},
        MoneyTypes: {
          cash: 500,
          bank: 5000,
          crypto: 0
        },
        DefaultMetadata: {}
      }
    });
  });

  it("syncs changed QBCore shared data into the FiveM runtime resource", async () => {
    const calls: string[] = [];
    const emitted: Array<{ serverId: string; eventName: string; payload: unknown }> = [];
    const admin = fakeRoutedAdminApi({
      "/gameplay": {
        items: [
          {
            key: "repair_kit",
            pluginId: "mechanic_core",
            label: "Repair Kit",
            stackable: true,
            maxStack: 10
          }
        ],
        jobs: [],
        vehicles: [],
        locations: [],
        characters: [],
        inventory: [],
        characterJobs: []
      }
    }, calls);
    const connector = new FiveMRuntimeConnector({
      admin,
      emitter: {
        async emitServerEvent(serverId, eventName, payload) {
          emitted.push({ serverId, eventName, payload });
        }
      },
      serverId: "server-1"
    });

    await expect(connector.syncQbShared()).resolves.toEqual({
      emittedEvent: expect.objectContaining({
        serverId: "server-1",
        eventName: "sdb_runtime:syncQbShared"
      })
    });
    await expect(connector.syncQbShared()).resolves.toEqual({
      emittedEvent: undefined
    });
    expect(calls).toEqual([
      "GET /gameplay",
      "GET /gameplay"
    ]);
    expect(emitted).toEqual([
      {
        serverId: "server-1",
        eventName: "sdb_runtime:syncQbShared",
        payload: {
          shared: expect.objectContaining({
            Items: {
              repair_kit: expect.objectContaining({
                label: "Repair Kit"
              })
            }
          })
        }
      }
    ]);
  });

  it("syncs authoritative QBCore PlayerData snapshots into the FiveM runtime resource", async () => {
    const calls: string[] = [];
    const emitted: Array<{ serverId: string; eventName: string; payload: unknown }> = [];
    const admin = fakeRoutedAdminApi({
      "/qbcore/player-data?serverId=server-1": [
        {
          serverId: "server-1",
          source: "7",
          characterId: "char:ada",
          citizenid: "CID7",
          cid: 1,
          license: "license:abc",
          name: "Ada Lovelace",
          charinfo: {
            firstname: "Ada",
            lastname: "Lovelace"
          },
          money: {
            cash: 250,
            bank: 1000
          },
          metadata: {
            hunger: 95
          }
        }
      ]
    }, calls);
    const connector = new FiveMRuntimeConnector({
      admin,
      emitter: {
        async emitServerEvent(serverId, eventName, payload) {
          emitted.push({ serverId, eventName, payload });
        }
      },
      serverId: "server-1"
    });

    await expect(connector.syncQbPlayerData()).resolves.toEqual({
      emittedEvent: {
        serverId: "server-1",
        eventName: "sdb_runtime:syncQbPlayerData",
        players: [
          expect.objectContaining({
            source: "7",
            citizenid: "CID7",
            money: {
              cash: 250,
              bank: 1000
            }
          })
        ]
      }
    });
    await expect(connector.syncQbPlayerData()).resolves.toEqual({
      emittedEvent: undefined
    });
    expect(calls).toEqual([
      "GET /qbcore/player-data?serverId=server-1",
      "GET /qbcore/player-data?serverId=server-1"
    ]);
    expect(emitted).toEqual([
      {
        serverId: "server-1",
        eventName: "sdb_runtime:syncQbPlayerData",
        payload: {
          players: [
            expect.objectContaining({
              source: "7",
              characterId: "char:ada",
              citizenid: "CID7",
              money: {
                cash: 250,
                bank: 1000
              }
            })
          ]
        }
      }
    ]);
  });

  it("syncs changed deployment diagnostics into the FiveM runtime resource", async () => {
    const calls: string[] = [];
    const emitted: Array<{ serverId: string; eventName: string; payload: unknown }> = [];
    const admin = fakeRoutedAdminApi({
      "/deployments": {
        bundles: [],
        capabilities: [],
        deployments: [
          {
            id: "deployment-1",
            pluginId: "admin_tools",
            bundleId: "bundle-1",
            serverId: "server-1",
            status: "active",
            desiredVersion: "1.0.0",
            activeVersion: "1.0.0",
            errorMessage: ""
          },
          {
            id: "deployment-2",
            pluginId: "admin_tools",
            bundleId: "bundle-2",
            serverId: "server-2",
            status: "active",
            desiredVersion: "2.0.0",
            activeVersion: "2.0.0",
            errorMessage: ""
          }
        ],
        sandboxEvents: [
          {
            id: "sandbox-event-1",
            pluginId: "admin_tools",
            serverId: "server-1",
            eventType: "sidecar.started",
            payloadHash: "payload-hash",
            status: "succeeded",
            createdAt: new Date("2026-05-19T00:00:00.000Z")
          }
        ]
      }
    }, calls);
    const connector = new FiveMRuntimeConnector({
      admin,
      emitter: {
        async emitServerEvent(serverId, eventName, payload) {
          emitted.push({ serverId, eventName, payload });
        }
      },
      serverId: "server-1"
    });

    await expect(connector.syncDeploymentDiagnostics()).resolves.toEqual({
      emittedEvent: {
        serverId: "server-1",
        eventName: "sdb_runtime:syncDeployments",
        deployments: [expect.objectContaining({ id: "deployment-1", serverId: "server-1" })],
        sandboxEvents: [expect.objectContaining({ id: "sandbox-event-1", serverId: "server-1" })]
      }
    });
    await expect(connector.syncDeploymentDiagnostics()).resolves.toEqual({
      emittedEvent: undefined
    });
    expect(calls).toEqual(["GET /deployments", "GET /deployments"]);
    expect(emitted).toEqual([
      {
        serverId: "server-1",
        eventName: "sdb_runtime:syncDeployments",
        payload: {
          deployments: [expect.objectContaining({ id: "deployment-1", serverId: "server-1" })],
          sandboxEvents: [expect.objectContaining({ id: "sandbox-event-1", serverId: "server-1" })]
        }
      }
    ]);
  });

  it("reconciles local sidecars from server-scoped deployment diagnostics on every sync pass", async () => {
    const calls: string[] = [];
    const emitted: Array<{ serverId: string; eventName: string; payload: unknown }> = [];
    const reconciliations: string[] = [];
    const admin = fakeRoutedAdminApi({
      "/deployments": {
        bundles: [
          {
            id: "bundle-1",
            pluginId: "admin_tools",
            version: "1.0.0",
            artifactUrl: "memory://admin_tools.js",
            bundleHash: "hash-1",
            signature: "signature-1",
            signerId: "trusted-signer",
            runtimeType: "js_sidecar",
            capabilities: [{ key: "vehicle.repair" }],
            status: "registered",
            createdAt: new Date("2026-05-19T00:00:00.000Z")
          },
          {
            id: "bundle-2",
            pluginId: "admin_tools",
            version: "2.0.0",
            artifactUrl: "memory://admin_tools-v2.js",
            bundleHash: "hash-2",
            signature: "signature-2",
            signerId: "trusted-signer",
            runtimeType: "js_sidecar",
            capabilities: [{ key: "vehicle.invoice" }],
            status: "registered",
            createdAt: new Date("2026-05-19T00:00:00.000Z")
          }
        ],
        capabilities: [],
        deployments: [
          {
            id: "deployment-1",
            pluginId: "admin_tools",
            bundleId: "bundle-1",
            serverId: "server-1",
            status: "active",
            desiredVersion: "1.0.0",
            activeVersion: "1.0.0",
            errorMessage: ""
          },
          {
            id: "deployment-2",
            pluginId: "admin_tools",
            bundleId: "bundle-2",
            serverId: "server-2",
            status: "active",
            desiredVersion: "2.0.0",
            activeVersion: "2.0.0",
            errorMessage: ""
          }
        ],
        sandboxEvents: []
      }
    }, calls);
    const connector = new FiveMRuntimeConnector({
      admin,
      emitter: {
        async emitServerEvent(serverId, eventName, payload) {
          emitted.push({ serverId, eventName, payload });
        }
      },
      serverId: "server-1",
      sidecarReconciler: {
        async reconcile(deployments, bundlesById) {
          reconciliations.push([
            deployments.map((deployment) => deployment.id).join(","),
            [...bundlesById.keys()].sort().join(",")
          ].join("|"));
        }
      }
    });

    await connector.syncDeploymentDiagnostics();
    await connector.syncDeploymentDiagnostics();

    expect(reconciliations).toEqual([
      "deployment-1|bundle-1,bundle-2",
      "deployment-1|bundle-1,bundle-2"
    ]);
    expect(emitted).toHaveLength(1);
    expect(calls).toEqual(["GET /deployments", "GET /deployments"]);
  });

  it("mirrors runtime audit logs through the server-scoped admin route", async () => {
    const calls: string[] = [];
    const admin = fakeRoutedAdminApi({
      "/servers/server-1/audit/mirror": { ok: true }
    }, calls);
    const connector = new FiveMRuntimeConnector({
      admin,
      emitter: {
        async emitServerEvent() {}
      },
      serverId: "server-1"
    });

    await expect(connector.syncRuntimeAudit()).resolves.toEqual({
      mirrored: true
    });
    expect(calls).toEqual(["POST /servers/server-1/audit/mirror"]);
  });

  it("plans one trusted menu refresh event per affected server", () => {
    expect(planMenuRefreshEvents([
      {
        serverId: "server-2",
        playerId: "player:3",
        sessionId: "session-3",
        cacheVersion: 9
      },
      {
        serverId: "server-1",
        playerId: "player:1",
        sessionId: "session-1",
        cacheVersion: 3
      },
      {
        serverId: "server-1",
        playerId: "player:2",
        sessionId: "session-2",
        cacheVersion: 4
      }
    ])).toEqual([
      {
        serverId: "server-1",
        eventName: "sdb_runtime:syncMenuRefresh",
        targets: [
          {
            serverId: "server-1",
            playerId: "player:1",
            sessionId: "session-1",
            cacheVersion: 3
          },
          {
            serverId: "server-1",
            playerId: "player:2",
            sessionId: "session-2",
            cacheVersion: 4
          }
        ]
      },
      {
        serverId: "server-2",
        eventName: "sdb_runtime:syncMenuRefresh",
        targets: [
          {
            serverId: "server-2",
            playerId: "player:3",
            sessionId: "session-3",
            cacheVersion: 9
          }
        ]
      }
    ]);
  });

  it("drains pending admin menu refresh targets and emits trusted FiveM refresh events", async () => {
    const calls: string[] = [];
    const emitted: Array<{ serverId: string; eventName: string; payload: unknown }> = [];
    const admin = fakeAdminApi([
      {
        serverId: "server-1",
        playerId: "player:1",
        sessionId: "session-1",
        cacheVersion: 3
      },
      {
        serverId: "server-1",
        playerId: "player:2",
        sessionId: "session-2",
        cacheVersion: 4
      }
    ], calls);
    const emitter: FiveMServerEventEmitter = {
      async emitServerEvent(serverId, eventName, payload) {
        emitted.push({ serverId, eventName, payload });
      }
    };
    const connector = new FiveMRuntimeConnector({
      admin,
      emitter,
      serverId: "server-1"
    });

    await expect(connector.flushMenuRefreshes()).resolves.toEqual({
      drainedTargets: [
        {
          serverId: "server-1",
          playerId: "player:1",
          sessionId: "session-1",
          cacheVersion: 3
        },
        {
          serverId: "server-1",
          playerId: "player:2",
          sessionId: "session-2",
          cacheVersion: 4
        }
      ],
      emittedEvents: [
        {
          serverId: "server-1",
          eventName: "sdb_runtime:syncMenuRefresh",
          targets: [
            {
              serverId: "server-1",
              playerId: "player:1",
              sessionId: "session-1",
              cacheVersion: 3
            },
            {
              serverId: "server-1",
              playerId: "player:2",
              sessionId: "session-2",
              cacheVersion: 4
            }
          ]
        }
      ]
    });
    expect(calls).toEqual(["POST /menus/refresh-targets/drain?serverId=server-1"]);
    expect(emitted).toEqual([
      {
        serverId: "server-1",
        eventName: "sdb_runtime:syncMenuRefresh",
        payload: {
          targets: [
            {
              serverId: "server-1",
              playerId: "player:1",
              sessionId: "session-1",
              cacheVersion: 3
            },
            {
              serverId: "server-1",
              playerId: "player:2",
              sessionId: "session-2",
              cacheVersion: 4
            }
          ]
        }
      }
    ]);
  });

  it("does not emit a FiveM refresh event when the admin queue is empty", async () => {
    const emitted: unknown[] = [];
    const connector = new FiveMRuntimeConnector({
      admin: fakeAdminApi([], []),
      emitter: {
        async emitServerEvent(...args) {
          emitted.push(args);
        }
      },
      serverId: "server-1"
    });

    await expect(connector.flushMenuRefreshes()).resolves.toEqual({
      drainedTargets: [],
      emittedEvents: []
    });
    expect(emitted).toEqual([]);
  });

  it("plans replicated state sync events grouped by server", () => {
    expect(planReplicatedStateEvents([
      {
        serverId: "server-2",
        key: "sdb:weather",
        value: "rain"
      },
      {
        serverId: "server-1",
        playerId: 42,
        key: "sdb:menu:dirty",
        value: true
      },
      {
        serverId: "server-1",
        key: "sdb:economy:enabled",
        value: false
      }
    ])).toEqual([
      {
        serverId: "server-1",
        eventName: "sdb_runtime:syncReplicatedState",
        updates: [
          {
            key: "sdb:economy:enabled",
            value: false
          },
          {
            playerId: 42,
            key: "sdb:menu:dirty",
            value: true
          }
        ]
      },
      {
        serverId: "server-2",
        eventName: "sdb_runtime:syncReplicatedState",
        updates: [
          {
            key: "sdb:weather",
            value: "rain"
          }
        ]
      }
    ]);
  });

  it("rejects authoritative replicated state updates before they reach FiveM", () => {
    expect(() => planReplicatedStateEvents([
      {
        serverId: "server-1",
        key: "sdb:authoritative",
        value: true,
        authoritative: true
      }
    ])).toThrow("authoritative state cannot be replicated");
  });

  it("drains replicated state hints and emits trusted FiveM state events", async () => {
    const calls: string[] = [];
    const emitted: Array<{ serverId: string; eventName: string; payload: unknown }> = [];
    const admin = fakeRoutedAdminApi({
      "/runtime/replicated-state/drain?serverId=server-1": [
        {
          serverId: "server-1",
          key: "sdb:economy:enabled",
          value: true
        },
        {
          serverId: "server-1",
          playerId: "player:1",
          key: "sdb:menu:dirty",
          value: true
        }
      ]
    }, calls);
    const connector = new FiveMRuntimeConnector({
      admin,
      emitter: {
        async emitServerEvent(serverId, eventName, payload) {
          emitted.push({ serverId, eventName, payload });
        }
      },
      serverId: "server-1"
    });

    await expect(connector.syncReplicatedState()).resolves.toEqual({
      drainedUpdates: [
        {
          serverId: "server-1",
          key: "sdb:economy:enabled",
          value: true
        },
        {
          serverId: "server-1",
          playerId: "player:1",
          key: "sdb:menu:dirty",
          value: true
        }
      ],
      emittedEvents: [
        {
          serverId: "server-1",
          eventName: "sdb_runtime:syncReplicatedState",
          updates: [
            {
              key: "sdb:economy:enabled",
              value: true
            },
            {
              playerId: "player:1",
              key: "sdb:menu:dirty",
              value: true
            }
          ]
        }
      ]
    });
    expect(calls).toEqual(["POST /runtime/replicated-state/drain?serverId=server-1"]);
    expect(emitted).toEqual([
      {
        serverId: "server-1",
        eventName: "sdb_runtime:syncReplicatedState",
        payload: {
          updates: [
            {
              key: "sdb:economy:enabled",
              value: true
            },
            {
              playerId: "player:1",
              key: "sdb:menu:dirty",
              value: true
            }
          ]
        }
      }
    ]);
  });

  it("plans trusted world-state sync events grouped by server", () => {
    expect(planWorldStateEvents([
      {
        serverId: "server-2",
        world: {
          weatherType: "RAIN"
        }
      },
      {
        serverId: "server-1",
        world: {
          weatherType: "EXTRASUNNY"
        }
      },
      {
        serverId: "server-1",
        world: {
          hour: 21,
          minute: 30
        }
      }
    ])).toEqual([
      {
        serverId: "server-1",
        eventName: "sdb_runtime:syncWorldState",
        world: {
          weatherType: "EXTRASUNNY",
          hour: 21,
          minute: 30
        }
      },
      {
        serverId: "server-2",
        eventName: "sdb_runtime:syncWorldState",
        world: {
          weatherType: "RAIN"
        }
      }
    ]);
  });

  it("drains world-state patches and emits trusted FiveM world sync events", async () => {
    const calls: string[] = [];
    const emitted: Array<{ serverId: string; eventName: string; payload: unknown }> = [];
    const admin = fakeRoutedAdminApi({
      "/runtime/world-state/drain?serverId=server-1": [
        {
          serverId: "server-1",
          world: {
            weatherType: "EXTRASUNNY"
          }
        },
        {
          serverId: "server-1",
          world: {
            hour: 21,
            minute: 30
          }
        }
      ]
    }, calls);
    const connector = new FiveMRuntimeConnector({
      admin,
      emitter: {
        async emitServerEvent(serverId, eventName, payload) {
          emitted.push({ serverId, eventName, payload });
        }
      },
      serverId: "server-1"
    });

    await expect(connector.syncWorldState()).resolves.toEqual({
      drainedUpdates: [
        {
          serverId: "server-1",
          world: {
            weatherType: "EXTRASUNNY"
          }
        },
        {
          serverId: "server-1",
          world: {
            hour: 21,
            minute: 30
          }
        }
      ],
      emittedEvents: [
        {
          serverId: "server-1",
          eventName: "sdb_runtime:syncWorldState",
          world: {
            weatherType: "EXTRASUNNY",
            hour: 21,
            minute: 30
          }
        }
      ]
    });
    expect(calls).toEqual(["POST /runtime/world-state/drain?serverId=server-1"]);
    expect(emitted).toEqual([
      {
        serverId: "server-1",
        eventName: "sdb_runtime:syncWorldState",
        payload: {
          world: {
            weatherType: "EXTRASUNNY",
            hour: 21,
            minute: 30
          }
        }
      }
    ]);
  });

  it("plans trusted vehicle spawn events grouped by server", () => {
    expect(planVehicleSpawnEvents([
      {
        serverId: "server-2",
        targetSource: 12,
        model: "flatbed",
        label: "Flatbed",
        category: "service",
        heading: 180
      },
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
    ])).toEqual([
      {
        serverId: "server-1",
        eventName: "sdb_runtime:spawnVehicles",
        spawns: [
          {
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
      },
      {
        serverId: "server-2",
        eventName: "sdb_runtime:spawnVehicles",
        spawns: [
          {
            targetSource: 12,
            model: "flatbed",
            label: "Flatbed",
            category: "service",
            heading: 180
          }
        ]
      }
    ]);
  });

  it("drains queued vehicle spawns and emits trusted FiveM spawn events", async () => {
    const calls: string[] = [];
    const emitted: Array<{ serverId: string; eventName: string; payload: unknown }> = [];
    const admin = fakeRoutedAdminApi({
      "/gameplay/vehicle-spawns/drain?serverId=server-1": [
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
    }, calls);
    const connector = new FiveMRuntimeConnector({
      admin,
      emitter: {
        async emitServerEvent(serverId, eventName, payload) {
          emitted.push({ serverId, eventName, payload });
        }
      },
      serverId: "server-1"
    });

    await expect(connector.syncVehicleSpawns()).resolves.toEqual({
      drainedSpawns: [
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
      ],
      emittedEvents: [
        {
          serverId: "server-1",
          eventName: "sdb_runtime:spawnVehicles",
          spawns: [
            {
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
        }
      ]
    });
    expect(calls).toEqual(["POST /gameplay/vehicle-spawns/drain?serverId=server-1"]);
    expect(emitted).toEqual([
      {
        serverId: "server-1",
        eventName: "sdb_runtime:spawnVehicles",
        payload: {
          spawns: [
            {
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
        }
      }
    ]);
  });

  it("plans trusted vehicle repair events per explicit player target", () => {
    expect(planVehicleRepairEvents([
      {
        serverId: "server-2",
        targetSource: 12,
        targetVehicleNetId: 55
      },
      {
        serverId: "server-1",
        targetSource: "7",
        targetVehicleNetId: 44
      }
    ])).toEqual([
      {
        serverId: "server-1",
        eventName: "sdb_runtime:repairVehicle",
        repairs: [
          {
            targetSource: "7",
            targetVehicleNetId: 44
          }
        ]
      },
      {
        serverId: "server-2",
        eventName: "sdb_runtime:repairVehicle",
        repairs: [
          {
            targetSource: 12,
            targetVehicleNetId: 55
          }
        ]
      }
    ]);
  });

  it("drains queued vehicle repairs and emits trusted FiveM repair events", async () => {
    const calls: string[] = [];
    const emitted: Array<{ serverId: string; eventName: string; payload: unknown }> = [];
    const admin = fakeRoutedAdminApi({
      "/gameplay/vehicle-repairs/drain?serverId=server-1": [
        {
          serverId: "server-1",
          targetSource: "7",
          targetVehicleNetId: 44
        }
      ]
    }, calls);
    const connector = new FiveMRuntimeConnector({
      admin,
      emitter: {
        async emitServerEvent(serverId, eventName, payload) {
          emitted.push({ serverId, eventName, payload });
        }
      },
      serverId: "server-1"
    });

    await expect(connector.syncVehicleRepairs()).resolves.toEqual({
      drainedRepairs: [
        {
          serverId: "server-1",
          targetSource: "7",
          targetVehicleNetId: 44
        }
      ],
      emittedEvents: [
        {
          serverId: "server-1",
          eventName: "sdb_runtime:repairVehicle",
          repairs: [
            {
              targetSource: "7",
              targetVehicleNetId: 44
            }
          ]
        }
      ]
    });
    expect(calls).toEqual(["POST /gameplay/vehicle-repairs/drain?serverId=server-1"]);
    expect(emitted).toEqual([
      {
        serverId: "server-1",
        eventName: "sdb_runtime:repairVehicle",
        payload: {
          repairs: [
            {
              targetSource: "7",
              targetVehicleNetId: 44
            }
          ]
        }
      }
    ]);
  });

  it("plans trusted teleport events per explicit player target", () => {
    expect(planTeleportEvents([
      {
        serverId: "server-2",
        targetSource: 12,
        x: 5,
        y: 6,
        z: 7
      },
      {
        serverId: "server-1",
        targetSource: "7",
        x: 100,
        y: 200,
        z: 30,
        heading: 90
      }
    ])).toEqual([
      {
        serverId: "server-1",
        eventName: "sdb_runtime:teleportPlayer",
        teleport: {
          targetSource: "7",
          x: 100,
          y: 200,
          z: 30,
          heading: 90
        }
      },
      {
        serverId: "server-2",
        eventName: "sdb_runtime:teleportPlayer",
        teleport: {
          targetSource: 12,
          x: 5,
          y: 6,
          z: 7
        }
      }
    ]);
  });

  it("drains queued teleports and emits trusted FiveM teleport events", async () => {
    const calls: string[] = [];
    const emitted: Array<{ serverId: string; eventName: string; payload: unknown }> = [];
    const admin = fakeRoutedAdminApi({
      "/gameplay/teleports/drain?serverId=server-1": [
        {
          serverId: "server-1",
          targetSource: "7",
          x: 100,
          y: 200,
          z: 30,
          heading: 90
        }
      ]
    }, calls);
    const connector = new FiveMRuntimeConnector({
      admin,
      emitter: {
        async emitServerEvent(serverId, eventName, payload) {
          emitted.push({ serverId, eventName, payload });
        }
      },
      serverId: "server-1"
    });

    await expect(connector.syncTeleports()).resolves.toEqual({
      drainedTeleports: [
        {
          serverId: "server-1",
          targetSource: "7",
          x: 100,
          y: 200,
          z: 30,
          heading: 90
        }
      ],
      emittedEvents: [
        {
          serverId: "server-1",
          eventName: "sdb_runtime:teleportPlayer",
          teleport: {
            targetSource: "7",
            x: 100,
            y: 200,
            z: 30,
            heading: 90
          }
        }
      ]
    });
    expect(calls).toEqual(["POST /gameplay/teleports/drain?serverId=server-1"]);
    expect(emitted).toEqual([
      {
        serverId: "server-1",
        eventName: "sdb_runtime:teleportPlayer",
        payload: {
          teleport: {
            targetSource: "7",
            x: 100,
            y: 200,
            z: 30,
            heading: 90
          }
        }
      }
    ]);
  });

  it("plans trusted kick events per explicit player target", () => {
    expect(planKickEvents([
      {
        serverId: "server-2",
        targetSource: 12,
        reason: "Staff decision"
      },
      {
        serverId: "server-1",
        targetSource: "7",
        reason: "Rule violation"
      }
    ])).toEqual([
      {
        serverId: "server-1",
        eventName: "sdb_runtime:kickPlayer",
        kick: {
          targetSource: "7",
          reason: "Rule violation"
        }
      },
      {
        serverId: "server-2",
        eventName: "sdb_runtime:kickPlayer",
        kick: {
          targetSource: 12,
          reason: "Staff decision"
        }
      }
    ]);
  });

  it("drains queued kicks and emits trusted FiveM kick events", async () => {
    const calls: string[] = [];
    const emitted: Array<{ serverId: string; eventName: string; payload: unknown }> = [];
    const admin = fakeRoutedAdminApi({
      "/gameplay/kicks/drain?serverId=server-1": [
        {
          serverId: "server-1",
          targetSource: "7",
          reason: "Rule violation"
        }
      ]
    }, calls);
    const connector = new FiveMRuntimeConnector({
      admin,
      emitter: {
        async emitServerEvent(serverId, eventName, payload) {
          emitted.push({ serverId, eventName, payload });
        }
      },
      serverId: "server-1"
    });

    await expect(connector.syncKicks()).resolves.toEqual({
      drainedKicks: [
        {
          serverId: "server-1",
          targetSource: "7",
          reason: "Rule violation"
        }
      ],
      emittedEvents: [
        {
          serverId: "server-1",
          eventName: "sdb_runtime:kickPlayer",
          kick: {
            targetSource: "7",
            reason: "Rule violation"
          }
        }
      ]
    });
    expect(calls).toEqual(["POST /gameplay/kicks/drain?serverId=server-1"]);
    expect(emitted).toEqual([
      {
        serverId: "server-1",
        eventName: "sdb_runtime:kickPlayer",
        payload: {
          kick: {
            targetSource: "7",
            reason: "Rule violation"
          }
        }
      }
    ]);
  });

  it("plans permission-filtered menu tree sync events for native principals", () => {
    expect(planMenuTreeEvents({
      registry: {
        definitions: [
          {
            id: "root",
            pluginId: "admin_tools",
            label: "Admin",
            parentId: "",
            icon: "shield",
            order: 0,
            requiredPermission: "",
            actionId: "",
            enabled: true,
            visibilityPolicyId: ""
          },
          {
            id: "repair",
            pluginId: "admin_tools",
            label: "Repair Vehicle",
            parentId: "root",
            icon: "wrench",
            order: 1,
            requiredPermission: "menu.vehicle.repair",
            actionId: "vehicle.repair",
            enabled: true,
            visibilityPolicyId: ""
          },
          {
            id: "give-money",
            pluginId: "economy_core",
            label: "Give Money",
            parentId: "root",
            icon: "banknote",
            order: 2,
            requiredPermission: "economy.give_money",
            actionId: "economy.give_money",
            enabled: true,
            visibilityPolicyId: ""
          }
        ],
        actions: [
          {
            id: "vehicle.repair",
            pluginId: "admin_tools",
            actionType: "runtime_action",
            reducerName: "repair_vehicle",
            payloadSchemaJson: "",
            confirmationRequired: false,
            auditLevel: "standard",
            requiredPermission: "menu.vehicle.repair",
            enabled: true
          }
        ],
        commands: [],
        panels: [],
        policies: [],
        sessions: []
      },
      permissions: {
        permissions: [
          {
            id: "perm.repair",
            key: "menu.vehicle.repair",
            description: "Repair vehicles",
            pluginId: "admin_tools"
          }
        ],
        principals: [
          {
            id: "player:1",
            type: "player",
            externalId: "license:abc",
            name: "Ada"
          }
        ],
        edges: [],
        grants: [
          {
            principalId: "player:1",
            permissionKey: "menu.vehicle.repair",
            effect: "allow",
            source: "manual"
          }
        ],
        policies: [],
        aceMirrorRules: []
      }
    })).toEqual([
      {
        eventName: "sdb_runtime:syncMenuTree",
        principalId: "player:1",
        tree: [
          {
            id: "root",
            pluginId: "admin_tools",
            label: "Admin",
            order: 0,
            icon: "shield",
            children: [
              {
                id: "repair",
                pluginId: "admin_tools",
                label: "Repair Vehicle",
                order: 1,
                icon: "wrench",
                requiredPermission: "menu.vehicle.repair",
                actionId: "vehicle.repair",
                children: []
              }
            ]
          }
        ]
      }
    ]);
  });

  it("reads admin menus and permissions and emits only changed menu trees", async () => {
    const calls: string[] = [];
    const emitted: Array<{ serverId: string; eventName: string; payload: unknown }> = [];
    const admin = fakeRoutedAdminApi({
      "/menus": {
        definitions: [
          {
            id: "root",
            pluginId: "admin_tools",
            label: "Admin",
            parentId: "",
            icon: "shield",
            order: 0,
            requiredPermission: "",
            actionId: "",
            enabled: true,
            visibilityPolicyId: ""
          },
          {
            id: "repair",
            pluginId: "admin_tools",
            label: "Repair Vehicle",
            parentId: "root",
            icon: "wrench",
            order: 1,
            requiredPermission: "menu.vehicle.repair",
            actionId: "vehicle.repair",
            enabled: true,
            visibilityPolicyId: ""
          }
        ],
        actions: [
          {
            id: "vehicle.repair",
            pluginId: "admin_tools",
            actionType: "runtime_action",
            reducerName: "repair_vehicle",
            payloadSchemaJson: "",
            confirmationRequired: false,
            auditLevel: "standard",
            requiredPermission: "menu.vehicle.repair",
            enabled: true
          }
        ],
        commands: [],
        panels: [],
        policies: [],
        sessions: []
      },
      "/permissions": {
        permissions: [
          {
            id: "perm.repair",
            key: "menu.vehicle.repair",
            description: "Repair vehicles",
            pluginId: "admin_tools"
          }
        ],
        principals: [
          {
            id: "player:1",
            type: "player",
            externalId: "license:abc",
            name: "Ada"
          }
        ],
        edges: [],
        grants: [
          {
            principalId: "player:1",
            permissionKey: "menu.vehicle.repair",
            effect: "allow",
            source: "manual"
          }
        ],
        policies: [],
        aceMirrorRules: []
      }
    }, calls);
    const connector = new FiveMRuntimeConnector({
      admin,
      emitter: {
        async emitServerEvent(serverId, eventName, payload) {
          emitted.push({ serverId, eventName, payload });
        }
      },
      serverId: "server-1"
    });

    await expect(connector.syncMenuTrees()).resolves.toEqual({
      emittedEvents: [
        {
          eventName: "sdb_runtime:syncMenuTree",
          principalId: "player:1",
          tree: [
            {
              id: "root",
              pluginId: "admin_tools",
              label: "Admin",
              order: 0,
              icon: "shield",
              children: [
                {
                  id: "repair",
                  pluginId: "admin_tools",
                  label: "Repair Vehicle",
                  order: 1,
                  icon: "wrench",
                  requiredPermission: "menu.vehicle.repair",
                  actionId: "vehicle.repair",
                  children: []
                }
              ]
            }
          ]
        }
      ]
    });
    await expect(connector.syncMenuTrees()).resolves.toEqual({
      emittedEvents: []
    });
    expect(calls).toEqual(["GET /menus", "GET /permissions", "GET /menus", "GET /permissions"]);
    expect(emitted).toEqual([
      {
        serverId: "server-1",
        eventName: "sdb_runtime:syncMenuTree",
        payload: {
          principalId: "player:1",
          tree: [
            {
              id: "root",
              pluginId: "admin_tools",
              label: "Admin",
              order: 0,
              icon: "shield",
              children: [
                {
                  id: "repair",
                  pluginId: "admin_tools",
                  label: "Repair Vehicle",
                  order: 1,
                  icon: "wrench",
                  requiredPermission: "menu.vehicle.repair",
                  actionId: "vehicle.repair",
                  children: []
                }
              ]
            }
          ]
        }
      }
    ]);
  });

  it("plans trusted config sync events grouped by namespace", () => {
    expect(planRuntimeConfigEvents([
      {
        id: "server-1:economy:enabled",
        serverId: "server-1",
        namespace: "economy",
        key: "enabled",
        value: true,
        version: 2,
        updatedAt: new Date("2026-05-19T00:00:00.000Z")
      },
      {
        id: "server-1:features:weather",
        serverId: "server-1",
        namespace: "features",
        key: "weather",
        value: "dynamic",
        version: 1,
        updatedAt: new Date("2026-05-19T00:00:00.000Z")
      },
      {
        id: "server-1:economy:taxRate",
        serverId: "server-1",
        namespace: "economy",
        key: "taxRate",
        value: 0.08,
        version: 3,
        updatedAt: new Date("2026-05-19T00:00:00.000Z")
      }
    ])).toEqual([
      {
        eventName: "sdb_runtime:syncConfig",
        namespace: "economy",
        values: {
          enabled: true,
          taxRate: 0.08
        },
        versions: {
          enabled: 2,
          taxRate: 3
        }
      },
      {
        eventName: "sdb_runtime:syncConfig",
        namespace: "features",
        values: {
          weather: "dynamic"
        },
        versions: {
          weather: 1
        }
      }
    ]);
  });

  it("reads admin dashboard config and emits only changed FiveM config namespaces", async () => {
    const calls: string[] = [];
    const emitted: Array<{ serverId: string; eventName: string; payload: unknown }> = [];
    const admin = fakeAdminApi({
      health: {},
      plugins: [],
      auditLogs: [],
      config: [
        {
          id: "server-1:economy:enabled",
          serverId: "server-1",
          namespace: "economy",
          key: "enabled",
          value: true,
          version: 1,
          updatedAt: new Date("2026-05-19T00:00:00.000Z")
        },
        {
          id: "server-1:features:weather",
          serverId: "server-1",
          namespace: "features",
          key: "weather",
          value: "dynamic",
          version: 1,
          updatedAt: new Date("2026-05-19T00:00:00.000Z")
        }
      ]
    }, calls);
    const connector = new FiveMRuntimeConnector({
      admin,
      emitter: {
        async emitServerEvent(serverId, eventName, payload) {
          emitted.push({ serverId, eventName, payload });
        }
      },
      serverId: "server-1"
    });

    await expect(connector.syncRuntimeConfig()).resolves.toEqual({
      emittedEvents: [
        {
          eventName: "sdb_runtime:syncConfig",
          namespace: "economy",
          values: { enabled: true },
          versions: { enabled: 1 }
        },
        {
          eventName: "sdb_runtime:syncConfig",
          namespace: "features",
          values: { weather: "dynamic" },
          versions: { weather: 1 }
        }
      ]
    });
    await expect(connector.syncRuntimeConfig()).resolves.toEqual({
      emittedEvents: []
    });
    expect(calls).toEqual([
      "GET /servers/server-1/dashboard",
      "GET /servers/server-1/dashboard"
    ]);
    expect(emitted).toEqual([
      {
        serverId: "server-1",
        eventName: "sdb_runtime:syncConfig",
        payload: {
          namespace: "economy",
          values: { enabled: true },
          versions: { enabled: 1 }
        }
      },
      {
        serverId: "server-1",
        eventName: "sdb_runtime:syncConfig",
        payload: {
          namespace: "features",
          values: { weather: "dynamic" },
          versions: { weather: 1 }
        }
      }
    ]);
  });

  it("plans a trusted runtime health sync event from dashboard health", () => {
    expect(planRuntimeHealthEvent({
      serverId: "server-1",
      serverName: "Roleplay Dev",
      environment: "development",
      status: "online",
      reason: "runtime heartbeat current",
      resourceVersion: "0.1.0",
      fxserverBuild: "7290",
      gameBuild: "2944",
      lastHeartbeatAt: new Date("2026-05-19T00:00:00.000Z"),
      lastSeenAt: new Date("2026-05-19T00:00:01.000Z")
    })).toEqual({
      eventName: "sdb_runtime:syncHealth",
      health: {
        serverId: "server-1",
        serverName: "Roleplay Dev",
        environment: "development",
        status: "online",
        reason: "runtime heartbeat current",
        resourceVersion: "0.1.0",
        fxserverBuild: "7290",
        gameBuild: "2944",
        lastHeartbeatAt: "2026-05-19T00:00:00.000Z",
        lastSeenAt: "2026-05-19T00:00:01.000Z"
      }
    });
  });

  it("reads admin dashboard health and emits only changed FiveM health cache", async () => {
    const calls: string[] = [];
    const emitted: Array<{ serverId: string; eventName: string; payload: unknown }> = [];
    const admin = fakeAdminApi({
      health: {
        serverId: "server-1",
        serverName: "Roleplay Dev",
        environment: "development",
        status: "online",
        reason: "runtime heartbeat current",
        resourceVersion: "0.1.0",
        fxserverBuild: "7290",
        gameBuild: "2944",
        lastHeartbeatAt: new Date("2026-05-19T00:00:00.000Z"),
        lastSeenAt: new Date("2026-05-19T00:00:01.000Z")
      },
      plugins: [],
      auditLogs: [],
      config: []
    }, calls);
    const connector = new FiveMRuntimeConnector({
      admin,
      emitter: {
        async emitServerEvent(serverId, eventName, payload) {
          emitted.push({ serverId, eventName, payload });
        }
      },
      serverId: "server-1"
    });

    await expect(connector.syncRuntimeHealth()).resolves.toEqual({
      emittedEvent: {
        eventName: "sdb_runtime:syncHealth",
        health: {
          serverId: "server-1",
          serverName: "Roleplay Dev",
          environment: "development",
          status: "online",
          reason: "runtime heartbeat current",
          resourceVersion: "0.1.0",
          fxserverBuild: "7290",
          gameBuild: "2944",
          lastHeartbeatAt: "2026-05-19T00:00:00.000Z",
          lastSeenAt: "2026-05-19T00:00:01.000Z"
        }
      }
    });
    await expect(connector.syncRuntimeHealth()).resolves.toEqual({
      emittedEvent: undefined
    });
    expect(calls).toEqual([
      "GET /servers/server-1/dashboard",
      "GET /servers/server-1/dashboard"
    ]);
    expect(emitted).toEqual([
      {
        serverId: "server-1",
        eventName: "sdb_runtime:syncHealth",
        payload: {
          health: {
            serverId: "server-1",
            serverName: "Roleplay Dev",
            environment: "development",
            status: "online",
            reason: "runtime heartbeat current",
            resourceVersion: "0.1.0",
            fxserverBuild: "7290",
            gameBuild: "2944",
            lastHeartbeatAt: "2026-05-19T00:00:00.000Z",
            lastSeenAt: "2026-05-19T00:00:01.000Z"
          }
        }
      }
    ]);
  });

  it("plans a trusted ACE mirror event from permission snapshot changes", () => {
    expect(planAceMirrorEvent({
      current: {
        aces: [],
        principals: []
      },
      desired: {
        edges: [
          {
            childPrincipalId: "identifier.license:abc",
            parentPrincipalId: "group.admin",
            source: "manual"
          }
        ],
        grants: [
          {
            principalId: "group.admin",
            permissionKey: "menu.vehicle.repair",
            effect: "allow",
            source: "manual"
          }
        ],
        rules: [
          {
            permissionKey: "menu.vehicle.repair",
            aceObject: "sdb.menu.vehicle.repair",
            enabled: true,
            mode: "allow_only"
          }
        ]
      }
    })).toEqual({
      eventName: "sdb_runtime:applyAceMirror",
      commands: [
        "add_ace group.admin sdb.menu.vehicle.repair allow",
        "add_principal identifier.license:abc group.admin"
      ],
      desired: {
        aces: [
          {
            principalId: "group.admin",
            aceObject: "sdb.menu.vehicle.repair",
            effect: "allow"
          }
        ],
        principals: [
          {
            childPrincipalId: "identifier.license:abc",
            parentPrincipalId: "group.admin"
          }
        ]
      }
    });
  });

  it("does not mirror expired permission grants or principal edges into ACE", () => {
    expect(planAceMirrorEvent({
      current: {
        aces: [],
        principals: []
      },
      desired: {
        edges: [
          {
            childPrincipalId: "identifier.license:abc",
            parentPrincipalId: "group.admin",
            source: "manual",
            expiresAt: new Date("2026-05-17T00:00:00.000Z")
          }
        ],
        grants: [
          {
            principalId: "group.admin",
            permissionKey: "menu.vehicle.repair",
            effect: "allow",
            source: "manual",
            expiresAt: new Date("2026-05-17T00:00:00.000Z")
          }
        ],
        rules: [
          {
            permissionKey: "menu.vehicle.repair",
            aceObject: "sdb.menu.vehicle.repair",
            enabled: true,
            mode: "allow_only"
          }
        ]
      }
    })).toEqual({
      eventName: "sdb_runtime:applyAceMirror",
      commands: [],
      desired: {
        aces: [],
        principals: []
      }
    });
  });

  it("fetches admin permissions and emits ACE mirror commands once per desired state", async () => {
    const calls: string[] = [];
    const emitted: Array<{ serverId: string; eventName: string; payload: unknown }> = [];
    const admin = fakeAdminApi({
      permissions: [],
      principals: [],
      edges: [
        {
          childPrincipalId: "identifier.license:abc",
          parentPrincipalId: "group.admin",
          source: "manual"
        }
      ],
      grants: [
        {
          principalId: "group.admin",
          permissionKey: "menu.vehicle.repair",
          effect: "allow",
          source: "manual"
        }
      ],
      policies: [],
      aceMirrorRules: [
        {
          permissionKey: "menu.vehicle.repair",
          aceObject: "sdb.menu.vehicle.repair",
          enabled: true,
          mode: "allow_only"
        }
      ]
    }, calls);
    const connector = new FiveMRuntimeConnector({
      admin,
      emitter: {
        async emitServerEvent(serverId, eventName, payload) {
          emitted.push({ serverId, eventName, payload });
        }
      },
      serverId: "server-1"
    });

    await expect(connector.syncAceMirror()).resolves.toEqual({
      commands: [
        "add_ace group.admin sdb.menu.vehicle.repair allow",
        "add_principal identifier.license:abc group.admin"
      ],
      emitted: true
    });
    await expect(connector.syncAceMirror()).resolves.toEqual({
      commands: [],
      emitted: false
    });
    expect(calls).toEqual(["GET /permissions", "GET /permissions"]);
    expect(emitted).toEqual([
      {
        serverId: "server-1",
        eventName: "sdb_runtime:applyAceMirror",
        payload: {
          commands: [
            "add_ace group.admin sdb.menu.vehicle.repair allow",
            "add_principal identifier.license:abc group.admin"
          ]
        }
      }
    ]);
  });

  it("plans native permission sync events with inherited grants and deny overrides", () => {
    expect(planNativePermissionEvents({
      permissions: [
        {
          id: "perm.repair",
          key: "menu.vehicle.repair",
          description: "Repair vehicles",
          pluginId: "admin_tools"
        },
        {
          id: "perm.give_money",
          key: "economy.give_money",
          description: "Give money",
          pluginId: "economy_core"
        }
      ],
      principals: [
        {
          id: "player:1",
          type: "player",
          externalId: "license:abc",
          name: "Ada"
        },
        {
          id: "group.staff",
          type: "group",
          externalId: "staff",
          name: "Staff"
        }
      ],
      edges: [
        {
          parentPrincipalId: "group.staff",
          childPrincipalId: "player:1",
          source: "manual"
        }
      ],
      grants: [
        {
          principalId: "group.staff",
          permissionKey: "menu.vehicle.repair",
          effect: "allow",
          source: "manual"
        },
        {
          principalId: "player:1",
          permissionKey: "economy.give_money",
          effect: "deny",
          source: "manual"
        }
      ],
      policies: [],
      aceMirrorRules: []
    })).toEqual([
      {
        eventName: "sdb_runtime:syncPermissions",
        principalId: "group.staff",
        permissions: {
          "menu.vehicle.repair": true
        }
      },
      {
        eventName: "sdb_runtime:syncPermissions",
        principalId: "player:1",
        permissions: {
          "menu.vehicle.repair": true
        }
      }
    ]);
  });

  it("fetches admin permissions and emits only changed native permission caches", async () => {
    const calls: string[] = [];
    const emitted: Array<{ serverId: string; eventName: string; payload: unknown }> = [];
    const admin = fakeAdminApi({
      permissions: [
        {
          id: "perm.repair",
          key: "menu.vehicle.repair",
          description: "Repair vehicles",
          pluginId: "admin_tools"
        }
      ],
      principals: [
        {
          id: "player:1",
          type: "player",
          externalId: "license:abc",
          name: "Ada"
        }
      ],
      edges: [],
      grants: [
        {
          principalId: "player:1",
          permissionKey: "menu.vehicle.repair",
          effect: "allow",
          source: "manual"
        }
      ],
      policies: [],
      aceMirrorRules: []
    }, calls);
    const connector = new FiveMRuntimeConnector({
      admin,
      emitter: {
        async emitServerEvent(serverId, eventName, payload) {
          emitted.push({ serverId, eventName, payload });
        }
      },
      serverId: "server-1"
    });

    await expect(connector.syncNativePermissions()).resolves.toEqual({
      emittedEvents: [
        {
          eventName: "sdb_runtime:syncPermissions",
          principalId: "player:1",
          permissions: {
            "menu.vehicle.repair": true
          }
        }
      ]
    });
    await expect(connector.syncNativePermissions()).resolves.toEqual({
      emittedEvents: []
    });
    expect(calls).toEqual(["GET /permissions", "GET /permissions"]);
    expect(emitted).toEqual([
      {
        serverId: "server-1",
        eventName: "sdb_runtime:syncPermissions",
        payload: {
          principalId: "player:1",
          permissions: {
            "menu.vehicle.repair": true
          }
        }
      }
    ]);
  });
});

function fakeAdminApi(body: unknown, calls: string[]): AdminHttpApi {
  return {
    async handle(request) {
      calls.push(`${request.method} ${request.path}`);
      return {
        status: 200,
        body
      };
    }
  };
}

function fakeRoutedAdminApi(routes: Record<string, unknown>, calls: string[]): AdminHttpApi {
  return {
    async handle(request) {
      calls.push(`${request.method} ${request.path}`);
      const body = routes[request.path];
      if (body === undefined) {
        return {
          status: 404,
          body: { error: "Not found" }
        };
      }

      return {
        status: 200,
        body
      };
    }
  };
}
