import { describe, expect, it } from "vitest";
import { extractAuthParams } from "./redirect";

describe("extractAuthParams", () => {
  it("reads a PKCE authorization code", () => {
    expect(extractAuthParams("refee://auth/callback?code=abc%20123")).toEqual({ code: "abc 123" });
  });

  it("reads a hashed email OTP callback", () => {
    expect(extractAuthParams("refee://auth/callback?token_hash=token&type=magiclink")).toEqual({
      token_hash: "token",
      type: "magiclink",
    });
  });

  it("reads legacy session tokens from the fragment", () => {
    expect(extractAuthParams("refee://auth/callback#access_token=a&refresh_token=r")).toEqual({
      access_token: "a",
      refresh_token: "r",
    });
  });
});
