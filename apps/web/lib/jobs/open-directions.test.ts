import { afterEach, describe, expect, it, vi } from "vitest";
import { appleMapsUrl, googleMapsUrl, openVenueDirections } from "./open-directions";

const adelphi = { name: "Adelphi University", address: "1 South Ave, Garden City, NY 11530" };

describe("map links", () => {
  it("routes to the exact pin when the venue has one", () => {
    const v = { ...adelphi, lat: 40.7197638, lng: -73.6519719 };
    expect(appleMapsUrl(v)).toBe("https://maps.apple.com/?daddr=40.7197638,-73.6519719&q=Adelphi%20University");
    expect(googleMapsUrl(v)).toBe("https://www.google.com/maps/dir/?api=1&destination=40.7197638,-73.6519719");
  });

  it("searches by name and street when there's no pin", () => {
    const q = "Adelphi%20University%2C%201%20South%20Ave%2C%20Garden%20City%2C%20NY%2011530";
    expect(appleMapsUrl(adelphi)).toBe(`https://maps.apple.com/?q=${q}`);
    expect(googleMapsUrl(adelphi)).toBe(`https://www.google.com/maps/search/?api=1&query=${q}`);
  });

  it("searches by name alone when only the city is known", () => {
    expect(googleMapsUrl({ name: "Main Gym", address: null })).toBe(
      "https://www.google.com/maps/search/?api=1&query=Main%20Gym"
    );
  });

  it("treats a pin at 0,0 as a real pin but half a pin as none", () => {
    expect(googleMapsUrl({ name: "X", address: null, lat: 0, lng: 0 })).toContain("destination=0,0");
    expect(googleMapsUrl({ name: "X", address: null, lat: 40.7, lng: null })).toContain("/maps/search/");
  });

  it("encodes characters that would otherwise break the URL", () => {
    const url = googleMapsUrl({ name: "St. Mary's Gym #2 & Annex", address: "5 Elm St?x=1" });
    const query = url.split("query=")[1];
    expect(query).not.toMatch(/[#&?=]/);
    expect(decodeURIComponent(query)).toBe("St. Mary's Gym #2 & Annex, 5 Elm St?x=1");
  });
});

describe("openVenueDirections", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("opens Google Maps in a new tab without giving it access to Refee", () => {
    const open = vi.fn();
    vi.stubGlobal("window", { open });
    openVenueDirections("Main Gym", "1 South Ave");
    expect(open).toHaveBeenCalledWith(
      "https://www.google.com/maps/search/?api=1&query=Main%20Gym%2C%201%20South%20Ave",
      "_blank",
      "noopener,noreferrer"
    );
  });
});
