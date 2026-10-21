"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AppButton } from "@/components/ui/AppButton";
import { LoadError } from "@/components/ui/LoadError";
import {
  AdminFrame,
  Card,
  Empty,
  Eyebrow,
  Facts,
  Note,
  PanelSpinner,
  Pill,
  ReasonField,
  TONE,
  Tabs,
  dateTime,
  money,
  moneyCents,
  shortDate,
} from "@/components/admin/ui";
import { friendlyLoadError, withDeadline } from "@/lib/network";
import {
  adminAccountAction,
  fetchAccount,
  fetchUserFinances,
  profileChanges,
  profileFormFrom,
  setSuspended,
  statusLabel,
  updateProfile,
  viewAsUrl,
  type AccountDetail,
  type AccountFinances,
  type EditableField,
} from "@/lib/admin/queries";

type Section = "overview" | "edit" | "finances" | "history";

/** One account, for staff: what it is, what to change, and where its money went. */
export default function AdminAccountPage() {
  return (
    <AdminFrame>
      <AccountView />
    </AdminFrame>
  );
}

function AccountView() {
  const { id } = useParams<{ id: string }>();
  const [account, setAccount] = useState<AccountDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [section, setSection] = useState<Section>("overview");

  const load = useCallback(() => {
    setError(null);
    withDeadline(fetchAccount(id))
      .then(({ account: a, error: e }) => {
        if (e) setError(e.message);
        else if (!a) setError("No account with that id.");
        else setAccount(a);
      })
      .catch((e) => setError(friendlyLoadError(e)))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(load, [load]);

  if (loading) return <PanelSpinner />;
  if (error || !account) return <LoadError message={error ?? "Couldn't load this account."} onRetry={load} />;

  return (
    <div>
      <Link
        href="/admin?tab=accounts"
        className="mb-4 inline-block font-mono-bold text-[10px] uppercase text-ink-60 hover:text-ink"
        style={{ letterSpacing: 1.5 }}
      >
        ← All accounts
      </Link>

      <AccountHeader account={account} />
      <AccountActions account={account} onChanged={load} />

      <Tabs
        label="Account"
        value={section}
        onChange={setSection}
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "edit", label: "Edit" },
          { id: "finances", label: "Finances" },
          { id: "history", label: "Staff history", count: account.recent_staff_actions.length },
        ]}
      />

      {section === "overview" && <Overview account={account} />}
      {section === "edit" && (
        <EditForm
          account={account}
          onSaved={() => {
            load();
          }}
        />
      )}
      {section === "finances" && <Finances userId={account.user_id} />}
      {section === "history" && <History account={account} />}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Header and actions                                                */
/* ---------------------------------------------------------------- */

function AccountHeader({ account: a }: { account: AccountDetail }) {
  const initials =
    (a.display_name ?? "")
      .split(/\s+/)
      .map((w) => w.replace(/[^A-Za-z]/g, "").charAt(0))
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";
  return (
    <div className="mb-5 flex flex-wrap items-start gap-4">
      {a.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={a.avatar_url} alt="" className="h-16 w-16 border border-ink-20 object-cover" />
      ) : (
        <div className="flex h-16 w-16 items-center justify-center border border-ink-20 bg-chalk font-display text-xl font-black text-ink-60">
          {initials}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="font-display text-3xl font-black tracking-tight text-ink">{a.display_name ?? "Unnamed"}</h1>
        <p className="mt-1 break-words text-sm text-ink-80">
          {[a.email, a.phone, a.city && a.state ? `${a.city}, ${a.state}` : null].filter(Boolean).join(" · ")}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {a.roles.map((r) => (
            <Pill key={r} label={r} tone={r === a.primary_role ? "text-ink border-ink" : TONE.neutral} />
          ))}
          <Pill label={`ID ${statusLabel(a.identity.status)}`} tone={TONE[a.identity.status] ?? TONE.neutral} />
          {a.suspension.suspended_at && <Pill label="Suspended" tone={TONE.suspended} />}
          {a.deactivated && <Pill label="Deactivated" tone={TONE.suspended} />}
          {a.is_staff && <Pill label="Staff" tone="text-signal border-signal" />}
        </div>
      </div>
      <div className="w-full text-xs text-ink-60 sm:w-auto sm:text-right">
        <p>Joined {shortDate(a.created_at)}</p>
        <p>Last sign-in {dateTime(a.last_sign_in_at) ?? "never"}</p>
      </div>
    </div>
  );
}

type Pending = "view_as" | "suspend" | "deactivate" | null;

function AccountActions({ account: a, onChanged }: { account: AccountDetail; onChanged: () => void }) {
  const [pending, setPending] = useState<Pending>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; tone: "neutral" | "error" } | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const start = (p: Pending) => {
    setPending(p);
    setReason("");
    setNote(null);
    setLink(null);
  };

  const run = async (fn: () => Promise<{ error: Error | null }>, done: string) => {
    setBusy(true);
    setNote(null);
    const { error } = await fn();
    setBusy(false);
    if (error) setNote({ text: error.message, tone: "error" });
    else {
      setNote({ text: done, tone: "neutral" });
      setPending(null);
      setReason("");
      onChanged();
    }
  };

  const viewAs = async () => {
    setBusy(true);
    setNote(null);
    const { tokenHash, error } = await adminAccountAction("view_as", a.user_id, reason.trim());
    setBusy(false);
    if (error || !tokenHash) {
      setNote({ text: error?.message ?? "Couldn't make a link.", tone: "error" });
      return;
    }
    setLink(viewAsUrl(window.location.origin, tokenHash));
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* the link is selectable in the field below */
    }
  };

  const suspended = Boolean(a.suspension.suspended_at);
  const locked = a.is_staff;

  return (
    <div className="mb-6">
      <div className="flex flex-wrap gap-2">
        <AppButton
          label="View as them"
          variant="secondary"
          disabled={locked || a.deactivated || busy}
          onClick={() => start("view_as")}
        />
        {suspended ? (
          <AppButton
            label="Reinstate"
            variant="court"
            disabled={busy}
            onClick={() => void run(() => setSuspended(a.user_id, false, null), "Reinstated. They can take and post work again.")}
          />
        ) : (
          <AppButton label="Suspend" variant="danger" disabled={busy} onClick={() => start("suspend")} />
        )}
        {a.deactivated ? (
          <AppButton
            label="Reactivate"
            variant="court"
            disabled={busy || locked}
            onClick={() =>
              void run(
                async () => ({ error: (await adminAccountAction("reactivate", a.user_id)).error }),
                "Reactivated. They can sign in again."
              )
            }
          />
        ) : (
          <AppButton label="Deactivate" variant="danger" disabled={busy || locked} onClick={() => start("deactivate")} />
        )}
      </div>
      {locked && (
        <p className="mt-2 text-xs text-ink-60">This is a staff account. View as and deactivate are off for staff.</p>
      )}

      {note && (
        <div className="mt-3">
          <Note text={note.text} tone={note.tone} />
        </div>
      )}

      {pending === "view_as" && !link && (
        <ActionPanel tone="neutral">
          <p className="mb-3 text-sm text-ink-80">
            You&apos;ll get a one-time sign-in link for this account. Anything you do while signed in is done as
            them, so look, don&apos;t touch.
          </p>
          <ReasonField id="viewas-reason" label="Why — recorded against your name" value={reason} onChange={setReason} />
          <PanelButtons
            confirm={busy ? "Making link…" : "Make sign-in link"}
            disabled={busy || !reason.trim()}
            onConfirm={() => void viewAs()}
            onCancel={() => setPending(null)}
          />
        </ActionPanel>
      )}

      {pending === "view_as" && link && (
        <ActionPanel tone="neutral">
          <Eyebrow>Sign-in link ready</Eyebrow>
          <p className="mt-2 text-sm text-ink-80">
            Open it in a <strong>private or incognito window</strong>. Opening it in this window signs you out of
            staff. It works once and expires within the hour.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              readOnly
              value={link}
              onFocus={(e) => e.currentTarget.select()}
              aria-label="Sign-in link"
              className="min-w-0 flex-1 border border-ink-20 bg-paper px-3 py-2 font-mono text-[11px] text-ink"
            />
            <AppButton label={copied ? "Copied" : "Copy link"} onClick={() => void copy()} />
          </div>
          <div className="mt-3">
            <AppButton label="Done" variant="secondary" onClick={() => start(null)} />
          </div>
        </ActionPanel>
      )}

      {pending === "suspend" && (
        <ActionPanel tone="danger">
          <p className="mb-3 text-sm text-ink-80">
            They can still sign in, but can&apos;t take or post work, and drop out of the referee pool.
          </p>
          <ReasonField id="suspend-reason" label="Why — recorded against your name" value={reason} onChange={setReason} />
          <PanelButtons
            confirm="Confirm suspend"
            danger
            disabled={busy || !reason.trim()}
            onConfirm={() =>
              void run(() => setSuspended(a.user_id, true, reason.trim()), "Suspended.")
            }
            onCancel={() => setPending(null)}
          />
        </ActionPanel>
      )}

      {pending === "deactivate" && (
        <ActionPanel tone="danger">
          <p className="mb-3 text-sm text-ink-80">
            They can&apos;t sign in at all, and they&apos;re suspended too. Nothing is deleted: their games,
            payments and ratings stay. A session already open can last up to an hour.
          </p>
          <ReasonField id="deactivate-reason" label="Why — recorded against your name" value={reason} onChange={setReason} />
          <PanelButtons
            confirm="Confirm deactivate"
            danger
            disabled={busy || !reason.trim()}
            onConfirm={() =>
              void run(
                async () => ({ error: (await adminAccountAction("deactivate", a.user_id, reason.trim())).error }),
                "Deactivated. They can't sign in."
              )
            }
            onCancel={() => setPending(null)}
          />
        </ActionPanel>
      )}
    </div>
  );
}

function ActionPanel({ tone, children }: { tone: "neutral" | "danger"; children: React.ReactNode }) {
  return (
    <div className={`mt-3 border p-4 ${tone === "danger" ? "border-foul bg-foul/5" : "border-ink-20 bg-chalk"}`}>
      {children}
    </div>
  );
}

function PanelButtons({
  confirm,
  danger,
  disabled,
  onConfirm,
  onCancel,
}: {
  confirm: string;
  danger?: boolean;
  disabled: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <AppButton label={confirm} variant={danger ? "danger" : "primary"} disabled={disabled} onClick={onConfirm} />
      <AppButton label="Cancel" variant="secondary" onClick={onCancel} />
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Overview                                                          */
/* ---------------------------------------------------------------- */

function Overview({ account: a }: { account: AccountDetail }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Contact and details">
        <Facts
          rows={[
            { label: "Legal name", value: a.legal_name },
            { label: "Shown as", value: a.display_name },
            { label: "Email", value: a.email },
            { label: "Phone", value: a.phone },
            { label: "City", value: a.city && a.state ? `${a.city}, ${a.state}` : null },
            { label: "Home ZIP", value: a.home_zip },
            { label: "Date of birth", value: a.date_of_birth },
            { label: "User id", value: <span className="font-mono text-xs">{a.user_id}</span> },
          ]}
        />
      </Card>

      <Card title="Identity">
        <Facts
          rows={[
            { label: "Status", value: statusLabel(a.identity.status) },
            { label: "Verified", value: dateTime(a.identity.verified_at) },
            { label: "Last decision", value: dateTime(a.identity.decided_at) },
            { label: "Reason", value: a.identity.reason },
            {
              label: "Didit session",
              value: a.identity.session_id ? <span className="font-mono text-xs">{a.identity.session_id}</span> : null,
            },
          ]}
        />
      </Card>

      <Card title="Work">
        <Facts
          rows={[
            { label: "Games applied to or booked", value: a.work.assignments },
            { label: "Booked", value: a.work.accepted },
            { label: "Games called", value: a.badges.games_called_total },
            {
              label: "Rating",
              value: a.badges.rating_count ? `${Number(a.badges.rating).toFixed(1)} (${a.badges.rating_count})` : "No ratings",
            },
            { label: "Games posted", value: a.work.games_posted },
            { label: "Owed to them", value: money(a.work.unpaid_owed) },
          ]}
        />
      </Card>

      <Card title="Status">
        <Facts
          rows={[
            { label: "Suspended", value: a.suspension.suspended_at ? dateTime(a.suspension.suspended_at) : "No" },
            { label: "Suspension reason", value: a.suspension.reason },
            { label: "Can sign in", value: a.deactivated ? "No — deactivated" : "Yes" },
            { label: "In the pool", value: a.badges.is_active ? "Yes" : "No" },
            {
              label: "Payout account",
              value: a.payout_account.connected ? a.payout_account.status ?? "connected" : "Not connected",
            },
          ]}
        />
      </Card>

      {a.organizations.length > 0 && (
        <Card title="Organizations">
          <ul className="flex flex-col gap-2">
            {a.organizations.map((o) => (
              <li key={o.id} className="text-sm text-ink">
                <span className="font-semibold">{o.org_name}</span>
                <span className="text-ink-60">
                  {" "}
                  · {[o.org_type, o.city && o.state ? `${o.city}, ${o.state}` : null].filter(Boolean).join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Edit                                                              */
/* ---------------------------------------------------------------- */

const FIELD_LABELS: Record<EditableField, string> = {
  first_name: "First name (shown to others)",
  legal_first_name: "Legal first name",
  legal_last_name: "Legal last name",
  date_of_birth: "Date of birth",
  phone: "Phone",
  city: "City",
  state: "State",
  home_zip: "Home ZIP",
  org_name: "Organization name",
};

function EditForm({ account, onSaved }: { account: AccountDetail; onSaved: () => void }) {
  const [form, setForm] = useState(() => profileFormFrom(account));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; tone: "neutral" | "error" } | null>(null);

  useEffect(() => setForm(profileFormFrom(account)), [account]);

  const changes = profileChanges(account, form);
  const changedCount = Object.keys(changes).length;
  const fields: EditableField[] = [
    "first_name",
    "legal_first_name",
    "legal_last_name",
    "date_of_birth",
    "phone",
    "city",
    "state",
    "home_zip",
    ...(account.organizations.length > 0 ? (["org_name"] as const) : []),
  ];

  const save = async () => {
    setBusy(true);
    setNote(null);
    const { changed, error } = await updateProfile(account.user_id, changes, reason.trim() || null);
    setBusy(false);
    if (error) {
      setNote({ text: error.message, tone: "error" });
      return;
    }
    const n = Object.keys(changed).length;
    setNote({ text: n ? `Saved ${n} change${n === 1 ? "" : "s"}.` : "Nothing changed.", tone: "neutral" });
    setReason("");
    onSaved();
  };

  return (
    <div className="max-w-3xl">
      <p className="mb-4 text-sm text-ink-60">
        Every change is recorded with what it replaced. Changing a legal name or date of birth doesn&apos;t re-run
        their ID check, so only fix what their ID actually says. Changing where they live clears their saved map
        point until they next save their profile.
      </p>
      {note && <Note text={note.text} tone={note.tone} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {fields.map((f) => (
          <label key={f} className="block">
            <Eyebrow>{FIELD_LABELS[f]}</Eyebrow>
            <input
              type={f === "date_of_birth" ? "date" : "text"}
              value={form[f]}
              maxLength={f === "state" ? 2 : f === "home_zip" ? 5 : undefined}
              inputMode={f === "home_zip" ? "numeric" : undefined}
              onChange={(e) => setForm((prev) => ({ ...prev, [f]: e.target.value }))}
              className={`mt-1.5 w-full border bg-chalk px-3 py-2.5 text-sm text-ink outline-none focus:border-signal ${
                f in changes ? "border-signal" : "border-ink-20"
              }`}
            />
          </label>
        ))}
      </div>

      <div className="mt-5">
        <ReasonField id="edit-reason" label="Why (optional) — recorded with the change" value={reason} onChange={setReason} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <AppButton
          label={busy ? "Saving…" : changedCount ? `Save ${changedCount} change${changedCount === 1 ? "" : "s"}` : "No changes"}
          disabled={busy || changedCount === 0}
          onClick={() => void save()}
        />
        <AppButton
          label="Reset"
          variant="secondary"
          disabled={busy || changedCount === 0}
          onClick={() => setForm(profileFormFrom(account))}
        />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Finances                                                          */
/* ---------------------------------------------------------------- */

const PAYOUT_TONE: Record<string, string> = {
  paid: TONE.approved,
  failed: TONE.declined,
  processing: TONE.in_review,
  pending: TONE.neutral,
};

function Finances({ userId }: { userId: string }) {
  const [f, setF] = useState<AccountFinances | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    withDeadline(fetchUserFinances(userId))
      .then(({ finances, error: e }) => {
        if (e) setError(e.message);
        else setF(finances);
      })
      .catch((e) => setError(friendlyLoadError(e)))
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(load, [load]);

  if (loading) return <PanelSpinner />;
  if (error) return <LoadError message={error} onRetry={load} />;
  if (!f) return <Empty text="No money records." />;

  const ref = f.referee;
  const dir = f.director;
  const hasRef = Boolean(ref && ref.lines.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <Card title="Payout account">
        <Facts
          rows={[
            { label: "Status", value: f.payout_account?.connected ? f.payout_account.status : "Not connected" },
            {
              label: "Stripe account",
              value: f.payout_account?.stripe_account_id ? (
                <span className="font-mono text-xs">{f.payout_account.stripe_account_id}</span>
              ) : null,
            },
          ]}
        />
      </Card>

      <section>
        <h3 className="mb-3 font-mono-bold text-[10px] uppercase text-ink" style={{ letterSpacing: 1.8 }}>
          As a referee
        </h3>
        {!hasRef || !ref ? (
          <Empty text="No paid work yet." />
        ) : (
          <>
            <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="Paid out" value={money(ref.paid_total)} />
              <Stat label="Owed" value={money(ref.pending_total)} />
              <Stat label="On the way" value={money(ref.processing_total)} />
              <Stat label="Failed" value={money(ref.failed_total)} warn={Number(ref.failed_total) > 0} />
            </div>
            <Table
              head={["Game", "Date", "Amount", "Payout", "Paid", "Stripe transfer"]}
              rows={ref.lines.map((l) => [
                <span key="g" className="block min-w-0">
                  <span className="block truncate font-semibold text-ink">{l.title ?? "Untitled game"}</span>
                  <span className="block truncate text-xs text-ink-60">
                    {[l.org_name, l.role, l.status].filter(Boolean).join(" · ")}
                  </span>
                </span>,
                shortDate(l.starts_at),
                money(l.amount_due),
                <Pill key="p" label={l.payout_status ?? "—"} tone={PAYOUT_TONE[l.payout_status ?? ""] ?? TONE.neutral} />,
                shortDate(l.paid_at) ?? "—",
                l.stripe_transfer_id ? <span key="t" className="font-mono text-[11px]">{l.stripe_transfer_id}</span> : "—",
              ])}
            />
          </>
        )}
      </section>

      {dir && (
        <section>
          <h3 className="mb-3 font-mono-bold text-[10px] uppercase text-ink" style={{ letterSpacing: 1.8 }}>
            As a director{dir.org_names?.length ? ` · ${dir.org_names.join(", ")}` : ""}
          </h3>
          <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-5">
            <Stat label="Charged" value={moneyCents(dir.charged_cents)} />
            <Stat label="Refee fees" value={moneyCents(dir.fees_cents)} />
            <Stat label="Refunded" value={moneyCents(dir.refunded_cents)} />
            <Stat label="Crew owed" value={money(dir.crew_owed)} warn={Number(dir.crew_owed) > 0} />
            <Stat label="Disputes" value={dir.disputes} warn={dir.disputes > 0} />
          </div>
          {dir.jobs.length === 0 ? (
            <Empty text="No games posted." />
          ) : (
            <Table
              head={["Game", "Date", "Charged", "Refunded", "Payment", "Crew owed", "Stripe payment"]}
              rows={dir.jobs.map((j) => [
                <span key="g" className="block min-w-0">
                  <span className="block truncate font-semibold text-ink">{j.title ?? "Untitled game"}</span>
                  <span className="block truncate text-xs text-ink-60">
                    {j.status}
                    {j.review_reason ? ` · ${j.review_reason}` : ""}
                  </span>
                </span>,
                shortDate(j.starts_at),
                j.prepaid_at ? moneyCents(Number(j.prepaid_crew_cents ?? 0) + Number(j.prepaid_fee_cents ?? 0)) : "—",
                Number(j.refunded_amount_cents ?? 0) > 0 ? moneyCents(j.refunded_amount_cents) : "—",
                <span key="s" className="flex flex-wrap gap-1">
                  <Pill label={j.payment_status ?? "—"} tone={TONE.neutral} />
                  {j.dispute_status && <Pill label={`Dispute ${j.dispute_status}`} tone={TONE.declined} />}
                  {j.requires_review && <Pill label="Review" tone={TONE.in_review} />}
                </span>,
                Number(j.crew_owed) > 0 ? money(j.crew_owed) : "—",
                j.payment_intent_id ? <span key="pi" className="font-mono text-[11px]">{j.payment_intent_id}</span> : "—",
              ])}
            />
          )}
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: number | string; warn?: boolean }) {
  return (
    <div className={`border bg-chalk p-3 ${warn ? "border-whistle-ink" : "border-ink-20"}`}>
      <Eyebrow>{label}</Eyebrow>
      <p
        className={`mt-1 font-display text-2xl font-black tracking-tight ${warn ? "text-whistle-ink" : "text-ink"}`}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </p>
    </div>
  );
}

/** A plain table that scrolls sideways on a phone rather than squashing. */
function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto border border-ink-20 bg-chalk">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-ink-20">
            {head.map((h) => (
              <th
                key={h}
                className="px-3 py-2 font-mono-bold text-[9px] font-normal uppercase text-ink-60"
                style={{ letterSpacing: 1.5 }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-ink-10 last:border-b-0 align-top">
              {r.map((c, j) => (
                <td key={j} className={`px-3 py-2.5 text-ink-80 ${j === 0 ? "max-w-[260px]" : "whitespace-nowrap"}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* History                                                           */
/* ---------------------------------------------------------------- */

const ACTION_LABELS: Record<string, string> = {
  "account.edit": "Edited details",
  "account.suspend": "Suspended",
  "account.reinstate": "Reinstated",
  "account.view_as": "Signed in as them",
  "account.deactivate": "Deactivated",
  "account.reactivate": "Reactivated",
};

function actionLabel(action: string): string {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  if (action.startsWith("identity.")) return `ID marked ${statusLabel(action.slice("identity.".length)).toLowerCase()}`;
  return action;
}

function History({ account }: { account: AccountDetail }) {
  if (account.recent_staff_actions.length === 0) return <Empty text="No staff have acted on this account." />;
  return (
    <ol className="border border-ink-20 bg-chalk">
      {account.recent_staff_actions.map((a, i) => {
        const changes = (a.detail?.changes ?? null) as Record<string, { from: unknown; to: unknown }> | null;
        const why = (a.detail?.reason ?? a.detail?.note ?? null) as string | null;
        return (
          <li key={i} className="border-b border-ink-10 px-4 py-3 last:border-b-0">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-semibold text-ink">{actionLabel(a.action)}</p>
              <p className="text-xs text-ink-60">
                {dateTime(a.at)}
                {a.by ? ` · ${a.by}` : ""}
              </p>
            </div>
            {why && <p className="mt-1 text-sm text-ink-80">{why}</p>}
            {changes && (
              <ul className="mt-1 text-xs text-ink-60">
                {Object.entries(changes).map(([k, v]) => (
                  <li key={k}>
                    {FIELD_LABELS[k as EditableField] ?? k}: {String(v.from ?? "—")} → {String(v.to ?? "—")}
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}
