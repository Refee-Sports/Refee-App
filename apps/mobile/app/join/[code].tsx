import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { supabase } from "@/lib/supabase";
import {
  extractRosterCode,
  joinRosterByCode,
  previewRosterInviteCode,
  type RosterCodePreview,
} from "@/lib/assignor/queries";
import { setPendingRosterCode } from "@/lib/roster/files";
import { palette } from "@refee/design";
import { Button } from "@/components/ui/Button";
import { TextLink } from "@/components/ui/Controls";

/**
 * Where a scanned QR code (refee://join/<code>) or a typed code lands.
 * Signed-out visitors are parked at sign-in first; their code is remembered and
 * they come back here once they're in.
 */
export default function JoinRoster() {
  const { code: raw } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const code = extractRosterCode(raw ?? "");
  const [preview, setPreview] = useState<RosterCodePreview | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "invalid" | "joining">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!code) {
        setState("invalid");
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // The auth gate is about to send them to sign-in; remember why they came.
        await setPendingRosterCode(code);
        return;
      }
      const result = await previewRosterInviteCode(code);
      if (cancelled) return;
      if (result.error || !result.preview) {
        setError(result.error?.message ?? null);
        setState("invalid");
      } else {
        setPreview(result.preview);
        setState("ready");
      }
    })();
    return () => { cancelled = true; };
  }, [code]);

  const join = async () => {
    if (!code || state === "joining") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setState("joining");
    const { error: e } = await joinRosterByCode(code);
    if (e) {
      setState("ready");
      Alert.alert("Couldn't join", e.message);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace("/my-organizations" as any);
  };

  return (
    <View className="flex-1 bg-paper px-6 justify-center" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      {state === "loading" ? (
        <ActivityIndicator color={palette.signal} />
      ) : state === "invalid" ? (
        <View>
          <Text className="text-ink font-display" style={{ fontSize: 34, lineHeight: 38, letterSpacing: -1 }}>
            THAT CODE{"\n"}
            <Text className="text-foul-ink">DOESN&apos;T WORK.</Text>
          </Text>
          <Text className="text-ink-80 mt-3" style={{ fontSize: 14, lineHeight: 20 }}>
            {error ?? "It may have been replaced. Ask the assignor for their current QR code."}
          </Text>
          <View className="mt-6">
            <Button label="Back" fullWidth onPress={() => router.replace("/my-organizations" as any)} />
          </View>
        </View>
      ) : (
        <View>
          <Text className="font-mono-bold text-[10px] text-signal uppercase mb-3" style={{ letterSpacing: 2 }}>
            ROSTER INVITATION
          </Text>
          <Text className="text-ink font-display" style={{ fontSize: 36, lineHeight: 40, letterSpacing: -1.5 }}>
            JOIN {preview?.display_name.toUpperCase()}&apos;S{"\n"}
            <Text className="text-signal">ROSTER?</Text>
          </Text>
          <Text className="text-ink-80 mt-3" style={{ fontSize: 14, lineHeight: 20 }}>
            {preview?.city ? `${preview.city}, ${preview.state}. ` : ""}
            They&apos;ll be able to offer you games, and you&apos;ll see the games they open to their roster. You can also be on other
            rosters, and you can leave any time.
          </Text>
          <View className="mt-7">
            <Button label="Join roster" fullWidth loading={state === "joining"} loadingLabel="Joining" onPress={join} />
          </View>
          <View className="mt-2">
            <TextLink label="Not now" tone="ink" size={11} onPress={() => router.back()} />
          </View>
        </View>
      )}
    </View>
  );
}
