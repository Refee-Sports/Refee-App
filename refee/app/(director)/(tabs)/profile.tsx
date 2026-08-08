import { useEffect, useState } from "react";
import { Text, View, Pressable, ActivityIndicator, Alert } from "react-native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import { useStripe } from "@stripe/stripe-react-native";
import { ScrollScreen } from "@/components/layout/ScrollScreen";
import { Wordmark } from "@/components/ui/Wordmark";
import { ZebraRule } from "@/components/ui/ZebraRule";
import { supabase } from "@/lib/supabase";
import { fetchMyHirerProfile, type HirerRow } from "@/lib/director/queries";
import { getCardSetupParams } from "@/lib/payments/queries";
import { unregisterPushToken } from "@/lib/push/notifications";

const ORG_TYPE_LABELS: Record<string, string> = {
  tournament: "TOURNAMENT ORGANIZER",
  league: "LEAGUE",
  school: "SCHOOL / UNIVERSITY",
  parks_rec: "PARKS & REC",
};

export default function DirectorProfile() {
  const tabBarHeight = useBottomTabBarHeight();
  const [hirer, setHirer] = useState<HirerRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }
      const { data } = await fetchMyHirerProfile(session.user.id);
      setHirer(data as HirerRow | null);
      setLoading(false);
    })();
  }, []);

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
        <ActivityIndicator color="#1F4FCC" />
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
            <Text className="font-mono-bold" style={{ color: "#00A85C" }}>✓ VERIFIED</Text>
          ) : "UNVERIFIED"}
        </Text>
      </View>
      <View className="px-5 mb-4">
        <ZebraRule variant="signal" thin />
      </View>

      {/* Avatar pill */}
      <View className="px-5 flex-row items-center gap-4 mb-5">
        <View className="w-16 h-16 bg-ink border border-ink items-center justify-center">
          <Text className="text-paper font-display" style={{ fontSize: 22, letterSpacing: -1 }}>
            {initials}
          </Text>
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
        <InfoRow label="STATUS" value={hirer.is_verified ? "VERIFIED ✓" : "PENDING VERIFICATION"} />
      </View>

      {/* Payment method */}
      <Pressable
        onPress={handleSaveCard}
        disabled={savingCard}
        className={`mx-5 mb-4 border px-4 py-3.5 flex-row items-center justify-between active:opacity-80 ${
          cardSaved ? "border-court bg-court/10" : "border-ink bg-ink"
        }`}
      >
        <View className="flex-1 pr-3">
          <Text
            className={`font-mono-bold text-[11px] uppercase ${cardSaved ? "" : "text-paper"}`}
            style={{ letterSpacing: 1.5, ...(cardSaved ? { color: "#00A85C" } : {}) }}
          >
            {savingCard ? "OPENING STRIPE..." : cardSaved ? "✓ AUTO-PAY ON" : "SET UP AUTO-PAY"}
          </Text>
          <Text
            className="font-mono text-[9px] uppercase mt-0.5"
            style={{ letterSpacing: 1, color: cardSaved ? "rgba(8,17,28,0.56)" : "rgba(229,225,214,0.6)" }}
          >
            {cardSaved
              ? "COMPLETED GAMES CHARGE YOUR CARD & PAY REFS AUTOMATICALLY"
              : "SAVE A CARD — CREWS GET PAID AUTOMATICALLY AT COMPLETION"}
          </Text>
        </View>
        {savingCard ? (
          <ActivityIndicator color="#C9F031" size="small" />
        ) : (
          <Feather name={cardSaved ? "check-circle" : "credit-card"} size={16} color={cardSaved ? "#00A85C" : "#C9F031"} />
        )}
      </Pressable>

      {/* Sign out */}
      <View className="mx-5 mt-6">
        <Pressable onPress={signOut} className="border border-foul py-4 active:opacity-70">
          <Text className="text-foul text-center font-mono-bold uppercase" style={{ fontSize: 11, letterSpacing: 2 }}>
            SIGN OUT
          </Text>
        </Pressable>
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
