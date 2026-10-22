import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import { ScrollScreen } from "@/components/layout/ScrollScreen";
import { supabase } from "@/lib/supabase";
import { useOnboardingStore } from "@/lib/stores/onboarding-store";
import {
  fetchMyIdentityStatus,
  skipVerificationWarning,
  startIdentityVerification,
  type IdentityStatus,
} from "@/lib/identity/queries";
import { palette } from "@refee/design";
import { Button } from "@/components/ui/Button";
import { TextLink } from "@/components/ui/Controls";

const POLL_MS = 3000;
const GIVE_UP_MS = 60_000;

const HOME: Record<string, string> = {
  director: "/(director)/(tabs)/tournaments",
  assignor: "/(assignor)/(tabs)/tournaments",
  referee: "/(app)/(tabs)/jobs",
};

/**
 * Where someone proves who they are. The check runs on Didit's own pages, in a
 * browser sheet — Refee never receives the ID images or the selfie — and the
 * decision arrives at the backend, signed. Nothing the sheet hands back is
 * trusted here; we ask our own backend what the answer was.
 */
export default function Verify() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { primaryRole } = useOnboardingStore();

  const [status, setStatus] = useState<IdentityStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Why the last check went to review or didn't pass, in plain words.
  const [reason, setReason] = useState<string | null>(null);
  const cancelled = useRef(false);

  const home = HOME[primaryRole ?? "referee"] ?? HOME.referee;

  useEffect(() => {
    cancelled.current = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled.current) return;
      const current = await fetchMyIdentityStatus(user.id);
      if (!cancelled.current) {
        setStatus(current.status);
        setReason(current.reason);
      }
    })();
    return () => {
      cancelled.current = true;
    };
  }, []);

  /** Ask our backend for the decision until it lands, or until it's clearly not coming. */
  const pollForDecision = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const startedAt = Date.now();
    setWaiting(true);

    while (!cancelled.current && Date.now() - startedAt < GIVE_UP_MS) {
      const next = await fetchMyIdentityStatus(user.id);
      if (cancelled.current) return;
      setStatus(next.status);
      setReason(next.reason);
      if (next.status === "approved") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setWaiting(false);
        router.replace(home as any);
        return;
      }
      if (next.status === "declined") break;
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
    setWaiting(false);
  }, [home, router]);

  const start = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    setError(null);

    const { url, error: startError } = await startIdentityVerification();
    if (startError) {
      setError(startError.message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setLoading(false);
      return;
    }
    if (!url) {
      // Nothing to do right now — already approved, or with Didit's reviewers.
      setLoading(false);
      await pollForDecision();
      return;
    }

    // The sheet closes when Didit sends them back, or when they dismiss it.
    // Either way the answer comes from our backend, not from this result.
    await WebBrowser.openAuthSessionAsync(
      url,
      makeRedirectUri({ scheme: "refee", path: "verify" })
    );
    setLoading(false);
    await pollForDecision();
  };

  const skip = () => {
    Haptics.selectionAsync();
    router.replace(home as any);
  };

  // "I'll do this later" asks once, so nobody skips without knowing what it costs.
  const confirmSkip = () => {
    Haptics.selectionAsync();
    Alert.alert("Skip verification for now?", skipVerificationWarning(primaryRole), [
      { text: "Verify now", onPress: () => void start() },
      { text: "Skip for now", style: "destructive", onPress: () => router.replace(home as any) },
    ]);
  };

  if (status === "approved") {
    return (
      <Shell insets={insets} line1="YOU'RE" line2="VERIFIED">
        <Body>Your ID has been confirmed. You can take, post and staff games.</Body>
        <Primary label="CONTINUE" onPress={skip} />
      </Shell>
    );
  }

  if (status === "in_review" || waiting) {
    return (
      <Shell insets={insets} line1="WE'RE" line2="CHECKING">
        <Body>
          {waiting
            ? "Hang on while we get the result."
            : "Someone is looking at your ID now. This usually takes a few minutes."}
        </Body>
        {!waiting && reason ? <ReasonLine text={reason} /> : null}
        {waiting ? <ActivityIndicator className="mt-6" color={palette.ink} /> : null}
        <Primary label="KEEP LOOKING AROUND" onPress={skip} />
      </Shell>
    );
  }

  const retrying =
    status === "declined" || status === "expired" || status === "abandoned";

  return (
    <Shell
      insets={insets}
      line1={retrying ? "LET'S TRY" : "VERIFY"}
      line2={retrying ? "AGAIN" : "YOUR ID"}
    >
      <Body>
        {retrying
          ? "That check didn't go through. You can start a new one — have your ID ready, and good light helps."
          : "Refee is open to anyone, so we check that every person on it is real and who they say they are. Directors are handing you their games; referees are handing you their pay."}
      </Body>
      {retrying && reason ? <ReasonLine text={reason} /> : null}

      <View className="mt-6 border border-ink-20 px-4 py-4 gap-3">
        {[
          "Photograph your government ID",
          "Take a short selfie",
          "That's it — usually under two minutes",
        ].map((step, i) => (
          <View key={step} className="flex-row gap-3">
            <Text
              className="text-signal font-mono-bold text-[10px]"
              style={{ letterSpacing: 1.5 }}
            >
              {String(i + 1).padStart(2, "0")}
            </Text>
            <Text className="flex-1 text-ink text-[13px] leading-[20px]">{step}</Text>
          </View>
        ))}
      </View>

      {/* Face match and liveness are biometric processing; several states
          require saying so plainly before anything is captured. */}
      <Text className="mt-5 text-ink-60 text-[11px] leading-[16px]">
        Our identity partner, Didit, scans your ID and compares it to your selfie
        to confirm it&apos;s you. That includes a biometric face match. Refee never
        receives or stores your ID images. By continuing you agree to Didit
        performing this check.
      </Text>

      {error ? (
        <Text
          className="mt-4 text-foul-ink font-mono text-[10px] uppercase"
          style={{ letterSpacing: 1 }}
        >
          {error}
        </Text>
      ) : null}

      <Primary
        label={loading ? "STARTING…" : retrying ? "START A NEW CHECK" : "VERIFY MY ID"}
        onPress={() => void start()}
        disabled={loading}
      />
      <View className="mt-2">
        <TextLink label="I'll do this later" size={10} onPress={confirmSkip} />
      </View>
    </Shell>
  );
}

function Shell({
  insets,
  line1,
  line2,
  children,
}: {
  insets: { top: number; bottom: number };
  line1: string;
  line2: string;
  children: React.ReactNode;
}) {
  return (
    <ScrollScreen>
      <View
        className="flex-1 bg-paper px-5"
        style={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }}
      >
        <Text
          className="font-display text-ink"
          style={{ fontSize: 40, lineHeight: 44, letterSpacing: -1.5 }}
        >
          {line1}
          {"\n"}
          <Text className="text-signal">{line2}</Text>
        </Text>
        <View className="mt-4">{children}</View>
      </View>
    </ScrollScreen>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return <Text className="text-ink-80 text-[14px] leading-[20px]">{children}</Text>;
}

function Primary({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <View className="mt-6">
      <Button label={label} showArrow fullWidth disabled={disabled} onPress={onPress} />
    </View>
  );
}

/** Why the last check ended the way it did — plain words, never the data behind it. */
function ReasonLine({ text }: { text: string }) {
  return (
    <View className="mt-3 border-l-2 border-foul pl-3">
      <Text className="text-ink text-[13px] leading-[20px]">{text}</Text>
    </View>
  );
}
