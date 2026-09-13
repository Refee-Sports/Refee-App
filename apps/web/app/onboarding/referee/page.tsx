"use client";

import { useState } from "react";
import { AffixField, Label, OptionRow, TextField } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/AppButton";
import { Icon } from "@/components/ui/Icon";
import { useAuth } from "@/components/providers/AuthProvider";
import { getSupabaseSetupError, supabase } from "@/lib/supabase";
import { saveFullProfile, type CertEntry } from "@/lib/profile/queries";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

const SPORTS = [{ id: "basketball", label: "BASKETBALL" }];

const CERT_BODIES = [
  { id: "iaabo", label: "IAABO", full: "Intl. Association of Approved Basketball Officials" },
  { id: "nfhs", label: "NFHS", full: "National Federation of State High School Associations" },
  { id: "ncaa", label: "NCAA", full: "NCAA College Officials Program" },
  { id: "fiba", label: "FIBA", full: "International Basketball Federation" },
];

const LEVELS = [
  { id: "youth_rec", label: "Youth League / Rec", tier: "AMATEUR" },
  { id: "high_school", label: "High School", tier: "AMATEUR" },
  { id: "juco", label: "JUCO", tier: "COLLEGE" },
  { id: "naia", label: "NAIA", tier: "COLLEGE" },
  { id: "ncaa_mens", label: "NCAA Men's", tier: "COLLEGE" },
  { id: "ncaa_womens", label: "NCAA Women's", tier: "COLLEGE" },
  { id: "pro_am", label: "Pro-Am", tier: "PRO" },
];

const STEP_NUMBERS = ["03", "04", "05", "06", "07", "08"];

type FormData = {
  firstName: string;
  lastName: string;
  city: string;
  state: string;
  sportId: string;
  yearsExperience: string;
  minPay: string;
  travelRadius: string;
  certs: CertEntry[];
  levels: string[];
};

/**
 * Referee onboarding — port of refee-mobile/refee/app/(onboarding)/index.tsx.
 * Same six steps, same validation, same saveFullProfile write, so a profile
 * created here is indistinguishable from one created in the app.
 */
export default function RefereeOnboardingPage() {
  const { refreshProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>({
    firstName: "",
    lastName: "",
    city: "",
    state: "",
    sportId: "basketball",
    yearsExperience: "",
    minPay: "35",
    travelRadius: "25",
    certs: [],
    levels: [],
  });

  const set =
    (key: keyof Omit<FormData, "certs" | "levels">) =>
    (val: string) =>
      setForm((f) => ({ ...f, [key]: val }));

  const toggleCert = (bodyId: string) =>
    setForm((f) => ({
      ...f,
      certs: f.certs.find((c) => c.bodyId === bodyId)
        ? f.certs.filter((c) => c.bodyId !== bodyId)
        : [...f.certs, { bodyId, licenseNumber: "" }],
    }));

  const setCertLicense = (bodyId: string, licenseNumber: string) =>
    setForm((f) => ({
      ...f,
      certs: f.certs.map((c) => (c.bodyId === bodyId ? { ...c, licenseNumber } : c)),
    }));

  const toggleLevel = (levelId: string) =>
    setForm((f) => ({
      ...f,
      levels: f.levels.includes(levelId)
        ? f.levels.filter((l) => l !== levelId)
        : [...f.levels, levelId],
    }));

  // ── Validation per step (identical to the app) ────────────────────────────
  const canAdvance = [
    form.firstName.trim().length >= 1 && form.lastName.trim().length >= 1,
    form.city.trim().length >= 1 && US_STATES.includes(form.state.toUpperCase()),
    !!form.sportId,
    parseInt(form.minPay, 10) >= 1 && parseInt(form.travelRadius, 10) >= 1,
    true, // certs are optional
    form.levels.length >= 1,
  ];

  const leaveSetup = async () => {
    if (!window.confirm("Leave setup? You can finish your profile next time you sign in.")) {
      return;
    }
    await supabase.auth.signOut();
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      const setupErr = getSupabaseSetupError();
      if (setupErr) {
        setError(setupErr);
        setLoading(false);
        return;
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (!user || userError) {
        // Stale session — sign out so the route gate sends us to sign-in.
        await supabase.auth.signOut();
        return;
      }

      const lastName = form.lastName.trim();
      const lastInitial = lastName.length > 0 ? lastName[0].toUpperCase() : "?";

      const { error: saveError } = await saveFullProfile(user.id, {
        firstName: form.firstName.trim(),
        lastInitial,
        city: form.city.trim(),
        state: form.state.trim().toUpperCase(),
        sportId: form.sportId,
        yearsExperience: parseInt(form.yearsExperience || "0", 10),
        minPayPerGame: parseInt(form.minPay, 10),
        travelRadiusMiles: parseInt(form.travelRadius, 10),
        certs: form.certs,
        levelIds: form.levels,
      });

      if (saveError) {
        setError(saveError.message || "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      // Re-read profile + role; RouteGate then lands us in the referee app.
      await refreshProfile();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred. Please try again."
      );
      setLoading(false);
    }
  };

  const isLastStep = step === 5;

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      {/* Header + progress */}
      <div className="flex items-center justify-between px-5 py-3">
        <button
          type="button"
          onClick={() => (step === 0 ? void leaveSetup() : setStep((s) => s - 1))}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center border border-ink bg-chalk text-ink hover:bg-ink hover:text-paper"
        >
          <Icon name="chevron-left" size={18} />
        </button>
        <span
          className="font-mono-bold text-[9px] uppercase text-ink-60"
          style={{ letterSpacing: 2 }}
        >
          <span className="text-ink">{STEP_NUMBERS[step]}</span> / 08
        </span>
        <button
          type="button"
          onClick={leaveSetup}
          aria-label="Leave setup"
          className="flex h-9 w-9 items-center justify-center border border-ink bg-chalk text-ink hover:bg-ink hover:text-paper"
        >
          <Icon name="x" size={16} />
        </button>
      </div>
      <div className="mx-5 h-0.5 bg-ink-20">
        <div className="h-full bg-signal" style={{ width: `${((step + 1) / 6) * 100}%` }} />
      </div>

      {/* Step body */}
      <div className="flex-1 px-5 py-6">
        {step === 0 && <NameStep form={form} set={set} />}
        {step === 1 && <LocationStep form={form} set={set} />}
        {step === 2 && <SportStep form={form} set={set} />}
        {step === 3 && <RateStep form={form} set={set} />}
        {step === 4 && (
          <CertStep certs={form.certs} onToggle={toggleCert} onSetLicense={setCertLicense} />
        )}
        {step === 5 && <LevelStep selectedLevels={form.levels} onToggle={toggleLevel} />}
      </div>

      {/* Footer */}
      <div className="action-bar sticky bottom-0">
        {error && (
          <p
            className="mb-3 font-mono text-[10px] uppercase text-foul"
            style={{ letterSpacing: 1 }}
          >
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={() => (isLastStep ? void handleSubmit() : setStep((s) => s + 1))}
          disabled={!canAdvance[step] || loading}
          className={`flex w-full items-center justify-center gap-2 py-4 ${
            canAdvance[step] && !loading
              ? "bg-ink text-paper hover:opacity-80"
              : "cursor-not-allowed bg-ink-20 text-ink-40"
          }`}
        >
          {loading ? (
            <Spinner />
          ) : (
            <>
              <span className="font-mono-bold" style={{ fontSize: 12, letterSpacing: 2.5 }}>
                {isLastStep ? "FINISH SETUP" : "NEXT"}
              </span>
              <span className="font-mono-bold text-base">→</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ── Step sub-components ──────────────────────────────────────────────────────

function StepHeading({ line1, line2, blurb }: { line1: string; line2: string; blurb: string }) {
  return (
    <>
      <h1
        className="font-display text-ink"
        style={{ fontSize: 40, lineHeight: "46px", letterSpacing: -1.5 }}
      >
        {line1}
        <br />
        <span className="text-signal">{line2}</span>
      </h1>
      <p className="mb-7 mt-3 text-ink-80" style={{ fontSize: 14, lineHeight: "20px" }}>
        {blurb}
      </p>
    </>
  );
}

type SetFn = (key: keyof Omit<FormData, "certs" | "levels">) => (v: string) => void;

function NameStep({ form, set }: { form: FormData; set: SetFn }) {
  return (
    <div>
      <StepHeading
        line1="WHAT'S YOUR"
        line2="NAME?"
        blurb="We show your first name and last initial to organizers — never your full last name."
      />
      <Label>First name</Label>
      <TextField
        value={form.firstName}
        onChange={(e) => set("firstName")(e.target.value)}
        placeholder="Jordan"
        autoFocus
        autoComplete="given-name"
      />
      <Label className="mt-4">Last name</Label>
      <TextField
        value={form.lastName}
        onChange={(e) => set("lastName")(e.target.value)}
        placeholder="Taylor"
        autoComplete="family-name"
      />
      {form.firstName.trim() && form.lastName.trim() ? (
        <div className="mt-5 flex items-center gap-2 border border-signal/30 bg-signal/5 px-3.5 py-2.5">
          <span className="font-mono text-base text-signal">▸</span>
          <span className="font-mono text-xs text-ink-80" style={{ letterSpacing: 0.5 }}>
            YOU&apos;LL APPEAR AS:{" "}
            <span className="font-mono-bold text-ink">
              {form.firstName.trim()} {form.lastName.trim()[0].toUpperCase()}.
            </span>
          </span>
        </div>
      ) : null}
    </div>
  );
}

function LocationStep({ form, set }: { form: FormData; set: SetFn }) {
  const stateVal = form.state.toUpperCase();
  const stateValid = US_STATES.includes(stateVal);
  return (
    <div>
      <StepHeading
        line1="WHERE DO"
        line2="YOU REF?"
        blurb="Your city and state help organizers find officials in their area."
      />
      <Label>City</Label>
      <TextField
        value={form.city}
        onChange={(e) => set("city")(e.target.value)}
        placeholder="Austin"
        autoFocus
        autoComplete="address-level2"
      />
      <Label className="mt-4">State (2-letter code)</Label>
      <TextField
        value={form.state}
        onChange={(e) => set("state")(e.target.value.toUpperCase().slice(0, 2))}
        placeholder="TX"
        maxLength={2}
        autoComplete="address-level1"
        error={
          form.state.length === 2 && !stateValid ? "Enter a valid US state code" : undefined
        }
      />
    </div>
  );
}

function SportStep({ form, set }: { form: FormData; set: SetFn }) {
  return (
    <div>
      <StepHeading
        line1="WHAT DO"
        line2="YOU REF?"
        blurb="Select your sport. More sports will be added in future updates."
      />
      <Label>Sport</Label>
      <div className="mt-1 flex flex-col gap-2">
        {SPORTS.map((s) => (
          <OptionRow
            key={s.id}
            label={s.label}
            selected={form.sportId === s.id}
            onClick={() => set("sportId")(s.id)}
          />
        ))}
      </div>
      <Label className="mt-5">Years of experience</Label>
      <TextField
        value={form.yearsExperience}
        onChange={(e) => set("yearsExperience")(e.target.value.replace(/\D/g, "").slice(0, 2))}
        placeholder="5"
        inputMode="numeric"
        hint="How many years have you been officiating this sport?"
      />
    </div>
  );
}

function RateStep({ form, set }: { form: FormData; set: SetFn }) {
  return (
    <div>
      <StepHeading
        line1="SET YOUR"
        line2="FLOOR."
        blurb="Your minimum rate keeps low-ball offers off your feed. You can update this anytime."
      />
      <Label>Min pay per game ($)</Label>
      <AffixField
        prefix="$"
        value={form.minPay}
        onChange={(e) => set("minPay")(e.target.value.replace(/\D/g, "").slice(0, 4))}
        placeholder="35"
        inputMode="numeric"
        hint="Jobs below this rate won't appear in your feed"
      />
      <Label className="mt-5">Travel radius (miles)</Label>
      <AffixField
        suffix="MI"
        value={form.travelRadius}
        onChange={(e) => set("travelRadius")(e.target.value.replace(/\D/g, "").slice(0, 3))}
        placeholder="25"
        inputMode="numeric"
        hint="How far you're willing to travel from your city"
      />
    </div>
  );
}

function CertStep({
  certs,
  onToggle,
  onSetLicense,
}: {
  certs: CertEntry[];
  onToggle: (bodyId: string) => void;
  onSetLicense: (bodyId: string, license: string) => void;
}) {
  return (
    <div>
      <StepHeading
        line1="ANY"
        line2="CERTS?"
        blurb="Select any officiating certifications you hold. You can add more later. Skip if none."
      />
      <Label>Certification body</Label>
      <div className="mt-1 flex flex-col gap-2">
        {CERT_BODIES.map((body) => {
          const entry = certs.find((c) => c.bodyId === body.id);
          return (
            <div key={body.id}>
              <OptionRow
                label={body.label}
                sublabel={body.full}
                selected={!!entry}
                onClick={() => onToggle(body.id)}
              />
              {entry && (
                <div className="border-x-[1.5px] border-b-[1.5px] border-signal bg-chalk px-4 py-2.5">
                  <span
                    className="mb-1.5 block font-mono-bold text-[9px] uppercase text-ink-60"
                    style={{ letterSpacing: 1.5 }}
                  >
                    License # (optional)
                  </span>
                  <input
                    value={entry.licenseNumber}
                    onChange={(e) => onSetLicense(body.id, e.target.value)}
                    placeholder="e.g. 123456"
                    className="w-full border border-ink-20 bg-paper px-3 py-2 font-mono text-ink outline-none placeholder:text-ink-40"
                    style={{ fontSize: 13 }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-5 flex gap-2.5 border border-dashed border-ink-40 px-3.5 py-3">
        <span className="font-mono text-base text-ink-60">▸</span>
        <p className="flex-1 font-mono text-[10px] uppercase text-ink-60" style={{ lineHeight: "15px" }}>
          No cert yet? No problem. Hit next to skip — you can add certifications from your
          profile later.
        </p>
      </div>
    </div>
  );
}

function LevelStep({
  selectedLevels,
  onToggle,
}: {
  selectedLevels: string[];
  onToggle: (levelId: string) => void;
}) {
  const tiers = ["AMATEUR", "COLLEGE", "PRO"] as const;
  return (
    <div>
      <StepHeading
        line1="WHAT LEVELS"
        line2="DO YOU WORK?"
        blurb="Select all that apply. This helps organizers match you to the right games."
      />
      {tiers.map((tier) => (
        <div key={tier} className="mb-5">
          <p
            className="mb-2 font-mono-bold text-[9px] uppercase text-ink-40"
            style={{ letterSpacing: 2.5 }}
          >
            ── {tier}
          </p>
          <div className="flex flex-col gap-1.5">
            {LEVELS.filter((l) => l.tier === tier).map((level) => (
              <OptionRow
                key={level.id}
                label={level.label}
                selected={selectedLevels.includes(level.id)}
                onClick={() => onToggle(level.id)}
                dim
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
