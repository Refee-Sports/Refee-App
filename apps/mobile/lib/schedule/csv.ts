export const SCHEDULE_COLUMNS = [
  "home_team",
  "away_team",
  "date",
  "time",
  "timezone",
  "venue_name",
  "venue_city",
  "venue_state",
  "level",
  "crew_size",
  "pay_per_game",
  "duration_minutes",
  "age_group",
  "gender",
  "ruleset",
] as const;

export const SCHEDULE_CSV_TEMPLATE = `${SCHEDULE_COLUMNS.join(",")}\n` +
  `Lions,Tigers,2026-09-20,09:00,America/Chicago,Main Gym,Austin,TX,high_school,3,75,60,U18,boys,NFHS\n`;

export type ScheduleImportDefaults = {
  startsOn: string;
  endsOn: string;
  timezone: string;
  venueName?: string | null;
  venueCity?: string | null;
  venueState?: string | null;
  ruleset?: string | null;
  uniformRequirements?: string | null;
  gameFormat?: "quarters" | "halves" | null;
  periodMinutes?: number | null;
  rulesetModifications?: string | null;
};

export type ScheduleImportRow = {
  rowNumber: number;
  homeTeam: string;
  awayTeam: string;
  startsAt: string;
  venueName: string;
  venueCity: string;
  venueState: string;
  level: string;
  crewSize: number;
  payPerGame: number;
  durationMinutes: number;
  ageGroup: string | null;
  gender: string | null;
  ruleset: string | null;
  uniformRequirements: string | null;
  gameFormat: "quarters" | "halves" | null;
  periodMinutes: number | null;
  rulesetModifications: string | null;
};

export type ScheduleRowPreview = {
  rowNumber: number;
  homeTeam: string;
  awayTeam: string;
  localWhen: string;
  errors: string[];
  value: ScheduleImportRow | null;
};

export type ScheduleParseResult = {
  rows: ScheduleRowPreview[];
  validRows: ScheduleImportRow[];
  fileErrors: string[];
  canImport: boolean;
};

function parseCsvRecords(input: string): { records: string[][]; error: string | null } {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"' && field.length === 0) {
      quoted = true;
    } else if (char === ",") {
      record.push(field);
      field = "";
    } else if (char === "\n") {
      record.push(field.replace(/\r$/, ""));
      records.push(record);
      record = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (quoted) return { records: [], error: "The CSV contains an unclosed quoted field." };
  if (field.length > 0 || record.length > 0) {
    record.push(field.replace(/\r$/, ""));
    records.push(record);
  }
  return { records, error: null };
}

function isValidTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function partsAt(timestamp: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(timestamp));
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day"), hour: value("hour"), minute: value("minute") };
}

function sameParts(a: ReturnType<typeof partsAt>, b: ReturnType<typeof partsAt>) {
  return a.year === b.year && a.month === b.month && a.day === b.day && a.hour === b.hour && a.minute === b.minute;
}

export function localDateTimeToIso(date: string, time: string, timeZone: string): { iso: string | null; error: string | null } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { iso: null, error: "date must use YYYY-MM-DD" };
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return { iso: null, error: "time must use 24-hour HH:mm" };
  if (!isValidTimeZone(timeZone)) return { iso: null, error: "timezone must be a valid IANA name (for example America/Chicago)" };

  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const target = { year, month, day, hour, minute };
  const calendarCheck = new Date(Date.UTC(year, month - 1, day));
  if (calendarCheck.getUTCFullYear() !== year || calendarCheck.getUTCMonth() !== month - 1 || calendarCheck.getUTCDate() !== day) {
    return { iso: null, error: "date is not a real calendar date" };
  }

  const targetAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  let candidate = targetAsUtc;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const shown = partsAt(candidate, timeZone);
    const shownAsUtc = Date.UTC(shown.year, shown.month - 1, shown.day, shown.hour, shown.minute);
    candidate += targetAsUtc - shownAsUtc;
  }
  if (!sameParts(partsAt(candidate, timeZone), target)) {
    return { iso: null, error: "local time does not exist because of daylight saving time" };
  }
  if (sameParts(partsAt(candidate - 60 * 60 * 1000, timeZone), target) || sameParts(partsAt(candidate + 60 * 60 * 1000, timeZone), target)) {
    return { iso: null, error: "local time is ambiguous because of daylight saving time" };
  }
  return { iso: new Date(candidate).toISOString(), error: null };
}

function positiveInteger(value: string, field: string, min: number, max: number, errors: string[]) {
  const parsed = Number(value);
  if (!/^\d+$/.test(value) || !Number.isInteger(parsed) || parsed < min || parsed > max) {
    errors.push(`${field} must be a whole number from ${min} to ${max}`);
    return null;
  }
  return parsed;
}

export function parseScheduleCsv(csv: string, defaults: ScheduleImportDefaults): ScheduleParseResult {
  const normalized = csv.replace(/^\uFEFF/, "");
  const { records, error } = parseCsvRecords(normalized);
  if (error) return { rows: [], validRows: [], fileErrors: [error], canImport: false };
  const nonBlank = records.filter((record) => record.some((cell) => cell.trim().length > 0));
  if (nonBlank.length === 0) return { rows: [], validRows: [], fileErrors: ["The CSV is empty."], canImport: false };

  const header = nonBlank[0].map((cell) => cell.trim().toLowerCase());
  const duplicates = header.filter((name, index) => header.indexOf(name) !== index);
  const missing = SCHEDULE_COLUMNS.filter((column) => !header.includes(column));
  const fileErrors: string[] = [];
  if (duplicates.length > 0) fileErrors.push(`Duplicate column: ${[...new Set(duplicates)].join(", ")}.`);
  if (missing.length > 0) fileErrors.push(`Missing columns: ${missing.join(", ")}. Download a fresh template.`);
  if (fileErrors.length > 0) return { rows: [], validRows: [], fileErrors, canImport: false };

  const index = Object.fromEntries(header.map((name, i) => [name, i]));
  const seen = new Set<string>();
  const rows = nonBlank.slice(1).map((record, dataIndex): ScheduleRowPreview => {
    const rowNumber = dataIndex + 2;
    const get = (name: typeof SCHEDULE_COLUMNS[number]) => (record[index[name]] ?? "").trim();
    const errors: string[] = [];
    const homeTeam = get("home_team");
    const awayTeam = get("away_team");
    const date = get("date");
    const time = get("time");
    const timezone = get("timezone") || defaults.timezone;
    const venueName = get("venue_name") || defaults.venueName?.trim() || "";
    const venueCity = get("venue_city") || defaults.venueCity?.trim() || "";
    const venueState = (get("venue_state") || defaults.venueState?.trim() || "").toUpperCase();
    const level = get("level");
    const ruleset = get("ruleset") || defaults.ruleset?.trim() || null;

    if (!homeTeam) errors.push("home_team is required");
    if (!awayTeam) errors.push("away_team is required");
    if (homeTeam && awayTeam && homeTeam.toLowerCase() === awayTeam.toLowerCase()) errors.push("home_team and away_team must differ");
    if (!level) errors.push("level is required");
    if (!venueName) errors.push("venue_name is required when the tournament has no default");
    if (!venueCity) errors.push("venue_city is required when the tournament has no default");
    if (!/^[A-Z]{2}$/.test(venueState)) errors.push("venue_state must be a 2-letter code");
    if (!date) errors.push("date is required");
    else if (date < defaults.startsOn || date > defaults.endsOn) errors.push(`date must be between ${defaults.startsOn} and ${defaults.endsOn}`);

    const crewSize = positiveInteger(get("crew_size"), "crew_size", 1, 5, errors);
    const payPerGame = positiveInteger(get("pay_per_game"), "pay_per_game", 1, 10000, errors);
    const durationMinutes = positiveInteger(get("duration_minutes"), "duration_minutes", 15, 480, errors);
    const converted = localDateTimeToIso(date, time, timezone);
    if (converted.error) errors.push(converted.error);

    const dedupeKey = `${homeTeam.toLowerCase()}|${awayTeam.toLowerCase()}|${date}|${time}|${venueName.toLowerCase()}`;
    if (seen.has(dedupeKey)) errors.push("duplicate game in this file");
    seen.add(dedupeKey);

    const value = errors.length === 0 && converted.iso && crewSize && payPerGame && durationMinutes ? {
      rowNumber,
      homeTeam,
      awayTeam,
      startsAt: converted.iso,
      venueName,
      venueCity,
      venueState,
      level,
      crewSize,
      payPerGame,
      durationMinutes,
      ageGroup: get("age_group") || null,
      gender: get("gender") || null,
      ruleset,
      uniformRequirements: defaults.uniformRequirements?.trim() || null,
      gameFormat: defaults.gameFormat ?? null,
      periodMinutes: defaults.periodMinutes ?? null,
      rulesetModifications: defaults.rulesetModifications?.trim() || null,
    } : null;

    return { rowNumber, homeTeam, awayTeam, localWhen: `${date} ${time} ${timezone}`.trim(), errors, value };
  });

  if (rows.length === 0) fileErrors.push("The CSV contains headers but no games.");
  if (rows.length > 500) fileErrors.push("A single import can contain at most 500 games.");
  const validRows = rows.flatMap((row) => row.value ? [row.value] : []);
  return { rows, validRows, fileErrors, canImport: fileErrors.length === 0 && validRows.length === rows.length && rows.length > 0 };
}
