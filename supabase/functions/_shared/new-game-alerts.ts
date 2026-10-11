// The words of a new-game alert, and the small helpers around sending them.
// Pure on purpose: no Deno, no network, so the apps' test suites can run it.

export type AlertJob = {
  id: string;
  title: string;
  starts_at: string;
  timezone: string | null;
  pay_per_game: number | null;
  /** Miles from the referee's home to the venue, when both are on the map. */
  distanceMiles: number | null;
};

export type AlertNotification = {
  title: string;
  body: string;
  data: { type: "new_game"; jobId: string } | { type: "new_games" };
};

const DEFAULT_TIME_ZONE = "America/Chicago";
const MAX_TITLE = 60;

function format(iso: string, tz: string | null, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone: tz || DEFAULT_TIME_ZONE })
    .format(new Date(iso))
    // Newer ICU puts a narrow no-break space before AM/PM; a plain one reads the same and compares simply.
    .replace(/ /g, " ");
}

const day = (job: AlertJob) => format(job.starts_at, job.timezone, { weekday: "short", month: "short", day: "numeric" });
const time = (job: AlertJob) => format(job.starts_at, job.timezone, { hour: "numeric", minute: "2-digit" });

function shorten(text: string): string {
  return text.length <= MAX_TITLE ? text : `${text.slice(0, MAX_TITLE - 1)}…`;
}

/** One notification for everything a person is being told about. */
export function buildNewGameNotification(jobs: AlertJob[]): AlertNotification {
  const sorted = [...jobs].sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));

  if (sorted.length === 1) {
    const [only] = sorted;
    const parts = [shorten(only.title), day(only), time(only)];
    if (only.pay_per_game != null) parts.push(`$${only.pay_per_game}`);
    if (only.distanceMiles != null) parts.push(`${Math.round(only.distanceMiles)} mi`);
    return {
      title: "New game near you",
      body: parts.join(" · "),
      data: { type: "new_game", jobId: only.id },
    };
  }

  const parts = [`First on ${day(sorted[0])}`];
  const pays = sorted.map((j) => j.pay_per_game).filter((p): p is number => p != null);
  if (pays.length > 0) {
    const low = Math.min(...pays);
    const high = Math.max(...pays);
    parts.push(low === high ? `$${low}` : `$${low}–$${high}`);
  }
  const miles = sorted.map((j) => j.distanceMiles).filter((m): m is number => m != null);
  if (miles.length > 0) parts.push(`nearest ${Math.round(Math.min(...miles))} mi`);

  return {
    title: `${sorted.length} new games match your preferences`,
    body: parts.join(" · "),
    data: { type: "new_games" },
  };
}

/** Rows of (person, game, distance) → each person's games, in the order given. */
export function groupAlertsByUser(
  rows: { userId: string; jobId: string; miles: number | null }[]
): Map<string, { jobId: string; miles: number | null }[]> {
  const byUser = new Map<string, { jobId: string; miles: number | null }[]>();
  for (const row of rows) {
    const list = byUser.get(row.userId) ?? [];
    list.push({ jobId: row.jobId, miles: row.miles });
    byUser.set(row.userId, list);
  }
  return byUser;
}

/** Batches no bigger than `size`, for APIs that cap a request. */
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
