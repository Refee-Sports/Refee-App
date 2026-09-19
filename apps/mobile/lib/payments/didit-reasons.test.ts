import { describe, expect, it } from "vitest";
import { lastReason, reviewReason } from "../../../../supabase/functions/_shared/didit";

// Shaped exactly like a real sandbox decision; the dates are made up.
const warning = (risk: string, log_type = "warning", short_description?: string) => ({
  feature: "ID_VERIFICATION",
  risk,
  log_type,
  short_description,
  additional_data: { expected_dob: "1980-01-01", extracted_dob: "1970-02-02" },
  node_id: "feature_ocr",
});
const decision = (idWarnings: unknown[], extra: Record<string, unknown> = {}) => ({
  session_id: "s1",
  status: "In Review",
  vendor_data: "user-1",
  decision: {
    id_verifications: [{ status: "In Review", warnings: idWarnings }],
    liveness_checks: [{ status: "Approved", warnings: [] }],
    face_matches: [{ status: "Approved", warnings: [] }],
    ...extra,
  },
});

describe("why a check went to review", () => {
  it("explains a date-of-birth mismatch in plain words", () => {
    expect(reviewReason(decision([warning("DOB_MISMATCH_WITH_PROVIDED")]))).toBe(
      "The date of birth on your ID doesn't match the one you entered at sign-up."
    );
  });

  it("never repeats the details being compared", () => {
    const text = reviewReason(decision([warning("DOB_MISMATCH_WITH_PROVIDED")])) ?? "";
    expect(text).not.toMatch(/1980|1970/);
  });

  it("ignores notices that aren't reasons", () => {
    expect(reviewReason(decision([
      warning("UNPARSED_ADDRESS", "information"),
      warning("BARCODE_NOT_DETECTED", "information"),
    ]))).toBeNull();
  });

  it("picks the most consequential warning when there are several", () => {
    const body = decision([warning("DOB_MISMATCH_WITH_PROVIDED")], {
      liveness_checks: [{ status: "In Review", warnings: [warning("DUPLICATED_FACE_NAME_MISMATCH")] }],
    });
    expect(reviewReason(body)).toBe("This ID or face is already linked to another Refee account.");
  });

  it("reads a decision without the webhook envelope too", () => {
    expect(reviewReason({ id_verifications: [{ warnings: [warning("IMAGE_TOO_BLURRY")] }] })).toBe(
      "The photo of your ID was too blurry to read."
    );
  });

  it("falls back to Didit's own description for a code it doesn't know", () => {
    expect(reviewReason(decision([warning("SOMETHING_NEW", "warning", "Document needs a closer look")])))
      .toBe("Document needs a closer look");
    expect(reviewReason(decision([warning("SOMETHING_NEW")]))).toBe("Your ID needs a manual check.");
  });
});

describe("the reason Refee records", () => {
  const body = decision([warning("DOB_MISMATCH_WITH_PROVIDED")]);

  it("says plainly when someone is under 18", () => {
    expect(lastReason({ decided: "declined", minor: true, ageUnknown: false, body }))
      .toBe("You must be 18 or older to use Refee.");
  });

  it("says when no age could be read", () => {
    expect(lastReason({ decided: "in_review", minor: false, ageUnknown: true, body }))
      .toBe("We couldn't read the date of birth on your ID.");
  });

  it("clears once someone is approved, whatever warnings came with it", () => {
    expect(lastReason({ decided: "approved", minor: false, ageUnknown: false, body })).toBeNull();
  });

  it("uses Didit's warnings for a review or decline", () => {
    expect(lastReason({ decided: "in_review", minor: false, ageUnknown: false, body })).toMatch(/date of birth/);
  });

  it("falls back to a reason Didit gave directly", () => {
    const plain = { status: "Declined", decision: { reason: "Document expired" } };
    expect(lastReason({ decided: "declined", minor: false, ageUnknown: false, body: plain })).toBe("Document expired");
  });
});
