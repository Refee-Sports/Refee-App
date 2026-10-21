import { beforeEach, describe, expect, it, vi } from "vitest";
import { configureSupabase } from "@refee/core/client";

const calls = vi.hoisted(() => ({
  rpc: [] as { fn: string; args: Record<string, unknown> }[],
  invoke: [] as { fn: string; body: unknown }[],
  rpcResult: { data: null as unknown, error: null as { message: string } | null },
  invokeResult: { data: null as unknown, error: null as unknown },
}));

configureSupabase({
  rpc: async (fn: string, args: Record<string, unknown>) => {
    calls.rpc.push({ fn, args });
    return calls.rpcResult;
  },
  functions: {
    invoke: async (fn: string, opts: { body: unknown }) => {
      calls.invoke.push({ fn, body: opts.body });
      return calls.invokeResult;
    },
  },
} as never);

import {
  adminAccountAction,
  fetchUserFinances,
  listAccounts,
  profileChanges,
  updateProfile,
  verificationBreakdown,
  viewAsUrl,
  type AccountDetail,
} from "@refee/core/admin/queries";

const ID = "22222222-2222-4222-8222-222222222201";

beforeEach(() => {
  calls.rpc = [];
  calls.invoke = [];
  calls.rpcResult = { data: null, error: null };
  calls.invokeResult = { data: null, error: null };
});

describe("listAccounts", () => {
  it("lists everyone a page at a time when there's no search", async () => {
    calls.rpcResult = {
      data: [
        { user_id: "a", total_count: 312 },
        { user_id: "b", total_count: 312 },
      ],
      error: null,
    };
    const res = await listAccounts({ offset: 50 });
    expect(calls.rpc[0]).toEqual({
      fn: "admin_list_accounts",
      args: { p_query: null, p_role: null, p_limit: 50, p_offset: 50 },
    });
    expect(res.rows.map((r) => r.user_id)).toEqual(["a", "b"]);
    expect(res.total).toBe(312);
  });

  it("passes a trimmed search and a role through", async () => {
    calls.rpcResult = { data: [], error: null };
    const res = await listAccounts({ query: "  marcus ", role: "director" });
    expect(calls.rpc[0].args).toMatchObject({ p_query: "marcus", p_role: "director" });
    expect(res.total).toBe(0);
  });

  it("says why when it can't load", async () => {
    calls.rpcResult = { data: null, error: { message: "Staff access required." } };
    expect((await listAccounts({})).error?.message).toBe("Staff access required.");
  });
});

describe("profileChanges", () => {
  const before = {
    first_name: "Marcus",
    legal_first_name: "Marcus",
    legal_last_name: "Johnson",
    date_of_birth: "1990-01-02",
    phone: "+15125550101",
    city: "Houston",
    state: "TX",
    home_zip: null,
    organizations: [],
  } as unknown as AccountDetail;

  it("sends only what staff actually changed", () => {
    expect(profileChanges(before, { ...before, city: " Dallas " } as never)).toEqual({ city: "Dallas" });
  });

  it("treats a cleared ZIP as removing it and upper-cases a state", () => {
    const withZip = { ...before, home_zip: "77002" } as AccountDetail;
    expect(profileChanges(withZip, { home_zip: "  ", state: "ca" })).toEqual({ home_zip: null, state: "CA" });
  });

  it("sends nothing when nothing changed", () => {
    expect(profileChanges(before, { city: "Houston", state: "tx" })).toEqual({});
  });
});

describe("updateProfile", () => {
  it("saves the changes with the reason, and returns what changed", async () => {
    calls.rpcResult = { data: { city: { from: "Houston", to: "Dallas" } }, error: null };
    const res = await updateProfile(ID, { city: "Dallas" }, "Moved");
    expect(calls.rpc[0]).toEqual({
      fn: "admin_update_profile",
      args: { p_user: ID, p_changes: { city: "Dallas" }, p_reason: "Moved" },
    });
    expect(res.changed).toEqual({ city: { from: "Houston", to: "Dallas" } });
  });
});

describe("fetchUserFinances", () => {
  it("asks for one account's money", async () => {
    calls.rpcResult = { data: { referee: { paid_total: 70 } }, error: null };
    const res = await fetchUserFinances(ID);
    expect(calls.rpc[0]).toEqual({ fn: "admin_user_finances", args: { p_user: ID } });
    expect(res.finances?.referee?.paid_total).toBe(70);
  });
});

describe("adminAccountAction", () => {
  it("asks the backend to sign in as someone, with a reason", async () => {
    calls.invokeResult = { data: { tokenHash: "abc", email: "m@x.co" }, error: null };
    const res = await adminAccountAction("view_as", ID, "Can't see games");
    expect(calls.invoke[0]).toEqual({
      fn: "admin-account",
      body: { action: "view_as", userId: ID, reason: "Can't see games" },
    });
    expect(res.tokenHash).toBe("abc");
  });

  it("surfaces the backend's own reason for refusing", async () => {
    calls.invokeResult = {
      data: null,
      error: { message: "non-2xx", context: { json: async () => ({ error: "That's a staff account." }) } },
    };
    expect((await adminAccountAction("deactivate", ID, "x")).error?.message).toBe("That's a staff account.");
  });
});

describe("viewAsUrl", () => {
  it("keeps the token in the fragment so it never reaches a server log", () => {
    expect(viewAsUrl("https://refee.app/", "a b")).toBe("https://refee.app/auth/view-as#token_hash=a%20b");
  });
});

describe("verificationBreakdown", () => {
  it("orders statuses from verified to not started and gives each a share", () => {
    const parts = verificationBreakdown({ unstarted: 3, approved: 1, in_review: 0, declined: 1 });
    expect(parts.map((p) => p.status)).toEqual(["approved", "declined", "unstarted"]);
    expect(parts.map((p) => p.pct)).toEqual([20, 20, 60]);
  });

  it("is empty with nobody in it", () => {
    expect(verificationBreakdown({})).toEqual([]);
  });
});
