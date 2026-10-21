import { describe, expect, it } from "vitest";
import {
  BAN_DURATION,
  parseAdminAccountRequest,
  refuseAdminAccountAction,
} from "../../../../supabase/functions/_shared/admin-account";

const USER = "22222222-2222-4222-8222-222222222201";
const STAFF = "22222222-2222-4222-8222-222222222203";

describe("parseAdminAccountRequest", () => {
  it("accepts view as, with the reason staff gave", () => {
    expect(parseAdminAccountRequest({ action: "view_as", userId: USER, reason: "  Can't see their games " })).toEqual({
      ok: true,
      action: "view_as",
      userId: USER,
      reason: "Can't see their games",
    });
  });

  it("needs a reason to look at someone's account or switch it off", () => {
    for (const action of ["view_as", "deactivate"]) {
      const r = parseAdminAccountRequest({ action, userId: USER, reason: "  " });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/reason/i);
    }
  });

  it("lets an account back in without a reason", () => {
    expect(parseAdminAccountRequest({ action: "reactivate", userId: USER })).toEqual({
      ok: true,
      action: "reactivate",
      userId: USER,
      reason: null,
    });
  });

  it("refuses anything it doesn't know", () => {
    expect(parseAdminAccountRequest({ action: "delete", userId: USER, reason: "x" }).ok).toBe(false);
    expect(parseAdminAccountRequest({ action: "view_as", userId: "not-an-id", reason: "x" }).ok).toBe(false);
    expect(parseAdminAccountRequest(null).ok).toBe(false);
  });

  it("keeps a reason to a sensible length", () => {
    const r = parseAdminAccountRequest({ action: "deactivate", userId: USER, reason: "x".repeat(900) });
    expect(r.ok && r.reason?.length).toBe(500);
  });
});

describe("refuseAdminAccountAction", () => {
  it("allows staff to act on an ordinary account", () => {
    expect(
      refuseAdminAccountAction({ callerId: STAFF, targetId: USER, targetIsStaff: false, action: "view_as" })
    ).toBeNull();
  });

  it("won't let staff switch off or step into their own account", () => {
    expect(
      refuseAdminAccountAction({ callerId: STAFF, targetId: STAFF, targetIsStaff: true, action: "deactivate" })
    ).toMatch(/your own/i);
  });

  it("won't let one staff member become another", () => {
    expect(
      refuseAdminAccountAction({ callerId: STAFF, targetId: USER, targetIsStaff: true, action: "view_as" })
    ).toMatch(/staff/i);
    expect(
      refuseAdminAccountAction({ callerId: STAFF, targetId: USER, targetIsStaff: true, action: "deactivate" })
    ).toMatch(/staff/i);
  });

  it("turns sign-in off for good, not for a while", () => {
    expect(parseInt(BAN_DURATION, 10)).toBeGreaterThanOrEqual(24 * 365 * 50);
  });
});
