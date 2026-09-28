import { describe, expect, it } from "vitest";
import { normalizeAccountMethods } from "@refee/core/account/queries";

describe("normalizeAccountMethods", () => {
  it("shows phone, Google and Apple on one linked account", () => {
    expect(
      normalizeAccountMethods([
        { id: "phone-id", provider: "phone" },
        { id: "google-id", provider: "google" },
        { id: "apple-id", provider: "apple" },
      ]).map((method) => method.provider)
    ).toEqual(["phone", "google", "apple"]);
  });

  it("adds the session phone when GoTrue does not return a phone identity", () => {
    expect(normalizeAccountMethods([], { phone: "+15555550100" })).toEqual([
      { id: "phone", provider: "phone", label: "Phone code" },
    ]);
  });

  it("deduplicates provider identities without inventing an email method", () => {
    expect(
      normalizeAccountMethods(
        [
          { id: "first", provider: "google" },
          { id: "second", provider: "google" },
        ]
      ).map((method) => method.provider)
    ).toEqual(["google"]);
  });

  it("ignores providers Refee does not offer", () => {
    expect(normalizeAccountMethods([{ id: "github", provider: "github" }])).toEqual([]);
  });
});
