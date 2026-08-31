import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { sendPush } from "@/lib/push/notifications";

// ── Types ────────────────────────────────────────────────────────────────────

export type ConversationKind = "dm" | "game_crew";

export type ConversationRow = {
  id: string;
  kind: ConversationKind;
  jobId: string | null;
  jobTitle: string | null;
  lastMessageAt: string;
  lastMessageBody: string | null;
  lastMessageSenderId: string | null;
  unread: boolean;
  // for DMs: the other person; for crews: participant display names
  title: string;
  participantCount: number;
};

export type MessageRow = {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  body: string;
  createdAt: string;
};

// ── Conversation list ────────────────────────────────────────────────────────

export async function fetchConversations(
  userId: string
): Promise<{ conversations: ConversationRow[]; error: Error | null }> {
  // read state for unread dots
  const { data: myRows, error: myErr } = await supabase
    .from("conversation_participants")
    .select("conversation_id, last_read_at")
    .eq("user_id", userId);
  if (myErr) return { conversations: [], error: new Error(myErr.message) };

  const readMap = new Map((myRows ?? []).map((r) => [r.conversation_id, r.last_read_at]));
  const ids = [...readMap.keys()];
  if (ids.length === 0) return { conversations: [], error: null };

  const { data, error } = await supabase
    .from("conversations")
    .select(
      `id, kind, job_id, last_message_at,
       jobs(title),
       conversation_participants(user_id, public_profiles(display_name)),
       messages(body, sender_id, created_at)`
    )
    .in("id", ids)
    .order("created_at", { referencedTable: "messages", ascending: false })
    .limit(1, { referencedTable: "messages" });

  if (error) return { conversations: [], error: new Error(error.message) };

  const conversations: ConversationRow[] = (data ?? [])
    .map((c: any) => {
      const job = Array.isArray(c.jobs) ? c.jobs[0] : c.jobs;
      const lastMsg = (c.messages ?? [])[0] ?? null;
      const lastReadAt = readMap.get(c.id) ?? new Date(0).toISOString();
      const others = (c.conversation_participants ?? []).filter(
        (p: any) => p.user_id !== userId
      );
      const otherNames = others
        .map((p: any) => {
          const prof = Array.isArray(p.public_profiles) ? p.public_profiles[0] : p.public_profiles;
          return prof?.display_name ?? "Unknown";
        })
        .filter(Boolean);

      const title =
        c.kind === "game_crew"
          ? `${job?.title ?? "Game"} — Crew`
          : otherNames[0] ?? "Conversation";

      return {
        id: c.id,
        kind: c.kind as ConversationKind,
        jobId: c.job_id,
        jobTitle: job?.title ?? null,
        lastMessageAt: c.last_message_at,
        lastMessageBody: lastMsg?.body ?? null,
        lastMessageSenderId: lastMsg?.sender_id ?? null,
        unread: lastMsg ? lastMsg.created_at > lastReadAt : false,
        title,
        participantCount: (c.conversation_participants ?? []).length,
      };
    })
    .filter((c): c is ConversationRow => c !== null)
    .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));

  return { conversations, error: null };
}

// ── Messages in a thread ─────────────────────────────────────────────────────

export async function fetchMessages(
  conversationId: string
): Promise<{ messages: MessageRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_id, body, created_at, public_profiles(display_name)")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) return { messages: [], error: new Error(error.message) };

  const messages: MessageRow[] = (data ?? []).map((m: any) => {
    const prof = Array.isArray(m.public_profiles) ? m.public_profiles[0] : m.public_profiles;
    return {
      id: m.id,
      conversationId: m.conversation_id,
      senderId: m.sender_id,
      senderName: prof?.display_name ?? "Unknown",
      body: m.body,
      createdAt: m.created_at,
    };
  });

  return { messages, error: null };
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  body: string
): Promise<{ error: Error | null }> {
  const trimmed = body.trim();
  const { error } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: senderId, body: trimmed });
  if (error) return { error: new Error(error.message) };

  // Notify the other participants (best-effort)
  const [{ data: participants }, { data: sender }] = await Promise.all([
    supabase
      .from("conversation_participants")
      .select("user_id")
      .eq("conversation_id", conversationId),
    supabase.from("public_profiles").select("display_name").eq("id", senderId).maybeSingle(),
  ]);
  const others = (participants ?? [])
    .map((p) => p.user_id)
    .filter((uid) => uid !== senderId);
  void sendPush(
    others,
    sender?.display_name ?? "New message",
    trimmed.length > 80 ? `${trimmed.slice(0, 77)}...` : trimmed,
    { type: "message", conversationId }
  );
  return { error: null };
}

export async function markRead(conversationId: string, userId: string): Promise<void> {
  await supabase
    .from("conversation_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);
}

// ── Creating conversations ───────────────────────────────────────────────────

/** 1:1 DM. Reuses an existing DM between the two users if one exists. */
export async function getOrCreateDM(
  myId: string,
  otherId: string
): Promise<{ conversationId: string | null; error: Error | null }> {
  // find an existing dm both users belong to
  const { data: mine } = await supabase
    .from("conversation_participants")
    .select("conversation_id, conversations(kind)")
    .eq("user_id", myId);

  const myDmIds = (mine ?? [])
    .filter((r: any) => {
      const c = Array.isArray(r.conversations) ? r.conversations[0] : r.conversations;
      return c?.kind === "dm";
    })
    .map((r: any) => r.conversation_id);

  if (myDmIds.length > 0) {
    const { data: shared } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", otherId)
      .in("conversation_id", myDmIds)
      .limit(1);
    if (shared && shared.length > 0) {
      return { conversationId: shared[0].conversation_id, error: null };
    }
  }

  const { data: convo, error: cErr } = await supabase
    .from("conversations")
    .insert({ kind: "dm", created_by: myId })
    .select("id")
    .single();
  if (cErr || !convo) return { conversationId: null, error: new Error(cErr?.message ?? "create failed") };

  const { error: pErr } = await supabase.from("conversation_participants").insert([
    { conversation_id: convo.id, user_id: myId },
    { conversation_id: convo.id, user_id: otherId },
  ]);
  if (pErr) return { conversationId: null, error: new Error(pErr.message) };

  return { conversationId: convo.id, error: null };
}

/**
 * Director posts a ONE-WAY note to a game's crew. Goes through a security-definer
 * RPC (migration 0021) so the director can post without joining the thread —
 * referees see the note but can't message the director back. Returns the crew
 * conversation id.
 */
export async function postCrewNote(
  jobId: string,
  body: string
): Promise<{ conversationId: string | null; error: Error | null }> {
  const trimmed = body.trim();
  if (!trimmed) return { conversationId: null, error: new Error("Note is empty") };
  const { data, error } = await supabase.rpc("post_crew_note", {
    p_job_id: jobId,
    p_body: trimmed,
  });
  if (error) return { conversationId: null, error: new Error(error.message) };
  return { conversationId: (data as string) ?? null, error: null };
}

export type CrewMessage = { id: string; senderId: string; body: string; createdAt: string };
export type CrewThread = {
  conversationId: string | null;
  lastMessageAt: string | null;
  messages: CrewMessage[];
  receipts: import("./receipts").CrewReceipt[];
};

/**
 * Director view of a game's crew thread: the messages they've sent + per-ref
 * read receipts. Via a security-definer RPC because the director isn't a
 * participant (one-way), so they can't read the thread through normal RLS.
 */
export async function fetchCrewThread(
  jobId: string
): Promise<{ thread: CrewThread | null; error: Error | null }> {
  const { data, error } = await supabase.rpc("get_crew_thread", { p_job_id: jobId });
  if (error) return { thread: null, error: new Error(error.message) };
  const t = (data ?? {}) as any;
  return {
    thread: {
      conversationId: t.conversationId ?? null,
      lastMessageAt: t.lastMessageAt ?? null,
      messages: (t.messages ?? []) as CrewMessage[],
      receipts: (t.receipts ?? []) as import("./receipts").CrewReceipt[],
    },
    error: null,
  };
}

/**
 * Group thread for a game: creator + all accepted refs.
 * Reuses the existing crew thread for the job if one exists, and
 * syncs newly-accepted refs into it.
 */
export async function getOrCreateCrewConversation(
  myId: string,
  jobId: string
): Promise<{ conversationId: string | null; error: Error | null }> {
  // accepted refs on this game
  const { data: crew, error: crewErr } = await supabase
    .from("job_assignments")
    .select("ref_id")
    .eq("job_id", jobId)
    .eq("status", "accepted");
  if (crewErr) return { conversationId: null, error: new Error(crewErr.message) };

  const memberIds = Array.from(new Set([myId, ...(crew ?? []).map((c) => c.ref_id)]));

  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("job_id", jobId)
    .eq("kind", "game_crew")
    .maybeSingle();

  let conversationId = existing?.id ?? null;

  if (!conversationId) {
    const { data: convo, error: cErr } = await supabase
      .from("conversations")
      .insert({ kind: "game_crew", job_id: jobId, created_by: myId })
      .select("id")
      .single();
    if (cErr || !convo) return { conversationId: null, error: new Error(cErr?.message ?? "create failed") };
    conversationId = convo.id;
  }

  // upsert roster (newly accepted refs get added on next open)
  await supabase
    .from("conversation_participants")
    .upsert(
      memberIds.map((uid) => ({ conversation_id: conversationId!, user_id: uid })),
      { onConflict: "conversation_id,user_id", ignoreDuplicates: true }
    );

  return { conversationId, error: null };
}

// ── Realtime ─────────────────────────────────────────────────────────────────

export function subscribeToConversation(
  conversationId: string,
  onMessage: () => void
): RealtimeChannel {
  return supabase
    .channel(`messages:${conversationId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      onMessage
    )
    .subscribe();
}
