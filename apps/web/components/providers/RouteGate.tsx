"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { isSupabaseConfigured } from "@/lib/supabase";

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
 */
export function RouteGate({ children }: { children: React.ReactNode }) {
  const { session, profileComplete, primaryRole, ready } = useAuth();
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

    if (!session) {
      // Marketing pages stay reachable signed-out; the app itself does not.
      if (inOnboardingGroup || inAppGroup || inDirectorGroup || inAssignorGroup) {
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

    if (primaryRole === "director") {
      if (inAuthGroup || inOnboardingGroup || inAppGroup || inAssignorGroup) {
        router.replace(DIRECTOR_HOME);
      }
    } else if (primaryRole === "assignor") {
      if (inAuthGroup || inOnboardingGroup || inAppGroup || inDirectorGroup) {
        router.replace(ASSIGNOR_HOME);
      }
    } else {
      if (inAuthGroup || inOnboardingGroup || inDirectorGroup || inAssignorGroup) {
        router.replace(REFEREE_HOME);
      }
    }
  }, [session, profileComplete, primaryRole, ready, pathname, router]);

  // Hold the signed-in areas until routing has settled, so we never flash the
  // referee app at a director (the app does this with the splash screen).
  const guarded =
    pathname.startsWith("/app") ||
    pathname.startsWith("/director") ||
    pathname.startsWith("/assignor") ||
    pathname.startsWith("/onboarding");

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
