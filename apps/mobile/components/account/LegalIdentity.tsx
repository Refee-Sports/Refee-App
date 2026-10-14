import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import * as Haptics from "expo-haptics";
import { supabase } from "@/lib/supabase";
import { fetchMyLegalIdentity, updateLegalIdentity, type LegalIdentity as Identity } from "@/lib/profile/account";
import { dateOfBirthError, usDateInput } from "@refee/core/identity/age";

/** "1992-01-02" → "01021992", the digits the US date field types. */
const isoToDigits = (iso: string) => (iso ? `${iso.slice(5, 7)}${iso.slice(8, 10)}${iso.slice(0, 4)}` : "");

/**
 * The legal name and birthday the ID check matches against. Editable until the
 * check is under way, so a typo can be fixed; read-only after (0067).
 */
export function LegalIdentity() {
  const [userId, setUserId] = useState<string | null>(null);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [dobDigits, setDobDigits] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setUserId(session.user.id);
      const { identity: found } = await fetchMyLegalIdentity(session.user.id);
      if (!found) return;
      setIdentity(found);
      setFirst(found.legalFirstName);
      setLast(found.legalLastName);
      setDobDigits(isoToDigits(found.dateOfBirth));
    })();
  }, []);

  if (!identity) return null;

  const dob = usDateInput(dobDigits);
  const dobError = dob.iso ? dateOfBirthError(dob.iso) : null;

  const save = async () => {
    if (!userId || saving) return;
    setSaving(true);
    setMessage(null);
    const { error } = await updateLegalIdentity(userId, {
      legalFirstName: first,
      legalLastName: last,
      dateOfBirth: dob.iso,
    });
    setSaving(false);
    if (error) {
      setMessage({ ok: false, text: error.message });
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setMessage({ ok: true, text: "Saved." });
  };

  return (
    <View className="mt-8 border border-ink bg-chalk p-5">
      <Text className="font-mono-bold text-[11px] uppercase">Legal name &amp; date of birth</Text>
      <Text className="mt-2 text-ink-60 text-[12px] leading-[18px]">
        {identity.locked
          ? "These match your verified ID, so they can't be changed here. Contact support if something is wrong."
          : "Private. Your ID check is matched against these, so they must match your ID exactly."}
      </Text>

      {identity.locked ? (
        <View className="mt-4">
          <Text className="font-mono text-[13px]">
            {identity.legalFirstName} {identity.legalLastName}
          </Text>
          <Text className="font-mono text-[13px] mt-1">{usDateInput(isoToDigits(identity.dateOfBirth)).display}</Text>
        </View>
      ) : (
        <View className="mt-4">
          <Text className="font-mono-bold text-[10px] uppercase">Legal first name</Text>
          <TextInput
            value={first}
            onChangeText={setFirst}
            autoCapitalize="words"
            autoComplete="name-given"
            className="mt-2 border border-ink bg-paper px-3 py-3 font-mono text-[14px]"
          />
          <Text className="mt-4 font-mono-bold text-[10px] uppercase">Legal last name</Text>
          <TextInput
            value={last}
            onChangeText={setLast}
            autoCapitalize="words"
            autoComplete="name-family"
            className="mt-2 border border-ink bg-paper px-3 py-3 font-mono text-[14px]"
          />
          <Text className="mt-4 font-mono-bold text-[10px] uppercase">Date of birth</Text>
          <TextInput
            value={dob.display}
            onChangeText={setDobDigits}
            keyboardType="number-pad"
            placeholder="MM/DD/YYYY"
            className="mt-2 border border-ink bg-paper px-3 py-3 font-mono text-[14px]"
          />
          {dobError ? <Text className="mt-2 text-foul text-[12px]">{dobError}</Text> : null}
          <Pressable
            disabled={saving || !dob.iso || !!dobError}
            onPress={() => void save()}
            className="mt-4 bg-ink px-4 py-4 disabled:opacity-40"
          >
            <Text className="font-mono-bold text-[10px] uppercase text-paper text-center">
              {saving ? "Saving…" : "Save"}
            </Text>
          </Pressable>
        </View>
      )}

      {message ? (
        <Text className={`mt-3 text-[13px] ${message.ok ? "text-court" : "text-foul"}`}>{message.text}</Text>
      ) : null}
    </View>
  );
}
