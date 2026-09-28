"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { isSupabaseConfigured } from "@/lib/supabase";
import { ROLE_AREA, ROLE_HOME, type Role } from "@/lib/roles/queries";

/** Each role has its own app; these are where they land. */
export const REFEREE_HOME = "/app/jobs";
export const DIRECTOR_HOME = "/director/tournaments";
export const ASSIGNOR_HOME = "/assignor/tournaments";

/** Routes that are fine to view signed-out (marketing + auth). */
function isPublic(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/legal")
  );
}

/**
 * Web port of the app's AuthGate (refee-mobile/refee/app/_layout.tsx).
 *
 * Same rules, same order:
 *   no session          → /auth/welcome
 *   session, no profile → /onboarding/role-select
 *   director            → the director app
 *   assignor            → the assignor app
 *   referee             → the referee app
 *
 * The last three are about where you LAND, not where you may go. Someone who
 * referees and also assigns holds both roles, and is at home in either app —
 * so a role's area is only closed to people who do not hold that role. Before
 * this, routing keyed off primary_role alone and bounced a referee straight
 * out of /assignor, which made the second role unreachable even though the
 * schema had always allowed it.
 */
export function RouteGate({ children }: { children: React.ReactNode }) {
  const { session, profileComplete, primaryRole, roles, ready } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    if (!ready) return;

    const inAuthGroup = pathname.startsWith("/auth");
    const inOnboardingGroup = pathname.startsWith("/onboarding");
    const inAppGroup = pathname.startsWith("/app");
    const inDirectorGroup = pathname.startsWith("/director");
    const inAssignorGroup = pathname.startsWith("/assignor");
    // /verify belongs to every role, so it isn't bounced to a role's home —
    // but it's still a signed-in page.
    const inVerifyGroup = pathname.startsWith("/verify");
    // /admin belongs to no role: staff reach it whatever they signed up as, so
    // it is deliberately absent from the role redirects below. The page itself
    // is guarded by the database, not by this.
    const inAdminGroup = pathname.startsWith("/admin");

    if (!session) {
      // Marketing pages stay reachable signed-out; the app itself does not.
      if (
        inOnboardingGroup ||
        inAppGroup ||
        inDirectorGroup ||
        inAssignorGroup ||
        inVerifyGroup ||
        inAdminGroup
      ) {
        router.replace("/auth/welcome");
      }
      return;
    }

    if (profileComplete === null) return;

    if (!profileComplete) {
      if (!inOnboardingGroup) router.replace("/onboarding/role-select");
      return;
    }

    if (primaryRole === null) return;

    // Where this person lands when they are not already somewhere valid.
    const home = ROLE_HOME[primaryRole as Role] ?? REFEREE_HOME;

    // Areas they hold a role for. A role they do not hold stays closed.
    const held: Role[] = roles.length > 0 ? roles : [primaryRole as Role];
    const allowed = held.map((r) => ROLE_AREA[r]).filter(Boolean);
    const inAllowedArea = allowed.some((area) => pathname.startsWith(area));

    // /verify and /admin belong to no single role and are handled above.
    if (inAuthGroup || inOnboardingGroup) {
      router.replace(home);
      return;
    }

    const inSomeRoleArea = inAppGroup || inDirectorGroup || inAssignorGroup;
    if (inSomeRoleArea && !inAllowedArea) {
      router.replace(home);
    }
  }, [session, profileComplete, primaryRole, ready, pathname, router]);

  // Hold the signed-in areas until routing has settled, so we never flash the
  // referee app at a director (the app does this with the splash screen).
  const guarded =
    pathname.startsWith("/app") ||
    pathname.startsWith("/director") ||
    pathname.startsWith("/assignor") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/verify") ||
    pathname.startsWith("/admin");

  if (guarded && !ready && isSupabaseConfigured) {
    return <BootSplash />;
  }

  return <>{children}</>;
}

export function BootSplash() {
  return (
    <div className="form-shell flex items-center justify-center">
      <span
        className="font-display text-3xl tracking-tight text-ink"
        style={{ letterSpacing: -1 }}
      >
        REF<span className="text-signal">EE</span>
      </span>
    </div>
  );
}

export { isPublic };
