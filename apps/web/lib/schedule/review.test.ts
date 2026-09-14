import { describe, expect, it } from "vitest";
import { checkRows, rowErrors, type ReviewRow } from "./review";

const row = (patch: Partial<ReviewRow> = {}): ReviewRow => ({
  homeTeam: "Long Island Friars",
  awayTeam: "Queens Knights",
  date: "2026-09-20",
  time: "13:30",
  level: "high_school",
  ageGroup: "",
  ...patch,
});
const tournament = { starts_on: "2026-09-19", ends_on: "2026-09-20" };

describe("import review: what blocks a row", () => {
  it("passes a complete row", () => {
    expect(rowErrors(row(), tournament)).toEqual([]);
  });

  it("needs both teams, and blank-looking names count as missing", () => {
    expect(rowErrors(row({ homeTeam: "" }), tournament)).toEqual(["Both teams needed"]);
    expect(rowErrors(row({ awayTeam: "   " }), tournament)).toEqual(["Both teams needed"]);
  });

  it("rejects a team playing itself, ignoring case and spacing", () => {
    expect(rowErrors(row({ homeTeam: "Friars", awayTeam: "  FRIARS " }), tournament)).toEqual(["Teams must differ"]);
  });

  it("needs an ISO date", () => {
    expect(rowErrors(row({ date: "" }), tournament)).toEqual(["Date needed"]);
    expect(rowErrors(row({ date: "9/20/2026" }), tournament)).toEqual(["Date needed"]);
  });

  it("keeps games inside the tournament dates, both ends inclusive", () => {
    expect(rowErrors(row({ date: "2026-09-19" }), tournament)).toEqual([]);
    expect(rowErrors(row({ date: "2026-09-18" }), tournament)).toEqual(["Outside the tournament dates"]);
    expect(rowErrors(row({ date: "2026-09-21" }), tournament)).toEqual(["Outside the tournament dates"]);
  });

  it("compares against the day even when the tournament dates carry a time", () => {
    expect(rowErrors(row(), { starts_on: "2026-09-20T00:00:00", ends_on: "2026-09-20T00:00:00" })).toEqual([]);
  });

  it("skips the date-range check when the tournament hasn't loaded", () => {
    expect(rowErrors(row({ date: "2030-01-01" }), null)).toEqual([]);
  });

  it("needs a 24-hour HH:MM tip-off", () => {
    expect(rowErrors(row({ time: "" }), tournament)).toEqual(["Tip-off time needed"]);
    expect(rowErrors(row({ time: "9:30" }), tournament)).toEqual(["Tip-off time needed"]);
  });

  it("needs a level, and an age group for youth / rec", () => {
    expect(rowErrors(row({ level: "" }), tournament)).toEqual(["Level needed"]);
    expect(rowErrors(row({ level: "youth_rec" }), tournament)).toEqual(["Age group needed"]);
    expect(rowErrors(row({ level: "youth_rec", ageGroup: " " }), tournament)).toEqual(["Age group needed"]);
    expect(rowErrors(row({ level: "youth_rec", ageGroup: "U14" }), tournament)).toEqual([]);
  });

  it("applies the default level to rows that don't name one", () => {
    const [blank, youth] = checkRows([row({ level: "" }), row({ level: "youth_rec" })], "high_school", tournament);
    expect(blank.effective.level).toBe("high_school");
    expect(blank.row.level).toBe("");
    expect(blank.errors).toEqual([]);
    expect(youth.errors).toEqual(["Age group needed"]);
    expect(checkRows([row({ level: "" })], "", tournament)[0].errors).toEqual(["Level needed"]);
  });

  it("lists every problem at once, in reading order", () => {
    expect(rowErrors(row({ homeTeam: "", date: "", time: "", level: "" }), tournament)).toEqual([
      "Both teams needed",
      "Date needed",
      "Tip-off time needed",
      "Level needed",
    ]);
  });
});
