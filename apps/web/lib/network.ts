// Turns "the request never made it" failures into one message people can act
// on. Supabase outages, dropped Wi-Fi and our 20s request limit all surface as
// fetch/abort/gateway errors whose raw text means nothing to a director.

export const REACH_ERROR = "Couldn't reach Refee's servers. This is usually brief — try again in a moment.";

const NETWORK_FAILURE =
  /failed to fetch|fetch failed|networkerror|network request failed|load failed|abort|timed out|timeout|\b50[234]\b|bad gateway|gateway time-?out|service unavailable/i;

export function friendlyLoadError(message?: string | null): string {
  if (!message || !message.trim() || NETWORK_FAILURE.test(message)) return REACH_ERROR;
  return message;
}

/**
 * How long a page's load may take in total. Each request already gives up
 * after 20s, but a load chains several, so the page needs its own deadline.
 */
export const LOAD_DEADLINE_MS = 20_000;

/** Rejects with "Request timed out" if `work` hasn't settled within `ms`. */
export function withDeadline<T>(work: Promise<T>, ms: number = LOAD_DEADLINE_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Request timed out")), ms);
  });
  return Promise.race([work, deadline]).finally(() => clearTimeout(timer));
}
