import {
  ROLE_AREA,
  ROLE_HOME,
  isRole,
  type Role,
} from "@/lib/roles/queries";

export const REFEREE_HOME = "/app/jobs";

export type RouteAuthState = {
  pathname: string;
  signedIn: boolean;
  profileComplete: boolean | null;
  primaryRole: string | null;
  roles: Role[];
};

/**
 * Always retain the primary role, including for accounts created before
 * user_roles was populated consistently. This also makes role reads tolerant
 * of a partially backfilled row set while migration 0052 repairs the data.
 */
export function rolesWithPrimary(primaryRole: string, storedRoles: Role[]): Role[] {
  const primary = isRole(primaryRole) ? primaryRole : "referee";
  return Array.from(new Set<Role>([primary, ...storedRoles]));
}

/** Pure routing decision, kept outside React so the complete role matrix is testable. */
export function routeRedirect({
  pathname,
  signedIn,
  profileComplete,
  primaryRole,
  roles,
}: RouteAuthState): string | null {
  const inAuthGroup = pathname.startsWith("/auth");
  const inOnboardingGroup = pathname.startsWith("/onboarding");
  const inAppGroup = pathname.startsWith("/app");
  const inDirectorGroup = pathname.startsWith("/director");
  const inAssignorGroup = pathname.startsWith("/assignor");
  const inVerifyGroup = pathname.startsWith("/verify");
  const inAdminGroup = pathname.startsWith("/admin");
  const inAccountGroup = pathname.startsWith("/account");

  if (!signedIn) {
    return inOnboardingGroup ||
      inAppGroup ||
      inDirectorGroup ||
      inAssignorGroup ||
      inVerifyGroup ||
      inAdminGroup ||
      inAccountGroup
      ? "/auth/welcome"
      : null;
  }

  if (profileComplete === null) return null;
  if (!profileComplete) return inOnboardingGroup ? null : "/onboarding/role-select";
  if (!primaryRole) return null;

  const primary = isRole(primaryRole) ? primaryRole : "referee";
  const home = ROLE_HOME[primary] ?? REFEREE_HOME;
  const held = rolesWithPrimary(primary, roles);
  const allowed = held.map((role) => ROLE_AREA[role]);

  if (inAuthGroup || inOnboardingGroup) return home;

  const inSomeRoleArea = inAppGroup || inDirectorGroup || inAssignorGroup;
  const inAllowedArea = allowed.some((area) => pathname.startsWith(area));
  return inSomeRoleArea && !inAllowedArea ? home : null;
}
