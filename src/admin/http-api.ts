import { type AdminService } from "./service.js";
import { type GrantPermissionInput, type PluginManifest, type Principal } from "../core/index.js";

export interface AdminHttpRequest {
  method: string;
  path: string;
  body?: unknown;
}

export interface AdminHttpResponse {
  status: number;
  body: unknown;
}

export interface AdminHttpApi {
  handle(request: AdminHttpRequest): Promise<AdminHttpResponse>;
}

export function createAdminHttpApi(admin: AdminService): AdminHttpApi {
  return {
    async handle(request) {
      try {
        return await route(admin, request);
      } catch (error) {
        return {
          status: 400,
          body: { error: error instanceof Error ? error.message : "Bad request" }
        };
      }
    }
  };
}

async function route(admin: AdminService, request: AdminHttpRequest): Promise<AdminHttpResponse> {
  const [pathOnly, queryString = ""] = request.path.split("?");
  const query = new URLSearchParams(queryString);
  const parts = pathOnly.split("/").filter(Boolean);

  if (request.method === "GET" && parts[0] === "servers" && parts[2] === "dashboard") {
    return ok(admin.getDashboard(parts[1] as string));
  }

  if (request.method === "GET" && pathOnly === "/audit") {
    return ok(admin.searchAuditLogs({
      serverId: optionalQueryString(query.get("serverId")),
      actorId: optionalQueryString(query.get("actorId")),
      actionType: optionalQueryString(query.get("actionType")),
      status: optionalQueryString(query.get("status"))
    }));
  }

  if (request.method === "GET" && pathOnly === "/qbcore/player-data") {
    return ok(admin.getQbCorePlayerDataSnapshots({
      serverId: optionalQueryString(query.get("serverId"))
    }));
  }

  if (request.method === "POST" && pathOnly === "/qbcore/character-updates") {
    const body = requireObject(request.body);
    return ok({
      applied: await admin.applyQbCoreRuntimeCharacterUpdates(requireQbCoreRuntimeCharacterUpdates(body.updates))
    });
  }

  if (request.method === "POST" && pathOnly === "/qbcore/character-selections") {
    const body = requireObject(request.body);
    return ok({
      applied: await admin.applyQbCoreRuntimeCharacterSelections(requireQbCoreRuntimeCharacterSelections(body.selections))
    });
  }

  if (request.method === "POST" && pathOnly === "/qbcore/money-updates") {
    const body = requireObject(request.body);
    return ok({
      applied: await admin.applyQbCoreRuntimeMoneyUpdates(requireQbCoreRuntimeMoneyUpdates(body.updates))
    });
  }

  if (request.method === "POST" && pathOnly === "/qbcore/inventory-updates") {
    const body = requireObject(request.body);
    return ok({
      applied: await admin.applyQbCoreRuntimeInventoryUpdates(requireQbCoreRuntimeInventoryUpdates(body.updates))
    });
  }

  if (request.method === "POST" && parts[0] === "servers" && parts[2] === "audit" && parts[3] === "mirror") {
    admin.mirrorRuntimeAuditLogs(parts[1] as string);
    await admin.flushWrites();
    return ok({ ok: true });
  }

  if (request.method === "POST" && parts[0] === "servers" && parts[2] === "config") {
    const body = requireObject(request.body);
    const response = ok(admin.setConfig({
      serverId: parts[1] as string,
      namespace: requireString(body.namespace, "namespace"),
      key: requireString(body.key, "key"),
      value: body.value
    }));
    await admin.flushWrites();
    return response;
  }

  if (request.method === "GET" && pathOnly === "/plugins") {
    return ok(admin.getPlugins());
  }

  if (request.method === "GET" && pathOnly === "/plugins/registry") {
    return ok(admin.getPluginRegistrySnapshot());
  }

  if (request.method === "POST" && pathOnly === "/resources/reconcile") {
    return ok(await admin.reconcileLegacyResources());
  }

  if (request.method === "POST" && pathOnly === "/plugins/install") {
    const response = ok(admin.installPlugin(requireObject(request.body) as unknown as PluginManifest));
    await admin.flushWrites();
    return response;
  }

  if (request.method === "POST" && pathOnly === "/plugins/install-package") {
    const response = ok(admin.installPluginPackage(requireObject(request.body) as never));
    await admin.flushWrites();
    return response;
  }

  if (request.method === "POST" && parts[0] === "package-signers" && parts[2] === "revoke") {
    const body = requireObject(request.body);
    const response = ok(admin.revokePackageSigner(
      parts[1] as string,
      requireString(body.actorId, "actorId"),
      requireString(body.reason, "reason")
    ));
    await admin.flushWrites();
    return response;
  }

  if (request.method === "POST" && parts[0] === "plugins" && parts[2] === "enable") {
    const response = ok(admin.enablePlugin(parts[1] as string));
    await admin.flushWrites();
    return response;
  }

  if (request.method === "POST" && parts[0] === "plugins" && parts[2] === "disable") {
    const response = ok(admin.disablePlugin(parts[1] as string));
    await admin.flushWrites();
    return response;
  }

  if (request.method === "POST" && parts[0] === "plugins" && parts[2] === "uninstall") {
    admin.uninstallPlugin(parts[1] as string);
    await admin.flushWrites();
    return ok({ ok: true });
  }

  if (request.method === "POST" && pathOnly === "/plugins/runtime-instances") {
    const body = requireObject(request.body);
    admin.upsertPluginRuntimeInstance({
      pluginId: requireString(body.pluginId, "pluginId"),
      serverId: requireString(body.serverId, "serverId"),
      status: requireString(body.status, "status"),
      errorMessage: optionalString(body.errorMessage)
    });
    await admin.flushWrites();
    return ok({ ok: true });
  }

  if (request.method === "POST" && pathOnly === "/plugins/config-values") {
    const body = requireObject(request.body);
    admin.setPluginConfigValue({
      pluginId: requireString(body.pluginId, "pluginId"),
      serverId: requireString(body.serverId, "serverId"),
      key: requireString(body.key, "key"),
      value: body.value,
      version: requireNumber(body.version, "version")
    });
    await admin.flushWrites();
    return ok({ ok: true });
  }

  if (request.method === "POST" && pathOnly === "/plugins/schemas") {
    const body = requireObject(request.body);
    await admin.registerPluginSchema({
      pluginId: requireString(body.pluginId, "pluginId"),
      schemaVersion: requireNumber(body.schemaVersion, "schemaVersion"),
      entityType: requireString(body.entityType, "entityType"),
      schemaJson: requireString(body.schemaJson, "schemaJson"),
      migrationPlanJson: optionalString(body.migrationPlanJson),
      status: requireString(body.status, "status")
    });
    return ok({ ok: true });
  }

  if (request.method === "POST" && pathOnly === "/plugins/entities") {
    const body = requireObject(request.body);
    await admin.upsertPluginEntity({
      id: requireString(body.id, "id"),
      pluginId: requireString(body.pluginId, "pluginId"),
      entityType: requireString(body.entityType, "entityType"),
      ownerType: requireString(body.ownerType, "ownerType"),
      ownerId: requireString(body.ownerId, "ownerId"),
      dataJson: requireString(body.dataJson, "dataJson")
    });
    return ok({ ok: true });
  }

  if (request.method === "GET" && pathOnly === "/plugins/data") {
    return ok(admin.getPluginDataSnapshot({
      pluginId: optionalQueryString(query.get("pluginId")),
      entityType: optionalQueryString(query.get("entityType"))
    }));
  }

  if (request.method === "GET" && pathOnly === "/permissions") {
    return ok(admin.getPermissionSnapshot());
  }

  if (request.method === "POST" && pathOnly === "/connectors/discord/role-sync") {
    const body = requireObject(request.body);
    const response = ok(admin.syncDiscordRoles({
      guildId: requireString(body.guildId, "guildId"),
      serverId: requireString(body.serverId, "serverId"),
      roleMappings: requireDiscordRoleMappings(body.roleMappings),
      members: requireDiscordMembers(body.members),
      edgeTtlMs: optionalPositiveNumber(body.edgeTtlMs, "edgeTtlMs")
    }));
    await admin.flushWrites();
    return response;
  }

  if (request.method === "POST" && pathOnly === "/permissions/principals") {
    const response = ok(admin.upsertPrincipal(requireObject(request.body) as unknown as Principal));
    await admin.flushWrites();
    return response;
  }

  if (request.method === "POST" && pathOnly === "/permissions/definitions") {
    const body = requireObject(request.body);
    const response = ok(admin.registerPermissionDefinition({
      id: requireString(body.id, "id"),
      key: requireString(body.key, "key"),
      description: requireString(body.description, "description"),
      pluginId: requireString(body.pluginId, "pluginId")
    }));
    await admin.flushWrites();
    return response.body && typeof response.body === "object" ? ok({ ok: true }) : response;
  }

  if (request.method === "POST" && pathOnly === "/permissions/ace-rules") {
    const body = requireObject(request.body);
    const response = ok(admin.upsertAceMirrorRule({
      id: requireString(body.id, "id"),
      permissionKey: requireString(body.permissionKey, "permissionKey"),
      aceObject: requireString(body.aceObject, "aceObject"),
      enabled: requireBoolean(body.enabled, "enabled"),
      mode: requireString(body.mode, "mode") as never
    }));
    await admin.flushWrites();
    return response.body && typeof response.body === "object" ? ok({ ok: true }) : response;
  }

  if (request.method === "POST" && pathOnly === "/permissions/grants") {
    const body = requireObject(request.body);
    admin.grantPermission({
      principalId: requireString(body.principalId, "principalId"),
      permissionKey: requireString(body.permissionKey, "permissionKey"),
      effect: requireString(body.effect, "effect") as GrantPermissionInput["effect"],
      source: requireString(body.source, "source"),
      expiresAt: optionalDate(body.expiresAt, "expiresAt")
    });
    await admin.flushWrites();
    return ok({ ok: true });
  }

  if (request.method === "POST" && pathOnly === "/permissions/policies") {
    const body = requireObject(request.body);
    const response = ok(admin.upsertPolicyConstraint({
      id: requireString(body.id, "id"),
      permissionKey: requireString(body.permissionKey, "permissionKey"),
      constraintType: requireString(body.constraintType, "constraintType") as never,
      constraint: requireObject(body.constraint),
      priority: requireNumber(body.priority, "priority"),
      enabled: requireBoolean(body.enabled, "enabled")
    }));
    await admin.flushWrites();
    return response.body && typeof response.body === "object" ? ok({ ok: true }) : response;
  }

  if (request.method === "DELETE" && parts[0] === "permissions" && parts[1] === "policies") {
    admin.removePolicyConstraint(parts[2] as string);
    await admin.flushWrites();
    return ok({ ok: true });
  }

  if (request.method === "GET" && pathOnly === "/menus") {
    return ok(admin.getMenuRegistry());
  }

  if (request.method === "GET" && pathOnly === "/menus/refresh-targets") {
    return ok(admin.planActiveMenuRefreshes({
      serverId: optionalQueryString(query.get("serverId"))
    }));
  }

  if (request.method === "POST" && pathOnly === "/menus/refresh-targets/drain") {
    return ok(admin.drainPendingMenuRefreshes({
      serverId: optionalQueryString(query.get("serverId"))
    }));
  }

  if (request.method === "POST" && pathOnly === "/runtime/replicated-state") {
    const body = requireObject(request.body);
    const updates = requireReplicatedStateUpdates(body.updates);
    return ok({
      queued: admin.queueReplicatedState(updates).length
    });
  }

  if (request.method === "POST" && pathOnly === "/runtime/replicated-state/drain") {
    return ok(admin.drainReplicatedState({
      serverId: optionalQueryString(query.get("serverId"))
    }));
  }

  if (request.method === "POST" && pathOnly === "/runtime/world-state") {
    const body = requireObject(request.body);
    return ok({
      queued: admin.queueWorldState(requireWorldStateUpdates(body.updates)).length
    });
  }

  if (request.method === "POST" && pathOnly === "/runtime/world-state/drain") {
    return ok(admin.drainWorldState({
      serverId: optionalQueryString(query.get("serverId"))
    }));
  }

  if (request.method === "POST" && pathOnly === "/menus/definitions") {
    const body = requireObject(request.body);
    await admin.upsertMenuDefinition({
      id: requireString(body.id, "id"),
      pluginId: requireString(body.pluginId, "pluginId"),
      label: requireString(body.label, "label"),
      parentId: optionalString(body.parentId),
      icon: optionalString(body.icon),
      order: requireNumber(body.order, "order"),
      requiredPermission: optionalString(body.requiredPermission),
      actionId: optionalString(body.actionId),
      enabled: requireBoolean(body.enabled, "enabled"),
      visibilityPolicyId: optionalString(body.visibilityPolicyId)
    });
    return ok({ ok: true });
  }

  if (request.method === "POST" && pathOnly === "/menus/actions") {
    const body = requireObject(request.body);
    await admin.upsertMenuAction({
      id: requireString(body.id, "id"),
      pluginId: requireString(body.pluginId, "pluginId"),
      actionType: requireString(body.actionType, "actionType"),
      reducerName: optionalString(body.reducerName),
      payloadSchemaJson: optionalString(body.payloadSchemaJson),
      confirmationRequired: requireBoolean(body.confirmationRequired, "confirmationRequired"),
      auditLevel: requireString(body.auditLevel, "auditLevel"),
      requiredPermission: optionalString(body.requiredPermission),
      enabled: requireBoolean(body.enabled, "enabled")
    });
    return ok({ ok: true });
  }

  if (request.method === "POST" && pathOnly === "/menus/commands") {
    const body = requireObject(request.body);
    await admin.upsertRuntimeCommand({
      id: requireString(body.id, "id"),
      pluginId: requireString(body.pluginId, "pluginId"),
      name: requireString(body.name, "name"),
      aliasesJson: optionalString(body.aliasesJson),
      actionId: requireString(body.actionId, "actionId"),
      requiredPermission: optionalString(body.requiredPermission),
      payloadSchemaJson: optionalString(body.payloadSchemaJson),
      auditLevel: requireString(body.auditLevel, "auditLevel"),
      enabled: requireBoolean(body.enabled, "enabled")
    });
    return ok({ ok: true });
  }

  if (request.method === "POST" && pathOnly === "/menus/panels") {
    const body = requireObject(request.body);
    await admin.upsertRuntimePanel({
      id: requireString(body.id, "id"),
      pluginId: requireString(body.pluginId, "pluginId"),
      title: requireString(body.title, "title"),
      route: requireString(body.route, "route"),
      requiredPermission: optionalString(body.requiredPermission),
      icon: optionalString(body.icon),
      order: requireNumber(body.order, "order"),
      enabled: requireBoolean(body.enabled, "enabled")
    });
    return ok({ ok: true });
  }

  if (request.method === "POST" && pathOnly === "/menus/policies") {
    const body = requireObject(request.body);
    await admin.upsertMenuVisibilityPolicy({
      id: requireString(body.id, "id"),
      pluginId: requireString(body.pluginId, "pluginId"),
      policyJson: requireString(body.policyJson, "policyJson"),
      enabled: requireBoolean(body.enabled, "enabled")
    });
    return ok({ ok: true });
  }

  if (request.method === "POST" && pathOnly === "/menus/sessions") {
    const body = requireObject(request.body);
    await admin.openMenuSession({
      id: requireString(body.id, "id"),
      serverId: requireString(body.serverId, "serverId"),
      playerId: requireString(body.playerId, "playerId"),
      cacheVersion: requireNumber(body.cacheVersion, "cacheVersion")
    });
    return ok({ ok: true });
  }

  if (request.method === "POST" && parts[0] === "menus" && parts[1] === "sessions" && parts[3] === "close") {
    await admin.closeMenuSession(parts[2] as string);
    return ok({ ok: true });
  }

  if (request.method === "POST" && pathOnly === "/economy/accounts") {
    const body = requireObject(request.body);
    await admin.createEconomyAccount({
      id: requireString(body.id, "id"),
      ownerType: requireString(body.ownerType, "ownerType") as never,
      ownerId: requireString(body.ownerId, "ownerId"),
      currency: requireString(body.currency, "currency"),
      balance: requireNumber(body.balance, "balance")
    });
    return ok({ ok: true });
  }

  if (request.method === "GET" && pathOnly === "/economy/accounts") {
    const body = optionalObject(request.body);
    return ok(admin.searchEconomyAccounts({
      ownerType: optionalQueryOrBodyString(query, body, "ownerType") as never,
      ownerId: optionalQueryOrBodyString(query, body, "ownerId"),
      currency: optionalQueryOrBodyString(query, body, "currency"),
      status: optionalQueryOrBodyString(query, body, "status") as never
    }));
  }

  if (request.method === "GET" && pathOnly === "/economy/transactions") {
    const body = optionalObject(request.body);
    return ok(admin.listEconomyTransactions({
      accountId: optionalQueryOrBodyString(query, body, "accountId"),
      actorId: optionalQueryOrBodyString(query, body, "actorId"),
      type: optionalQueryOrBodyString(query, body, "type"),
      status: optionalQueryOrBodyString(query, body, "status") as never
    }));
  }

  if (request.method === "GET" && pathOnly === "/economy/suspicious") {
    const body = optionalObject(request.body);
    return ok(admin.findSuspiciousEconomyActivity({
      accountId: optionalQueryOrBodyString(query, body, "accountId"),
      actorId: optionalQueryOrBodyString(query, body, "actorId"),
      type: optionalQueryOrBodyString(query, body, "type"),
      minAmount: optionalQueryOrBodyNumber(query, body, "minAmount"),
      from: optionalQueryOrBodyDate(query, body, "from"),
      to: optionalQueryOrBodyDate(query, body, "to")
    }));
  }

  if (request.method === "GET" && parts[0] === "economy" && parts[1] === "accounts" && parts[3] === "statement") {
    const body = optionalObject(request.body);
    return ok(admin.getEconomyAccountStatement({
      accountId: parts[2] as string,
      from: optionalQueryOrBodyDate(query, body, "from"),
      to: optionalQueryOrBodyDate(query, body, "to")
    }));
  }

  if (request.method === "GET" && parts[0] === "economy" && parts[1] === "accounts" && parts[3] === "statement.csv") {
    const body = optionalObject(request.body);
    return ok(admin.exportEconomyAccountStatementCsv({
      accountId: parts[2] as string,
      from: optionalQueryOrBodyDate(query, body, "from"),
      to: optionalQueryOrBodyDate(query, body, "to")
    }));
  }

  if (request.method === "GET" && parts[0] === "economy" && parts[1] === "transactions" && parts[3] === "ledger") {
    return ok(admin.getEconomyLedgerEntries(parts[2] as string));
  }

  if (request.method === "GET" && pathOnly === "/economy/limits") {
    return ok(admin.getEconomyLimits());
  }

  if (request.method === "POST" && pathOnly === "/economy/limits") {
    const body = requireObject(request.body);
    await admin.upsertEconomyLimit({
      id: requireString(body.id, "id"),
      permissionKey: requireString(body.permissionKey, "permissionKey"),
      actionType: requireString(body.actionType, "actionType"),
      limitJson: requireString(body.limitJson, "limitJson"),
      enabled: requireBoolean(body.enabled, "enabled")
    });
    return ok({ ok: true });
  }

  if (request.method === "POST" && pathOnly === "/economy/transfers") {
    const body = requireObject(request.body);
    await admin.transferEconomyMoney({
      transactionId: requireString(body.transactionId, "transactionId"),
      actorId: requireString(body.actorId, "actorId"),
      fromAccountId: requireString(body.fromAccountId, "fromAccountId"),
      toAccountId: requireString(body.toAccountId, "toAccountId"),
      amount: requireNumber(body.amount, "amount"),
      reason: requireString(body.reason, "reason"),
      idempotencyKey: requireString(body.idempotencyKey, "idempotencyKey")
    });
    return ok({ ok: true });
  }

  if (request.method === "POST" && pathOnly === "/economy/deposits") {
    const body = requireObject(request.body);
    await admin.depositEconomyCash({
      transactionId: requireString(body.transactionId, "transactionId"),
      actorId: requireString(body.actorId, "actorId"),
      accountId: requireString(body.accountId, "accountId"),
      amount: requireNumber(body.amount, "amount"),
      reason: requireString(body.reason, "reason"),
      idempotencyKey: requireString(body.idempotencyKey, "idempotencyKey")
    });
    return ok({ ok: true });
  }

  if (request.method === "POST" && pathOnly === "/economy/withdrawals") {
    const body = requireObject(request.body);
    await admin.withdrawEconomyCash({
      transactionId: requireString(body.transactionId, "transactionId"),
      actorId: requireString(body.actorId, "actorId"),
      accountId: requireString(body.accountId, "accountId"),
      amount: requireNumber(body.amount, "amount"),
      reason: requireString(body.reason, "reason"),
      idempotencyKey: requireString(body.idempotencyKey, "idempotencyKey")
    });
    return ok({ ok: true });
  }

  if (request.method === "POST" && pathOnly === "/economy/adjustments") {
    const body = requireObject(request.body);
    await admin.adjustEconomyBalance({
      transactionId: requireString(body.transactionId, "transactionId"),
      actorId: requireString(body.actorId, "actorId"),
      accountId: requireString(body.accountId, "accountId"),
      direction: requireString(body.direction, "direction"),
      amount: requireNumber(body.amount, "amount"),
      reason: requireString(body.reason, "reason"),
      idempotencyKey: requireString(body.idempotencyKey, "idempotencyKey")
    });
    return ok({ ok: true });
  }

  if (request.method === "POST" && pathOnly === "/economy/salaries") {
    const body = requireObject(request.body);
    await admin.payEconomySalary({
      transactionId: requireString(body.transactionId, "transactionId"),
      actorId: requireString(body.actorId, "actorId"),
      employerAccountId: requireString(body.employerAccountId, "employerAccountId"),
      employeeAccountId: requireString(body.employeeAccountId, "employeeAccountId"),
      amount: requireNumber(body.amount, "amount"),
      reason: requireString(body.reason, "reason"),
      idempotencyKey: requireString(body.idempotencyKey, "idempotencyKey")
    });
    return ok({ ok: true });
  }

  if (request.method === "POST" && pathOnly === "/economy/fines") {
    const body = requireObject(request.body);
    await admin.fineEconomyPlayer({
      transactionId: requireString(body.transactionId, "transactionId"),
      actorId: requireString(body.actorId, "actorId"),
      playerAccountId: requireString(body.playerAccountId, "playerAccountId"),
      destinationAccountId: requireString(body.destinationAccountId, "destinationAccountId"),
      amount: requireNumber(body.amount, "amount"),
      reason: requireString(body.reason, "reason"),
      idempotencyKey: requireString(body.idempotencyKey, "idempotencyKey")
    });
    return ok({ ok: true });
  }

  if (request.method === "POST" && pathOnly === "/economy/taxes") {
    const body = requireObject(request.body);
    await admin.chargeEconomyTax({
      transactionId: requireString(body.transactionId, "transactionId"),
      actorId: requireString(body.actorId, "actorId"),
      payerAccountId: requireString(body.payerAccountId, "payerAccountId"),
      governmentAccountId: requireString(body.governmentAccountId, "governmentAccountId"),
      amount: requireNumber(body.amount, "amount"),
      reason: requireString(body.reason, "reason"),
      idempotencyKey: requireString(body.idempotencyKey, "idempotencyKey")
    });
    return ok({ ok: true });
  }

  if (request.method === "POST" && pathOnly === "/economy/business-payouts") {
    const body = requireObject(request.body);
    await admin.payEconomyBusinessPayout({
      transactionId: requireString(body.transactionId, "transactionId"),
      actorId: requireString(body.actorId, "actorId"),
      businessAccountId: requireString(body.businessAccountId, "businessAccountId"),
      destinationAccountId: requireString(body.destinationAccountId, "destinationAccountId"),
      amount: requireNumber(body.amount, "amount"),
      reason: requireString(body.reason, "reason"),
      idempotencyKey: requireString(body.idempotencyKey, "idempotencyKey")
    });
    return ok({ ok: true });
  }

  if (request.method === "POST" && pathOnly === "/economy/invoices") {
    const body = requireObject(request.body);
    await admin.issueEconomyInvoice({
      id: requireString(body.id, "id"),
      issuerAccountId: requireString(body.issuerAccountId, "issuerAccountId"),
      payerAccountId: requireString(body.payerAccountId, "payerAccountId"),
      amount: requireNumber(body.amount, "amount"),
      currency: requireString(body.currency, "currency"),
      reason: requireString(body.reason, "reason"),
      issuedBy: requireString(body.issuedBy, "issuedBy"),
      idempotencyKey: requireString(body.idempotencyKey, "idempotencyKey"),
      dueAt: optionalDate(body.dueAt, "dueAt")
    });
    return ok({ ok: true });
  }

  if (request.method === "POST" && parts[0] === "economy" && parts[1] === "invoices" && parts[3] === "pay") {
    const body = requireObject(request.body);
    await admin.payEconomyInvoice({
      transactionId: requireString(body.transactionId, "transactionId"),
      actorId: requireString(body.actorId, "actorId"),
      invoiceId: decodeURIComponent(parts[2] as string),
      idempotencyKey: requireString(body.idempotencyKey, "idempotencyKey")
    });
    return ok({ ok: true });
  }

  if (request.method === "POST" && pathOnly === "/economy/item-purchases") {
    const body = requireObject(request.body);
    await admin.buyEconomyItem({
      transactionId: requireString(body.transactionId, "transactionId"),
      actorId: requireString(body.actorId, "actorId"),
      buyerAccountId: requireString(body.buyerAccountId, "buyerAccountId"),
      sellerAccountId: requireString(body.sellerAccountId, "sellerAccountId"),
      amount: requireNumber(body.amount, "amount"),
      itemKey: requireString(body.itemKey, "itemKey"),
      quantity: requireNumber(body.quantity, "quantity"),
      idempotencyKey: requireString(body.idempotencyKey, "idempotencyKey")
    });
    return ok({ ok: true });
  }

  if (request.method === "POST" && pathOnly === "/economy/item-sales") {
    const body = requireObject(request.body);
    await admin.sellEconomyItem({
      transactionId: requireString(body.transactionId, "transactionId"),
      actorId: requireString(body.actorId, "actorId"),
      sellerAccountId: requireString(body.sellerAccountId, "sellerAccountId"),
      buyerAccountId: requireString(body.buyerAccountId, "buyerAccountId"),
      amount: requireNumber(body.amount, "amount"),
      itemKey: requireString(body.itemKey, "itemKey"),
      quantity: requireNumber(body.quantity, "quantity"),
      idempotencyKey: requireString(body.idempotencyKey, "idempotencyKey")
    });
    return ok({ ok: true });
  }

  if (request.method === "POST" && pathOnly === "/economy/voids") {
    const body = requireObject(request.body);
    await admin.voidEconomyTransaction({
      transactionId: requireString(body.transactionId, "transactionId"),
      actorId: requireString(body.actorId, "actorId"),
      voidedTransactionId: requireString(body.voidedTransactionId, "voidedTransactionId"),
      reason: requireString(body.reason, "reason"),
      idempotencyKey: requireString(body.idempotencyKey, "idempotencyKey")
    });
    return ok({ ok: true });
  }

  if (request.method === "GET" && pathOnly === "/gameplay") {
    return ok(admin.getGameplaySnapshot());
  }

  if (request.method === "POST" && pathOnly === "/gameplay/items") {
    const body = requireObject(request.body);
    await admin.registerGameplayItem({
      key: requireString(body.key, "key"),
      pluginId: requireString(body.pluginId, "pluginId"),
      label: requireString(body.label, "label"),
      stackable: requireBoolean(body.stackable, "stackable"),
      maxStack: requireNumber(body.maxStack, "maxStack")
    });
    return ok({ ok: true });
  }

  if (request.method === "POST" && pathOnly === "/gameplay/jobs") {
    const body = requireObject(request.body);
    await admin.registerGameplayJob({
      key: requireString(body.key, "key"),
      pluginId: requireString(body.pluginId, "pluginId"),
      label: requireString(body.label, "label"),
      grades: requireStringArray(body.grades, "grades")
    });
    return ok({ ok: true });
  }

  if (request.method === "POST" && pathOnly === "/gameplay/vehicles") {
    const body = requireObject(request.body);
    await admin.registerGameplayVehicle({
      model: requireString(body.model, "model"),
      pluginId: requireString(body.pluginId, "pluginId"),
      label: requireString(body.label, "label"),
      category: requireString(body.category, "category")
    });
    return ok({ ok: true });
  }

  if (request.method === "POST" && pathOnly === "/gameplay/locations") {
    const body = requireObject(request.body);
    await admin.registerGameplayLocation({
      key: requireString(body.key, "key"),
      pluginId: requireString(body.pluginId, "pluginId"),
      label: requireString(body.label, "label"),
      x: requireNumber(body.x, "x"),
      y: requireNumber(body.y, "y"),
      z: requireNumber(body.z, "z")
    });
    return ok({ ok: true });
  }

  if (request.method === "POST" && pathOnly === "/gameplay/characters") {
    const body = requireObject(request.body);
    await admin.upsertGameplayCharacter({
      id: requireString(body.id, "id"),
      playerPrincipalId: requireString(body.playerPrincipalId, "playerPrincipalId"),
      citizenId: requireString(body.citizenId, "citizenId"),
      cid: requireNumber(body.cid, "cid"),
      slot: requireNumber(body.slot, "slot"),
      license: requireString(body.license, "license"),
      name: requireString(body.name, "name"),
      charinfoJson: requireString(body.charinfoJson, "charinfoJson"),
      metadataJson: requireString(body.metadataJson, "metadataJson"),
      gangJson: optionalString(body.gangJson) ?? "{}",
      positionJson: requireString(body.positionJson, "positionJson"),
      phoneNumber: requireString(body.phoneNumber, "phoneNumber"),
      accountNumber: requireString(body.accountNumber, "accountNumber"),
      selected: requireBoolean(body.selected, "selected")
    });
    return ok({ ok: true });
  }

  if (request.method === "POST" && parts[0] === "gameplay" && parts[1] === "characters" && parts[3] === "select") {
    await admin.selectGameplayCharacter(decodeURIComponent(parts[2] as string));
    return ok({ ok: true });
  }

  if (request.method === "POST" && pathOnly === "/gameplay/inventory/grants") {
    const body = requireObject(request.body);
    await admin.grantGameplayItem({
      id: requireString(body.id, "id"),
      ownerId: requireString(body.ownerId, "ownerId"),
      itemKey: requireString(body.itemKey, "itemKey"),
      quantity: requireNumber(body.quantity, "quantity")
    });
    return ok({ ok: true });
  }

  if (request.method === "POST" && pathOnly === "/gameplay/vehicle-spawns") {
    const body = requireObject(request.body);
    return ok({
      queued: admin.queueVehicleSpawns(requireVehicleSpawnDispatches(body.spawns)).length
    });
  }

  if (request.method === "POST" && pathOnly === "/gameplay/vehicle-spawns/drain") {
    return ok(admin.drainVehicleSpawns({
      serverId: optionalQueryString(query.get("serverId"))
    }));
  }

  if (request.method === "POST" && pathOnly === "/gameplay/vehicle-repairs") {
    const body = requireObject(request.body);
    return ok({
      queued: admin.queueVehicleRepairs(requireVehicleRepairDispatches(body.repairs)).length
    });
  }

  if (request.method === "POST" && pathOnly === "/gameplay/vehicle-repairs/drain") {
    return ok(admin.drainVehicleRepairs({
      serverId: optionalQueryString(query.get("serverId"))
    }));
  }

  if (request.method === "POST" && pathOnly === "/gameplay/teleports") {
    const body = requireObject(request.body);
    return ok({
      queued: admin.queueTeleports(requireTeleportDispatches(body.teleports)).length
    });
  }

  if (request.method === "POST" && pathOnly === "/gameplay/teleports/drain") {
    return ok(admin.drainTeleports({
      serverId: optionalQueryString(query.get("serverId"))
    }));
  }

  if (request.method === "POST" && pathOnly === "/gameplay/kicks") {
    const body = requireObject(request.body);
    return ok({
      queued: admin.queueKicks(requireKickDispatches(body.kicks)).length
    });
  }

  if (request.method === "POST" && pathOnly === "/gameplay/kicks/drain") {
    return ok(admin.drainKicks({
      serverId: optionalQueryString(query.get("serverId"))
    }));
  }

  if (request.method === "POST" && pathOnly === "/gameplay/jobs/assignments") {
    const body = requireObject(request.body);
    await admin.assignGameplayJob({
      characterId: requireString(body.characterId, "characterId"),
      jobKey: requireString(body.jobKey, "jobKey"),
      grade: requireString(body.grade, "grade"),
      onDuty: requireBoolean(body.onDuty, "onDuty")
    });
    return ok({ ok: true });
  }

  if (request.method === "GET" && pathOnly === "/deployments") {
    return ok(admin.getDeploymentSnapshot());
  }

  if (request.method === "GET" && parts[0] === "plugins" && parts[2] === "capabilities") {
    return ok(admin.getPluginCapability(
      parts[1] as string,
      requireString(parts[3], "capabilityKey"),
      optionalQueryString(query.get("serverId"))
    ));
  }

  if (request.method === "POST" && pathOnly === "/deployments/request") {
    const body = requireObject(request.body);
    const response = ok(admin.requestPluginDeployment({
      pluginId: requireString(body.pluginId, "pluginId"),
      bundleId: requireString(body.bundleId, "bundleId"),
      serverId: requireString(body.serverId, "serverId"),
      bundleBytes: requireString(body.bundleBytes, "bundleBytes"),
      requestedBy: requireString(body.requestedBy, "requestedBy")
    }));
    await admin.flushWrites();
    return response;
  }

  if (request.method === "POST" && pathOnly === "/deployments/request-from-artifact") {
    const body = requireObject(request.body);
    const response = ok(await admin.requestPluginDeploymentFromArtifact({
      pluginId: requireString(body.pluginId, "pluginId"),
      bundleId: requireString(body.bundleId, "bundleId"),
      serverId: requireString(body.serverId, "serverId"),
      requestedBy: requireString(body.requestedBy, "requestedBy")
    }));
    await admin.flushWrites();
    return response;
  }

  if (request.method === "POST" && parts[0] === "deployments" && parts[2] === "approve") {
    const body = requireObject(request.body);
    const response = ok(admin.approvePluginDeployment(
      parts[1] as string,
      requireString(body.approvedBy, "approvedBy")
    ));
    await admin.flushWrites();
    return response;
  }

  if (request.method === "POST" && parts[0] === "deployments" && parts[2] === "fail") {
    const body = requireObject(request.body);
    const response = ok(admin.failPluginDeployment(
      parts[1] as string,
      requireString(body.actorId, "actorId"),
      requireString(body.reason, "reason")
    ));
    await admin.flushWrites();
    return response;
  }

  if (request.method === "POST" && parts[0] === "signers" && parts[2] === "revoke") {
    const body = requireObject(request.body);
    const response = ok(admin.revokePluginSigner(
      parts[1] as string,
      requireString(body.actorId, "actorId"),
      requireString(body.reason, "reason"),
      requireString(body.serverId, "serverId")
    ));
    await admin.flushWrites();
    return response;
  }

  if (request.method === "POST" && parts[0] === "bundles" && parts[2] === "revoke") {
    const body = requireObject(request.body);
    const response = ok(admin.revokePluginBundle(
      parts[1] as string,
      requireString(body.actorId, "actorId"),
      requireString(body.reason, "reason"),
      requireString(body.serverId, "serverId")
    ));
    await admin.flushWrites();
    return response;
  }

  if (request.method === "POST" && parts[0] === "plugins" && parts[2] === "rollback") {
    const body = requireObject(request.body);
    const response = ok(admin.rollbackPluginDeployment(
      parts[1] as string,
      requireString(body.serverId, "serverId")
    ));
    await admin.flushWrites();
    return response;
  }

  if (request.method === "POST" && parts[0] === "plugins" && parts[2] === "kill") {
    const body = requireObject(request.body);
    const response = ok(admin.killPlugin(
      parts[1] as string,
      requireString(body.actorId, "actorId"),
      requireString(body.reason, "reason")
    ));
    await admin.flushWrites();
    return response;
  }

  return {
    status: 404,
    body: { error: "Not found" }
  };
}

function ok(body: unknown): AdminHttpResponse {
  return { status: 200, body };
}

function requireObject(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected JSON object body");
  }

  return value as Record<string, unknown>;
}

function optionalObject(value: unknown): Record<string, unknown> {
  if (value === undefined || value === null) {
    return {};
  }

  return requireObject(value);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${field} must be a non-empty string`);
  }

  return value;
}

function optionalTypedString(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error("optional string field must be a string");
  }

  return value;
}

function optionalQueryString(value: string | null): string | undefined {
  if (value === null || value === "") {
    return undefined;
  }

  return value;
}

function optionalQueryOrBodyString(query: URLSearchParams, body: Record<string, unknown>, key: string): string | undefined {
  return optionalQueryString(query.get(key)) ?? optionalTypedString(body[key]);
}

function optionalQueryOrBodyNumber(query: URLSearchParams, body: Record<string, unknown>, key: string): number | undefined {
  const queryValue = optionalQueryString(query.get(key));
  if (queryValue !== undefined) {
    const parsed = Number(queryValue);
    if (!Number.isFinite(parsed)) {
      throw new Error(`${key} must be a finite number`);
    }
    return parsed;
  }
  if (body[key] === undefined || body[key] === null || body[key] === "") {
    return undefined;
  }
  return requireNumber(body[key], key);
}

function optionalQueryOrBodyDate(query: URLSearchParams, body: Record<string, unknown>, key: string): Date | undefined {
  const queryValue = optionalQueryString(query.get(key));
  if (queryValue !== undefined) {
    return optionalDate(queryValue, key);
  }
  return optionalDate(body[key], key);
}

function optionalString(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value !== "string") {
    throw new Error("optional string field must be a string");
  }

  return value;
}

function requireNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${field} must be a finite number`);
  }

  return value;
}

function requireBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${field} must be a boolean`);
  }

  return value;
}

function optionalDate(value: unknown, field: string): Date | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error(`${field} must be a valid date`);
    }
    return value;
  }
  if (typeof value !== "string") {
    throw new Error(`${field} must be an ISO date string`);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${field} must be a valid date`);
  }
  return parsed;
}

function requireStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.length === 0)) {
    throw new Error(`${field} must be an array of non-empty strings`);
  }

  return value;
}

function optionalPositiveNumber(value: unknown, field: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const number = requireNumber(value, field);
  if (number <= 0) {
    throw new Error(`${field} must be positive`);
  }
  return number;
}

function requireDiscordRoleMappings(value: unknown): Array<{
  discordRoleId: string;
  targetPrincipalId: string;
}> {
  if (!Array.isArray(value)) {
    throw new Error("roleMappings must be an array");
  }

  return value.map((mapping) => {
    const candidate = requireObject(mapping);
    return {
      discordRoleId: requireString(candidate.discordRoleId, "discordRoleId"),
      targetPrincipalId: requireString(candidate.targetPrincipalId, "targetPrincipalId")
    };
  });
}

function requireDiscordMembers(value: unknown): Array<{
  userId: string;
  displayName: string;
  roleIds: string[];
}> {
  if (!Array.isArray(value)) {
    throw new Error("members must be an array");
  }

  return value.map((member) => {
    const candidate = requireObject(member);
    return {
      userId: requireString(candidate.userId, "userId"),
      displayName: requireString(candidate.displayName, "displayName"),
      roleIds: requireStringArray(candidate.roleIds, "roleIds")
    };
  });
}

function requireQbCoreRuntimeCharacterUpdates(value: unknown): Array<{
  characterId: string;
  playerPrincipalId: string;
  citizenId: string;
  cid: number;
  slot: number;
  license: string;
  name: string;
  charinfoJson: string;
  metadataJson: string;
  positionJson: string;
  phoneNumber: string;
  accountNumber: string;
  selected: boolean;
}> {
  if (!Array.isArray(value)) {
    throw new Error("updates must be an array");
  }

  return value.map((entry) => {
    const update = requireObject(entry);
    return {
      characterId: requireString(update.characterId, "characterId"),
      playerPrincipalId: requireString(update.playerPrincipalId, "playerPrincipalId"),
      citizenId: requireString(update.citizenId, "citizenId"),
      cid: requireNumber(update.cid, "cid"),
      slot: requireNumber(update.slot, "slot"),
      license: requireString(update.license, "license"),
      name: requireString(update.name, "name"),
      charinfoJson: requireString(update.charinfoJson, "charinfoJson"),
      metadataJson: requireString(update.metadataJson, "metadataJson"),
      gangJson: optionalString(update.gangJson) ?? "{}",
      positionJson: requireString(update.positionJson, "positionJson"),
      phoneNumber: requireString(update.phoneNumber, "phoneNumber"),
      accountNumber: requireString(update.accountNumber, "accountNumber"),
      selected: requireBoolean(update.selected, "selected")
    };
  });
}

function requireQbCoreRuntimeCharacterSelections(value: unknown): Array<{
  characterId: string;
}> {
  if (!Array.isArray(value)) {
    throw new Error("selections must be an array");
  }

  return value.map((entry) => {
    const selection = requireObject(entry);
    return {
      characterId: requireString(selection.characterId, "characterId")
    };
  });
}

function requireQbCoreRuntimeMoneyUpdates(value: unknown): Array<{
  transactionId: string;
  actorId: string;
  characterId: string;
  moneyType: string;
  operation: "add" | "remove" | "set";
  amount: number;
  reason: string;
  idempotencyKey: string;
}> {
  if (!Array.isArray(value)) {
    throw new Error("updates must be an array");
  }

  return value.map((entry) => {
    const update = requireObject(entry);
    return {
      transactionId: requireString(update.transactionId, "transactionId"),
      actorId: requireString(update.actorId, "actorId"),
      characterId: requireString(update.characterId, "characterId"),
      moneyType: requireString(update.moneyType, "moneyType"),
      operation: requireQbCoreMoneyOperation(update.operation),
      amount: requireNumber(update.amount, "amount"),
      reason: requireString(update.reason, "reason"),
      idempotencyKey: requireString(update.idempotencyKey, "idempotencyKey")
    };
  });
}

function requireQbCoreMoneyOperation(value: unknown): "add" | "remove" | "set" {
  if (value === "add" || value === "remove" || value === "set") {
    return value;
  }

  throw new Error("operation must be add, remove, or set");
}

function requireQbCoreRuntimeInventoryUpdates(value: unknown): Array<{
  id: string;
  characterId: string;
  itemKey: string;
  operation: "add" | "remove";
  amount: number;
}> {
  if (!Array.isArray(value)) {
    throw new Error("updates must be an array");
  }

  return value.map((entry) => {
    const update = requireObject(entry);
    return {
      id: requireString(update.id, "id"),
      characterId: requireString(update.characterId, "characterId"),
      itemKey: requireString(update.itemKey, "itemKey"),
      operation: requireQbCoreInventoryOperation(update.operation),
      amount: requireNumber(update.amount, "amount")
    };
  });
}

function requireQbCoreInventoryOperation(value: unknown): "add" | "remove" {
  if (value === "add" || value === "remove") {
    return value;
  }

  throw new Error("operation must be add or remove");
}

function requireReplicatedStateUpdates(value: unknown): Array<{
  serverId: string;
  key: string;
  value: unknown;
  playerId?: string | number;
  authoritative?: boolean;
}> {
  if (!Array.isArray(value)) {
    throw new Error("updates must be an array");
  }

  return value.map((update) => {
    const candidate = requireObject(update);
    const parsed: {
      serverId: string;
      key: string;
      value: unknown;
      playerId?: string | number;
      authoritative?: boolean;
    } = {
      serverId: requireString(candidate.serverId, "serverId"),
      key: requireString(candidate.key, "key"),
      value: candidate.value
    };
    if (candidate.playerId !== undefined) {
      if (
        (typeof candidate.playerId !== "string" || candidate.playerId.length === 0) &&
        (typeof candidate.playerId !== "number" || !Number.isFinite(candidate.playerId))
      ) {
        throw new Error("playerId must be a non-empty string or finite number");
      }
      parsed.playerId = candidate.playerId;
    }
    if (candidate.authoritative !== undefined) {
      parsed.authoritative = requireBoolean(candidate.authoritative, "authoritative");
    }
    return parsed;
  });
}

function requireVehicleSpawnDispatches(value: unknown): Array<{
  serverId: string;
  targetSource: string | number;
  model: string;
  label: string;
  category: string;
  location?: {
    key: string;
    label: string;
    x: number;
    y: number;
    z: number;
  };
  heading?: number;
  warpIntoVehicle?: boolean;
}> {
  if (!Array.isArray(value)) {
    throw new Error("spawns must be an array");
  }

  return value.map((spawn) => {
    const candidate = requireObject(spawn);
    const targetSource = candidate.targetSource;
    if (
      (typeof targetSource !== "string" || targetSource.length === 0) &&
      (typeof targetSource !== "number" || !Number.isFinite(targetSource))
    ) {
      throw new Error("targetSource must be a non-empty string or finite number");
    }

    const parsed: ReturnType<typeof requireVehicleSpawnDispatches>[number] = {
      serverId: requireString(candidate.serverId, "serverId"),
      targetSource,
      model: requireString(candidate.model, "model"),
      label: requireString(candidate.label, "label"),
      category: requireString(candidate.category, "category")
    };
    if (candidate.location !== undefined) {
      const location = requireObject(candidate.location);
      parsed.location = {
        key: requireString(location.key, "location.key"),
        label: requireString(location.label, "location.label"),
        x: requireNumber(location.x, "location.x"),
        y: requireNumber(location.y, "location.y"),
        z: requireNumber(location.z, "location.z")
      };
    }
    if (candidate.heading !== undefined) {
      parsed.heading = requireNumber(candidate.heading, "heading");
    }
    if (candidate.warpIntoVehicle !== undefined) {
      parsed.warpIntoVehicle = requireBoolean(candidate.warpIntoVehicle, "warpIntoVehicle");
    }
    return parsed;
  });
}

function requireVehicleRepairDispatches(value: unknown): Array<{
  serverId: string;
  targetSource: string | number;
  targetVehicleNetId: number;
}> {
  if (!Array.isArray(value)) {
    throw new Error("repairs must be an array");
  }

  return value.map((repair) => {
    const candidate = requireObject(repair);
    const targetSource = candidate.targetSource;
    if (
      (typeof targetSource !== "string" || targetSource.length === 0) &&
      (typeof targetSource !== "number" || !Number.isFinite(targetSource))
    ) {
      throw new Error("targetSource must be a non-empty string or finite number");
    }

    return {
      serverId: requireString(candidate.serverId, "serverId"),
      targetSource,
      targetVehicleNetId: requireNumber(candidate.targetVehicleNetId, "targetVehicleNetId")
    };
  });
}

function requireWorldStateUpdates(value: unknown): Array<{
  serverId: string;
  world: {
    weatherType?: string;
    hour?: number;
    minute?: number;
  };
}> {
  if (!Array.isArray(value)) {
    throw new Error("updates must be an array");
  }

  return value.map((update) => {
    const candidate = requireObject(update);
    const world = requireObject(candidate.world);
    const parsedWorld: {
      weatherType?: string;
      hour?: number;
      minute?: number;
    } = {};
    if (world.weatherType !== undefined) {
      parsedWorld.weatherType = requireString(world.weatherType, "weatherType");
    }
    if (world.hour !== undefined) {
      parsedWorld.hour = requireNumber(world.hour, "hour");
    }
    if (world.minute !== undefined) {
      parsedWorld.minute = requireNumber(world.minute, "minute");
    }

    return {
      serverId: requireString(candidate.serverId, "serverId"),
      world: parsedWorld
    };
  });
}

function requireTeleportDispatches(value: unknown): Array<{
  serverId: string;
  targetSource: string | number;
  x: number;
  y: number;
  z: number;
  heading?: number;
}> {
  if (!Array.isArray(value)) {
    throw new Error("teleports must be an array");
  }

  return value.map((teleport) => {
    const candidate = requireObject(teleport);
    const targetSource = candidate.targetSource;
    if (
      (typeof targetSource !== "string" || targetSource.length === 0) &&
      (typeof targetSource !== "number" || !Number.isFinite(targetSource))
    ) {
      throw new Error("targetSource must be a non-empty string or finite number");
    }

    const parsed: ReturnType<typeof requireTeleportDispatches>[number] = {
      serverId: requireString(candidate.serverId, "serverId"),
      targetSource,
      x: requireNumber(candidate.x, "x"),
      y: requireNumber(candidate.y, "y"),
      z: requireNumber(candidate.z, "z")
    };
    if (candidate.heading !== undefined) {
      parsed.heading = requireNumber(candidate.heading, "heading");
    }
    return parsed;
  });
}

function requireKickDispatches(value: unknown): Array<{
  serverId: string;
  targetSource: string | number;
  reason: string;
}> {
  if (!Array.isArray(value)) {
    throw new Error("kicks must be an array");
  }

  return value.map((kick) => {
    const candidate = requireObject(kick);
    const targetSource = candidate.targetSource;
    if (
      (typeof targetSource !== "string" || targetSource.length === 0) &&
      (typeof targetSource !== "number" || !Number.isFinite(targetSource))
    ) {
      throw new Error("targetSource must be a non-empty string or finite number");
    }

    return {
      serverId: requireString(candidate.serverId, "serverId"),
      targetSource,
      reason: requireString(candidate.reason, "reason")
    };
  });
}
