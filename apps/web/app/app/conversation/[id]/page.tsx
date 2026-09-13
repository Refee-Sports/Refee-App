"use client";

import { use } from "react";
import { ChatThread } from "@/components/messages/ChatThread";

export default function RefereeConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <ChatThread conversationId={id} />;
}
