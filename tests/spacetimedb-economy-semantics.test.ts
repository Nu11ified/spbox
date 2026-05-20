import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("SpacetimeDB economy reducer semantics", () => {
  const source = () => readFileSync("spacetimedb/src/lib.rs", "utf8");

  it("declares account creation and idempotency helpers", () => {
    const lib = source();

    expect(lib).toContain("pub fn create_account");
    expect(lib).toContain("validate_account_owner_type(&owner_type)?");
    expect(lib).toContain("fn transaction_exists");
    expect(lib).toContain("fn ensure_idempotent_transfer");
    expect(lib).toContain("fn transfer_metadata_json");
    expect(lib).toContain("idempotency_key");
  });

  it("validates account owner types before creating accounts", () => {
    const lib = source();

    expect(lib).toContain("fn validate_account_owner_type");
    expect(lib).toContain('"character" | "business" | "government" | "society" | "plugin"');
    expect(lib).toContain('Err("invalid account owner type".to_string())');
    expect(lib.indexOf("validate_account_owner_type(&owner_type)?")).toBeLessThan(
      lib.indexOf("ctx.db.accounts().insert")
    );
  });

  it("rejects blank account creation fields before owner type validation or insert", () => {
    const lib = source();
    const createBody = lib.slice(
      lib.indexOf("pub fn create_account"),
      lib.indexOf("#[reducer]\npub fn upsert_economy_limit")
    );

    expect(createBody).toContain("validate_account_creation_identity(&id, &owner_type, &owner_id, &currency)?");
    expect(lib).toContain("fn validate_account_creation_identity");
    expect(lib).toContain('return Err("account id is required".to_string())');
    expect(lib).toContain('return Err("account owner type is required".to_string())');
    expect(lib).toContain('return Err("account owner id is required".to_string())');
    expect(lib).toContain('return Err("account currency is required".to_string())');
    expect(createBody.indexOf("validate_account_creation_identity")).toBeLessThan(
      createBody.indexOf("validate_account_owner_type")
    );
    expect(createBody.indexOf("validate_account_creation_identity")).toBeLessThan(
      createBody.indexOf("ctx.db.accounts().insert")
    );
  });

  it("rejects blank economy limit fields before permission lookup or insert", () => {
    const lib = source();
    const limitBody = lib.slice(
      lib.indexOf("pub fn upsert_economy_limit"),
      lib.indexOf("fn validate_economy_limit_json")
    );

    expect(limitBody).toContain("validate_economy_limit_identity(&id, &permission_key, &action_type, &limit_json)?");
    expect(lib).toContain("fn validate_economy_limit_identity");
    expect(lib).toContain('return Err("economy limit id is required".to_string())');
    expect(lib).toContain('return Err("economy limit permission key is required".to_string())');
    expect(lib).toContain('return Err("economy limit action type is required".to_string())');
    expect(lib).toContain('return Err("economy limit json is required".to_string())');
    expect(limitBody.indexOf("validate_economy_limit_identity")).toBeLessThan(
      limitBody.indexOf("permission_key_exists(ctx, &permission_key)")
    );
    expect(limitBody.indexOf("validate_economy_limit_identity")).toBeLessThan(
      limitBody.indexOf("ctx.db.economy_limits().insert")
    );
  });

  it("tracks account creation and update timestamps for economy auditability", () => {
    const lib = source();

    expect(lib).toContain("pub created_at: Timestamp");
    expect(lib).toContain("pub updated_at: Timestamp");
    expect(lib).toContain("created_at: ctx.timestamp");
    expect(lib).toContain("updated_at: ctx.timestamp");
    expect(lib).toContain("from.updated_at = ctx.timestamp");
    expect(lib).toContain("to.updated_at = ctx.timestamp");
    expect(lib).toContain("account.updated_at = ctx.timestamp");
    expect(lib).toContain("payer.updated_at = ctx.timestamp");
    expect(lib).toContain("issuer.updated_at = ctx.timestamp");
  });

  it("transfer_money mutates account balances and blocks insufficient funds", () => {
    const lib = source();

    expect(lib).toContain("from.balance -= amount");
    expect(lib).toContain("to.balance += amount");
    expect(lib).toContain('return Err("insufficient funds".to_string())');
    expect(lib).toContain("ctx.db.accounts().id().update(from)");
    expect(lib).toContain("ctx.db.accounts().id().update(to)");
  });

  it("writes transfer audit rows with before and after balances", () => {
    const lib = source();
    const transferHelperBody = lib.slice(
      lib.indexOf("fn post_account_transfer"),
      lib.indexOf("fn validate_account_transfer_identity")
    );

    expect(transferHelperBody).toContain("let before_json = account_pair_balance_json(&from_account_id, from.balance, &to_account_id, to.balance);");
    expect(transferHelperBody).toContain("let after_json = account_pair_balance_json(&from_account_id, from.balance, &to_account_id, to.balance);");
    expect(transferHelperBody).toContain("ctx.db.audit_logs().insert(AuditLog");
    expect(transferHelperBody).toContain('id: format!("{transaction_id}:audit")');
    expect(transferHelperBody).toContain('target_type: "account_transfer".to_string()');
    expect(transferHelperBody).toContain('target_id: format!("{from_account_id}->{to_account_id}")');
    expect(transferHelperBody).toContain("permission_key: economy_permission_key(&transaction_type).to_string()");
    expect(transferHelperBody).toContain('status: "succeeded".to_string()');
    expect(transferHelperBody.indexOf("let before_json")).toBeLessThan(
      transferHelperBody.indexOf("from.balance -= amount")
    );
    expect(transferHelperBody.indexOf("let after_json")).toBeGreaterThan(
      transferHelperBody.indexOf("to.balance += amount")
    );
    expect(lib).toContain("fn account_pair_balance_json");
  });

  it("rejects blank account transfer fields before amount validation, idempotency, lookup, or ledger mutation", () => {
    const lib = source();
    const transferHelperBody = lib.slice(
      lib.indexOf("fn post_account_transfer"),
      lib.indexOf("fn post_single_account_transaction")
    );

    expect(transferHelperBody).toContain(
      "validate_account_transfer_identity(&transaction_id, &actor_id, &transaction_type, &from_account_id, &to_account_id, &idempotency_key)?"
    );
    expect(lib).toContain("fn validate_account_transfer_identity");
    expect(lib).toContain('return Err("account transfer transaction id is required".to_string())');
    expect(lib).toContain('return Err("account transfer actor id is required".to_string())');
    expect(lib).toContain('return Err("account transfer type is required".to_string())');
    expect(lib).toContain('return Err("account transfer source account id is required".to_string())');
    expect(lib).toContain('return Err("account transfer destination account id is required".to_string())');
    expect(lib).toContain('return Err("account transfer idempotency key is required".to_string())');
    expect(transferHelperBody.indexOf("validate_account_transfer_identity")).toBeLessThan(
      transferHelperBody.indexOf("amount <= 0")
    );
    expect(transferHelperBody.indexOf("validate_account_transfer_identity")).toBeLessThan(
      transferHelperBody.indexOf("ensure_idempotent")
    );
    expect(transferHelperBody.indexOf("validate_account_transfer_identity")).toBeLessThan(
      transferHelperBody.indexOf("ctx.db.accounts().id().find")
    );
  });

  it("rejects idempotency key reuse with a different transfer payload", () => {
    const lib = source();

    expect(lib).toContain('return Err("idempotency conflict".to_string())');
    expect(lib).toContain("transaction.actor_id == actor_id");
    expect(lib).toContain("transaction.metadata_json == metadata_json");
  });

  it("implements named economy reducers through transaction and ledger helpers", () => {
    const lib = source();

    for (const reducer of [
      "deposit_cash",
      "withdraw_cash",
      "pay_salary",
      "buy_item",
      "sell_item",
      "fine_player",
      "charge_tax",
      "business_payout",
      "admin_adjust_balance"
    ]) {
      expect(lib).toContain(`pub fn ${reducer}`);
    }
    expect(lib).toContain("fn post_single_account_transaction");
    expect(lib).toContain("fn post_account_transfer");
    expect(lib).toContain("transaction_type: String");
    expect(lib).toContain("direction: String");
  });

  it("writes single-account audit rows with before and after balances", () => {
    const lib = source();
    const singleAccountHelperBody = lib.slice(
      lib.indexOf("fn post_single_account_transaction"),
      lib.indexOf("fn validate_single_account_transaction_identity")
    );

    expect(singleAccountHelperBody).toContain("let before_json = account_balance_json(&account_id, account.balance);");
    expect(singleAccountHelperBody).toContain("let after_json = account_balance_json(&account_id, account.balance);");
    expect(singleAccountHelperBody).toContain("ctx.db.audit_logs().insert(AuditLog");
    expect(singleAccountHelperBody).toContain('id: format!("{transaction_id}:audit")');
    expect(singleAccountHelperBody).toContain('target_type: "account".to_string()');
    expect(singleAccountHelperBody).toContain("target_id: account_id.clone()");
    expect(singleAccountHelperBody).toContain("permission_key: economy_permission_key(&transaction_type).to_string()");
    expect(singleAccountHelperBody).toContain('status: "succeeded".to_string()');
    expect(singleAccountHelperBody.indexOf("let before_json")).toBeLessThan(
      singleAccountHelperBody.indexOf("account.balance -=")
    );
    expect(singleAccountHelperBody.indexOf("let after_json")).toBeGreaterThan(
      singleAccountHelperBody.indexOf("account.balance +=")
    );
    expect(lib).toContain("fn account_balance_json");
  });

  it("rejects blank single-account transaction fields before amount validation, idempotency, lookup, or ledger mutation", () => {
    const lib = source();
    const singleAccountHelperBody = lib.slice(
      lib.indexOf("fn post_single_account_transaction"),
      lib.indexOf("fn enforce_economy_limits")
    );

    expect(singleAccountHelperBody).toContain(
      "validate_single_account_transaction_identity(&transaction_id, &actor_id, &transaction_type, &account_id, &direction, &idempotency_key)?"
    );
    expect(lib).toContain("fn validate_single_account_transaction_identity");
    expect(lib).toContain('return Err("single-account transaction id is required".to_string())');
    expect(lib).toContain('return Err("single-account actor id is required".to_string())');
    expect(lib).toContain('return Err("single-account transaction type is required".to_string())');
    expect(lib).toContain('return Err("single-account account id is required".to_string())');
    expect(lib).toContain('return Err("single-account direction is required".to_string())');
    expect(lib).toContain('return Err("single-account idempotency key is required".to_string())');
    expect(singleAccountHelperBody.indexOf("validate_single_account_transaction_identity")).toBeLessThan(
      singleAccountHelperBody.indexOf("amount <= 0")
    );
    expect(singleAccountHelperBody.indexOf("validate_single_account_transaction_identity")).toBeLessThan(
      singleAccountHelperBody.indexOf("ensure_idempotent")
    );
    expect(singleAccountHelperBody.indexOf("validate_single_account_transaction_identity")).toBeLessThan(
      singleAccountHelperBody.indexOf("ctx.db.accounts().id().find")
    );
  });

  it("requires actor permission grants before economy reducer mutations", () => {
    const lib = source();
    const transferHelperBody = lib.slice(
      lib.indexOf("fn post_account_transfer"),
      lib.indexOf("fn post_single_account_transaction")
    );
    const singleAccountHelperBody = lib.slice(
      lib.indexOf("fn post_single_account_transaction"),
      lib.indexOf("fn enforce_economy_limits")
    );
    const voidBody = lib.slice(
      lib.indexOf("pub fn void_transaction"),
      lib.indexOf("fn reverse_ledger_direction")
    );
    const issueInvoiceBody = lib.slice(
      lib.indexOf("pub fn issue_invoice"),
      lib.indexOf("fn validate_economy_reason")
    );
    const payInvoiceBody = lib.slice(
      lib.indexOf("pub fn pay_invoice"),
      lib.indexOf("fn invoice_payment_metadata_json")
    );

    expect(lib).toContain("fn assert_economy_permission(");
    expect(lib).toContain("fn economy_permission_key(transaction_type: &str) -> &str");
    expect(lib).toContain('return Err("economy permission denied".to_string())');
    expect(lib).toContain("grant.effect == \"deny\"");
    expect(lib).toContain("grant.expires_at.is_some_and(|expires_at| expires_at <= ctx.timestamp)");
    expect(transferHelperBody).toContain("assert_economy_permission(ctx, &actor_id, &transaction_type)?");
    expect(singleAccountHelperBody).toContain("assert_economy_permission(ctx, &actor_id, &transaction_type)?");
    expect(voidBody).toContain('assert_economy_permission(ctx, &actor_id, "economy.void_transaction")?');
    expect(issueInvoiceBody).toContain('assert_economy_permission(ctx, &issued_by, "economy.issue_invoice")?');
    expect(payInvoiceBody).toContain('assert_economy_permission(ctx, &actor_id, "economy.pay_invoice")?');
    expect(transferHelperBody.indexOf("assert_economy_permission")).toBeLessThan(
      transferHelperBody.indexOf("from.balance -= amount")
    );
    expect(singleAccountHelperBody.indexOf("assert_economy_permission")).toBeLessThan(
      singleAccountHelperBody.indexOf("account.balance")
    );
  });

  it("resolves economy permissions through principal edges with deny override", () => {
    const lib = source();
    const permissionHelperBody = lib.slice(
      lib.indexOf("fn assert_economy_permission"),
      lib.indexOf("fn economy_permission_key")
    );

    expect(permissionHelperBody).toContain("let mut principals_to_check = vec![actor_id.to_string()]");
    expect(permissionHelperBody).toContain("let mut visited_principals: Vec<String> = Vec::new()");
    expect(permissionHelperBody).toContain("ctx.db.principal_edges().iter()");
    expect(permissionHelperBody).toContain("edge.child_principal_id == principal_id");
    expect(permissionHelperBody).toContain("edge.expires_at.is_some_and(|expires_at| expires_at <= ctx.timestamp)");
    expect(permissionHelperBody).toContain("principals_to_check.push(edge.parent_principal_id)");
    expect(permissionHelperBody).toContain("grant.principal_id != principal_id");
    expect(permissionHelperBody.indexOf("grant.effect == \"deny\"")).toBeLessThan(
      permissionHelperBody.indexOf("allowed = true")
    );
  });

  it("rejects blank economy reasons before reducer ledger mutation", () => {
    const lib = source();

    expect(lib).toContain("fn validate_economy_reason");
    expect(lib).toContain('return Err("reason must be a non-empty string".to_string())');
    expect(lib.indexOf("validate_economy_reason(&reason)?")).toBeLessThan(
      lib.indexOf("let metadata_json = metadata_json.unwrap_or_else")
    );
    expect(lib.indexOf("validate_economy_reason(&reason)?")).toBeLessThan(
      lib.indexOf("let metadata_json = single_account_metadata_json")
    );
    expect(lib.indexOf("validate_economy_reason(&reason)?")).toBeLessThan(
      lib.indexOf("let metadata_json = format!(")
    );
    expect(lib.indexOf("validate_economy_reason(&reason)?")).toBeLessThan(
      lib.indexOf("let metadata_json = invoice_issue_metadata_json")
    );
  });

  it("void_transaction writes reversal ledger entries and prevents double voids", () => {
    const lib = source();

    expect(lib).toContain("pub fn void_transaction");
    expect(lib).toContain("voided_transaction_id");
    expect(lib).toContain('return Err("transaction is already voided".to_string())');
    expect(lib).toContain('transaction_type: "economy.void_transaction".to_string()');
    expect(lib).toContain("reverse_ledger_direction");
  });

  it("writes void transaction audit rows with before and after balances", () => {
    const lib = source();
    const voidBody = lib.slice(
      lib.indexOf("pub fn void_transaction"),
      lib.indexOf("fn validate_void_transaction_identity")
    );

    expect(voidBody).toContain("let mut before_balances: Vec<(String, i128)> = Vec::new();");
    expect(voidBody).toContain("before_balances.push((account_id.clone(), account.balance));");
    expect(voidBody).toContain("let before_json = account_balances_json(&before_balances);");
    expect(voidBody).toContain("let mut after_balances: Vec<(String, i128)> = Vec::new();");
    expect(voidBody).toContain("after_balances.push((account_id.clone(), account.balance));");
    expect(voidBody).toContain("let after_json = account_balances_json(&after_balances);");
    expect(voidBody).toContain("ctx.db.audit_logs().insert(AuditLog");
    expect(voidBody).toContain('id: format!("{transaction_id}:audit")');
    expect(voidBody).toContain('action_type: "economy.void_transaction".to_string()');
    expect(voidBody).toContain('permission_key: "economy.void_transaction".to_string()');
    expect(voidBody).toContain('target_type: "transaction".to_string()');
    expect(voidBody).toContain("target_id: voided_transaction_id");
    expect(voidBody).toContain('status: "succeeded".to_string()');
    expect(voidBody.indexOf("let before_json")).toBeLessThan(
      voidBody.indexOf("let mut after_balances")
    );
    expect(voidBody.indexOf("let after_json")).toBeGreaterThan(
      voidBody.indexOf("ctx.db.accounts().id().update(account)")
    );
    expect(lib).toContain("fn account_balances_json");
  });

  it("rejects blank void transaction fields before reason validation, idempotency, or lookup", () => {
    const lib = source();
    const voidBody = lib.slice(
      lib.indexOf("pub fn void_transaction"),
      lib.indexOf("fn reverse_ledger_direction")
    );

    expect(voidBody).toContain(
      "validate_void_transaction_identity(&transaction_id, &actor_id, &voided_transaction_id, &idempotency_key)?"
    );
    expect(lib).toContain("fn validate_void_transaction_identity");
    expect(lib).toContain('return Err("void transaction id is required".to_string())');
    expect(lib).toContain('return Err("void transaction actor id is required".to_string())');
    expect(lib).toContain('return Err("voided transaction id is required".to_string())');
    expect(lib).toContain('return Err("void transaction idempotency key is required".to_string())');
    expect(voidBody.indexOf("validate_void_transaction_identity")).toBeLessThan(
      voidBody.indexOf("validate_economy_reason")
    );
    expect(voidBody.indexOf("validate_void_transaction_identity")).toBeLessThan(
      voidBody.indexOf("ensure_idempotent_economy_action")
    );
    expect(voidBody.indexOf("validate_void_transaction_identity")).toBeLessThan(
      voidBody.indexOf("ctx.db.transactions().id().find")
    );
  });

  it("pay_invoice records a balanced ledger-backed payment", () => {
    const lib = source();

    expect(lib).toContain("pub fn pay_invoice(");
    expect(lib).toContain("transaction_id: String");
    expect(lib).toContain("actor_id: String");
    expect(lib).toContain("idempotency_key: String");
    expect(lib).toContain('"economy.pay_invoice"');
    expect(lib).toContain("invoice_payment_metadata_json");
    expect(lib).toContain('return Err("invoice is not payable".to_string())');
    expect(lib).toContain("payer.balance -= invoice.amount");
    expect(lib).toContain("issuer.balance += invoice.amount");
    expect(lib).toContain("ctx.db.transactions().insert(Transaction");
    expect(lib).toContain('id: format!("{transaction_id}:invoice_debit")');
    expect(lib).toContain('id: format!("{transaction_id}:invoice_credit")');
    expect(lib).toContain('invoice.status = "paid".to_string()');
    expect(lib.indexOf("payer.balance -= invoice.amount")).toBeLessThan(
      lib.indexOf('invoice.status = "paid".to_string()')
    );
  });

  it("writes invoice payment audit rows with before and after balances", () => {
    const lib = source();
    const payInvoiceBody = lib.slice(
      lib.indexOf("pub fn pay_invoice"),
      lib.indexOf("fn validate_invoice_payment_identity")
    );

    expect(payInvoiceBody).toContain("let before_json = account_pair_balance_json(&invoice.payer_account_id, payer.balance, &invoice.issuer_account_id, issuer.balance);");
    expect(payInvoiceBody).toContain("let after_json = account_pair_balance_json(&invoice.payer_account_id, payer.balance, &invoice.issuer_account_id, issuer.balance);");
    expect(payInvoiceBody).toContain("ctx.db.audit_logs().insert(AuditLog");
    expect(payInvoiceBody).toContain('id: format!("{transaction_id}:audit")');
    expect(payInvoiceBody).toContain('action_type: "economy.pay_invoice".to_string()');
    expect(payInvoiceBody).toContain('permission_key: "economy.pay_invoice".to_string()');
    expect(payInvoiceBody).toContain('target_type: "invoice".to_string()');
    expect(payInvoiceBody).toContain("target_id: invoice.id.clone()");
    expect(payInvoiceBody).toContain('status: "succeeded".to_string()');
    expect(payInvoiceBody.indexOf("let before_json")).toBeLessThan(
      payInvoiceBody.indexOf("payer.balance -= invoice.amount")
    );
    expect(payInvoiceBody.indexOf("let after_json")).toBeGreaterThan(
      payInvoiceBody.indexOf("issuer.balance += invoice.amount")
    );
  });

  it("rejects blank invoice payment fields before invoice lookup or idempotency", () => {
    const lib = source();
    const payInvoiceBody = lib.slice(
      lib.indexOf("pub fn pay_invoice"),
      lib.indexOf("fn invoice_payment_metadata_json")
    );

    expect(payInvoiceBody).toContain(
      "validate_invoice_payment_identity(&transaction_id, &actor_id, &invoice_id, &idempotency_key)?"
    );
    expect(lib).toContain("fn validate_invoice_payment_identity");
    expect(lib).toContain('return Err("invoice payment transaction id is required".to_string())');
    expect(lib).toContain('return Err("invoice payment actor id is required".to_string())');
    expect(lib).toContain('return Err("paid invoice id is required".to_string())');
    expect(lib).toContain('return Err("invoice payment idempotency key is required".to_string())');
    expect(payInvoiceBody.indexOf("validate_invoice_payment_identity")).toBeLessThan(
      payInvoiceBody.indexOf("ctx.db.invoices().id().find")
    );
    expect(payInvoiceBody.indexOf("validate_invoice_payment_identity")).toBeLessThan(
      payInvoiceBody.indexOf("ensure_idempotent_economy_action")
    );
  });

  it("tracks invoice due dates from issue through payment", () => {
    const lib = source();

    expect(lib).toContain("pub due_at: Option<Timestamp>");
    expect(lib).toContain("due_at: Option<Timestamp>");
    expect(lib).toContain("idempotency_key: String");
    expect(lib).toContain("ensure_idempotent_invoice_issue");
    expect(lib).toContain("due_at,");
    expect(lib).toContain("invoice_due_metadata_json");
    expect(lib).toContain('\\"due_at\\"');
  });

  it("issue_invoice accepts identical retries and rejects idempotency conflicts", () => {
    const lib = source();

    expect(lib).toContain("fn ensure_idempotent_invoice_issue");
    expect(lib).toContain("invoice_issue_metadata_json");
    expect(lib).toContain("invoice.idempotency_key != idempotency_key");
    expect(lib).toContain('return Err("invoice idempotency conflict".to_string())');
    expect(lib.indexOf("ensure_idempotent_invoice_issue")).toBeLessThan(
      lib.indexOf("ctx.db.invoices().insert(Invoice")
    );
  });

  it("writes invoice issuance audit rows after invoice persistence", () => {
    const lib = source();
    const issueInvoiceBody = lib.slice(
      lib.indexOf("pub fn issue_invoice"),
      lib.indexOf("fn validate_invoice_issue_identity")
    );

    expect(issueInvoiceBody).toContain("let after_json = invoice_issue_audit_json(&id, &metadata_json);");
    expect(issueInvoiceBody).toContain("ctx.db.audit_logs().insert(AuditLog");
    expect(issueInvoiceBody).toContain('id: format!("{id}:audit")');
    expect(issueInvoiceBody).toContain("actor_id: issued_by.clone()");
    expect(issueInvoiceBody).toContain('action_type: "economy.issue_invoice".to_string()');
    expect(issueInvoiceBody).toContain('permission_key: "economy.issue_invoice".to_string()');
    expect(issueInvoiceBody).toContain('target_type: "invoice".to_string()');
    expect(issueInvoiceBody).toContain("target_id: id");
    expect(issueInvoiceBody).toContain('before_json: "{}".to_string()');
    expect(issueInvoiceBody).toContain('status: "succeeded".to_string()');
    expect(issueInvoiceBody.indexOf("ctx.db.invoices().insert(Invoice")).toBeLessThan(
      issueInvoiceBody.indexOf("ctx.db.audit_logs().insert(AuditLog")
    );
    expect(lib).toContain("fn invoice_issue_audit_json");
  });

  it("rejects blank invoice issue fields before reason validation, idempotency, or account lookup", () => {
    const lib = source();
    const issueInvoiceBody = lib.slice(
      lib.indexOf("pub fn issue_invoice"),
      lib.indexOf("fn validate_economy_reason")
    );

    expect(issueInvoiceBody).toContain(
      "validate_invoice_issue_identity(&id, &issuer_account_id, &payer_account_id, &currency, &issued_by, &idempotency_key)?"
    );
    expect(lib).toContain("fn validate_invoice_issue_identity");
    expect(lib).toContain('return Err("invoice id is required".to_string())');
    expect(lib).toContain('return Err("invoice issuer account id is required".to_string())');
    expect(lib).toContain('return Err("invoice payer account id is required".to_string())');
    expect(lib).toContain('return Err("invoice currency is required".to_string())');
    expect(lib).toContain('return Err("invoice issuer actor is required".to_string())');
    expect(lib).toContain('return Err("invoice idempotency key is required".to_string())');
    expect(issueInvoiceBody.indexOf("validate_invoice_issue_identity")).toBeLessThan(
      issueInvoiceBody.indexOf("validate_economy_reason")
    );
    expect(issueInvoiceBody.indexOf("validate_invoice_issue_identity")).toBeLessThan(
      issueInvoiceBody.indexOf("ensure_idempotent_invoice_issue")
    );
    expect(issueInvoiceBody.indexOf("validate_invoice_issue_identity")).toBeLessThan(
      issueInvoiceBody.indexOf("ctx.db.accounts().id().find")
    );
  });

  it("issue_invoice validates account existence, status, and currency before persistence", () => {
    const lib = source();
    const issueInvoiceBody = lib.slice(
      lib.indexOf("pub fn issue_invoice"),
      lib.indexOf("fn validate_economy_reason")
    );

    expect(issueInvoiceBody).toContain('return Err("unknown issuer account".to_string())');
    expect(issueInvoiceBody).toContain('return Err("unknown payer account".to_string())');
    expect(issueInvoiceBody).toContain('return Err("account is not active".to_string())');
    expect(issueInvoiceBody).toContain('return Err("currency mismatch".to_string())');
    expect(issueInvoiceBody).toContain("issuer.currency != currency || payer.currency != currency");
    expect(issueInvoiceBody.indexOf("unknown issuer account")).toBeLessThan(
      issueInvoiceBody.indexOf("ctx.db.invoices().insert(Invoice")
    );
    expect(issueInvoiceBody.indexOf("currency mismatch")).toBeLessThan(
      issueInvoiceBody.indexOf("ctx.db.invoices().insert(Invoice")
    );
  });

  it("buy_item and sell_item use ledger transfer helpers with item metadata", () => {
    const lib = source();

    for (const reducer of ["buy_item", "sell_item"]) {
      expect(lib).toContain(`pub fn ${reducer}`);
    }
    expect(lib).toContain("item_transaction_reason");
    expect(lib).toContain("item_transaction_metadata_json");
    expect(lib).toContain('"economy.buy_item"');
    expect(lib).toContain('"economy.sell_item"');
    expect(lib).toContain("if quantity == 0");
    expect(lib).toContain('return Err("quantity must be positive".to_string())');
    expect(lib).toContain("metadata_json: Option<String>");
    expect(lib).toContain("metadata_json.unwrap_or_else");
  });

  it("rejects blank item economy keys before quantity validation or transfer helpers", () => {
    const lib = source();
    const buyItemBody = lib.slice(
      lib.indexOf("pub fn buy_item"),
      lib.indexOf("#[reducer]\npub fn sell_item")
    );
    const sellItemBody = lib.slice(
      lib.indexOf("pub fn sell_item"),
      lib.indexOf("#[reducer]\npub fn charge_tax")
    );

    expect(buyItemBody).toContain('validate_item_transaction_identity(&item_key, "purchased item key")?');
    expect(sellItemBody).toContain('validate_item_transaction_identity(&item_key, "sold item key")?');
    expect(lib).toContain("fn validate_item_transaction_identity");
    expect(lib).toContain('return Err(format!("{field_name} is required"))');
    expect(buyItemBody.indexOf("validate_item_transaction_identity")).toBeLessThan(
      buyItemBody.indexOf("quantity == 0")
    );
    expect(buyItemBody.indexOf("validate_item_transaction_identity")).toBeLessThan(
      buyItemBody.indexOf("post_account_transfer")
    );
    expect(sellItemBody.indexOf("validate_item_transaction_identity")).toBeLessThan(
      sellItemBody.indexOf("quantity == 0")
    );
    expect(sellItemBody.indexOf("validate_item_transaction_identity")).toBeLessThan(
      sellItemBody.indexOf("post_account_transfer")
    );
  });

  it("enforces economy limit rows before reducer ledger mutation", () => {
    const lib = source();

    expect(lib).toContain("fn enforce_economy_limits");
    expect(lib).toContain("ctx.db.economy_limits().iter()");
    expect(lib).toContain("limit.enabled");
    expect(lib).toContain("limit.permission_key == permission_key");
    expect(lib).toContain("limit.action_type == action_type");
    expect(lib).toContain('return Err(format!("economy limit exceeded: max amount {max_amount}"))');
    expect(lib).toContain('return Err(format!("economy limit exceeded: account owner type {} is not allowed", account.owner_type))');
    expect(lib).toContain("parse_limit_max_amount(&limit.limit_json)");
    expect(lib).toContain("parse_limit_allowed_owner_types(&limit.limit_json)");
    expect(lib.indexOf("enforce_economy_limits(")).toBeLessThan(lib.indexOf("from.balance -= amount"));
    expect(lib.indexOf("enforce_economy_limits(")).toBeLessThan(lib.indexOf("account.balance -= amount"));
  });

  it("guards economy limit writes against unknown permission keys", () => {
    const lib = source();

    expect(lib).toContain("permission must exist before economy limit writes");
    expect(lib.indexOf("permission must exist before economy limit writes")).toBeLessThan(
      lib.indexOf("ctx.db.economy_limits().insert")
    );
  });

  it("validates economy limit JSON before reducer writes", () => {
    const lib = source();
    const upsertLimitBody = lib.slice(
      lib.indexOf("pub fn upsert_economy_limit"),
      lib.indexOf("#[reducer]\npub fn transfer_money")
    );

    expect(lib).toContain("fn validate_economy_limit_json(limit_json: &str) -> Result<(), String>");
    expect(lib).toContain('return Err("economy limit json must be an object".to_string())');
    expect(lib).toContain('return Err("economy limit json must define max_amount or allowed_account_owner_types".to_string())');
    expect(lib).toContain('return Err("economy limit max_amount must be positive".to_string())');
    expect(lib).toContain('return Err("economy limit allowed_account_owner_types must be a non-empty string array".to_string())');
    expect(lib).toContain('return Err("economy limit allowed_account_owner_types contains invalid owner type".to_string())');
    expect(upsertLimitBody).toContain("validate_economy_limit_json(&limit_json)?");
    expect(upsertLimitBody.indexOf("validate_economy_limit_json(&limit_json)?")).toBeLessThan(
      upsertLimitBody.indexOf("ctx.db.economy_limits().insert")
    );
  });
});
