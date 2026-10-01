import { beforeEach, describe, expect, it, vi } from "vitest";

// A tiny stand-in for supabase-js: each table answers with what the test set,
// and every write is recorded.
const db = vi.hoisted(() => ({
  hirers: [] as { id: string; user_id: string }[],
  profile: { first_name: "Jordan", last_initial: "H", city: "Austin", state: "TX" } as Record<string, string> | null,
  roles: ["referee"] as string[],
  writes: [] as { table: string; op: string; row: Record<string, unknown> }[],
  failInsert: null as string | null,
}));

vi.mock("@/lib/supabase", () => {
  const from = (table: string) => {
    const filters: Record<string, unknown> = {};
    const q = {
      select: () => q,
      eq: (col: string, val: unknown) => ((filters[col] = val), q),
      limit: () => q,
      maybeSingle: async () => {
        if (table === "hirers") return { data: db.hirers.find((h) => h.user_id === filters.user_id) ?? null, error: null };
        if (table === "public_profiles") return { data: db.profile, error: null };
        return { data: null, error: null };
      },
      single: async () => ({ data: { id: "new-hirer" }, error: null }),
      then: (resolve: (v: unknown) => void) => {
        // fetchRoles awaits the builder directly
        resolve({ data: table === "user_roles" ? db.roles.map((role) => ({ role })) : [], error: null });
      },
      insert: (row: Record<string, unknown>) => {
        db.writes.push({ table, op: "insert", row });
        if (db.failInsert) {
          return { select: () => ({ single: async () => ({ data: null, error: { message: db.failInsert } }) }) };
        }
        return { select: () => ({ single: async () => ({ data: { id: "new-hirer" }, error: null }) }) };
      },
      upsert: async (row: Record<string, unknown>) => {
        db.writes.push({ table, op: "upsert", row });
        if (table === "user_roles") db.roles.push(row.role as string);
        return { error: null };
      },
      update: (row: Record<string, unknown>) => {
        db.writes.push({ table, op: "update", row });
        return { eq: async () => ({ error: null }) };
      },
    };
    return q;
  };
  return { supabase: { from } };
});

import { addDirectorRole } from "./queries";

const ME = "11111111-1111-4111-8111-111111111100";

beforeEach(() => {
  db.hirers = [];
  db.profile = { first_name: "Jordan", last_initial: "H", city: "Austin", state: "TX" };
  db.roles = ["referee"];
  db.writes = [];
  db.failInsert = null;
});

describe("addDirectorRole", () => {
  it("creates the organization a director needs, from the profile they already have", async () => {
    const { error } = await addDirectorRole(ME, { orgName: "Austin Hoops Classic", orgType: "tournament" });
    expect(error).toBeNull();
    expect(db.writes.find((w) => w.table === "hirers")?.row).toEqual({
      user_id: ME,
      org_name: "Austin Hoops Classic",
      org_type: "tournament",
      city: "Austin",
      state: "TX",
      contact_first_name: "Jordan",
      contact_last_initial: "H",
    });
  });

  it("adds the director role and lands them in it", async () => {
    await addDirectorRole(ME, { orgName: "Austin Hoops Classic", orgType: "tournament" });
    expect(db.writes).toContainEqual({ table: "user_roles", op: "upsert", row: { user_id: ME, role: "director" } });
    expect(db.writes).toContainEqual({ table: "public_profiles", op: "update", row: { primary_role: "director" } });
  });

  it("reuses an organization they already have instead of making a second one", async () => {
    db.hirers = [{ id: "existing", user_id: ME }];
    const { error } = await addDirectorRole(ME, { orgName: "Austin Hoops Classic", orgType: "tournament" });
    expect(error).toBeNull();
    expect(db.writes.filter((w) => w.table === "hirers")).toHaveLength(0);
  });

  it("needs no organization details when one already exists", async () => {
    db.hirers = [{ id: "existing", user_id: ME }];
    const { error } = await addDirectorRole(ME);
    expect(error).toBeNull();
    expect(db.writes).toContainEqual({ table: "user_roles", op: "upsert", row: { user_id: ME, role: "director" } });
  });

  it("asks for the organization when there isn't one", async () => {
    expect((await addDirectorRole(ME)).error?.message).toMatch(/organization name/i);
    expect(db.writes).toHaveLength(0);
  });

  it("requires an organization name and type", async () => {
    expect((await addDirectorRole(ME, { orgName: "  ", orgType: "tournament" })).error?.message).toMatch(/organization name/i);
    expect((await addDirectorRole(ME, { orgName: "X", orgType: "" })).error?.message).toMatch(/type/i);
    expect(db.writes).toHaveLength(0);
  });

  it("doesn't add the role if the organization couldn't be saved", async () => {
    db.failInsert = "permission denied";
    const { error } = await addDirectorRole(ME, { orgName: "Austin Hoops Classic", orgType: "tournament" });
    expect(error?.message).toBe("permission denied");
    expect(db.writes.some((w) => w.table === "user_roles")).toBe(false);
  });
});
