"use client";

import { TabBar } from "@/components/layout/TabBar";
import { SideNav } from "@/components/layout/SideNav";
import { SetupNotice } from "@/components/layout/SetupNotice";
import { isSupabaseConfigured } from "@/lib/supabase";

/** Assignor app shell — mirrors the app's (assignor)/(tabs) navigator. */
export default function AssignorAppLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured) {
    return (
      <div className="app-shell flex flex-col">
        <SetupNotice />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <SideNav role="assignor" />
      <div className="app-main">
        <div className="flex flex-1 flex-col">{children}</div>
        <TabBar role="assignor" />
      </div>
    </div>
  );
}
