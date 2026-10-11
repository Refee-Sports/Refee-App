/**
 * The two files that tie refee.app to the mobile app, served from /.well-known/.
 * They make refee.app/join/<code> links open the app, and they're what passkeys
 * check before trusting the app with credentials for refee.app.
 *
 * Both come from environment variables so they can be filled in without a code change:
 *   APPLE_TEAM_ID        10-character Team ID (developer.apple.com → Membership)
 *   ANDROID_CERT_SHA256  Play Console → App integrity → App signing: the *app signing* key's
 *                        SHA-256 (comma-separate to add the upload key too)
 * Until a value is set the file is absent (404). Apple caches what it fetches, so a
 * placeholder would do more harm than no file.
 */

const BUNDLE_ID = "com.refee.app";

type Env = Record<string, string | undefined>;

export function appleAppSiteAssociation(env: Env) {
  const teamId = env.APPLE_TEAM_ID?.trim();
  if (!teamId) return null;
  if (!/^[A-Z0-9]{10}$/.test(teamId)) {
    throw new Error(`APPLE_TEAM_ID should be 10 letters/digits, got "${teamId}"`);
  }
  const appId = `${teamId}.${BUNDLE_ID}`;
  return {
    applinks: {
      details: [
        {
          appIDs: [appId],
          components: [{ "/": "/join/*", comment: "Roster invites open in the app" }],
        },
      ],
    },
    webcredentials: { apps: [appId] },
  };
}

export function assetLinks(env: Env) {
  const raw = env.ANDROID_CERT_SHA256?.trim();
  if (!raw) return null;
  const fingerprints = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(normaliseFingerprint);
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls", "delegate_permission/common.get_login_creds"],
      target: {
        namespace: "android_app",
        package_name: BUNDLE_ID,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];
}

function normaliseFingerprint(value: string) {
  const hex = value.replace(/:/g, "").toUpperCase();
  if (!/^[0-9A-F]{64}$/.test(hex)) {
    throw new Error(`ANDROID_CERT_SHA256 should be a SHA-256 fingerprint (32 bytes), got "${value}"`);
  }
  return hex.match(/../g)!.join(":");
}
