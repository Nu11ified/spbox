import { describe, expect, it } from "vitest";
import { EconomyLedger } from "../src/core/economy.js";
import { PermissionEngine, type PermissionGrant } from "../src/core/permissions.js";

const grants: PermissionGrant[] = [
  { principalId: "player:admin", permissionKey: "economy.admin.adjust_balance", effect: "allow", source: "manual" },
  { principalId: "player:admin", permissionKey: "economy.deposit_cash", effect: "allow", source: "manual" },
  { principalId: "player:admin", permissionKey: "economy.withdraw_cash", effect: "allow", source: "manual" },
  { principalId: "player:payroll", permissionKey: "economy.pay_salary", effect: "allow", source: "manual" },
  { principalId: "player:police", permissionKey: "economy.fine_player", effect: "allow", source: "manual" }
];

function createLedger() {
  let nextId = 0;
  return new EconomyLedger({
    permissions: new PermissionEngine({ principals: [], edges: [], grants }),
    now: () => new Date("2026-05-18T12:00:00.000Z"),
    idFactory: () => `id-${++nextId}`,
    accounts: [
      {
        id: "acct:cash",
        ownerType: "character",
        ownerId: "char:cash",
        currency: "cash",
        balance: 500,
        status: "active"
      },
      {
        id: "acct:bank",
        ownerType: "character",
        ownerId: "char:bank",
        currency: "cash",
        balance: 1000,
        status: "active"
      },
      {
        id: "acct:business",
        ownerType: "business",
        ownerId: "biz:mechanic",
        currency: "cash",
        balance: 2000,
        status: "active"
      },
      {
        id: "acct:government",
        ownerType: "government",
        ownerId: "gov:city",
        currency: "cash",
        balance: 10000,
        status: "active"
      }
    ]
  });
}

describe("EconomyLedger primitives", () => {
  it("deposits and withdraws cash through balanced account transfers", () => {
    const ledger = createLedger();

    const deposit = ledger.depositCash({
      actorPrincipalId: "player:admin",
      cashAccountId: "acct:cash",
      bankAccountId: "acct:bank",
      amount: 200,
      currency: "cash",
      idempotencyKey: "deposit-1"
    });
    const withdraw = ledger.withdrawCash({
      actorPrincipalId: "player:admin",
      bankAccountId: "acct:bank",
      cashAccountId: "acct:cash",
      amount: 100,
      currency: "cash",
      idempotencyKey: "withdraw-1"
    });

    expect(deposit.transaction.type).toBe("economy.deposit_cash");
    expect(withdraw.transaction.type).toBe("economy.withdraw_cash");
    expect(ledger.getAccount("acct:cash").balance).toBe(400);
    expect(ledger.getAccount("acct:bank").balance).toBe(1100);
  });

  it("pays salary from business to character and records audit permission", () => {
    const ledger = createLedger();

    const result = ledger.paySalary({
      actorPrincipalId: "player:payroll",
      employerAccountId: "acct:business",
      employeeAccountId: "acct:bank",
      amount: 750,
      currency: "cash",
      reason: "mechanic_shift",
      idempotencyKey: "salary-1"
    });

    expect(result.transaction.type).toBe("economy.pay_salary");
    expect(result.audit.permissionKey).toBe("economy.pay_salary");
    expect(ledger.getAccount("acct:business").balance).toBe(1250);
    expect(ledger.getAccount("acct:bank").balance).toBe(1750);
  });

  it("fines a player into a government account", () => {
    const ledger = createLedger();

    const result = ledger.finePlayer({
      actorPrincipalId: "player:police",
      playerAccountId: "acct:bank",
      governmentAccountId: "acct:government",
      amount: 300,
      currency: "cash",
      reason: "speeding",
      idempotencyKey: "fine-1"
    });

    expect(result.transaction.type).toBe("economy.fine_player");
    expect(ledger.getAccount("acct:bank").balance).toBe(700);
    expect(ledger.getAccount("acct:government").balance).toBe(10300);
  });

  it("admin adjustments can credit or debit an account without bypassing audit", () => {
    const ledger = createLedger();

    const credit = ledger.adminAdjustBalance({
      actorPrincipalId: "player:admin",
      accountId: "acct:bank",
      direction: "credit",
      amount: 250,
      currency: "cash",
      reason: "support_refund",
      idempotencyKey: "adjust-credit"
    });
    const debit = ledger.adminAdjustBalance({
      actorPrincipalId: "player:admin",
      accountId: "acct:bank",
      direction: "debit",
      amount: 100,
      currency: "cash",
      reason: "correction",
      idempotencyKey: "adjust-debit"
    });

    expect(credit.entries).toEqual([
      expect.objectContaining({ accountId: "acct:bank", direction: "credit", amount: 250 })
    ]);
    expect(debit.entries).toEqual([
      expect.objectContaining({ accountId: "acct:bank", direction: "debit", amount: 100 })
    ]);
    expect(credit.audit.permissionKey).toBe("economy.admin.adjust_balance");
    expect(ledger.getAccount("acct:bank").balance).toBe(1150);
  });

  it("requires the matching permission for each primitive", () => {
    const ledger = new EconomyLedger({
      permissions: new PermissionEngine({ principals: [], edges: [], grants: [] }),
      accounts: [
        {
          id: "acct:cash",
          ownerType: "character",
          ownerId: "char:cash",
          currency: "cash",
          balance: 500,
          status: "active"
        },
        {
          id: "acct:bank",
          ownerType: "character",
          ownerId: "char:bank",
          currency: "cash",
          balance: 1000,
          status: "active"
        }
      ]
    });

    expect(() =>
      ledger.depositCash({
        actorPrincipalId: "player:user",
        cashAccountId: "acct:cash",
        bankAccountId: "acct:bank",
        amount: 100,
        currency: "cash",
        idempotencyKey: "deposit-denied"
      })
    ).toThrow("Permission denied: economy.deposit_cash");
  });
});
