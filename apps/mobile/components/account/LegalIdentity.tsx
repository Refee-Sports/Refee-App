import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { supabase } from "@/lib/supabase";
import { fetchMyLegalIdentity, updateLegalIdentity, type LegalIdentity as Identity } from "@/lib/profile/account";
import { dateOfBirthError, usDateInput } from "@refee/core/identity/age";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";

/** "1992-01-02" → "01021992", the digits the US date field types. */
const isoToDigits = (iso: string) => (iso ? `${iso.slice(5, 7)}${iso.slice(8, 10)}${iso.slice(0, 4)}` : "");

/**
 * The legal name and birthday the ID check matches against. Both are open until
 * the check starts. Once verified, the name can still change once every 60 days
 * (a badly scanned ID, a nickname, a marriage) and the birthday is fixed (0068).
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
  const dobError = !identity.dobLocked && dob.iso ? dateOfBirthError(dob.iso) : null;
  const namesEditable = !identity.namesLocked && !identity.nextNameChangeAt;
  const nextChange = identity.nextNameChangeAt
    ? new Date(identity.nextNameChangeAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
    : null;
  const note = identity.namesLocked
    ? "Your ID is being reviewed, so these can't change until it's decided."
    : nextChange
      ? `Your ID is verified. You can change your name again on ${nextChange}. Your date of birth can only be changed by support.`
      : identity.verified
        ? "Your ID is verified. You can change your name once every 60 days. Your date of birth can only be changed by support."
        : "Private. Your ID check is matched against these, so they must match your ID exactly.";

  const save = async () => {
    if (!userId || saving) return;
    setSaving(true);
    setMessage(null);
    const { error } = await updateLegalIdentity(userId, {
      legalFirstName: first,
      legalLastName: last,
      dateOfBirth: identity.dobLocked ? identity.dateOfBirth : dob.iso,
    });
    setSaving(false);
    if (error) {
      setMessage({ ok: false, text: error.message });
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setMessage({ ok: true, text: "Saved." });
    // A verified rename starts the 60-day wait; show it.
    const { identity: fresh } = await fetchMyLegalIdentity(userId);
    if (fresh) setIdentity(fresh);
  };

  return (
    <View className="mt-8 border border-ink bg-chalk p-5">
      <Text className="font-mono-bold text-[11px] uppercase">Legal name &amp; date of birth</Text>
      <Text className="mt-2 text-ink-60 text-[12px] leading-[18px]">{note}</Text>

      <View className="mt-4">
        <Text className="font-mono-bold text-[10px] uppercase">Legal first name</Text>
        <View className="mt-2">
          <TextField
            value={first}
            onChangeText={setFirst}
            editable={namesEditable}
            autoCapitalize="words"
            autoComplete="name-given"
          />
        </View>
        <Text className="mt-4 font-mono-bold text-[10px] uppercase">Legal last name</Text>
        <View className="mt-2">
          <TextField
            value={last}
            onChangeText={setLast}
            editable={namesEditable}
            autoCapitalize="words"
            autoComplete="name-family"
          />
        </View>
        <Text className="mt-4 font-mono-bold text-[10px] uppercase">Date of birth</Text>
        <View className="mt-2">
          <TextField
            value={dob.display}
            onChangeText={setDobDigits}
            editable={!identity.dobLocked}
            keyboardType="number-pad"
            placeholder="MM/DD/YYYY"
          />
        </View>
        {dobError ? <Text className="mt-2 text-foul-ink text-[12px]">{dobError}</Text> : null}
        {namesEditable || !identity.dobLocked ? (
          <View className="mt-4">
            <Button
              label="Save"
              fullWidth
              loading={saving}
              loadingLabel="Saving"
              disabled={!identity.dobLocked && (!dob.iso || !!dobError)}
              onPress={() => void save()}
            />
          </View>
        ) : null}
      </View>

      {message ? (
        <Text className={`mt-3 text-[13px] ${message.ok ? "text-court-ink" : "text-foul-ink"}`}>{message.text}</Text>
      ) : null}
    </View>
  );
}
