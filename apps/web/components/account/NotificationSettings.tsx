"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fetchMyRoles } from "@/lib/assignor/queries";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  NOTIFICATION_SWITCHES,
  fetchNotificationPreferences,
  saveNotificationPreference,
  type NotificationKind,
  type NotificationPreferences,
} from "@/lib/push/preferences";

/**
 * The same three switches as the phone app. Each saves as soon as it's flipped;
 * new-game alerts only matter to referees, so others don't see that one.
 */
export function NotificationSettings() {
  const [userId, setUserId] = useState<string | null>(null);
  const [isReferee, setIsReferee] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPreferences>({ ...DEFAULT_NOTIFICATION_PREFERENCES });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setUserId(session.user.id);
      const [prefResult, roleResult] = await Promise.all([
        fetchNotificationPreferences(session.user.id),
        fetchMyRoles(session.user.id),
      ]);
      setPrefs(prefResult.prefs);
      setError(prefResult.error);
      setIsReferee(roleResult.roles.includes("referee"));
      setLoading(false);
    })();
  }, []);

  const flip = async (kind: NotificationKind, value: boolean) => {
    if (!userId) return;
    const before = prefs[kind];
    setPrefs((p) => ({ ...p, [kind]: value }));
    const { error: saveError } = await saveNotificationPreference(userId, kind, value);
    if (saveError) {
      setPrefs((p) => ({ ...p, [kind]: before }));
      setError(saveError);
    } else {
      setError(null);
    }
  };

  const switches = NOTIFICATION_SWITCHES.filter((s) => s.kind !== "new_games" || isReferee);

  return (
    <section className="mt-8 border border-ink bg-chalk p-5">
      <h2 className="font-mono-bold text-xs uppercase">Notifications</h2>
      <p className="mt-2 text-xs leading-5 text-ink-60">
        What we send to your phone. You&apos;ll still see everything in the app.
      </p>
      {loading ? <p className="mt-4 text-sm text-ink-60">Loading…</p> : null}
      <div className="mt-2">
        {!loading &&
          switches.map((s) => (
            <label
              key={s.kind}
              className="flex cursor-pointer items-center justify-between gap-4 border-b border-ink-20 py-3 last:border-0"
            >
              <span>
                <span className="block text-sm font-semibold text-ink">{s.label}</span>
                <span className="mt-0.5 block text-xs text-ink-60">{s.description}</span>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={prefs[s.kind]}
                onChange={(e) => void flip(s.kind, e.target.checked)}
                className="h-5 w-5 accent-signal"
              />
            </label>
          ))}
      </div>
      {error ? <p className="mt-3 text-sm text-foul">{error}</p> : null}
    </section>
  );
}
