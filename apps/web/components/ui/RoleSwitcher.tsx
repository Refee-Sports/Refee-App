"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppButton } from "@/components/ui/AppButton";
import { useAuth } from "@/components/providers/AuthProvider";
import { fetchMyHirerId } from "@/lib/director/queries";
import {
  addDirectorRole,
  addRole,
  addRoleLabel,
  availableRoles,
  ORG_TYPES,
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
  // Taking on the director role needs an organization (ADR 0002 decision 4).
  const [orgForm, setOrgForm] = useState<{ orgName: string; orgType: string } | null>(null);

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
    // A director works through an organization. Ask for one unless they already have it.
    if (role === "director" && !orgForm && !(await fetchMyHirerId(userId))) {
      setBusy(null);
      setOrgForm({ orgName: "", orgType: "" });
      return;
    }
    // Older profiles predate consistent user_roles writes. Preserve the role
    // they are using now before changing primary_role to the new one.
    const { error: currentRoleError } = await addRole(userId, primaryRole as Role);
    if (currentRoleError) {
      setError(currentRoleError.message);
      setBusy(null);
      return;
    }
    // Land them in the new role straight away — taking it on and then having
    // to find it would be a strange place to stop.
    const { error: e } =
      role === "director"
        ? await addDirectorRole(userId, orgForm ?? undefined)
        : await addRole(userId, role).then(async (r) => (r.error ? r : setPrimaryRole(userId, role)));
    if (e) {
      setError(e.message);
      setBusy(null);
      return;
    }
    setOrgForm(null);
    await refreshProfile();
    setBusy(null);
    // A new referee has no sport, rate or travel radius yet: start them there.
    router.replace(role === "referee" ? "/app/edit-profile" : ROLE_HOME[role]);
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

      {orgForm && (
        <form
          className="mt-4 border-t border-ink-20 pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            void take("director");
          }}
        >
          <h3 className="font-mono-bold text-[10px] uppercase text-ink-60" style={{ letterSpacing: 2 }}>
            Your organization
          </h3>
          <p className="mt-2 text-[13px] leading-5 text-ink-80">Shown on every game you post.</p>
          <label className="mt-3 block">
            <span className="sr-only">Organization name</span>
            <input
              value={orgForm.orgName}
              onChange={(e) => setOrgForm((f) => (f ? { ...f, orgName: e.target.value } : f))}
              placeholder="Austin Hoops Classic"
              autoFocus
              className="w-full border border-ink bg-paper px-3 py-3 text-[15px] text-ink"
            />
          </label>
          <fieldset className="mt-2 flex flex-wrap gap-2">
            <legend className="sr-only">Organization type</legend>
            {ORG_TYPES.map((t) => {
              const selected = orgForm.orgType === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setOrgForm((f) => (f ? { ...f, orgType: t.id } : f))}
                  className={`border-[1.5px] px-3 py-2.5 font-mono-bold text-[10px] ${
                    selected ? "border-signal bg-signal-tint text-signal" : "border-ink text-ink"
                  }`}
                  style={{ letterSpacing: 1 }}
                >
                  {t.label}
                </button>
              );
            })}
          </fieldset>
          <div className="mt-4 flex gap-2">
            <AppButton
              type="submit"
              label={busy === "director" ? "Setting up…" : "Start posting games"}
              disabled={busy !== null || !orgForm.orgName.trim() || !orgForm.orgType}
            />
            <AppButton label="Cancel" variant="secondary" disabled={busy !== null} onClick={() => setOrgForm(null)} />
          </div>
        </form>
      )}

      {error && (
        <p
          className="mt-3 font-mono text-[10px] uppercase text-foul-ink"
          style={{ letterSpacing: 1 }}
        >
          {error}
        </p>
      )}
    </section>
  );
}
