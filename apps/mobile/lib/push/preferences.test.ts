import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ maybeSingle: vi.fn(), upsert: vi.fn() }));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }),
      upsert: mocks.upsert,
    }),
  },
}));

import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  NOTIFICATION_SWITCHES,
  fetchNotificationPreferences,
  saveNotificationPreference,
} from "./preferences";

beforeEach(() => {
  mocks.maybeSingle.mockReset();
  mocks.upsert.mockReset().mockResolvedValue({ error: null });
});

describe("what the switches offer", () => {
  it("has the three kinds, each with words a person can read", () => {
    expect(NOTIFICATION_SWITCHES.map((s) => s.kind)).toEqual(["new_games", "crew_messages", "game_updates"]);
    for (const s of NOTIFICATION_SWITCHES) {
      expect(s.label.length).toBeGreaterThan(3);
      expect(s.description.length).toBeGreaterThan(10);
    }
  });

  it("starts with everything on", () => {
    expect(DEFAULT_NOTIFICATION_PREFERENCES).toEqual({ new_games: true, crew_messages: true, game_updates: true });
  });
});

describe("reading preferences", () => {
  it("is all on for someone who has never changed anything", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await fetchNotificationPreferences("u1")).toEqual({
      prefs: { new_games: true, crew_messages: true, game_updates: true },
      error: null,
    });
  });

  it("returns what was saved", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { new_games: false, crew_messages: true, game_updates: false }, error: null });
    const { prefs } = await fetchNotificationPreferences("u1");
    expect(prefs).toEqual({ new_games: false, crew_messages: true, game_updates: false });
  });

  it("treats a missing value as on, never off", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { new_games: false }, error: null });
    const { prefs } = await fetchNotificationPreferences("u1");
    expect(prefs).toEqual({ new_games: false, crew_messages: true, game_updates: true });
  });

  it("falls back to all on if it can't be read, and says so", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: { message: "boom" } });
    const result = await fetchNotificationPreferences("u1");
    expect(result.prefs).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
    expect(result.error).toBe("We couldn't load your notification settings.");
  });
});

describe("saving one switch", () => {
  it("saves only that kind, for that person", async () => {
    expect(await saveNotificationPreference("u1", "new_games", false)).toEqual({ error: null });
    expect(mocks.upsert).toHaveBeenCalledWith({ user_id: "u1", new_games: false }, { onConflict: "user_id" });
  });

  it("reports a failure without leaking the raw error", async () => {
    mocks.upsert.mockResolvedValue({ error: { message: "permission denied for table notification_preferences" } });
    const { error } = await saveNotificationPreference("u1", "crew_messages", true);
    expect(error).toBe("We couldn't save that. Try again.");
  });
});
