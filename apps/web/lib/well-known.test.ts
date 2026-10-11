import { describe, expect, it } from "vitest";
import { appleAppSiteAssociation, assetLinks } from "./well-known";

const FINGERPRINT =
  "14:6D:E9:83:C5:73:06:50:D8:EE:B9:95:2F:34:FC:64:16:A0:83:42:E6:1D:BE:A8:8A:04:96:B2:3F:CF:44:E5";

describe("appleAppSiteAssociation", () => {
  it("is absent until the Apple Team ID is set", () => {
    expect(appleAppSiteAssociation({})).toBeNull();
    expect(appleAppSiteAssociation({ APPLE_TEAM_ID: "  " })).toBeNull();
  });

  it("opens roster invite links in the app and allows passkeys for refee.app", () => {
    const file = appleAppSiteAssociation({ APPLE_TEAM_ID: "ABCDE12345" });
    expect(file).toEqual({
      applinks: {
        details: [
          {
            appIDs: ["ABCDE12345.com.refee.app"],
            components: [{ "/": "/join/*", comment: "Roster invites open in the app" }],
          },
        ],
      },
      webcredentials: { apps: ["ABCDE12345.com.refee.app"] },
    });
  });

  it("rejects something that isn't a Team ID rather than publishing a broken file", () => {
    expect(() => appleAppSiteAssociation({ APPLE_TEAM_ID: "com.refee.app" })).toThrow(/APPLE_TEAM_ID/);
  });
});

describe("assetLinks", () => {
  it("is absent until a signing fingerprint is set", () => {
    expect(assetLinks({})).toBeNull();
    expect(assetLinks({ ANDROID_CERT_SHA256: "" })).toBeNull();
  });

  it("trusts the app for links and for passkeys", () => {
    expect(assetLinks({ ANDROID_CERT_SHA256: FINGERPRINT })).toEqual([
      {
        relation: ["delegate_permission/common.handle_all_urls", "delegate_permission/common.get_login_creds"],
        target: {
          namespace: "android_app",
          package_name: "com.refee.app",
          sha256_cert_fingerprints: [FINGERPRINT],
        },
      },
    ]);
  });

  it("accepts several fingerprints and normalises how they were pasted", () => {
    const bare = FINGERPRINT.replace(/:/g, "").toLowerCase();
    const second = FINGERPRINT.replace("14:6D", "AA:BB");
    const file = assetLinks({ ANDROID_CERT_SHA256: ` ${bare} , ${second} ` });
    expect(file?.[0].target.sha256_cert_fingerprints).toEqual([FINGERPRINT, second]);
  });

  it("rejects a fingerprint that isn't SHA-256", () => {
    expect(() => assetLinks({ ANDROID_CERT_SHA256: "14:6D:E9" })).toThrow(/ANDROID_CERT_SHA256/);
  });
});
