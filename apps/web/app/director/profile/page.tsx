"use client";

import { useEffect, useState } from "react";
import { Wordmark } from "@/components/Wordmark";
import { ZebraRule } from "@/components/ui/ZebraRule";
import { Icon } from "@/components/ui/Icon";
import { Spinner } from "@/components/ui/AppButton";
import { StripePaymentModal } from "@/components/payments/StripePaymentModal";
import { supabase } from "@/lib/supabase";
import { fetchMyHirerProfile, type HirerRow } from "@/lib/director/queries";
import { getCardSetupParams } from "@/lib/payments/queries";
import { unregisterPushToken } from "@/lib/push/notifications";

const ORG_TYPE_LABELS: Record<string, string> = {
  tournament: "TOURNAMENT ORGANIZER",
  league: "LEAGUE",
  school: "SCHOOL / UNIVERSITY",
  parks_rec: "PARKS & REC",
};

/** Port of refee-mobile/refee/app/(director)/(tabs)/profile.tsx. */
export default function DirectorProfilePage() {
  const [hirer, setHirer] = useState<HirerRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingCard, setSavingCard] = useState(false);
  const [cardSaved, setCardSaved] = useState(false);
  const [setupSecret, setSetupSecret] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }
      const { data } = await fetchMyHirerProfile(session.user.id);
      setHirer(data as HirerRow | null);
      setLoading(false);
    })();
  }, []);

  /** Saves a card for auto-pay — same SetupIntent as the app's PaymentSheet. */
  const handleSaveCard = async () => {
    if (savingCard) return;
    setSavingCard(true);
    setNotice(null);
    const { params, error: pErr } = await getCardSetupParams();
    setSavingCard(false);
    if (pErr || !params) {
      setNotice(pErr?.message ?? "Could not reach Stripe.");
      return;
    }
    setSetupSecret(params.setupIntentClientSecret);
  };

  const signOut = async () => {
    await unregisterPushToken();
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-paper text-signal">
        <Spinner />
      </div>
    );
  }

  if (!hirer) {
    return (
      <div className="flex flex-1 items-center justify-center bg-paper px-6">
        <p
          className="text-center font-mono-bold text-sm uppercase text-ink"
          style={{ letterSpacing: 1 }}
        >
          Profile not found.
        </p>
      </div>
    );
  }

  const contactName = hirer.contact_first_name
    ? `${hirer.contact_first_name} ${hirer.contact_last_initial ?? ""}.`.toUpperCase()
    : "—";
  const initials = hirer.contact_first_name
    ? `${hirer.contact_first_name[0]}${hirer.contact_last_initial ?? ""}`.toUpperCase()
    : "TD";

  return (
    <div className="app-canvas bg-paper pb-6">
      <div className="flex items-center justify-between px-5 pb-3 pt-1 sm:px-0 lg:pt-6">
        <Wordmark className="text-[26px] lg:hidden" />
        <h1
          className="hidden font-display uppercase text-ink lg:block"
          style={{ fontSize: 34, lineHeight: "34px", letterSpacing: -1.2 }}
        >
          PROFILE<span className="text-signal">.</span>
        </h1>
      </div>

      {/* Telemetry */}
      <div className="flex items-center justify-between px-5 pb-1.5">
        <span className="font-mono text-[9px] uppercase text-ink-60" style={{ letterSpacing: 2 }}>
          <span className="font-mono-bold text-ink">DIRECTOR</span> · PROFILE
        </span>
        <span className="font-mono text-[9px] uppercase text-ink-60" style={{ letterSpacing: 2 }}>
          {hirer.is_verified ? (
            <span className="font-mono-bold text-court">✓ VERIFIED</span>
          ) : (
            "UNVERIFIED"
          )}
        </span>
      </div>
      <div className="mb-4 px-5">
        <ZebraRule variant="signal" thin />
      </div>

      {notice ? (
        <p
          className="mx-5 sm:mx-0 mb-4 border border-signal bg-signal/10 px-3 py-2 font-mono text-[10px] uppercase text-ink-80"
          style={{ letterSpacing: 1 }}
        >
          {notice}
        </p>
      ) : null}

      {/* Avatar pill */}
      <div className="mb-5 flex items-center gap-4 px-5">
        <span className="flex h-16 w-16 items-center justify-center border border-ink bg-ink">
          <span className="font-display text-paper" style={{ fontSize: 22, letterSpacing: -1 }}>
            {initials}
          </span>
        </span>
        <div className="flex-1">
          <span className="block font-mono text-[9px] uppercase text-ink-60" style={{ letterSpacing: 2 }}>
            Director
          </span>
          <span
            className="mt-0.5 block font-mono-bold text-[11px] uppercase text-ink"
            style={{ letterSpacing: 1.5 }}
          >
            {contactName}
          </span>
        </div>
      </div>

      {/* Org hero */}
      <div className="mx-5 sm:mx-0 mb-4 border-b border-t border-ink py-5">
        <h1
          className="font-display uppercase text-ink"
          style={{ fontSize: 34, lineHeight: "32px", letterSpacing: -1.5 }}
        >
          {hirer.org_name.toUpperCase()}
        </h1>
        <p className="mt-2 font-mono text-[10px] uppercase text-ink-60" style={{ letterSpacing: 2 }}>
          {ORG_TYPE_LABELS[hirer.org_type] ?? hirer.org_type.toUpperCase()}
        </p>
        {(hirer.city || hirer.state) && (
          <p
            className="mt-1 font-mono text-[10px] uppercase text-ink-60"
            style={{ letterSpacing: 1.5 }}
          >
            {[hirer.city?.toUpperCase(), hirer.state?.toUpperCase()].filter(Boolean).join(", ")}
          </p>
        )}
      </div>

      {/* Detail sections — stacked on phones, side by side once there is room. */}
      <div className="split-grid">
        <div className="min-w-0">

      {/* Info rows */}
      <div className="mx-5 sm:mx-0 mb-4 border border-ink bg-chalk">
        <InfoRow label="Contact" value={contactName} />
        <span className="block h-px bg-ink-20" />
        <InfoRow
          label="Org type"
          value={ORG_TYPE_LABELS[hirer.org_type] ?? hirer.org_type.toUpperCase()}
        />
        <span className="block h-px bg-ink-20" />
        <InfoRow label="Sport" value="BASKETBALL" />
        <span className="block h-px bg-ink-20" />
        <InfoRow
          label="Status"
          value={hirer.is_verified ? "VERIFIED ✓" : "PENDING VERIFICATION"}
        />
      </div>

        </div>

        <div className="min-w-0">

      {/* Payment method */}
      <button
        type="button"
        onClick={handleSaveCard}
        disabled={savingCard}
        className={`mx-5 mb-4 flex w-[calc(100%-40px)] items-center justify-between border px-4 py-3.5 text-left hover:opacity-80 disabled:opacity-60 ${
          cardSaved ? "border-court bg-court/10" : "border-ink bg-ink"
        }`}
      >
        <span className="flex-1 pr-3">
          <span
            className={`block font-mono-bold text-[11px] uppercase ${
              cardSaved ? "text-court" : "text-paper"
            }`}
            style={{ letterSpacing: 1.5 }}
          >
            {savingCard ? "Opening Stripe..." : cardSaved ? "✓ Auto-pay on" : "Set up auto-pay"}
          </span>
          <span
            className={`mt-0.5 block font-mono text-[9px] uppercase ${
              cardSaved ? "text-ink-60" : "text-paper/60"
            }`}
            style={{ letterSpacing: 1 }}
          >
            {cardSaved
              ? "Completed games charge your card & pay refs automatically"
              : "Save a card — crews get paid automatically at completion"}
          </span>
        </span>
        <span className={cardSaved ? "text-court" : "text-hi-vis"}>
          {savingCard ? <Spinner /> : <Icon name={cardSaved ? "check-circle" : "credit-card"} size={16} />}
        </span>
      </button>

      {/* Sign out */}
      <div className="mx-5 sm:mx-0 mt-6">
        <button
          type="button"
          onClick={signOut}
          className="flex w-full items-center justify-center gap-2 bg-foul py-4 text-paper hover:opacity-80"
        >
          <Icon name="log-out" size={14} />
          <span className="font-mono-bold uppercase" style={{ fontSize: 11, letterSpacing: 2 }}>
            Sign out
          </span>
        </button>
      </div>
        </div>
      </div>

      {setupSecret && (
        <StripePaymentModal
          clientSecret={setupSecret}
          mode="setup"
          title="Set up auto-pay"
          submitLabel="SAVE CARD"
          onCancel={() => setSetupSecret(null)}
          onSuccess={() => {
            setSetupSecret(null);
            setCardSaved(true);
            setNotice(
              "Card saved. Completed games will now be paid automatically — your card is charged and referees receive their pay without any extra steps."
            );
          }}
        />
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5">
      <span className="font-mono text-[9px] uppercase text-ink-40" style={{ letterSpacing: 2 }}>
        {label}
      </span>
      <span
        className="font-mono-bold text-[11px] uppercase text-ink"
        style={{ letterSpacing: 0.5 }}
      >
        {value}
      </span>
    </div>
  );
}
