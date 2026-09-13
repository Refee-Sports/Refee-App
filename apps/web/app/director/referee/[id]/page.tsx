"use client";

import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { ZebraRule } from "@/components/ui/ZebraRule";
import { Icon } from "@/components/ui/Icon";
import { Spinner } from "@/components/ui/AppButton";
import { fetchRefereePublicView, type RefereePublicView } from "@/lib/director/queries";

const CERT_LABELS: Record<string, string> = {
  iaabo: "IAABO",
  nfhs: "NFHS",
  ncaa: "NCAA",
  fiba: "FIBA",
};

const LEVEL_LABELS: Record<string, string> = {
  youth_rec: "Youth League / Rec",
  high_school: "High School",
  juco: "JUCO",
  naia: "NAIA",
  ncaa_mens: "NCAA Men's",
  ncaa_womens: "NCAA Women's",
  pro_am: "Pro-Am",
};

const LEVEL_TIERS: Record<string, string> = {
  youth_rec: "AMATEUR",
  high_school: "AMATEUR",
  juco: "COLLEGE",
  naia: "COLLEGE",
  ncaa_mens: "COLLEGE",
  ncaa_womens: "COLLEGE",
  pro_am: "PRO",
};

/**
 * Port of refee-mobile/refee/app/(director)/referee/[id].tsx — the
 * privacy-limited referee view. First name + last initial only; the database's
 * RLS is what actually enforces that, this screen just presents it.
 */
export default function RefereePublicProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [ref, setRef] = useState<RefereePublicView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { ref: r, error: e } = await fetchRefereePublicView(id);
      setRef(r);
      setError(e?.message ?? null);
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-paper text-signal">
        <Spinner />
      </div>
    );
  }

  if (!ref) {
    return (
      <div className="flex flex-1 items-center justify-center bg-paper px-6">
        <p className="font-mono-bold uppercase text-ink" style={{ letterSpacing: 1 }}>
          {error ?? "Referee not found."}
        </p>
      </div>
    );
  }

  const initials = `${ref.first_name[0] ?? "?"}${ref.last_initial}`.toUpperCase();

  const levelsByTier: Record<string, string[]> = {};
  for (const l of ref.levels) {
    const tier = LEVEL_TIERS[l.level_id] ?? "OTHER";
    (levelsByTier[tier] ??= []).push(l.level_id);
  }
  const tierOrder = ["AMATEUR", "COLLEGE", "PRO"];

  return (
    <div className="app-canvas bg-paper pb-10">
      <div className="flex items-center gap-3 px-5 py-3 sm:px-0 lg:pt-5">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center border border-ink bg-chalk text-ink hover:bg-ink hover:text-paper"
        >
          <Icon name="chevron-left" size={18} />
        </button>
        <span
          className="font-mono-bold text-[10px] uppercase text-ink-60"
          style={{ letterSpacing: 2 }}
        >
          Referee profile
        </span>
      </div>

      {/* Privacy notice */}
      <div className="mx-5 sm:mx-0 mb-3 flex gap-2 border border-signal/30 bg-signal/5 px-3.5 py-2.5">
        <span className="font-mono text-base text-signal">▸</span>
        <p
          className="flex-1 font-mono text-[9px] text-signal/80"
          style={{ letterSpacing: 0.5, lineHeight: "14px" }}
        >
          LIMITED VIEW — ONLY PUBLIC INFORMATION IS DISPLAYED. FULL IDENTITY IS PRIVATE.
        </p>
      </div>

      {/* Avatar */}
      <div className="mb-5 flex items-center gap-4 px-5">
        <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden border border-ink bg-ink">
          {ref.avatar_url ? (
            // Supabase Storage URL; plain <img> avoids configuring a remote loader.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={ref.avatar_url}
              alt=""
              width={80}
              height={80}
              className="h-20 w-20 object-cover"
            />
          ) : (
            <span className="font-display text-paper" style={{ fontSize: 28, letterSpacing: -1 }}>
              {initials}
            </span>
          )}
        </span>
        <div className="flex-1">
          <span className="block font-mono text-[9px] uppercase text-ink-60" style={{ letterSpacing: 2 }}>
            Referee
          </span>
          <span
            className="block font-display uppercase text-ink"
            style={{ fontSize: 26, letterSpacing: -1, lineHeight: "26px" }}
          >
            {ref.first_name.toUpperCase()}
            <br />
            <span className="text-signal">{ref.last_initial.toUpperCase()}.</span>
          </span>
          <span
            className="mt-1 block font-mono text-[9px] uppercase text-ink-60"
            style={{ letterSpacing: 1.5 }}
          >
            {ref.city.toUpperCase()}, {ref.state}
          </span>
        </div>
      </div>

      <div className="mb-4 px-5">
        <ZebraRule thin noMargin />
      </div>

      {/* Rating — refs with under 5 ratings show as NEW REF, no number */}
      <div className="mx-5 sm:mx-0 mb-4 flex border border-ink bg-chalk">
        {ref.rating_count < 5 ? (
          <StatCell
            label="Rating"
            value="NEW REF"
            sub={`${ref.rating_count} RATING${ref.rating_count !== 1 ? "S" : ""}`}
          />
        ) : (
          <StatCell
            label="Rating"
            value={ref.rating.toFixed(2)}
            sub={`${ref.rating_count} RATINGS`}
          />
        )}
        <span className="w-px bg-ink" />
        <StatCell
          label="Location"
          value={`${ref.city.toUpperCase()}, ${ref.state}`}
          sub="Base city"
        />
      </div>

      {/* Credentials and levels sit side by side on desktop. */}
      <div className="split-grid">
        <div className="min-w-0">

      {/* Credentials */}
      {ref.certifications.length > 0 && (
        <>
          <SectionHead num="01" title="Credentials" />
          <div className="mx-5 sm:mx-0 mb-4 flex flex-wrap gap-1.5">
            {ref.certifications.map((c, i) => (
              <span
                key={i}
                className="flex items-center gap-1.5 border border-ink bg-chalk px-2.5 py-1.5"
              >
                <span className="text-[10px] text-court">✓</span>
                <span
                  className="font-mono text-[9px] uppercase text-ink"
                  style={{ letterSpacing: 1.5 }}
                >
                  {CERT_LABELS[c.org_name] ?? c.org_name}
                  {c.license_number ? ` ${c.license_number}` : ""}
                </span>
              </span>
            ))}
          </div>
        </>
      )}

        </div>

        <div className="min-w-0">

      {/* Levels */}
      {ref.levels.length > 0 && (
        <>
          <SectionHead
            num={ref.certifications.length > 0 ? "02" : "01"}
            title="Levels Worked"
          />
          <div className="mx-5 sm:mx-0 flex flex-col gap-3">
            {tierOrder.map((tier) => {
              const tierLevels = levelsByTier[tier];
              if (!tierLevels?.length) return null;
              return (
                <div key={tier}>
                  <span
                    className="mb-1.5 block font-mono-bold text-[9px] uppercase text-ink-40"
                    style={{ letterSpacing: 2 }}
                  >
                    ── {tier}
                  </span>
                  <div className="flex flex-col gap-1">
                    {tierLevels.map((levelId) => (
                      <div key={levelId} className="border border-ink-20 bg-chalk px-4 py-3">
                        <span className="font-mono text-sm text-ink" style={{ letterSpacing: 0.5 }}>
                          {LEVEL_LABELS[levelId] ?? levelId}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

        </div>
      </div>

      {ref.certifications.length === 0 && ref.levels.length === 0 && (
        <div className="mx-5 sm:mx-0 flex items-center justify-center border border-dashed border-ink-20 px-4 py-6">
          <p
            className="text-center font-mono text-[11px] uppercase text-ink-40"
            style={{ letterSpacing: 1 }}
          >
            No credentials or levels listed.
          </p>
        </div>
      )}
    </div>
  );
}

function StatCell({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="flex flex-1 flex-col items-center px-3 py-4">
      <span
        className="mb-1 font-mono text-[8px] uppercase text-ink-40"
        style={{ letterSpacing: 2 }}
      >
        {label}
      </span>
      <span
        className="block truncate font-display text-ink"
        style={{ fontSize: 20, letterSpacing: -0.5, lineHeight: "20px" }}
      >
        {value}
      </span>
      <span
        className="mt-0.5 font-mono text-[8px] uppercase text-ink-60"
        style={{ letterSpacing: 1.5 }}
      >
        {sub}
      </span>
    </div>
  );
}

function SectionHead({ num, title }: { num: string; title: string }) {
  return (
    <div className="mx-5 sm:mx-0 mb-2.5 mt-5 flex items-baseline gap-2">
      <span className="font-mono text-[8px] text-ink-40" style={{ letterSpacing: 1.5 }}>
        {num}
      </span>
      <h2
        className="font-display text-ink"
        style={{ fontSize: 18, letterSpacing: -0.5, lineHeight: "20px" }}
      >
        {title.toUpperCase()}
      </h2>
    </div>
  );
}
