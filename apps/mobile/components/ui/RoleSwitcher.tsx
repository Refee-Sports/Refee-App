import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { supabase } from "@/lib/supabase";
import { useOnboardingStore } from "@/lib/stores/onboarding-store";
import {
  addRole,
  addRoleLabel,
  availableRoles,
  fetchRoles,
  ROLE_LABELS,
  setPrimaryRole as persistPrimaryRole,
  type Role,
} from "@/lib/roles/queries";

const HOME: Record<Role, string> = {
  referee: "/(app)/(tabs)/jobs",
  director: "/(director)/(tabs)/tournaments",
  assignor: "/(assignor)/(tabs)/tournaments",
};

/**
 * Switch between the roles you hold, and take on a new one.
 *
 * Plenty of officials also assign. Doing both used to mean two accounts,
 * which the identity check then refused — Face Search correctly recognised
 * the same person signing up twice. One account holds both roles instead,
 * verified once.
 */
export function RoleSwitcher() {
  const router = useRouter();
  const { primaryRole, setPrimaryRole } = useOnboardingStore();
  const [userId, setUserId] = useState<string | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [busy, setBusy] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session || cancelled) return;
      setUserId(session.user.id);
      const { roles: held } = await fetchRoles(session.user.id);
      if (!cancelled) {
        const current = primaryRole as Role | null;
        setRoles(current ? Array.from(new Set<Role>([current, ...held])) : held);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [primaryRole]);

  if (!userId || !primaryRole) return null;

  const held = roles.length > 0 ? roles : [primaryRole as Role];
  const canAdd = availableRoles(held);

  const go = (role: Role) => {
    setPrimaryRole(role as never);
    router.replace(HOME[role] as never);
  };

  const switchTo = async (role: Role) => {
    Haptics.selectionAsync();
    setBusy(role);
    setError(null);
    const { error: e } = await persistPrimaryRole(userId, role);
    setBusy(null);
    if (e) {
      setError(e.message);
      return;
    }
    go(role);
  };

  const take = async (role: Role) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setBusy(role);
    setError(null);
    // Some profiles predate consistent user_roles writes. Preserve the role
    // they are using before making the newly added role their default.
    const { error: currentRoleError } = await addRole(userId, primaryRole as Role);
    if (currentRoleError) {
      setError(currentRoleError.message);
      setBusy(null);
      return;
    }
    const { error: e } = await addRole(userId, role);
    if (e) {
      setError(e.message);
      setBusy(null);
      return;
    }
    // Land them in the new role straight away.
    const { error: primaryError } = await persistPrimaryRole(userId, role);
    setBusy(null);
    if (primaryError) {
      setError(primaryError.message);
      return;
    }
    setRoles((prev) => Array.from(new Set<Role>([primaryRole as Role, ...prev, role])));
    go(role);
  };

  return (
    <View className="border border-ink bg-chalk p-5">
      <Text
        className="text-ink-60 font-mono-bold text-[10px] uppercase"
        style={{ letterSpacing: 2 }}
      >
        How you use Refee
      </Text>

      {held.length > 1 ? (
        <>
          <Text className="mt-3 text-ink-80 text-[13px] leading-[20px]">
            You&apos;re set up as {held.map((r) => ROLE_LABELS[r].toLowerCase()).join(" and ")}.
            Switch whenever you like — it&apos;s the same account and the same
            verification.
          </Text>
          <View className="mt-4 flex-row flex-wrap gap-2">
            {held.map((role) =>
              role === primaryRole ? (
                // Where you are now. Not a disabled button: greyed out reads
                // as "unavailable" when it means "you are here".
                <View key={role} className="bg-ink border border-ink px-5 py-3.5">
                  <Text
                    className="text-paper font-mono-bold text-[12px]"
                    style={{ letterSpacing: 2 }}
                  >
                    {ROLE_LABELS[role].toUpperCase()} ✓
                  </Text>
                </View>
              ) : (
                <Pressable
                  key={role}
                  onPress={() => void switchTo(role)}
                  disabled={busy !== null}
                  className="border border-ink px-5 py-3.5 active:opacity-70"
                >
                  <Text
                    className="text-ink font-mono-bold text-[12px]"
                    style={{ letterSpacing: 2 }}
                  >
                    {busy === role ? "SWITCHING…" : ROLE_LABELS[role].toUpperCase()}
                  </Text>
                </Pressable>
              )
            )}
          </View>
        </>
      ) : null}

      {canAdd.length > 0 ? (
        <>
          <Text className="mt-4 text-ink-80 text-[13px] leading-[20px]">
            {held.length > 1
              ? "Take on another:"
              : "Do more than one job in the game? Add it here — you keep this account and stay verified."}
          </Text>
          <View className="mt-3 flex-row flex-wrap gap-2">
            {canAdd.map((role) => (
              <Pressable
                key={role}
                onPress={() => void take(role)}
                disabled={busy !== null}
                className="border border-ink px-5 py-3.5 active:opacity-70"
              >
                <Text
                  className="text-ink font-mono-bold text-[12px]"
                  style={{ letterSpacing: 2 }}
                >
                  {busy === role ? "SETTING UP…" : addRoleLabel(role).toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      {error ? (
        <Text
          className="mt-3 text-foul font-mono text-[10px] uppercase"
          style={{ letterSpacing: 1 }}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}
