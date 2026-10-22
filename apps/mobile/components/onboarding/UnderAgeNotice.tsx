import { useState } from "react";
import { Text, View } from "react-native";
import { Button } from "@/components/ui/Button";
import { waitlistAge } from "@refee/core/identity/age";
import { joinUnder18Waitlist } from "@/lib/identity/waitlist";

type Status = "idle" | "saving" | "done";

/**
 * Shown under the date-of-birth field when someone enters a 16 or 17 year old's
 * birthday. Refee is 18+, so this is the one place we answer "can I still use
 * it?" — with an offer to email them if a supervised option ever exists. It
 * renders nothing for anyone else, so nothing is ever collected from a child
 * under 16 and adults are never asked.
 */
export function UnderAgeNotice({ dateOfBirth }: { dateOfBirth: string }) {
  const age = dateOfBirth ? waitlistAge(dateOfBirth) : null;
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  if (age === null) return null;

  const join = async () => {
    setStatus("saving");
    setError(null);
    const result = await joinUnder18Waitlist(age);
    if (result.error) {
      setError(result.error);
      setStatus("idle");
      return;
    }
    setStatus("done");
  };

  return (
    <View className="mt-4 border border-signal/30 bg-signal/5 px-3.5 py-3">
      <Text className="text-ink font-body-bold" style={{ fontSize: 13 }}>
        Refee is 18+ for now.
      </Text>
      <Text className="text-ink-80 mt-1" style={{ fontSize: 13, lineHeight: 18 }}>
        Plenty of {age}-year-olds officiate, so we&apos;re looking at a supervised option. Want an email if we build it?
      </Text>

      {status === "done" ? (
        <Text className="text-court-ink font-mono-bold text-[10px] uppercase mt-3" style={{ letterSpacing: 1.2 }}>
          You&apos;re on the list. We&apos;ll use the email on your account.
        </Text>
      ) : (
        <View className="mt-3">
          <Button
            label="Email me if you build it"
            variant="secondary"
            size="sm"
            fullWidth
            loading={status === "saving"}
            loadingLabel="Saving"
            onPress={join}
          />
        </View>
      )}

      {error ? (
        <Text className="text-foul-ink font-mono text-[10px] uppercase mt-2" style={{ letterSpacing: 1 }}>
          {error}
        </Text>
      ) : null}

      <Text className="text-ink-60 font-mono text-[9px] uppercase mt-3" style={{ letterSpacing: 1 }}>
        We keep your account email and your age, not your birthday.
      </Text>
    </View>
  );
}
