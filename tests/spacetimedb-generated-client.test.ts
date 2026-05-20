import { describe, expect, it } from "vitest";
import {
  GeneratedSpacetimeClient,
  type GeneratedDbConnection,
  type GeneratedTableHandle,
  type GeneratedSubscriptionBuilder
} from "../src/spacetime/adapter.js";

class FakeTableHandle<Row> {
  public insertCallback?: (ctx: unknown, row: Row) => void;
  public updateCallback?: (ctx: unknown, oldRow: Row, newRow: Row) => void;

  public constructor(private readonly rows: Row[]) {}

  public iter(): Iterable<Row> {
    return this.rows;
  }

  public onInsert(callback: (ctx: unknown, row: Row) => void): void {
    this.insertCallback = callback;
  }

  public onUpdate(callback: (ctx: unknown, oldRow: Row, newRow: Row) => void): void {
    this.updateCallback = callback;
  }
}

class FakeSubscriptionBuilder implements GeneratedSubscriptionBuilder {
  public constructor(
    private applied: () => void,
    private readonly subscribedQueries: unknown[]
  ) {}

  public onApplied(callback: () => void): this {
    this.applied = callback;
    return this;
  }

  public onError(): this {
    return this;
  }

  public subscribe(queries: unknown[]): void {
    this.subscribedQueries.push(...queries);
    this.applied();
  }
}

class FakeConnection implements GeneratedDbConnection {
  public readonly runtimeConfig = new FakeTableHandle([
    {
      id: "config:server-1:economy:enabled",
      server_id: "server-1",
      namespace: "economy",
      key: "enabled",
      value_json: "true",
      version: 1,
      updated_at: "2026-05-18T12:00:00.000Z"
    }
  ]);
  public readonly subscribedQueries: unknown[] = [];
  public readonly reducerCalls: Array<{ name: string; args: unknown[] }> = [];

  public readonly db: Record<string, GeneratedTableHandle<unknown> | undefined>;

  public constructor(options: { snakeCaseDb?: boolean } = {}) {
    this.db = options.snakeCaseDb
      ? { runtime_config: this.runtimeConfig }
      : { runtimeConfig: this.runtimeConfig };
  }

  public readonly reducers = {
    heartbeat: (...args: unknown[]) => {
      this.reducerCalls.push({ name: "heartbeat", args });
    },
    addPrincipalEdge: (...args: unknown[]) => {
      this.reducerCalls.push({ name: "addPrincipalEdge", args });
    },
    removePrincipalEdge: (...args: unknown[]) => {
      this.reducerCalls.push({ name: "removePrincipalEdge", args });
    },
    grantPermission: (...args: unknown[]) => {
      this.reducerCalls.push({ name: "grantPermission", args });
    },
    setRuntimeConfig: (...args: unknown[]) => {
      this.reducerCalls.push({ name: "setRuntimeConfig", args });
    },
    upsertRuntimeCommand: (...args: unknown[]) => {
      this.reducerCalls.push({ name: "upsertRuntimeCommand", args });
    },
    upsertRuntimePanel: (...args: unknown[]) => {
      this.reducerCalls.push({ name: "upsertRuntimePanel", args });
    },
    submitAction: (...args: unknown[]) => {
      this.reducerCalls.push({ name: "submitAction", args });
    },
    completeAction: (...args: unknown[]) => {
      this.reducerCalls.push({ name: "completeAction", args });
    },
    writeAuditLog: (...args: unknown[]) => {
      this.reducerCalls.push({ name: "writeAuditLog", args });
    },
    revokePluginBundle: (...args: unknown[]) => {
      this.reducerCalls.push({ name: "revokePluginBundle", args });
    },
    issueInvoice: (...args: unknown[]) => {
      this.reducerCalls.push({ name: "issueInvoice", args });
    },
    payInvoice: (...args: unknown[]) => {
      this.reducerCalls.push({ name: "payInvoice", args });
    },
    buyItem: (...args: unknown[]) => {
      this.reducerCalls.push({ name: "buyItem", args });
    },
    sellItem: (...args: unknown[]) => {
      this.reducerCalls.push({ name: "sellItem", args });
    }
  };

  public subscriptionBuilder(): GeneratedSubscriptionBuilder {
    return new FakeSubscriptionBuilder(() => {}, this.subscribedQueries);
  }
}

class FakeBuilder {
  public uri?: string;
  public databaseName?: string;
  public token?: string;
  public confirmedReads?: boolean;
  private connectCallback?: (connection: GeneratedDbConnection, identity: string, token: string) => void;

  public constructor(private readonly connection: FakeConnection) {}

  public withUri(uri: string): this {
    this.uri = uri;
    return this;
  }

  public withDatabaseName(databaseName: string): this {
    this.databaseName = databaseName;
    return this;
  }

  public withToken(token?: string): this {
    this.token = token;
    return this;
  }

  public withConfirmedReads(confirmedReads: boolean): this {
    this.confirmedReads = confirmedReads;
    return this;
  }

  public onConnect(callback: (connection: GeneratedDbConnection, identity: string, token: string) => void): this {
    this.connectCallback = callback;
    return this;
  }

  public onConnectError(): this {
    return this;
  }

  public build(): FakeConnection {
    this.connectCallback?.(this.connection, "identity", "issued-token");
    return this.connection;
  }
}

describe("GeneratedSpacetimeClient", () => {
  it("builds a real generated connection with uri, database name, token, and confirmed reads", async () => {
    const connection = new FakeConnection();
    const builder = new FakeBuilder(connection);
    const client = new GeneratedSpacetimeClient({
      uri: "wss://spacetime.example",
      databaseName: "sdb_runtime",
      token: "admin-token",
      confirmedReads: true,
      bindings: {
        DbConnection: { builder: () => builder },
        tables: { runtimeConfig: Symbol("runtimeConfig") }
      }
    });

    await client.connect();

    expect(builder.uri).toBe("wss://spacetime.example");
    expect(builder.databaseName).toBe("sdb_runtime");
    expect(builder.token).toBe("admin-token");
    expect(builder.confirmedReads).toBe(true);
  });

  it("subscribes through generated table refs and normalizes generated rows", async () => {
    const connection = new FakeConnection();
    const tableRef = Symbol("runtimeConfig");
    const client = new GeneratedSpacetimeClient({
      uri: "ws://localhost:3000",
      databaseName: "sdb_runtime",
      bindings: {
        DbConnection: { builder: () => new FakeBuilder(connection) },
        tables: { runtimeConfig: tableRef }
      }
    });
    const updates: unknown[] = [];

    await client.connect();
    const rows = await client.subscribe("runtime_config", (row) => updates.push(row));

    expect(connection.subscribedQueries).toEqual([tableRef]);
    expect(rows).toEqual([
      {
        id: "config:server-1:economy:enabled",
        serverId: "server-1",
        namespace: "economy",
        key: "enabled",
        value: true,
        version: 1,
        updatedAt: new Date("2026-05-18T12:00:00.000Z")
      }
    ]);

    connection.runtimeConfig.insertCallback?.({}, {
      id: "config:server-1:economy:enabled",
      server_id: "server-1",
      namespace: "economy",
      key: "enabled",
      value_json: "false",
      version: 2,
      updated_at: "2026-05-18T12:01:00.000Z"
    });

    expect(updates).toEqual([
      {
        id: "config:server-1:economy:enabled",
        serverId: "server-1",
        namespace: "economy",
        key: "enabled",
        value: false,
        version: 2,
        updatedAt: new Date("2026-05-18T12:01:00.000Z")
      }
    ]);
  });

  it("subscribes through snake_case generated db handles", async () => {
    const connection = new FakeConnection({ snakeCaseDb: true });
    const tableRef = Symbol("runtimeConfig");
    const client = new GeneratedSpacetimeClient({
      uri: "ws://localhost:3000",
      databaseName: "sdb_runtime",
      bindings: {
        DbConnection: { builder: () => new FakeBuilder(connection) },
        tables: { runtime_config: tableRef }
      }
    });

    await client.connect();
    const rows = await client.subscribe("runtime_config", () => {});

    expect(connection.subscribedQueries).toEqual([tableRef]);
    expect(rows[0]?.id).toBe("config:server-1:economy:enabled");
  });

  it("invokes generated reducer methods with SpacetimeDB module argument order", async () => {
    const connection = new FakeConnection();
    const ids = ["heartbeat-1", "action-1"];
    const client = new GeneratedSpacetimeClient({
      uri: "ws://localhost:3000",
      databaseName: "sdb_runtime",
      idFactory: () => ids.shift() ?? "fallback-id",
      bindings: {
        DbConnection: { builder: () => new FakeBuilder(connection) },
        tables: { runtimeConfig: Symbol("runtimeConfig") }
      }
    });

    await client.connect();
    await client.callReducer("heartbeat", {
      serverId: "server-1",
      resourceVersion: "0.1.0",
      fxserverBuild: "7290",
      gameBuild: "3095",
      nonce: "heartbeat-nonce-1",
      signature: "heartbeat-signature-1"
    });
    await client.callReducer("set_runtime_config", {
      serverId: "server-1",
      namespace: "economy",
      key: "enabled",
      value: true
    });
    await client.callReducer("upsert_runtime_command", {
      id: "command:vehicle.repair",
      pluginId: "admin_tools",
      name: "sdb_repair",
      aliasesJson: "[\"repairveh\"]",
      actionId: "action:vehicle.repair",
      requiredPermission: "command.vehicle.repair",
      payloadSchemaJson: "{\"type\":\"object\"}",
      auditLevel: "standard",
      enabled: true
    });
    await client.callReducer("upsert_runtime_panel", {
      id: "panel:mechanic.work_orders",
      pluginId: "mechanic_core",
      title: "Work Orders",
      route: "/plugins/mechanic/work-orders",
      requiredPermission: "mechanic.repair",
      icon: "clipboard-list",
      order: 20,
      enabled: true
    });
    await client.callReducer("submit_action", {
      serverId: "server-1",
      actorId: "player:1",
      actionType: "vehicle.repair",
      payload: { netId: 10 },
      nonce: "nonce-1",
      idempotencyKey: "repair-10"
    });
    await client.callReducer("add_principal_edge", {
      id: "edge-1",
      parentPrincipalId: "group.admin",
      childPrincipalId: "discord:guild-1:user-1:role-admin",
      source: "discord:guild-1",
      expiresAt: new Date("2026-05-18T14:00:00.000Z")
    });
    await client.callReducer("remove_principal_edge", {
      edgeId: "edge-1"
    });
    await client.callReducer("grant_permission", {
      id: "grant-1",
      principalId: "player:1",
      permissionKey: "menu.vehicle.repair",
      effect: "allow",
      source: "temp",
      expiresAt: new Date("2026-05-18T14:00:00.000Z")
    });
    await client.callReducer("complete_action", {
      actionId: "action-1",
      status: "completed"
    });
    await client.callReducer("write_audit_log", {
      id: "audit-1",
      serverId: "server-1",
      actorId: "player:1",
      pluginId: "admin_tools",
      actionType: "vehicle.repair",
      permissionKey: "admin.vehicles.repair",
      targetType: "vehicle",
      targetId: "net:10",
      beforeJson: "{}",
      afterJson: "{\"repaired\":true}",
      status: "succeeded"
    });
    await client.callReducer("revoke_plugin_bundle", {
      bundleId: "bundle-1",
      status: "revoked",
      actorId: "owner:2",
      reason: "bad release"
    });
    await client.callReducer("issue_invoice", {
      id: "invoice:repair-1",
      issuerAccountId: "acct:mechanic",
      payerAccountId: "acct:customer",
      amount: 300,
      currency: "cash",
      reason: "repair",
      issuedBy: "player:mechanic",
      idempotencyKey: "issue-invoice-1",
      dueAt: new Date("2026-05-25T12:00:00.000Z")
    });
    await client.callReducer("pay_invoice", {
      transactionId: "tx:invoice-payment-1",
      actorId: "player:customer",
      invoiceId: "invoice:repair-1",
      idempotencyKey: "pay-invoice-1"
    });
    await client.callReducer("buy_item", {
      transactionId: "tx:buy-1",
      actorId: "player:buyer",
      buyerAccountId: "acct:buyer",
      sellerAccountId: "acct:shop",
      amount: 75,
      itemKey: "repair_kit",
      quantity: 3,
      idempotencyKey: "buy-1"
    });
    await client.callReducer("sell_item", {
      transactionId: "tx:sell-1",
      actorId: "player:seller",
      sellerAccountId: "acct:seller",
      buyerAccountId: "acct:shop",
      amount: 25,
      itemKey: "scrap_metal",
      quantity: 5,
      idempotencyKey: "sell-1"
    });

    expect(connection.reducerCalls[0]).toEqual({
      name: "heartbeat",
      args: [
        "heartbeat-1",
        "server-1",
        "0.1.0",
        "7290",
        "3095",
        "heartbeat-nonce-1",
        "heartbeat-signature-1"
      ]
    });
    expect(connection.reducerCalls[1]).toEqual({
      name: "setRuntimeConfig",
      args: ["config:server-1:economy:enabled", "server-1", "economy", "enabled", "true", 1]
    });
    expect(connection.reducerCalls[2]).toEqual({
      name: "upsertRuntimeCommand",
      args: [
        "command:vehicle.repair",
        "admin_tools",
        "sdb_repair",
        "[\"repairveh\"]",
        "action:vehicle.repair",
        "command.vehicle.repair",
        "{\"type\":\"object\"}",
        "standard",
        true
      ]
    });
    expect(connection.reducerCalls[3]).toEqual({
      name: "upsertRuntimePanel",
      args: [
        "panel:mechanic.work_orders",
        "mechanic_core",
        "Work Orders",
        "/plugins/mechanic/work-orders",
        "mechanic.repair",
        "clipboard-list",
        20,
        true
      ]
    });
    expect(connection.reducerCalls[4]?.name).toBe("submitAction");
    expect(connection.reducerCalls[4]?.args).toEqual([
      "action-1",
      "server-1",
      "player:1",
      "vehicle.repair",
      expect.stringMatching(/^[a-f0-9]{64}$/),
      "",
      "nonce-1",
      "repair-10"
    ]);
    expect(connection.reducerCalls[5]).toEqual({
      name: "addPrincipalEdge",
      args: ["edge-1", "group.admin", "discord:guild-1:user-1:role-admin", "discord:guild-1", new Date("2026-05-18T14:00:00.000Z")]
    });
    expect(connection.reducerCalls[6]).toEqual({
      name: "removePrincipalEdge",
      args: ["edge-1"]
    });
    expect(connection.reducerCalls[7]).toEqual({
      name: "grantPermission",
      args: ["grant-1", "player:1", "menu.vehicle.repair", "allow", "temp", new Date("2026-05-18T14:00:00.000Z")]
    });
    expect(connection.reducerCalls[8]).toEqual({
      name: "completeAction",
      args: ["action-1", "completed"]
    });
    expect(connection.reducerCalls[9]).toEqual({
      name: "writeAuditLog",
      args: [
        "audit-1",
        "server-1",
        "player:1",
        "admin_tools",
        "vehicle.repair",
        "admin.vehicles.repair",
        "vehicle",
        "net:10",
        "{}",
        "{\"repaired\":true}",
        "succeeded"
      ]
    });
    expect(connection.reducerCalls[10]).toEqual({
      name: "revokePluginBundle",
      args: ["bundle-1", "revoked", "owner:2", "bad release"]
    });
    expect(connection.reducerCalls[11]).toEqual({
      name: "issueInvoice",
      args: [
        "invoice:repair-1",
        "acct:mechanic",
        "acct:customer",
        300,
        "cash",
        "repair",
        "player:mechanic",
        "issue-invoice-1",
        new Date("2026-05-25T12:00:00.000Z")
      ]
    });
    expect(connection.reducerCalls[12]).toEqual({
      name: "payInvoice",
      args: ["tx:invoice-payment-1", "player:customer", "invoice:repair-1", "pay-invoice-1"]
    });
    expect(connection.reducerCalls[13]).toEqual({
      name: "buyItem",
      args: ["tx:buy-1", "player:buyer", "acct:buyer", "acct:shop", 75, "repair_kit", 3, "buy-1"]
    });
    expect(connection.reducerCalls[14]).toEqual({
      name: "sellItem",
      args: ["tx:sell-1", "player:seller", "acct:seller", "acct:shop", 25, "scrap_metal", 5, "sell-1"]
    });
  });
});
