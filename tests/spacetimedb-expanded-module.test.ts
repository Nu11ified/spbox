import { moduleSource, readFileSync } from "./spacetimedb-source.js";
import { describe, expect, it } from "vitest";

describe("expanded SpacetimeDB module contract", () => {
  const lib = moduleSource;

  it("declares economy tables for accounts, transactions, ledger entries, and invoices", () => {
    const source = lib();

    for (const table of ["accounts", "transactions", "ledger_entries", "invoices"]) {
      expect(source).toContain(`#[table(name = ${table}`);
    }
  });

  it("declares gameplay and hook tables", () => {
    const source = lib();

    for (const table of [
      "items",
      "jobs",
      "vehicles",
      "locations",
      "characters",
      "inventory_stacks",
      "character_jobs",
      "plugin_hooks"
    ]) {
      expect(source).toContain(`#[table(name = ${table}`);
    }
  });

  it("declares reducer names for economy, gameplay, and hook workflows", () => {
    const source = lib();

    for (const reducer of [
      "transfer_money",
      "deposit_cash",
      "withdraw_cash",
      "issue_invoice",
      "pay_invoice",
      "pay_salary",
      "fine_player",
      "charge_tax",
      "business_payout",
      "admin_adjust_balance",
      "void_transaction",
      "grant_item",
      "remove_item",
      "assign_job",
      "register_item",
      "register_job",
      "register_vehicle",
      "register_location",
      "upsert_character",
      "register_plugin_hook",
      "set_plugin_hooks_enabled"
    ]) {
      expect(source).toContain(`pub fn ${reducer}`);
    }
  });
});
