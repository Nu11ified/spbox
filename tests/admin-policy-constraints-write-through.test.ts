import { describe, expect, it } from "vitest";
import { createAdminHttpApi } from "../src/admin/http-api.js";
import { AdminService } from "../src/admin/service.js";
import { PermissionStore } from "../src/core/permission-store.js";
import { PluginRegistry } from "../src/core/plugins.js";
import { RuntimeControlPlane } from "../src/core/runtime.js";
import { FakeSpacetimeClient, SpacetimeRuntimeAdapter } from "../src/spacetime/adapter.js";

function createAdmin(client = new FakeSpacetimeClient({})): { admin: AdminService; client: FakeSpacetimeClient } {
  return {
    client,
    admin: new AdminService({
      runtime: new RuntimeControlPlane(),
      permissions: new PermissionStore(),
      plugins: new PluginRegistry(),
      spacetime: new SpacetimeRuntimeAdapter(client)
    })
  };
}

describe("admin policy constraint write-through", () => {
  it("stores policy constraints locally and mirrors them to SpacetimeDB", async () => {
    const { admin, client } = createAdmin();

    admin.upsertPolicyConstraint({
      id: "staff-give-limit",
      permissionKey: "economy.admin.give_money",
      constraintType: "max_amount",
      constraint: { amount: 10_000, currency: "cash" },
      priority: 10,
      enabled: true
    });
    await admin.flushWrites();

    expect(admin.getPermissionEngine().hasPermission("group.staff", "economy.admin.give_money").allowed).toBe(false);
    expect(client.reducerCalls).toEqual([
      {
        name: "upsert_policy_constraint",
        args: {
          id: "staff-give-limit",
          permissionKey: "economy.admin.give_money",
          constraintType: "max_amount",
          constraintJson: "{\"amount\":10000,\"currency\":\"cash\"}",
          priority: 10,
          enabled: true
        }
      }
    ]);
  });

  it("exposes policy constraint HTTP routes", async () => {
    const { admin, client } = createAdmin();
    const api = createAdminHttpApi(admin);

    const upsert = await api.handle({
      method: "POST",
      path: "/permissions/policies",
      body: {
        id: "mechanic-duty",
        permissionKey: "vehicle.repair",
        constraintType: "requires_state",
        constraint: { key: "job:on_duty", equals: true },
        priority: 10,
        enabled: true
      }
    });
    const remove = await api.handle({
      method: "DELETE",
      path: "/permissions/policies/mechanic-duty"
    });

    expect(upsert).toEqual({ status: 200, body: { ok: true } });
    expect(remove).toEqual({ status: 200, body: { ok: true } });
    expect(client.reducerCalls).toEqual([
      {
        name: "upsert_policy_constraint",
        args: {
          id: "mechanic-duty",
          permissionKey: "vehicle.repair",
          constraintType: "requires_state",
          constraintJson: "{\"key\":\"job:on_duty\",\"equals\":true}",
          priority: 10,
          enabled: true
        }
      },
      {
        name: "remove_policy_constraint",
        args: { policyId: "mechanic-duty" }
      }
    ]);
  });
});
