"use client";

import { ConversationList } from "@/components/messages/ConversationList";

/** Port of refee-mobile/refee/app/(app)/(tabs)/inbox.tsx. */
export default function InboxPage() {
  return (
    <div className="app-canvas app-canvas--form bg-paper">
      <div className="px-5 pb-3 pt-4 sm:px-0 lg:pt-6">
        <h1
          className="font-display text-[26px] leading-none text-ink lg:text-[34px]"
          style={{ letterSpacing: -1 }}
        >
          INBOX
        </h1>
      </div>
      <ConversationList basePath="/app" />
    </div>
  );
}
