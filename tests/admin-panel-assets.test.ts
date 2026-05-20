import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("admin panel assets", () => {
  it("declares a dashboard-first admin UI with operational sections", () => {
    const html = readFileSync("admin-panel/index.html", "utf8");

    expect(html).toContain('<main class="shell">');
    expect(html).toContain('data-view="dashboard"');
    expect(html).toContain('id="health-output"');
    expect(html).toContain('data-view="permissions"');
    expect(html).toContain('data-view="menus"');
    expect(html).toContain('data-view="plugins"');
    expect(html).toContain('data-view="deployments"');
    expect(html).toContain('data-view="economy"');
    expect(html).toContain('data-view="gameplay"');
    expect(html).toContain('data-view="audit"');
    expect(html).toContain('id="economy-account-form"');
    expect(html).toContain('id="economy-account-search-form"');
    expect(html).toContain('id="economy-transaction-search-form"');
    expect(html).toContain('id="economy-ledger-form"');
    expect(html).toContain('id="economy-suspicious-form"');
    expect(html).toContain('id="economy-statement-form"');
    expect(html).toContain('id="economy-limit-form"');
    expect(html).toContain('id="refresh-economy-limits"');
    expect(html).toContain('id="economy-read-output"');
    expect(html).toContain('id="economy-adjustment-form"');
    expect(html).toContain('id="economy-salary-form"');
    expect(html).toContain('id="economy-fine-form"');
    expect(html).toContain('id="economy-tax-form"');
    expect(html).toContain('id="economy-business-payout-form"');
    expect(html).toContain('id="economy-invoice-form"');
    expect(html).toContain('id="economy-invoice-payment-form"');
    expect(html).toContain('id="economy-item-purchase-form"');
    expect(html).toContain('id="economy-item-sale-form"');
    expect(html).toContain('id="economy-void-form"');
    expect(html).toContain('id="menu-definition-form"');
    expect(html).toContain('id="menu-action-form"');
    expect(html).toContain('id="runtime-command-form"');
    expect(html).toContain('id="runtime-panel-form"');
    expect(html).toContain('id="menu-visibility-policy-form"');
    expect(html).toContain('id="menu-session-form"');
    expect(html).toContain('id="refresh-menus"');
    expect(html).toContain('id="menu-output"');
    expect(html).toContain('id="permission-definition-form"');
    expect(html).toContain('id="ace-rule-form"');
    expect(html).toContain('id="policy-form"');
    expect(html).toContain('id="discord-role-sync-form"');
    expect(html).toContain('name="roleMappingsJson"');
    expect(html).toContain('name="membersJson"');
    expect(html).toContain('id="discord-output"');
    expect(html).toContain('id="refresh-permissions"');
    expect(html).toContain('id="permission-output"');
    expect(html).toContain('id="plugin-schema-form"');
    expect(html).toContain('id="plugin-package-form"');
    expect(html).toContain('id="plugin-import-plan-form"');
    expect(html).toContain('id="plugin-import-output"');
    expect(html).toContain('name="signerId"');
    expect(html).toContain('id="plugin-entity-form"');
    expect(html).toContain('id="plugin-data-search-form"');
    expect(html).toContain('id="plugin-data-output"');
    expect(html).toContain('id="plugin-config-form"');
    expect(html).toContain('id="plugin-runtime-form"');
    expect(html).toContain('id="plugin-registry-output"');
    expect(html).toContain('id="refresh-plugin-registry"');
    expect(html).toContain('id="signer-control-form"');
    expect(html).toContain('id="capability-check-form"');
    expect(html).toContain('value="request-artifact"');
    expect(html).toContain('value="fail"');
    expect(html).toContain('id="refresh-deployments"');
    expect(html).toContain('id="deployment-output"');
    expect(html).toContain('id="gameplay-item-form"');
    expect(html).toContain('id="gameplay-job-assignment-form"');
    expect(html).toContain('id="gameplay-vehicle-spawn-form"');
    expect(html).toContain('id="gameplay-vehicle-repair-form"');
    expect(html).toContain('id="gameplay-teleport-form"');
    expect(html).toContain('id="gameplay-kick-form"');
    expect(html).toContain('id="refresh-gameplay"');
    expect(html).toContain('id="gameplay-output"');
    expect(html).toContain('id="audit-search-form"');
    expect(html).toContain('<script src="./app.js" type="module"></script>');
  });

  it("calls the tested admin HTTP routes", () => {
    const app = readFileSync("admin-panel/app.js", "utf8");

    expect(app).toContain("dashboard.health");
    expect(app).toContain("render(healthOutput, dashboard.health)");
    expect(app).toContain("signerId: data.signerId");
    expect(app).toContain("const pkg = plan.package");
    expect(app).toContain("render(pluginImportOutput, result)");

    for (const route of [
      "/servers/${state.serverId}/dashboard",
      "/servers/${state.serverId}/config",
      "/plugins/install",
      "/plugins/install-package",
      "/plugins/${pkg.pluginId}/enable",
      "/plugins/${pluginId}/enable",
      "/plugins/${pluginId}/disable",
      "/plugins/schemas",
      "/plugins/entities",
      "/plugins/data?${params.toString()}",
      "/plugins/config-values",
      "/plugins/runtime-instances",
      "/plugins/registry",
      "/permissions",
      "/permissions/principals",
      "/permissions/definitions",
      "/permissions/ace-rules",
      "/permissions/grants",
      "/permissions/policies",
      "/connectors/discord/role-sync",
      "/menus",
      "/menus/definitions",
      "/menus/actions",
      "/menus/commands",
      "/menus/panels",
      "/menus/policies",
      "/menus/sessions",
      "/menus/sessions/${data.sessionId}/close",
      "/economy/accounts?${params.toString()}",
      "/economy/transactions?${params.toString()}",
      "/economy/transactions/${data.transactionId}/ledger",
      "/economy/suspicious?${params.toString()}",
      "/economy/accounts/${data.accountId}/statement?${params.toString()}",
      "/economy/accounts/${data.accountId}/statement.csv?${params.toString()}",
      "/economy/limits",
      "/economy/accounts",
      "/economy/transfers",
      "/economy/deposits",
      "/economy/withdrawals",
      "/economy/adjustments",
      "/economy/salaries",
      "/economy/fines",
      "/economy/taxes",
      "/economy/business-payouts",
      "/economy/invoices",
      "/economy/invoices/${encodeURIComponent(data.invoiceId)}/pay",
      "/economy/item-purchases",
      "/economy/item-sales",
      "/economy/limits",
      "/economy/voids",
      "/gameplay",
      "/gameplay/items",
      "/gameplay/jobs",
      "/gameplay/vehicles",
      "/gameplay/locations",
      "/gameplay/inventory/grants",
      "/gameplay/jobs/assignments",
      "/gameplay/vehicle-spawns",
      "/gameplay/vehicle-repairs",
      "/gameplay/teleports",
      "/gameplay/kicks",
      "/audit?${params.toString()}",
      "/deployments",
      "/deployments/request",
      "/deployments/request-from-artifact",
      "/deployments/${deploymentId}/approve",
      "/deployments/${deploymentId}/fail",
      "/plugins/${pluginId}/rollback",
      "/plugins/${pluginId}/kill",
      "/plugins/${data.pluginId}/capabilities/${data.capabilityKey}?${params.toString()}",
      "/signers/${data.signerId}/revoke",
      "/package-signers/${data.signerId}/revoke"
    ]) {
      expect(app).toContain(route);
    }
    expect(app).toContain("roleMappings: JSON.parse(data.roleMappingsJson)");
    expect(app).toContain("members: JSON.parse(data.membersJson)");
    expect(app).toContain("reason: data.reason");
  });
});
