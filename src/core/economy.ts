import { randomUUID } from "node:crypto";
import { type AuditLogEntry } from "./audit.js";
import { type PermissionEngine } from "./permissions.js";

export type AccountOwnerType = "character" | "business" | "government" | "society" | "plugin";
export type AccountStatus = "active" | "frozen" | "closed";
export type LedgerDirection = "debit" | "credit";
export type TransactionStatus = "completed" | "failed";
export type InvoiceStatus = "issued" | "paid" | "void";

export interface Account {
  id: string;
  ownerType: AccountOwnerType;
  ownerId: string;
  currency: string;
  balance: number;
  status: AccountStatus;
}

export interface Transaction {
  id: string;
  type: string;
  actorId: string;
  status: TransactionStatus;
  idempotencyKey: string;
  metadata?: unknown;
  createdAt: Date;
  completedAt?: Date;
}

export interface LedgerEntry {
  id: string;
  transactionId: string;
  accountId: string;
  direction: LedgerDirection;
  amount: number;
  reason: string;
  metadata?: unknown;
  createdAt: Date;
}

export interface EconomyLimit {
  id: string;
  permissionKey: string;
  actionType: string;
  limit: {
    maxAmount?: number;
    allowedAccountOwnerTypes?: AccountOwnerType[];
  };
  enabled: boolean;
}

const accountOwnerTypes = new Set<AccountOwnerType>([
  "character",
  "business",
  "government",
  "society",
  "plugin"
]);

export function validateEconomyLimitJson(limitJson: string): EconomyLimit["limit"] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(limitJson);
  } catch {
    throw new Error("Economy limit JSON must be valid JSON");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Economy limit JSON must be an object");
  }

  const record = parsed as Record<string, unknown>;
  const maxAmount = record.maxAmount ?? record.max_amount;
  const allowedAccountOwnerTypes = record.allowedAccountOwnerTypes ?? record.allowed_account_owner_types;
  if (maxAmount === undefined && allowedAccountOwnerTypes === undefined) {
    throw new Error("Economy limit JSON must define maxAmount or allowedAccountOwnerTypes");
  }

  if (
    maxAmount !== undefined &&
    (typeof maxAmount !== "number" || !Number.isFinite(maxAmount) || maxAmount <= 0)
  ) {
    throw new Error("Economy limit maxAmount must be positive");
  }

  if (allowedAccountOwnerTypes !== undefined) {
    if (
      !Array.isArray(allowedAccountOwnerTypes) ||
      allowedAccountOwnerTypes.length === 0 ||
      allowedAccountOwnerTypes.some((ownerType) => typeof ownerType !== "string")
    ) {
      throw new Error("Economy limit allowedAccountOwnerTypes must be a non-empty string array");
    }
    if (allowedAccountOwnerTypes.some((ownerType) => !accountOwnerTypes.has(ownerType as AccountOwnerType))) {
      throw new Error("Economy limit allowedAccountOwnerTypes contains invalid owner type");
    }
  }

  return {
    maxAmount: maxAmount as number | undefined,
    allowedAccountOwnerTypes: allowedAccountOwnerTypes as AccountOwnerType[] | undefined
  };
}

export function validateAccountOwnerType(ownerType: string): AccountOwnerType {
  if (!accountOwnerTypes.has(ownerType as AccountOwnerType)) {
    throw new Error(`Invalid account owner type: ${ownerType}`);
  }

  return ownerType as AccountOwnerType;
}

export function validateEconomyAccountCreation(input: {
  ownerType: string;
  balance: number;
}): void {
  validateAccountOwnerType(input.ownerType);
  if (!Number.isFinite(input.balance) || input.balance < 0) {
    throw new Error("Account balance cannot be negative");
  }
}

export function validateEconomyAmount(amount: number): void {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error("Amount must be a positive integer");
  }
}

export function validateEconomyReason(reason: string): void {
  if (reason.trim().length === 0) {
    throw new Error("Reason must be a non-empty string");
  }
}

export function validateLedgerDirection(direction: string): LedgerDirection {
  if (direction !== "debit" && direction !== "credit") {
    throw new Error("Direction must be debit or credit");
  }

  return direction;
}

export interface Invoice {
  id: string;
  issuerAccountId: string;
  payerAccountId: string;
  amount: number;
  currency: string;
  reason: string;
  status: InvoiceStatus;
  issuedBy: string;
  issuedAt: Date;
  paidAt?: Date;
}

export interface EconomyLedgerOptions {
  permissions: PermissionEngine;
  accounts: Account[];
  limits?: EconomyLimit[];
  now?: () => Date;
  idFactory?: () => string;
}

export interface AccountSearchCriteria {
  ownerType?: AccountOwnerType;
  ownerId?: string;
  currency?: string;
  status?: AccountStatus;
}

export interface TransactionHistoryCriteria {
  accountId?: string;
  actorId?: string;
  type?: string;
  status?: TransactionStatus;
}

export interface AccountStatementCriteria {
  accountId: string;
  from?: Date;
  to?: Date;
}

export interface AccountStatement {
  account: Account;
  from?: Date;
  to?: Date;
  openingBalance: number;
  closingBalance: number;
  totalDebits: number;
  totalCredits: number;
  entries: LedgerEntry[];
}

export interface SuspiciousActivityCriteria {
  accountId?: string;
  actorId?: string;
  type?: string;
  minAmount?: number;
  from?: Date;
  to?: Date;
}

export interface SuspiciousEconomyActivity {
  transaction: Transaction;
  entries: LedgerEntry[];
  maxEntryAmount: number;
  reasons: string[];
}

export interface TransferMoneyInput {
  actorPrincipalId: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  currency: string;
  reason: string;
  idempotencyKey: string;
}

export interface TransferMoneyResult {
  transaction: Transaction;
  entries: LedgerEntry[];
  audit: AuditLogEntry;
}

export interface IssueInvoiceInput {
  actorPrincipalId: string;
  issuerAccountId: string;
  payerAccountId: string;
  amount: number;
  currency: string;
  reason: string;
  idempotencyKey?: string;
}

export interface PayInvoiceInput {
  actorPrincipalId: string;
  invoiceId: string;
  idempotencyKey: string;
}

export interface DepositCashInput {
  actorPrincipalId: string;
  cashAccountId: string;
  bankAccountId: string;
  amount: number;
  currency: string;
  idempotencyKey: string;
}

export interface WithdrawCashInput {
  actorPrincipalId: string;
  bankAccountId: string;
  cashAccountId: string;
  amount: number;
  currency: string;
  idempotencyKey: string;
}

export interface PaySalaryInput {
  actorPrincipalId: string;
  employerAccountId: string;
  employeeAccountId: string;
  amount: number;
  currency: string;
  reason: string;
  idempotencyKey: string;
}

export interface FinePlayerInput {
  actorPrincipalId: string;
  playerAccountId: string;
  governmentAccountId: string;
  amount: number;
  currency: string;
  reason: string;
  idempotencyKey: string;
}

export interface AdminAdjustBalanceInput {
  actorPrincipalId: string;
  accountId: string;
  direction: LedgerDirection;
  amount: number;
  currency: string;
  reason: string;
  idempotencyKey: string;
}

export interface BuyItemInput {
  actorPrincipalId: string;
  buyerAccountId: string;
  sellerAccountId: string;
  amount: number;
  currency: string;
  itemKey: string;
  quantity: number;
  idempotencyKey: string;
}

export interface SellItemInput {
  actorPrincipalId: string;
  sellerAccountId: string;
  buyerAccountId: string;
  amount: number;
  currency: string;
  itemKey: string;
  quantity: number;
  idempotencyKey: string;
}

export interface ChargeTaxInput {
  actorPrincipalId: string;
  payerAccountId: string;
  governmentAccountId: string;
  amount: number;
  currency: string;
  reason: string;
  idempotencyKey: string;
}

export interface BusinessPayoutInput {
  actorPrincipalId: string;
  businessAccountId: string;
  payoutAccountId: string;
  amount: number;
  currency: string;
  reason: string;
  idempotencyKey: string;
}

export interface VoidTransactionInput {
  actorPrincipalId: string;
  transactionId: string;
  reason: string;
  idempotencyKey: string;
}

interface IdempotencyRecord {
  fingerprint: string;
  result: TransferMoneyResult;
}

interface InvoiceIdempotencyRecord {
  fingerprint: string;
  invoice: Invoice;
}

export class EconomyLedger {
  private readonly permissions: PermissionEngine;
  private readonly accountsById: Map<string, Account>;
  private readonly limits: EconomyLimit[];
  private readonly transactionsByIdempotencyKey = new Map<string, IdempotencyRecord>();
  private readonly invoicesByIdempotencyKey = new Map<string, InvoiceIdempotencyRecord>();
  private readonly transactionsById = new Map<string, TransferMoneyResult>();
  private readonly auditLogs: AuditLogEntry[] = [];
  private readonly voidedTransactionIds = new Set<string>();
  private readonly invoicesById = new Map<string, Invoice>();
  private readonly now: () => Date;
  private readonly idFactory: () => string;

  public constructor(options: EconomyLedgerOptions) {
    this.permissions = options.permissions;
    this.accountsById = new Map(options.accounts.map((account) => [account.id, { ...account }]));
    this.limits = (options.limits ?? []).map((limit) => structuredClone(limit));
    this.now = options.now ?? (() => new Date());
    this.idFactory = options.idFactory ?? (() => randomUUID());
  }

  public getAccount(accountId: string): Account {
    const account = this.accountsById.get(accountId);
    if (!account) {
      throw new Error(`Unknown account: ${accountId}`);
    }

    return { ...account };
  }

  public getInvoice(invoiceId: string): Invoice | undefined {
    const invoice = this.invoicesById.get(invoiceId);
    return invoice ? { ...invoice } : undefined;
  }

  public searchAccounts(criteria: AccountSearchCriteria = {}): Account[] {
    return [...this.accountsById.values()]
      .filter((account) => criteria.ownerType === undefined || account.ownerType === criteria.ownerType)
      .filter((account) => criteria.ownerId === undefined || account.ownerId === criteria.ownerId)
      .filter((account) => criteria.currency === undefined || account.currency === criteria.currency)
      .filter((account) => criteria.status === undefined || account.status === criteria.status)
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((account) => ({ ...account }));
  }

  public listTransactions(criteria: TransactionHistoryCriteria = {}): Transaction[] {
    return [...this.transactionsById.values()]
      .filter((result) => criteria.accountId === undefined || result.entries.some((entry) => entry.accountId === criteria.accountId))
      .map((result) => result.transaction)
      .filter((transaction) => criteria.actorId === undefined || transaction.actorId === criteria.actorId)
      .filter((transaction) => criteria.type === undefined || transaction.type === criteria.type)
      .filter((transaction) => criteria.status === undefined || transaction.status === criteria.status)
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id))
      .map((transaction) => this.cloneTransaction(transaction));
  }

  public getLedgerEntriesForTransaction(transactionId: string): LedgerEntry[] {
    const result = this.transactionsById.get(transactionId);
    if (!result) {
      throw new Error(`Unknown transaction: ${transactionId}`);
    }

    return result.entries.map((entry) => this.cloneLedgerEntry(entry));
  }

  public getLedgerEntriesForAccount(accountId: string): LedgerEntry[] {
    this.getMutableAccount(accountId);
    return [...this.transactionsById.values()]
      .flatMap((result) => result.entries)
      .filter((entry) => entry.accountId === accountId)
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id))
      .map((entry) => this.cloneLedgerEntry(entry));
  }

  public getAccountStatement(criteria: AccountStatementCriteria): AccountStatement {
    const account = this.getAccount(criteria.accountId);
    return buildAccountStatement({
      account,
      entries: this.getLedgerEntriesForAccount(criteria.accountId),
      from: criteria.from,
      to: criteria.to
    });
  }

  public findSuspiciousActivity(criteria: SuspiciousActivityCriteria = {}): SuspiciousEconomyActivity[] {
    return findSuspiciousEconomyActivity(
      [...this.transactionsById.values()].map((result) => ({
        transaction: this.cloneTransaction(result.transaction),
        entries: result.entries.map((entry) => this.cloneLedgerEntry(entry))
      })),
      criteria
    );
  }

  public getAuditLogs(): AuditLogEntry[] {
    return this.auditLogs.map((entry) => this.cloneAuditLogEntry(entry));
  }

  public transferMoney(input: TransferMoneyInput): TransferMoneyResult {
    this.validateReason(input.reason);
    const fingerprint = this.fingerprint("economy.transfer", input);
    const existing = this.getIdempotentResult(input.idempotencyKey, fingerprint);
    if (existing) {
      return existing;
    }

    this.permissions.assertPermission(input.actorPrincipalId, "economy.transfer");
    return this.performTransfer({
      ...input,
      transactionType: "economy.transfer",
      permissionKey: "economy.transfer",
      idempotencyFingerprint: fingerprint
    });
  }

  public depositCash(input: DepositCashInput): TransferMoneyResult {
    const fingerprint = this.fingerprint("economy.deposit_cash", input);
    const existing = this.getIdempotentResult(input.idempotencyKey, fingerprint);
    if (existing) {
      return existing;
    }

    this.permissions.assertPermission(input.actorPrincipalId, "economy.deposit_cash");
    return this.performTransfer({
      actorPrincipalId: input.actorPrincipalId,
      fromAccountId: input.cashAccountId,
      toAccountId: input.bankAccountId,
      amount: input.amount,
      currency: input.currency,
      reason: "cash_deposit",
      idempotencyKey: input.idempotencyKey,
      transactionType: "economy.deposit_cash",
      permissionKey: "economy.deposit_cash",
      idempotencyFingerprint: fingerprint
    });
  }

  public withdrawCash(input: WithdrawCashInput): TransferMoneyResult {
    const fingerprint = this.fingerprint("economy.withdraw_cash", input);
    const existing = this.getIdempotentResult(input.idempotencyKey, fingerprint);
    if (existing) {
      return existing;
    }

    this.permissions.assertPermission(input.actorPrincipalId, "economy.withdraw_cash");
    return this.performTransfer({
      actorPrincipalId: input.actorPrincipalId,
      fromAccountId: input.bankAccountId,
      toAccountId: input.cashAccountId,
      amount: input.amount,
      currency: input.currency,
      reason: "cash_withdrawal",
      idempotencyKey: input.idempotencyKey,
      transactionType: "economy.withdraw_cash",
      permissionKey: "economy.withdraw_cash",
      idempotencyFingerprint: fingerprint
    });
  }

  public paySalary(input: PaySalaryInput): TransferMoneyResult {
    this.validateReason(input.reason);
    const fingerprint = this.fingerprint("economy.pay_salary", input);
    const existing = this.getIdempotentResult(input.idempotencyKey, fingerprint);
    if (existing) {
      return existing;
    }

    this.permissions.assertPermission(input.actorPrincipalId, "economy.pay_salary");
    return this.performTransfer({
      actorPrincipalId: input.actorPrincipalId,
      fromAccountId: input.employerAccountId,
      toAccountId: input.employeeAccountId,
      amount: input.amount,
      currency: input.currency,
      reason: input.reason,
      idempotencyKey: input.idempotencyKey,
      transactionType: "economy.pay_salary",
      permissionKey: "economy.pay_salary",
      idempotencyFingerprint: fingerprint
    });
  }

  public finePlayer(input: FinePlayerInput): TransferMoneyResult {
    this.validateReason(input.reason);
    const fingerprint = this.fingerprint("economy.fine_player", input);
    const existing = this.getIdempotentResult(input.idempotencyKey, fingerprint);
    if (existing) {
      return existing;
    }

    this.permissions.assertPermission(input.actorPrincipalId, "economy.fine_player");
    return this.performTransfer({
      actorPrincipalId: input.actorPrincipalId,
      fromAccountId: input.playerAccountId,
      toAccountId: input.governmentAccountId,
      amount: input.amount,
      currency: input.currency,
      reason: input.reason,
      idempotencyKey: input.idempotencyKey,
      transactionType: "economy.fine_player",
      permissionKey: "economy.fine_player",
      idempotencyFingerprint: fingerprint
    });
  }

  public adminAdjustBalance(input: AdminAdjustBalanceInput): TransferMoneyResult {
    this.validateReason(input.reason);
    const fingerprint = this.fingerprint("economy.admin.adjust_balance", input);
    const existing = this.getIdempotentResult(input.idempotencyKey, fingerprint);
    if (existing) {
      return existing;
    }

    this.permissions.assertPermission(input.actorPrincipalId, "economy.admin.adjust_balance");
    this.validateAmount(input.amount);

    const account = this.getMutableAccount(input.accountId);
    this.enforceLimits({
      actionType: "economy.admin.adjust_balance",
      permissionKey: "economy.admin.adjust_balance",
      amount: input.amount,
      accounts: [account]
    });

    if (account.currency !== input.currency) {
      throw new Error("Currency mismatch");
    }

    if (account.status !== "active") {
      throw new Error("Account is not active");
    }

    if (input.direction === "debit" && account.balance < input.amount) {
      throw new Error("Insufficient funds");
    }

    const createdAt = this.now();
    const before = { [account.id]: account.balance };
    account.balance = input.direction === "credit"
      ? account.balance + input.amount
      : account.balance - input.amount;
    const transaction: Transaction = {
      id: this.idFactory(),
      type: "economy.admin.adjust_balance",
      actorId: input.actorPrincipalId,
      status: "completed",
      idempotencyKey: input.idempotencyKey,
      metadata: { reason: input.reason },
      createdAt,
      completedAt: createdAt
    };
    const entries: LedgerEntry[] = [
      {
        id: this.idFactory(),
        transactionId: transaction.id,
        accountId: account.id,
        direction: input.direction,
        amount: input.amount,
        reason: input.reason,
        createdAt
      }
    ];
    const result: TransferMoneyResult = {
      transaction,
      entries,
      audit: {
        id: this.idFactory(),
        actorId: input.actorPrincipalId,
        actionType: "economy.admin.adjust_balance",
        permissionKey: "economy.admin.adjust_balance",
        targetType: "account",
        targetId: account.id,
        before,
        after: { [account.id]: account.balance },
        status: "succeeded",
        createdAt
      }
    };

    this.recordAuditLog(result.audit);
    this.storeIdempotentResult(input.idempotencyKey, fingerprint, result);
    this.transactionsById.set(transaction.id, result);
    return result;
  }

  public buyItem(input: BuyItemInput): TransferMoneyResult {
    const fingerprint = this.fingerprint("economy.buy_item", input);
    const existing = this.getIdempotentResult(input.idempotencyKey, fingerprint);
    if (existing) {
      return existing;
    }

    this.permissions.assertPermission(input.actorPrincipalId, "economy.buy_item");
    this.validateQuantity(input.quantity);
    return this.performTransfer({
      actorPrincipalId: input.actorPrincipalId,
      fromAccountId: input.buyerAccountId,
      toAccountId: input.sellerAccountId,
      amount: input.amount,
      currency: input.currency,
      reason: `buy_item:${input.itemKey}`,
      idempotencyKey: input.idempotencyKey,
      transactionType: "economy.buy_item",
      permissionKey: "economy.buy_item",
      metadata: { itemKey: input.itemKey, quantity: input.quantity },
      idempotencyFingerprint: fingerprint
    });
  }

  public sellItem(input: SellItemInput): TransferMoneyResult {
    const fingerprint = this.fingerprint("economy.sell_item", input);
    const existing = this.getIdempotentResult(input.idempotencyKey, fingerprint);
    if (existing) {
      return existing;
    }

    this.permissions.assertPermission(input.actorPrincipalId, "economy.sell_item");
    this.validateQuantity(input.quantity);
    return this.performTransfer({
      actorPrincipalId: input.actorPrincipalId,
      fromAccountId: input.buyerAccountId,
      toAccountId: input.sellerAccountId,
      amount: input.amount,
      currency: input.currency,
      reason: `sell_item:${input.itemKey}`,
      idempotencyKey: input.idempotencyKey,
      transactionType: "economy.sell_item",
      permissionKey: "economy.sell_item",
      metadata: { itemKey: input.itemKey, quantity: input.quantity },
      idempotencyFingerprint: fingerprint
    });
  }

  public chargeTax(input: ChargeTaxInput): TransferMoneyResult {
    this.validateReason(input.reason);
    const fingerprint = this.fingerprint("economy.charge_tax", input);
    const existing = this.getIdempotentResult(input.idempotencyKey, fingerprint);
    if (existing) {
      return existing;
    }

    this.permissions.assertPermission(input.actorPrincipalId, "economy.charge_tax");
    return this.performTransfer({
      actorPrincipalId: input.actorPrincipalId,
      fromAccountId: input.payerAccountId,
      toAccountId: input.governmentAccountId,
      amount: input.amount,
      currency: input.currency,
      reason: input.reason,
      idempotencyKey: input.idempotencyKey,
      transactionType: "economy.charge_tax",
      permissionKey: "economy.charge_tax",
      idempotencyFingerprint: fingerprint
    });
  }

  public businessPayout(input: BusinessPayoutInput): TransferMoneyResult {
    this.validateReason(input.reason);
    const fingerprint = this.fingerprint("economy.business_payout", input);
    const existing = this.getIdempotentResult(input.idempotencyKey, fingerprint);
    if (existing) {
      return existing;
    }

    this.permissions.assertPermission(input.actorPrincipalId, "economy.business_payout");
    return this.performTransfer({
      actorPrincipalId: input.actorPrincipalId,
      fromAccountId: input.businessAccountId,
      toAccountId: input.payoutAccountId,
      amount: input.amount,
      currency: input.currency,
      reason: input.reason,
      idempotencyKey: input.idempotencyKey,
      transactionType: "economy.business_payout",
      permissionKey: "economy.business_payout",
      idempotencyFingerprint: fingerprint
    });
  }

  public voidTransaction(input: VoidTransactionInput): TransferMoneyResult {
    this.validateReason(input.reason);
    const fingerprint = this.fingerprint("economy.void_transaction", input);
    const existing = this.getIdempotentResult(input.idempotencyKey, fingerprint);
    if (existing) {
      return existing;
    }

    this.permissions.assertPermission(input.actorPrincipalId, "economy.void_transaction");

    const original = this.transactionsById.get(input.transactionId);
    if (!original) {
      throw new Error(`Unknown transaction: ${input.transactionId}`);
    }

    if (this.voidedTransactionIds.has(input.transactionId)) {
      throw new Error("Transaction is already voided");
    }

    const createdAt = this.now();
    const transaction: Transaction = {
      id: this.idFactory(),
      type: "economy.void_transaction",
      actorId: input.actorPrincipalId,
      status: "completed",
      idempotencyKey: input.idempotencyKey,
      metadata: { reason: input.reason, voidedTransactionId: input.transactionId },
      createdAt,
      completedAt: createdAt
    };
    const before: Record<string, number> = {};
    const after: Record<string, number> = {};

    for (const entry of original.entries) {
      const account = this.getMutableAccount(entry.accountId);
      const reversalDirection: LedgerDirection = entry.direction === "debit" ? "credit" : "debit";
      if (reversalDirection === "debit" && account.balance < entry.amount) {
        throw new Error("Insufficient funds");
      }
    }

    const entries = original.entries.map((entry) => {
      const account = this.getMutableAccount(entry.accountId);
      before[account.id] = account.balance;
      const reversalDirection: LedgerDirection = entry.direction === "debit" ? "credit" : "debit";
      account.balance = reversalDirection === "credit"
        ? account.balance + entry.amount
        : account.balance - entry.amount;
      after[account.id] = account.balance;

      return {
        id: this.idFactory(),
        transactionId: transaction.id,
        accountId: account.id,
        direction: reversalDirection,
        amount: entry.amount,
        reason: input.reason,
        metadata: { voidedEntryId: entry.id, voidedTransactionId: input.transactionId },
        createdAt
      };
    });

    const result: TransferMoneyResult = {
      transaction,
      entries,
      audit: {
        id: this.idFactory(),
        actorId: input.actorPrincipalId,
        actionType: "economy.void_transaction",
        permissionKey: "economy.void_transaction",
        targetType: "transaction",
        targetId: input.transactionId,
        before,
        after,
        status: "succeeded",
        createdAt
      }
    };

    this.voidedTransactionIds.add(input.transactionId);
    this.recordAuditLog(result.audit);
    this.storeIdempotentResult(input.idempotencyKey, fingerprint, result);
    this.transactionsById.set(transaction.id, result);
    return result;
  }

  public issueInvoice(input: IssueInvoiceInput): Invoice {
    this.validateReason(input.reason);
    const fingerprint = this.fingerprint("economy.issue_invoice", input);
    if (input.idempotencyKey) {
      const existing = this.getIdempotentInvoice(input.idempotencyKey, fingerprint);
      if (existing) {
        return existing;
      }
    }

    this.permissions.assertPermission(input.actorPrincipalId, "economy.issue_invoice");
    this.validateAmount(input.amount);

    const issuer = this.getMutableAccount(input.issuerAccountId);
    const payer = this.getMutableAccount(input.payerAccountId);
    if (issuer.currency !== input.currency || payer.currency !== input.currency) {
      throw new Error("Currency mismatch");
    }

    if (issuer.status !== "active" || payer.status !== "active") {
      throw new Error("Account is not active");
    }

    const invoice: Invoice = {
      id: this.idFactory(),
      issuerAccountId: input.issuerAccountId,
      payerAccountId: input.payerAccountId,
      amount: input.amount,
      currency: input.currency,
      reason: input.reason,
      status: "issued",
      issuedBy: input.actorPrincipalId,
      issuedAt: this.now()
    };

    this.invoicesById.set(invoice.id, invoice);
    if (input.idempotencyKey) {
      this.storeIdempotentInvoice(input.idempotencyKey, fingerprint, invoice);
    }

    return { ...invoice };
  }

  public payInvoice(input: PayInvoiceInput): TransferMoneyResult {
    const fingerprint = this.fingerprint("economy.pay_invoice", input);
    const existing = this.getIdempotentResult(input.idempotencyKey, fingerprint);
    if (existing) {
      return existing;
    }

    this.permissions.assertPermission(input.actorPrincipalId, "economy.pay_invoice");

    const invoice = this.invoicesById.get(input.invoiceId);
    if (!invoice) {
      throw new Error(`Unknown invoice: ${input.invoiceId}`);
    }

    if (invoice.status !== "issued") {
      throw new Error("Invoice is not payable");
    }

    const result = this.performTransfer({
      actorPrincipalId: input.actorPrincipalId,
      fromAccountId: invoice.payerAccountId,
      toAccountId: invoice.issuerAccountId,
      amount: invoice.amount,
      currency: invoice.currency,
      reason: invoice.reason,
      idempotencyKey: input.idempotencyKey,
      transactionType: "economy.pay_invoice",
      permissionKey: "economy.pay_invoice",
      metadata: { invoiceId: invoice.id },
      idempotencyFingerprint: fingerprint
    });

    invoice.status = "paid";
    invoice.paidAt = result.transaction.completedAt;
    return result;
  }

  private performTransfer(input: TransferMoneyInput & {
    transactionType: string;
    permissionKey: string;
    metadata?: unknown;
    idempotencyFingerprint: string;
  }): TransferMoneyResult {
    this.validateAmount(input.amount);

    const from = this.getMutableAccount(input.fromAccountId);
    const to = this.getMutableAccount(input.toAccountId);
    this.enforceLimits({
      actionType: input.transactionType,
      permissionKey: input.permissionKey,
      amount: input.amount,
      accounts: [from, to]
    });

    if (from.currency !== input.currency || to.currency !== input.currency) {
      throw new Error("Currency mismatch");
    }

    if (from.status !== "active" || to.status !== "active") {
      throw new Error("Account is not active");
    }

    if (from.balance < input.amount) {
      throw new Error("Insufficient funds");
    }

    const createdAt = this.now();
    const transaction: Transaction = {
      id: this.idFactory(),
      type: input.transactionType,
      actorId: input.actorPrincipalId,
      status: "completed",
      idempotencyKey: input.idempotencyKey,
      metadata: input.metadata ?? { reason: input.reason },
      createdAt,
      completedAt: createdAt
    };
    const before = {
      [from.id]: from.balance,
      [to.id]: to.balance
    };

    from.balance -= input.amount;
    to.balance += input.amount;

    const entries: LedgerEntry[] = [
      {
        id: this.idFactory(),
        transactionId: transaction.id,
        accountId: from.id,
        direction: "debit",
        amount: input.amount,
        reason: input.reason,
        metadata: input.metadata,
        createdAt
      },
      {
        id: this.idFactory(),
        transactionId: transaction.id,
        accountId: to.id,
        direction: "credit",
        amount: input.amount,
        reason: input.reason,
        metadata: input.metadata,
        createdAt
      }
    ];

    const result: TransferMoneyResult = {
      transaction,
      entries,
      audit: {
        id: this.idFactory(),
        actorId: input.actorPrincipalId,
        actionType: input.transactionType,
        permissionKey: input.permissionKey,
        targetType: "account",
        targetId: `${from.id}->${to.id}`,
        before,
        after: {
          [from.id]: from.balance,
          [to.id]: to.balance
        },
        status: "succeeded",
        createdAt
      }
    };

    this.recordAuditLog(result.audit);
    this.storeIdempotentResult(input.idempotencyKey, input.idempotencyFingerprint, result);
    this.transactionsById.set(transaction.id, result);
    return result;
  }

  private getMutableAccount(accountId: string): Account {
    const account = this.accountsById.get(accountId);
    if (!account) {
      throw new Error(`Unknown account: ${accountId}`);
    }

    return account;
  }

  private validateAmount(amount: number): void {
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new Error("Amount must be a positive integer");
    }
  }

  private validateQuantity(quantity: number): void {
    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      throw new Error("Quantity must be a positive integer");
    }
  }

  private validateReason(reason: string): void {
    if (reason.trim().length === 0) {
      throw new Error("Reason must be a non-empty string");
    }
  }

  private enforceLimits(input: {
    actionType: string;
    permissionKey: string;
    amount: number;
    accounts: Account[];
  }): void {
    for (const limit of this.limits) {
      if (!limit.enabled || limit.actionType !== input.actionType || limit.permissionKey !== input.permissionKey) {
        continue;
      }

      if (limit.limit.maxAmount !== undefined && input.amount > limit.limit.maxAmount) {
        throw new Error(`Economy limit exceeded: max amount ${limit.limit.maxAmount}`);
      }

      if (limit.limit.allowedAccountOwnerTypes) {
        const allowed = new Set(limit.limit.allowedAccountOwnerTypes);
        const blocked = input.accounts.find((account) => !allowed.has(account.ownerType));
        if (blocked) {
          throw new Error(`Economy limit exceeded: account owner type ${blocked.ownerType} is not allowed`);
        }
      }
    }
  }

  private getIdempotentResult(idempotencyKey: string, fingerprint: string): TransferMoneyResult | undefined {
    const existing = this.transactionsByIdempotencyKey.get(idempotencyKey);
    if (!existing) {
      return undefined;
    }

    if (existing.fingerprint !== fingerprint) {
      throw new Error(`Idempotency conflict: ${idempotencyKey}`);
    }

    return existing.result;
  }

  private storeIdempotentResult(idempotencyKey: string, fingerprint: string, result: TransferMoneyResult): void {
    this.transactionsByIdempotencyKey.set(idempotencyKey, { fingerprint, result });
  }

  private recordAuditLog(entry: AuditLogEntry): void {
    this.auditLogs.push(this.cloneAuditLogEntry(entry));
  }

  private getIdempotentInvoice(idempotencyKey: string, fingerprint: string): Invoice | undefined {
    const existing = this.invoicesByIdempotencyKey.get(idempotencyKey);
    if (!existing) {
      return undefined;
    }

    if (existing.fingerprint !== fingerprint) {
      throw new Error(`Idempotency conflict: ${idempotencyKey}`);
    }

    return { ...existing.invoice };
  }

  private storeIdempotentInvoice(idempotencyKey: string, fingerprint: string, invoice: Invoice): void {
    this.invoicesByIdempotencyKey.set(idempotencyKey, { fingerprint, invoice: { ...invoice } });
  }

  private cloneTransaction(transaction: Transaction): Transaction {
    return {
      ...transaction,
      metadata: structuredClone(transaction.metadata),
      createdAt: new Date(transaction.createdAt.getTime()),
      completedAt: transaction.completedAt ? new Date(transaction.completedAt.getTime()) : undefined
    };
  }

  private cloneLedgerEntry(entry: LedgerEntry): LedgerEntry {
    return {
      ...entry,
      metadata: structuredClone(entry.metadata),
      createdAt: new Date(entry.createdAt.getTime())
    };
  }

  private cloneAuditLogEntry(entry: AuditLogEntry): AuditLogEntry {
    return {
      ...entry,
      before: entry.before === undefined ? undefined : structuredClone(entry.before),
      after: entry.after === undefined ? undefined : structuredClone(entry.after),
      createdAt: new Date(entry.createdAt.getTime())
    };
  }

  private fingerprint(type: string, input: object): string {
    return JSON.stringify(sortKeys({ type, ...input }));
  }
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortKeys(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, sortKeys(child)])
    );
  }

  return value;
}

export function buildAccountStatement(input: {
  account: Account;
  entries: LedgerEntry[];
  from?: Date;
  to?: Date;
}): AccountStatement {
  const sortedEntries = input.entries
    .map((entry) => ({
      ...entry,
      metadata: structuredClone(entry.metadata),
      createdAt: new Date(entry.createdAt.getTime())
    }))
    .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id));
  const inRange = sortedEntries.filter((entry) =>
    (input.from === undefined || entry.createdAt >= input.from) &&
    (input.to === undefined || entry.createdAt <= input.to)
  );
  const netAfterRange = sortedEntries
    .filter((entry) => input.to !== undefined && entry.createdAt > input.to)
    .reduce((total, entry) => total + ledgerEntryNet(entry), 0);
  const closingBalance = input.account.balance - netAfterRange;
  const rangeNet = inRange.reduce((total, entry) => total + ledgerEntryNet(entry), 0);
  const totalDebits = inRange
    .filter((entry) => entry.direction === "debit")
    .reduce((total, entry) => total + entry.amount, 0);
  const totalCredits = inRange
    .filter((entry) => entry.direction === "credit")
    .reduce((total, entry) => total + entry.amount, 0);

  return {
    account: { ...input.account },
    from: input.from ? new Date(input.from.getTime()) : undefined,
    to: input.to ? new Date(input.to.getTime()) : undefined,
    openingBalance: closingBalance - rangeNet,
    closingBalance,
    totalDebits,
    totalCredits,
    entries: inRange
  };
}

export function accountStatementToCsv(statement: AccountStatement): string {
  return [
    [
      "account_id",
      "owner_type",
      "owner_id",
      "currency",
      "from",
      "to",
      "opening_balance",
      "closing_balance",
      "total_debits",
      "total_credits"
    ].join(","),
    [
      statement.account.id,
      statement.account.ownerType,
      statement.account.ownerId,
      statement.account.currency,
      statement.from?.toISOString() ?? "",
      statement.to?.toISOString() ?? "",
      statement.openingBalance,
      statement.closingBalance,
      statement.totalDebits,
      statement.totalCredits
    ].map(csvCell).join(","),
    "",
    [
      "entry_id",
      "transaction_id",
      "created_at",
      "account_id",
      "direction",
      "amount",
      "reason",
      "metadata_json"
    ].join(","),
    ...statement.entries.map((entry) => [
      entry.id,
      entry.transactionId,
      entry.createdAt.toISOString(),
      entry.accountId,
      entry.direction,
      entry.amount,
      entry.reason,
      entry.metadata === undefined ? "" : JSON.stringify(entry.metadata)
    ].map(csvCell).join(","))
  ].join("\n");
}

function csvCell(value: unknown): string {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}

export function findSuspiciousEconomyActivity(
  results: Array<{ transaction: Transaction; entries: LedgerEntry[] }>,
  criteria: SuspiciousActivityCriteria = {}
): SuspiciousEconomyActivity[] {
  if (criteria.minAmount !== undefined && (!Number.isFinite(criteria.minAmount) || criteria.minAmount <= 0)) {
    throw new Error("minAmount must be a positive finite number");
  }

  return results
    .filter((result) => criteria.actorId === undefined || result.transaction.actorId === criteria.actorId)
    .filter((result) => criteria.type === undefined || result.transaction.type === criteria.type)
    .filter((result) =>
      (criteria.from === undefined || result.transaction.createdAt >= criteria.from) &&
      (criteria.to === undefined || result.transaction.createdAt <= criteria.to)
    )
    .map((result) => {
      const entries = result.entries
        .filter((entry) => criteria.accountId === undefined || entry.accountId === criteria.accountId)
        .map((entry) => ({
          ...entry,
          metadata: structuredClone(entry.metadata),
          createdAt: new Date(entry.createdAt.getTime())
        }));
      return { transaction: result.transaction, entries };
    })
    .filter((result) => criteria.accountId === undefined || result.entries.length > 0)
    .map((result) => {
      const maxEntryAmount = Math.max(0, ...result.entries.map((entry) => entry.amount));
      const reasons: string[] = [];
      if (criteria.minAmount !== undefined && maxEntryAmount >= criteria.minAmount) {
        reasons.push("amount_at_or_above_threshold");
      }
      if (result.transaction.type === "economy.admin.adjust_balance") {
        reasons.push("admin_adjustment");
      }
      if (result.transaction.type === "economy.void_transaction") {
        reasons.push("void_transaction");
      }

      return {
        transaction: {
          ...result.transaction,
          metadata: structuredClone(result.transaction.metadata),
          createdAt: new Date(result.transaction.createdAt.getTime()),
          completedAt: result.transaction.completedAt
            ? new Date(result.transaction.completedAt.getTime())
            : undefined
        },
        entries: result.entries,
        maxEntryAmount,
        reasons
      };
    })
    .filter((activity) => activity.reasons.length > 0)
    .filter((activity) => criteria.minAmount === undefined || activity.maxEntryAmount >= criteria.minAmount)
    .sort((left, right) =>
      left.transaction.createdAt.getTime() - right.transaction.createdAt.getTime() ||
      left.transaction.id.localeCompare(right.transaction.id)
    );
}

function ledgerEntryNet(entry: LedgerEntry): number {
  return entry.direction === "credit" ? entry.amount : -entry.amount;
}
