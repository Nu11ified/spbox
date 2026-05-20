import { describe, expect, it } from "vitest";
import { FakeSpacetimeClient, SpacetimeRuntimeAdapter } from "../src/spacetime/adapter.js";

describe("expanded SpacetimeRuntimeAdapter subscriptions", () => {
  it("subscribes to economy, gameplay, and hook tables used by runtime primitives", async () => {
    const client = new FakeSpacetimeClient({});
    const adapter = new SpacetimeRuntimeAdapter(client);

    await adapter.connectAndSubscribe("server-1");

    expect(client.subscribedTables).toEqual([
      "servers",
      "runtime_instances",
      "audit_logs",
      "runtime_config",
      "runtime_config_acks",
      "menu_definitions",
      "menu_actions",
      "runtime_commands",
      "runtime_panels",
      "menu_visibility_policies",
      "menu_sessions",
      "principals",
      "principal_edges",
      "permission_grants",
      "permissions",
      "permission_cache_versions",
      "ace_mirror_rules",
      "policy_constraints",
      "plugins",
      "plugin_packages",
      "plugin_package_signer_revocations",
      "plugin_bundles",
      "plugin_capabilities",
      "plugin_deployments",
      "plugin_manifests",
      "plugin_runtime_instances",
      "plugin_config_values",
      "plugin_schemas",
      "plugin_entities",
      "plugin_sandbox_events",
      "accounts",
      "transactions",
      "ledger_entries",
      "invoices",
      "economy_limits",
      "items",
      "jobs",
      "vehicles",
      "locations",
      "characters",
      "inventory_stacks",
      "character_jobs",
      "plugin_hooks"
    ]);
  });
});
