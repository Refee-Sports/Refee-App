import { supabase } from "../client";
import { geocodeFirst, homeQueries } from "../geo/geocode";
import { isServiceRegion, REGION_CODE_ERROR } from "../geo/regions";
import { ORG_TYPES } from "../roles/queries";
import { invokeErrorMessage } from "../payments/queries";

// Editing the details people gave at sign-up. Referees have their own fuller
// screen (updateFullProfile); these cover directors, assignors, and the legal
// name and birthday every role gives for the ID check.

type Result = { error: Error | null };

const fail = (message: string): Result => ({ error: new Error(message) });

/** How long a verified person waits between name changes (0068). */
export const NAME_CHANGE_COOLDOWN_DAYS = 60;

/** While Didit is reviewing, nothing it checks may change (0067). */
export function isIdentityLocked(status: string | null | undefined): boolean {
  return status === "in_review" || status === "approved";
}

export type LegalIdentity = {
  legalFirstName: string;
  legalLastName: string;
  dateOfBirth: string;
  /** In review: name and birthday both wait for the decision. */
  namesLocked: boolean;
  /** Verified (or in review): the birthday only changes through support. */
  dobLocked: boolean;
  verified: boolean;
  /** When a verified person may change their name again; null if they may now. */
  nextNameChangeAt: string | null;
};

/** The next allowed name change, given the last one. An edit within the hour counts as the same one. */
export function nextNameChange(lastChangedAt: string | null, now: Date = new Date()): string | null {
  if (!lastChangedAt) return null;
  const last = new Date(lastChangedAt).getTime();
  if (Number.isNaN(last) || now.getTime() - last < 60 * 60_000) return null;
  const next = last + NAME_CHANGE_COOLDOWN_DAYS * 24 * 60 * 60_000;
  return next > now.getTime() ? new Date(next).toISOString() : null;
}

export async function fetchMyLegalIdentity(
  userId: string
): Promise<{ identity: LegalIdentity | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("private_profiles")
    .select("legal_first_name, legal_last_name, date_of_birth, identity_status, name_changed_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) return { identity: null, error: new Error(error.message) };
  if (!data) return { identity: null, error: null };
  const verified = data.identity_status === "approved";
  return {
    identity: {
      legalFirstName: data.legal_first_name ?? "",
      legalLastName: data.legal_last_name ?? "",
      dateOfBirth: data.date_of_birth ?? "",
      namesLocked: data.identity_status === "in_review",
      dobLocked: isIdentityLocked(data.identity_status),
      verified,
      nextNameChangeAt: verified ? nextNameChange(data.name_changed_at ?? null) : null,
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

/** Shared checks for the public name and place every profile shows. The last initial isn't here: it comes from the legal last name (0068). */
function cleanPublicDetails(args: { firstName: string; city: string; state: string }) {
  const first_name = args.firstName.trim();
  const city = args.city.trim();
  const state = args.state.trim().toUpperCase();
  if (!first_name) return { error: "Enter your first name." } as const;
  if (!city) return { error: "Enter your city." } as const;
  if (!isServiceRegion(state)) return { error: REGION_CODE_ERROR } as const;
  return { values: { first_name, city, state } } as const;
}

/** Writes the public profile, then re-pins home so a referee feed measures from the new city. */
async function savePublicDetails(
  userId: string,
  values: { first_name: string; city: string; state: string }
): Promise<Result> {
  const { error } = await supabase.from("public_profiles").update(values).eq("id", userId);
  if (error) return { error: new Error(error.message) };

  // Keep a referee's ZIP-precise pin when they edit another role's details.
  const { data: priv } = await supabase.from("private_profiles").select("home_zip").eq("id", userId).maybeSingle();
  const home = await geocodeFirst(homeQueries({ city: values.city, state: values.state, zip: priv?.home_zip ?? null }));
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
    orgName: string;
    orgType: string;
    city: string;
    state: string;
  }
): Promise<Result> {
  const orgName = args.orgName.trim();
  if (!orgName) return fail("Enter your organization name.");
  if (!ORG_TYPES.some((t) => t.id === args.orgType)) return fail("Choose your organization type.");
  const details = cleanPublicDetails({ firstName: args.contactFirstName, city: args.city, state: args.state });
  if ("error" in details) return fail(details.error!);
  const v = details.values;

  // The contact name isn't written here: the database copies it from the profile (0068).
  const { error } = await supabase
    .from("hirers")
    .update({ org_name: orgName, org_type: args.orgType, city: v.city, state: v.state })
    .eq("user_id", userId);
  if (error) return { error: new Error(error.message) };

  return savePublicDetails(userId, v);
}

export async function updateAssignorDetails(
  userId: string,
  args: { firstName: string; city: string; state: string }
): Promise<Result> {
  const details = cleanPublicDetails(args);
  if ("error" in details) return fail(details.error!);
  return savePublicDetails(userId, details.values);
}

/** Where a new photo is staged before set-headshot accepts it. */
export const STAGED_HEADSHOT = "pending.jpg";

/**
 * Asks the backend to make the staged photo the profile photo. Once someone's
 * ID is verified, it has to match their ID selfie first (0068).
 */
export async function activateStagedHeadshot(): Promise<{ avatarUrl: string | null; error: Error | null }> {
  const { data, error } = await supabase.functions.invoke("set-headshot", { body: {} });
  if (error) return { avatarUrl: null, error: new Error(await invokeErrorMessage(error)) };
  return { avatarUrl: (data as { avatarUrl?: string } | null)?.avatarUrl ?? null, error: null };
}
