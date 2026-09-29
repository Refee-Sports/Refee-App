import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  invoke: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: { rpc: mocks.rpc, functions: { invoke: mocks.invoke }, from: mocks.from },
}));

import {
  extractRosterCode,
  fetchMyRosterInvites,
  fetchMyRosterInviteCode,
  inviteToRosterByEmail,
  joinRosterByCode,
  leaveRoster,
  parseEmails,
  previewRosterInviteCode,
  rosterInviteLink,
  rotateRosterInviteCode,
  sendRosterBlast,
  sendRosterEmailInvites,
} from "./queries";
import { canSendInConversation } from "@/lib/messages/queries";
import { qrModules } from "./qr";

describe("parseEmails", () => {
  it("pulls addresses out of a comma, semicolon or newline separated paste", () => {
    expect(parseEmails("a@x.com, b@y.org;c@z.net\nd@w.io")).toEqual([
      "a@x.com",
      "b@y.org",
      "c@z.net",
      "d@w.io",
    ]);
  });

  it("lowercases and removes duplicates", () => {
    expect(parseEmails("Jordan@Example.com\njordan@example.com")).toEqual(["jordan@example.com"]);
  });

  it("finds addresses in a CSV with headers and other columns", () => {
    const csv = 'name,email,city\n"Sam Lee",sam@example.com,Austin\nRiley,"riley@example.com",Dallas';
    expect(parseEmails(csv)).toEqual(["sam@example.com", "riley@example.com"]);
  });

  it("ignores text that isn't an email", () => {
    expect(parseEmails("hello world, 12345, foo@bar")).toEqual([]);
    expect(parseEmails("")).toEqual([]);
  });
});

describe("roster invite links and codes", () => {
  it("builds the link the QR code carries", () => {
    expect(rosterInviteLink("K7M2QX9A")).toBe("https://refee.app/join/K7M2QX9A");
    expect(rosterInviteLink("K7M2QX9A", "http://localhost:3000")).toBe("http://localhost:3000/join/K7M2QX9A");
  });

  it("reads the code from a scanned link, an app link, or a typed code", () => {
    expect(extractRosterCode("https://refee.app/join/K7M2QX9A")).toBe("K7M2QX9A");
    expect(extractRosterCode("refee://join/k7m2qx9a")).toBe("K7M2QX9A");
    expect(extractRosterCode("  k7m2qx9a  ")).toBe("K7M2QX9A");
  });

  it("rejects things that can't be a code", () => {
    expect(extractRosterCode("")).toBeNull();
    expect(extractRosterCode("abc")).toBeNull();
    expect(extractRosterCode("not a code!")).toBeNull();
    expect(extractRosterCode("https://evil.example/steal")).toBeNull();
  });
});

describe("qrModules", () => {
  it("returns a square grid with the three finder patterns in the corners", () => {
    const grid = qrModules("https://refee.app/join/K7M2QX9A");
    const size = grid.length;
    expect(size).toBeGreaterThanOrEqual(21);
    expect(grid.every((row) => row.length === size)).toBe(true);
    // Finder patterns: a dark 7x7 ring with a dark 3x3 centre, at three corners.
    for (const [r, c] of [[0, 0], [0, size - 7], [size - 7, 0]]) {
      expect(grid[r][c]).toBe(true);
      expect(grid[r + 3][c + 3]).toBe(true);
      expect(grid[r + 1][c + 1]).toBe(false);
    }
  });

  it("is deterministic for the same input", () => {
    expect(qrModules("hello")).toEqual(qrModules("hello"));
  });
});

describe("roster growth goes through narrow server operations", () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
    mocks.invoke.mockReset();
    mocks.from.mockReset();
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    mocks.invoke.mockResolvedValue({ data: null, error: null });
  });

  it("invites by email via the RPC and returns one result per address", async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ email: "a@x.com", result: "pending" }],
      error: null,
    });
    const out = await inviteToRosterByEmail(["a@x.com"]);
    expect(mocks.rpc).toHaveBeenCalledWith("invite_to_roster_by_email", { p_emails: ["a@x.com"] });
    expect(out.results).toEqual([{ email: "a@x.com", result: "pending" }]);
    expect(out.error).toBeNull();
  });

  it("surfaces an RPC error instead of pretending invites went out", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "Assignor role required" } });
    const out = await inviteToRosterByEmail(["a@x.com"]);
    expect(out.results).toEqual([]);
    expect(out.error?.message).toBe("Assignor role required");
  });

  it("gets, rotates, previews and joins with a code", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: "K7M2QX9A", error: null });
    expect(await fetchMyRosterInviteCode()).toEqual({ code: "K7M2QX9A", error: null });
    expect(mocks.rpc).toHaveBeenLastCalledWith("my_roster_invite_code");

    mocks.rpc.mockResolvedValueOnce({ data: "NEWCODE22", error: null });
    expect((await rotateRosterInviteCode()).code).toBe("NEWCODE22");
    expect(mocks.rpc).toHaveBeenLastCalledWith("rotate_roster_invite_code");

    mocks.rpc.mockResolvedValueOnce({
      data: [{ assignor_id: "a1", display_name: "Morgan E.", city: "Austin", state: "TX", avatar_url: null }],
      error: null,
    });
    expect((await previewRosterInviteCode("K7M2QX9A")).preview?.display_name).toBe("Morgan E.");
    expect(mocks.rpc).toHaveBeenLastCalledWith("preview_roster_invite_code", { p_code: "K7M2QX9A" });

    await joinRosterByCode("K7M2QX9A");
    expect(mocks.rpc).toHaveBeenLastCalledWith("join_roster_by_code", { p_code: "K7M2QX9A" });
  });

  it("returns no preview for an unknown code", async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });
    expect((await previewRosterInviteCode("NOPE1234")).preview).toBeNull();
  });

  it("lets a referee leave a roster without naming a referee id", async () => {
    await leaveRoster("roster-1");
    expect(mocks.rpc).toHaveBeenCalledWith("leave_roster", { p_roster_id: "roster-1" });
  });

  it("claims email invites before listing a referee's pending invites", async () => {
    const order: string[] = [];
    mocks.rpc.mockImplementation(async (name: string) => {
      order.push(`rpc:${name}`);
      return { data: 1, error: null };
    });
    const query = {
      select: () => query,
      eq: () => query,
      order: async () => {
        order.push("select");
        return { data: [], error: null };
      },
    };
    mocks.from.mockReturnValue(query);
    await fetchMyRosterInvites("ref-1");
    expect(order).toEqual(["rpc:claim_roster_invites", "select"]);
  });

  it("emails only pending addresses, and says so when email isn't configured", async () => {
    mocks.invoke.mockResolvedValue({ data: { sent: 0, configured: false }, error: null });
    const out = await sendRosterEmailInvites(["new@x.com"]);
    expect(mocks.invoke).toHaveBeenCalledWith("send-roster-invites", { body: { emails: ["new@x.com"] } });
    expect(out).toEqual({ sent: 0, configured: false, error: null });

    mocks.invoke.mockClear();
    expect(await sendRosterEmailInvites([])).toEqual({ sent: 0, configured: true, error: null });
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
});

describe("roster blasts", () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
    mocks.invoke.mockReset();
    mocks.from.mockReset();
    mocks.invoke.mockResolvedValue({ data: null, error: null });
  });

  it("posts through the RPC and pushes each recipient, in batches the push function accepts", async () => {
    const ids = Array.from({ length: 450 }, (_, i) => `ref-${i}`);
    mocks.rpc.mockResolvedValue({ data: { conversation_id: "c1", recipient_ids: ids }, error: null });

    const out = await sendRosterBlast("  Gym change: Court 2  ");

    expect(mocks.rpc).toHaveBeenCalledWith("post_roster_blast", { p_body: "  Gym change: Court 2  " });
    expect(out.recipientIds).toHaveLength(450);
    expect(out.error).toBeNull();
    expect(mocks.invoke).toHaveBeenCalledTimes(3); // 200 + 200 + 50
    const first = mocks.invoke.mock.calls[0][1].body;
    expect(first.userIds).toHaveLength(200);
    expect(first.body).toBe("Gym change: Court 2");
    expect(first.data).toEqual({ type: "message", conversationId: "c1" });
    expect(mocks.invoke.mock.calls[2][1].body.userIds).toHaveLength(50);
  });

  it("does not push anything when the server refuses the blast", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "Your roster is empty" } });
    const out = await sendRosterBlast("hello");
    expect(out.recipientIds).toEqual([]);
    expect(out.error?.message).toBe("Your roster is empty");
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it("truncates a long announcement in the push preview", async () => {
    mocks.rpc.mockResolvedValue({ data: { conversation_id: "c1", recipient_ids: ["r1"] }, error: null });
    await sendRosterBlast("x".repeat(300));
    expect(mocks.invoke.mock.calls[0][1].body.body).toHaveLength(100);
  });

  it("treats a roster announcement thread as read-only for everyone who reads it", async () => {
    const query = {
      select: () => query,
      eq: () => query,
      maybeSingle: async () => ({ data: { kind: "roster_blast" }, error: null }),
    };
    mocks.from.mockReturnValue(query);
    const out = await canSendInConversation("c1", "ref-1");
    expect(out.allowed).toBe(false);
    expect(out.readOnlyReason).toMatch(/one-way/i);
  });
});
