import { describe, expect, it } from "vitest";
import { AdminService } from "../src/admin/service.js";
import { createAdminHttpApi } from "../src/admin/http-api.js";
import { EconomyLedger } from "../src/core/economy.js";
import { PermissionEngine } from "../src/core/permissions.js";
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

function createAdminWithLedger(): AdminService {
  let nextId = 0;
  const economy = new EconomyLedger({
    permissions: new PermissionEngine({
      principals: [],
      edges: [],
      grants: [
        { principalId: "admin:1", permissionKey: "economy.transfer", effect: "allow", source: "manual" }
      ]
    }),
    now: () => new Date("2026-05-18T12:00:00.000Z"),
    idFactory: () => `id-${++nextId}`,
    accounts: [
      { id: "acct:a", ownerType: "character", ownerId: "char:a", currency: "cash", balance: 1000, status: "active" },
      { id: "acct:b", ownerType: "business", ownerId: "biz:b", currency: "cash", balance: 100, status: "active" }
    ]
  });
  economy.transferMoney({
    actorPrincipalId: "admin:1",
    fromAccountId: "acct:a",
    toAccountId: "acct:b",
    amount: 250,
    currency: "cash",
    reason: "invoice_payment",
    idempotencyKey: "transfer-1"
  });

  return new AdminService({
    runtime: new RuntimeControlPlane(),
    permissions: new PermissionStore(),
    plugins: new PluginRegistry(),
    economy
  });
}

describe("AdminService economy write-through", () => {
  it("creates accounts and transfers money through SpacetimeDB reducers", async () => {
    const { admin, client } = createAdmin();

    await admin.createEconomyAccount({
      id: "acct:a",
      ownerType: "character",
      ownerId: "char:a",
      currency: "cash",
      balance: 1000
    });
    await admin.transferEconomyMoney({
      transactionId: "tx:1",
      actorId: "admin:1",
      fromAccountId: "acct:a",
      toAccountId: "acct:b",
      amount: 250,
      reason: "admin_transfer",
      idempotencyKey: "transfer-1"
    });

    expect(client.reducerCalls).toEqual([
      {
        name: "create_account",
        args: {
          id: "acct:a",
          ownerType: "character",
          ownerId: "char:a",
          currency: "cash",
          balance: 1000
        }
      },
      {
        name: "transfer_money",
        args: {
          transactionId: "tx:1",
          actorId: "admin:1",
          fromAccountId: "acct:a",
          toAccountId: "acct:b",
          amount: 250,
          reason: "admin_transfer",
          idempotencyKey: "transfer-1"
        }
      }
    ]);
  });

  it("requires SpacetimeDB for economy admin mutations", async () => {
    const admin = new AdminService({
      runtime: new RuntimeControlPlane(),
      permissions: new PermissionStore(),
      plugins: new PluginRegistry()
    });

    await expect(
      admin.createEconomyAccount({
        id: "acct:a",
        ownerType: "character",
        ownerId: "char:a",
        currency: "cash",
        balance: 1000
      })
    ).rejects.toThrow("SpacetimeDB adapter is required for economy admin mutations");
  });

  it("rejects invalid economy account creation before write-through", async () => {
    const { admin, client } = createAdmin();

    await expect(
      admin.createEconomyAccount({
        id: "acct:bad",
        ownerType: "admin" as never,
        ownerId: "admin:1",
        currency: "cash",
        balance: 1000
      })
    ).rejects.toThrow("Invalid account owner type: admin");
    await expect(
      admin.createEconomyAccount({
        id: "acct:negative",
        ownerType: "character",
        ownerId: "char:negative",
        currency: "cash",
        balance: -1
      })
    ).rejects.toThrow("Account balance cannot be negative");
    expect(client.reducerCalls).toEqual([]);
  });

  it("exposes economy account and transfer HTTP routes", async () => {
    const { admin, client } = createAdmin();
    const api = createAdminHttpApi(admin);

    const account = await api.handle({
      method: "POST",
      path: "/economy/accounts",
      body: {
        id: "acct:a",
        ownerType: "character",
        ownerId: "char:a",
        currency: "cash",
        balance: 1000
      }
    });
    const transfer = await api.handle({
      method: "POST",
      path: "/economy/transfers",
      body: {
        transactionId: "tx:1",
        actorId: "admin:1",
        fromAccountId: "acct:a",
        toAccountId: "acct:b",
        amount: 250,
        reason: "admin_transfer",
        idempotencyKey: "transfer-1"
      }
    });

    expect(account).toEqual({ status: 200, body: { ok: true } });
    expect(transfer).toEqual({ status: 200, body: { ok: true } });
    expect(client.reducerCalls.map((call) => call.name)).toEqual([
      "create_account",
      "transfer_money"
    ]);
  });

  it("mirrors economy primitive admin operations through SpacetimeDB reducers", async () => {
    const { admin, client } = createAdmin();

    await admin.depositEconomyCash({
      transactionId: "tx:deposit",
      actorId: "admin:1",
      accountId: "acct:a",
      amount: 100,
      reason: "cash",
      idempotencyKey: "deposit-1"
    });
    await admin.withdrawEconomyCash({
      transactionId: "tx:withdraw",
      actorId: "admin:1",
      accountId: "acct:a",
      amount: 50,
      reason: "cash",
      idempotencyKey: "withdraw-1"
    });
    await admin.adjustEconomyBalance({
      transactionId: "tx:adjust",
      actorId: "admin:1",
      accountId: "acct:a",
      direction: "credit",
      amount: 25,
      reason: "correction",
      idempotencyKey: "adjust-1"
    });
    await admin.voidEconomyTransaction({
      transactionId: "tx:void",
      actorId: "admin:1",
      voidedTransactionId: "tx:deposit",
      reason: "rollback",
      idempotencyKey: "void-1"
    });

    expect(client.reducerCalls.map((call) => call.name)).toEqual([
      "deposit_cash",
      "withdraw_cash",
      "admin_adjust_balance",
      "void_transaction"
    ]);
  });

  it("mirrors invoice admin operations through SpacetimeDB reducers", async () => {
    const { admin, client } = createAdmin();
    const dueAt = new Date("2026-05-25T12:00:00.000Z");

    await admin.issueEconomyInvoice({
      id: "invoice:repair-1",
      issuerAccountId: "acct:mechanic",
      payerAccountId: "acct:customer",
      amount: 300,
      currency: "cash",
      reason: "repair",
      issuedBy: "player:mechanic",
      idempotencyKey: "issue-invoice-1",
      dueAt
    });
    await admin.payEconomyInvoice({
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
          dueAt
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

  it("mirrors advanced economy admin operations through SpacetimeDB reducers", async () => {
    const { admin, client } = createAdmin();

    await admin.payEconomySalary({
      transactionId: "tx:salary",
      actorId: "admin:payroll",
      employerAccountId: "acct:business",
      employeeAccountId: "acct:employee",
      amount: 1200,
      reason: "weekly_payroll",
      idempotencyKey: "salary-1"
    });
    await admin.fineEconomyPlayer({
      transactionId: "tx:fine",
      actorId: "admin:police",
      playerAccountId: "acct:player",
      destinationAccountId: "acct:government",
      amount: 250,
      reason: "traffic_fine",
      idempotencyKey: "fine-1"
    });
    await admin.chargeEconomyTax({
      transactionId: "tx:tax",
      actorId: "admin:tax",
      payerAccountId: "acct:business",
      governmentAccountId: "acct:government",
      amount: 500,
      reason: "sales_tax",
      idempotencyKey: "tax-1"
    });
    await admin.payEconomyBusinessPayout({
      transactionId: "tx:payout",
      actorId: "admin:owner",
      businessAccountId: "acct:business",
      destinationAccountId: "acct:owner",
      amount: 750,
      reason: "owner_draw",
      idempotencyKey: "payout-1"
    });
    await admin.buyEconomyItem({
      transactionId: "tx:buy",
      actorId: "player:buyer",
      buyerAccountId: "acct:buyer",
      sellerAccountId: "acct:shop",
      amount: 40,
      itemKey: "repair_kit",
      quantity: 2,
      idempotencyKey: "buy-1"
    });
    await admin.sellEconomyItem({
      transactionId: "tx:sell",
      actorId: "player:seller",
      sellerAccountId: "acct:seller",
      buyerAccountId: "acct:shop",
      amount: 30,
      itemKey: "scrap",
      quantity: 3,
      idempotencyKey: "sell-1"
    });

    expect(client.reducerCalls.map((call) => call.name)).toEqual([
      "pay_salary",
      "fine_player",
      "charge_tax",
      "business_payout",
      "buy_item",
      "sell_item"
    ]);
  });

  it("exposes invoice HTTP routes", async () => {
    const { admin, client } = createAdmin();
    const api = createAdminHttpApi(admin);

    const issue = await api.handle({
      method: "POST",
      path: "/economy/invoices",
      body: {
        id: "invoice:repair-1",
        issuerAccountId: "acct:mechanic",
        payerAccountId: "acct:customer",
        amount: 300,
        currency: "cash",
        reason: "repair",
        issuedBy: "player:mechanic",
        idempotencyKey: "issue-invoice-1",
        dueAt: "2026-05-25T12:00:00.000Z"
      }
    });
    const pay = await api.handle({
      method: "POST",
      path: "/economy/invoices/invoice%3Arepair-1/pay",
      body: {
        transactionId: "tx:invoice-payment-1",
        actorId: "player:customer",
        idempotencyKey: "pay-invoice-1"
      }
    });

    expect(issue).toEqual({ status: 200, body: { ok: true } });
    expect(pay).toEqual({ status: 200, body: { ok: true } });
    expect(client.reducerCalls.map((call) => call.name)).toEqual(["issue_invoice", "pay_invoice"]);
    expect(client.reducerCalls[0]).toEqual(expect.objectContaining({
      args: expect.objectContaining({
        dueAt: new Date("2026-05-25T12:00:00.000Z")
      })
    }));
  });

  it("exposes advanced economy HTTP routes", async () => {
    const { admin, client } = createAdmin();
    const api = createAdminHttpApi(admin);

    for (const request of [
      {
        method: "POST" as const,
        path: "/economy/salaries",
        body: {
          transactionId: "tx:salary",
          actorId: "admin:payroll",
          employerAccountId: "acct:business",
          employeeAccountId: "acct:employee",
          amount: 1200,
          reason: "weekly_payroll",
          idempotencyKey: "salary-1"
        }
      },
      {
        method: "POST" as const,
        path: "/economy/fines",
        body: {
          transactionId: "tx:fine",
          actorId: "admin:police",
          playerAccountId: "acct:player",
          destinationAccountId: "acct:government",
          amount: 250,
          reason: "traffic_fine",
          idempotencyKey: "fine-1"
        }
      },
      {
        method: "POST" as const,
        path: "/economy/taxes",
        body: {
          transactionId: "tx:tax",
          actorId: "admin:tax",
          payerAccountId: "acct:business",
          governmentAccountId: "acct:government",
          amount: 500,
          reason: "sales_tax",
          idempotencyKey: "tax-1"
        }
      },
      {
        method: "POST" as const,
        path: "/economy/business-payouts",
        body: {
          transactionId: "tx:payout",
          actorId: "admin:owner",
          businessAccountId: "acct:business",
          destinationAccountId: "acct:owner",
          amount: 750,
          reason: "owner_draw",
          idempotencyKey: "payout-1"
        }
      },
      {
        method: "POST" as const,
        path: "/economy/item-purchases",
        body: {
          transactionId: "tx:buy",
          actorId: "player:buyer",
          buyerAccountId: "acct:buyer",
          sellerAccountId: "acct:shop",
          amount: 40,
          itemKey: "repair_kit",
          quantity: 2,
          idempotencyKey: "buy-1"
        }
      },
      {
        method: "POST" as const,
        path: "/economy/item-sales",
        body: {
          transactionId: "tx:sell",
          actorId: "player:seller",
          sellerAccountId: "acct:seller",
          buyerAccountId: "acct:shop",
          amount: 30,
          itemKey: "scrap",
          quantity: 3,
          idempotencyKey: "sell-1"
        }
      }
    ]) {
      await expect(api.handle(request)).resolves.toEqual({ status: 200, body: { ok: true } });
    }

    expect(client.reducerCalls.map((call) => call.name)).toEqual([
      "pay_salary",
      "fine_player",
      "charge_tax",
      "business_payout",
      "buy_item",
      "sell_item"
    ]);
  });

  it("rejects invalid economy primitive mutations before write-through", async () => {
    const { admin, client } = createAdmin();

    await expect(
      admin.transferEconomyMoney({
        transactionId: "tx:bad-transfer",
        actorId: "admin:1",
        fromAccountId: "acct:a",
        toAccountId: "acct:b",
        amount: 0,
        reason: "admin_transfer",
        idempotencyKey: "bad-transfer"
      })
    ).rejects.toThrow("Amount must be a positive integer");
    await expect(
      admin.depositEconomyCash({
        transactionId: "tx:bad-deposit",
        actorId: "admin:1",
        accountId: "acct:a",
        amount: 100,
        reason: " ",
        idempotencyKey: "bad-deposit"
      })
    ).rejects.toThrow("Reason must be a non-empty string");
    await expect(
      admin.adjustEconomyBalance({
        transactionId: "tx:bad-adjust",
        actorId: "admin:1",
        accountId: "acct:a",
        direction: "sideways",
        amount: 100,
        reason: "correction",
        idempotencyKey: "bad-adjust"
      })
    ).rejects.toThrow("Direction must be debit or credit");
    await expect(
      admin.voidEconomyTransaction({
        transactionId: "tx:bad-void",
        actorId: "admin:1",
        voidedTransactionId: "tx:deposit",
        reason: "",
        idempotencyKey: "bad-void"
      })
    ).rejects.toThrow("Reason must be a non-empty string");
    expect(client.reducerCalls).toEqual([]);
  });

  it("mirrors economy limit admin operations through SpacetimeDB reducers", async () => {
    const { admin, client } = createAdmin();

    await admin.upsertEconomyLimit({
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

  it("rejects malformed economy limit JSON before write-through", async () => {
    const { admin, client } = createAdmin();

    await expect(
      admin.upsertEconomyLimit({
        id: "limit:broken",
        permissionKey: "economy.transfer",
        actionType: "economy.transfer",
        limitJson: "{\"allowedAccountOwnerTypes\":[\"character\",\"admin\"]}",
        enabled: true
      })
    ).rejects.toThrow("Economy limit allowedAccountOwnerTypes contains invalid owner type");
    expect(client.reducerCalls).toEqual([]);
  });

  it("exposes economy primitive HTTP routes", async () => {
    const { admin, client } = createAdmin();
    const api = createAdminHttpApi(admin);

    for (const request of [
      {
        method: "POST" as const,
        path: "/economy/deposits",
        body: {
          transactionId: "tx:deposit",
          actorId: "admin:1",
          accountId: "acct:a",
          amount: 100,
          reason: "cash",
          idempotencyKey: "deposit-1"
        }
      },
      {
        method: "POST" as const,
        path: "/economy/withdrawals",
        body: {
          transactionId: "tx:withdraw",
          actorId: "admin:1",
          accountId: "acct:a",
          amount: 50,
          reason: "cash",
          idempotencyKey: "withdraw-1"
        }
      },
      {
        method: "POST" as const,
        path: "/economy/adjustments",
        body: {
          transactionId: "tx:adjust",
          actorId: "admin:1",
          accountId: "acct:a",
          direction: "debit",
          amount: 25,
          reason: "correction",
          idempotencyKey: "adjust-1"
        }
      },
      {
        method: "POST" as const,
        path: "/economy/voids",
        body: {
          transactionId: "tx:void",
          actorId: "admin:1",
          voidedTransactionId: "tx:deposit",
          reason: "rollback",
          idempotencyKey: "void-1"
        }
      }
    ]) {
      await expect(api.handle(request)).resolves.toEqual({ status: 200, body: { ok: true } });
    }

    expect(client.reducerCalls.map((call) => call.name)).toEqual([
      "deposit_cash",
      "withdraw_cash",
      "admin_adjust_balance",
      "void_transaction"
    ]);
  });

  it("exposes economy limit HTTP routes", async () => {
    const { admin, client } = createAdmin();
    const api = createAdminHttpApi(admin);

    const response = await api.handle({
      method: "POST",
      path: "/economy/limits",
      body: {
        id: "limit:transfer-small",
        permissionKey: "economy.transfer",
        actionType: "economy.transfer",
        limitJson: "{\"maxAmount\":200}",
        enabled: true
      }
    });

    expect(response).toEqual({ status: 200, body: { ok: true } });
    expect(client.reducerCalls).toEqual([
      expect.objectContaining({
        name: "upsert_economy_limit",
        args: expect.objectContaining({
          id: "limit:transfer-small",
          limitJson: "{\"maxAmount\":200}"
        })
      })
    ]);
  });

  it("exposes economy account search, transaction history, and ledger drilldown HTTP routes", async () => {
    const api = createAdminHttpApi(createAdminWithLedger());

    const accounts = await api.handle({
      method: "GET",
      path: "/economy/accounts",
      body: { ownerType: "business" }
    });
    const transactions = await api.handle({
      method: "GET",
      path: "/economy/transactions",
      body: { accountId: "acct:b" }
    });
    const transactionId = ((transactions.body as Array<{ id: string }>)[0] as { id: string }).id;
    const entries = await api.handle({
      method: "GET",
      path: `/economy/transactions/${transactionId}/ledger`
    });

    expect(accounts).toEqual({
      status: 200,
      body: [expect.objectContaining({ id: "acct:b", ownerType: "business" })]
    });
    expect(transactions).toEqual({
      status: 200,
      body: [expect.objectContaining({ id: transactionId, type: "economy.transfer" })]
    });
    expect(entries).toEqual({
      status: 200,
      body: [
        expect.objectContaining({ accountId: "acct:a", direction: "debit", amount: 250 }),
        expect.objectContaining({ accountId: "acct:b", direction: "credit", amount: 250 })
      ]
    });
  });

  it("accepts economy read filters from query strings for browser clients", async () => {
    const api = createAdminHttpApi(createAdminWithLedger());

    const accounts = await api.handle({
      method: "GET",
      path: "/economy/accounts?ownerType=business&currency=cash"
    });
    const transactions = await api.handle({
      method: "GET",
      path: "/economy/transactions?accountId=acct:b&type=economy.transfer"
    });

    expect(accounts).toEqual({
      status: 200,
      body: [expect.objectContaining({ id: "acct:b", ownerType: "business" })]
    });
    expect(transactions).toEqual({
      status: 200,
      body: [expect.objectContaining({ type: "economy.transfer" })]
    });
  });

  it("exposes economy suspicious activity and account statement HTTP routes", async () => {
    const api = createAdminHttpApi(createAdminWithLedger());

    const suspicious = await api.handle({
      method: "GET",
      path: "/economy/suspicious?accountId=acct:b&minAmount=200"
    });
    const statement = await api.handle({
      method: "GET",
      path: "/economy/accounts/acct:b/statement?from=2026-05-18T00:00:00.000Z&to=2026-05-18T23:59:59.000Z"
    });

    expect(suspicious).toEqual({
      status: 200,
      body: [
        expect.objectContaining({
          transaction: expect.objectContaining({ type: "economy.transfer" }),
          maxEntryAmount: 250,
          reasons: ["amount_at_or_above_threshold"]
        })
      ]
    });
    expect(statement).toEqual({
      status: 200,
      body: expect.objectContaining({
        account: expect.objectContaining({ id: "acct:b" }),
        openingBalance: 100,
        closingBalance: 350,
        totalCredits: 250,
        totalDebits: 0,
        entries: [
          expect.objectContaining({ accountId: "acct:b", direction: "credit", amount: 250 })
        ]
      })
    });
  });

  it("exposes account statement CSV exports over HTTP", async () => {
    const api = createAdminHttpApi(createAdminWithLedger());

    const csv = await api.handle({
      method: "GET",
      path: "/economy/accounts/acct:b/statement.csv?from=2026-05-18T00:00:00.000Z&to=2026-05-18T23:59:59.000Z"
    });

    expect(csv.status).toBe(200);
    expect(String(csv.body).split("\n")).toEqual([
      "account_id,owner_type,owner_id,currency,from,to,opening_balance,closing_balance,total_debits,total_credits",
      "acct:b,business,biz:b,cash,2026-05-18T00:00:00.000Z,2026-05-18T23:59:59.000Z,100,350,0,250",
      "",
      "entry_id,transaction_id,created_at,account_id,direction,amount,reason,metadata_json",
      expect.stringMatching(/^id-\d+,id-\d+,2026-05-18T12:00:00.000Z,acct:b,credit,250,invoice_payment,$/)
    ]);
  });

  it("serves economy read routes from SpacetimeDB live cache without an in-memory ledger", async () => {
    const client = new FakeSpacetimeClient({
      accounts: [
        {
          id: "acct:a",
          ownerType: "character",
          ownerId: "char:a",
          currency: "cash",
          balance: 750,
          status: "active",
          createdAt: new Date("2026-05-18T11:00:00.000Z"),
          updatedAt: new Date("2026-05-18T12:00:00.000Z")
        },
        {
          id: "acct:b",
          ownerType: "business",
          ownerId: "biz:b",
          currency: "cash",
          balance: 350,
          status: "active",
          createdAt: new Date("2026-05-18T11:00:00.000Z"),
          updatedAt: new Date("2026-05-18T12:00:00.000Z")
        }
      ],
      transactions: [
        {
          id: "tx:1",
          transactionType: "economy.transfer",
          actorId: "admin:1",
          status: "completed",
          idempotencyKey: "transfer-1",
          metadataJson: "{\"reason\":\"invoice_payment\"}",
          createdAt: new Date("2026-05-18T12:00:00.000Z"),
          completedAt: new Date("2026-05-18T12:00:01.000Z")
        }
      ],
      ledger_entries: [
        {
          id: "ledger:1",
          transactionId: "tx:1",
          accountId: "acct:a",
          direction: "debit",
          amount: 250,
          reason: "invoice_payment",
          metadataJson: "{}",
          createdAt: new Date("2026-05-18T12:00:00.000Z")
        },
        {
          id: "ledger:2",
          transactionId: "tx:1",
          accountId: "acct:b",
          direction: "credit",
          amount: 250,
          reason: "invoice_payment",
          metadataJson: "{}",
          createdAt: new Date("2026-05-18T12:00:00.000Z")
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
    const spacetime = new SpacetimeRuntimeAdapter(client);
    await spacetime.connectAndSubscribe("server-1");
    const api = createAdminHttpApi(new AdminService({
      runtime: new RuntimeControlPlane(),
      permissions: new PermissionStore(),
      plugins: new PluginRegistry(),
      spacetime
    }));

    const accounts = await api.handle({
      method: "GET",
      path: "/economy/accounts",
      body: { ownerType: "business" }
    });
    const transactions = await api.handle({
      method: "GET",
      path: "/economy/transactions",
      body: { accountId: "acct:b" }
    });
    const entries = await api.handle({
      method: "GET",
      path: "/economy/transactions/tx:1/ledger"
    });
    const limits = await api.handle({
      method: "GET",
      path: "/economy/limits"
    });

    expect(accounts).toEqual({
      status: 200,
      body: [expect.objectContaining({ id: "acct:b", ownerType: "business", balance: 350 })]
    });
    expect(transactions).toEqual({
      status: 200,
      body: [expect.objectContaining({ id: "tx:1", type: "economy.transfer" })]
    });
    expect(entries).toEqual({
      status: 200,
      body: [
        expect.objectContaining({ accountId: "acct:a", direction: "debit", amount: 250 }),
        expect.objectContaining({ accountId: "acct:b", direction: "credit", amount: 250 })
      ]
    });
    expect(limits).toEqual({
      status: 200,
      body: [expect.objectContaining({ id: "limit:transfer-small", limitJson: "{\"maxAmount\":200}" })]
    });
  });

  it("ingests QBCore runtime money updates as ledger-backed balance adjustments", async () => {
    const client = new FakeSpacetimeClient({
      accounts: [
        {
          id: "acct:cash",
          ownerType: "character",
          ownerId: "char:ada",
          currency: "cash",
          balance: 100,
          status: "active",
          createdAt: new Date("2026-05-18T11:00:00.000Z"),
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

    await expect(api.handle({
      method: "POST",
      path: "/qbcore/money-updates",
      body: {
        updates: [
          {
            transactionId: "tx:add",
            actorId: "player:7",
            characterId: "char:ada",
            moneyType: "cash",
            operation: "add",
            amount: 25,
            reason: "job payout",
            idempotencyKey: "money:add"
          },
          {
            transactionId: "tx:remove",
            actorId: "player:7",
            characterId: "char:ada",
            moneyType: "cash",
            operation: "remove",
            amount: 10,
            reason: "purchase",
            idempotencyKey: "money:remove"
          },
          {
            transactionId: "tx:set",
            actorId: "player:7",
            characterId: "char:ada",
            moneyType: "cash",
            operation: "set",
            amount: 80,
            reason: "admin correction",
            idempotencyKey: "money:set"
          }
        ]
      }
    })).resolves.toEqual({
      status: 200,
      body: { applied: 3 }
    });

    expect(client.reducerCalls).toEqual([
      {
        name: "admin_adjust_balance",
        args: {
          transactionId: "tx:add",
          actorId: "player:7",
          accountId: "acct:cash",
          direction: "credit",
          amount: 25,
          reason: "job payout",
          idempotencyKey: "money:add"
        }
      },
      {
        name: "admin_adjust_balance",
        args: {
          transactionId: "tx:remove",
          actorId: "player:7",
          accountId: "acct:cash",
          direction: "debit",
          amount: 10,
          reason: "purchase",
          idempotencyKey: "money:remove"
        }
      },
      {
        name: "admin_adjust_balance",
        args: {
          transactionId: "tx:set",
          actorId: "player:7",
          accountId: "acct:cash",
          direction: "debit",
          amount: 20,
          reason: "admin correction",
          idempotencyKey: "money:set"
        }
      }
    ]);
  });
});
