import { useState } from "react";
import { Text, View, Pressable, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Wordmark } from "@/components/ui/Wordmark";
import { supabase } from "@/lib/supabase";

type Role = "referee" | "director";

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
        <Pressable
          onPress={handleBack}
          className="w-9 h-9 border border-ink bg-chalk items-center justify-center active:opacity-70"
        >
          <Text className="text-ink font-mono-bold text-base">←</Text>
        </Pressable>
        <Text
          className="text-ink-60 font-mono-bold text-[9px] uppercase"
          style={{ letterSpacing: 2 }}
        >
          <Text className="text-signal">01</Text>
          {" / 02 · CHOOSE YOUR ROLE"}
        </Text>
        <Pressable
          onPress={handleExit}
          className="w-9 h-9 border border-ink bg-chalk items-center justify-center active:opacity-70"
        >
          <Text className="text-ink font-mono-bold text-base">✕</Text>
        </Pressable>
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
            <Pressable
              key={role.id}
              onPress={() => handleSelect(role.id)}
              className={`border-[2px] px-5 py-5 active:opacity-80 ${
                isSelected ? "border-signal bg-signal/10" : "border-ink bg-chalk"
              }`}
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
                      isSelected ? "text-signal/70" : "text-ink-40"
                    }`}
                    style={{ letterSpacing: 2.5 }}
                  >
                    {role.subtitle}
                  </Text>
                </View>
                <View
                  className={`w-6 h-6 border-2 items-center justify-center ${
                    isSelected ? "border-signal bg-signal" : "border-ink-40 bg-paper"
                  }`}
                >
                  {isSelected && (
                    <Text className="text-paper font-mono-bold text-xs">✓</Text>
                  )}
                </View>
              </View>
              <Text
                className={`font-mono text-[11px] leading-[16px] ${
                  isSelected ? "text-signal/80" : "text-ink-60"
                }`}
              >
                {role.description}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Footer CTA */}
      <View
        className="px-5 border-t border-ink bg-paper pt-4"
        style={{ paddingBottom: insets.bottom + 16 }}
      >
        <Pressable
          onPress={handleContinue}
          disabled={!selected}
          className={`py-4 flex-row justify-center items-center gap-2 ${
            selected ? "bg-ink" : "bg-ink-20"
          } active:opacity-80`}
        >
          <Text
            className={`font-mono-bold ${selected ? "text-paper" : "text-ink-40"}`}
            style={{ fontSize: 12, letterSpacing: 2.5 }}
          >
            CONTINUE
          </Text>
          <Text
            className={`font-mono-bold text-base ${selected ? "text-paper" : "text-ink-40"}`}
          >
            →
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
