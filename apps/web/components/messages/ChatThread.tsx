"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Spinner } from "@/components/ui/AppButton";
import { supabase } from "@/lib/supabase";
import {
  fetchMessages,
  markRead,
  sendMessage,
  subscribeToConversation,
  type MessageRow,
} from "@/lib/messages/queries";

const TZ = "America/Chicago";

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: TZ,
  });
}

/**
 * Port of the app's components/messages/ChatThread — same realtime channel,
 * same optimistic send, same read-receipt write, so a thread stays in sync
 * whichever surface each participant is on.
 */
export function ChatThread({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const endRef = useRef<HTMLDivElement>(null);

  const [myId, setMyId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const { messages: msgs } = await fetchMessages(conversationId);
    setMessages(msgs);
    setLoading(false);
  }, [conversationId]);

  useEffect(() => {
    let uid: string | null = null;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      uid = session.user.id;
      setMyId(uid);
      await load();
      await markRead(conversationId, uid);
    })();

    const channel = subscribeToConversation(conversationId, () => {
      void load();
      if (uid) void markRead(conversationId, uid);
    });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId, load]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const handleSend = async () => {
    const body = draft.trim();
    if (!body || !myId || sending) return;
    setSending(true);
    setDraft("");
    // optimistic append
    setMessages((m) => [
      ...m,
      {
        id: `local-${Date.now()}`,
        conversationId,
        senderId: myId,
        senderName: "You",
        body,
        createdAt: new Date().toISOString(),
      },
    ]);
    const { error } = await sendMessage(conversationId, myId, body);
    if (error) await load(); // resync on failure
    setSending(false);
  };

  return (
    <div className="app-canvas app-canvas--form flex min-h-0 flex-1 flex-col bg-paper lg:pb-0">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-ink-20 px-5 py-3 sm:px-0 lg:pt-5">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center border border-ink bg-chalk text-ink hover:bg-ink hover:text-paper"
        >
          <Icon name="chevron-left" size={18} />
        </button>
        <span
          className="flex-1 font-mono-bold text-[10px] uppercase text-ink"
          style={{ letterSpacing: 2 }}
        >
          Messages
        </span>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center text-signal">
          <Spinner />
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-5 py-4">
          {messages.map((item) => {
            const mine = item.senderId === myId;
            return (
              <div key={item.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                <div
                  className={`max-w-[80%] border px-3.5 py-2.5 ${
                    mine ? "border-ink bg-ink" : "border-ink-20 bg-chalk"
                  }`}
                >
                  {!mine && (
                    <span
                      className="mb-1 block font-mono-bold text-[8px] uppercase text-signal"
                      style={{ letterSpacing: 1.5 }}
                    >
                      {item.senderName.toUpperCase()}
                    </span>
                  )}
                  <span
                    className={`block whitespace-pre-wrap break-words font-mono text-[13px] ${
                      mine ? "text-paper" : "text-ink"
                    }`}
                    style={{ lineHeight: "19px" }}
                  >
                    {item.body}
                  </span>
                </div>
                <span
                  className="mt-1 font-mono text-[8px] uppercase text-ink-40"
                  style={{ letterSpacing: 1 }}
                >
                  {fmtTime(item.createdAt)}
                </span>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>
      )}

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSend();
        }}
        className="flex items-end gap-3 border-t border-ink bg-chalk px-4 py-3"
        style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends; Shift+Enter makes a new line.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          placeholder="MESSAGE..."
          rows={1}
          aria-label="Message"
          className="min-h-[42px] flex-1 resize-none border border-ink bg-paper px-3 py-2.5 font-mono text-[13px] text-ink outline-none placeholder:text-ink-40"
          style={{ maxHeight: 100, letterSpacing: 0.5 }}
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending}
          aria-label="Send"
          className={`flex h-11 w-11 shrink-0 items-center justify-center border border-ink ${
            draft.trim() ? "bg-signal text-paper" : "bg-paper text-ink-40"
          } disabled:cursor-not-allowed`}
        >
          <Icon name="arrow-up" size={18} />
        </button>
      </form>
    </div>
  );
}
