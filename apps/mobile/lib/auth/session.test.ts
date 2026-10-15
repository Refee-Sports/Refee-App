import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ getSession: vi.fn(), getUser: vi.fn(), signOut: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabase: { auth } }));

import { ensureValidSession, getSessionUserId } from "./session";

beforeEach(() => {
  auth.getSession.mockReset();
  auth.getUser.mockReset();
  auth.signOut.mockReset();
});

describe("getSessionUserId", () => {
  it("reads the id from the stored session", async () => {
    auth.getSession.mockResolvedValue({ data: { session: { user: { id: "u1" } } } });
    expect(await getSessionUserId()).toBe("u1");
  });

  it("is null when signed out", async () => {
    auth.getSession.mockResolvedValue({ data: { session: null } });
    expect(await getSessionUserId()).toBeNull();
  });
});

describe("ensureValidSession", () => {
  it("is false with no session, without asking the server", async () => {
    auth.getSession.mockResolvedValue({ data: { session: null } });
    expect(await ensureValidSession()).toBe(false);
    expect(auth.getUser).not.toHaveBeenCalled();
  });

  it("signs out a session the server no longer accepts", async () => {
    auth.getSession.mockResolvedValue({ data: { session: { user: { id: "u1" } } } });
    auth.getUser.mockResolvedValue({ data: { user: null }, error: { message: "JWT expired" } });
    expect(await ensureValidSession()).toBe(false);
    expect(auth.signOut).toHaveBeenCalled();
  });

  it("is true for a session the server accepts", async () => {
    auth.getSession.mockResolvedValue({ data: { session: { user: { id: "u1" } } } });
    auth.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    expect(await ensureValidSession()).toBe(true);
  });
});
