"use client";

import { useState } from "react";
import { Label, OptionRow, TextField } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/AppButton";
import { Icon } from "@/components/ui/Icon";
import { useAuth } from "@/components/providers/AuthProvider";
import { getSupabaseSetupError, supabase } from "@/lib/supabase";
import { createDirectorProfile } from "@/lib/director/queries";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

const ORG_TYPES = [
  { id: "tournament", label: "TOURNAMENT" },
  { id: "league", label: "LEAGUE" },
  { id: "school", label: "SCHOOL / UNIVERSITY" },
  { id: "parks_rec", label: "PARKS & REC" },
];

type FormData = {
  firstName: string;
  lastName: string;
  orgName: string;
  orgType: string;
  city: string;
  state: string;
};

/** Port of refee-mobile/refee/app/(onboarding)/director.tsx. */
export default function DirectorOnboardingPage() {
  const { refreshProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>({
    firstName: "",
    lastName: "",
    orgName: "",
    orgType: "",
    city: "",
    state: "",
  });

  const set = (key: keyof FormData) => (val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  const canAdvance = [
    form.firstName.trim().length >= 1 && form.lastName.trim().length >= 1,
    form.orgName.trim().length >= 1 && !!form.orgType,
    form.city.trim().length >= 1 && US_STATES.includes(form.state.toUpperCase()),
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
        await supabase.auth.signOut();
        return;
      }

      const { error: saveError } = await createDirectorProfile(user.id, {
        contactFirstName: form.firstName.trim(),
        contactLastInitial: form.lastName.trim()[0]?.toUpperCase() ?? "?",
        orgName: form.orgName.trim(),
        orgType: form.orgType,
        city: form.city.trim(),
        state: form.state.trim().toUpperCase(),
      });

      if (saveError) {
        setError(saveError.message || "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      // Re-read profile + role; RouteGate lands us in the director app.
      await refreshProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
      setLoading(false);
    }
  };

  const isLastStep = step === 2;

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <div className="flex items-center justify-between px-5 py-3">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center border border-ink bg-chalk text-ink hover:bg-ink hover:text-paper"
        >
          <Icon name="chevron-left" size={18} />
        </button>
        <span
          className="font-mono-bold text-[9px] uppercase text-ink-60"
          style={{ letterSpacing: 2 }}
        >
          <span className="text-ink">{`0${step + 1}`}</span> / 03 · Director setup
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
        <div className="h-full bg-signal" style={{ width: `${((step + 1) / 3) * 100}%` }} />
      </div>

      <div className="flex-1 px-5 py-6">
        {step === 0 && (
          <div>
            <Heading line1="YOUR" line2={"CONTACT\nNAME"} blurb="This is how you'll appear to referees on the platform." />
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
        )}

        {step === 1 && (
          <div>
            <Heading
              line1="YOUR"
              line2="ORGANIZATION"
              blurb="Tell us about your event or organization. This is shown on all of your game postings."
            />
            <Label>Organization name</Label>
            <TextField
              value={form.orgName}
              onChange={(e) => set("orgName")(e.target.value)}
              placeholder="Austin Hoops Classic"
              autoFocus
            />
            <Label className="mt-5">Organization type</Label>
            <div className="flex flex-col gap-2">
              {ORG_TYPES.map((t) => (
                <OptionRow
                  key={t.id}
                  label={t.label}
                  selected={form.orgType === t.id}
                  onClick={() => set("orgType")(t.id)}
                />
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <Heading
              line1="WHERE ARE"
              line2="YOU BASED?"
              blurb="Your primary market helps referees find your tournaments."
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
                form.state.length === 2 && !US_STATES.includes(form.state.toUpperCase())
                  ? "Enter a valid US state code"
                  : undefined
              }
            />
          </div>
        )}
      </div>

      <div className="action-bar sticky bottom-0">
        {error && (
          <p className="mb-3 font-mono text-[10px] uppercase text-foul" style={{ letterSpacing: 1 }}>
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

function Heading({ line1, line2, blurb }: { line1: string; line2: string; blurb: string }) {
  return (
    <>
      <h1
        className="whitespace-pre-line font-display text-ink"
        style={{ fontSize: 40, lineHeight: "46px", letterSpacing: -1.5 }}
      >
        {line1}
        {"\n"}
        <span className="text-signal">{line2}</span>
      </h1>
      <p className="mb-7 mt-3 text-ink-80" style={{ fontSize: 14, lineHeight: "20px" }}>
        {blurb}
      </p>
    </>
  );
}
