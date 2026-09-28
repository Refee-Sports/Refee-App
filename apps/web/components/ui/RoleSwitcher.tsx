"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppButton } from "@/components/ui/AppButton";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  addRole,
  addRoleLabel,
  availableRoles,
  ROLE_HOME,
  ROLE_LABELS,
  setPrimaryRole,
  type Role,
} from "@/lib/roles/queries";

/**
 * Switch between the roles you hold, and take on a new one.
 *
 * Plenty of officials also assign. Doing both used to mean two accounts, which
 * the identity check then refused — Face Search correctly recognised the same
 * person signing up twice. One account holds both roles instead, verified
 * once, and this is how you move between them.
 */
export function RoleSwitcher() {
  const { userId, primaryRole, roles, refreshProfile } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!userId || !primaryRole) return null;

  const held = roles.length > 0 ? roles : [primaryRole as Role];
  const canAdd = availableRoles(held);

  const switchTo = async (role: Role) => {
    setBusy(role);
    setError(null);
    const { error: e } = await setPrimaryRole(userId, role);
    if (e) {
      setError(e.message);
      setBusy(null);
      return;
    }
    await refreshProfile();
    setBusy(null);
    router.replace(ROLE_HOME[role]);
  };

  const take = async (role: Role) => {
    setBusy(role);
    setError(null);
    const { error: e } = await addRole(userId, role);
    if (e) {
      setError(e.message);
      setBusy(null);
      return;
    }
    // Land them in the new role straight away — taking it on and then having
    // to find it would be a strange place to stop.
    const { error: primaryError } = await setPrimaryRole(userId, role);
    if (primaryError) setError(primaryError.message);
    await refreshProfile();
    setBusy(null);
    router.replace(ROLE_HOME[role]);
  };

  return (
    <section className="border border-ink bg-chalk p-5">
      <h2
        className="font-mono-bold text-[10px] uppercase text-ink-60"
        style={{ letterSpacing: 2 }}
      >
        How you use Refee
      </h2>

      {held.length > 1 && (
        <>
          <p className="mt-3 text-[13px] leading-5 text-ink-80">
            You&apos;re set up as {held.map((r) => ROLE_LABELS[r].toLowerCase()).join(" and ")}.
            Switch whenever you like — it&apos;s the same account and the same
            verification.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {held.map((role) =>
              role === primaryRole ? (
                // The one you're in now. Not a disabled button: greying it out
                // reads as "unavailable" when it means "you are here".
                <span
                  key={role}
                  aria-current="true"
                  className="inline-flex items-center gap-2 border border-ink bg-ink px-6 py-4 font-mono-bold text-paper"
                  style={{ fontSize: 12, letterSpacing: 2.5 }}
                >
                  {ROLE_LABELS[role].toUpperCase()}
                  <span aria-hidden="true">✓</span>
                </span>
              ) : (
                <AppButton
                  key={role}
                  label={busy === role ? "Switching…" : ROLE_LABELS[role]}
                  variant="secondary"
                  disabled={busy !== null}
                  onClick={() => void switchTo(role)}
                />
              )
            )}
          </div>
        </>
      )}

      {canAdd.length > 0 && (
        <>
          <p className="mt-4 text-[13px] leading-5 text-ink-80">
            {held.length > 1
              ? "Take on another:"
              : "Do more than one job in the game? Add it here — you keep this account and stay verified."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {canAdd.map((role) => (
              <AppButton
                key={role}
                label={busy === role ? "Setting up…" : addRoleLabel(role)}
                variant="secondary"
                disabled={busy !== null}
                onClick={() => void take(role)}
              />
            ))}
          </div>
        </>
      )}

      {error && (
        <p
          className="mt-3 font-mono text-[10px] uppercase text-foul"
          style={{ letterSpacing: 1 }}
        >
          {error}
        </p>
      )}
    </section>
  );
}
