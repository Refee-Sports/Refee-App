import { beforeEach, describe, expect, it, vi } from "vitest";
import { configureSupabase } from "@refee/core/client";

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));

configureSupabase({ functions: { invoke: mocks.invoke } } as never);

import { notifyNewGames, sendPush } from "@refee/core/push/send";

beforeEach(() => {
  // Braces matter: a function returned from beforeEach is run as cleanup.
  mocks.invoke.mockReset().mockResolvedValue({ data: {}, error: null });
});

describe("sendPush", () => {
  it("passes the kind of notification so people's switches are respected", async () => {
    await sendPush(["u1"], "Hi", "Body", { type: "message" }, "crew_messages");
    expect(mocks.invoke).toHaveBeenCalledWith("send-push", {
      body: { userIds: ["u1"], title: "Hi", body: "Body", data: { type: "message" }, kind: "crew_messages" },
    });
  });

  it("does nothing when there is no one to tell", async () => {
    await sendPush([], "Hi", "Body");
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it("never throws, so a failed push cannot break the action that caused it", async () => {
    mocks.invoke.mockImplementation(() => Promise.reject(new Error("offline")));
    let threw = false;
    try {
      await sendPush(["u1"], "Hi", "Body");
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
  });
});

describe("notifyNewGames", () => {
  it("asks the backend to announce the games, naming only the games", async () => {
    await notifyNewGames(["g1", "g2"]);
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
    expect(mocks.invoke).toHaveBeenCalledWith("notify-new-games", { body: { jobIds: ["g1", "g2"] } });
  });

  it("does nothing for an empty list", async () => {
    await notifyNewGames([]);
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it("drops duplicates and blanks", async () => {
    await notifyNewGames(["g1", "g1", "", "g2"]);
    expect(mocks.invoke).toHaveBeenCalledWith("notify-new-games", { body: { jobIds: ["g1", "g2"] } });
  });

  it("sends a big import in batches of 100", async () => {
    const ids = Array.from({ length: 250 }, (_, i) => `g${i}`);
    await notifyNewGames(ids);
    expect(mocks.invoke).toHaveBeenCalledTimes(3);
    const sizes = mocks.invoke.mock.calls.map((c) => (c[1] as { body: { jobIds: string[] } }).body.jobIds.length);
    expect(sizes).toEqual([100, 100, 50]);
  });

  it("never throws, so posting a game cannot fail because an alert did", async () => {
    mocks.invoke.mockImplementation(() => Promise.reject(new Error("offline")));
    let threw = false;
    try {
      await notifyNewGames(["g1"]);
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
  });
});
