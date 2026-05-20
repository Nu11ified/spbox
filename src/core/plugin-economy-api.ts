import {
  type Account,
  type AccountOwnerType,
  type BuyItemInput,
  type BusinessPayoutInput,
  type ChargeTaxInput,
  type EconomyLedger,
  type FinePlayerInput,
  type Invoice,
  type IssueInvoiceInput,
  type PayInvoiceInput,
  type PaySalaryInput,
  type SellItemInput,
  type TransferMoneyResult,
  validateEconomyAmount
} from "./economy.js";
import { type PluginCapability, type PluginDeploymentManager } from "./plugin-deployment.js";

export interface PluginEconomyApiOptions {
  ledger: EconomyLedger;
  deployments: PluginDeploymentManager;
  serverId?: string;
  actorState?: (actorPrincipalId: string) => Record<string, unknown> | undefined;
}

export class PluginEconomyApi {
  private readonly ledger: EconomyLedger;
  private readonly deployments: PluginDeploymentManager;
  private readonly serverId: string | undefined;
  private readonly actorState: ((actorPrincipalId: string) => Record<string, unknown> | undefined) | undefined;

  public constructor(options: PluginEconomyApiOptions) {
    this.ledger = options.ledger;
    this.deployments = options.deployments;
    if (options.serverId !== undefined && isBlankString(options.serverId)) {
      throw new Error("serverId is required");
    }
    this.serverId = options.serverId;
    this.actorState = options.actorState;
  }

  public issueInvoice(pluginId: string, input: IssueInvoiceInput): Invoice {
    this.assertCapability(pluginId, input.actorPrincipalId, "economy.issue_invoice", input.amount, [
      input.issuerAccountId,
      input.payerAccountId
    ]);
    return this.ledger.issueInvoice(input);
  }

  public payInvoice(pluginId: string, input: PayInvoiceInput): TransferMoneyResult {
    this.assertCapability(pluginId, input.actorPrincipalId, "economy.pay_invoice");
    return this.ledger.payInvoice(input);
  }

  public buyItem(pluginId: string, input: BuyItemInput): TransferMoneyResult {
    validateShopItem(input.itemKey, input.quantity);
    this.assertCapability(pluginId, input.actorPrincipalId, "economy.buy_item", input.amount, [
      input.buyerAccountId,
      input.sellerAccountId
    ]);
    return this.ledger.buyItem(input);
  }

  public sellItem(pluginId: string, input: SellItemInput): TransferMoneyResult {
    validateShopItem(input.itemKey, input.quantity);
    this.assertCapability(pluginId, input.actorPrincipalId, "economy.sell_item", input.amount, [
      input.sellerAccountId,
      input.buyerAccountId
    ]);
    return this.ledger.sellItem(input);
  }

  public paySalary(pluginId: string, input: PaySalaryInput): TransferMoneyResult {
    this.assertCapability(pluginId, input.actorPrincipalId, "economy.pay_salary", input.amount, [
      input.employerAccountId,
      input.employeeAccountId
    ]);
    return this.ledger.paySalary(input);
  }

  public finePlayer(pluginId: string, input: FinePlayerInput): TransferMoneyResult {
    this.assertCapability(pluginId, input.actorPrincipalId, "economy.fine_player", input.amount, [
      input.playerAccountId,
      input.governmentAccountId
    ]);
    return this.ledger.finePlayer(input);
  }

  public chargeTax(pluginId: string, input: ChargeTaxInput): TransferMoneyResult {
    this.assertCapability(pluginId, input.actorPrincipalId, "economy.charge_tax", input.amount, [
      input.payerAccountId,
      input.governmentAccountId
    ]);
    return this.ledger.chargeTax(input);
  }

  public businessPayout(pluginId: string, input: BusinessPayoutInput): TransferMoneyResult {
    this.assertCapability(pluginId, input.actorPrincipalId, "economy.business_payout", input.amount, [
      input.businessAccountId,
      input.payoutAccountId
    ]);
    return this.ledger.businessPayout(input);
  }

  private assertCapability(
    pluginId: string,
    actorPrincipalId: string,
    capabilityKey: string,
    amount?: number,
    accountIds: string[] = []
  ): PluginCapability {
    validatePluginActionIdentity(pluginId, actorPrincipalId);
    if (amount !== undefined) {
      validateEconomyAmount(amount);
    }
    validateAccountIds(accountIds);
    const capability = this.serverId
      ? this.deployments.assertCapabilityForServer(pluginId, this.serverId, capabilityKey)
      : this.deployments.assertCapability(pluginId, capabilityKey);
    const constraints = readCapabilityConstraints(capability);
    if (amount !== undefined && constraints.maxAmount !== undefined && amount > constraints.maxAmount) {
      throw new Error(`Capability ${capabilityKey} maxAmount ${constraints.maxAmount} exceeded`);
    }
    if (constraints.allowedAccountOwnerTypes) {
      enforceAllowedAccountOwnerTypes(
        capabilityKey,
        accountIds.map((accountId) => this.ledger.getAccount(accountId)),
        constraints.allowedAccountOwnerTypes
      );
    }
    if (constraints.requiresOnDuty) {
      enforceActorOnDuty(capabilityKey, this.actorState?.(actorPrincipalId));
    }

    return capability;
  }
}

function validatePluginActionIdentity(pluginId: string, actorPrincipalId: string): void {
  if (isBlankString(pluginId)) {
    throw new Error("pluginId is required");
  }
  if (isBlankString(actorPrincipalId)) {
    throw new Error("actorPrincipalId is required");
  }
}

function isBlankString(value: unknown): value is string {
  return typeof value !== "string" || value.trim().length === 0;
}

function validateAccountIds(accountIds: string[]): void {
  if (accountIds.some((accountId) => isBlankString(accountId))) {
    throw new Error("accountId is required");
  }
}

function validateShopItem(itemKey: string, quantity: number): void {
  if (isBlankString(itemKey)) {
    throw new Error("itemKey is required");
  }
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new Error("Quantity must be a positive integer");
  }
}

interface EconomyCapabilityConstraints {
  maxAmount?: number;
  allowedAccountOwnerTypes?: AccountOwnerType[];
  requiresOnDuty?: boolean;
}

const accountOwnerTypes = new Set<AccountOwnerType>([
  "character",
  "business",
  "government",
  "society",
  "plugin"
]);

function readCapabilityConstraints(capability: PluginCapability): EconomyCapabilityConstraints {
  if (!capability.constraints || typeof capability.constraints !== "object" || Array.isArray(capability.constraints)) {
    return {};
  }

  const constraints = capability.constraints as Record<string, unknown>;
  const rawMaxAmount = constraints.maxAmount ?? constraints.max_amount;
  const rawAllowedOwnerTypes =
    constraints.allowedAccountOwnerTypes ?? constraints.allowed_account_owner_types;
  const rawRequiresOnDuty = constraints.requiresOnDuty ?? constraints.requires_on_duty;
  if (
    rawMaxAmount !== undefined &&
    (typeof rawMaxAmount !== "number" || !Number.isSafeInteger(rawMaxAmount) || rawMaxAmount <= 0)
  ) {
    throw new Error(`Invalid maxAmount constraint for capability ${capability.key}`);
  }
  if (
    rawAllowedOwnerTypes !== undefined &&
    (!Array.isArray(rawAllowedOwnerTypes) ||
      rawAllowedOwnerTypes.length === 0 ||
      rawAllowedOwnerTypes.some((ownerType) => !accountOwnerTypes.has(ownerType as AccountOwnerType)))
  ) {
    throw new Error(`Invalid allowedAccountOwnerTypes constraint for capability ${capability.key}`);
  }
  if (rawRequiresOnDuty !== undefined && typeof rawRequiresOnDuty !== "boolean") {
    throw new Error(`Invalid requiresOnDuty constraint for capability ${capability.key}`);
  }

  return {
    maxAmount: rawMaxAmount,
    allowedAccountOwnerTypes: rawAllowedOwnerTypes as AccountOwnerType[] | undefined,
    requiresOnDuty: rawRequiresOnDuty
  };
}

function enforceAllowedAccountOwnerTypes(
  capabilityKey: string,
  accounts: Account[],
  allowedAccountOwnerTypes: AccountOwnerType[]
): void {
  const allowed = new Set(allowedAccountOwnerTypes);
  const blocked = accounts.find((account) => !allowed.has(account.ownerType));
  if (blocked) {
    throw new Error(`Capability ${capabilityKey} account owner type ${blocked.ownerType} is not allowed`);
  }
}

function enforceActorOnDuty(capabilityKey: string, state: Record<string, unknown> | undefined): void {
  if (state?.onDuty === true || state?.["job:on_duty"] === true) {
    return;
  }

  throw new Error(`Capability ${capabilityKey} requires actor to be on duty`);
}
