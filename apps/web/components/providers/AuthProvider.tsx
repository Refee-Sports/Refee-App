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
import { profileExists, fetchPrimaryRole } from "@/lib/profile/queries";
import type { PrimaryRole } from "@/lib/stores/onboarding-store";

export type AuthState = {
  session: Session | null;
  userId: string | null;
  /** null = still resolving */
  profileComplete: boolean | null;
  primaryRole: PrimaryRole | null;
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
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthReady(true);
      return;
    }

    let cancelled = false;

    (async () => {
      const {
        data: { session: initialSession },
      } = await supabase.auth.getSession();

      if (initialSession) {
        const valid = await ensureValidSession();
        if (!valid) {
          if (cancelled) return;
          setSession(null);
          setProfileComplete(null);
          setPrimaryRole(null);
          setAuthReady(true);
          return;
        }
      }

      if (cancelled) return;
      setSession(initialSession);
      if (!initialSession) {
        setProfileComplete(null);
        setPrimaryRole(null);
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
    const exists = await profileExists(uid);
    setProfileComplete(exists);
    if (exists) {
      setPrimaryRole((await fetchPrimaryRole(uid)) as PrimaryRole);
    } else {
      setPrimaryRole(null);
    }
    setAuthReady(true);
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
      ready,
      refreshProfile,
      signOut,
    }),
    [session, userId, profileComplete, primaryRole, ready, refreshProfile, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
