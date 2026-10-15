import { describe, expect, it, vi } from "vitest";
import { configureSupabase } from "@refee/core/client";

configureSupabase({} as never);

import { geocodeFirst, homeQueries, venueQueries } from "@refee/core/geo/geocode";

describe("homeQueries", () => {
  it("tries the ZIP before the city, since a city's centre can be miles from home", () => {
    expect(homeQueries({ city: "Houston", state: "TX", zip: "77007" })).toEqual([
      "77007, TX, USA",
      "Houston, TX, USA",
    ]);
  });

  it("uses only the city when there's no usable ZIP", () => {
    expect(homeQueries({ city: "Houston", state: "TX", zip: "" })).toEqual(["Houston, TX, USA"]);
    expect(homeQueries({ city: "Houston", state: "TX", zip: "7700" })).toEqual(["Houston, TX, USA"]);
    expect(homeQueries({ city: "Houston", state: "TX" })).toEqual(["Houston, TX, USA"]);
  });
});

describe("venueQueries", () => {
  it("tries the street address, then the ZIP, then the city", () => {
    expect(
      venueQueries({ venueAddress: "1 South Ave", venueZip: "78701", venueCity: "Austin", venueState: "TX" })
    ).toEqual(["1 South Ave, Austin, TX 78701, USA", "78701, TX, USA", "Austin, TX, USA"]);
  });
});

describe("geocodeFirst", () => {
  it("returns the first query that finds a place", async () => {
    const geocode = vi.fn(async (q: string) =>
      q.startsWith("77007") ? null : { lat: 29.76, lng: -95.37, timezone: "America/Chicago" }
    );
    expect(await geocodeFirst(["77007, TX, USA", "Houston, TX, USA"], geocode)).toEqual({
      lat: 29.76,
      lng: -95.37,
      timezone: "America/Chicago",
    });
    expect(geocode).toHaveBeenCalledTimes(2);
  });

  it("stops at the first hit", async () => {
    const geocode = vi.fn(async () => ({ lat: 1, lng: 2, timezone: null }));
    await geocodeFirst(["a", "b"], geocode);
    expect(geocode).toHaveBeenCalledTimes(1);
  });

  it("is null when nothing is found", async () => {
    expect(await geocodeFirst(["a"], async () => null)).toBeNull();
  });
});
