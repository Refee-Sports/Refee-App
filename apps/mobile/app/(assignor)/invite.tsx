import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { RosterQr } from "@/components/assignor/RosterQr";
import {
  fetchMyRosterInviteCode,
  inviteToRosterByEmail,
  parseEmails,
  rosterInviteLink,
  rotateRosterInviteCode,
  sendRosterEmailInvites,
  type EmailInviteResult,
} from "@/lib/assignor/queries";
import { pickEmailCsv } from "@/lib/roster/files";

const RESULT_LABEL: Record<EmailInviteResult["result"], string> = {
  invited: "INVITED — ALREADY ON REFEE",
  pending: "WILL BE INVITED WHEN THEY SIGN UP",
  invalid: "NOT A VALID EMAIL",
  self: "THAT'S YOU",
  already_on_roster: "ALREADY ON YOUR ROSTER",
};

export default function InviteToRoster() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [code, setCode] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<EmailInviteResult[] | null>(null);
  const [emailNote, setEmailNote] = useState<string | null>(null);

  const loadCode = useCallback(async () => {
    const { code: c, error } = await fetchMyRosterInviteCode();
    setCode(c);
    setCodeError(error?.message ?? null);
  }, []);

  useEffect(() => {
    void loadCode();
  }, [loadCode]);

  const link = code ? rosterInviteLink(code) : null;

  const shareLink = async () => {
    if (!link) return;
    Haptics.selectionAsync();
    await Share.share({
      message: `Join my referee roster on Refee: ${link} (or enter code ${code} in the app)`,
    });
  };

  const rotate = () => {
    Alert.alert(
      "Make a new code?",
      "The current QR code and code stop working. Referees already on your roster stay on it.",
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "New code",
          style: "destructive",
          onPress: () => {
            void rotateRosterInviteCode().then(({ code: c, error }) => {
              if (error) Alert.alert("Couldn't change the code", error.message);
              else setCode(c);
            });
          },
        },
      ]
    );
  };

  const importCsv = async () => {
    try {
      const file = await pickEmailCsv();
      if (!file) return;
      const found = parseEmails(file.text);
      if (found.length === 0) {
        Alert.alert("No emails found", "That file doesn't contain any email addresses.");
        return;
      }
      setText((current) => [...new Set([...parseEmails(current), ...found])].join("\n"));
    } catch (e) {
      Alert.alert("Couldn't read that file", e instanceof Error ? e.message : "Try another file.");
    }
  };

  const emails = parseEmails(text);

  const send = async () => {
    if (emails.length === 0 || busy) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setBusy(true);
    const { results: r, error } = await inviteToRosterByEmail(emails);
    setBusy(false);
    if (error) {
      Alert.alert("Invites not sent", error.message);
      return;
    }
    setResults(r);
    setText("");

    // People with no Refee account yet get an email with the join link.
    const pending = r.filter((x) => x.result === "pending").map((x) => x.email);
    if (pending.length === 0) {
      setEmailNote(null);
      return;
    }
    await fetchMyRosterInviteCode(); // make sure the code the email links to exists
    const mail = await sendRosterEmailInvites(pending);
    if (mail.error) setEmailNote("Their invites are saved, but the emails couldn't be sent. Share your QR link with them.");
    else if (!mail.configured) setEmailNote("Their invites are saved, but email sending isn't set up yet. Share your QR link with them.");
    else setEmailNote(`Emailed ${mail.sent} ${mail.sent === 1 ? "person" : "people"} who aren't on Refee yet.`);
  };

  return (
    <View className="flex-1 bg-paper" style={{ paddingTop: insets.top }}>
      <View className="px-5 py-3 flex-row items-center justify-between border-b border-ink">
        <Pressable
          onPress={() => router.back()}
          className="w-9 h-9 border border-ink items-center justify-center active:opacity-70"
        >
          <Feather name="arrow-left" size={16} color="#08111C" />
        </Pressable>
        <Text className="font-mono-bold text-[9px] text-ink uppercase" style={{ letterSpacing: 1.5 }}>
          INVITE REFEREES
        </Text>
        <View className="w-9" />
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}
      >
        {/* QR / code */}
        <Text className="font-mono-bold text-[9px] text-ink uppercase mb-2" style={{ letterSpacing: 1.5 }}>
          SCAN TO JOIN
        </Text>
        <View className="border border-ink bg-chalk p-5 items-center">
          {code && link ? (
            <>
              <RosterQr value={link} size={200} />
              <Text className="font-display text-ink mt-4" style={{ fontSize: 30, letterSpacing: 4 }}>
                {code}
              </Text>
              <Text className="font-mono text-[9px] text-ink-60 uppercase text-center mt-1" style={{ letterSpacing: 1 }}>
                Referees scan this or type the code in Refee. Anyone with it joins your roster.
              </Text>
              <View className="flex-row gap-2 mt-4 self-stretch">
                <Pressable onPress={shareLink} className="flex-1 bg-ink py-3 items-center active:opacity-80">
                  <Text className="text-paper font-mono-bold text-[10px] uppercase" style={{ letterSpacing: 1.5 }}>
                    SHARE LINK
                  </Text>
                </Pressable>
                <Pressable onPress={rotate} className="flex-1 border border-ink py-3 items-center active:opacity-70">
                  <Text className="text-ink font-mono-bold text-[10px] uppercase" style={{ letterSpacing: 1.5 }}>
                    NEW CODE
                  </Text>
                </Pressable>
              </View>
            </>
          ) : codeError ? (
            <Text className="text-foul font-mono text-[10px] uppercase">{codeError}</Text>
          ) : (
            <ActivityIndicator color="#1F4FCC" />
          )}
        </View>

        {/* Email */}
        <Text className="font-mono-bold text-[9px] text-ink uppercase mt-7 mb-2" style={{ letterSpacing: 1.5 }}>
          INVITE BY EMAIL
        </Text>
        <TextInput
          value={text}
          onChangeText={(t) => {
            setText(t);
            setResults(null);
          }}
          placeholder={"jordan@example.com\nsam@example.com"}
          placeholderTextColor="rgba(8,17,28,0.35)"
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          className="border border-ink bg-chalk px-3 py-3 font-mono text-[12px] text-ink"
          style={{ minHeight: 110, textAlignVertical: "top" }}
        />
        <Text className="font-mono text-[9px] text-ink-60 uppercase mt-2" style={{ letterSpacing: 1 }}>
          Paste or type addresses, separated by commas or new lines.
        </Text>

        <View className="flex-row gap-2 mt-3">
          <Pressable onPress={importCsv} className="flex-1 border border-ink py-3 flex-row items-center justify-center gap-2 active:opacity-70">
            <Feather name="upload" size={13} color="#08111C" />
            <Text className="text-ink font-mono-bold text-[10px] uppercase" style={{ letterSpacing: 1.5 }}>
              IMPORT CSV
            </Text>
          </Pressable>
          <Pressable
            onPress={send}
            disabled={emails.length === 0 || busy}
            className={`flex-1 py-3 items-center justify-center ${emails.length > 0 && !busy ? "bg-ink" : "bg-ink-20"} active:opacity-80`}
          >
            {busy ? (
              <ActivityIndicator color="#E5E1D6" size="small" />
            ) : (
              <Text
                className={`font-mono-bold text-[10px] uppercase ${emails.length > 0 ? "text-paper" : "text-ink-40"}`}
                style={{ letterSpacing: 1.5 }}
              >
                {emails.length > 0 ? `INVITE ${emails.length}` : "INVITE"}
              </Text>
            )}
          </Pressable>
        </View>

        {results ? (
          <View className="mt-5 border border-ink-20 bg-chalk">
            {results.map((r) => (
              <View key={r.email} className="px-3 py-2.5 border-b border-ink-20">
                <Text className="font-mono-bold text-[10px] text-ink" numberOfLines={1}>
                  {r.email}
                </Text>
                <Text
                  className={`font-mono text-[8px] uppercase mt-0.5 ${r.result === "invalid" || r.result === "self" ? "text-foul" : "text-ink-60"}`}
                  style={{ letterSpacing: 1 }}
                >
                  {RESULT_LABEL[r.result]}
                </Text>
              </View>
            ))}
            {emailNote ? (
              <Text className="font-mono text-[9px] text-ink-60 uppercase px-3 py-2.5" style={{ letterSpacing: 1 }}>
                {emailNote}
              </Text>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
