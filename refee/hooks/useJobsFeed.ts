import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect } from "expo-router";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { getMockJobDetail, getMockJobs } from "@/lib/jobs/mock-data";
import { fetchJobById, fetchOpenJobs } from "@/lib/jobs/queries";
import { getCurrentCoords } from "@/lib/geo/location";
import type { Coords } from "@/lib/geo/geocode";
import type { FeedTab, JobDetail, JobListRow } from "@/lib/jobs/types";

export type LocationMode = "home" | "near_me";

type JobsFeedState = {
  /** Jobs loaded from Supabase (open / partially filled) */
  dbAvailable: JobListRow[];
  loading: boolean;
  error: string | null;
  usedMockForAvailable: boolean;
};

export function useJobsFeed() {
  const [state, setState] = useState<JobsFeedState>({
    dbAvailable: [],
    loading: true,
    error: null,
    usedMockForAvailable: false,
  });
  const [locationMode, setLocationMode] = useState<LocationMode>("home");
  const [liveCoords, setLiveCoords] = useState<Coords | null>(null);
  const [locating, setLocating] = useState(false);

  const load = useCallback(
    async (origin?: Coords | null) => {
      if (!isSupabaseConfigured) {
        setState({
          dbAvailable: [],
          loading: false,
          error: null,
          usedMockForAvailable: true,
        });
        return;
      }
      setState((s) => ({ ...s, loading: true, error: null }));
      const { data: { session } } = await supabase.auth.getSession();
      const { jobs, error } = await fetchOpenJobs(
        supabase,
        session?.user.id ?? null,
        origin ?? undefined
      );
      if (error) {
        setState({
          dbAvailable: [],
          loading: false,
          error: error.message,
          usedMockForAvailable: true,
        });
        return;
      }
      setState({
        dbAvailable: jobs,
        loading: false,
        error: null,
        usedMockForAvailable: jobs.length === 0,
      });
    },
    []
  );

  /**
   * Switch between home-base and live "near me" location. Returns false if
   * near-me was requested but permission was denied (feed stays on home).
   */
  const toggleLocationMode = useCallback(async (): Promise<boolean> => {
    if (locationMode === "near_me") {
      setLocationMode("home");
      setLiveCoords(null);
      void load(null);
      return true;
    }
    setLocating(true);
    const result = await getCurrentCoords();
    setLocating(false);
    if (!result.ok) return false; // caller shows the reason; stay on home
    setLiveCoords(result.coords);
    setLocationMode("near_me");
    void load(result.coords);
    return true;
  }, [locationMode, load]);

  // Reload whenever the feed regains focus, so a just-accepted job disappears.
  // Preserves the active location origin (live coords when in near-me mode).
  useFocusEffect(
    useCallback(() => {
      void load(locationMode === "near_me" ? liveCoords : null);
    }, [load, locationMode, liveCoords])
  );

  const mockAll = useMemo(() => getMockJobs(), []);

  const rowsForTab = useCallback(
    (tab: FeedTab): JobListRow[] => {
      if (tab === "available") {
        if (state.dbAvailable.length > 0) {
          return state.dbAvailable;
        }
        return mockAll.filter((j) => j.tab === "available");
      }
      return mockAll.filter((j) => j.tab === tab);
    },
    [mockAll, state.dbAvailable]
  );

  const counts = useMemo(() => {
    const available =
      state.dbAvailable.length > 0
        ? state.dbAvailable.length
        : mockAll.filter((j) => j.tab === "available").length;
    return {
      available,
      invited: mockAll.filter((j) => j.tab === "invited").length,
      saved: mockAll.filter((j) => j.tab === "saved").length,
    };
  }, [mockAll, state.dbAvailable]);

  return {
    ...state,
    rowsForTab,
    counts,
    refresh: () => load(locationMode === "near_me" ? liveCoords : null),
    locationMode,
    locating,
    toggleLocationMode,
  };
}

export function useJobDetail(id: string | undefined) {
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setJob(null);
      setError(null);
      setLoading(false);
      return;
    }

    const resolvedId = id;

    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);

      if (!isSupabaseConfigured) {
        const m = getMockJobDetail(resolvedId);
        if (!cancelled) {
          setJob(m);
          setLoading(false);
        }
        return;
      }

      const { job: fromDb, error: qErr } = await fetchJobById(supabase, resolvedId);
      if (cancelled) return;

      if (qErr) {
        setError(qErr.message);
        const m = getMockJobDetail(resolvedId);
        setJob(m);
        setLoading(false);
        return;
      }

      if (fromDb) {
        setJob(fromDb);
        setLoading(false);
        return;
      }

      const m = getMockJobDetail(resolvedId);
      setJob(m);
      setLoading(false);
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return { job, loading, error };
}
