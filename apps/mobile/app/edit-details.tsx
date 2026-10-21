import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { supabase } from "@/lib/supabase";
import { fetchMyProfile } from "@/lib/profile/queries";
import { fetchMyHirerProfile } from "@/lib/director/queries";
import { pickAndUploadAvatar } from "@/lib/profile/avatar";
import { updateAssignorDetails, updateDirectorDetails } from "@/lib/profile/account";
import { ORG_TYPES } from "@/lib/roles/queries";
import { palette } from "@refee/design";

/**
 * Edit the details a director or assignor gave at sign-up: photo, name, city,
 * and for directors the organization. Referees have their own fuller screen.
 */
export default function EditDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { role } = useLocalSearchParams<{ role?: string }>();
  const isDirector = role === "director";

  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [form, setForm] = useState({
    firstName: "",
    lastInitial: "",
    city: "",
    state: "",
    orgName: "",
    orgType: "",
  });

  useEffect(() => {
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setUserId(session.user.id);
      const [{ data: profile }, hirerResult] = await Promise.all([
        fetchMyProfile(session.user.id),
        isDirector ? fetchMyHirerProfile(session.user.id) : Promise.resolve({ data: null }),
      ]);
      const hirer = hirerResult.data as
        | { org_name: string; org_type: string; city: string | null; state: string | null;
            contact_first_name: string | null; contact_last_initial: string | null }
        | null;
      setAvatarUrl(profile?.avatar_url ?? null);
      setForm({
        firstName: hirer?.contact_first_name ?? profile?.first_name ?? "",
        lastInitial: hirer?.contact_last_initial ?? profile?.last_initial ?? "",
        city: hirer?.city ?? profile?.city ?? "",
        state: hirer?.state ?? profile?.state ?? "",
        orgName: hirer?.org_name ?? "",
        orgType: hirer?.org_type ?? "",
      });
      setLoading(false);
    })();
  }, [isDirector]);

  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const changePhoto = async () => {
    if (!userId || uploading) return;
    Haptics.selectionAsync();
    setUploading(true);
    const result = await pickAndUploadAvatar(userId);
    setUploading(false);
    if (result.error) setError(result.error.message);
    else if (result.avatarUrl) setAvatarUrl(result.avatarUrl);
  };

  const save = async () => {
    if (!userId || saving) return;
    setSaving(true);
    setError(null);
    const result = isDirector
      ? await updateDirectorDetails(userId, {
          contactFirstName: form.firstName,
          orgName: form.orgName,
          orgType: form.orgType,
          city: form.city,
          state: form.state,
        })
      : await updateAssignorDetails(userId, { firstName: form.firstName, city: form.city, state: form.state });
    setSaving(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  return (
    <View className="flex-1 bg-paper" style={{ paddingTop: insets.top }}>
      <View className="px-5 py-3 flex-row items-center justify-between border-b border-ink">
        <Pressable
          onPress={() => router.back()}
          className="w-9 h-9 border border-ink items-center justify-center active:opacity-70"
          accessibilityLabel="Back"
        >
          <Feather name="arrow-left" size={16} color={palette.ink} />
        </Pressable>
        <Text className="font-mono-bold text-[9px] text-ink uppercase" style={{ letterSpacing: 1.5 }}>
          EDIT PROFILE
        </Text>
        <View className="w-9" />
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={palette.signal} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable onPress={changePhoto} className="flex-row items-center gap-4 mb-6 active:opacity-80">
            <View className="w-16 h-16 bg-ink border border-ink items-center justify-center overflow-hidden">
              {uploading ? (
                <ActivityIndicator color={palette.chalk} />
              ) : avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={{ width: 64, height: 64 }} />
              ) : (
                <Feather name="camera" size={18} color={palette.chalk} />
              )}
            </View>
            <Text className="font-mono-bold text-[10px] uppercase underline">Change photo</Text>
          </Pressable>

          {isDirector ? (
            <>
              <Label>Organization name</Label>
              <Input value={form.orgName} onChangeText={set("orgName")} autoCapitalize="words" />
              <Label top>Organization type</Label>
              <View className="flex-row flex-wrap gap-2">
                {ORG_TYPES.map((t) => {
                  const selected = form.orgType === t.id;
                  return (
                    <Pressable
                      key={t.id}
                      onPress={() => set("orgType")(t.id)}
                      className={`border px-3 py-2 ${selected ? "border-ink bg-ink" : "border-ink-20 bg-chalk"}`}
                      accessibilityState={{ selected }}
                    >
                      <Text className={`font-mono-bold text-[10px] uppercase ${selected ? "text-paper" : "text-ink"}`}>
                        {t.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}

          <Label top={isDirector}>{isDirector ? "Contact first name" : "First name"}</Label>
          <Input value={form.firstName} onChangeText={set("firstName")} autoCapitalize="words" />
          <Text className="mt-2 text-ink-60 text-[12px] leading-[18px]">
            Shown as {form.firstName.trim() || "your name"} {form.lastInitial}. Your last initial comes from your legal
            name. Once your ID is verified, you can change your name once every 60 days.
          </Text>
          <Label top>City</Label>
          <Input value={form.city} onChangeText={set("city")} autoCapitalize="words" />
          <Label top>State</Label>
          <Input
            value={form.state}
            onChangeText={(v) => set("state")(v.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase())}
            autoCapitalize="characters"
            maxLength={2}
          />

          {error ? (
            <Text className="mt-4 border border-foul bg-foul/10 p-3 text-foul-ink text-[13px]">{error}</Text>
          ) : null}

          <Pressable onPress={save} disabled={saving} className="mt-6 bg-ink py-4 active:opacity-80 disabled:opacity-50">
            <Text className="text-paper font-mono-bold uppercase text-center" style={{ fontSize: 11, letterSpacing: 2 }}>
              {saving ? "Saving…" : "Save changes"}
            </Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

function Label({ children, top }: { children: string; top?: boolean }) {
  return (
    <Text className={`font-mono-bold text-[10px] uppercase text-ink ${top ? "mt-5" : ""} mb-2`} style={{ letterSpacing: 1 }}>
      {children}
    </Text>
  );
}

function Input(props: React.ComponentProps<typeof TextInput>) {
  return <TextInput {...props} className="border border-ink bg-chalk px-3 py-3 font-body text-[15px] text-ink" />;
}
