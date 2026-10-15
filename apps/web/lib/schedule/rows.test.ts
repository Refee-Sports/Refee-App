import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtractedSchedule } from "@refee/core/schedule/ai-import";
import {
  carrySchedule,
  emptyRow,
  rowsFromSchedule,
  savePendingImport,
  soleLevel,
  takeCarriedSchedule,
  takePendingImport,
} from "./rows";

const game = (patch: Record<string, unknown> = {}) => ({
  home_team: "Lions",
  away_team: "Tigers",
  date: "2026-09-20",
  time: "09:00",
  court: null,
  venue_name: null,
  venue_address: null,
  venue_city: null,
  venue_state: null,
  venue_zip: null,
  level: "high_school",
  team_level: null,
  age_group: null,
  gender: null,
  notes: null,
  confidence: "high" as const,
  ...patch,
});

const schedule = (games: ReturnType<typeof game>[]) => ({ games }) as unknown as ExtractedSchedule;

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

beforeEach(() => vi.stubGlobal("sessionStorage", memoryStorage()));
afterEach(() => vi.unstubAllGlobals());

describe("review rows", () => {
  it("gives every row its own key", () => {
    expect(emptyRow("2026-09-20").key).not.toBe(emptyRow("2026-09-20").key);
  });

  it("fills a missing date with the fallback and keeps the reader's notes", () => {
    const [row] = rowsFromSchedule(schedule([game({ date: "", notes: "Check the time", confidence: "low" })]), "2026-09-21");
    expect(row).toMatchObject({ date: "2026-09-21", notes: "Check the time", confidence: "low", include: true, court: "" });
  });

  it("knows when the whole file is one level", () => {
    expect(soleLevel(schedule([game(), game()]))).toBe("high_school");
    expect(soleLevel(schedule([game(), game({ level: "youth_rec" })]))).toBeNull();
    expect(soleLevel(schedule([game({ level: null })]))).toBeNull();
  });
});

describe("hand-offs between screens", () => {
  it("passes reviewed games to the import page once", () => {
    const pending = { rows: [emptyRow("2026-09-20")], level: "high_school", crewSize: 2 as const, error: "x" };
    savePendingImport("t1", pending);
    expect(takePendingImport("t2")).toBeNull();
    expect(takePendingImport("t1")).toEqual(pending);
    expect(takePendingImport("t1")).toBeNull();
  });

  it("carries a schedule to New tournament once", () => {
    const s = schedule([game()]);
    carrySchedule(s);
    expect(takeCarriedSchedule()).toEqual(s);
    expect(takeCarriedSchedule()).toBeNull();
  });

  it("starts fresh rather than failing when storage is unavailable", () => {
    vi.stubGlobal("sessionStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {},
    });
    expect(() => carrySchedule(schedule([]))).not.toThrow();
    expect(takeCarriedSchedule()).toBeNull();
  });
});
