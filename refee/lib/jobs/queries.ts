import type { SupabaseClient } from "@supabase/supabase-js";
import type { JobDetail, JobListRow } from "./types";
import { mapDbJobToDetail, mapDbJobToListRow, type JobDbRow } from "./map-db-job";
import { distanceMiles } from "@/lib/geo/geocode";

export type AssignmentStatus =
  | "accepted"
  | "declined"
  | "pending"
  | "completed"
  | "no_show"
  | "needs_reconfirm"
  | null;

export async function fetchMyJobAssignment(
  supabase: SupabaseClient,
  userId: string,
  jobId: string
): Promise<{ status: AssignmentStatus; error: Error | null }> {
  const { data, error } = await supabase
    .from("job_assignments")
    .select("status")
    .eq("ref_id", userId)
    .eq("job_id", jobId)
    .maybeSingle();
  if (error) return { status: null, error: new Error(error.message) };
  return { status: (data?.status as AssignmentStatus) ?? null, error: null };
}

const DEFAULT_GAME_MINUTES = 120;

function jobWindow(startsAt: string, durationMinutes: number | null): [number, number] {
  const start = new Date(startsAt).getTime();
  return [start, start + (durationMinutes ?? DEFAULT_GAME_MINUTES) * 60_000];
}

/** Returns the conflicting job title if the ref already has an accepted game overlapping this one. */
export async function findScheduleConflict(
  supabase: SupabaseClient,
  userId: string,
  jobId: string
): Promise<{ conflictTitle: string | null; error: Error | null }> {
  const [{ data: target, error: tErr }, { data: mine, error: mErr }] = await Promise.all([
    supabase.from("jobs").select("starts_at, duration_minutes").eq("id", jobId).maybeSingle(),
    supabase
      .from("job_assignments")
      .select("job_id, jobs(title, starts_at, duration_minutes)")
      .eq("ref_id", userId)
      .eq("status", "accepted"),
  ]);

  if (tErr || mErr) return { conflictTitle: null, error: new Error((tErr ?? mErr)!.message) };
  if (!target) return { conflictTitle: null, error: null };

  const [newStart, newEnd] = jobWindow(target.starts_at, target.duration_minutes);

  for (const row of (mine ?? []) as any[]) {
    if (row.job_id === jobId) continue;
    const job = Array.isArray(row.jobs) ? row.jobs[0] : row.jobs;
    if (!job) continue;
    const [start, end] = jobWindow(job.starts_at, job.duration_minutes);
    if (newStart < end && start < newEnd) {
      return { conflictTitle: job.title as string, error: null };
    }
  }
  return { conflictTitle: null, error: null };
}

export async function acceptJob(
  supabase: SupabaseClient,
  userId: string,
  jobId: string
): Promise<{ error: Error | null }> {
  const { conflictTitle, error: conflictErr } = await findScheduleConflict(supabase, userId, jobId);
  if (conflictErr) return { error: conflictErr };
  if (conflictTitle) {
    return {
      error: new Error(
        `Schedule conflict: you're already booked on "${conflictTitle}" during this time.`
      ),
    };
  }

  const respondedAt = new Date().toISOString();
  const { error } = await supabase.from("job_assignments").upsert(
    {
      ref_id: userId,
      job_id: jobId,
      status: "accepted",
      responded_at: respondedAt,
    },
    { onConflict: "job_id,ref_id" }
  );
  return { error: error ? new Error(error.message) : null };
}

export async function declineJob(
  supabase: SupabaseClient,
  userId: string,
  jobId: string
): Promise<{ error: Error | null }> {
  const respondedAt = new Date().toISOString();
  const { error } = await supabase.from("job_assignments").upsert(
    {
      ref_id: userId,
      job_id: jobId,
      status: "declined",
      responded_at: respondedAt,
    },
    { onConflict: "job_id,ref_id" }
  );
  return { error: error ? new Error(error.message) : null };
}

/** @deprecated Use declineJob */
export const declineInvite = declineJob;

/** Withdrawing inside this window flags the ref's reliability. */
export const WITHDRAW_FREE_WINDOW_HOURS = 24;

export function isLateWithdrawal(startsAt: string): boolean {
  return (
    new Date(startsAt).getTime() - Date.now() <
    WITHDRAW_FREE_WINDOW_HOURS * 3_600_000
  );
}

/**
 * Withdraws the ref from an accepted game via a security-definer RPC
 * (it also reopens the job slot, which the ref's own grants can't do).
 * Free if more than 24h before tip-off; inside 24h it's flagged late.
 */
export async function withdrawFromJob(
  supabase: SupabaseClient,
  jobId: string
): Promise<{ error: Error | null; late: boolean }> {
  const { data, error } = await supabase.rpc("withdraw_from_job", { p_job_id: jobId });
  if (error) return { error: new Error(error.message), late: false };
  if (data?.error) return { error: new Error(data.error as string), late: false };
  return { error: null, late: !!data?.late };
}

export type CrewProfile = {
  refId: string;
  displayName: string;
  initials: string;
  rating: number;
  role: string;
  status: string;
  isMe: boolean;
};

export async function fetchJobCrewMembers(
  supabase: SupabaseClient,
  jobId: string,
  currentUserId: string | null
): Promise<{ members: CrewProfile[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("job_assignments")
    .select(
      "ref_id, role, status, profile:public_profiles(first_name, last_initial, display_name, rating)"
    )
    .eq("job_id", jobId)
    .in("status", ["accepted", "pending"]);

  if (error) return { members: [], error: new Error(error.message) };

  const members: CrewProfile[] = (data ?? [])
    .map((row) => {
      const r = row as {
        ref_id: string;
        role: string | null;
        status: string;
        profile:
          | {
              first_name: string;
              last_initial: string;
              display_name: string;
              rating: number;
            }
          | {
              first_name: string;
              last_initial: string;
              display_name: string;
              rating: number;
            }[]
          | null;
      };
      const profile = Array.isArray(r.profile) ? r.profile[0] : r.profile;
      if (!profile) return null;
      const roleLabel = (r.role ?? "official").replace("_", " ").toUpperCase();
      const isMe = currentUserId != null && r.ref_id === currentUserId;
      return {
        refId: r.ref_id,
        displayName: profile.display_name.toUpperCase(),
        initials: `${profile.first_name[0] ?? "?"}${profile.last_initial}`.toUpperCase(),
        rating: profile.rating ?? 0,
        role: `${roleLabel} · ${(profile.rating ?? 0).toFixed(2)} ★`,
        status: isMe && r.status === "accepted" ? "● LOCKED" : r.status === "accepted" ? "● LOCKED" : "PENDING",
        isMe,
      };
    })
    .filter((m): m is CrewProfile => m != null);

  return { members, error: null };
}

export async function fetchOpenJobs(
  supabase: SupabaseClient,
  userId?: string | null,
  /** When set (live "near me" location), used as the radius origin instead of the ref's home. */
  originOverride?: { lat: number; lng: number } | null
): Promise<{ jobs: JobListRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("jobs")
    .select("*, hirers(org_name, is_verified)")
    .eq("status", "open")
    .order("starts_at", { ascending: true });

  if (error) {
    return { jobs: [], error: new Error(error.message) };
  }
  let rows = (data ?? []) as JobDbRow[];

  const distanceByJob = new Map<string, number>();

  if (userId) {
    const [{ data: mine }, { data: profile }, { data: prefs }] = await Promise.all([
      // Hide jobs the ref has interacted with: accepted/pending live under
      // upcoming games; declined jobs stay hidden for good.
      supabase
        .from("job_assignments")
        .select("job_id, status")
        .eq("ref_id", userId)
        .in("status", ["accepted", "pending", "declined", "needs_reconfirm"]),
      supabase
        .from("public_profiles")
        .select("state, home_lat, home_lng")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("availability_prefs")
        .select("min_pay_per_game, travel_radius_miles")
        .eq("ref_id", userId)
        .maybeSingle(),
    ]);

    const taken = new Set((mine ?? []).map((a) => a.job_id));
    rows = rows.filter((r) => !taken.has(r.id));

    // Location: true mile-radius when the ref and the venue are both geocoded;
    // otherwise fall back to same-state matching.
    const refState = profile?.state?.toUpperCase();
    const home =
      originOverride ??
      (profile?.home_lat != null && profile?.home_lng != null
        ? { lat: profile.home_lat as number, lng: profile.home_lng as number }
        : null);
    const radius = prefs?.travel_radius_miles ?? 25;

    rows = rows.filter((r) => {
      const j = r as any;
      const hasVenueCoords = j.venue_lat != null && j.venue_lng != null;
      if (home && hasVenueCoords) {
        const miles = distanceMiles(home, { lat: j.venue_lat, lng: j.venue_lng });
        distanceByJob.set(j.id, miles);
        return miles <= radius;
      }
      // Fallback: same-state
      return refState ? j.venue_state?.toUpperCase() === refState : true;
    });

    // Pay floor: only show jobs at or above the ref's minimum
    const minPay = prefs?.min_pay_per_game ?? 0;
    if (minPay > 0) {
      rows = rows.filter((r) => ((r as any).pay_per_game ?? 0) >= minPay);
    }
  }

  return {
    jobs: rows.map((r) => {
      const row = mapDbJobToListRow(r);
      const miles = distanceByJob.get(r.id);
      if (miles != null) {
        row.distanceMiles = Math.round(miles);
        row.dist = `${Math.round(miles)} MI`;
      }
      return row;
    }),
    error: null,
  };
}

export async function fetchJobById(
  supabase: SupabaseClient,
  id: string
): Promise<{ job: JobDetail | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("jobs")
    .select("*, hirers(org_name, is_verified)")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return { job: null, error: new Error(error.message) };
  }
  if (!data) {
    return { job: null, error: null };
  }
  return { job: mapDbJobToDetail(data as JobDbRow), error: null };
}
