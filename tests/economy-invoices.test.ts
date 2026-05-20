import { describe, expect, it } from "vitest";
import { EconomyLedger } from "../src/core/economy.js";
import { PermissionEngine } from "../src/core/permissions.js";

describe("EconomyLedger invoices", () => {
  it("issues and pays an invoice through balanced ledger entries", () => {
    let nextId = 0;
    const permissions = new PermissionEngine({
      principals: [],
      edges: [],
      grants: [
        {
          principalId: "player:mechanic",
          permissionKey: "economy.issue_invoice",
          effect: "allow",
          source: "manual"
        },
        {
          principalId: "player:customer",
          permissionKey: "economy.pay_invoice",
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
          id: "acct:business",
          ownerType: "business",
          ownerId: "biz:mechanic",
          currency: "cash",
          balance: 100,
          status: "active"
        },
        {
          id: "acct:customer",
          ownerType: "character",
          ownerId: "char:customer",
          currency: "cash",
          balance: 1000,
          status: "active"
        }
      ]
    });

    const invoice = ledger.issueInvoice({
      actorPrincipalId: "player:mechanic",
      issuerAccountId: "acct:business",
      payerAccountId: "acct:customer",
      amount: 300,
      currency: "cash",
      reason: "repair"
    });
    const payment = ledger.payInvoice({
      actorPrincipalId: "player:customer",
      invoiceId: invoice.id,
      idempotencyKey: "pay-invoice-1"
    });

    expect(invoice.status).toBe("issued");
    expect(payment.transaction.type).toBe("economy.pay_invoice");
    expect(payment.entries).toEqual([
      expect.objectContaining({ accountId: "acct:customer", direction: "debit", amount: 300 }),
      expect.objectContaining({ accountId: "acct:business", direction: "credit", amount: 300 })
    ]);
    expect(ledger.getInvoice(invoice.id)?.status).toBe("paid");
    expect(ledger.getAccount("acct:business").balance).toBe(400);
    expect(ledger.getAccount("acct:customer").balance).toBe(700);
  });

  it("does not allow the same invoice to be paid twice", () => {
    const permissions = new PermissionEngine({
      principals: [],
      edges: [],
      grants: [
        {
          principalId: "player:mechanic",
          permissionKey: "economy.issue_invoice",
          effect: "allow",
          source: "manual"
        },
        {
          principalId: "player:customer",
          permissionKey: "economy.pay_invoice",
          effect: "allow",
          source: "manual"
        }
      ]
    });
    const ledger = new EconomyLedger({
      permissions,
      accounts: [
        {
          id: "acct:business",
          ownerType: "business",
          ownerId: "biz:mechanic",
          currency: "cash",
          balance: 100,
          status: "active"
        },
        {
          id: "acct:customer",
          ownerType: "character",
          ownerId: "char:customer",
          currency: "cash",
          balance: 1000,
          status: "active"
        }
      ]
    });

    const invoice = ledger.issueInvoice({
      actorPrincipalId: "player:mechanic",
      issuerAccountId: "acct:business",
      payerAccountId: "acct:customer",
      amount: 300,
      currency: "cash",
      reason: "repair"
    });

    ledger.payInvoice({
      actorPrincipalId: "player:customer",
      invoiceId: invoice.id,
      idempotencyKey: "pay-invoice-1"
    });

    expect(() =>
      ledger.payInvoice({
        actorPrincipalId: "player:customer",
        invoiceId: invoice.id,
        idempotencyKey: "pay-invoice-2"
      })
    ).toThrow("Invoice is not payable");
  });

  it("issues invoices idempotently for identical retries", () => {
    let nextId = 0;
    const permissions = new PermissionEngine({
      principals: [],
      edges: [],
      grants: [
        {
          principalId: "player:mechanic",
          permissionKey: "economy.issue_invoice",
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
          id: "acct:business",
          ownerType: "business",
          ownerId: "biz:mechanic",
          currency: "cash",
          balance: 100,
          status: "active"
        },
        {
          id: "acct:customer",
          ownerType: "character",
          ownerId: "char:customer",
          currency: "cash",
          balance: 1000,
          status: "active"
        }
      ]
    });

    const input = {
      actorPrincipalId: "player:mechanic",
      issuerAccountId: "acct:business",
      payerAccountId: "acct:customer",
      amount: 300,
      currency: "cash",
      reason: "repair",
      idempotencyKey: "issue-invoice-1"
    };

    const invoice = ledger.issueInvoice(input);
    const retry = ledger.issueInvoice(input);

    expect(retry).toEqual(invoice);
    expect(nextId).toBe(1);
    expect(ledger.getInvoice(invoice.id)).toEqual(invoice);
    expect(() => ledger.issueInvoice({ ...input, amount: 350 })).toThrow("Idempotency conflict: issue-invoice-1");
  });
});
