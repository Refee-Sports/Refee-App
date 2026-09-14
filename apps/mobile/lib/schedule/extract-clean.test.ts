import { describe, expect, it } from "vitest";
import {
  clean,
  fileBlock,
  MAX_GAMES,
  MAX_TEXT_CHARS,
} from "../../../../supabase/functions/_shared/schedule-extract";

const game = (patch: Record<string, unknown> = {}) => ({
  home_team: "Long Island Friars",
  away_team: "Queens Knights",
  date: "2026-09-20",
  time: "13:30",
  confidence: "high",
  ...patch,
});

describe("clean: AI output is untrusted", () => {
  it("passes a well-formed game through", () => {
    const s = clean({ games: [game({ court: "Court 2", level: "high_school", team_level: "varsity" })], problems: [] });
    expect(s.games[0]).toMatchObject({
      home_team: "Long Island Friars",
      date: "2026-09-20",
      time: "13:30",
      court: "Court 2",
      level: "high_school",
      team_level: "varsity",
      confidence: "high",
    });
  });

  it("survives input that isn't the shape asked for", () => {
    for (const bad of [null, undefined, "games", 42, [], { games: "nope" }, { games: [null, "x", 3, []] }]) {
      expect(clean(bad)).toEqual({
        games: [],
        venue: { name: null, address: null, city: null, state: null, zip: null },
        event_notes: null,
        problems: [],
      });
    }
  });

  it("blanks dates that aren't real calendar days", () => {
    const dates = ["2026-02-30", "2026-13-01", "2026-9-20", "09/20/2026", "Sun Sept 20", 20260920];
    for (const d of dates) expect(clean({ games: [game({ date: d })] }).games[0].date).toBe("");
    expect(clean({ games: [game({ date: "2028-02-29" })] }).games[0].date).toBe("2028-02-29");
  });

  it("keeps only real 24-hour times, padding a single-digit hour", () => {
    expect(clean({ games: [game({ time: "9:05" })] }).games[0].time).toBe("09:05");
    expect(clean({ games: [game({ time: "00:00" })] }).games[0].time).toBe("00:00");
    expect(clean({ games: [game({ time: "23:59" })] }).games[0].time).toBe("23:59");
    for (const t of ["24:00", "13:60", "1:30 PM", "1330", "", null]) {
      expect(clean({ games: [game({ time: t })] }).games[0].time).toBe("");
    }
  });

  it("never turns a state name into the wrong code", () => {
    expect(clean({ games: [game({ venue_state: "New York" })] }).games[0].venue_state).toBeNull();
    expect(clean({ games: [game({ venue_state: " ny " })] }).games[0].venue_state).toBe("NY");
    expect(clean({ venue: { state: "Texas" } }).venue.state).toBeNull();
    expect(clean({ venue: { state: "pr" } }).venue.state).toBe("PR");
  });

  it("keeps a 5-digit ZIP (dropping ZIP+4) and nothing else", () => {
    expect(clean({ games: [game({ venue_zip: "11530-1234" })] }).games[0].venue_zip).toBe("11530");
    expect(clean({ venue: { zip: "11530" } }).venue.zip).toBe("11530");
    for (const z of ["1153", "115300", "ABCDE", "11530 NY"]) expect(clean({ venue: { zip: z } }).venue.zip).toBeNull();
  });

  it("drops values outside each list instead of trusting them", () => {
    const g = clean({
      games: [game({ level: "semi_pro", team_level: "varsity-ish", gender: "mixed", confidence: "certain" })],
    }).games[0];
    expect(g).toMatchObject({ level: null, team_level: null, gender: null, confidence: "low" });
  });

  it("drops rows with no teams but keeps a half-read matchup for review", () => {
    const s = clean({ games: [game({ home_team: "", away_team: " " }), game({ away_team: "" })] });
    expect(s.games).toHaveLength(1);
    expect(s.games[0]).toMatchObject({ home_team: "Long Island Friars", away_team: "" });
  });

  it("trims and length-limits free text", () => {
    const g = clean({ games: [game({ home_team: `  ${"A".repeat(300)}  `, notes: "n".repeat(500), court: " Main floor " })] })
      .games[0];
    expect(g.home_team).toHaveLength(120);
    expect(g.notes).toHaveLength(280);
    expect(g.court).toBe("Main floor");
  });

  it(`caps a schedule at ${MAX_GAMES} games and 20 problems`, () => {
    const s = clean({
      games: Array.from({ length: MAX_GAMES + 50 }, (_, i) => game({ home_team: `Team ${i}` })),
      problems: Array.from({ length: 40 }, (_, i) => `Problem ${i}`),
    });
    expect(s.games).toHaveLength(MAX_GAMES);
    expect(s.problems).toHaveLength(20);
  });

  it("keeps only text problems", () => {
    expect(clean({ problems: ["Year missing", 3, null, "", { x: 1 }, "  Logo mismatch  "] }).problems).toEqual([
      "Year missing",
      "Logo mismatch",
    ]);
  });
});

describe("fileBlock", () => {
  it("sends photos and PDFs as base64 blocks", () => {
    expect(fileBlock("image/png", "aGVsbG8=", "flyer.png")).toEqual({
      type: "image",
      source: { type: "base64", media_type: "image/png", data: "aGVsbG8=" },
    });
    expect(fileBlock("application/pdf", "JVBERi0=", "s.pdf")).toMatchObject({ type: "document" });
  });

  it("sends spreadsheets as text, even when the browser gives no text type", () => {
    expect(fileBlock("text/csv", "a,b", "s.csv")).toEqual({ type: "text", text: 'Uploaded file "s.csv":\n\na,b' });
    expect(fileBlock("application/vnd.ms-excel", "a,b", "Schedule.CSV")).toMatchObject({ type: "text" });
    expect(fileBlock("", "a\tb", "s.tsv")).toMatchObject({ type: "text" });
  });

  it("enforces the size limits with messages a director can act on", () => {
    const sixMb = "A".repeat(Math.ceil((6 * 1024 * 1024) / 0.75));
    expect(() => fileBlock("image/jpeg", sixMb, "big.jpg")).toThrow("Photos must be 5 MB or smaller.");
    const elevenMb = "A".repeat(Math.ceil((11 * 1024 * 1024) / 0.75));
    expect(() => fileBlock("application/pdf", elevenMb, "big.pdf")).toThrow("PDFs must be 10 MB or smaller.");
    expect(() => fileBlock("text/csv", "x".repeat(MAX_TEXT_CHARS + 1), "big.csv")).toThrow(/200,000 characters/);
    expect(() => fileBlock("text/csv", "x".repeat(MAX_TEXT_CHARS), "ok.csv")).not.toThrow();
  });

  it("explains how to send an iPhone photo instead of failing silently", () => {
    expect(() => fileBlock("image/heic", "AAAA", "IMG_1234.HEIC")).toThrow(/HEIC photos: share as JPG/);
    expect(() => fileBlock("application/zip", "AAAA", "files.zip")).toThrow(/Upload a photo/);
  });
});
