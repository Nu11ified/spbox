import { describe, expect, it } from "vitest";
import { EconomyLedger } from "../src/core/economy.js";
import { PermissionEngine, type PermissionGrant } from "../src/core/permissions.js";

const grants: PermissionGrant[] = [
  { principalId: "player:shop", permissionKey: "economy.buy_item", effect: "allow", source: "manual" },
  { principalId: "player:shop", permissionKey: "economy.sell_item", effect: "allow", source: "manual" },
  { principalId: "player:tax", permissionKey: "economy.charge_tax", effect: "allow", source: "manual" },
  { principalId: "player:owner", permissionKey: "economy.business_payout", effect: "allow", source: "manual" },
  { principalId: "player:admin", permissionKey: "economy.void_transaction", effect: "allow", source: "manual" },
  { principalId: "player:admin", permissionKey: "economy.admin.adjust_balance", effect: "allow", source: "manual" }
];

function createLedger() {
  let nextId = 0;
  return new EconomyLedger({
    permissions: new PermissionEngine({ principals: [], edges: [], grants }),
    now: () => new Date("2026-05-18T12:00:00.000Z"),
    idFactory: () => `id-${++nextId}`,
    accounts: [
      {
        id: "acct:player",
        ownerType: "character",
        ownerId: "char:player",
        currency: "cash",
        balance: 1000,
        status: "active"
      },
      {
        id: "acct:shop",
        ownerType: "business",
        ownerId: "biz:shop",
        currency: "cash",
        balance: 500,
        status: "active"
      },
      {
        id: "acct:government",
        ownerType: "government",
        ownerId: "gov:city",
        currency: "cash",
        balance: 10000,
        status: "active"
      },
      {
        id: "acct:owner",
        ownerType: "character",
        ownerId: "char:owner",
        currency: "cash",
        balance: 250,
        status: "active"
      }
    ]
  });
}

describe("EconomyLedger advanced workflows", () => {
  it("buys and sells items through business accounts", () => {
    const ledger = createLedger();

    const purchase = ledger.buyItem({
      actorPrincipalId: "player:shop",
      buyerAccountId: "acct:player",
      sellerAccountId: "acct:shop",
      amount: 120,
      currency: "cash",
      itemKey: "repair_kit",
      quantity: 2,
      idempotencyKey: "buy-1"
    });
    const sale = ledger.sellItem({
      actorPrincipalId: "player:shop",
      sellerAccountId: "acct:player",
      buyerAccountId: "acct:shop",
      amount: 50,
      currency: "cash",
      itemKey: "scrap",
      quantity: 5,
      idempotencyKey: "sell-1"
    });

    expect(purchase.transaction.type).toBe("economy.buy_item");
    expect(sale.transaction.type).toBe("economy.sell_item");
    expect(ledger.getAccount("acct:player").balance).toBe(930);
    expect(ledger.getAccount("acct:shop").balance).toBe(570);
  });

  it("charges tax into a government account", () => {
    const ledger = createLedger();

    const result = ledger.chargeTax({
      actorPrincipalId: "player:tax",
      payerAccountId: "acct:player",
      governmentAccountId: "acct:government",
      amount: 80,
      currency: "cash",
      reason: "sales_tax",
      idempotencyKey: "tax-1"
    });

    expect(result.transaction.type).toBe("economy.charge_tax");
    expect(ledger.getAccount("acct:player").balance).toBe(920);
    expect(ledger.getAccount("acct:government").balance).toBe(10080);
  });

  it("pays business owner from business account", () => {
    const ledger = createLedger();

    const result = ledger.businessPayout({
      actorPrincipalId: "player:owner",
      businessAccountId: "acct:shop",
      payoutAccountId: "acct:owner",
      amount: 200,
      currency: "cash",
      reason: "weekly_profit",
      idempotencyKey: "payout-1"
    });

    expect(result.transaction.type).toBe("economy.business_payout");
    expect(ledger.getAccount("acct:shop").balance).toBe(300);
    expect(ledger.getAccount("acct:owner").balance).toBe(450);
  });

  it("voids a previous transaction by writing reversal entries", () => {
    const ledger = createLedger();
    const purchase = ledger.buyItem({
      actorPrincipalId: "player:shop",
      buyerAccountId: "acct:player",
      sellerAccountId: "acct:shop",
      amount: 120,
      currency: "cash",
      itemKey: "repair_kit",
      quantity: 2,
      idempotencyKey: "buy-1"
    });

    const voided = ledger.voidTransaction({
      actorPrincipalId: "player:admin",
      transactionId: purchase.transaction.id,
      reason: "refund",
      idempotencyKey: "void-buy-1"
    });

    expect(voided.transaction.type).toBe("economy.void_transaction");
    expect(voided.entries).toEqual([
      expect.objectContaining({ accountId: "acct:player", direction: "credit", amount: 120 }),
      expect.objectContaining({ accountId: "acct:shop", direction: "debit", amount: 120 })
    ]);
    expect(ledger.getAccount("acct:player").balance).toBe(1000);
    expect(ledger.getAccount("acct:shop").balance).toBe(500);
    expect(() =>
      ledger.voidTransaction({
        actorPrincipalId: "player:admin",
        transactionId: purchase.transaction.id,
        reason: "duplicate_refund",
        idempotencyKey: "void-buy-2"
      })
    ).toThrow("Transaction is already voided");
  });

  it("does not void when reversal debit would overdraw an account", () => {
    const ledger = createLedger();
    const purchase = ledger.buyItem({
      actorPrincipalId: "player:shop",
      buyerAccountId: "acct:player",
      sellerAccountId: "acct:shop",
      amount: 120,
      currency: "cash",
      itemKey: "repair_kit",
      quantity: 2,
      idempotencyKey: "buy-1"
    });
    ledger.adminAdjustBalance({
      actorPrincipalId: "player:admin",
      accountId: "acct:shop",
      direction: "debit",
      amount: 600,
      currency: "cash",
      reason: "cash_out",
      idempotencyKey: "drain-shop"
    });

    expect(() =>
      ledger.voidTransaction({
        actorPrincipalId: "player:admin",
        transactionId: purchase.transaction.id,
        reason: "refund",
        idempotencyKey: "void-buy-1"
      })
    ).toThrow("Insufficient funds");
  });
});
