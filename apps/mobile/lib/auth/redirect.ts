/** Parses both PKCE query params and legacy token fragments from an auth callback URL. */
export function extractAuthParams(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  const hashIdx = url.indexOf("#");
  if (hashIdx >= 0) {
    new URLSearchParams(url.slice(hashIdx + 1)).forEach((value, key) => {
      out[key] = value;
    });
  }
  const queryIdx = url.indexOf("?");
  if (queryIdx >= 0 && (hashIdx < 0 || queryIdx < hashIdx)) {
    const query = url.slice(queryIdx + 1).split("#")[0];
    new URLSearchParams(query).forEach((value, key) => {
      out[key] = value;
    });
  }
  return out;
}
