import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "@/lib/supabase";
import {
  backgroundCheckLabel,
  backgroundCheckState,
  fetchMyBackgroundCheck,
  getBackgroundCheckUrl,
  removeBackgroundCheck,
  uploadBackgroundCheck,
  type BackgroundCheckRow,
} from "@/lib/referee/backgroundCheck";
import { pickBackgroundCheckFile } from "@/lib/roster/files";

const STATE_STYLE = {
  none: { bg: "bg-chalk", border: "border-ink-20", text: "text-ink-60", title: "NO BACKGROUND CHECK ON FILE" },
  valid: { bg: "bg-court/10", border: "border-court", text: "text-court", title: "BACKGROUND CHECK CURRENT" },
  expiring: { bg: "bg-hivis", border: "border-ink", text: "text-ink", title: "EXPIRING SOON" },
  expired: { bg: "bg-foul/10", border: "border-foul", text: "text-foul", title: "BACKGROUND CHECK EXPIRED" },
} as const;

/**
 * Referees can upload their background check. It counts for one year from the
 * upload date, then needs replacing. Directors and assignors see whether it's
 * current — never the file itself.
 */
export default function BackgroundCheckScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [userId, setUserId] = useState<string | null>(null);
  const [check, setCheck] = useState<BackgroundCheckRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setLoading(false);
      return;
    }
    setUserId(session.user.id);
    const result = await fetchMyBackgroundCheck(session.user.id);
    setCheck(result.check);
    setError(result.error?.message ?? null);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const upload = async () => {
    if (!userId || busy) return;
    Haptics.selectionAsync();
    setError(null);
    try {
      const file = await pickBackgroundCheckFile();
      if (!file) return;
      setBusy(true);
      const { check: saved, error: e } = await uploadBackgroundCheck(userId, {
        body: file.body,
        fileName: file.fileName,
        mimeType: file.mimeType,
        size: file.size,
      });
      if (e) {
        setError(e.message);
        return;
      }
      // A replacement supersedes the old file: remove it so only one is kept.
      if (check && saved) await removeBackgroundCheck(check);
      setCheck(saved);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that file.");
    } finally {
      setBusy(false);
    }
  };

  const view = async () => {
    if (!check) return;
    const { url, error: e } = await getBackgroundCheckUrl(check.file_path);
    if (e || !url) {
      Alert.alert("Couldn't open the file", e?.message ?? "Try again.");
      return;
    }
    await WebBrowser.openBrowserAsync(url);
  };

  const remove = () => {
    if (!check) return;
    Alert.alert("Remove your background check?", "Directors and assignors will no longer see one on your profile.", [
      { text: "Keep it", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          void removeBackgroundCheck(check).then(({ error: e }) => {
            if (e) Alert.alert("Couldn't remove it", e.message);
            else setCheck(null);
          });
        },
      },
    ]);
  };

  const state = backgroundCheckState(check?.expires_at);
  const style = STATE_STYLE[state];

  return (
    <View className="flex-1 bg-paper" style={{ paddingTop: insets.top }}>
      <View className="px-5 py-3 flex-row items-center justify-between border-b border-ink">
        <Pressable
          onPress={() => router.back()}
          className="w-9 h-9 border border-ink items-center justify-center active:opacity-70"
        >
          <Feather name="arrow-left" size={16} color="#08111C" />
        </Pressable>
        <Text className="font-mono-bold text-[9px] text-ink uppercase" style={{ letterSpacing: 1.5 }}>
          BACKGROUND CHECK
        </Text>
        <View className="w-9" />
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator color="#1F4FCC" /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}>
          <Text className="text-ink font-display" style={{ fontSize: 34, lineHeight: 38, letterSpacing: -1.5 }}>
            SHOW YOU&apos;RE{"\n"}
            <Text className="text-signal">CLEARED.</Text>
          </Text>
          <Text className="text-ink-80 mt-3 mb-5" style={{ fontSize: 14, lineHeight: 20 }}>
            Upload your background check (a PDF or a photo). It&apos;s good for one year from the day you upload it — after that
            you&apos;ll need to add a new one. Directors and assignors can see that you have a current check, but never the document.
          </Text>

          <View className={`border px-4 py-4 ${style.bg} ${style.border}`}>
            <Text className={`font-mono-bold text-[10px] uppercase ${style.text}`} style={{ letterSpacing: 1.5 }}>
              {style.title}
            </Text>
            {check ? (
              <>
                <Text className="font-display text-ink mt-2" style={{ fontSize: 20, letterSpacing: -0.5 }}>
                  {backgroundCheckLabel(check.expires_at).toUpperCase()}
                </Text>
                <Text className="font-mono text-[9px] text-ink-60 uppercase mt-1" style={{ letterSpacing: 1 }} numberOfLines={1}>
                  {check.file_name ?? "Uploaded file"} · UPLOADED{" "}
                  {new Date(check.uploaded_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toUpperCase()}
                </Text>
              </>
            ) : null}
          </View>

          {state === "expiring" || state === "expired" ? (
            <Text className="text-foul font-mono-bold text-[10px] uppercase mt-3" style={{ letterSpacing: 1.2 }}>
              {state === "expired"
                ? "Your check has expired. Upload a new one so assignors and directors see you as current."
                : "Upload a new one before this expires so there's no gap."}
            </Text>
          ) : null}

          <Pressable
            onPress={upload}
            disabled={busy}
            className="bg-ink py-4 items-center mt-5 flex-row justify-center gap-2 active:opacity-80"
          >
            {busy ? (
              <ActivityIndicator color="#E5E1D6" />
            ) : (
              <>
                <Feather name="upload" size={14} color="#E5E1D6" />
                <Text className="text-paper font-mono-bold text-[12px] uppercase" style={{ letterSpacing: 2 }}>
                  {check ? "UPLOAD A NEW ONE" : "UPLOAD BACKGROUND CHECK"}
                </Text>
              </>
            )}
          </Pressable>

          {check ? (
            <View className="flex-row gap-2 mt-3">
              <Pressable onPress={view} className="flex-1 border border-ink py-3 items-center active:opacity-70">
                <Text className="text-ink font-mono-bold text-[10px] uppercase" style={{ letterSpacing: 1.5 }}>VIEW MY FILE</Text>
              </Pressable>
              <Pressable onPress={remove} className="flex-1 border border-foul py-3 items-center active:opacity-70">
                <Text className="text-foul font-mono-bold text-[10px] uppercase" style={{ letterSpacing: 1.5 }}>REMOVE</Text>
              </Pressable>
            </View>
          ) : null}

          {error ? <Text className="text-foul font-mono text-[10px] uppercase mt-4">{error}</Text> : null}
        </ScrollView>
      )}
    </View>
  );
}
