"use client";

import { TabBar } from "@/components/layout/TabBar";
import { SideNav } from "@/components/layout/SideNav";
import { SetupNotice } from "@/components/layout/SetupNotice";
import { isSupabaseConfigured } from "@/lib/supabase";

/**
 * Referee app shell — the web equivalent of the app's (app)/(tabs) navigator.
 * Phone-width column with a bottom tab bar on small screens; from `lg` up the
 * same screens spread across the full viewport beside a persistent side nav.
 */
export default function RefereeAppLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured) {
    return (
      <div className="app-shell flex flex-col">
        <SetupNotice />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <SideNav role="referee" />
      <div className="app-main">
        <div className="flex flex-1 flex-col">{children}</div>
        <TabBar role="referee" />
      </div>
    </div>
  );
}
