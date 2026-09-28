"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { ensureValidSession } from "@/lib/auth/session";
import { fetchMyProfile } from "@/lib/profile/queries";
import { fetchMyIdentityStatus, type IdentityStatus } from "@/lib/identity/queries";
import { fetchRoles, isRole, type Role } from "@/lib/roles/queries";
import { rolesWithPrimary } from "@/lib/auth/routing";
import { friendlyLoadError, withDeadline } from "@/lib/network";
import type { PrimaryRole } from "@/lib/stores/onboarding-store";

export type AuthState = {
  session: Session | null;
  userId: string | null;
  /** null = still resolving */
  profileComplete: boolean | null;
  primaryRole: PrimaryRole | null;
  /**
   * Every role this account holds. Someone can referee and assign — the same
   * person, verified once. primaryRole is only which home they land on.
   */
  roles: Role[];
  /** A recoverable account bootstrap failure; null once loading succeeds. */
  authError: string | null;
  /**
   * Whether Didit has confirmed who this person is. Only "approved" can take,
   * staff or post games — the database enforces that; this is what the screens
   * use to explain why a button is off. null = still resolving.
   */
  identityStatus: IdentityStatus | null;
  /** Session + profile + role have all been resolved at least once. */
  ready: boolean;
  /** Re-reads profile completeness and role (call after onboarding). */
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

/**
 * Web counterpart of the app's root layout auth wiring
 * (refee-mobile/refee/app/_layout.tsx): it holds the Supabase session, resolves
 * whether the user has finished onboarding, and resolves their primary role so
 * routing can send referees and directors to different apps.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profileComplete, setProfileComplete] = useState<boolean | null>(null);
  const [primaryRole, setPrimaryRole] = useState<PrimaryRole | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [identityStatus, setIdentityStatus] = useState<IdentityStatus | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthReady(true);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const {
          data: { session: initialSession },
        } = await withDeadline(supabase.auth.getSession());

        if (initialSession && !(await withDeadline(ensureValidSession()))) {
          if (cancelled) return;
          setSession(null);
          setProfileComplete(null);
          setPrimaryRole(null);
          setRoles([]);
          setAuthReady(true);
          return;
        }

        if (cancelled) return;
        setAuthError(null);
        setSession(initialSession);
        if (!initialSession) {
          setProfileComplete(null);
          setPrimaryRole(null);
          setRoles([]);
          setIdentityStatus(null);
          setAuthReady(true);
        }
      } catch (error) {
        if (cancelled) return;
        setAuthError(friendlyLoadError(error instanceof Error ? error.message : null));
        setAuthReady(true);
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (!next) {
        setProfileComplete(null);
        setPrimaryRole(null);
        setRoles([]);
        setIdentityStatus(null);
        setAuthError(null);
        setAuthReady(true);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user.id ?? null;

  const loadProfile = useCallback(async (uid: string) => {
    setAuthReady(false);
    setAuthError(null);
    try {
      const { data: profile, error: profileError } = await withDeadline(fetchMyProfile(uid));
      if (profileError) throw new Error(profileError.message);

      const exists = !!profile;
      setProfileComplete(exists);
      if (!profile) {
        setPrimaryRole(null);
        setRoles([]);
        setIdentityStatus(null);
        return;
      }

      const primary = isRole(profile.primary_role) ? profile.primary_role : "referee";
      const [rolesResult, identity] = await withDeadline(
        Promise.all([fetchRoles(uid), fetchMyIdentityStatus(uid)])
      );
      if (rolesResult.error) throw rolesResult.error;

      setPrimaryRole(primary as PrimaryRole);
      setRoles(rolesWithPrimary(primary, rolesResult.roles));
      setIdentityStatus(identity.status);
    } catch (error) {
      setAuthError(friendlyLoadError(error instanceof Error ? error.message : null));
    } finally {
      setAuthReady(true);
    }
  }, []);

  useEffect(() => {
    if (!userId) return;
    void loadProfile(userId);
  }, [userId, loadProfile]);

  const refreshProfile = useCallback(async () => {
    if (!userId) return;
    await loadProfile(userId);
  }, [userId, loadProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfileComplete(null);
    setPrimaryRole(null);
    setRoles([]);
    setIdentityStatus(null);
    setAuthError(null);
  }, []);

  // Mirrors the app's splash gate: hold until the session AND (when signed in)
  // the profile + role are known, so we never flash the wrong app.
  const ready =
    authReady &&
    (session === null || profileComplete !== true || primaryRole !== null);

  const value = useMemo<AuthState>(
    () => ({
      session,
      userId,
      profileComplete,
      primaryRole,
      roles,
      authError,
      identityStatus,
      ready,
      refreshProfile,
      signOut,
    }),
    [session, userId, profileComplete, primaryRole, roles, authError, identityStatus, ready, refreshProfile, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
