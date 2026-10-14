import { beforeEach, describe, expect, it, vi } from "vitest";

/** Records every write; reads come from `rows`. */
const db = vi.hoisted(() => ({
  rows: {} as Record<string, unknown>,
  writes: [] as { table: string; op: string; values: unknown; match: Record<string, unknown> }[],
  failOn: null as string | null,
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from(table: string) {
      const match: Record<string, unknown> = {};
      let op = "select";
      let values: unknown = null;
      const result = () =>
        db.failOn === table && op !== "select"
          ? { data: null, error: { message: `${table} failed` } }
          : { data: op === "select" ? db.rows[table] ?? null : null, error: null };
      const builder: any = {
        select: () => builder,
        eq: (col: string, v: unknown) => {
          match[col] = v;
          return builder;
        },
        update: (v: unknown) => {
          op = "update";
          values = v;
          return builder;
        },
        maybeSingle: () => Promise.resolve(result()),
        then: (res: any, rej: any) => {
          if (op !== "select") db.writes.push({ table, op, values, match: { ...match } });
          return Promise.resolve(result()).then(res, rej);
        },
      };
      return builder;
    },
  },
}));

// City changes move the home pin the referee feed measures from.
vi.mock("@refee/core/geo/geocode", () => ({
  geocodeAddress: vi.fn(async (address: string) => (address.startsWith("Austin") ? { lat: 30.27, lng: -97.74 } : null)),
}));

import {
  fetchMyLegalIdentity,
  isIdentityLocked,
  updateAssignorDetails,
  updateDirectorDetails,
  updateLegalIdentity,
} from "./account";

beforeEach(() => {
  db.rows = {};
  db.writes = [];
  db.failOn = null;
});

describe("legal identity", () => {
  it("is locked from the moment the ID check is under review", () => {
    expect(isIdentityLocked("unstarted")).toBe(false);
    expect(isIdentityLocked("declined")).toBe(false);
    expect(isIdentityLocked("in_review")).toBe(true);
    expect(isIdentityLocked("approved")).toBe(true);
  });

  it("reads the person's own legal name, birthday and lock state", async () => {
    db.rows.private_profiles = {
      legal_first_name: "Sam",
      legal_last_name: "Okafor",
      date_of_birth: "1992-01-02",
      identity_status: "approved",
    };
    const { identity } = await fetchMyLegalIdentity("u1");
    expect(identity).toEqual({
      legalFirstName: "Sam",
      legalLastName: "Okafor",
      dateOfBirth: "1992-01-02",
      locked: true,
    });
  });

  it("saves a corrected name and birthday, trimmed", async () => {
    const { error } = await updateLegalIdentity("u1", {
      legalFirstName: " Samuel ",
      legalLastName: "Okafor",
      dateOfBirth: "1992-01-02",
    });
    expect(error).toBeNull();
    expect(db.writes).toEqual([
      {
        table: "private_profiles",
        op: "update",
        values: { legal_first_name: "Samuel", legal_last_name: "Okafor", date_of_birth: "1992-01-02" },
        match: { id: "u1" },
      },
    ]);
  });

  it("needs both names and a real date", async () => {
    expect((await updateLegalIdentity("u1", { legalFirstName: "", legalLastName: "O", dateOfBirth: "1992-01-02" })).error?.message)
      .toMatch(/legal first name/i);
    expect((await updateLegalIdentity("u1", { legalFirstName: "S", legalLastName: " ", dateOfBirth: "1992-01-02" })).error?.message)
      .toMatch(/legal last name/i);
    expect((await updateLegalIdentity("u1", { legalFirstName: "S", legalLastName: "O", dateOfBirth: "1992-02-31" })).error?.message)
      .toMatch(/date of birth/i);
    expect(db.writes).toEqual([]);
  });
});

describe("director details", () => {
  const args = {
    contactFirstName: " Jordan ",
    contactLastInitial: "t",
    orgName: " Austin Hoops ",
    orgType: "league",
    city: " Austin ",
    state: "tx",
  };

  it("updates the organization and the contact's public profile", async () => {
    const { error } = await updateDirectorDetails("u1", args);
    expect(error).toBeNull();
    expect(db.writes).toEqual([
      {
        table: "hirers",
        op: "update",
        values: {
          org_name: "Austin Hoops",
          org_type: "league",
          city: "Austin",
          state: "TX",
          contact_first_name: "Jordan",
          contact_last_initial: "T",
        },
        match: { user_id: "u1" },
      },
      {
        table: "public_profiles",
        op: "update",
        values: { first_name: "Jordan", last_initial: "T", city: "Austin", state: "TX" },
        match: { id: "u1" },
      },
      {
        table: "private_profiles",
        op: "update",
        values: { home_lat: 30.27, home_lng: -97.74 },
        match: { id: "u1" },
      },
    ]);
  });

  it("refuses blanks, unknown org types and states Refee doesn't serve", async () => {
    expect((await updateDirectorDetails("u1", { ...args, orgName: " " })).error?.message).toMatch(/organization name/i);
    expect((await updateDirectorDetails("u1", { ...args, orgType: "cult" })).error?.message).toMatch(/organization type/i);
    expect((await updateDirectorDetails("u1", { ...args, state: "ZZ" })).error?.message).toMatch(/state code/i);
    expect((await updateDirectorDetails("u1", { ...args, contactFirstName: "" })).error?.message).toMatch(/first name/i);
    expect(db.writes).toEqual([]);
  });

  it("stops at the first failed write", async () => {
    db.failOn = "hirers";
    const { error } = await updateDirectorDetails("u1", args);
    expect(error?.message).toBe("hirers failed");
    expect(db.writes.map((w) => w.table)).toEqual(["hirers"]);
  });
});

describe("assignor details", () => {
  it("updates the public profile", async () => {
    const { error } = await updateAssignorDetails("u1", {
      firstName: "Morgan",
      lastInitial: "e",
      city: "Round Rock",
      state: "TX",
    });
    expect(error).toBeNull();
    expect(db.writes).toEqual([
      {
        table: "public_profiles",
        op: "update",
        values: { first_name: "Morgan", last_initial: "E", city: "Round Rock", state: "TX" },
        match: { id: "u1" },
      },
      {
        table: "private_profiles",
        op: "update",
        values: { home_lat: null, home_lng: null },
        match: { id: "u1" },
      },
    ]);
  });

  it("refuses a missing city", async () => {
    const { error } = await updateAssignorDetails("u1", { firstName: "M", lastInitial: "E", city: "", state: "TX" });
    expect(error?.message).toMatch(/city/i);
  });
});
