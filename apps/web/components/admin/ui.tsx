"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";
import { ZebraRule } from "@/components/ui/ZebraRule";
import { Spinner } from "@/components/ui/AppButton";
import { withDeadline } from "@/lib/network";
import { supabase } from "@/lib/supabase";
import { amIStaff } from "@/lib/admin/queries";

// Pieces shared by the staff pages.

/** Semantic, not decorative — these say "needs you" vs "settled". */
export const TONE: Record<string, string> = {
  approved: "text-court border-court",
  declined: "text-foul border-foul",
  in_review: "text-whistle-ink border-whistle-ink",
  suspended: "text-foul border-foul",
  neutral: "text-ink-60 border-ink-20",
};

/**
 * Staff-only page frame. Hiding the page is a courtesy, not the access
 * control: every call inside is a security-definer function (or the
 * admin-account edge function) that checks public.admins for itself.
 */
export function AdminFrame({ children }: { children: ReactNode }) {
  const [staff, setStaff] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const {
        data: { session },
      } = await withDeadline(supabase.auth.getSession());
      setStaff(await amIStaff(session?.user?.id));
    })().catch(() => setStaff(false));
  }, []);

  if (staff === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper text-signal">
        <Spinner />
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-paper px-6 text-center">
        <p className="font-mono-bold text-[10px] uppercase text-ink-60" style={{ letterSpacing: 2 }}>
          Not available
        </p>
        <p className="max-w-sm text-sm text-ink-80">
          This area is for Refee staff. If you think you should have access, ask someone on the team to add you.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-ink px-4 py-4 sm:px-5">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <Link href="/admin" className="flex items-center gap-3">
            <Wordmark className="text-xl" />
            <span
              className="border border-ink px-2 py-1 font-mono-bold text-[9px] uppercase text-ink"
              style={{ letterSpacing: 1.5 }}
            >
              Staff
            </span>
          </Link>
        </div>
      </header>
      <ZebraRule />
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-5">{children}</div>
    </div>
  );
}

/**
 * Underlined tabs: the active one is marked by a heavy rule beneath it, the
 * rest sit on the page rather than in boxes. Scrolls sideways on a phone
 * instead of squashing the labels.
 */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: { id: T; label: string; count?: number | null }[];
  value: T;
  onChange: (id: T) => void;
  label: string;
}) {
  return (
    <div className="-mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div role="tablist" aria-label={label} className="flex min-w-max gap-6 border-b border-ink-20">
        {tabs.map((t) => {
          const active = t.id === value;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(t.id)}
              className={`-mb-px flex items-center gap-2 border-b-[3px] pb-3 pt-1 font-mono-bold text-[11px] uppercase transition-colors ${
                active ? "border-signal text-ink" : "border-transparent text-ink-60 hover:border-ink-20 hover:text-ink"
              }`}
              style={{ letterSpacing: 1.5 }}
            >
              {t.label}
              {t.count != null && t.count > 0 && (
                <span
                  className={`min-w-[18px] px-1 py-0.5 text-center text-[9px] ${
                    active ? "bg-signal text-paper" : "bg-ink-20 text-ink"
                  }`}
                >
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function PanelHeading({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-2xl font-black tracking-tight text-ink">{title}</h2>
        {sub && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-60">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function Pill({ label, tone }: { label: string; tone: string }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full border px-2 py-1 font-mono-bold text-[9px] uppercase ${tone}`}
      style={{ letterSpacing: 1.2 }}
    >
      {label}
    </span>
  );
}

export function Note({ text, tone = "neutral" }: { text: string; tone?: "neutral" | "error" }) {
  return (
    <p
      role="status"
      className={`mb-4 border px-4 py-3 font-mono text-[11px] uppercase ${
        tone === "error" ? "border-foul bg-foul/5 text-foul" : "border-ink-20 bg-chalk text-ink"
      }`}
      style={{ letterSpacing: 1 }}
    >
      {text}
    </p>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <p className="border border-dashed border-ink-20 px-4 py-10 text-center text-sm text-ink-60">{text}</p>
  );
}

export function PanelSpinner() {
  return (
    <div className="flex justify-center py-10 text-signal">
      <Spinner />
    </div>
  );
}

/** Small uppercase label used above values and fields. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono-bold text-[9px] uppercase text-ink-60" style={{ letterSpacing: 1.5 }}>
      {children}
    </p>
  );
}

/** A card with a heading, for grouping related facts. */
export function Card({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg border border-ink-20 bg-chalk">
      <div className="flex items-center justify-between gap-3 border-b border-ink-20 px-4 py-3">
        <h3 className="font-mono-bold text-[10px] uppercase text-ink" style={{ letterSpacing: 1.8 }}>
          {title}
        </h3>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

/** Label/value rows inside a card. */
export function Facts({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {rows.map((r) => (
        <div key={r.label} className="min-w-0">
          <dt>
            <Eyebrow>{r.label}</Eyebrow>
          </dt>
          <dd className="mt-1 break-words text-sm text-ink">{r.value ?? <span className="text-ink-40">—</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

export const money = (dollars: number | string | null | undefined) =>
  `$${Number(dollars ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export const moneyCents = (cents: number | string | null | undefined) => money(Number(cents ?? 0) / 100);

export const shortDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : null;

export const dateTime = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

/** A labelled textarea for "why", used before any action that goes on the record. */
export function ReasonField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="block font-mono-bold text-[9px] uppercase text-ink-60" style={{ letterSpacing: 1.5 }}>
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        autoFocus
        className="mt-2 w-full border border-ink bg-chalk px-3 py-2 text-sm text-ink outline-none focus:border-signal"
      />
    </div>
  );
}
