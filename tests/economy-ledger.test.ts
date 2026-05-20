import { describe, expect, it } from "vitest";
import { EconomyLedger, accountStatementToCsv } from "../src/core/economy.js";
import { PermissionEngine } from "../src/core/permissions.js";

describe("EconomyLedger", () => {
  it("transfers money with balanced ledger entries and audit metadata", () => {
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
    const ledger = new EconomyLedger({
      permissions,
      accounts: [
        {
          id: "acct:a",
          ownerType: "character",
          ownerId: "char:a",
          currency: "cash",
          balance: 1000,
          status: "active"
        },
        {
          id: "acct:b",
          ownerType: "character",
          ownerId: "char:b",
          currency: "cash",
          balance: 100,
          status: "active"
        }
      ]
    });

    const result = ledger.transferMoney({
      actorPrincipalId: "player:admin",
      fromAccountId: "acct:a",
      toAccountId: "acct:b",
      amount: 250,
      currency: "cash",
      reason: "invoice_payment",
      idempotencyKey: "transfer-1"
    });

    expect(result.transaction.status).toBe("completed");
    expect(result.entries).toEqual([
      expect.objectContaining({ accountId: "acct:a", direction: "debit", amount: 250 }),
      expect.objectContaining({ accountId: "acct:b", direction: "credit", amount: 250 })
    ]);
    expect(ledger.getAccount("acct:a").balance).toBe(750);
    expect(ledger.getAccount("acct:b").balance).toBe(350);
    expect(result.audit).toEqual(
      expect.objectContaining({
        actorId: "player:admin",
        actionType: "economy.transfer",
        permissionKey: "economy.transfer",
        status: "succeeded"
      })
    );
    expect(ledger.getAuditLogs()).toEqual([
      expect.objectContaining({
        actorId: "player:admin",
        actionType: "economy.transfer",
        permissionKey: "economy.transfer",
        targetId: "acct:a->acct:b",
        status: "succeeded"
      })
    ]);
  });

  it("rejects transfers without permission", () => {
    const ledger = new EconomyLedger({
      permissions: new PermissionEngine({ principals: [], edges: [], grants: [] }),
      accounts: [
        {
          id: "acct:a",
          ownerType: "character",
          ownerId: "char:a",
          currency: "cash",
          balance: 1000,
          status: "active"
        },
        {
          id: "acct:b",
          ownerType: "character",
          ownerId: "char:b",
          currency: "cash",
          balance: 100,
          status: "active"
        }
      ]
    });

    expect(() =>
      ledger.transferMoney({
        actorPrincipalId: "player:user",
        fromAccountId: "acct:a",
        toAccountId: "acct:b",
        amount: 250,
        currency: "cash",
        reason: "invoice_payment",
        idempotencyKey: "transfer-1"
      })
    ).toThrow("Permission denied: economy.transfer");
  });

  it("returns the original transaction for an identical retry and rejects idempotency conflicts", () => {
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
    const ledger = new EconomyLedger({
      permissions,
      accounts: [
        {
          id: "acct:a",
          ownerType: "character",
          ownerId: "char:a",
          currency: "cash",
          balance: 1000,
          status: "active"
        },
        {
          id: "acct:b",
          ownerType: "character",
          ownerId: "char:b",
          currency: "cash",
          balance: 100,
          status: "active"
        }
      ]
    });
    const input = {
      actorPrincipalId: "player:admin",
      fromAccountId: "acct:a",
      toAccountId: "acct:b",
      amount: 250,
      currency: "cash",
      reason: "invoice_payment",
      idempotencyKey: "transfer-1"
    };

    const first = ledger.transferMoney(input);
    const retry = ledger.transferMoney(input);

    expect(retry.transaction.id).toBe(first.transaction.id);
    expect(ledger.getAuditLogs()).toEqual([first.audit]);
    expect(ledger.getAccount("acct:a").balance).toBe(750);
    expect(ledger.getAccount("acct:b").balance).toBe(350);
    expect(() => ledger.transferMoney({ ...input, amount: 251 })).toThrow("Idempotency conflict: transfer-1");
  });

  it("enforces economy limits before mutating balances or storing idempotency results", () => {
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
    const ledger = new EconomyLedger({
      permissions,
      limits: [
        {
          id: "limit:transfer-small",
          permissionKey: "economy.transfer",
          actionType: "economy.transfer",
          limit: {
            maxAmount: 200,
            allowedAccountOwnerTypes: ["character"]
          },
          enabled: true
        }
      ],
      accounts: [
        {
          id: "acct:a",
          ownerType: "character",
          ownerId: "char:a",
          currency: "cash",
          balance: 1000,
          status: "active"
        },
        {
          id: "acct:b",
          ownerType: "character",
          ownerId: "char:b",
          currency: "cash",
          balance: 100,
          status: "active"
        }
      ]
    });

    expect(() =>
      ledger.transferMoney({
        actorPrincipalId: "player:admin",
        fromAccountId: "acct:a",
        toAccountId: "acct:b",
        amount: 250,
        currency: "cash",
        reason: "invoice_payment",
        idempotencyKey: "transfer-limited"
      })
    ).toThrow("Economy limit exceeded: max amount 200");
    expect(ledger.getAccount("acct:a").balance).toBe(1000);
    expect(ledger.getAccount("acct:b").balance).toBe(100);

    const retryUnderLimit = ledger.transferMoney({
      actorPrincipalId: "player:admin",
      fromAccountId: "acct:a",
      toAccountId: "acct:b",
      amount: 150,
      currency: "cash",
      reason: "invoice_payment",
      idempotencyKey: "transfer-limited"
    });

    expect(retryUnderLimit.transaction.status).toBe("completed");
    expect(ledger.getAccount("acct:a").balance).toBe(850);
    expect(ledger.getAccount("acct:b").balance).toBe(250);
  });

  it("rejects blank economy reasons before mutating balances or storing idempotency results", () => {
    const permissions = new PermissionEngine({
      principals: [],
      edges: [],
      grants: [
        {
          principalId: "player:admin",
          permissionKey: "economy.transfer",
          effect: "allow",
          source: "manual"
        },
        {
          principalId: "player:admin",
          permissionKey: "economy.admin.adjust_balance",
          effect: "allow",
          source: "manual"
        }
      ]
    });
    const ledger = new EconomyLedger({
      permissions,
      accounts: [
        {
          id: "acct:a",
          ownerType: "character",
          ownerId: "char:a",
          currency: "cash",
          balance: 1000,
          status: "active"
        },
        {
          id: "acct:b",
          ownerType: "character",
          ownerId: "char:b",
          currency: "cash",
          balance: 100,
          status: "active"
        }
      ]
    });

    expect(() =>
      ledger.transferMoney({
        actorPrincipalId: "player:admin",
        fromAccountId: "acct:a",
        toAccountId: "acct:b",
        amount: 250,
        currency: "cash",
        reason: "   ",
        idempotencyKey: "blank-transfer"
      })
    ).toThrow("Reason must be a non-empty string");
    expect(ledger.getAccount("acct:a").balance).toBe(1000);
    expect(ledger.getAccount("acct:b").balance).toBe(100);

    const retryWithReason = ledger.transferMoney({
      actorPrincipalId: "player:admin",
      fromAccountId: "acct:a",
      toAccountId: "acct:b",
      amount: 250,
      currency: "cash",
      reason: "invoice_payment",
      idempotencyKey: "blank-transfer"
    });
    expect(retryWithReason.transaction.status).toBe("completed");
    expect(ledger.getAccount("acct:a").balance).toBe(750);
    expect(ledger.getAccount("acct:b").balance).toBe(350);

    expect(() =>
      ledger.adminAdjustBalance({
        actorPrincipalId: "player:admin",
        accountId: "acct:b",
        direction: "credit",
        amount: 50,
        currency: "cash",
        reason: "",
        idempotencyKey: "blank-adjust"
      })
    ).toThrow("Reason must be a non-empty string");
    expect(ledger.getAccount("acct:b").balance).toBe(350);
  });

  it("rejects transfers when an enabled economy limit excludes an account owner type", () => {
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
    const ledger = new EconomyLedger({
      permissions,
      limits: [
        {
          id: "limit:characters-only",
          permissionKey: "economy.transfer",
          actionType: "economy.transfer",
          limit: { allowedAccountOwnerTypes: ["character"] },
          enabled: true
        }
      ],
      accounts: [
        {
          id: "acct:a",
          ownerType: "character",
          ownerId: "char:a",
          currency: "cash",
          balance: 1000,
          status: "active"
        },
        {
          id: "acct:b",
          ownerType: "business",
          ownerId: "biz:b",
          currency: "cash",
          balance: 100,
          status: "active"
        }
      ]
    });

    expect(() =>
      ledger.transferMoney({
        actorPrincipalId: "player:admin",
        fromAccountId: "acct:a",
        toAccountId: "acct:b",
        amount: 150,
        currency: "cash",
        reason: "invoice_payment",
        idempotencyKey: "transfer-business-denied"
      })
    ).toThrow("Economy limit exceeded: account owner type business is not allowed");
    expect(ledger.getAccount("acct:a").balance).toBe(1000);
    expect(ledger.getAccount("acct:b").balance).toBe(100);
  });

  it("exposes transaction history and ledger drilldown for audit dashboards", () => {
    let nextId = 0;
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
    const ledger = new EconomyLedger({
      permissions,
      now: () => new Date("2026-05-18T12:00:00.000Z"),
      idFactory: () => `id-${++nextId}`,
      accounts: [
        {
          id: "acct:a",
          ownerType: "character",
          ownerId: "char:a",
          currency: "cash",
          balance: 1000,
          status: "active"
        },
        {
          id: "acct:b",
          ownerType: "business",
          ownerId: "biz:b",
          currency: "cash",
          balance: 100,
          status: "active"
        }
      ]
    });

    const transfer = ledger.transferMoney({
      actorPrincipalId: "player:admin",
      fromAccountId: "acct:a",
      toAccountId: "acct:b",
      amount: 250,
      currency: "cash",
      reason: "invoice_payment",
      idempotencyKey: "transfer-1"
    });

    expect(ledger.listTransactions()).toEqual([
      expect.objectContaining({
        id: transfer.transaction.id,
        type: "economy.transfer",
        actorId: "player:admin",
        status: "completed"
      })
    ]);
    expect(ledger.listTransactions({ accountId: "acct:b" })).toEqual([
      expect.objectContaining({ id: transfer.transaction.id })
    ]);
    expect(ledger.getLedgerEntriesForTransaction(transfer.transaction.id)).toEqual([
      expect.objectContaining({ accountId: "acct:a", direction: "debit", amount: 250 }),
      expect.objectContaining({ accountId: "acct:b", direction: "credit", amount: 250 })
    ]);
    expect(ledger.searchAccounts({ ownerType: "business" })).toEqual([
      expect.objectContaining({ id: "acct:b", ownerId: "biz:b" })
    ]);
  });

  it("builds exportable account statements with opening and closing balances", () => {
    let nextId = 0;
    const permissions = new PermissionEngine({
      principals: [],
      edges: [],
      grants: [
        { principalId: "player:admin", permissionKey: "economy.transfer", effect: "allow", source: "manual" }
      ]
    });
    const dates = [
      new Date("2026-05-18T10:00:00.000Z"),
      new Date("2026-05-18T11:00:00.000Z"),
      new Date("2026-05-18T12:00:00.000Z")
    ];
    const ledger = new EconomyLedger({
      permissions,
      now: () => dates.shift() ?? new Date("2026-05-18T12:00:00.000Z"),
      idFactory: () => `id-${++nextId}`,
      accounts: [
        { id: "acct:a", ownerType: "character", ownerId: "char:a", currency: "cash", balance: 1000, status: "active" },
        { id: "acct:b", ownerType: "business", ownerId: "biz:b", currency: "cash", balance: 100, status: "active" }
      ]
    });

    ledger.transferMoney({
      actorPrincipalId: "player:admin",
      fromAccountId: "acct:a",
      toAccountId: "acct:b",
      amount: 100,
      currency: "cash",
      reason: "morning_sale",
      idempotencyKey: "transfer-1"
    });
    ledger.transferMoney({
      actorPrincipalId: "player:admin",
      fromAccountId: "acct:a",
      toAccountId: "acct:b",
      amount: 250,
      currency: "cash",
      reason: "midday_sale",
      idempotencyKey: "transfer-2"
    });
    ledger.transferMoney({
      actorPrincipalId: "player:admin",
      fromAccountId: "acct:b",
      toAccountId: "acct:a",
      amount: 50,
      currency: "cash",
      reason: "refund",
      idempotencyKey: "transfer-3"
    });

    const statement = ledger.getAccountStatement({
      accountId: "acct:b",
      from: new Date("2026-05-18T11:00:00.000Z"),
      to: new Date("2026-05-18T11:59:59.000Z")
    });

    expect(statement).toEqual({
      account: expect.objectContaining({ id: "acct:b", balance: 400 }),
      from: new Date("2026-05-18T11:00:00.000Z"),
      to: new Date("2026-05-18T11:59:59.000Z"),
      openingBalance: 200,
      closingBalance: 450,
      totalCredits: 250,
      totalDebits: 0,
      entries: [
        expect.objectContaining({ accountId: "acct:b", direction: "credit", amount: 250 })
      ]
    });
    expect(accountStatementToCsv(statement)).toBe([
      "account_id,owner_type,owner_id,currency,from,to,opening_balance,closing_balance,total_debits,total_credits",
      "acct:b,business,biz:b,cash,2026-05-18T11:00:00.000Z,2026-05-18T11:59:59.000Z,200,450,0,250",
      "",
      "entry_id,transaction_id,created_at,account_id,direction,amount,reason,metadata_json",
      "id-7,id-5,2026-05-18T11:00:00.000Z,acct:b,credit,250,midday_sale,"
    ].join("\n"));
  });

  it("filters suspicious economy activity by amount, account, and transaction type", () => {
    let nextId = 0;
    const permissions = new PermissionEngine({
      principals: [],
      edges: [],
      grants: [
        { principalId: "player:admin", permissionKey: "economy.transfer", effect: "allow", source: "manual" },
        { principalId: "player:admin", permissionKey: "economy.admin.adjust_balance", effect: "allow", source: "manual" }
      ]
    });
    const ledger = new EconomyLedger({
      permissions,
      now: () => new Date("2026-05-18T12:00:00.000Z"),
      idFactory: () => `id-${++nextId}`,
      accounts: [
        { id: "acct:a", ownerType: "character", ownerId: "char:a", currency: "cash", balance: 10000, status: "active" },
        { id: "acct:b", ownerType: "business", ownerId: "biz:b", currency: "cash", balance: 100, status: "active" }
      ]
    });

    ledger.transferMoney({
      actorPrincipalId: "player:admin",
      fromAccountId: "acct:a",
      toAccountId: "acct:b",
      amount: 100,
      currency: "cash",
      reason: "small_sale",
      idempotencyKey: "transfer-1"
    });
    ledger.transferMoney({
      actorPrincipalId: "player:admin",
      fromAccountId: "acct:a",
      toAccountId: "acct:b",
      amount: 5000,
      currency: "cash",
      reason: "large_sale",
      idempotencyKey: "transfer-2"
    });
    ledger.adminAdjustBalance({
      actorPrincipalId: "player:admin",
      accountId: "acct:b",
      direction: "credit",
      amount: 750,
      currency: "cash",
      reason: "manual_fix",
      idempotencyKey: "adjust-1"
    });

    expect(ledger.findSuspiciousActivity({ minAmount: 1000, accountId: "acct:b" })).toEqual([
      expect.objectContaining({
        transaction: expect.objectContaining({ type: "economy.transfer" }),
        maxEntryAmount: 5000,
        reasons: ["amount_at_or_above_threshold"]
      })
    ]);
    expect(ledger.findSuspiciousActivity({ type: "economy.admin.adjust_balance" })).toEqual([
      expect.objectContaining({
        transaction: expect.objectContaining({ type: "economy.admin.adjust_balance" }),
        reasons: ["admin_adjustment"]
      })
    ]);
  });
});
