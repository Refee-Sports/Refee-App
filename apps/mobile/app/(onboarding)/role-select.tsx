import { useState } from "react";
import { Text, View, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";
import { choice, palette, radius } from "@refee/design";
import { Button } from "@/components/ui/Button";
import { BackButton, IconButton } from "@/components/ui/Controls";
import { Tappable } from "@/components/ui/Tappable";
import { choiceLook } from "@/lib/ui/looks";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Wordmark } from "@/components/ui/Wordmark";
import { supabase } from "@/lib/supabase";

type Role = "referee" | "director" | "assignor";

const ROLES: { id: Role; title: string; subtitle: string; description: string }[] = [
  {
    id: "referee",
    title: "REFEREE",
    subtitle: "OFFICIAL",
    description: "Find games to work in your area. Set your rate, accept assignments, and get paid.",
  },
  {
    id: "director",
    title: "TOURNAMENT\nDIRECTOR",
    subtitle: "ORGANIZER",
    description: "Create tournaments and post game assignments. Hire referees directly or through an assignor.",
  },
  {
    id: "assignor",
    title: "ASSIGNOR",
    subtitle: "STAFFING PARTNER",
    description: "Get hired by tournament directors to staff their events. Build a roster of referees and assign them to games.",
  },
];

export default function RoleSelect() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<Role | null>(null);

  const handleSelect = (role: Role) => {
    Haptics.selectionAsync();
    setSelected(role);
  };

  const handleContinue = () => {
    if (!selected) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (selected === "director") {
      router.push("/(onboarding)/director" as any);
    } else if (selected === "assignor") {
      router.push("/(onboarding)/assignor" as any);
    } else {
      router.push("/(onboarding)/" as any);
    }
  };

  const handleBack = () => {
    Haptics.selectionAsync();
    Alert.alert(
      "Go back?",
      "You'll be signed out and returned to the welcome screen.",
      [
        { text: "Stay", style: "cancel" },
        {
          text: "Go back",
          style: "destructive",
          onPress: async () => {
            await supabase.auth.signOut();
          },
        },
      ]
    );
  };

  const handleExit = () => {
    Haptics.selectionAsync();
    Alert.alert(
      "Leave setup?",
      "You can finish your profile next time you sign in.",
      [
        { text: "Stay", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: async () => {
            await supabase.auth.signOut();
          },
        },
      ]
    );
  };

  return (
    <View className="flex-1 bg-paper" style={{ paddingTop: insets.top }}>
      {/* Nav header */}
      <View className="flex-row items-center justify-between px-5 py-3">
        <BackButton onPress={handleBack} />
        <Text
          className="text-ink-60 font-mono-bold text-[9px] uppercase"
          style={{ letterSpacing: 2 }}
        >
          <Text className="text-signal">01</Text>
          {" / 02 · CHOOSE YOUR ROLE"}
        </Text>
        <IconButton
          accessibilityLabel="Exit setup"
          onPress={handleExit}
          icon={(color) => <Feather name="x" size={16} color={color} />}
        />
      </View>

      <View className="h-0.5 bg-ink-20 mx-5 mb-5">
        <View className="h-full bg-signal" style={{ width: "50%" }} />
      </View>

      {/* Header */}
      <View className="px-5 pb-5">
        <Wordmark size={28} />
      </View>

      {/* Headline */}
      <View className="px-5 mb-8">
        <Text
          className="font-display text-ink"
          style={{ fontSize: 42, lineHeight: 40, letterSpacing: -2 }}
        >
          {"I AM A..."}
        </Text>
      </View>

      {/* Role cards */}
      <View className="px-5 gap-3 flex-1">
        {ROLES.map((role) => {
          const isSelected = selected === role.id;
          return (
            <Tappable
              key={role.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              onPress={() => handleSelect(role.id)}
              scaleTo={choice.scale.card}
              style={({ pressed }) => {
                const c = choiceLook({ selected: isSelected, pressed });
                return {
                  borderWidth: 1.5,
                  borderRadius: radius.lg,
                  borderColor: c.border,
                  backgroundColor: c.bg,
                  paddingHorizontal: 20,
                  paddingVertical: 20,
                };
              }}
            >
              <View className="flex-row items-start justify-between mb-3">
                <View>
                  <Text
                    className={`font-display ${isSelected ? "text-signal" : "text-ink"}`}
                    style={{ fontSize: 28, lineHeight: 34, letterSpacing: -1, paddingTop: 2 }}
                  >
                    {role.title}
                  </Text>
                  <Text
                    className={`font-mono-bold text-[9px] uppercase mt-1 ${
                      isSelected ? "text-signal" : "text-ink-60"
                    }`}
                    style={{ letterSpacing: 2.5 }}
                  >
                    {role.subtitle}
                  </Text>
                </View>
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: radius.full,
                    borderWidth: 1.5,
                    borderColor: isSelected ? palette.signal : palette.ink40,
                    backgroundColor: isSelected ? palette.signal : palette.paper,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {isSelected && <Feather name="check" size={14} color={palette.paper} />}
                </View>
              </View>
              <Text
                className={`font-mono text-[11px] leading-[16px] ${
                  isSelected ? "text-signal-deep" : "text-ink-60"
                }`}
              >
                {role.description}
              </Text>
            </Tappable>
          );
        })}
      </View>

      {/* Footer CTA */}
      <View
        className="px-5 border-t border-ink bg-paper pt-4"
        style={{ paddingBottom: insets.bottom + 16 }}
      >
        <Button label="Continue" showArrow fullWidth disabled={!selected} onPress={handleContinue} />
      </View>
    </View>
  );
}
