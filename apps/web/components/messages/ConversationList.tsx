"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/AppButton";
import { useFocusEffect } from "@/hooks/useFocusEffect";
import { supabase } from "@/lib/supabase";
import { fetchConversations, type ConversationRow } from "@/lib/messages/queries";

const TZ = "America/Chicago";

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: TZ,
    });
  }
  return d
    .toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: TZ })
    .toUpperCase();
}

/**
 * Port of the app's components/messages/ConversationList.
 * `basePath` is the route group the thread lives under — /app for referees,
 * /director for directors — mirroring the app's two conversation routes.
 */
export function ConversationList({ basePath }: { basePath: "/app" | "/director" | "/assignor" }) {
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session || cancelled) return;
      const { conversations: convos } = await fetchConversations(session.user.id);
      if (cancelled) return;
      setConversations(convos);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(load);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-10 text-signal">
        <Spinner />
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-8 py-16">
        <p
          className="whitespace-pre-line text-center font-mono text-[11px] uppercase text-ink-40"
          style={{ letterSpacing: 1 }}
        >
          {"No messages yet.\nThreads appear here once you're on a crew or a director messages you."}
        </p>
      </div>
    );
  }

  return (
    <div className="pb-10">
      {conversations.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => router.push(`${basePath}/conversation/${item.id}`)}
          className="mx-5 mb-2 block w-[calc(100%-40px)] border border-ink bg-chalk px-4 py-3.5 text-left hover:opacity-75"
        >
          <div className="mb-1 flex items-center justify-between">
            <span className="flex min-w-0 flex-1 items-center gap-2 pr-2">
              {item.unread && <span className="h-2 w-2 shrink-0 bg-signal" />}
              <span
                className={`truncate text-[12px] uppercase text-ink ${
                  item.unread ? "font-mono-bold" : "font-mono"
                }`}
                style={{ letterSpacing: 0.5 }}
              >
                {item.title}
              </span>
            </span>
            <span
              className="shrink-0 font-mono text-[9px] uppercase text-ink-40"
              style={{ letterSpacing: 1 }}
            >
              {fmtWhen(item.lastMessageAt)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="min-w-0 flex-1 truncate pr-2 font-mono text-[10px] text-ink-60">
              {item.lastMessageBody ?? "No messages yet"}
            </span>
            {item.kind === "game_crew" && (
              <span
                className="shrink-0 font-mono-bold text-[8px] uppercase text-signal"
                style={{ letterSpacing: 1 }}
              >
                CREW · {item.participantCount}
              </span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
