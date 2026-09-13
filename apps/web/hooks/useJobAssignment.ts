"use client";

import { useCallback, useEffect, useState } from "react";
import { getSessionUserId } from "@/lib/auth/session";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import {
  acceptJob,
  declineJob,
  fetchJobCrewMembers,
  fetchMyJobAssignment,
  type AssignmentStatus,
  type CrewProfile,
} from "@/lib/jobs/queries";

export function useJobAssignment(jobId: string | undefined) {
  const [status, setStatus] = useState<AssignmentStatus>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [crewMembers, setCrewMembers] = useState<CrewProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!jobId) {
      setStatus(null);
      setUserId(null);
      setCrewMembers([]);
      setLoading(false);
      return;
    }
    if (!isSupabaseConfigured) {
      setStatus(null);
      setUserId(null);
      setCrewMembers([]);
      setLoading(false);
      setError("Connect Supabase to accept or decline jobs.");
      return;
    }

    setLoading(true);
    setError(null);

    const uid = await getSessionUserId();
    setUserId(uid);
    if (!uid) {
      setStatus(null);
      setCrewMembers([]);
      setLoading(false);
      setError("Sign in to accept or decline jobs.");
      return;
    }

    const [{ status: s, error: qErr }, { members, error: crewErr }] = await Promise.all([
      fetchMyJobAssignment(supabase, uid, jobId),
      fetchJobCrewMembers(supabase, jobId, uid),
    ]);

    setStatus(s);
    setCrewMembers(members);
    setError(qErr?.message ?? crewErr?.message ?? null);
    setLoading(false);
  }, [jobId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const accept = useCallback(async (): Promise<{ error: Error | null }> => {
    if (!jobId || !isSupabaseConfigured) {
      return { error: new Error(error ?? "Supabase is not configured.") };
    }

    const uid = userId ?? (await getSessionUserId());
    if (!uid) {
      return { error: new Error("Sign in to accept jobs.") };
    }

    setActionLoading(true);
    const result = await acceptJob(supabase, uid, jobId);
    if (!result.error) {
      // Trust the server: a job needing organizer approval comes back
      // "pending", not "accepted".
      setStatus(result.status);
      await refresh();
    }
    setActionLoading(false);
    return { error: result.error };
  }, [jobId, userId, error, refresh]);

  const decline = useCallback(async (): Promise<{ error: Error | null }> => {
    if (!jobId || !isSupabaseConfigured) {
      return { error: new Error(error ?? "Supabase is not configured.") };
    }

    const uid = userId ?? (await getSessionUserId());
    if (!uid) {
      return { error: new Error("Sign in to decline jobs.") };
    }

    setActionLoading(true);
    const result = await declineJob(supabase, uid, jobId);
    if (!result.error) {
      setStatus(result.status);
      await refresh();
    }
    setActionLoading(false);
    return { error: result.error };
  }, [jobId, userId, error, refresh]);

  const canMutate =
    isSupabaseConfigured &&
    !!userId &&
    !loading &&
    status !== "accepted" &&
    status !== "declined";

  return {
    status,
    crewMembers,
    loading,
    actionLoading,
    error,
    refresh,
    accept,
    decline,
    canMutate,
  };
}
