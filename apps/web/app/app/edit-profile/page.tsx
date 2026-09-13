"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AffixField, Label, OptionRow, TextField } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/AppButton";
import { Icon } from "@/components/ui/Icon";
import { supabase } from "@/lib/supabase";
import {
  fetchMyAvailability,
  fetchMyCertifications,
  fetchMyLevels,
  fetchMyProfile,
  fetchMyRefSports,
  updateFullProfile,
  type CertEntry,
} from "@/lib/profile/queries";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

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

const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const RADIUS_PRESETS = [10, 25, 50, 100];

function snapRadius(miles: number): string {
  const nearest = RADIUS_PRESETS.reduce((best, r) =>
    Math.abs(r - miles) < Math.abs(best - miles) ? r : best
  );
  return String(nearest);
}

type FormData = {
  firstName: string;
  lastInitial: string;
  city: string;
  state: string;
  sportId: string;
  yearsExperience: string;
  minPay: string;
  travelRadius: string;
  availableDays: number;
  certs: CertEntry[];
  levels: string[];
};

/** Port of refee-mobile/refee/app/(app)/edit-profile.tsx. */
export default function EditProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>({
    firstName: "",
    lastInitial: "",
    city: "",
    state: "",
    sportId: "basketball",
    yearsExperience: "",
    minPay: "35",
    travelRadius: "25",
    availableDays: 0,
    certs: [],
    levels: [],
  });

  useEffect(() => {
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      const uid = session.user.id;

      const [profileRes, sportsRes, availRes, certsRes, levelsRes] = await Promise.all([
        fetchMyProfile(uid),
        fetchMyRefSports(uid),
        fetchMyAvailability(uid),
        fetchMyCertifications(uid),
        fetchMyLevels(uid),
      ]);

      const p = profileRes.data as { first_name?: string; last_initial?: string; city?: string; state?: string } | null;
      const sport = (sportsRes.data ?? [])[0] as { sport_id?: string; years_experience?: number } | undefined;
      const av = availRes.data as {
        min_pay_per_game?: number;
        travel_radius_miles?: number;
        available_days?: number;
      } | null;
      const rawCerts = (certsRes.data ?? []) as { org_name: string; license_number: string | null }[];
      const rawLevels = (levelsRes.data ?? []) as { level_id: string }[];

      setForm({
        firstName: p?.first_name ?? "",
        lastInitial: p?.last_initial ?? "",
        city: p?.city ?? "",
        state: p?.state ?? "",
        sportId: sport?.sport_id ?? "basketball",
        yearsExperience: sport?.years_experience ? String(sport.years_experience) : "",
        minPay: av?.min_pay_per_game ? String(av.min_pay_per_game) : "35",
        travelRadius: snapRadius(av?.travel_radius_miles ?? 25),
        availableDays: av?.available_days ?? 0,
        certs: rawCerts.map((c) => ({
          bodyId: c.org_name,
          licenseNumber: c.license_number ?? "",
        })),
        levels: rawLevels.map((l) => l.level_id),
      });
      setLoading(false);
    })();
  }, []);

  const set =
    (key: keyof Omit<FormData, "certs" | "levels" | "availableDays">) => (val: string) =>
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

  const toggleDay = (dayIndex: number) =>
    setForm((f) => ({ ...f, availableDays: f.availableDays ^ (1 << dayIndex) }));

  const toggleLevel = (levelId: string) =>
    setForm((f) => ({
      ...f,
      levels: f.levels.includes(levelId)
        ? f.levels.filter((l) => l !== levelId)
        : [...f.levels, levelId],
    }));

  const stateValid = US_STATES.includes(form.state.toUpperCase());
  const canSave =
    form.firstName.trim().length >= 1 &&
    form.lastInitial.trim().length >= 1 &&
    form.city.trim().length >= 1 &&
    stateValid &&
    !!form.sportId &&
    parseInt(form.minPay, 10) >= 1 &&
    parseInt(form.travelRadius, 10) >= 1 &&
    form.levels.length >= 1;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setError("Session expired. Please sign in again.");
      setSaving(false);
      return;
    }

    const { error: saveError } = await updateFullProfile(session.user.id, {
      firstName: form.firstName.trim(),
      lastInitial: form.lastInitial.trim()[0].toUpperCase(),
      city: form.city.trim(),
      state: form.state.trim().toUpperCase(),
      sportId: form.sportId,
      yearsExperience: parseInt(form.yearsExperience || "0", 10),
      minPayPerGame: parseInt(form.minPay, 10),
      travelRadiusMiles: parseInt(form.travelRadius, 10),
      availableDays: form.availableDays,
      certs: form.certs,
      levelIds: form.levels,
    });

    setSaving(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    router.push("/app/profile");
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-paper text-signal">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="app-canvas app-canvas--form bg-paper">
      <div className="flex items-center justify-between border-b border-ink-20 px-5 py-3">
        <button
          type="button"
          onClick={() => router.push("/app/profile")}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center border border-ink bg-chalk text-ink hover:bg-ink hover:text-paper"
        >
          <Icon name="chevron-left" size={18} />
        </button>
        <span className="font-display text-ink" style={{ fontSize: 16, letterSpacing: -0.5 }}>
          EDIT PROFILE
        </span>
        <span className="h-9 w-9" />
      </div>

      <div className="flex-1 pb-6">
        <FormSection label="Identity">
          <Label>First name</Label>
          <TextField
            value={form.firstName}
            onChange={(e) => set("firstName")(e.target.value)}
            placeholder="Jordan"
          />
          <Label className="mt-4">Last initial</Label>
          <TextField
            value={form.lastInitial}
            onChange={(e) =>
              set("lastInitial")(
                e.target.value.replace(/[^a-zA-Z]/g, "").slice(0, 1).toUpperCase()
              )
            }
            placeholder="T"
            maxLength={1}
            hint="Only your initial is stored and shown to organizers"
          />
        </FormSection>

        <FormSection label="Location">
          <Label>City</Label>
          <TextField
            value={form.city}
            onChange={(e) => set("city")(e.target.value)}
            placeholder="Austin"
          />
          <Label className="mt-4">State</Label>
          <TextField
            value={form.state}
            onChange={(e) => set("state")(e.target.value.toUpperCase().slice(0, 2))}
            placeholder="TX"
            maxLength={2}
            error={
              form.state.length === 2 && !stateValid
                ? "Enter a valid 2-letter state code"
                : undefined
            }
          />
        </FormSection>

        <FormSection label="Sport">
          <Label>Years of experience</Label>
          <TextField
            value={form.yearsExperience}
            onChange={(e) =>
              set("yearsExperience")(e.target.value.replace(/\D/g, "").slice(0, 2))
            }
            placeholder="5"
            inputMode="numeric"
            hint="How many years you've been officiating basketball"
          />
        </FormSection>

        <FormSection label="Pay floor">
          <Label>Min pay per game ($)</Label>
          <AffixField
            prefix="$"
            value={form.minPay}
            onChange={(e) => set("minPay")(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="35"
            inputMode="numeric"
            hint="Jobs below this rate won't appear in your feed"
          />

          <Label className="mt-5">Travel radius</Label>
          <div className="flex gap-1.5">
            {RADIUS_PRESETS.map((r) => {
              const selected = form.travelRadius === String(r);
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => set("travelRadius")(String(r))}
                  aria-pressed={selected}
                  className={`flex flex-1 flex-col items-center border-[1.5px] py-3.5 hover:opacity-80 ${
                    selected ? "border-signal bg-signal/10" : "border-ink bg-chalk"
                  }`}
                >
                  <span
                    className={`font-display ${selected ? "text-signal" : "text-ink"}`}
                    style={{ fontSize: 18, letterSpacing: -0.5 }}
                  >
                    {r}
                  </span>
                  <span
                    className={`font-mono-bold text-[8px] uppercase ${
                      selected ? "text-signal/70" : "text-ink-40"
                    }`}
                    style={{ letterSpacing: 1.5 }}
                  >
                    Miles
                  </span>
                </button>
              );
            })}
          </div>
        </FormSection>

        <FormSection label="Days available">
          <p className="mb-4 font-mono text-xs text-ink-60" style={{ lineHeight: "16px" }}>
            Tap the days you&apos;re open to work. Directors see this on your profile.
          </p>
          <div className="flex gap-1">
            {DAYS.map((day, i) => {
              const active = !!(form.availableDays & (1 << i));
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(i)}
                  aria-pressed={active}
                  className={`flex-1 border-[1.5px] py-3 hover:opacity-80 ${
                    active ? "border-signal bg-signal" : "border-ink-20 bg-chalk"
                  }`}
                >
                  <span
                    className={`font-mono-bold text-[9px] ${active ? "text-paper" : "text-ink-40"}`}
                    style={{ letterSpacing: 0.5 }}
                  >
                    {day}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex gap-1.5">
            {(
              [
                ["WEEKDAYS", 0b0111110],
                ["WEEKENDS", 0b1000001],
                ["ALL DAYS", 0b1111111],
              ] as const
            ).map(([label, mask]) => {
              const active = form.availableDays === mask;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() =>
                    setForm((f) => ({ ...f, availableDays: active ? 0 : mask }))
                  }
                  className={`flex-1 border py-2 hover:opacity-80 ${
                    active ? "border-ink bg-ink" : "border-ink-20 bg-paper"
                  }`}
                >
                  <span
                    className={`font-mono-bold text-[8px] uppercase ${
                      active ? "text-hi-vis" : "text-ink-60"
                    }`}
                    style={{ letterSpacing: 1 }}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </FormSection>

        <FormSection label="Certifications">
          <p className="mb-4 font-mono text-xs text-ink-60" style={{ lineHeight: "16px" }}>
            Select any certifications you hold. Leave blank if none.
          </p>
          <div className="flex flex-col gap-2">
            {CERT_BODIES.map((body) => {
              const entry = form.certs.find((c) => c.bodyId === body.id);
              return (
                <div key={body.id}>
                  <OptionRow
                    label={body.label}
                    sublabel={body.full}
                    selected={!!entry}
                    onClick={() => toggleCert(body.id)}
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
                        onChange={(e) => setCertLicense(body.id, e.target.value)}
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
        </FormSection>

        <FormSection label="Levels worked">
          <p className="mb-4 font-mono text-xs text-ink-60" style={{ lineHeight: "16px" }}>
            Select all levels you&apos;ve officiated. At least one required.
          </p>
          {(["AMATEUR", "COLLEGE", "PRO"] as const).map((tier) => (
            <div key={tier} className="mb-5">
              <span
                className="mb-2 block font-mono-bold text-[9px] uppercase text-ink-40"
                style={{ letterSpacing: 2.5 }}
              >
                ── {tier}
              </span>
              <div className="flex flex-col gap-1.5">
                {LEVELS.filter((l) => l.tier === tier).map((level) => (
                  <OptionRow
                    key={level.id}
                    label={level.label}
                    selected={form.levels.includes(level.id)}
                    onClick={() => toggleLevel(level.id)}
                    dim
                  />
                ))}
              </div>
            </div>
          ))}
        </FormSection>
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
          onClick={handleSave}
          disabled={!canSave || saving}
          className={`flex w-full items-center justify-center gap-2 py-4 ${
            canSave && !saving
              ? "bg-ink text-paper hover:opacity-80"
              : "cursor-not-allowed bg-ink-20 text-ink-40"
          }`}
        >
          {saving ? (
            <Spinner />
          ) : (
            <>
              <span className="font-mono-bold" style={{ fontSize: 12, letterSpacing: 2.5 }}>
                SAVE CHANGES
              </span>
              <span className="font-mono-bold text-base">→</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function FormSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="mx-5 mt-7">
      <h2
        className="mb-4 border-b border-ink-20 pb-2 font-mono-bold text-[9px] uppercase text-ink-40"
        style={{ letterSpacing: 2.5 }}
      >
        {label}
      </h2>
      {children}
    </section>
  );
}
