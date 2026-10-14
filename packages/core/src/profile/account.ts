import { supabase } from "../client";
import { geocodeAddress } from "../geo/geocode";
import { isServiceRegion, REGION_CODE_ERROR } from "../geo/regions";
import { ORG_TYPES } from "../roles/queries";

// Editing the details people gave at sign-up. Referees have their own fuller
// screen (updateFullProfile); these cover directors, assignors, and the legal
// name and birthday every role gives for the ID check.

type Result = { error: Error | null };

const fail = (message: string): Result => ({ error: new Error(message) });

/** From the moment Didit is checking the ID, the name and birthday it checks against are fixed (0067). */
export function isIdentityLocked(status: string | null | undefined): boolean {
  return status === "in_review" || status === "approved";
}

export type LegalIdentity = {
  legalFirstName: string;
  legalLastName: string;
  dateOfBirth: string;
  locked: boolean;
};

export async function fetchMyLegalIdentity(
  userId: string
): Promise<{ identity: LegalIdentity | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("private_profiles")
    .select("legal_first_name, legal_last_name, date_of_birth, identity_status")
    .eq("id", userId)
    .maybeSingle();
  if (error) return { identity: null, error: new Error(error.message) };
  if (!data) return { identity: null, error: null };
  return {
    identity: {
      legalFirstName: data.legal_first_name ?? "",
      legalLastName: data.legal_last_name ?? "",
      dateOfBirth: data.date_of_birth ?? "",
      locked: isIdentityLocked(data.identity_status),
    },
    error: null,
  };
}

/** True for a real calendar date written YYYY-MM-DD. */
function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export async function updateLegalIdentity(
  userId: string,
  args: { legalFirstName: string; legalLastName: string; dateOfBirth: string }
): Promise<Result> {
  const first = args.legalFirstName.trim();
  const last = args.legalLastName.trim();
  if (!first) return fail("Enter your legal first name.");
  if (!last) return fail("Enter your legal last name.");
  if (!isIsoDate(args.dateOfBirth)) return fail("Enter a valid date of birth.");

  // The database refuses under-18s (0043) and changes once the ID is locked (0067).
  const { error } = await supabase
    .from("private_profiles")
    .update({ legal_first_name: first, legal_last_name: last, date_of_birth: args.dateOfBirth })
    .eq("id", userId);
  return { error: error ? new Error(error.message) : null };
}

/** Shared checks for the public name and place every profile shows. */
function cleanPublicDetails(args: { firstName: string; lastInitial: string; city: string; state: string }) {
  const first_name = args.firstName.trim();
  const last_initial = args.lastInitial.trim().slice(0, 1).toUpperCase();
  const city = args.city.trim();
  const state = args.state.trim().toUpperCase();
  if (!first_name) return { error: "Enter your first name." } as const;
  if (!/^[A-Z]$/.test(last_initial)) return { error: "Enter your last initial." } as const;
  if (!city) return { error: "Enter your city." } as const;
  if (!isServiceRegion(state)) return { error: REGION_CODE_ERROR } as const;
  return { values: { first_name, last_initial, city, state } } as const;
}

/** Writes the public profile, then re-pins home so a referee feed measures from the new city. */
async function savePublicDetails(
  userId: string,
  values: { first_name: string; last_initial: string; city: string; state: string }
): Promise<Result> {
  const { error } = await supabase.from("public_profiles").update(values).eq("id", userId);
  if (error) return { error: new Error(error.message) };

  const home = await geocodeAddress(`${values.city}, ${values.state}, USA`);
  const { error: homeError } = await supabase
    .from("private_profiles")
    .update({ home_lat: home?.lat ?? null, home_lng: home?.lng ?? null })
    .eq("id", userId);
  return { error: homeError ? new Error(homeError.message) : null };
}

export async function updateDirectorDetails(
  userId: string,
  args: {
    contactFirstName: string;
    contactLastInitial: string;
    orgName: string;
    orgType: string;
    city: string;
    state: string;
  }
): Promise<Result> {
  const orgName = args.orgName.trim();
  if (!orgName) return fail("Enter your organization name.");
  if (!ORG_TYPES.some((t) => t.id === args.orgType)) return fail("Choose your organization type.");
  const details = cleanPublicDetails({
    firstName: args.contactFirstName,
    lastInitial: args.contactLastInitial,
    city: args.city,
    state: args.state,
  });
  if ("error" in details) return fail(details.error!);
  const v = details.values;

  const { error } = await supabase
    .from("hirers")
    .update({
      org_name: orgName,
      org_type: args.orgType,
      city: v.city,
      state: v.state,
      contact_first_name: v.first_name,
      contact_last_initial: v.last_initial,
    })
    .eq("user_id", userId);
  if (error) return { error: new Error(error.message) };

  return savePublicDetails(userId, v);
}

export async function updateAssignorDetails(
  userId: string,
  args: { firstName: string; lastInitial: string; city: string; state: string }
): Promise<Result> {
  const details = cleanPublicDetails(args);
  if ("error" in details) return fail(details.error!);
  return savePublicDetails(userId, details.values);
}
