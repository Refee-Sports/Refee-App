import { useEffect, useState } from "react";
import { Text, View, Pressable, ActivityIndicator, ScrollView, Image } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { ZebraRule } from "@/components/ui/ZebraRule";
import { fetchRefereePublicView, type RefereePublicView } from "@/lib/director/queries";

const CERT_LABELS: Record<string, string> = {
  iaabo: "IAABO",
  nfhs: "NFHS",
  ncaa: "NCAA",
  fiba: "FIBA",
};

const LEVEL_LABELS: Record<string, string> = {
  youth_rec: "Youth League / Rec",
  high_school: "High School",
  juco: "JUCO",
  naia: "NAIA",
  ncaa_mens: "NCAA Men's",
  ncaa_womens: "NCAA Women's",
  pro_am: "Pro-Am",
};

const LEVEL_TIERS: Record<string, string> = {
  youth_rec: "AMATEUR",
  high_school: "AMATEUR",
  juco: "COLLEGE",
  naia: "COLLEGE",
  ncaa_mens: "COLLEGE",
  ncaa_womens: "COLLEGE",
  pro_am: "PRO",
};

export default function RefereePublicProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [ref, setRef] = useState<RefereePublicView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { ref: r, error: e } = await fetchRefereePublicView(id);
      setRef(r);
      setError(e?.message ?? null);
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <View className="flex-1 bg-paper items-center justify-center" style={{ paddingTop: insets.top }}>
        <ActivityIndicator color="#1F4FCC" />
      </View>
    );
  }

  if (!ref) {
    return (
      <View className="flex-1 bg-paper items-center justify-center" style={{ paddingTop: insets.top }}>
        <Text className="text-ink font-mono-bold uppercase" style={{ letterSpacing: 1 }}>
          Referee not found.
        </Text>
      </View>
    );
  }

  const initials = `${ref.first_name[0] ?? "?"}${ref.last_initial}`.toUpperCase();

  const levelsByTier: Record<string, string[]> = {};
  for (const l of ref.levels) {
    const tier = LEVEL_TIERS[l.level_id] ?? "OTHER";
    if (!levelsByTier[tier]) levelsByTier[tier] = [];
    levelsByTier[tier].push(l.level_id);
  }
  const tierOrder = ["AMATEUR", "COLLEGE", "PRO"];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#E5E1D6" }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
    >
      <View style={{ paddingTop: insets.top }}>
        {/* Back */}
        <View className="px-5 py-3 flex-row items-center gap-3">
          <Pressable
            onPress={() => { Haptics.selectionAsync(); router.back(); }}
            className="w-9 h-9 border border-ink bg-chalk items-center justify-center active:opacity-70"
          >
            <Text className="text-ink font-mono-bold text-base">←</Text>
          </Pressable>
          <Text
            className="font-mono-bold text-[10px] text-ink-60 uppercase"
            style={{ letterSpacing: 2 }}
          >
            REFEREE PROFILE
          </Text>
        </View>

        {/* Privacy notice */}
        <View className="mx-5 mb-3 border border-signal/30 bg-signal/5 px-3.5 py-2.5 flex-row gap-2">
          <Text className="text-signal font-mono text-base">▸</Text>
          <Text className="text-signal/80 font-mono text-[9px] flex-1" style={{ letterSpacing: 0.5, lineHeight: 14 }}>
            LIMITED VIEW — ONLY PUBLIC INFORMATION IS DISPLAYED. FULL IDENTITY IS PRIVATE.
          </Text>
        </View>

        {/* Avatar */}
        <View className="px-5 flex-row items-center gap-4 mb-5">
          <View className="w-20 h-20 bg-ink border border-ink items-center justify-center overflow-hidden">
            {ref.avatar_url ? (
              <Image source={{ uri: ref.avatar_url }} style={{ width: 80, height: 80 }} resizeMode="cover" />
            ) : (
              <Text className="text-paper font-display" style={{ fontSize: 28, letterSpacing: -1 }}>
                {initials}
              </Text>
            )}
          </View>
          <View className="flex-1">
            <Text className="font-mono text-[9px] text-ink-60 uppercase" style={{ letterSpacing: 2 }}>
              REFEREE
            </Text>
            <Text
              className="font-display text-ink uppercase"
              style={{ fontSize: 26, letterSpacing: -1, lineHeight: 26 }}
            >
              {ref.first_name.toUpperCase()}{"\n"}
              <Text style={{ color: "#1F4FCC" }}>{ref.last_initial.toUpperCase()}.</Text>
            </Text>
            <Text className="font-mono text-[9px] text-ink-60 uppercase mt-1" style={{ letterSpacing: 1.5 }}>
              {ref.city.toUpperCase()}, {ref.state}
            </Text>
          </View>
        </View>

        <View className="px-5 mb-4">
          <ZebraRule thin />
        </View>

        {/* Rating — refs with under 5 ratings show as NEW REF, no number */}
        <View className="mx-5 mb-4 border border-ink bg-chalk flex-row">
          {ref.rating_count < 5 ? (
            <StatCell label="RATING" value="NEW REF" sub={`${ref.rating_count} RATING${ref.rating_count !== 1 ? "S" : ""}`} />
          ) : (
            <StatCell label="RATING" value={ref.rating.toFixed(2)} sub={`${ref.rating_count} RATINGS`} />
          )}
          <View className="w-px bg-ink" />
          <StatCell label="LOCATION" value={`${ref.city.toUpperCase()}, ${ref.state}`} sub="BASE CITY" />
        </View>

        {/* Credentials */}
        {ref.certifications.length > 0 && (
          <>
            <SectionHead num="01" title="Credentials" />
            <View className="mx-5 flex-row flex-wrap gap-1.5 mb-4">
              {ref.certifications.map((c, i) => (
                <View
                  key={i}
                  className="flex-row items-center gap-1.5 border border-ink bg-chalk px-2.5 py-1.5"
                >
                  <Text style={{ color: "#00A85C", fontSize: 10 }}>✓</Text>
                  <Text
                    className="font-mono text-[9px] text-ink uppercase"
                    style={{ letterSpacing: 1.5 }}
                  >
                    {CERT_LABELS[c.org_name] ?? c.org_name}
                    {c.license_number ? ` ${c.license_number}` : ""}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Levels */}
        {ref.levels.length > 0 && (
          <>
            <SectionHead num={ref.certifications.length > 0 ? "02" : "01"} title="Levels Worked" />
            <View className="mx-5 gap-3">
              {tierOrder.map((tier) => {
                const tierLevels = levelsByTier[tier];
                if (!tierLevels?.length) return null;
                return (
                  <View key={tier}>
                    <Text
                      className="text-ink-40 font-mono-bold text-[9px] uppercase mb-1.5"
                      style={{ letterSpacing: 2 }}
                    >
                      ── {tier}
                    </Text>
                    <View className="gap-1">
                      {tierLevels.map((levelId) => (
                        <View key={levelId} className="border border-ink-20 bg-chalk px-4 py-3">
                          <Text className="text-ink font-mono text-sm" style={{ letterSpacing: 0.5 }}>
                            {LEVEL_LABELS[levelId] ?? levelId}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {ref.certifications.length === 0 && ref.levels.length === 0 && (
          <View className="mx-5 border border-dashed border-ink-20 px-4 py-6 items-center">
            <Text className="font-mono text-ink-40 text-[11px] text-center uppercase" style={{ letterSpacing: 1 }}>
              No credentials or levels listed.
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function StatCell({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <View className="flex-1 px-3 py-4 items-center">
      <Text className="font-mono text-[8px] text-ink-40 uppercase mb-1" style={{ letterSpacing: 2 }}>
        {label}
      </Text>
      <Text
        className="font-display text-ink"
        style={{ fontSize: 20, letterSpacing: -0.5, lineHeight: 20 }}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      <Text className="font-mono text-[8px] text-ink-60 uppercase mt-0.5" style={{ letterSpacing: 1.5 }}>
        {sub}
      </Text>
    </View>
  );
}

function SectionHead({ num, title }: { num: string; title: string }) {
  return (
    <View className="mx-5 flex-row items-baseline gap-2 mt-5 mb-2.5">
      <Text className="text-ink-40 font-mono text-[8px]" style={{ letterSpacing: 1.5 }}>{num}</Text>
      <Text
        className="text-ink font-display"
        style={{ fontSize: 18, letterSpacing: -0.5, lineHeight: 20 }}
      >
        {title.toUpperCase()}
      </Text>
    </View>
  );
}
