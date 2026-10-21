import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { supabase } from "@/lib/supabase";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  NOTIFICATION_SWITCHES,
  fetchNotificationPreferences,
  saveNotificationPreference,
  type NotificationKind,
  type NotificationPreferences,
} from "@/lib/push/preferences";
import { useOnboardingStore } from "@/lib/stores/onboarding-store";

/**
 * Three switches: new games near me, crew messages, game updates. Each saves as
 * soon as it is flipped, and the backend skips anyone who turned a kind off.
 * New-game alerts are for referees, so other roles don't see that switch.
 */
export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { primaryRole } = useOnboardingStore();

  const [userId, setUserId] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<NotificationPreferences>({ ...DEFAULT_NOTIFICATION_PREFERENCES });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      (async () => {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          if (live) setLoading(false);
          return;
        }
        const result = await fetchNotificationPreferences(session.user.id);
        if (!live) return;
        setUserId(session.user.id);
        setPrefs(result.prefs);
        setError(result.error);
        setLoading(false);
      })();
      return () => {
        live = false;
      };
    }, [])
  );

  const flip = async (kind: NotificationKind, value: boolean) => {
    if (!userId) return;
    const before = prefs[kind];
    Haptics.selectionAsync();
    setPrefs((p) => ({ ...p, [kind]: value }));
    const { error: saveError } = await saveNotificationPreference(userId, kind, value);
    if (saveError) {
      setPrefs((p) => ({ ...p, [kind]: before }));
      setError(saveError);
    } else {
      setError(null);
    }
  };

  const switches = NOTIFICATION_SWITCHES.filter((s) => s.kind !== "new_games" || primaryRole === "referee");

  return (
    <View className="flex-1 bg-paper" style={{ paddingTop: insets.top }}>
      <View className="px-5 py-3 flex-row items-center justify-between border-b border-ink">
        <Pressable
          onPress={() => router.back()}
          className="w-9 h-9 border border-ink items-center justify-center active:opacity-70"
          accessibilityLabel="Back"
        >
          <Feather name="arrow-left" size={16} color="#08111C" />
        </Pressable>
        <Text className="font-mono-bold text-[9px] text-ink uppercase" style={{ letterSpacing: 1.5 }}>
          NOTIFICATIONS
        </Text>
        <View className="w-9" />
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#1F4FCC" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}>
          <Text className="text-ink font-display" style={{ fontSize: 34, lineHeight: 38, letterSpacing: -1.5 }}>
            WHAT WE{"\n"}
            <Text className="text-signal">PUSH.</Text>
          </Text>
          <Text className="text-ink-80 mt-3 mb-5" style={{ fontSize: 14, lineHeight: 20 }}>
            Turn off a kind of notification and we stop sending it to this phone. You&apos;ll still see everything in the app.
          </Text>

          <View className="border border-ink bg-chalk">
            {switches.map((s, i) => (
              <View key={s.kind}>
                {i > 0 ? <View className="h-px bg-ink-20" /> : null}
                <View className="px-4 py-4 flex-row items-center justify-between">
                  <View className="flex-1 pr-4">
                    <Text className="text-ink font-body-bold" style={{ fontSize: 15 }}>
                      {s.label}
                    </Text>
                    <Text className="text-ink-60 mt-1" style={{ fontSize: 12, lineHeight: 17 }}>
                      {s.description}
                    </Text>
                  </View>
                  <Switch
                    value={prefs[s.kind]}
                    onValueChange={(v) => void flip(s.kind, v)}
                    trackColor={{ false: "rgba(8,17,28,0.18)", true: "#1F4FCC" }}
                    thumbColor="#F5F2EA"
                    accessibilityLabel={s.label}
                  />
                </View>
              </View>
            ))}
          </View>

          {error ? (
            <Text className="text-foul-ink font-mono text-[10px] uppercase mt-4" style={{ letterSpacing: 1 }}>
              {error}
            </Text>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}
