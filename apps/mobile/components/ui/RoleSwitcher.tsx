import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { supabase } from "@/lib/supabase";
import { useOnboardingStore } from "@/lib/stores/onboarding-store";
import { fetchMyHirerId } from "@/lib/director/queries";
import {
  addDirectorRole,
  addRole,
  addRoleLabel,
  availableRoles,
  fetchRoles,
  ORG_TYPES,
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
  // Taking on the director role needs an organization (ADR 0002 decision 4).
  const [orgForm, setOrgForm] = useState<{ orgName: string; orgType: string } | null>(null);

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
    // A director works through an organization. Ask for one unless they already have it.
    if (role === "director" && !orgForm && !(await fetchMyHirerId(userId))) {
      setBusy(null);
      setOrgForm({ orgName: "", orgType: "" });
      return;
    }
    // Some profiles predate consistent user_roles writes. Preserve the role
    // they are using before making the newly added role their default.
    const { error: currentRoleError } = await addRole(userId, primaryRole as Role);
    if (currentRoleError) {
      setError(currentRoleError.message);
      setBusy(null);
      return;
    }
    // Land them in the new role straight away.
    const { error: e } =
      role === "director"
        ? await addDirectorRole(userId, orgForm ?? undefined)
        : await addRole(userId, role).then(async (r) => (r.error ? r : persistPrimaryRole(userId, role)));
    setBusy(null);
    if (e) {
      setError(e.message);
      return;
    }
    setOrgForm(null);
    setRoles((prev) => Array.from(new Set<Role>([primaryRole as Role, ...prev, role])));
    go(role);
    // A new referee has no sport, rate or travel radius yet: start them there.
    if (role === "referee") router.push("/edit-profile" as never);
  };

  return (
    <View className="rounded-lg border border-ink bg-chalk p-5">
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
                <View key={role} className="rounded-md bg-ink border border-ink px-5 py-3.5">
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
                  className="rounded-md border border-ink px-5 py-3.5 active:bg-ink/10 active:scale-[0.97]"
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
                className="rounded-md border border-ink px-5 py-3.5 active:bg-ink/10 active:scale-[0.97]"
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

      {orgForm ? (
        <View className="mt-4 border-t border-ink-20 pt-4">
          <Text className="text-ink-60 font-mono-bold text-[10px] uppercase" style={{ letterSpacing: 2 }}>
            Your organization
          </Text>
          <Text className="mt-2 text-ink-80 text-[13px] leading-[20px]">
            Shown on every game you post.
          </Text>
          <TextInput
            value={orgForm.orgName}
            onChangeText={(orgName) => setOrgForm((f) => (f ? { ...f, orgName } : f))}
            placeholder="Austin Hoops Classic"
            placeholderTextColor="rgba(8,17,28,0.35)"
            autoCapitalize="words"
            autoFocus
            accessibilityLabel="Organization name"
            className="mt-3 rounded-sm border border-ink bg-paper px-3 py-3 text-ink"
            style={{ fontSize: 15 }}
          />
          <View className="mt-2 flex-row flex-wrap gap-2">
            {ORG_TYPES.map((t) => {
              const selected = orgForm.orgType === t.id;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setOrgForm((f) => (f ? { ...f, orgType: t.id } : f));
                  }}
                  accessibilityState={{ selected }}
                  className={`rounded-full border-[1.5px] px-3 py-2.5 active:scale-[0.96] ${selected ? "border-signal bg-signal/10 active:bg-signal-tint-press" : "border-ink active:bg-chalk-press"}`}
                >
                  <Text
                    className={`font-mono-bold text-[10px] ${selected ? "text-signal" : "text-ink"}`}
                    style={{ letterSpacing: 1 }}
                  >
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View className="mt-4 flex-row gap-2">
            <Pressable
              onPress={() => void take("director")}
              disabled={busy !== null || !orgForm.orgName.trim() || !orgForm.orgType}
              className={`flex-1 rounded-md py-3.5 items-center active:scale-[0.97] ${
                orgForm.orgName.trim() && orgForm.orgType ? "bg-ink" : "bg-ink-20"
              }`}
            >
              <Text className="text-paper font-mono-bold text-[12px]" style={{ letterSpacing: 2 }}>
                {busy === "director" ? "SETTING UP…" : "START POSTING GAMES"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setOrgForm(null)}
              disabled={busy !== null}
              className="rounded-md border border-ink px-4 py-3.5 active:bg-ink/10 active:scale-[0.97]"
            >
              <Text className="text-ink font-mono-bold text-[12px]" style={{ letterSpacing: 2 }}>
                CANCEL
              </Text>
            </Pressable>
          </View>
        </View>
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
