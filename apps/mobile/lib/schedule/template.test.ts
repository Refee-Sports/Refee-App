import { describe, expect, it } from "vitest";
// Shared core logic; it lives in @refee/core and is tested here, where CI runs vitest.
import {
  buildScheduleTemplate,
  parseDateCell,
  parseTemplateCsv,
  parseTimeCell,
} from "@refee/core/schedule/template";

describe("schedule template", () => {
  it("round-trips: the downloaded template holds only examples, which are skipped", () => {
    const csv = buildScheduleTemplate({ date: "2026-10-18", courts: ["Main floor"] });
    expect(csv.split("\r\n")[0]).toBe("home_team,away_team,date,time,court,level,team_level,age_group,notes");
    expect(csv).toContain("2026-10-18");
    expect(csv).toContain("Main floor");
    const parsed = parseTemplateCsv(csv);
    expect(parsed?.games).toHaveLength(0);
    expect(parsed?.problems[0]).toMatch(/example rows/);
  });

  it("reads a filled-in template", () => {
    const parsed = parseTemplateCsv(
      "home_team,away_team,date,time,court,level,team_level,age_group,notes\n" +
        "Long Island Friars,Queens Knights,2026-10-18,1:30 PM,Court 2,High School,Varsity,,\n" +
        '"Hawks, Garden City",Mineola Owls,10/18/2026,16:00,Court 1,Youth / Rec,,U14,Girls bracket\n'
    );
    expect(parsed?.problems).toEqual([]);
    expect(parsed?.games[0]).toMatchObject({
      home_team: "Long Island Friars",
      date: "2026-10-18",
      time: "13:30",
      court: "Court 2",
      level: "high_school",
      team_level: "varsity",
      confidence: "high",
    });
    expect(parsed?.games[1]).toMatchObject({
      home_team: "Hawks, Garden City",
      time: "16:00",
      level: "youth_rec",
      age_group: "U14",
      notes: "Girls bracket",
    });
  });

  it("accepts the header names people type and what Excel saves", () => {
    const parsed = parseTemplateCsv(
      "\uFEFFHome,Visitor,Game Date,Tip-off,Gym,Level\r\nFriars,Knights,10/18/26,1:30:00 PM,Court 3,HS\r\n"
    );
    expect(parsed?.games[0]).toMatchObject({ date: "2026-10-18", time: "13:30", court: "Court 3", level: "high_school" });
  });

  it("flags cells it can't read instead of guessing", () => {
    const parsed = parseTemplateCsv("home_team,away_team,date,time,level\nA,B,Oct 18th,25:00,Semi-pro\n");
    const game = parsed!.games[0];
    expect(game.date).toBe("");
    expect(game.time).toBe("");
    expect(game.level).toBeNull();
    expect(game.confidence).toBe("low");
    expect(game.notes).toMatch(/date.*time.*level/);
  });

  it("hands anything that isn't a schedule sheet to the AI reader", () => {
    expect(parseTemplateCsv("name,email\nSam,sam@example.com\n")).toBeNull();
    expect(parseTemplateCsv("")).toBeNull();
  });

  it("parses times and dates", () => {
    expect(parseTimeCell("12 PM")).toBe("12:00");
    expect(parseTimeCell("12:15 am")).toBe("00:15");
    expect(parseTimeCell("9:05p")).toBe("21:05");
    expect(parseTimeCell("13")).toBeNull();
    expect(parseTimeCell("13:30 PM")).toBeNull();
    expect(parseDateCell("Sun 9/20", "2026")).toBe("2026-09-20");
    expect(parseDateCell("2/30/2026")).toBeNull();
    expect(parseDateCell("9/20")).toBeNull();
  });
});
