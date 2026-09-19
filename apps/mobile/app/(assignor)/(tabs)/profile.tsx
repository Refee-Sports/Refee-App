import { verificationLabel } from "@/lib/identity/queries";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import * as Haptics from "expo-haptics";
import { ScrollScreen } from "@/components/layout/ScrollScreen";
import { Wordmark } from "@/components/ui/Wordmark";
import { ZebraRule } from "@/components/ui/ZebraRule";
import { supabase } from "@/lib/supabase";
import { fetchMyProfile, type ProfileRow } from "@/lib/profile/queries";
import { fetchMyRoles } from "@/lib/assignor/queries";
import { unregisterPushToken } from "@/lib/push/notifications";

export default function AssignorProfile() {
  const tabBarHeight = useBottomTabBarHeight();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }
      const [profileResult, rolesResult] = await Promise.all([
        fetchMyProfile(session.user.id),
        fetchMyRoles(session.user.id),
      ]);
      setProfile(profileResult.data as ProfileRow | null);
      setRoles(rolesResult.roles);
      setLoading(false);
    })();
  }, []);

  const signOut = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await unregisterPushToken();
    await supabase.auth.signOut();
  };

  if (loading) {
    return <View className="flex-1 bg-paper items-center justify-center"><ActivityIndicator color="#1F4FCC" /></View>;
  }

  if (!profile) {
    return <View className="flex-1 bg-paper items-center justify-center"><Text className="font-mono-bold text-ink">PROFILE NOT FOUND</Text></View>;
  }

  const initials = `${profile.first_name?.[0] ?? "A"}${profile.last_initial ?? ""}`.toUpperCase();

  return (
    <ScrollScreen bottomOffset={tabBarHeight}>
      <View className="px-5 pt-1 pb-3"><Wordmark size={26} /></View>
      <View className="px-5 pb-1.5 flex-row justify-between">
        <Text className="font-mono text-[9px] text-ink-60 uppercase" style={{ letterSpacing: 2 }}>
          <Text className="font-mono-bold text-ink">ASSIGNOR</Text> · PROFILE
        </Text>
        <Text className="font-mono text-[9px] text-ink-60 uppercase" style={{ letterSpacing: 2 }}>
          {profile.is_verified ? (
            <Text className="font-mono-bold" style={{ color: "#00A85C" }}>✓ {verificationLabel(true)}</Text>
          ) : verificationLabel(false)}
        </Text>
      </View>
      <View className="px-5 mb-5"><ZebraRule variant="signal" thin /></View>

      <View className="px-5 flex-row items-center gap-4 mb-6">
        <View className="w-16 h-16 bg-ink items-center justify-center">
          <Text className="text-paper font-display" style={{ fontSize: 22 }}>{initials}</Text>
        </View>
        <View className="flex-1">
          <Text className="font-display text-ink uppercase" style={{ fontSize: 28, lineHeight: 29, letterSpacing: -1 }}>
            {profile.display_name}
          </Text>
          <Text className="font-mono text-[9px] text-ink-60 uppercase mt-1" style={{ letterSpacing: 1.5 }}>
            {profile.city}, {profile.state}
          </Text>
        </View>
      </View>

      <View className="mx-5 border border-ink bg-chalk">
        <InfoRow label="PRIMARY ROLE" value="ASSIGNOR" />
        <View className="h-px bg-ink-20" />
        <InfoRow label="ALL ROLES" value={roles.map((role) => role.toUpperCase()).join(" · ") || "ASSIGNOR"} />
        <View className="h-px bg-ink-20" />
        <InfoRow label="MEMBER SINCE" value={new Date(profile.member_since).getFullYear().toString()} />
        <View className="h-px bg-ink-20" />
        <InfoRow label="STATUS" value={profile.is_verified ? `${verificationLabel(true)} ✓` : verificationLabel(false)} />
      </View>

      <View className="mx-5 mt-7">
        <Pressable onPress={signOut} className="bg-foul py-4 flex-row items-center justify-center gap-2 active:opacity-80">
          <Feather name="log-out" size={14} color="#F1EDE1" />
          <Text className="text-paper font-mono-bold uppercase" style={{ fontSize: 11, letterSpacing: 2 }}>SIGN OUT</Text>
        </Pressable>
      </View>
    </ScrollScreen>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center px-4 py-3.5 justify-between">
      <Text className="font-mono text-[9px] text-ink-40 uppercase" style={{ letterSpacing: 2 }}>{label}</Text>
      <Text className="font-mono-bold text-[10px] text-ink uppercase flex-1 text-right ml-3" numberOfLines={1}>{value}</Text>
    </View>
  );
}
