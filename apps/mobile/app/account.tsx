import { useEffect, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Wordmark } from "@/components/ui/Wordmark";
import { supabase } from "@/lib/supabase";
import {
  deleteMyAccount,
  fetchLinkedAccountMethods,
  type AccountProvider,
  type LinkedAccountMethod,
} from "@/lib/account/queries";
import { linkOAuthIdentity } from "@/lib/oauth";
import { ChangeEmail } from "@/components/account/ChangeEmail";
import { LegalIdentity } from "@/components/account/LegalIdentity";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { TextLink } from "@/components/ui/Controls";

export default function AccountScreen() {
  const router = useRouter();
  const [methods, setMethods] = useState<LinkedAccountMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<AccountProvider | "delete" | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    const result = await fetchLinkedAccountMethods();
    setLoading(false);
    if (result.error) setError(result.error.message);
    else setMethods(result.methods);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const link = async (provider: "google" | "apple") => {
    Haptics.selectionAsync();
    setBusy(provider);
    setError(null);
    const result = await linkOAuthIdentity(provider);
    setBusy(null);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    await refresh();
  };

  const deleteAccount = () => {
    if (confirmation !== "DELETE") return;
    Alert.alert(
      "Permanently delete account?",
      "Your sign-in, profile, verification data, background check and avatar will be removed. This cannot be undone.",
      [
        { text: "Keep account", style: "cancel" },
        {
          text: "Delete account",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setBusy("delete");
              setError(null);
              const result = await deleteMyAccount(confirmation);
              if (result.error) {
                setError(result.error.message);
                setBusy(null);
                return;
              }
              await supabase.auth.signOut({ scope: "local" });
              router.replace("/(auth)/welcome");
            })();
          },
        },
      ]
    );
  };

  const linked = new Set(methods.map((method) => method.provider));

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <View className="px-5 py-4 flex-row items-center justify-between border-b border-ink">
          <Wordmark size={26} />
          <TextLink label="Back to profile" tone="ink" size={10} align="left" onPress={() => router.back()} />
        </View>

        <View className="px-5 pt-8">
          <Text className="font-display text-ink uppercase text-[36px] leading-[38px]">
            Account &amp; sign-in<Text className="text-signal">.</Text>
          </Text>
          <Text className="mt-3 text-ink-70 text-[14px] leading-[21px]">
            Link more than one sign-in method to the same Refee profile. Start linking while signed in here—using a new provider from the welcome screen can create a separate account.
          </Text>

          <ChangeEmail />
          <LegalIdentity />

          <View className="mt-8 border border-ink bg-chalk p-5">
            <Text className="font-mono-bold text-[11px] uppercase">Linked methods</Text>
            {loading ? <Text className="mt-4 text-ink-60">Loading…</Text> : null}
            {methods.map((method) => (
              <View key={method.provider} className="py-4 border-b border-ink-20 flex-row justify-between">
                <Text className="font-mono text-[11px] uppercase">{method.label}</Text>
                <Text className="font-mono-bold text-[10px] uppercase text-court-ink">Linked ✓</Text>
              </View>
            ))}
            <View className="mt-4 gap-3">
              {!linked.has("google") ? (
                <Button
                  label="Link Google"
                  variant="secondary"
                  fullWidth
                  loading={busy === "google"}
                  loadingLabel="Linking"
                  disabled={busy !== null}
                  onPress={() => void link("google")}
                />
              ) : null}
              {!linked.has("apple") ? (
                <Button
                  label="Link Apple"
                  variant="secondary"
                  fullWidth
                  loading={busy === "apple"}
                  loadingLabel="Linking"
                  disabled={busy !== null}
                  onPress={() => void link("apple")}
                />
              ) : null}
            </View>
          </View>

          {error ? (
            <Text className="mt-4 border border-foul bg-foul/10 p-3 text-foul-ink text-[13px]">{error}</Text>
          ) : null}

          <View className="mt-10 border border-foul p-5">
            <Text className="font-mono-bold text-[11px] uppercase text-foul-ink">Delete account</Text>
            <Text className="mt-3 text-ink-70 text-[13px] leading-[20px]">
              This permanently removes your sign-in, profile, verification data, avatar, roles and device tokens. Historical transaction records may be retained in anonymized form. Active games or unresolved payments must be handled first.
            </Text>
            <Text className="mt-5 font-mono-bold text-[10px] uppercase">Type DELETE to confirm</Text>
            <View className="mt-2">
              <TextField
                value={confirmation}
                onChangeText={setConfirmation}
                autoCapitalize="characters"
                autoCorrect={false}
              />
            </View>
            <View className="mt-4">
              <Button
                label="Permanently delete account"
                variant="danger-fill"
                fullWidth
                loading={busy === "delete"}
                loadingLabel="Deleting"
                disabled={confirmation !== "DELETE" || busy !== null}
                onPress={deleteAccount}
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
