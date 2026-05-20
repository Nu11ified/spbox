const state = {
  serverId: "server-1"
};

const statusEl = document.querySelector("#status");
const serverInput = document.querySelector("#server-id");
const serverLabel = document.querySelector("#server-label");
const dashboardOutput = document.querySelector("#dashboard-output");
const healthOutput = document.querySelector("#health-output");
const configOutput = document.querySelector("#config-output");
const auditOutput = document.querySelector("#audit-output");
const pluginImportOutput = document.querySelector("#plugin-import-output");
const pluginRegistryOutput = document.querySelector("#plugin-registry-output");
const pluginDataOutput = document.querySelector("#plugin-data-output");
const deploymentOutput = document.querySelector("#deployment-output");
const economyReadOutput = document.querySelector("#economy-read-output");
const gameplayOutput = document.querySelector("#gameplay-output");
const permissionOutput = document.querySelector("#permission-output");
const discordOutput = document.querySelector("#discord-output");
const menuOutput = document.querySelector("#menu-output");

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => switchView(button.dataset.view));
});

document.querySelector("#refresh").addEventListener("click", () => {
  state.serverId = serverInput.value.trim() || "server-1";
  serverLabel.textContent = state.serverId;
  refreshDashboard();
});

document.querySelector("#config-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  const response = await post(`/servers/${state.serverId}/config`, {
    namespace: data.namespace,
    key: data.key,
    value: parseValue(data.value)
  });
  render(configOutput, response);
});

document.querySelector("#principal-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  await post("/permissions/principals", data);
  setStatus("Principal saved");
});

document.querySelector("#grant-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  await post("/permissions/grants", data);
  setStatus("Grant saved");
});

document.querySelector("#permission-definition-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  await post("/permissions/definitions", data);
  setStatus("Permission saved");
});

document.querySelector("#ace-rule-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  await post("/permissions/ace-rules", {
    id: data.id,
    permissionKey: data.permissionKey,
    aceObject: data.aceObject,
    enabled: parseValue(data.enabled),
    mode: data.mode
  });
  setStatus("ACE rule saved");
});

document.querySelector("#policy-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  await post("/permissions/policies", {
    id: data.id,
    permissionKey: data.permissionKey,
    constraintType: data.constraintType,
    constraint: JSON.parse(data.constraintJson),
    priority: Number(data.priority),
    enabled: parseValue(data.enabled)
  });
  setStatus("Policy saved");
});

document.querySelector("#discord-role-sync-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  const payload = {
    guildId: data.guildId,
    serverId: data.serverId || state.serverId,
    roleMappings: JSON.parse(data.roleMappingsJson),
    members: JSON.parse(data.membersJson)
  };

  if (String(data.edgeTtlMs || "").trim()) {
    payload.edgeTtlMs = Number(data.edgeTtlMs);
  }

  const result = await post("/connectors/discord/role-sync", payload);
  render(discordOutput, result);
  setStatus("Discord roles synced");
});

document.querySelector("#refresh-permissions").addEventListener("click", async () => {
  const permissions = await get("/permissions");
  render(permissionOutput, permissions);
  setStatus("Permissions refreshed");
});

document.querySelector("#menu-definition-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  await post("/menus/definitions", {
    id: data.id,
    pluginId: data.pluginId,
    label: data.label,
    parentId: data.parentId,
    icon: data.icon,
    order: Number(data.order),
    requiredPermission: data.requiredPermission,
    actionId: data.actionId,
    enabled: parseValue(data.enabled),
    visibilityPolicyId: data.visibilityPolicyId
  });
  setStatus("Menu definition saved");
});

document.querySelector("#menu-action-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  await post("/menus/actions", {
    id: data.id,
    pluginId: data.pluginId,
    actionType: data.actionType,
    reducerName: data.reducerName,
    payloadSchemaJson: data.payloadSchemaJson,
    confirmationRequired: parseValue(data.confirmationRequired),
    auditLevel: data.auditLevel,
    requiredPermission: data.requiredPermission,
    enabled: parseValue(data.enabled)
  });
  setStatus("Menu action saved");
});

document.querySelector("#runtime-command-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  await post("/menus/commands", {
    id: data.id,
    pluginId: data.pluginId,
    name: data.name,
    aliasesJson: data.aliasesJson,
    actionId: data.actionId,
    requiredPermission: data.requiredPermission,
    payloadSchemaJson: data.payloadSchemaJson,
    auditLevel: data.auditLevel,
    enabled: parseValue(data.enabled)
  });
  setStatus("Runtime command saved");
});

document.querySelector("#runtime-panel-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  await post("/menus/panels", {
    id: data.id,
    pluginId: data.pluginId,
    title: data.title,
    route: data.route,
    requiredPermission: data.requiredPermission,
    icon: data.icon,
    order: Number(data.order),
    enabled: parseValue(data.enabled)
  });
  setStatus("Runtime panel saved");
});

document.querySelector("#menu-visibility-policy-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  await post("/menus/policies", {
    id: data.id,
    pluginId: data.pluginId,
    policyJson: data.policyJson,
    enabled: parseValue(data.enabled)
  });
  setStatus("Menu visibility saved");
});

document.querySelector("#menu-session-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitter = event.submitter;
  const data = formData(event.currentTarget);

  if (submitter.value === "open") {
    await post("/menus/sessions", {
      id: data.sessionId,
      serverId: state.serverId,
      playerId: data.playerId,
      cacheVersion: Number(data.cacheVersion)
    });
  }

  if (submitter.value === "close") {
    await post(`/menus/sessions/${data.sessionId}/close`, {});
  }

  setStatus(`Menu session ${submitter.value} complete`);
});

document.querySelector("#refresh-menus").addEventListener("click", async () => {
  const menus = await get("/menus");
  render(menuOutput, menus);
  setStatus("Menus refreshed");
});

document.querySelector("#plugin-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitter = event.submitter;
  const data = formData(event.currentTarget);
  const pluginId = data.pluginId;

  if (submitter.value === "install") {
    await post("/plugins/install", {
      pluginId,
      name: data.name,
      version: data.version
    });
  }

  if (submitter.value === "enable") {
    await post(`/plugins/${pluginId}/enable`, {});
  }

  if (submitter.value === "disable") {
    await post(`/plugins/${pluginId}/disable`, {});
  }

  if (submitter.value === "uninstall") {
    await post(`/plugins/${pluginId}/uninstall`, {});
  }

  setStatus(`Plugin ${submitter.value} complete`);
  refreshDashboard();
});

document.querySelector("#plugin-package-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  await post("/plugins/install-package", {
    packageId: data.packageId,
    pluginId: data.pluginId,
    version: data.version,
    source: data.source,
    publisher: data.publisher,
    trustLevel: data.trustLevel,
    signerId: data.signerId,
    signature: data.signature,
    manifestHash: data.manifestHash,
    manifest: JSON.parse(data.manifestJson)
  });
  setStatus("Plugin package installed");
  refreshDashboard();
});

document.querySelector("#plugin-import-plan-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  const plan = JSON.parse(data.planJson);
  const pkg = plan.package;
  const installed = await post("/plugins/install-package", pkg);
  const result = { installed };
  if (parseValue(data.enableAfterInstall)) {
    result.enabled = await post(`/plugins/${pkg.pluginId}/enable`, {});
  }
  render(pluginImportOutput, result);
  setStatus("Plugin import plan installed");
  refreshDashboard();
});

document.querySelector("#plugin-config-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  await post("/plugins/config-values", {
    pluginId: data.pluginId,
    serverId: data.serverId,
    key: data.key,
    value: parseValue(data.value),
    version: Number(data.version)
  });
  setStatus("Plugin config saved");
});

document.querySelector("#plugin-runtime-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  await post("/plugins/runtime-instances", data);
  setStatus("Plugin runtime saved");
});

document.querySelector("#plugin-schema-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  await post("/plugins/schemas", {
    pluginId: data.pluginId,
    schemaVersion: Number(data.schemaVersion),
    entityType: data.entityType,
    schemaJson: data.schemaJson,
    migrationPlanJson: data.migrationPlanJson,
    status: data.status
  });
  setStatus("Plugin schema registered");
});

document.querySelector("#plugin-entity-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  await post("/plugins/entities", data);
  setStatus("Plugin entity saved");
});

document.querySelector("#plugin-data-search-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  const params = new URLSearchParams();
  appendSearchParam(params, "pluginId", data.pluginId);
  appendSearchParam(params, "entityType", data.entityType);
  const pluginData = await get(`/plugins/data?${params.toString()}`);
  render(pluginDataOutput, pluginData);
  setStatus("Plugin data search complete");
});

document.querySelector("#refresh-plugin-registry").addEventListener("click", async () => {
  const registry = await get("/plugins/registry");
  render(pluginRegistryOutput, registry);
  setStatus("Plugin registry refreshed");
});

document.querySelector("#deployment-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitter = event.submitter;
  const data = formData(event.currentTarget);

  const payload = {
    pluginId: data.pluginId,
    bundleId: data.bundleId,
    serverId: state.serverId,
    requestedBy: data.requestedBy
  };

  const response = submitter.value === "request-artifact"
    ? await post("/deployments/request-from-artifact", payload)
    : await post("/deployments/request", { ...payload, bundleBytes: data.bundleBytes });

  setStatus(`Deployment requested: ${response.id}`);
});

document.querySelector("#deployment-control-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitter = event.submitter;
  const data = formData(event.currentTarget);
  const deploymentId = data.deploymentId;
  const pluginId = data.pluginId;

  if (submitter.value === "approve") {
    await post(`/deployments/${deploymentId}/approve`, {
      approvedBy: data.actorId
    });
  }

  if (submitter.value === "fail") {
    await post(`/deployments/${deploymentId}/fail`, {
      actorId: data.actorId,
      reason: data.reason
    });
  }

  if (submitter.value === "kill") {
    await post(`/plugins/${pluginId}/kill`, {
      actorId: data.actorId,
      reason: data.reason
    });
  }

  if (submitter.value === "rollback") {
    await post(`/plugins/${pluginId}/rollback`, {
      serverId: state.serverId
    });
  }

  setStatus(`Deployment ${submitter.value} complete`);
});

document.querySelector("#signer-control-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitter = event.submitter;
  const data = formData(event.currentTarget);

  if (submitter.value === "revoke-package-signer") {
    await post(`/package-signers/${data.signerId}/revoke`, {
      actorId: data.actorId,
      reason: data.reason
    });
  } else {
    await post(`/signers/${data.signerId}/revoke`, {
      actorId: data.actorId,
      reason: data.reason,
      serverId: state.serverId
    });
  }

  setStatus(`Signer ${submitter.value} complete: ${data.signerId}`);
});

document.querySelector("#capability-check-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  const params = new URLSearchParams({ serverId: state.serverId });
  const capability = await get(`/plugins/${data.pluginId}/capabilities/${data.capabilityKey}?${params.toString()}`);
  render(deploymentOutput, capability);
  setStatus("Capability check complete");
});

document.querySelector("#refresh-deployments").addEventListener("click", async () => {
  const deployments = await get("/deployments");
  render(deploymentOutput, deployments);
  setStatus("Deployments refreshed");
});

document.querySelector("#economy-account-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  await post("/economy/accounts", {
    id: data.id,
    ownerType: data.ownerType,
    ownerId: data.ownerId,
    currency: data.currency,
    balance: Number(data.balance)
  });
  setStatus("Account created");
});

document.querySelector("#economy-account-search-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  const params = new URLSearchParams();
  appendSearchParam(params, "ownerType", data.ownerType);
  appendSearchParam(params, "ownerId", data.ownerId);
  appendSearchParam(params, "currency", data.currency);
  appendSearchParam(params, "status", data.status);
  const accounts = await get(`/economy/accounts?${params.toString()}`);
  render(economyReadOutput, accounts);
  setStatus("Economy accounts refreshed");
});

document.querySelector("#economy-transaction-search-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  const params = new URLSearchParams();
  appendSearchParam(params, "accountId", data.accountId);
  appendSearchParam(params, "actorId", data.actorId);
  appendSearchParam(params, "type", data.type);
  appendSearchParam(params, "status", data.status);
  const transactions = await get(`/economy/transactions?${params.toString()}`);
  render(economyReadOutput, transactions);
  setStatus("Economy transactions refreshed");
});

document.querySelector("#economy-ledger-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  const entries = await get(`/economy/transactions/${data.transactionId}/ledger`);
  render(economyReadOutput, entries);
  setStatus("Economy ledger refreshed");
});

document.querySelector("#economy-suspicious-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  const params = new URLSearchParams();
  appendSearchParam(params, "accountId", data.accountId);
  appendSearchParam(params, "actorId", data.actorId);
  appendSearchParam(params, "type", data.type);
  appendSearchParam(params, "minAmount", data.minAmount);
  appendSearchParam(params, "from", data.from);
  appendSearchParam(params, "to", data.to);
  const activity = await get(`/economy/suspicious?${params.toString()}`);
  render(economyReadOutput, activity);
  setStatus("Suspicious activity refreshed");
});

document.querySelector("#economy-statement-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitter = event.submitter;
  const data = formData(event.currentTarget);
  const params = new URLSearchParams();
  appendSearchParam(params, "from", data.from);
  appendSearchParam(params, "to", data.to);
  const path = submitter.value === "csv"
    ? `/economy/accounts/${data.accountId}/statement.csv?${params.toString()}`
    : `/economy/accounts/${data.accountId}/statement?${params.toString()}`;
  const statement = await get(path);
  if (submitter.value === "csv") {
    economyReadOutput.textContent = statement;
  } else {
    render(economyReadOutput, statement);
  }
  setStatus(submitter.value === "csv" ? "Account statement CSV exported" : "Account statement refreshed");
});

document.querySelector("#refresh-economy-limits").addEventListener("click", async () => {
  const limits = await get("/economy/limits");
  render(economyReadOutput, limits);
  setStatus("Economy limits refreshed");
});

document.querySelector("#economy-limit-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  await post("/economy/limits", {
    id: data.id,
    permissionKey: data.permissionKey,
    actionType: data.actionType,
    limitJson: data.limitJson,
    enabled: parseValue(data.enabled)
  });
  setStatus("Economy limit saved");
});

document.querySelector("#economy-transfer-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  await post("/economy/transfers", {
    transactionId: data.transactionId,
    actorId: data.actorId,
    fromAccountId: data.fromAccountId,
    toAccountId: data.toAccountId,
    amount: Number(data.amount),
    reason: data.reason,
    idempotencyKey: data.idempotencyKey
  });
  setStatus("Transfer submitted");
});

document.querySelector("#economy-cash-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitter = event.submitter;
  const data = formData(event.currentTarget);
  const path = submitter.value === "deposit" ? "/economy/deposits" : "/economy/withdrawals";
  await post(path, {
    transactionId: data.transactionId,
    actorId: data.actorId,
    accountId: data.accountId,
    amount: Number(data.amount),
    reason: data.reason,
    idempotencyKey: data.idempotencyKey
  });
  setStatus(`Cash ${submitter.value} submitted`);
});

document.querySelector("#economy-adjustment-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  await post("/economy/adjustments", {
    transactionId: data.transactionId,
    actorId: data.actorId,
    accountId: data.accountId,
    direction: data.direction,
    amount: Number(data.amount),
    reason: data.reason,
    idempotencyKey: data.idempotencyKey
  });
  setStatus("Adjustment submitted");
});

document.querySelector("#economy-salary-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  await post("/economy/salaries", {
    transactionId: data.transactionId,
    actorId: data.actorId,
    employerAccountId: data.employerAccountId,
    employeeAccountId: data.employeeAccountId,
    amount: Number(data.amount),
    reason: data.reason,
    idempotencyKey: data.idempotencyKey
  });
  setStatus("Salary submitted");
});

document.querySelector("#economy-fine-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  await post("/economy/fines", {
    transactionId: data.transactionId,
    actorId: data.actorId,
    playerAccountId: data.playerAccountId,
    destinationAccountId: data.destinationAccountId,
    amount: Number(data.amount),
    reason: data.reason,
    idempotencyKey: data.idempotencyKey
  });
  setStatus("Fine submitted");
});

document.querySelector("#economy-tax-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  await post("/economy/taxes", {
    transactionId: data.transactionId,
    actorId: data.actorId,
    payerAccountId: data.payerAccountId,
    governmentAccountId: data.governmentAccountId,
    amount: Number(data.amount),
    reason: data.reason,
    idempotencyKey: data.idempotencyKey
  });
  setStatus("Tax submitted");
});

document.querySelector("#economy-business-payout-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  await post("/economy/business-payouts", {
    transactionId: data.transactionId,
    actorId: data.actorId,
    businessAccountId: data.businessAccountId,
    destinationAccountId: data.destinationAccountId,
    amount: Number(data.amount),
    reason: data.reason,
    idempotencyKey: data.idempotencyKey
  });
  setStatus("Business payout submitted");
});

document.querySelector("#economy-invoice-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  const payload = {
    id: data.id,
    issuerAccountId: data.issuerAccountId,
    payerAccountId: data.payerAccountId,
    amount: Number(data.amount),
    currency: data.currency,
    reason: data.reason,
    issuedBy: data.issuedBy,
    idempotencyKey: data.idempotencyKey
  };
  if (String(data.dueAt || "").trim()) {
    payload.dueAt = data.dueAt;
  }
  await post("/economy/invoices", payload);
  setStatus("Invoice issued");
});

document.querySelector("#economy-invoice-payment-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  await post(`/economy/invoices/${encodeURIComponent(data.invoiceId)}/pay`, {
    transactionId: data.transactionId,
    actorId: data.actorId,
    idempotencyKey: data.idempotencyKey
  });
  setStatus("Invoice payment submitted");
});

document.querySelector("#economy-item-purchase-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  await post("/economy/item-purchases", {
    transactionId: data.transactionId,
    actorId: data.actorId,
    buyerAccountId: data.buyerAccountId,
    sellerAccountId: data.sellerAccountId,
    amount: Number(data.amount),
    itemKey: data.itemKey,
    quantity: Number(data.quantity),
    idempotencyKey: data.idempotencyKey
  });
  setStatus("Item purchase submitted");
});

document.querySelector("#economy-item-sale-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  await post("/economy/item-sales", {
    transactionId: data.transactionId,
    actorId: data.actorId,
    sellerAccountId: data.sellerAccountId,
    buyerAccountId: data.buyerAccountId,
    amount: Number(data.amount),
    itemKey: data.itemKey,
    quantity: Number(data.quantity),
    idempotencyKey: data.idempotencyKey
  });
  setStatus("Item sale submitted");
});

document.querySelector("#economy-void-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  await post("/economy/voids", {
    transactionId: data.transactionId,
    actorId: data.actorId,
    voidedTransactionId: data.voidedTransactionId,
    reason: data.reason,
    idempotencyKey: data.idempotencyKey
  });
  setStatus("Void submitted");
});

document.querySelector("#gameplay-item-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  await post("/gameplay/items", {
    key: data.key,
    pluginId: data.pluginId,
    label: data.label,
    stackable: parseValue(data.stackable),
    maxStack: Number(data.maxStack)
  });
  setStatus("Item registered");
});

document.querySelector("#gameplay-job-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  await post("/gameplay/jobs", {
    key: data.key,
    pluginId: data.pluginId,
    label: data.label,
    grades: splitList(data.grades)
  });
  setStatus("Job registered");
});

document.querySelector("#gameplay-vehicle-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  await post("/gameplay/vehicles", {
    model: data.model,
    pluginId: data.pluginId,
    label: data.label,
    category: data.category
  });
  setStatus("Vehicle registered");
});

document.querySelector("#gameplay-location-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  await post("/gameplay/locations", {
    key: data.key,
    pluginId: data.pluginId,
    label: data.label,
    x: Number(data.x),
    y: Number(data.y),
    z: Number(data.z)
  });
  setStatus("Location registered");
});

document.querySelector("#gameplay-inventory-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  await post("/gameplay/inventory/grants", {
    id: data.id,
    ownerId: data.ownerId,
    itemKey: data.itemKey,
    quantity: Number(data.quantity)
  });
  setStatus("Item granted");
});

document.querySelector("#gameplay-job-assignment-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  await post("/gameplay/jobs/assignments", {
    characterId: data.characterId,
    jobKey: data.jobKey,
    grade: data.grade,
    onDuty: parseValue(data.onDuty)
  });
  setStatus("Job assigned");
});

document.querySelector("#gameplay-vehicle-spawn-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  await post("/gameplay/vehicle-spawns", {
    spawns: [
      {
        serverId: state.serverId,
        targetSource: data.targetSource,
        model: data.model,
        label: data.label,
        category: data.category,
        location: {
          key: data.locationKey,
          label: data.locationLabel,
          x: Number(data.x),
          y: Number(data.y),
          z: Number(data.z)
        },
        heading: optionalNumber(data.heading),
        warpIntoVehicle: parseValue(data.warpIntoVehicle)
      }
    ]
  });
  setStatus("Vehicle spawn queued");
});

document.querySelector("#gameplay-vehicle-repair-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  await post("/gameplay/vehicle-repairs", {
    repairs: [
      {
        serverId: state.serverId,
        targetSource: data.targetSource,
        targetVehicleNetId: Number(data.targetVehicleNetId)
      }
    ]
  });
  setStatus("Vehicle repair queued");
});

document.querySelector("#gameplay-teleport-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  await post("/gameplay/teleports", {
    teleports: [
      {
        serverId: state.serverId,
        targetSource: data.targetSource,
        x: Number(data.x),
        y: Number(data.y),
        z: Number(data.z),
        heading: optionalNumber(data.heading)
      }
    ]
  });
  setStatus("Teleport queued");
});

document.querySelector("#gameplay-kick-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  await post("/gameplay/kicks", {
    kicks: [
      {
        serverId: state.serverId,
        targetSource: data.targetSource,
        reason: data.reason
      }
    ]
  });
  setStatus("Kick queued");
});

document.querySelector("#refresh-gameplay").addEventListener("click", async () => {
  const gameplay = await get("/gameplay");
  render(gameplayOutput, gameplay);
  setStatus("Gameplay refreshed");
});

document.querySelector("#audit-search-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  const params = new URLSearchParams({ serverId: state.serverId });
  appendSearchParam(params, "actorId", data.actorId);
  appendSearchParam(params, "actionType", data.actionType);
  appendSearchParam(params, "status", data.status);
  const auditLogs = await get(`/audit?${params.toString()}`);
  render(auditOutput, auditLogs);
  setStatus("Audit search complete");
});

async function refreshDashboard() {
  const dashboard = await get(`/servers/${state.serverId}/dashboard`);
  render(healthOutput, dashboard.health);
  render(dashboardOutput, dashboard);
  render(configOutput, dashboard.config);
  render(auditOutput, dashboard.auditLogs);
  setStatus("Dashboard refreshed");
}

function switchView(view) {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });
  document.querySelectorAll(".view").forEach((section) => {
    section.classList.toggle("active", section.id === `view-${view}`);
  });
}

async function get(path) {
  return request(path, { method: "GET" });
}

async function post(path, body) {
  return request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

async function request(path, options) {
  const response = await fetch(path, options);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || `Request failed: ${response.status}`);
  }

  return payload;
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function parseValue(value) {
  if (value === "true") return true;
  if (value === "false") return false;
  const numeric = Number(value);
  return Number.isNaN(numeric) ? value : numeric;
}

function optionalNumber(value) {
  const normalized = String(value || "").trim();
  return normalized ? Number(normalized) : undefined;
}

function splitList(value) {
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function appendSearchParam(params, key, value) {
  const normalized = String(value || "").trim();
  if (normalized) {
    params.append(key, normalized);
  }
}

function render(target, value) {
  target.textContent = JSON.stringify(value, null, 2);
}

function setStatus(message) {
  statusEl.textContent = message;
}

refreshDashboard().catch((error) => setStatus(error.message));
