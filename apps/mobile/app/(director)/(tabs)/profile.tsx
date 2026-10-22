import { verificationLabel } from "@/lib/identity/queries";
import { useCallback, useState } from "react";
import { Text, View, ActivityIndicator, Alert, Image } from "react-native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import { useStripe } from "@/lib/payments/stripe";
import { ScrollScreen } from "@/components/layout/ScrollScreen";
import { Wordmark } from "@/components/ui/Wordmark";
import { ZebraRule } from "@/components/ui/ZebraRule";
import { supabase } from "@/lib/supabase";
import { fetchMyHirerProfile, type HirerRow } from "@/lib/director/queries";
import { fetchMyProfile } from "@/lib/profile/queries";
import { getCardSetupParams } from "@/lib/payments/queries";
import { unregisterPushToken } from "@/lib/push/notifications";
import { RoleSwitcher } from "@/components/ui/RoleSwitcher";
import { NotificationsRow } from "@/components/profile/NotificationsRow";
import { buttonPressScale, palette, radius } from "@refee/design";
import { Button } from "@/components/ui/Button";
import { Tappable } from "@/components/ui/Tappable";

const ORG_TYPE_LABELS: Record<string, string> = {
  tournament: "TOURNAMENT ORGANIZER",
  league: "LEAGUE",
  school: "SCHOOL / UNIVERSITY",
  parks_rec: "PARKS & REC",
};

export default function DirectorProfile() {
  const router = useRouter();
  const tabBarHeight = useBottomTabBarHeight();
  const [hirer, setHirer] = useState<HirerRow | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Reload on focus so edits made on the edit screen show straight away.
  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setLoading(false); return; }
        const [{ data }, { data: profile }] = await Promise.all([
          fetchMyHirerProfile(session.user.id),
          fetchMyProfile(session.user.id),
        ]);
        setHirer(data as HirerRow | null);
        setAvatarUrl(profile?.avatar_url ?? null);
        setLoading(false);
      })();
    }, [])
  );

  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [savingCard, setSavingCard] = useState(false);
  const [cardSaved, setCardSaved] = useState(false);

  const handleSaveCard = async () => {
    if (savingCard) return;
    Haptics.selectionAsync();
    setSavingCard(true);
    try {
      const { params, error: pErr } = await getCardSetupParams();
      if (pErr || !params) {
        Alert.alert(
          "Payments unavailable",
          pErr?.message ?? "Could not reach Stripe. Is the local functions server running?"
        );
        return;
      }
      const { error: initErr } = await initPaymentSheet({
        setupIntentClientSecret: params.setupIntentClientSecret,
        customerId: params.customerId,
        customerEphemeralKeySecret: params.ephemeralKeySecret,
        merchantDisplayName: "Refee",
      });
      if (initErr) {
        Alert.alert("Error", initErr.message);
        return;
      }
      const { error: sheetErr } = await presentPaymentSheet();
      if (sheetErr) {
        if (sheetErr.code !== "Canceled") Alert.alert("Card not saved", sheetErr.message);
        return;
      }
      setCardSaved(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Card saved",
        "Completed games will now be paid automatically — your card is charged and referees receive their pay without any extra steps."
      );
    } finally {
      setSavingCard(false);
    }
  };

  const signOut = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await unregisterPushToken();
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <View className="flex-1 bg-paper items-center justify-center">
        <ActivityIndicator color={palette.signal} />
      </View>
    );
  }

  if (!hirer) {
    return (
      <View className="flex-1 bg-paper items-center justify-center px-6">
        <Text className="text-ink font-mono-bold text-sm uppercase text-center" style={{ letterSpacing: 1 }}>
          Profile not found.
        </Text>
      </View>
    );
  }

  const contactName = hirer.contact_first_name
    ? `${hirer.contact_first_name} ${hirer.contact_last_initial ?? ""}.`.toUpperCase()
    : "—";
  const initials = hirer.contact_first_name
    ? `${hirer.contact_first_name[0]}${hirer.contact_last_initial ?? ""}`.toUpperCase()
    : "TD";

  return (
    <ScrollScreen bottomOffset={tabBarHeight}>
      {/* App header */}
      <View className="px-5 pt-1 pb-3 flex-row items-center justify-between">
        <Wordmark size={26} />
      </View>

      {/* Telemetry */}
      <View className="px-5 pb-1.5 flex-row justify-between items-center">
        <Text className="font-mono text-[9px] text-ink-60 uppercase" style={{ letterSpacing: 2 }}>
          <Text className="font-mono-bold text-ink">DIRECTOR</Text>
          {" · PROFILE"}
        </Text>
        <Text className="font-mono text-[9px] text-ink-60 uppercase" style={{ letterSpacing: 2 }}>
          {hirer.is_verified ? (
            <Text className="font-mono-bold" style={{ color: palette.court }}>✓ {verificationLabel(true)}</Text>
          ) : verificationLabel(false)}
        </Text>
      </View>
      <View className="px-5 mb-4">
        <ZebraRule variant="signal" thin />
      </View>

      {/* Avatar pill */}
      <View className="px-5 flex-row items-center gap-4 mb-5">
        <View className="w-16 h-16 bg-ink border border-ink items-center justify-center overflow-hidden">
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={{ width: 64, height: 64 }} accessibilityLabel="Your photo" />
          ) : (
            <Text className="text-paper font-display" style={{ fontSize: 22, letterSpacing: -1 }}>
              {initials}
            </Text>
          )}
        </View>
        <View className="flex-1">
          <Text className="font-mono text-[9px] text-ink-60 uppercase" style={{ letterSpacing: 2 }}>
            DIRECTOR
          </Text>
          <Text className="font-mono-bold text-[11px] text-ink uppercase mt-0.5" style={{ letterSpacing: 1.5 }}>
            {contactName}
          </Text>
        </View>
      </View>

      {/* Org hero */}
      <View className="mx-5 border-t border-b border-ink pt-5 pb-5 mb-4">
        <Text
          className="font-display text-ink uppercase"
          style={{ fontSize: 34, lineHeight: 32, letterSpacing: -1.5 }}
        >
          {hirer.org_name.toUpperCase()}
        </Text>
        <Text
          className="font-mono text-ink-60 text-[10px] uppercase mt-2"
          style={{ letterSpacing: 2 }}
        >
          {ORG_TYPE_LABELS[hirer.org_type] ?? hirer.org_type.toUpperCase()}
        </Text>
        {(hirer.city || hirer.state) && (
          <Text
            className="font-mono text-ink-60 text-[10px] uppercase mt-1"
            style={{ letterSpacing: 1.5 }}
          >
            {[hirer.city?.toUpperCase(), hirer.state?.toUpperCase()].filter(Boolean).join(", ")}
          </Text>
        )}
      </View>

      {/* Info rows */}
      <View className="mx-5 border border-ink bg-chalk mb-4">
        <InfoRow label="CONTACT" value={contactName} />
        <View className="h-px bg-ink-20" />
        <InfoRow label="ORG TYPE" value={ORG_TYPE_LABELS[hirer.org_type] ?? hirer.org_type.toUpperCase()} />
        <View className="h-px bg-ink-20" />
        <InfoRow label="SPORT" value="BASKETBALL" />
        <View className="h-px bg-ink-20" />
        <InfoRow label="STATUS" value={hirer.is_verified ? `${verificationLabel(true)} ✓` : verificationLabel(false)} />
      </View>

      {/* Payment method */}
      <Tappable
        onPress={handleSaveCard}
        disabled={savingCard}
        accessibilityRole="button"
        accessibilityLabel={cardSaved ? "Auto-pay is on" : "Set up auto-pay"}
        scaleTo={buttonPressScale}
        haptic="light"
        wrapperStyle={{ marginHorizontal: 20, marginBottom: 16 }}
        style={({ pressed }) => ({
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: cardSaved ? palette.court : palette.ink,
          backgroundColor: cardSaved ? (pressed ? palette.chalkPress : palette.chalk) : pressed ? palette.inkPress : palette.ink,
          paddingHorizontal: 16,
          paddingVertical: 14,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        })}
      >
        <View className="flex-1 pr-3">
          <Text
            className={`font-mono-bold text-[11px] uppercase ${cardSaved ? "" : "text-paper"}`}
            style={{ letterSpacing: 1.5, ...(cardSaved ? { color: palette.courtInk } : {}) }}
          >
            {savingCard ? "OPENING STRIPE..." : cardSaved ? "✓ AUTO-PAY ON" : "SET UP AUTO-PAY"}
          </Text>
          <Text
            className={`font-mono text-[9px] uppercase mt-0.5 ${cardSaved ? "text-ink-60" : "text-paper/70"}`}
            style={{ letterSpacing: 1 }}
          >
            {cardSaved
              ? "COMPLETED GAMES CHARGE YOUR CARD & PAY REFS AUTOMATICALLY"
              : "SAVE A CARD — CREWS GET PAID AUTOMATICALLY AT COMPLETION"}
          </Text>
        </View>
        {savingCard ? (
          <ActivityIndicator color={palette.hiVis} size="small" />
        ) : (
          <Feather name={cardSaved ? "check-circle" : "credit-card"} size={16} color={cardSaved ? palette.court : palette.hiVis} />
        )}
      </Tappable>

      <View className="px-5 mt-4">
        <NotificationsRow />
      </View>

      <View className="px-5 mt-6">
        <RoleSwitcher />
      </View>

      <View className="mx-5 mt-4">
        <Button label="Edit profile" variant="secondary" fullWidth onPress={() => router.push({ pathname: "/edit-details", params: { role: "director" } } as any)} />
      </View>

      <View className="mx-5 mt-4">
        <Button label="Account & sign-in" variant="secondary" fullWidth onPress={() => router.push("/account" as any)} />
      </View>

      {/* Sign out */}
      <View className="mx-5 mt-6">
        <Button label="Sign out" variant="secondary" fullWidth icon={<Feather name="log-out" size={14} color={palette.ink} />} onPress={signOut} />
      </View>
    </ScrollScreen>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center px-4 py-3.5 justify-between">
      <Text className="font-mono text-[9px] text-ink-40 uppercase" style={{ letterSpacing: 2 }}>
        {label}
      </Text>
      <Text className="font-mono-bold text-[11px] text-ink uppercase" style={{ letterSpacing: 0.5 }}>
        {value}
      </Text>
    </View>
  );
}
