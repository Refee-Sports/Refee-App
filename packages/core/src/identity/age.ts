// Refee is 18+: being paid, entering a contract, and working around other
// people's children all are. This is the apps' half of that rule — it keeps
// someone from filling in a whole profile before being told. The database
// (migration 0043) is what actually refuses, and Didit's reading of a
// government ID is what finally settles it.

export const MINIMUM_AGE = 18;

/** A date of birth as the forms hold it: YYYY-MM-DD, or null while incomplete. */
export type DateOfBirth = string | null;

/** Parses YYYY-MM-DD strictly — no rolled-over days, no two-digit years. */
export function parseDateOfBirth(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  // Rejects the 31st of February and friends, which Date would roll forward.
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

/** Whole years old on `asOf`. Null for anything that isn't a real date. */
export function ageInYears(value: string, asOf: Date = new Date()): number | null {
  const dob = parseDateOfBirth(value);
  if (!dob) return null;
  let age = asOf.getUTCFullYear() - dob.getUTCFullYear();
  const monthDiff = asOf.getUTCMonth() - dob.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && asOf.getUTCDate() < dob.getUTCDate())) {
    age -= 1;
  }
  return age;
}

export function isAdult(value: string, asOf: Date = new Date()): boolean {
  const age = ageInYears(value, asOf);
  return age !== null && age >= MINIMUM_AGE;
}

/**
 * What to tell someone about the date they entered, or null when it's fine.
 * Blank returns null — an empty field isn't an error until they try to move on.
 */
export function dateOfBirthError(value: string, asOf: Date = new Date()): string | null {
  if (value.trim() === "") return null;
  const age = ageInYears(value, asOf);
  if (age === null) return "Enter your date of birth as YYYY-MM-DD.";
  if (age < 0 || age > 120) return "Check that date — it doesn't look right.";
  if (age < MINIMUM_AGE) return "You must be 18 or older to use Refee.";
  return null;
}

/** The latest date of birth that is old enough — for a date input's `max`. */
export function latestAdultBirthDate(asOf: Date = new Date()): string {
  const d = new Date(
    Date.UTC(asOf.getUTCFullYear() - MINIMUM_AGE, asOf.getUTCMonth(), asOf.getUTCDate())
  );
  return d.toISOString().slice(0, 10);
}

/**
 * Digits typed in US order (MMDDYYYY) → what to show while typing, and the
 * ISO date once it's complete. For the app, which has no date picker: a
 * numeric keypad plus this is less fuss than a native module, and the same
 * arithmetic above judges the result.
 */
export function usDateInput(raw: string): { display: string; iso: string } {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  const mm = digits.slice(0, 2);
  const dd = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);

  let display = mm;
  if (digits.length > 2) display += `/${dd}`;
  if (digits.length > 4) display += `/${yyyy}`;

  return { display, iso: digits.length === 8 ? `${yyyy}-${mm}-${dd}` : "" };
}
