"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AppButton, Spinner } from "@/components/ui/AppButton";
import { LoadError } from "@/components/ui/LoadError";
import {
  AdminFrame,
  Empty,
  Note,
  PanelHeading,
  PanelSpinner,
  Pill,
  TONE,
  Tabs,
  money,
  shortDate,
} from "@/components/admin/ui";
import { friendlyLoadError, withDeadline } from "@/lib/network";
import {
  clearPaymentReview,
  fetchAdminMetrics,
  fetchIdentityQueue,
  fetchPaymentIssues,
  listAccounts,
  setIdentityStatus,
  statusLabel,
  verificationBreakdown,
  type AccountRow,
  type AdminMetrics,
  type IdentityQueueRow,
  type PaymentIssueRow,
} from "@/lib/admin/queries";

type Tab = "queue" | "accounts" | "payments" | "metrics";
const TAB_IDS: Tab[] = ["queue", "accounts", "payments", "metrics"];

/** Refee staff tools. Access control lives in the database; see AdminFrame. */
export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-paper text-signal">
          <Spinner />
        </div>
      }
    >
      <AdminFrame>
        <AdminDashboard />
      </AdminFrame>
    </Suspense>
  );
}

function AdminDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  // The tab lives in the URL so coming back from an account lands on Accounts.
  const fromUrl = params.get("tab") as Tab | null;
  const tab: Tab = fromUrl && TAB_IDS.includes(fromUrl) ? fromUrl : "queue";
  const setTab = (t: Tab) => router.replace(`${pathname}?tab=${t}`, { scroll: false });
  const [waiting, setWaiting] = useState<number | null>(null);

  return (
    <>
      <Tabs
        label="Staff tools"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "queue", label: "Verification", count: waiting },
          { id: "accounts", label: "Accounts" },
          { id: "payments", label: "Payments" },
          { id: "metrics", label: "Metrics" },
        ]}
      />

      {tab === "queue" && <QueuePanel onCount={setWaiting} />}
      {tab === "accounts" && <AccountsPanel />}
      {tab === "payments" && <PaymentsPanel />}
      {tab === "metrics" && <MetricsPanel />}
    </>
  );
}

/* ---------------------------------------------------------------- */
/* Verification queue                                                */
/* ---------------------------------------------------------------- */

function QueuePanel({ onCount }: { onCount: (n: number) => void }) {
  const [rows, setRows] = useState<IdentityQueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    withDeadline(fetchIdentityQueue())
      .then(({ rows: r, error: e }) => {
        if (e) setError(e.message);
        else {
          setRows(r);
          onCount(r.length);
        }
      })
      .catch((e) => setError(friendlyLoadError(e)))
      .finally(() => setLoading(false));
  }, [onCount]);

  useEffect(load, [load]);

  // Which row is being decided, and the note going on the record with it. A
  // decline is written in the person's own words back to them, so it gets a
  // real field rather than a browser prompt.
  const [deciding, setDeciding] = useState<{ userId: string; status: string } | null>(null);
  const [reason, setReason] = useState("");

  const confirmDecision = async () => {
    if (!deciding) return;
    const { userId, status } = deciding;
    if (status === "declined" && !reason.trim()) return;
    setBusy(userId);
    setNote(null);
    const { error: e } = await setIdentityStatus(userId, status, reason.trim() || null);
    setBusy(null);
    if (e) setNote(e.message);
    else {
      setNote(`Marked ${statusLabel(status).toLowerCase()}.`);
      setDeciding(null);
      setReason("");
      load();
    }
  };

  if (loading) return <PanelSpinner />;
  if (error) return <LoadError message={error} onRetry={load} />;

  return (
    <div>
      <PanelHeading
        title="Waiting on a person"
        sub="Checks Didit sent to review, and the ones that didn't pass. Approving moves the badge everywhere."
      />
      {note && <Note text={note} />}
      {rows.length === 0 ? (
        <Empty text="Nothing waiting. Every check has been decided." />
      ) : (
        <div className="border border-ink bg-ink" style={{ display: "grid", gap: 1 }}>
          {rows.map((r) => (
            <div key={r.user_id} className="bg-chalk p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-lg font-black tracking-tight text-ink">
                    {r.display_name ?? "Unnamed"}
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] uppercase text-ink-60" style={{ letterSpacing: 1 }}>
                    {r.primary_role ?? "no role"}
                    {r.legal_name ? ` · ID says ${r.legal_name}` : ""}
                    {r.date_of_birth ? ` · born ${r.date_of_birth}` : ""}
                  </p>
                </div>
                <Pill label={statusLabel(r.identity_status)} tone={TONE[r.identity_status] ?? TONE.neutral} />
              </div>

              {r.identity_last_reason && (
                <p className="mt-3 border-l-2 border-whistle pl-3 text-[13px] leading-5 text-ink">
                  {r.identity_last_reason}
                </p>
              )}

              {deciding?.userId === r.user_id ? (
                <div className="mt-4 border border-ink-20 bg-paper p-3">
                  <label
                    htmlFor={`reason-${r.user_id}`}
                    className="block font-mono-bold text-[9px] uppercase text-ink-60"
                    style={{ letterSpacing: 1.5 }}
                  >
                    {deciding.status === "declined"
                      ? "Why — this is shown to them"
                      : "Note for the record (optional)"}
                  </label>
                  <textarea
                    id={`reason-${r.user_id}`}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                    autoFocus
                    className="mt-2 w-full border border-ink bg-chalk px-3 py-2 text-sm text-ink outline-none focus:border-signal"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <AppButton
                      label={busy === r.user_id ? "Working…" : `Confirm ${deciding.status === "approved" ? "approve" : "decline"}`}
                      variant={deciding.status === "approved" ? "court" : "danger"}
                      disabled={
                        busy === r.user_id ||
                        (deciding.status === "declined" && !reason.trim())
                      }
                      onClick={() => void confirmDecision()}
                    />
                    <AppButton
                      label="Cancel"
                      variant="secondary"
                      onClick={() => {
                        setDeciding(null);
                        setReason("");
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex flex-wrap gap-2">
                  <AppButton
                    label="Approve"
                    variant="court"
                    disabled={busy === r.user_id}
                    onClick={() => {
                      setReason("");
                      setDeciding({ userId: r.user_id, status: "approved" });
                    }}
                  />
                  <AppButton
                    label="Decline"
                    variant="danger"
                    disabled={busy === r.user_id}
                    onClick={() => {
                      setReason("");
                      setDeciding({ userId: r.user_id, status: "declined" });
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Accounts                                                          */
/* ---------------------------------------------------------------- */

const PAGE = 50;

const ROLE_FILTERS: { id: string | null; label: string }[] = [
  { id: null, label: "Everyone" },
  { id: "referee", label: "Referees" },
  { id: "director", label: "Directors" },
  { id: "assignor", label: "Assignors" },
];

function AccountsPanel() {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<string | null>(null);
  const [rows, setRows] = useState<AccountRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Only the newest search may write results, so a slow early one can't
  // overwrite what the person typed last.
  const latest = useRef(0);

  const load = useCallback((q: string, r: string | null) => {
    const ticket = ++latest.current;
    setLoading(true);
    setError(null);
    withDeadline(listAccounts({ query: q, role: r, limit: PAGE, offset: 0 }))
      .then(({ rows: next, total: t, error: e }) => {
        if (ticket !== latest.current) return;
        if (e) setError(e.message);
        else {
          setRows(next);
          setTotal(t);
        }
      })
      .catch((e) => ticket === latest.current && setError(friendlyLoadError(e)))
      .finally(() => ticket === latest.current && setLoading(false));
  }, []);

  // Search as they type, after a short pause.
  useEffect(() => {
    const t = setTimeout(() => load(query, role), query ? 250 : 0);
    return () => clearTimeout(t);
  }, [query, role, load]);

  const more = async () => {
    setLoadingMore(true);
    const { rows: next, error: e } = await listAccounts({ query, role, limit: PAGE, offset: rows.length });
    setLoadingMore(false);
    if (e) setError(e.message);
    else setRows((prev) => [...prev, ...next]);
  };

  return (
    <div>
      <PanelHeading
        title="Accounts"
        sub="Everyone on Refee, newest first. Open one to edit it, see it as they do, check the money, or switch it off."
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, email, phone, city or id"
          aria-label="Search accounts"
          className="min-w-0 flex-1 border border-ink bg-chalk px-3 py-3 text-sm text-ink outline-none focus:border-signal"
        />
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by role">
          {ROLE_FILTERS.map((f) => (
            <button
              key={f.label}
              type="button"
              aria-pressed={role === f.id}
              onClick={() => setRole(f.id)}
              className={`border px-3 py-2 font-mono-bold text-[10px] uppercase ${
                role === f.id ? "border-ink bg-ink text-paper" : "border-ink-20 text-ink-60 hover:border-ink hover:text-ink"
              }`}
              style={{ letterSpacing: 1.2 }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && <LoadError message={error} onRetry={() => load(query, role)} />}

      {!error && (
        <p className="mb-2 font-mono text-[10px] uppercase text-ink-60" style={{ letterSpacing: 1 }}>
          {loading ? "Loading…" : `Showing ${rows.length} of ${total}`}
        </p>
      )}

      {!loading && !error && rows.length === 0 && (
        <Empty text={query ? "Nobody matched that." : "No accounts yet."} />
      )}

      {rows.length > 0 && (
        <div className={`border border-ink-20 bg-chalk ${loading ? "opacity-60" : ""}`}>
          <div
            className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,1fr)_auto] gap-4 border-b border-ink-20 px-4 py-2 font-mono-bold text-[9px] uppercase text-ink-60 md:grid"
            style={{ letterSpacing: 1.5 }}
          >
            <span>Person</span>
            <span>Roles</span>
            <span>Location</span>
            <span>Joined</span>
            <span className="text-right">Status</span>
          </div>
          <ul>
            {rows.map((r) => (
              <li key={r.user_id} className="border-b border-ink-10 last:border-b-0">
                <Link
                  href={`/admin/accounts/${r.user_id}`}
                  className="grid grid-cols-1 gap-2 px-4 py-3 hover:bg-paper md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,1fr)_auto] md:items-center md:gap-4"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-display text-base font-black tracking-tight text-ink">
                      {r.display_name ?? "Unnamed"}
                    </span>
                    <span className="block truncate text-xs text-ink-60">{r.email ?? r.phone ?? "No contact"}</span>
                    {/* On a phone the columns fold into one line under the name. */}
                    <span className="mt-1 block truncate text-xs text-ink-80 md:hidden">
                      {[
                        (r.roles.length ? r.roles : [r.primary_role ?? ""]).filter(Boolean).join(" · "),
                        r.city && r.state ? `${r.city}, ${r.state}` : null,
                        `joined ${shortDate(r.created_at)}`,
                      ]
                        .filter(Boolean)
                        .join(" — ")}
                    </span>
                  </span>
                  <span
                    className="hidden truncate font-mono text-[10px] uppercase text-ink-80 md:block"
                    style={{ letterSpacing: 1 }}
                  >
                    {(r.roles.length ? r.roles : [r.primary_role ?? "—"]).join(" · ")}
                  </span>
                  <span className="hidden truncate text-xs text-ink-80 md:block">
                    {r.city && r.state ? `${r.city}, ${r.state}` : "—"}
                  </span>
                  <span className="hidden text-xs text-ink-60 md:block">{shortDate(r.created_at)}</span>
                  <span className="flex flex-wrap gap-1.5 md:justify-end">
                    {r.deactivated ? (
                      <Pill label="Deactivated" tone={TONE.suspended} />
                    ) : r.suspended_at ? (
                      <Pill label="Suspended" tone={TONE.suspended} />
                    ) : null}
                    <Pill label={statusLabel(r.identity_status)} tone={TONE[r.identity_status] ?? TONE.neutral} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {rows.length < total && !loading && (
        <div className="mt-4 flex justify-center">
          <AppButton
            label={loadingMore ? "Loading…" : `Show more (${total - rows.length} left)`}
            variant="secondary"
            disabled={loadingMore}
            onClick={() => void more()}
          />
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Payments                                                          */
/* ---------------------------------------------------------------- */

function PaymentsPanel() {
  const [rows, setRows] = useState<PaymentIssueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    withDeadline(fetchPaymentIssues())
      .then(({ rows: r, error: e }) => {
        if (e) setError(e.message);
        else setRows(r);
      })
      .catch((e) => setError(friendlyLoadError(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const [clearing, setClearing] = useState<string | null>(null);
  const [what, setWhat] = useState("");

  const clear = async (jobId: string) => {
    if (!what.trim()) return;
    const { error: e } = await clearPaymentReview(jobId, what.trim());
    if (e) setNote(e.message);
    else {
      setNote("Marked as handled.");
      setClearing(null);
      setWhat("");
      load();
    }
  };

  if (loading) return <PanelSpinner />;
  if (error) return <LoadError message={error} onRetry={load} />;

  return (
    <div>
      <PanelHeading
        title="Money that needs a person"
        sub="Failed charges, disputes, and closed games whose crew still hasn't been paid. Clearing only clears the flag — the money moves through Stripe."
      />
      {note && <Note text={note} />}
      {rows.length === 0 ? (
        <Empty text="Nothing stuck. Every game's money is where it should be." />
      ) : (
        <div className="border border-ink bg-ink" style={{ display: "grid", gap: 1 }}>
          {rows.map((r) => (
            <div key={r.job_id} className="bg-chalk p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-lg font-black tracking-tight text-ink">
                    {r.title ?? "Untitled game"}
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] uppercase text-ink-60" style={{ letterSpacing: 1 }}>
                    {[r.org_name, r.job_status, r.payment_status].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {r.dispute_status && <Pill label={`Dispute: ${r.dispute_status}`} tone={TONE.declined} />}
                  {r.requires_review && <Pill label="Needs review" tone={TONE.in_review} />}
                </div>
              </div>

              {r.crew_owed != null && Number(r.crew_owed) > 0 && (
                <p className="mt-3 font-mono text-[11px] text-ink" style={{ letterSpacing: 0.5 }}>
                  Crew still owed: ${Number(r.crew_owed).toLocaleString()}
                </p>
              )}
              {r.review_reason && (
                <p className="mt-2 border-l-2 border-foul pl-3 text-[13px] leading-5 text-ink">
                  {r.review_reason}
                </p>
              )}

              {r.requires_review &&
                (clearing === r.job_id ? (
                  <div className="mt-4 border border-ink-20 bg-paper p-3">
                    <label
                      htmlFor={`clr-${r.job_id}`}
                      className="block font-mono-bold text-[9px] uppercase text-ink-60"
                      style={{ letterSpacing: 1.5 }}
                    >
                      What was done — recorded against your name
                    </label>
                    <textarea
                      id={`clr-${r.job_id}`}
                      value={what}
                      onChange={(e) => setWhat(e.target.value)}
                      rows={2}
                      autoFocus
                      className="mt-2 w-full border border-ink bg-chalk px-3 py-2 text-sm text-ink outline-none focus:border-signal"
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <AppButton
                        label="Confirm"
                        disabled={!what.trim()}
                        onClick={() => void clear(r.job_id)}
                      />
                      <AppButton
                        label="Cancel"
                        variant="secondary"
                        onClick={() => {
                          setClearing(null);
                          setWhat("");
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="mt-4">
                    <AppButton
                      label="Mark handled"
                      variant="secondary"
                      onClick={() => {
                        setWhat("");
                        setClearing(r.job_id);
                      }}
                    />
                  </div>
                ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Metrics                                                           */
/* ---------------------------------------------------------------- */

const VERIFICATION_COLOR: Record<string, string> = {
  approved: "bg-court",
  in_review: "bg-whistle",
  in_progress: "bg-signal",
  declined: "bg-foul",
  expired: "bg-ink-40",
  abandoned: "bg-ink-40",
  unstarted: "bg-ink-20",
};

function MetricsPanel() {
  const [m, setM] = useState<AdminMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    withDeadline(fetchAdminMetrics())
      .then(({ metrics, error: e }) => {
        if (e) setError(e.message);
        else setM(metrics);
      })
      .catch((e) => setError(friendlyLoadError(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  if (loading) return <PanelSpinner />;
  if (error) return <LoadError message={error} onRetry={load} />;
  if (!m) return <Empty text="No numbers yet." />;

  const verification = verificationBreakdown(m.verification);
  const verifiedPct = verification.find((v) => v.status === "approved")?.pct ?? 0;
  const roleTotal = m.users.referees + m.users.directors + m.users.assignors;

  return (
    <div className="flex flex-col gap-5">
      {/* The four numbers to look at first. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="People" value={m.users.total} sub={`+${m.users.new_7d} this week`} />
        <Kpi label="Open games" value={m.games.open} sub={`${m.games.unfilled_next_7d} unfilled in the next 7 days`} warn={m.games.unfilled_next_7d > 0} />
        <Kpi label="Owed to crew" value={money(m.money.owed_to_crew)} sub={`${money(m.money.paid_30d)} paid in 30 days`} />
        <Kpi label="Needs a person" value={m.money.needs_review} sub="payment issues to review" warn={m.money.needs_review > 0} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <MetricCard title="People">
          <Bar
            parts={[
              { label: "Referees", value: m.users.referees, color: "bg-signal" },
              { label: "Directors", value: m.users.directors, color: "bg-court" },
              { label: "Assignors", value: m.users.assignors, color: "bg-whistle" },
            ]}
            total={roleTotal}
          />
          <Rows
            rows={[
              { label: "Referees", value: m.users.referees, dot: "bg-signal" },
              { label: "Directors", value: m.users.directors, dot: "bg-court" },
              { label: "Assignors", value: m.users.assignors, dot: "bg-whistle" },
              { label: "New this week", value: m.users.new_7d },
              { label: "Suspended", value: m.suspended, warn: m.suspended > 0 },
            ]}
          />
        </MetricCard>

        <MetricCard title="Verification" aside={`${verifiedPct}% verified`}>
          <Bar
            parts={verification.map((v) => ({
              label: statusLabel(v.status),
              value: v.count,
              color: VERIFICATION_COLOR[v.status] ?? "bg-ink-20",
            }))}
            total={verification.reduce((s, v) => s + v.count, 0)}
          />
          {verification.length === 0 ? (
            <p className="text-sm text-ink-60">Nobody has started a check yet.</p>
          ) : (
            <Rows
              rows={verification.map((v) => ({
                label: statusLabel(v.status),
                value: v.count,
                dot: VERIFICATION_COLOR[v.status] ?? "bg-ink-20",
                warn: v.status === "in_review" && v.count > 0,
              }))}
            />
          )}
        </MetricCard>

        <MetricCard title="Games">
          <Rows
            rows={[
              { label: "Open for applications", value: m.games.open },
              { label: "Upcoming", value: m.games.upcoming },
              { label: "Completed in the last 30 days", value: m.games.completed_30d },
              { label: "Unfilled in the next 7 days", value: m.games.unfilled_next_7d, warn: m.games.unfilled_next_7d > 0 },
            ]}
          />
        </MetricCard>

        <MetricCard title="Money">
          <Rows
            rows={[
              { label: "Owed to crew", value: money(m.money.owed_to_crew) },
              { label: "Paid out in the last 30 days", value: money(m.money.paid_30d) },
              { label: "Payment issues to review", value: m.money.needs_review, warn: m.money.needs_review > 0 },
            ]}
          />
        </MetricCard>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, warn }: { label: string; value: number | string; sub: string; warn?: boolean }) {
  return (
    <div className={`border bg-chalk p-4 ${warn ? "border-whistle-ink" : "border-ink-20"}`}>
      <p className="font-mono-bold text-[9px] uppercase text-ink-60" style={{ letterSpacing: 1.5 }}>
        {label}
      </p>
      <p
        className="mt-2 font-display text-3xl font-black tracking-tight text-ink sm:text-4xl"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </p>
      <p className={`mt-1 text-xs ${warn ? "text-whistle-ink" : "text-ink-60"}`}>{sub}</p>
    </div>
  );
}

function MetricCard({ title, aside, children }: { title: string; aside?: string; children: React.ReactNode }) {
  return (
    <section className="border border-ink-20 bg-chalk p-4">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h3 className="font-mono-bold text-[10px] uppercase text-ink" style={{ letterSpacing: 1.8 }}>
          {title}
        </h3>
        {aside && <span className="font-mono text-[10px] uppercase text-ink-60">{aside}</span>}
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

/** A single stacked bar showing how a whole splits up. */
function Bar({ parts, total }: { parts: { label: string; value: number; color: string }[]; total: number }) {
  if (total <= 0) return null;
  return (
    <div className="flex h-2.5 w-full overflow-hidden bg-ink-10" role="img" aria-label={parts.map((p) => `${p.label} ${p.value}`).join(", ")}>
      {parts
        .filter((p) => p.value > 0)
        .map((p) => (
          <span key={p.label} className={p.color} style={{ width: `${(p.value / total) * 100}%` }} />
        ))}
    </div>
  );
}

function Rows({ rows }: { rows: { label: string; value: number | string; dot?: string; warn?: boolean }[] }) {
  return (
    <dl className="divide-y divide-ink-10">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-3 py-2">
          <dt className="flex items-center gap-2 text-sm text-ink-80">
            {r.dot && <span className={`inline-block h-2 w-2 ${r.dot}`} aria-hidden />}
            {r.label}
          </dt>
          <dd
            className={`font-display text-lg font-black tracking-tight ${r.warn ? "text-whistle-ink" : "text-ink"}`}
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {r.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
