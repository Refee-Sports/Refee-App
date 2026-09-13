import { describe, expect, it } from "vitest";
import { localDateTimeToIso, parseScheduleCsv, SCHEDULE_CSV_TEMPLATE } from "./csv";

const defaults = {
  startsOn: "2026-09-20",
  endsOn: "2026-09-21",
  timezone: "America/Chicago",
  venueName: "Default Gym",
  venueCity: "Austin",
  venueState: "TX",
  ruleset: "NFHS",
} as const;

describe("schedule CSV parsing", () => {
  it("parses the production template", () => {
    const result = parseScheduleCsv(SCHEDULE_CSV_TEMPLATE, defaults);
    expect(result.canImport).toBe(true);
    expect(result.validRows).toHaveLength(1);
    expect(result.validRows[0]).toMatchObject({ homeTeam: "Lions", crewSize: 3, payPerGame: 75 });
    expect(result.validRows[0].startsAt).toBe("2026-09-20T14:00:00.000Z");
  });

  it("supports quoted commas, escaped quotes, CRLF, and a BOM", () => {
    const csv = `\uFEFFhome_team,away_team,date,time,timezone,venue_name,venue_city,venue_state,level,crew_size,pay_per_game,duration_minutes,age_group,gender,ruleset\r\n"St. Mary""s, North",Tigers,2026-09-20,09:00,America/Chicago,,Austin,TX,youth,2,55,60,U14,girls,NFHS\r\n`;
    const result = parseScheduleCsv(csv, defaults);
    expect(result.canImport).toBe(true);
    expect(result.validRows[0].homeTeam).toBe('St. Mary"s, North');
    expect(result.validRows[0].venueName).toBe("Default Gym");
  });

  it("reports missing headers as a file error", () => {
    const result = parseScheduleCsv("home_team,away_team\nA,B\n", defaults);
    expect(result.canImport).toBe(false);
    expect(result.fileErrors[0]).toContain("Missing columns");
  });

  it("reports row errors without producing import data", () => {
    const csv = SCHEDULE_CSV_TEMPLATE.replace("2026-09-20", "2026-09-22").replace(",3,75,60,", ",8,0,5,");
    const result = parseScheduleCsv(csv, defaults);
    expect(result.canImport).toBe(false);
    expect(result.validRows).toHaveLength(0);
    expect(result.rows[0].errors.join(" ")).toContain("date must be between");
    expect(result.rows[0].errors.join(" ")).toContain("crew_size");
    expect(result.rows[0].errors.join(" ")).toContain("pay_per_game");
    expect(result.rows[0].errors.join(" ")).toContain("duration_minutes");
  });

  it("rejects duplicate games within one upload", () => {
    const csv = SCHEDULE_CSV_TEMPLATE + SCHEDULE_CSV_TEMPLATE.split("\n")[1] + "\n";
    const result = parseScheduleCsv(csv, defaults);
    expect(result.canImport).toBe(false);
    expect(result.rows[1].errors).toContain("duplicate game in this file");
  });

  it("rejects nonexistent and ambiguous daylight-saving local times", () => {
    expect(localDateTimeToIso("2026-03-08", "02:30", "America/New_York").error).toContain("does not exist");
    expect(localDateTimeToIso("2026-11-01", "01:30", "America/New_York").error).toContain("ambiguous");
  });

  it("rejects invalid IANA timezone names", () => {
    expect(localDateTimeToIso("2026-09-20", "09:00", "Central",).error).toContain("valid IANA");
  });
});
