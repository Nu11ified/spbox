import { describe, expect, it } from "vitest";
import { FakeSpacetimeClient, SpacetimeRuntimeAdapter } from "../src/spacetime/adapter.js";
import { PermissionEngine } from "../src/core/permissions.js";

describe("SpacetimeRuntimeAdapter economy reducers", () => {
  it("caches economy accounts, transactions, ledger entries, invoices, and limits", async () => {
    const client = new FakeSpacetimeClient({
      accounts: [
        {
          id: "acct:cash",
          ownerType: "character",
          ownerId: "char:1",
          currency: "cash",
          balance: 1000,
          status: "active",
          createdAt: new Date("2026-05-18T11:00:00.000Z"),
          updatedAt: new Date("2026-05-18T12:00:00.000Z")
        }
      ],
      transactions: [
        {
          id: "tx:1",
          transactionType: "transfer",
          actorId: "player:1",
          status: "completed",
          idempotencyKey: "transfer-1",
          metadataJson: "{\"reason\":\"test\"}",
          createdAt: new Date("2026-05-18T12:00:00.000Z"),
          completedAt: new Date("2026-05-18T12:00:01.000Z")
        }
      ],
      ledger_entries: [
        {
          id: "ledger:2",
          transactionId: "tx:1",
          accountId: "acct:cash",
          direction: "credit",
          amount: 25,
          reason: "refund",
          metadataJson: "{}",
          createdAt: new Date("2026-05-18T12:00:02.000Z")
        },
        {
          id: "ledger:1",
          transactionId: "tx:1",
          accountId: "acct:cash",
          direction: "debit",
          amount: 100,
          reason: "payment",
          metadataJson: "{}",
          createdAt: new Date("2026-05-18T12:00:01.000Z")
        }
      ],
      invoices: [
        {
          id: "invoice:1",
          issuerAccountId: "acct:business",
          payerAccountId: "acct:cash",
          amount: 100,
          currency: "cash",
          reason: "repair",
          status: "issued",
          issuedBy: "player:mechanic",
          idempotencyKey: "issue-invoice-1",
          issuedAt: new Date("2026-05-18T12:00:00.000Z"),
          dueAt: new Date("2026-05-25T12:00:00.000Z")
        }
      ],
      economy_limits: [
        {
          id: "limit:transfer-small",
          permissionKey: "economy.transfer",
          actionType: "economy.transfer",
          limitJson: "{\"maxAmount\":200}",
          enabled: true
        }
      ]
    });
    const adapter = new SpacetimeRuntimeAdapter(client);

    await adapter.connectAndSubscribe("server-1");

    expect(adapter.cache.getAccount("acct:cash")).toEqual(
      expect.objectContaining({
        ownerId: "char:1",
        balance: 1000
      })
    );
    expect(adapter.cache.getTransaction("tx:1")?.idempotencyKey).toBe("transfer-1");
    expect(adapter.cache.getLedgerEntriesForAccount("acct:cash").map((row) => row.id)).toEqual([
      "ledger:1",
      "ledger:2"
    ]);
    expect(adapter.cache.getLedgerEntriesForTransaction("tx:1").map((row) => row.reason)).toEqual([
      "payment",
      "refund"
    ]);
    expect(adapter.cache.getInvoice("invoice:1")).toEqual(expect.objectContaining({
      payerAccountId: "acct:cash",
      dueAt: new Date("2026-05-25T12:00:00.000Z")
    }));
    expect(adapter.cache.getEconomyLimit("limit:transfer-small")).toEqual(expect.objectContaining({
      permissionKey: "economy.transfer",
      limitJson: "{\"maxAmount\":200}",
      enabled: true
    }));
    expect(adapter.cache.getEconomyLimits().map((row) => row.id)).toEqual(["limit:transfer-small"]);

    client.emitUpdate("accounts", {
      id: "acct:cash",
      ownerType: "character",
        ownerId: "char:1",
        currency: "cash",
        balance: 900,
        status: "active",
        createdAt: new Date("2026-05-18T11:00:00.000Z"),
        updatedAt: new Date("2026-05-18T12:05:00.000Z")
      });

    expect(adapter.cache.getAccount("acct:cash")?.balance).toBe(900);
    expect(adapter.cache.getAccount("acct:cash")?.createdAt).toEqual(new Date("2026-05-18T11:00:00.000Z"));
    expect(adapter.cache.getAccount("acct:cash")?.updatedAt).toEqual(new Date("2026-05-18T12:05:00.000Z"));

    client.emitUpdate("economy_limits", {
      id: "limit:transfer-large",
      permissionKey: "economy.transfer",
      actionType: "economy.transfer",
      limitJson: "{\"maxAmount\":5000}",
      enabled: false
    });

    expect(adapter.cache.getEconomyLimits().map((row) => row.id)).toEqual([
      "limit:transfer-large",
      "limit:transfer-small"
    ]);
  });

  it("calls create_account and transfer_money reducers", async () => {
    const client = new FakeSpacetimeClient({});
    const adapter = new SpacetimeRuntimeAdapter(client);

    await adapter.createAccount({
      id: "acct:1",
      ownerType: "character",
      ownerId: "char:1",
      currency: "cash",
      balance: 1000
    });
    await adapter.transferMoney({
      transactionId: "tx:1",
      actorId: "player:1",
      fromAccountId: "acct:1",
      toAccountId: "acct:2",
      amount: 100,
      reason: "test",
      idempotencyKey: "transfer-1"
    });

    expect(client.reducerCalls).toEqual([
      {
        name: "create_account",
        args: {
          id: "acct:1",
          ownerType: "character",
          ownerId: "char:1",
          currency: "cash",
          balance: 1000
        }
      },
      {
        name: "transfer_money",
        args: {
          transactionId: "tx:1",
          actorId: "player:1",
          fromAccountId: "acct:1",
          toAccountId: "acct:2",
          amount: 100,
          reason: "test",
          idempotencyKey: "transfer-1"
        }
      }
    ]);
  });

  it("calls named ledger primitive reducers", async () => {
    const client = new FakeSpacetimeClient({});
    const adapter = new SpacetimeRuntimeAdapter(client);

    await adapter.depositCash({
      transactionId: "tx:deposit",
      actorId: "player:admin",
      accountId: "acct:cash",
      amount: 200,
      reason: "cash_deposit",
      idempotencyKey: "deposit-1"
    });
    await adapter.withdrawCash({
      transactionId: "tx:withdraw",
      actorId: "player:admin",
      accountId: "acct:cash",
      amount: 50,
      reason: "cash_withdrawal",
      idempotencyKey: "withdraw-1"
    });
    await adapter.paySalary({
      transactionId: "tx:salary",
      actorId: "player:payroll",
      employerAccountId: "acct:business",
      employeeAccountId: "acct:employee",
      amount: 500,
      reason: "salary",
      idempotencyKey: "salary-1"
    });
    await adapter.adminAdjustBalance({
      transactionId: "tx:adjust",
      actorId: "player:admin",
      accountId: "acct:cash",
      direction: "credit",
      amount: 25,
      reason: "correction",
      idempotencyKey: "adjust-1"
    });
    await adapter.voidTransaction({
      transactionId: "tx:void",
      actorId: "player:admin",
      voidedTransactionId: "tx:deposit",
      reason: "rollback",
      idempotencyKey: "void-1"
    });

    expect(client.reducerCalls.map((call) => call.name)).toEqual([
      "deposit_cash",
      "withdraw_cash",
      "pay_salary",
      "admin_adjust_balance",
      "void_transaction"
    ]);
    expect(client.reducerCalls.at(3)?.args).toEqual({
      transactionId: "tx:adjust",
      actorId: "player:admin",
      accountId: "acct:cash",
      direction: "credit",
      amount: 25,
      reason: "correction",
      idempotencyKey: "adjust-1"
    });
  });

  it("calls invoice reducers with ledger-backed payment arguments", async () => {
    const client = new FakeSpacetimeClient({});
    const adapter = new SpacetimeRuntimeAdapter(client);

    await adapter.issueInvoice({
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
    await adapter.payInvoice({
      transactionId: "tx:invoice-payment-1",
      actorId: "player:customer",
      invoiceId: "invoice:repair-1",
      idempotencyKey: "pay-invoice-1"
    });

    expect(client.reducerCalls).toEqual([
      {
        name: "issue_invoice",
        args: {
          id: "invoice:repair-1",
          issuerAccountId: "acct:mechanic",
          payerAccountId: "acct:customer",
          amount: 300,
          currency: "cash",
          reason: "repair",
          issuedBy: "player:mechanic",
          idempotencyKey: "issue-invoice-1",
          dueAt: new Date("2026-05-25T12:00:00.000Z")
        }
      },
      {
        name: "pay_invoice",
        args: {
          transactionId: "tx:invoice-payment-1",
          actorId: "player:customer",
          invoiceId: "invoice:repair-1",
          idempotencyKey: "pay-invoice-1"
        }
      }
    ]);
  });

  it("calls item economy reducers with item metadata arguments", async () => {
    const client = new FakeSpacetimeClient({});
    const adapter = new SpacetimeRuntimeAdapter(client);

    await adapter.buyItem({
      transactionId: "tx:buy-1",
      actorId: "player:buyer",
      buyerAccountId: "acct:buyer",
      sellerAccountId: "acct:shop",
      amount: 75,
      itemKey: "repair_kit",
      quantity: 3,
      idempotencyKey: "buy-1"
    });
    await adapter.sellItem({
      transactionId: "tx:sell-1",
      actorId: "player:seller",
      sellerAccountId: "acct:seller",
      buyerAccountId: "acct:shop",
      amount: 25,
      itemKey: "scrap_metal",
      quantity: 5,
      idempotencyKey: "sell-1"
    });

    expect(client.reducerCalls).toEqual([
      {
        name: "buy_item",
        args: {
          transactionId: "tx:buy-1",
          actorId: "player:buyer",
          buyerAccountId: "acct:buyer",
          sellerAccountId: "acct:shop",
          amount: 75,
          itemKey: "repair_kit",
          quantity: 3,
          idempotencyKey: "buy-1"
        }
      },
      {
        name: "sell_item",
        args: {
          transactionId: "tx:sell-1",
          actorId: "player:seller",
          sellerAccountId: "acct:seller",
          buyerAccountId: "acct:shop",
          amount: 25,
          itemKey: "scrap_metal",
          quantity: 5,
          idempotencyKey: "sell-1"
        }
      }
    ]);
  });

  it("calls the upsert_economy_limit reducer", async () => {
    const client = new FakeSpacetimeClient({});
    const adapter = new SpacetimeRuntimeAdapter(client);

    await adapter.upsertEconomyLimit({
      id: "limit:transfer-small",
      permissionKey: "economy.transfer",
      actionType: "economy.transfer",
      limitJson: "{\"maxAmount\":200}",
      enabled: true
    });

    expect(client.reducerCalls).toEqual([
      {
        name: "upsert_economy_limit",
        args: {
          id: "limit:transfer-small",
          permissionKey: "economy.transfer",
          actionType: "economy.transfer",
          limitJson: "{\"maxAmount\":200}",
          enabled: true
        }
      }
    ]);
  });

  it("builds an EconomyLedger from cached accounts and economy limits", async () => {
    const client = new FakeSpacetimeClient({
      accounts: [
        {
          id: "acct:cash",
          ownerType: "character",
          ownerId: "char:1",
          currency: "cash",
          balance: 1000,
          status: "active",
          createdAt: new Date("2026-05-18T11:00:00.000Z"),
          updatedAt: new Date("2026-05-18T12:00:00.000Z")
        },
        {
          id: "acct:business",
          ownerType: "business",
          ownerId: "biz:1",
          currency: "cash",
          balance: 100,
          status: "active",
          createdAt: new Date("2026-05-18T11:00:00.000Z"),
          updatedAt: new Date("2026-05-18T12:00:00.000Z")
        }
      ],
      economy_limits: [
        {
          id: "limit:transfer-small",
          permissionKey: "economy.transfer",
          actionType: "economy.transfer",
          limitJson: "{\"max_amount\":200,\"allowed_account_owner_types\":[\"character\",\"business\"]}",
          enabled: true
        }
      ]
    });
    const adapter = new SpacetimeRuntimeAdapter(client);
    await adapter.connectAndSubscribe("server-1");
    const permissions = new PermissionEngine({
      principals: [],
      edges: [],
      grants: [
        {
          principalId: "player:admin",
          permissionKey: "economy.transfer",
          effect: "allow",
          source: "manual"
        }
      ]
    });

    const ledger = adapter.cache.buildEconomyLedger(permissions);

    expect(() =>
      ledger.transferMoney({
        actorPrincipalId: "player:admin",
        fromAccountId: "acct:cash",
        toAccountId: "acct:business",
        amount: 250,
        currency: "cash",
        reason: "invoice_payment",
        idempotencyKey: "transfer-limited"
      })
    ).toThrow("Economy limit exceeded: max amount 200");
    const allowed = ledger.transferMoney({
      actorPrincipalId: "player:admin",
      fromAccountId: "acct:cash",
      toAccountId: "acct:business",
      amount: 150,
      currency: "cash",
      reason: "invoice_payment",
      idempotencyKey: "transfer-ok"
    });

    expect(allowed.transaction.status).toBe("completed");
    expect(ledger.getAccount("acct:cash").balance).toBe(850);
    expect(ledger.getAccount("acct:business").balance).toBe(250);
  });

  it("builds malformed enabled economy limit rows as fail-closed ledger limits", async () => {
    const client = new FakeSpacetimeClient({
      accounts: [
        {
          id: "acct:a",
          ownerType: "character",
          ownerId: "char:a",
          currency: "cash",
          balance: 1000,
          status: "active",
          createdAt: new Date("2026-05-18T11:00:00.000Z"),
          updatedAt: new Date("2026-05-18T12:00:00.000Z")
        },
        {
          id: "acct:b",
          ownerType: "character",
          ownerId: "char:b",
          currency: "cash",
          balance: 100,
          status: "active",
          createdAt: new Date("2026-05-18T11:00:00.000Z"),
          updatedAt: new Date("2026-05-18T12:00:00.000Z")
        }
      ],
      economy_limits: [
        {
          id: "limit:broken",
          permissionKey: "economy.transfer",
          actionType: "economy.transfer",
          limitJson: "{broken-json",
          enabled: true
        }
      ]
    });
    const adapter = new SpacetimeRuntimeAdapter(client);
    await adapter.connectAndSubscribe("server-1");
    const permissions = new PermissionEngine({
      principals: [],
      edges: [],
      grants: [
        {
          principalId: "player:admin",
          permissionKey: "economy.transfer",
          effect: "allow",
          source: "manual"
        }
      ]
    });

    const ledger = adapter.cache.buildEconomyLedger(permissions);

    expect(() =>
      ledger.transferMoney({
        actorPrincipalId: "player:admin",
        fromAccountId: "acct:a",
        toAccountId: "acct:b",
        amount: 1,
        currency: "cash",
        reason: "test",
        idempotencyKey: "transfer-blocked"
      })
    ).toThrow("Economy limit exceeded: max amount 0");
  });
});
