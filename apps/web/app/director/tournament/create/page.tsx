"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  BigChoice,
  Chip,
  ChipRow,
  DateField,
  Label,
  SectionLabel,
  SelectField,
  TextArea,
  TextField,
} from "@/components/ui/Field";
import { Spinner } from "@/components/ui/AppButton";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { supabase } from "@/lib/supabase";
import {
  createTournament,
  fetchMyHirerId,
  fetchTournamentById,
  updateTournament,
} from "@/lib/director/queries";
import { HALF_MINUTES, QUARTER_MINUTES, RULESETS } from "@/lib/basketball/options";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

export default function CreateTournamentPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-paper" />}>
      <CreateTournamentInner />
    </Suspense>
  );
}

/** Port of refee-mobile/refee/app/(director)/tournament/create.tsx. */
function CreateTournamentInner() {
  const router = useRouter();
  const editId = useSearchParams().get("editId");
  const isEdit = !!editId;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    startsOn: "",
    endsOn: "",
    venueName: "",
    venueCity: "",
    venueState: "",
    ruleset: "",
    rulesetModifications: "",
    gameFormat: "" as "" | "quarters" | "halves",
    periodMinutes: "",
    uniformRequirements: "",
  });

  useEffect(() => {
    if (!editId) return;
    (async () => {
      const { tournament: t } = await fetchTournamentById(editId);
      if (!t) return;
      setForm({
        name: t.name,
        description: t.description ?? "",
        startsOn: t.starts_on,
        endsOn: t.ends_on,
        venueName: t.venue_name ?? "",
        venueCity: t.venue_city,
        venueState: t.venue_state,
        ruleset: t.ruleset ?? "",
        rulesetModifications: t.ruleset_modifications ?? "",
        gameFormat: (t.game_format ?? "") as "" | "quarters" | "halves",
        periodMinutes: t.period_minutes ? String(t.period_minutes) : "",
        uniformRequirements: t.uniform_requirements ?? "",
      });
    })();
  }, [editId]);

  const set = (key: keyof typeof form) => (val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  const stateValid = !form.venueState || US_STATES.includes(form.venueState.toUpperCase());
  const canSubmit =
    form.name.trim().length >= 2 &&
    form.startsOn.trim().length >= 1 &&
    form.endsOn.trim().length >= 1 &&
    form.venueName.trim().length >= 1 &&
    form.venueCity.trim().length >= 1 &&
    !!form.ruleset &&
    !!form.gameFormat &&
    !!form.periodMinutes &&
    form.uniformRequirements.trim().length >= 1 &&
    US_STATES.includes(form.venueState.toUpperCase());

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setLoading(false);
      return;
    }

    const hirerId = await fetchMyHirerId(session.user.id);
    if (!hirerId) {
      setError("Director profile not found. Please try again.");
      setLoading(false);
      return;
    }

    const args = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      startsOn: form.startsOn.trim(),
      endsOn: form.endsOn.trim(),
      venueName: form.venueName.trim(),
      venueCity: form.venueCity.trim(),
      venueState: form.venueState.trim().toUpperCase(),
      ruleset: form.ruleset,
      rulesetModifications: form.rulesetModifications.trim() || undefined,
      gameFormat: (form.gameFormat || undefined) as "quarters" | "halves" | undefined,
      periodMinutes: form.periodMinutes ? parseInt(form.periodMinutes, 10) : undefined,
      uniformRequirements: form.uniformRequirements.trim() || undefined,
    };

    if (isEdit && editId) {
      const { error: updateErr } = await updateTournament(editId, args);
      setLoading(false);
      if (updateErr) {
        setError(updateErr.message);
        return;
      }
      router.push(`/director/tournament/${editId}`);
      return;
    }

    const { tournamentId, error: createErr } = await createTournament(hirerId, args);
    setLoading(false);
    if (createErr || !tournamentId) {
      setError(createErr?.message ?? "Could not create tournament.");
      return;
    }
    router.push(`/director/tournament/${tournamentId}`);
  };

  const minuteOptions = (form.gameFormat === "quarters" ? QUARTER_MINUTES : HALF_MINUTES).map(
    (m) => ({ id: m, label: `${m} MINUTES` })
  );

  return (
    <div className="app-canvas app-canvas--form bg-paper">
      <ScreenHeader
        title={isEdit ? "Edit tournament" : "New tournament"}
        backHref="/director/tournaments"
      />

      <div className="flex-1 px-5 pb-6">
        <h1
          className="mb-6 font-display text-ink"
          style={{ fontSize: 32, letterSpacing: -1.2, lineHeight: "32px" }}
        >
          {isEdit ? "EDIT TOURNAMENT" : "NEW TOURNAMENT"}
        </h1>

        <SectionLabel>Tournament details</SectionLabel>
        <Label>Tournament name *</Label>
        <TextField
          value={form.name}
          onChange={(e) => set("name")(e.target.value)}
          placeholder="e.g. Austin Hoops Classic 2026"
        />
        <Label className="mt-4">Description (optional)</Label>
        <TextArea
          value={form.description}
          onChange={(e) => set("description")(e.target.value)}
          placeholder="Tell referees what to expect..."
          rows={3}
        />

        <SectionLabel className="mt-7">Dates *</SectionLabel>
        <Label>Starts on</Label>
        <DateField value={form.startsOn} onChange={set("startsOn")} />
        <Label className="mt-4">Ends on</Label>
        <DateField value={form.endsOn} onChange={set("endsOn")} min={form.startsOn || undefined} />

        <SectionLabel className="mt-7">Ruleset *</SectionLabel>
        <ChipRow>
          {RULESETS.map((r) => (
            <Chip
              key={r.id}
              label={r.label}
              selected={form.ruleset === r.id}
              onClick={() => set("ruleset")(r.id)}
            />
          ))}
        </ChipRow>
        {!!form.ruleset && (
          <>
            <Label className="mt-4">Rule modifications (optional)</Label>
            <TextArea
              value={form.rulesetModifications}
              onChange={(e) => set("rulesetModifications")(e.target.value)}
              placeholder="e.g. Running clock after 20-pt lead..."
              rows={2}
            />
          </>
        )}

        <SectionLabel className="mt-7">Game format *</SectionLabel>
        <Label>Periods — applies to every game</Label>
        <div className="flex gap-2">
          {(
            [
              { id: "quarters", num: "4", label: "Quarters" },
              { id: "halves", num: "2", label: "Halves" },
            ] as const
          ).map((opt) => (
            <BigChoice
              key={opt.id}
              num={opt.num}
              label={opt.label}
              selected={form.gameFormat === opt.id}
              onClick={() => setForm((f) => ({ ...f, gameFormat: opt.id, periodMinutes: "" }))}
            />
          ))}
        </div>
        {form.gameFormat !== "" && (
          <>
            <Label className="mt-4">
              {form.gameFormat === "quarters" ? "Minutes per quarter *" : "Minutes per half *"}
            </Label>
            <SelectField
              value={form.periodMinutes}
              onChange={set("periodMinutes")}
              options={minuteOptions}
              placeholder="SELECT MINUTES"
            />
          </>
        )}

        <SectionLabel className="mt-7">Uniform *</SectionLabel>
        <Label>Required uniform — applies to every game</Label>
        <TextField
          value={form.uniformRequirements}
          onChange={(e) => set("uniformRequirements")(e.target.value)}
          placeholder="e.g. Black and white stripes, black pants"
        />

        <SectionLabel className="mt-7">Venue</SectionLabel>
        <Label>Venue name</Label>
        <TextField
          value={form.venueName}
          onChange={(e) => set("venueName")(e.target.value)}
          placeholder="e.g. Austin Recreation Center"
        />
        <Label className="mt-4">City *</Label>
        <TextField
          value={form.venueCity}
          onChange={(e) => set("venueCity")(e.target.value)}
          placeholder="Austin"
        />
        <Label className="mt-4">State * (2-letter code)</Label>
        <TextField
          value={form.venueState}
          onChange={(e) => set("venueState")(e.target.value.toUpperCase().slice(0, 2))}
          placeholder="TX"
          maxLength={2}
          error={form.venueState.length === 2 && !stateValid ? "Invalid state code" : undefined}
        />
      </div>

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
          onClick={handleSubmit}
          disabled={!canSubmit || loading}
          className={`flex w-full items-center justify-center gap-2 py-4 ${
            canSubmit && !loading
              ? "bg-ink text-paper hover:opacity-80"
              : "cursor-not-allowed bg-ink-20 text-ink-40"
          }`}
        >
          {loading ? (
            <Spinner />
          ) : (
            <>
              <span className="font-mono-bold" style={{ fontSize: 12, letterSpacing: 2.5 }}>
                {isEdit ? "SAVE CHANGES" : "CREATE TOURNAMENT"}
              </span>
              <span className="font-mono-bold text-base">→</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
