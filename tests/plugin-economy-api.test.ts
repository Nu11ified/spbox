import { createHash, createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { EconomyLedger } from "../src/core/economy.js";
import {
  PluginDeploymentManager,
  pluginBundleSigningPayload,
  type PluginBundleSigningPayloadInput,
  type PluginCapability
} from "../src/core/plugin-deployment.js";
import { PluginEconomyApi } from "../src/core/plugin-economy-api.js";
import { PermissionEngine } from "../src/core/permissions.js";

const now = new Date("2026-05-18T12:00:00.000Z");

function signedBundle(
  bytes: string,
  capabilities: PluginCapability[],
  overrides: Partial<PluginBundleSigningPayloadInput> = {},
  secret = "secret"
) {
  const bundleHash = createHash("sha256").update(bytes).digest("hex");
  return {
    bundleHash,
    signature: createHmac("sha256", secret).update(pluginBundleSigningPayload({
      id: "bundle-1",
      pluginId: "mechanic_core",
      version: "1.0.0",
      bundleHash,
      signerId: "trusted-signer",
      runtimeType: "js_sidecar",
      capabilities,
      ...overrides
    })).digest("hex")
  };
}

function createApi(
  capabilities: PluginCapability[] = [{ key: "economy.issue_invoice" }, { key: "economy.buy_item" }],
  options: {
    apiServerId?: string;
    deploymentServerId?: string;
    actorStates?: Record<string, Record<string, unknown>>;
  } = {}
) {
  let nextId = 0;
  const bundleBytes = "console.log('economy plugin')";
  const signed = signedBundle(bundleBytes, capabilities);
  const deployments = new PluginDeploymentManager({
    signers: [{ id: "trusted-signer", secret: "secret" }],
    now: () => now,
    idFactory: () => `deployment-${++nextId}`
  });
  deployments.registerBundle({
    id: "bundle-1",
    pluginId: "mechanic_core",
    version: "1.0.0",
    artifactUrl: "memory://mechanic_core.js",
    runtimeType: "js_sidecar",
    signerId: "trusted-signer",
    capabilities,
    ...signed
  });
  deployments.deploy({
    pluginId: "mechanic_core",
    bundleId: "bundle-1",
    serverId: options.deploymentServerId ?? "server-1",
    bundleBytes
  });

  const ledger = new EconomyLedger({
    permissions: new PermissionEngine({
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
          principalId: "player:shop",
          permissionKey: "economy.buy_item",
          effect: "allow",
          source: "manual"
        }
      ]
    }),
    now: () => now,
    idFactory: () => `id-${++nextId}`,
    accounts: [
      {
        id: "acct:mechanic",
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
      },
      {
        id: "acct:shop",
        ownerType: "business",
        ownerId: "biz:shop",
        currency: "cash",
        balance: 500,
        status: "active"
      }
    ]
  });

  return {
    ledger,
    api: new PluginEconomyApi({
      ledger,
      deployments,
      serverId: options.apiServerId,
      actorState: (actorPrincipalId) => options.actorStates?.[actorPrincipalId]
    })
  };
}

describe("PluginEconomyApi", () => {
  it("rejects blank plugin economy API server scope before capability lookup", () => {
    expect(() =>
      createApi(
        [{ key: "economy.buy_item" }],
        { apiServerId: " " }
      )
    ).toThrow("serverId is required");
  });

  it("rejects blank plugin economy action identities before capability lookup", () => {
    const { api, ledger } = createApi();

    expect(() =>
      api.buyItem(" ", {
        actorPrincipalId: "player:shop",
        buyerAccountId: "acct:customer",
        sellerAccountId: "acct:shop",
        amount: 50,
        currency: "cash",
        itemKey: "repair_kit",
        quantity: 1,
        idempotencyKey: "buy-blank-plugin"
      })
    ).toThrow("pluginId is required");

    expect(() =>
      api.buyItem("mechanic_core", {
        actorPrincipalId: " ",
        buyerAccountId: "acct:customer",
        sellerAccountId: "acct:shop",
        amount: 50,
        currency: "cash",
        itemKey: "repair_kit",
        quantity: 1,
        idempotencyKey: "buy-blank-actor"
      })
    ).toThrow("actorPrincipalId is required");

    expect(ledger.getAccount("acct:customer").balance).toBe(1000);
    expect(ledger.getAccount("acct:shop").balance).toBe(500);
  });

  it("allows active plugins with capabilities to issue invoices through the ledger", () => {
    const { api, ledger } = createApi();

    const invoice = api.issueInvoice("mechanic_core", {
      actorPrincipalId: "player:mechanic",
      issuerAccountId: "acct:mechanic",
      payerAccountId: "acct:customer",
      amount: 250,
      currency: "cash",
      reason: "repair"
    });

    expect(invoice).toEqual(expect.objectContaining({
      issuerAccountId: "acct:mechanic",
      payerAccountId: "acct:customer",
      amount: 250,
      status: "issued"
    }));
    expect(ledger.getInvoice(invoice.id)).toEqual(invoice);
  });

  it("rejects plugin economy actions when the plugin lacks the capability", () => {
    const { api } = createApi([{ key: "economy.issue_invoice" }]);

    expect(() =>
      api.buyItem("mechanic_core", {
        actorPrincipalId: "player:shop",
        buyerAccountId: "acct:customer",
        sellerAccountId: "acct:shop",
        amount: 50,
        currency: "cash",
        itemKey: "repair_kit",
        quantity: 1,
        idempotencyKey: "buy-1"
      })
    ).toThrow("Plugin lacks capability: economy.buy_item");
  });

  it("rejects malformed plugin economy amounts before capability lookup", () => {
    const { api, ledger } = createApi([{ key: "economy.issue_invoice" }]);

    expect(() =>
      api.buyItem("mechanic_core", {
        actorPrincipalId: "player:shop",
        buyerAccountId: "acct:customer",
        sellerAccountId: "acct:shop",
        amount: 0,
        currency: "cash",
        itemKey: "repair_kit",
        quantity: 1,
        idempotencyKey: "buy-invalid-amount"
      })
    ).toThrow("Amount must be a positive integer");

    expect(ledger.getAccount("acct:customer").balance).toBe(1000);
    expect(ledger.getAccount("acct:shop").balance).toBe(500);
  });

  it("rejects blank plugin economy account ids before capability lookup", () => {
    const { api, ledger } = createApi([{ key: "economy.issue_invoice" }]);

    expect(() =>
      api.buyItem("mechanic_core", {
        actorPrincipalId: "player:shop",
        buyerAccountId: " ",
        sellerAccountId: "acct:shop",
        amount: 50,
        currency: "cash",
        itemKey: "repair_kit",
        quantity: 1,
        idempotencyKey: "buy-blank-account"
      })
    ).toThrow("accountId is required");

    expect(ledger.getAccount("acct:customer").balance).toBe(1000);
    expect(ledger.getAccount("acct:shop").balance).toBe(500);
  });

  it("rejects malformed plugin economy shop item inputs before capability lookup", () => {
    const { api, ledger } = createApi([{ key: "economy.issue_invoice" }]);

    expect(() =>
      api.buyItem("mechanic_core", {
        actorPrincipalId: "player:shop",
        buyerAccountId: "acct:customer",
        sellerAccountId: "acct:shop",
        amount: 50,
        currency: "cash",
        itemKey: " ",
        quantity: 1,
        idempotencyKey: "buy-blank-item"
      })
    ).toThrow("itemKey is required");

    expect(() =>
      api.buyItem("mechanic_core", {
        actorPrincipalId: "player:shop",
        buyerAccountId: "acct:customer",
        sellerAccountId: "acct:shop",
        amount: 50,
        currency: "cash",
        itemKey: "repair_kit",
        quantity: 0,
        idempotencyKey: "buy-invalid-quantity"
      })
    ).toThrow("Quantity must be a positive integer");

    expect(ledger.getAccount("acct:customer").balance).toBe(1000);
    expect(ledger.getAccount("acct:shop").balance).toBe(500);
  });

  it("enforces capability max amount constraints before mutating balances", () => {
    const { api, ledger } = createApi([
      { key: "economy.buy_item", constraints: { maxAmount: 40 } }
    ]);

    expect(() =>
      api.buyItem("mechanic_core", {
        actorPrincipalId: "player:shop",
        buyerAccountId: "acct:customer",
        sellerAccountId: "acct:shop",
        amount: 50,
        currency: "cash",
        itemKey: "repair_kit",
        quantity: 1,
        idempotencyKey: "buy-1"
      })
    ).toThrow("Capability economy.buy_item maxAmount 40 exceeded");
    expect(ledger.getAccount("acct:customer").balance).toBe(1000);
    expect(ledger.getAccount("acct:shop").balance).toBe(500);
  });

  it("enforces capability account owner-type constraints before mutating balances", () => {
    const { api, ledger } = createApi([
      {
        key: "economy.buy_item",
        constraints: { allowed_account_owner_types: ["character"] }
      }
    ]);

    expect(() =>
      api.buyItem("mechanic_core", {
        actorPrincipalId: "player:shop",
        buyerAccountId: "acct:customer",
        sellerAccountId: "acct:shop",
        amount: 50,
        currency: "cash",
        itemKey: "repair_kit",
        quantity: 1,
        idempotencyKey: "buy-1"
      })
    ).toThrow("Capability economy.buy_item account owner type business is not allowed");
    expect(ledger.getAccount("acct:customer").balance).toBe(1000);
    expect(ledger.getAccount("acct:shop").balance).toBe(500);
  });

  it("rejects malformed capability account owner-type constraints before economy dispatch", () => {
    expect(() => createApi([
      {
        key: "economy.buy_item",
        constraints: { allowedAccountOwnerTypes: ["character", "admin"] }
      }
    ])).toThrow("Invalid allowedAccountOwnerTypes constraint for capability economy.buy_item");
  });

  it("can scope plugin economy capabilities to the runtime server before mutating balances", () => {
    const { api, ledger } = createApi(
      [{ key: "economy.buy_item" }],
      { apiServerId: "server-1", deploymentServerId: "server-2" }
    );

    expect(() =>
      api.buyItem("mechanic_core", {
        actorPrincipalId: "player:shop",
        buyerAccountId: "acct:customer",
        sellerAccountId: "acct:shop",
        amount: 50,
        currency: "cash",
        itemKey: "repair_kit",
        quantity: 1,
        idempotencyKey: "buy-1"
      })
    ).toThrow("Plugin is not active on server server-1: mechanic_core");
    expect(ledger.getAccount("acct:customer").balance).toBe(1000);
    expect(ledger.getAccount("acct:shop").balance).toBe(500);
  });

  it("enforces requires_on_duty economy capability constraints before mutating balances", () => {
    const { api, ledger } = createApi(
      [{ key: "economy.buy_item", constraints: { requires_on_duty: true } }],
      { actorStates: { "player:shop": { "job:on_duty": false } } }
    );

    expect(() =>
      api.buyItem("mechanic_core", {
        actorPrincipalId: "player:shop",
        buyerAccountId: "acct:customer",
        sellerAccountId: "acct:shop",
        amount: 50,
        currency: "cash",
        itemKey: "repair_kit",
        quantity: 1,
        idempotencyKey: "buy-1"
      })
    ).toThrow("Capability economy.buy_item requires actor to be on duty");
    expect(ledger.getAccount("acct:customer").balance).toBe(1000);
    expect(ledger.getAccount("acct:shop").balance).toBe(500);

    const allowed = createApi(
      [{ key: "economy.buy_item", constraints: { requires_on_duty: true } }],
      { actorStates: { "player:shop": { "job:on_duty": true } } }
    );
    const result = allowed.api.buyItem("mechanic_core", {
      actorPrincipalId: "player:shop",
      buyerAccountId: "acct:customer",
      sellerAccountId: "acct:shop",
      amount: 50,
      currency: "cash",
      itemKey: "repair_kit",
      quantity: 1,
      idempotencyKey: "buy-1"
    });
    expect(result.transaction.type).toBe("economy.buy_item");
    expect(allowed.ledger.getAccount("acct:customer").balance).toBe(950);
    expect(allowed.ledger.getAccount("acct:shop").balance).toBe(550);
  });

  it("rejects malformed requires_on_duty economy capability constraints before economy dispatch", () => {
    expect(() => createApi([
      { key: "economy.buy_item", constraints: { requires_on_duty: "yes" } }
    ])).toThrow("Invalid requiresOnDuty constraint for capability economy.buy_item");
  });
});
