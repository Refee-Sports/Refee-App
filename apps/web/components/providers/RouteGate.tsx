"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { isSupabaseConfigured } from "@/lib/supabase";
import { routeRedirect } from "@/lib/auth/routing";

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
  const { session, profileComplete, primaryRole, roles, ready, authError, refreshProfile } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    if (!ready) return;

    const redirect = routeRedirect({
      pathname,
      signedIn: !!session,
      profileComplete,
      primaryRole,
      roles,
    });
    if (redirect) router.replace(redirect);
  }, [session, profileComplete, primaryRole, roles, ready, pathname, router]);

  // Hold the signed-in areas until routing has settled, so we never flash the
  // referee app at a director (the app does this with the splash screen).
  const guarded =
    pathname.startsWith("/app") ||
    pathname.startsWith("/director") ||
    pathname.startsWith("/assignor") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/verify") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/account");

  if (guarded && authError && isSupabaseConfigured) {
    return (
      <AuthLoadError
        message={authError}
        retry={() => {
          if (session) void refreshProfile();
          else window.location.reload();
        }}
      />
    );
  }

  if (guarded && !ready && isSupabaseConfigured) {
    return <BootSplash />;
  }

  return <>{children}</>;
}

function AuthLoadError({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="form-shell flex flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-mono-bold text-xs uppercase text-foul">We couldn&apos;t load your account.</p>
      <p className="max-w-sm text-sm text-ink-80">{message}</p>
      <button
        type="button"
        onClick={retry}
        className="border border-ink bg-ink px-5 py-3 font-mono-bold text-xs uppercase text-paper"
      >
        Try again
      </button>
    </div>
  );
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
