"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { Wordmark } from "@/components/Wordmark";
import { ZebraRule } from "@/components/ui/ZebraRule";
import { AppButton, Spinner } from "@/components/ui/AppButton";
import { LoadError } from "@/components/ui/LoadError";
import { friendlyLoadError, withDeadline } from "@/lib/network";
import { supabase } from "@/lib/supabase";
import {
  amIStaff,
  clearPaymentReview,
  fetchAdminMetrics,
  fetchIdentityQueue,
  fetchPaymentIssues,
  fetchUserDetail,
  searchUsers,
  setIdentityStatus,
  setSuspended,
  statusLabel,
  type AdminMetrics,
  type IdentityQueueRow,
  type PaymentIssueRow,
  type UserSearchRow,
} from "@/lib/admin/queries";

type Tab = "queue" | "accounts" | "payments" | "metrics";

const TABS: { id: Tab; label: string }[] = [
  { id: "queue", label: "Verification" },
  { id: "accounts", label: "Accounts" },
  { id: "payments", label: "Payments" },
  { id: "metrics", label: "Metrics" },
];

/** Semantic, not decorative — these say "needs you" vs "settled". */
const TONE: Record<string, string> = {
  approved: "text-court border-court",
  declined: "text-foul border-foul",
  in_review: "text-whistle-ink border-whistle-ink",
  suspended: "text-foul border-foul",
  neutral: "text-ink-60 border-ink-20",
};

/**
 * Refee staff tools.
 *
 * Hiding this page is a courtesy, not the access control: every call it makes
 * is a security-definer function that checks public.admins for itself
 * (migrations 0050/0051). Someone who forces their way onto the page gets a
 * working layout with nothing in it.
 */
export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-paper text-signal">
          <Spinner />
        </div>
      }
    >
      <AdminDashboard />
    </Suspense>
  );
}

function AdminDashboard() {
  const [staff, setStaff] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>("queue");

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
        <p
          className="font-mono-bold text-[10px] uppercase text-ink-60"
          style={{ letterSpacing: 2 }}
        >
          Not available
        </p>
        <p className="max-w-sm text-sm text-ink-80">
          This area is for Refee staff. If you think you should have access, ask
          someone on the team to add you.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-ink px-5 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Wordmark className="text-xl" />
            <span
              className="border border-ink px-2 py-1 font-mono-bold text-[9px] uppercase text-ink"
              style={{ letterSpacing: 1.5 }}
            >
              Staff
            </span>
          </div>
        </div>
      </header>
      <ZebraRule />

      <div className="mx-auto max-w-5xl px-5 py-6">
        <div role="tablist" aria-label="Staff tools" className="mb-6 flex border border-ink">
          {TABS.map((t, i) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 whitespace-nowrap px-3 py-3 font-mono-bold text-[10px] uppercase ${
                i < TABS.length - 1 ? "border-r border-ink" : ""
              } ${tab === t.id ? "bg-ink text-paper" : "bg-chalk text-ink-60 hover:text-ink"}`}
              style={{ letterSpacing: 1.5 }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "queue" && <QueuePanel />}
        {tab === "accounts" && <AccountsPanel />}
        {tab === "payments" && <PaymentsPanel />}
        {tab === "metrics" && <MetricsPanel />}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Verification queue                                                */
/* ---------------------------------------------------------------- */

function QueuePanel() {
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
        else setRows(r);
      })
      .catch((e) => setError(friendlyLoadError(e)))
      .finally(() => setLoading(false));
  }, []);

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

function AccountsPanel() {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<UserSearchRow[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const run = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setOpenId(null);
    setDetail(null);
    const { rows: r, error: e } = await searchUsers(query.trim());
    setLoading(false);
    setSearched(true);
    if (e) setError(e.message);
    else setRows(r);
  };

  const open = async (id: string) => {
    if (openId === id) {
      setOpenId(null);
      setDetail(null);
      return;
    }
    setOpenId(id);
    setDetail(null);
    const { detail: d } = await fetchUserDetail(id);
    setDetail(d);
  };

  // Suspending asks for a reason inline; it goes on the record against the
  // staff member who did it, so it is not an afterthought in a dialog.
  const [suspending, setSuspending] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const applySuspend = async (row: UserSearchRow) => {
    const currentlySuspended = Boolean(row.suspended_at);
    if (!currentlySuspended && !reason.trim()) return;
    setNote(null);
    const { error: e } = await setSuspended(
      row.user_id,
      !currentlySuspended,
      currentlySuspended ? null : reason.trim()
    );
    if (e) setNote(e.message);
    else {
      setNote(currentlySuspended ? "Account reinstated." : "Account suspended.");
      setSuspending(null);
      setReason("");
      void run();
    }
  };

  return (
    <div>
      <PanelHeading
        title="Find an account"
        sub="Name, phone, email or user id. Suspending stops someone taking or posting work — it never deletes them."
      />

      <div className="mb-5 flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void run()}
          placeholder="Search…"
          aria-label="Search accounts"
          className="flex-1 border border-ink bg-chalk px-3 py-3 text-sm text-ink outline-none focus:border-signal"
        />
        <AppButton label={loading ? "…" : "Search"} onClick={() => void run()} disabled={loading} />
      </div>

      {note && <Note text={note} />}
      {error && <LoadError message={error} onRetry={() => void run()} />}

      {searched && rows.length === 0 && !loading && !error && (
        <Empty text="Nobody matched that." />
      )}

      {rows.length > 0 && (
        <div className="border border-ink bg-ink" style={{ display: "grid", gap: 1 }}>
          {rows.map((r) => (
            <div key={r.user_id} className="bg-chalk p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-lg font-black tracking-tight text-ink">
                    {r.display_name ?? "Unnamed"}
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] uppercase text-ink-60" style={{ letterSpacing: 1 }}>
                    {[r.primary_role, r.city && r.state ? `${r.city}, ${r.state}` : null, r.phone, r.email]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Pill
                    label={statusLabel(r.identity_status)}
                    tone={TONE[r.identity_status] ?? TONE.neutral}
                  />
                  {r.suspended_at && <Pill label="Suspended" tone={TONE.suspended} />}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <AppButton
                  label={openId === r.user_id ? "Hide detail" : "Open"}
                  variant="secondary"
                  onClick={() => void open(r.user_id)}
                />
                <AppButton
                  label={r.suspended_at ? "Reinstate" : "Suspend"}
                  variant={r.suspended_at ? "court" : "danger"}
                  onClick={() => {
                    if (r.suspended_at) {
                      void applySuspend(r);
                    } else {
                      setReason("");
                      setSuspending(r.user_id);
                    }
                  }}
                />
              </div>

              {suspending === r.user_id && (
                <div className="mt-3 border border-foul bg-foul/5 p-3">
                  <label
                    htmlFor={`susp-${r.user_id}`}
                    className="block font-mono-bold text-[9px] uppercase text-ink-60"
                    style={{ letterSpacing: 1.5 }}
                  >
                    Why — recorded against your name
                  </label>
                  <textarea
                    id={`susp-${r.user_id}`}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                    autoFocus
                    className="mt-2 w-full border border-ink bg-chalk px-3 py-2 text-sm text-ink outline-none focus:border-signal"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <AppButton
                      label="Confirm suspend"
                      variant="danger"
                      disabled={!reason.trim()}
                      onClick={() => void applySuspend(r)}
                    />
                    <AppButton
                      label="Cancel"
                      variant="secondary"
                      onClick={() => {
                        setSuspending(null);
                        setReason("");
                      }}
                    />
                  </div>
                </div>
              )}

              {openId === r.user_id && (
                <div className="mt-4 border-t border-ink-20 pt-4">
                  {detail === null ? (
                    <PanelSpinner />
                  ) : (
                    <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-ink-80">
                      {JSON.stringify(detail, null, 2)}
                    </pre>
                  )}
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

  return (
    <div className="flex flex-col gap-6">
      <StatGroup
        title="People"
        stats={[
          { label: "Total", value: m.users.total },
          { label: "Referees", value: m.users.referees },
          { label: "Directors", value: m.users.directors },
          { label: "Assignors", value: m.users.assignors },
          { label: "New this week", value: m.users.new_7d },
          { label: "Suspended", value: m.suspended },
        ]}
      />
      <StatGroup
        title="Games"
        stats={[
          { label: "Open", value: m.games.open },
          { label: "Upcoming", value: m.games.upcoming },
          { label: "Completed (30d)", value: m.games.completed_30d },
          { label: "Unfilled in 7 days", value: m.games.unfilled_next_7d },
        ]}
      />
      <StatGroup
        title="Money"
        stats={[
          { label: "Owed to crew", value: `$${Number(m.money.owed_to_crew).toLocaleString()}` },
          { label: "Paid (30d)", value: `$${Number(m.money.paid_30d).toLocaleString()}` },
          { label: "Needs review", value: m.money.needs_review },
        ]}
      />
      <StatGroup
        title="Verification"
        stats={Object.entries(m.verification).map(([k, v]) => ({
          label: statusLabel(k),
          value: v,
        }))}
      />
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Pieces                                                            */
/* ---------------------------------------------------------------- */

function StatGroup({
  title,
  stats,
}: {
  title: string;
  stats: { label: string; value: number | string }[];
}) {
  return (
    <section>
      <h2 className="mb-3 font-mono-bold text-[10px] uppercase text-ink-60" style={{ letterSpacing: 2 }}>
        {title}
      </h2>
      <div className="grid grid-cols-2 gap-px border border-ink bg-ink sm:grid-cols-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-chalk p-4">
            <p
              className="font-display text-3xl font-black tracking-tight text-ink"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {s.value}
            </p>
            <p className="mt-1 font-mono text-[9px] uppercase leading-snug text-ink-60" style={{ letterSpacing: 1 }}>
              {s.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function PanelHeading({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-5">
      <h2 className="font-display text-2xl font-black tracking-tight text-ink">{title}</h2>
      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-60">{sub}</p>
    </div>
  );
}

function Pill({ label, tone }: { label: string; tone: string }) {
  return (
    <span
      className={`border px-2 py-1 font-mono-bold text-[9px] uppercase ${tone}`}
      style={{ letterSpacing: 1.2 }}
    >
      {label}
    </span>
  );
}

function Note({ text }: { text: string }) {
  return (
    <p
      role="status"
      className="mb-4 border border-ink-20 bg-chalk px-4 py-3 font-mono text-[11px] uppercase text-ink"
      style={{ letterSpacing: 1 }}
    >
      {text}
    </p>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="border border-dashed border-ink-20 px-4 py-10 text-center text-sm text-ink-60">
      {text}
    </p>
  );
}

function PanelSpinner() {
  return (
    <div className="flex justify-center py-10 text-signal">
      <Spinner />
    </div>
  );
}
