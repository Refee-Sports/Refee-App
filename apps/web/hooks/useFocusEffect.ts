"use client";

import { useEffect } from "react";

/**
 * Web stand-in for expo-router's useFocusEffect.
 *
 * On mobile a screen "regains focus" when you navigate back to it. In the
 * browser the closest equivalents are mount (a route change remounts the page
 * component) and the tab becoming visible again, so we fire on both. Screens
 * rely on this to re-fetch — e.g. the jobs feed dropping a job you just
 * accepted.
 *
 * Like React Navigation's version, `effect` must be memoized (useCallback):
 * it is a dependency, so a fresh function every render would re-run forever.
 * Changing its identity deliberately (new inputs) re-runs the effect, which is
 * how the feed reloads when you switch between home and near-me.
 */
export function useFocusEffect(effect: () => void | (() => void)) {
  useEffect(() => {
    let cleanup = effect();

    const rerun = () => {
      if (document.visibilityState !== "visible") return;
      if (typeof cleanup === "function") cleanup();
      cleanup = effect();
    };

    document.addEventListener("visibilitychange", rerun);
    window.addEventListener("focus", rerun);
    return () => {
      document.removeEventListener("visibilitychange", rerun);
      window.removeEventListener("focus", rerun);
      if (typeof cleanup === "function") cleanup();
    };
  }, [effect]);
}
