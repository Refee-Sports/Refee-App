import { describe, expect, it } from "vitest";
import { earningsCsv, earningsCsvFilename, earningsYears, toLedgerRows } from "@refee/core/referee/queries";

const row = (patch: Record<string, unknown> = {}, job: Record<string, unknown> = {}) => ({
  id: "a1",
  status: "completed",
  amount_due: 60,
  payout_status: "paid",
  paid_at: "2026-10-05T12:00:00Z",
  jobs: {
    id: "j1",
    title: "Lions vs Tigers",
    starts_at: "2026-10-04T17:00:00Z",
    timezone: "America/Chicago",
    pay_per_game: 60,
    hirers: { org_name: "Metro Hoops" },
    ...job,
  },
  ...patch,
});

const lines = (csv: string) => csv.trimEnd().split("\r\n");

describe("earningsCsv", () => {
  it("has one line per game with a header a spreadsheet understands", () => {
    expect(lines(earningsCsv(toLedgerRows([row()])))).toEqual([
      "Game date,Game,Organizer,Type,Amount (USD),Status,Paid on",
      "2026-10-04,Lions vs Tigers,Metro Hoops,Game,60.00,Paid,2026-10-05",
    ]);
  });

  it("dates each game by the venue's calendar, not UTC", () => {
    // 02:00 UTC on Oct 5 is still the evening of Oct 4 in Chicago.
    const [, line] = lines(earningsCsv(toLedgerRows([row({}, { starts_at: "2026-10-05T02:00:00Z" })])));
    expect(line.startsWith("2026-10-04,")).toBe(true);
  });

  it("labels fees and money not yet paid", () => {
    const csv = earningsCsv(
      toLedgerRows([
        row({ id: "fee", status: "cancelled", amount_due: 30, payout_status: "pending", paid_at: null }),
        row({ id: "sending", payout_status: "processing", paid_at: null }),
        row({ id: "failed", payout_status: "failed", paid_at: null }),
      ])
    );
    expect(lines(csv).slice(1).map((l) => l.split(",").slice(3).join(","))).toEqual([
      "Late-cancellation fee,30.00,Owed,",
      "Game,60.00,Sending,",
      "Game,60.00,Failed,",
    ]);
  });

  it("quotes commas and quotes, and defuses spreadsheet formulas", () => {
    const [, line] = lines(
      earningsCsv(toLedgerRows([row({}, { title: '=HYPERLINK("x")', hirers: { org_name: "Smith, Jones & Co" } })]))
    );
    expect(line).toBe('2026-10-04,"\'=HYPERLINK(""x"")","Smith, Jones & Co",Game,60.00,Paid,2026-10-05');
  });

  it("can be limited to one tax year", () => {
    const csv = earningsCsv(
      toLedgerRows([row({ id: "this" }), row({ id: "last" }, { starts_at: "2025-12-20T17:00:00Z" })]),
      { year: 2025 }
    );
    expect(lines(csv)).toHaveLength(2);
    expect(lines(csv)[1].startsWith("2025-12-20,")).toBe(true);
  });

  it("is just the header with nothing to export", () => {
    expect(lines(earningsCsv([]))).toHaveLength(1);
  });
});

describe("earningsCsvFilename", () => {
  it("names the file for the year, or for today when it's everything", () => {
    expect(earningsCsvFilename({ year: 2025 })).toBe("refee-earnings-2025.csv");
    expect(earningsCsvFilename({}, new Date("2026-10-15T12:00:00Z"))).toBe("refee-earnings-2026-10-15.csv");
  });
});

describe("earningsYears", () => {
  it("lists the years with earnings, newest first", () => {
    const rows = toLedgerRows([
      row({ id: "a" }),
      row({ id: "b" }, { starts_at: "2025-03-01T17:00:00Z" }),
      row({ id: "c" }, { starts_at: "2025-12-31T17:00:00Z" }),
    ]);
    expect(earningsYears(rows)).toEqual([2026, 2025]);
    expect(earningsYears([])).toEqual([]);
  });
});
