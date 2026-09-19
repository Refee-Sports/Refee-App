import { describe, expect, it } from "vitest";
import { expectedDetails } from "../../../../supabase/functions/_shared/didit";

describe("what Refee asks Didit to check the ID against", () => {
  it("sends the last name and date of birth", () => {
    expect(expectedDetails({ legal_last_name: "Gatling", date_of_birth: "1990-06-15" }))
      .toEqual({ last_name: "Gatling", date_of_birth: "1990-06-15" });
  });

  it("never sends a first name — nicknames would send honest people to review", () => {
    const sent = expectedDetails({ legal_last_name: "Rivera", date_of_birth: "1992-06-15" });
    expect(sent).not.toHaveProperty("first_name");
  });

  it("trims the name and leaves out anything blank rather than sending it empty", () => {
    expect(expectedDetails({ legal_last_name: "  Kim ", date_of_birth: null })).toEqual({ last_name: "Kim" });
    expect(expectedDetails({ legal_last_name: "   ", date_of_birth: "1993-04-17" }))
      .toEqual({ date_of_birth: "1993-04-17" });
  });

  it("normalises a timestamp down to the date Didit expects", () => {
    expect(expectedDetails({ legal_last_name: null, date_of_birth: "1993-04-17T00:00:00Z" }))
      .toEqual({ date_of_birth: "1993-04-17" });
  });

  it("sends nothing for an account from before sign-up collected these", () => {
    expect(expectedDetails({ legal_last_name: null, date_of_birth: null })).toBeNull();
    expect(expectedDetails(null)).toBeNull();
  });
});
