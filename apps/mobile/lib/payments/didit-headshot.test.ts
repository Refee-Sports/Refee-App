import { describe, expect, it } from "vitest";
import { faceMatchOutcome, livenessReferenceImage } from "../../../../supabase/functions/_shared/didit";

describe("livenessReferenceImage", () => {
  it("takes the selfie from the first liveness check that has one", () => {
    expect(
      livenessReferenceImage({
        liveness_checks: [{ reference_image: null }, { reference_image: "https://media/ref.jpg?sig=1" }],
      })
    ).toBe("https://media/ref.jpg?sig=1");
  });

  it("accepts the webhook shape, wrapped in decision", () => {
    expect(livenessReferenceImage({ decision: { liveness_checks: [{ reference_image: "https://m/r.jpg" }] } })).toBe(
      "https://m/r.jpg"
    );
  });

  it("returns null when there is nothing to compare against", () => {
    expect(livenessReferenceImage({})).toBeNull();
    expect(livenessReferenceImage({ liveness_checks: [] })).toBeNull();
    expect(livenessReferenceImage({ liveness_checks: [{ reference_image: "" }] })).toBeNull();
  });
});

describe("faceMatchOutcome", () => {
  it("passes only when Didit approves", () => {
    expect(faceMatchOutcome({ face_match: { status: "Approved", score: 88.2 } })).toEqual({ matched: true, score: 88.2 });
    expect(faceMatchOutcome({ face_match: { status: "Declined", score: 12 } })).toEqual({ matched: false, score: 12 });
  });

  it("treats anything unexpected as no match", () => {
    expect(faceMatchOutcome(null)).toEqual({ matched: false, score: null });
    expect(faceMatchOutcome({ face_match: { status: "approved", score: "90" } })).toEqual({ matched: false, score: null });
  });
});
