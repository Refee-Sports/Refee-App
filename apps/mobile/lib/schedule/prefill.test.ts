import { describe, expect, it } from "vitest";
// Shared core logic; tested here, where CI runs vitest.
import type { ExtractedGame, ExtractedSchedule } from "@refee/core/schedule/ai-import";
import { tournamentDraftFromSchedule } from "@refee/core/schedule/prefill";

const game = (patch: Partial<ExtractedGame> = {}): ExtractedGame => ({
  home_team: "Long Island Friars",
  away_team: "Queens Knights",
  date: "2026-09-20",
  time: "13:30",
  court: null,
  venue_name: null,
  venue_address: null,
  venue_city: null,
  venue_state: null,
  venue_zip: null,
  level: null,
  team_level: null,
  age_group: null,
  gender: null,
  notes: null,
  confidence: "high",
  ...patch,
});

const schedule = (patch: Partial<ExtractedSchedule> = {}): ExtractedSchedule => ({
  games: [game()],
  venue: { name: null, address: null, city: null, state: null, zip: null },
  event_notes: null,
  problems: [],
  ...patch,
});

describe("tournament draft from an uploaded schedule", () => {
  it("fills the tournament from the flyer", () => {
    const d = tournamentDraftFromSchedule(
      schedule({
        event: { name: "The Initiation", starts_on: "2026-09-20", ends_on: "2026-09-20" },
        venue: { name: "Adelphi University", address: "1 South Ave", city: "Garden City", state: "ny", zip: "11530" },
        event_notes: " Doors 1 PM ",
      })
    );
    expect(d).toEqual({
      name: "The Initiation",
      startsOn: "2026-09-20",
      endsOn: "2026-09-20",
      venueName: "Adelphi University",
      venueAddress: "1 South Ave",
      venueCity: "Garden City",
      venueState: "NY",
      venueZip: "11530",
      courts: [],
      arrivalNotes: "Doors 1 PM",
      gamesElsewhere: 0,
    });
  });

  it("takes the dates from the games when the flyer gives none", () => {
    const d = tournamentDraftFromSchedule(
      schedule({ games: [game({ date: "2026-10-11" }), game({ date: "2026-10-10" }), game({ date: "" })] })
    );
    expect(d).toMatchObject({ startsOn: "2026-10-10", endsOn: "2026-10-11" });
  });

  it("widens the dates so no listed game falls outside the tournament", () => {
    const narrow = schedule({
      event: { name: null, starts_on: "2026-10-10", ends_on: "2026-10-10" },
      games: [game({ date: "2026-10-10" }), game({ date: "2026-10-12" })],
    });
    expect(tournamentDraftFromSchedule(narrow)).toMatchObject({ startsOn: "2026-10-10", endsOn: "2026-10-12" });
    const wide = schedule({
      event: { name: null, starts_on: "2026-10-09", ends_on: "2026-10-13" },
      games: [game({ date: "2026-10-10" })],
    });
    expect(tournamentDraftFromSchedule(wide)).toMatchObject({ startsOn: "2026-10-09", endsOn: "2026-10-13" });
  });

  it("leaves the dates blank when nothing in the file has one", () => {
    expect(tournamentDraftFromSchedule(schedule({ games: [game({ date: "" })] }))).toMatchObject({ startsOn: "", endsOn: "" });
    expect(tournamentDraftFromSchedule(schedule({ games: [] }))).toMatchObject({ startsOn: "", endsOn: "" });
  });

  it("uses the venue most games are at when the flyer names no event venue", () => {
    const d = tournamentDraftFromSchedule(
      schedule({
        games: [
          game({ venue_name: "Dunbar HS", venue_address: "101 N St NW", venue_city: "Washington", venue_state: "dc" }),
          game({ venue_name: "dunbar hs " }),
          game({ venue_name: "Coolidge HS" }),
        ],
      })
    );
    expect(d).toMatchObject({
      venueName: "Dunbar HS",
      venueAddress: "101 N St NW",
      venueCity: "Washington",
      venueState: "DC",
      venueZip: "",
      gamesElsewhere: 1,
    });
  });

  it("lists each court once, keeping the first spelling", () => {
    const d = tournamentDraftFromSchedule(
      schedule({
        games: [game({ court: "Court 1" }), game({ court: " court 1" }), game({ court: "Aux gym" }), game({ court: "" })],
      })
    );
    expect(d.courts).toEqual(["Court 1", "Aux gym"]);
  });

  it("caps the court list at 20", () => {
    const d = tournamentDraftFromSchedule(
      schedule({ games: Array.from({ length: 30 }, (_, i) => game({ court: `Court ${i + 1}` })) })
    );
    expect(d.courts).toHaveLength(20);
  });

  it("leaves everything blank for the director when the file says nothing about the event", () => {
    const d = tournamentDraftFromSchedule(schedule({ games: [game({ date: "" })] }));
    expect(d).toMatchObject({ name: "", venueName: "", venueAddress: "", venueZip: "", arrivalNotes: "" });
  });
});
