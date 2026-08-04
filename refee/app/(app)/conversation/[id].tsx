import { useLocalSearchParams } from "expo-router";
import { ChatThread } from "@/components/messages/ChatThread";

export default function RefereeConversation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!id) return null;
  return <ChatThread conversationId={id} />;
}
