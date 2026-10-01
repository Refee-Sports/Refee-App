import { supabase } from "../client";

// One account, one identity check, several roles.
//
// Plenty of real officials also assign. Before this, adding the second role
// meant creating a second account — which the identity check then correctly
// refused, because Face Search recognised the same person signing up twice.
// The anti-duplicate defence was doing its job; the product was asking people
// to defeat it.
//
// The schema already allowed it: user_roles is keyed on (user_id, role).
// primary_role on the public profile is only a default — which home screen you
// land on — not a limit on what you may do.

export type Role = "referee" | "assignor" | "director";

export const ROLE_LABELS: Record<Role, string> = {
  referee: "Referee",
  assignor: "Assignor",
  director: "Tournament director",
};

/** The home screen each role lands on. */
export const ROLE_HOME: Record<Role, string> = {
  referee: "/app/jobs",
  director: "/director/tournaments",
  assignor: "/assignor/tournaments",
};

/** Which path prefix belongs to which role, for routing decisions. */
export const ROLE_AREA: Record<Role, string> = {
  referee: "/app",
  director: "/director",
  assignor: "/assignor",
};

export function isRole(value: string | null | undefined): value is Role {
  return value === "referee" || value === "assignor" || value === "director";
}

/** Every role this account holds. */
export async function fetchRoles(userId: string): Promise<{ roles: Role[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) return { roles: [], error: new Error(error.message) };
  const roles = (data ?? []).map((r) => r.role as string).filter(isRole);
  return { roles, error: null };
}

/**
 * Takes on an additional role.
 *
 * Only ever adds. Nothing here touches identity verification: the person has
 * already proved who they are, and doing the same job under a second hat does
 * not make them a different person.
 */
export async function addRole(userId: string, role: Role): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("user_roles")
    .upsert({ user_id: userId, role }, { onConflict: "user_id,role" });
  return { error: error ? new Error(error.message) : null };
}

/**
 * Changes which role this account lands on by default.
 *
 * Refuses a role the account doesn't hold, so the switcher can't strand
 * someone on a home screen the router will bounce them straight out of.
 */
export async function setPrimaryRole(
  userId: string,
  role: Role
): Promise<{ error: Error | null }> {
  const { roles, error: readError } = await fetchRoles(userId);
  if (readError) return { error: readError };
  if (!roles.includes(role)) {
    return { error: new Error(`You haven't set up a ${ROLE_LABELS[role].toLowerCase()} profile yet.`) };
  }

  const { error } = await supabase
    .from("public_profiles")
    .update({ primary_role: role })
    .eq("id", userId);
  return { error: error ? new Error(error.message) : null };
}

/** Organization types a director can pick (onboarding and taking on the role). */
export const ORG_TYPES = [
  { id: "tournament", label: "TOURNAMENT" },
  { id: "league", label: "LEAGUE" },
  { id: "school", label: "SCHOOL / UNIVERSITY" },
  { id: "parks_rec", label: "PARKS & REC" },
] as const;

/**
 * Takes on the director role, with the organization it needs.
 *
 * Every director screen works through a hirer row (the organization that
 * posts and pays for games). Adding only the role used to land people on
 * "Director profile not found". Name and city come from the profile they
 * already have; an organization they made before is reused.
 */
export async function addDirectorRole(
  userId: string,
  /** Needed only when they don't have an organization yet. */
  org?: { orgName: string; orgType: string }
): Promise<{ error: Error | null }> {
  const { data: existing, error: readError } = await supabase
    .from("hirers")
    .select("id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (readError) return { error: new Error(readError.message) };

  if (!existing) {
    const orgName = org?.orgName.trim();
    if (!orgName) return { error: new Error("Enter your organization name.") };
    if (!org?.orgType) return { error: new Error("Choose your organization type.") };

    const { data: profile, error: profileError } = await supabase
      .from("public_profiles")
      .select("first_name, last_initial, city, state")
      .eq("id", userId)
      .maybeSingle();
    if (profileError) return { error: new Error(profileError.message) };
    if (!profile) return { error: new Error("Profile not found.") };

    const { error: hirerError } = await supabase
      .from("hirers")
      .insert({
        user_id: userId,
        org_name: orgName,
        org_type: org.orgType,
        city: profile.city,
        state: profile.state,
        contact_first_name: profile.first_name,
        contact_last_initial: profile.last_initial,
      })
      .select("id")
      .single();
    if (hirerError) return { error: new Error(hirerError.message) };
  }

  const { error: roleError } = await addRole(userId, "director");
  if (roleError) return { error: roleError };
  return setPrimaryRole(userId, "director");
}

/** The roles this account could still take on. */
export function availableRoles(held: Role[]): Role[] {
  return (["referee", "assignor", "director"] as Role[]).filter((r) => !held.includes(r));
}

/** What the button to take on a role should say. */
export function addRoleLabel(role: Role): string {
  switch (role) {
    case "referee":
      return "Also work games";
    case "assignor":
      return "Also assign games";
    case "director":
      return "Also post games";
  }
}
