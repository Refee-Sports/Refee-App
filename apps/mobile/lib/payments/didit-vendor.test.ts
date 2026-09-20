import { describe, expect, it } from "vitest";
import { vendorUserId } from "../../../../supabase/functions/_shared/didit";

describe("working out whose check a webhook is about", () => {
  it("accepts a Refee user id", () => {
    expect(vendorUserId({ vendor_data: "7239f5e0-b198-4300-84f6-d472f4902562" }))
      .toBe("7239f5e0-b198-4300-84f6-d472f4902562");
    expect(vendorUserId({ vendor_data: "  7239F5E0-B198-4300-84F6-D472F4902562  " }))
      .toBe("7239F5E0-B198-4300-84F6-D472F4902562");
  });

  it("treats a session made outside Refee as not ours, rather than crashing on it", () => {
    // Didit's own getting-started flow sends exactly this.
    expect(vendorUserId({ vendor_data: "getting-started" })).toBeNull();
    expect(vendorUserId({ vendor_data: "refee-prod-config-check" })).toBeNull();
    expect(vendorUserId({ vendor_data: "" })).toBeNull();
    expect(vendorUserId({ vendor_data: 42 })).toBeNull();
    expect(vendorUserId({})).toBeNull();
  });
});
