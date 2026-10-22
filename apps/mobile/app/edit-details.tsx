import { useEffect, useState } from "react";
import { ActivityIndicator, Image, ScrollView, Text, View } from "react-native";
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
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Choice";
import { BackButton } from "@/components/ui/Controls";
import { Tappable } from "@/components/ui/Tappable";
import { TextField } from "@/components/ui/TextField";

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
        <BackButton onPress={() => router.back()} />
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
          <Tappable
            onPress={changePhoto}
            accessibilityRole="button"
            accessibilityLabel="Change photo"
            scaleTo={0.98}
            style={{ flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 24 }}
          >
            <View className="w-16 h-16 rounded-md bg-ink border border-ink items-center justify-center overflow-hidden">
              {uploading ? (
                <ActivityIndicator color={palette.chalk} />
              ) : avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={{ width: 64, height: 64 }} />
              ) : (
                <Feather name="camera" size={18} color={palette.chalk} />
              )}
            </View>
            <Text className="font-mono-bold text-[10px] uppercase underline">Change photo</Text>
          </Tappable>

          {isDirector ? (
            <>
              <Label>Organization name</Label>
              <Input value={form.orgName} onChangeText={set("orgName")} autoCapitalize="words" />
              <Label top>Organization type</Label>
              <View className="flex-row flex-wrap gap-2">
                {ORG_TYPES.map((t) => {
                  const selected = form.orgType === t.id;
                  return (
                    <Chip key={t.id} label={t.label} selected={selected} onPress={() => set("orgType")(t.id)} />
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

          <View className="mt-6">
            <Button label="Save changes" fullWidth loading={saving} loadingLabel="Saving" onPress={save} />
          </View>
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

const Input = TextField;
