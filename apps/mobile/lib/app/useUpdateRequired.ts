import { useEffect, useState } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { fetchMinAppVersion, isVersionBelow } from "@/lib/app/version";

/**
 * True once we know this install is older than the minimum the backend
 * supports. Stays false while checking, offline, or on web — being unable to
 * ask must never lock anyone out.
 */
export function useUpdateRequired(): boolean {
  const [required, setRequired] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "ios" && Platform.OS !== "android") return;
    let cancelled = false;
    void fetchMinAppVersion(Platform.OS).then((minimum) => {
      if (!cancelled && isVersionBelow(Constants.expoConfig?.version, minimum)) setRequired(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return required;
}
