import { describe, expect, it } from "vitest";
import {
  ageInYears,
  dateOfBirthError,
  isAdult,
  latestAdultBirthDate,
  parseDateOfBirth,
  usDateInput,
} from "@refee/core/identity/age";
import {
  extractDateOfBirth,
  isKnownMinor,
  isAdult as isAdultServer,
} from "../../../../supabase/functions/_shared/didit";

// A fixed "today" so these never drift with the calendar.
const NOW = new Date(Date.UTC(2026, 8, 19)); // 2026-09-19

describe("reading a date of birth", () => {
  it("accepts a real date and rejects a malformed one", () => {
    expect(parseDateOfBirth("1990-06-15")?.toISOString().slice(0, 10)).toBe("1990-06-15");
    expect(parseDateOfBirth("15/06/1990")).toBeNull();
    expect(parseDateOfBirth("1990-6-5")).toBeNull();
    expect(parseDateOfBirth("")).toBeNull();
  });

  it("rejects days that don't exist rather than rolling them forward", () => {
    expect(parseDateOfBirth("2001-02-30")).toBeNull();
    expect(parseDateOfBirth("2001-13-01")).toBeNull();
    expect(parseDateOfBirth("2000-02-29")).not.toBeNull(); // a real leap day
    expect(parseDateOfBirth("2001-02-29")).toBeNull(); // not a leap year
  });
});

describe("age", () => {
  it("counts whole years", () => {
    expect(ageInYears("2000-09-19", NOW)).toBe(26);
    expect(ageInYears("2006-09-19", NOW)).toBe(20);
  });

  it("turns 18 on the birthday, not the day before", () => {
    expect(isAdult("2008-09-20", NOW)).toBe(false); // 18 tomorrow
    expect(isAdult("2008-09-19", NOW)).toBe(true); // 18 today
    expect(isAdult("2008-09-18", NOW)).toBe(true);
  });

  it("handles a birthday later in the current month", () => {
    expect(ageInYears("2008-09-30", NOW)).toBe(17);
    expect(isAdult("2008-09-30", NOW)).toBe(false);
  });

  it("handles a leap-day birthday", () => {
    expect(isAdult("2008-02-29", NOW)).toBe(true);
    expect(isAdult("2009-02-28", NOW)).toBe(false);
  });
});

describe("what the form tells someone", () => {
  it("says nothing about an empty field", () => {
    expect(dateOfBirthError("", NOW)).toBeNull();
    expect(dateOfBirthError("   ", NOW)).toBeNull();
  });

  it("explains a malformed date", () => {
    expect(dateOfBirthError("06/15/1990", NOW)).toBe("Enter your date of birth as YYYY-MM-DD.");
  });

  it("refuses under 18 plainly", () => {
    expect(dateOfBirthError("2010-01-01", NOW)).toBe("You must be 18 or older to use Refee.");
  });

  it("flags a date that can't be right", () => {
    expect(dateOfBirthError("2030-01-01", NOW)).toBe("Check that date — it doesn't look right.");
    expect(dateOfBirthError("1800-01-01", NOW)).toBe("Check that date — it doesn't look right.");
  });

  it("passes an adult", () => {
    expect(dateOfBirthError("1990-06-15", NOW)).toBeNull();
  });

  it("offers the date input a max of exactly 18 years ago", () => {
    expect(latestAdultBirthDate(NOW)).toBe("2008-09-19");
    expect(isAdult(latestAdultBirthDate(NOW), NOW)).toBe(true);
  });
});

describe("the date of birth Didit read off the ID", () => {
  // Every feature report is a plural array — id_verifications[0], never
  // id_verification. Getting this wrong finds nothing, and "no date" means
  // "not a known minor", so the age check would quietly pass everyone.
  const webhook = (idv: unknown[]) => ({
    session_id: "sess_1",
    status: "Approved",
    vendor_data: "user-42",
    decision: { id_verifications: idv },
  });

  it("reads it from the OCR report", () => {
    expect(extractDateOfBirth(webhook([{ node_id: "feature_ocr_1", date_of_birth: "1980-01-01" }])))
      .toBe("1980-01-01");
  });

  it("reads the same shape from the decision endpoint, which has no envelope", () => {
    expect(extractDateOfBirth({ id_verifications: [{ date_of_birth: "1975-12-31" }] }))
      .toBe("1975-12-31");
  });

  it("falls back to the passport chip", () => {
    expect(extractDateOfBirth({
      decision: {
        id_verifications: [{ node_id: "ocr", document_type: "Passport" }],
        nfc_verifications: [{ chip_data: { birth_date: "1988-02-03" } }],
      },
    })).toBe("1988-02-03");
  });

  it("falls back to a digital wallet's attributes", () => {
    expect(extractDateOfBirth({
      decision: {
        id_verifications: [
          { verification_method: "wallet", wallet_verification: { attributes: { date_of_birth: "1993-07-08" } } },
        ],
      },
    })).toBe("1993-07-08");
  });

  it("skips entries with no date and takes the first that has one", () => {
    expect(extractDateOfBirth(webhook([
      { node_id: "a" },
      { node_id: "b", date_of_birth: "1991-05-06" },
    ]))).toBe("1991-05-06");
  });

  it("trims a full timestamp down to the date", () => {
    expect(extractDateOfBirth(webhook([{ date_of_birth: "1990-06-15T00:00:00Z" }]))).toBe("1990-06-15");
  });

  it("returns null rather than guessing", () => {
    expect(extractDateOfBirth({})).toBeNull();
    expect(extractDateOfBirth(webhook([]))).toBeNull();
    expect(extractDateOfBirth(webhook([{ node_id: "a" }]))).toBeNull();
    expect(extractDateOfBirth(webhook([{ date_of_birth: "15 June 1990" }]))).toBeNull();
    expect(extractDateOfBirth(webhook([{ date_of_birth: 19900615 }]))).toBeNull();
    // A singular key is not the schema; reading it would be a false positive.
    expect(extractDateOfBirth({ decision: { id_verification: { date_of_birth: "1980-01-01" } } })).toBeNull();
  });

  it("declines only a date it can read that is too young", () => {
    expect(isKnownMinor("2010-01-01", NOW)).toBe(true);
    expect(isKnownMinor("1990-01-01", NOW)).toBe(false);
    // Unknown is not "too young" — it's unknown. The webhook holds those for
    // review instead of approving them.
    expect(isKnownMinor(null, NOW)).toBe(false);
    expect(isKnownMinor("not a date", NOW)).toBe(false);
    expect(isAdultServer(null, NOW)).toBe(false);
  });
});

describe("typing a date on a phone keypad", () => {
  it("adds the slashes as you go", () => {
    expect(usDateInput("0").display).toBe("0");
    expect(usDateInput("06").display).toBe("06");
    expect(usDateInput("061").display).toBe("06/1");
    expect(usDateInput("0615").display).toBe("06/15");
    expect(usDateInput("06151990").display).toBe("06/15/1990");
  });

  it("only yields a date once all eight digits are there", () => {
    expect(usDateInput("0615199").iso).toBe("");
    expect(usDateInput("06151990").iso).toBe("1990-06-15");
  });

  it("ignores anything that isn't a digit, and stops at eight", () => {
    expect(usDateInput("06/15/1990").iso).toBe("1990-06-15");
    expect(usDateInput("061519901234").iso).toBe("1990-06-15");
    expect(usDateInput("abc").display).toBe("");
  });

  it("hands a nonsense date to the same judgement as the web field", () => {
    expect(dateOfBirthError(usDateInput("02302001").iso, NOW)).toBe(
      "Enter your date of birth as YYYY-MM-DD."
    );
  });
});
