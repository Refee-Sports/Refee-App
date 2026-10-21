"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";

// Remembered per tab (sessionStorage), so the banner follows staff around the
// window they opened the link in and disappears when it closes.
const KEY = "refee.viewingAs";
const EVENT = "refee:viewing-as";

export function markViewingAs(who: string) {
  try {
    sessionStorage.setItem(KEY, who);
  } catch {
    /* storage blocked: no banner, nothing else breaks */
  }
  window.dispatchEvent(new Event(EVENT));
}

function readViewingAs(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function clearViewingAs() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
  window.dispatchEvent(new Event(EVENT));
}

/** A strip across the top while staff are signed in as someone else. */
export function ViewingAsBanner() {
  const { session, ready, signOut } = useAuth();
  const [who, setWho] = useState<string | null>(null);

  // The sign-in and the note saying who it's for land in either order.
  useEffect(() => {
    const sync = () => setWho(session ? readViewingAs() : null);
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, [session]);

  useEffect(() => {
    // Before the saved session has loaded there's no telling; after, no
    // session means they signed out and the view-as session is over.
    if (!session) {
      if (ready) clearViewingAs();
      setWho(null);
      return;
    }
    setWho(readViewingAs());
  }, [session, ready]);

  if (!who) return null;

  return (
    <div
      role="status"
      className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-3 bg-whistle px-4 py-2 text-center text-ink"
    >
      <span className="font-mono-bold text-[10px] uppercase" style={{ letterSpacing: 1.5 }}>
        Staff view · signed in as {who} · anything you do is done as them
      </span>
      <button
        type="button"
        onClick={() => {
          clearViewingAs();
          void signOut();
        }}
        className="border border-ink px-2 py-1 font-mono-bold text-[10px] uppercase hover:bg-ink hover:text-whistle"
        style={{ letterSpacing: 1.5 }}
      >
        Sign out
      </button>
    </div>
  );
}
