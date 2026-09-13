"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Wordmark } from "@/components/Wordmark";
import { Icon } from "@/components/ui/Icon";
import { supabase } from "@/lib/supabase";

type Role = "referee" | "director" | "assignor";

const ROLES: { id: Role; title: string; subtitle: string; description: string }[] = [
  {
    id: "referee",
    title: "REFEREE",
    subtitle: "Official",
    description:
      "Find games to work in your area. Set your rate, accept assignments, and get paid.",
  },
  {
    id: "director",
    title: "TOURNAMENT\nDIRECTOR",
    subtitle: "Organizer",
    description:
      "Create tournaments and post game assignments. Hire referees directly or through an assignor.",
  },
  {
    id: "assignor",
    title: "ASSIGNOR",
    subtitle: "Staffing",
    description:
      "Staff tournaments for directors. Build a roster of referees and assign them to games.",
  },
];

/** Port of refee-mobile/refee/app/(onboarding)/role-select.tsx. */
export default function RoleSelectPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<Role | null>(null);

  const leaveSetup = async () => {
    if (
      !window.confirm(
        "Leave setup? You can finish your profile next time you sign in."
      )
    ) {
      return;
    }
    await supabase.auth.signOut();
  };

  const handleContinue = () => {
    if (!selected) return;
    router.push(`/onboarding/${selected}`);
  };

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <div className="flex items-center justify-between px-5 py-3">
        <button
          type="button"
          onClick={leaveSetup}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center border border-ink bg-chalk text-ink hover:bg-ink hover:text-paper"
        >
          <Icon name="chevron-left" size={18} />
        </button>
        <span
          className="font-mono-bold text-[9px] uppercase text-ink-60"
          style={{ letterSpacing: 2 }}
        >
          <span className="text-signal">01</span> / 02 · Choose your role
        </span>
        <button
          type="button"
          onClick={leaveSetup}
          aria-label="Leave setup"
          className="flex h-9 w-9 items-center justify-center border border-ink bg-chalk text-ink hover:bg-ink hover:text-paper"
        >
          <Icon name="x" size={16} />
        </button>
      </div>

      <div className="mx-5 mb-5 h-0.5 bg-ink-20">
        <div className="h-full bg-signal" style={{ width: "50%" }} />
      </div>

      <div className="px-5 pb-5">
        <Wordmark className="text-[28px]" />
      </div>

      <div className="mb-8 px-5">
        <h1
          className="font-display text-ink"
          style={{ fontSize: 42, lineHeight: "40px", letterSpacing: -2 }}
        >
          I AM A...
        </h1>
      </div>

      <div className="flex flex-1 flex-col gap-3 px-5">
        {ROLES.map((role) => {
          const isSelected = selected === role.id;
          return (
            <button
              key={role.id}
              type="button"
              onClick={() => setSelected(role.id)}
              aria-pressed={isSelected}
              className={`border-2 px-5 py-5 text-left hover:opacity-90 ${
                isSelected ? "border-signal bg-signal/10" : "border-ink bg-chalk"
              }`}
            >
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <span
                    className={`block whitespace-pre-line font-display ${
                      isSelected ? "text-signal" : "text-ink"
                    }`}
                    style={{
                      fontSize: 28,
                      lineHeight: "34px",
                      letterSpacing: -1,
                      paddingTop: 2,
                    }}
                  >
                    {role.title}
                  </span>
                  <span
                    className={`mt-1 block font-mono-bold text-[9px] uppercase ${
                      isSelected ? "text-signal/70" : "text-ink-40"
                    }`}
                    style={{ letterSpacing: 2.5 }}
                  >
                    {role.subtitle}
                  </span>
                </div>
                <span
                  className={`flex h-6 w-6 items-center justify-center border-2 ${
                    isSelected ? "border-signal bg-signal" : "border-ink-40 bg-paper"
                  }`}
                >
                  {isSelected && (
                    <span className="font-mono-bold text-xs text-paper">✓</span>
                  )}
                </span>
              </div>
              <p
                className={`font-mono text-[11px] leading-4 ${
                  isSelected ? "text-signal/80" : "text-ink-60"
                }`}
              >
                {role.description}
              </p>
            </button>
          );
        })}
      </div>

      <div className="action-bar sticky bottom-0 mt-6 border-t border-ink px-5">
        <button
          type="button"
          onClick={handleContinue}
          disabled={!selected}
          className={`flex w-full items-center justify-center gap-2 py-4 ${
            selected ? "bg-ink text-paper hover:opacity-80" : "cursor-not-allowed bg-ink-20 text-ink-40"
          }`}
        >
          <span className="font-mono-bold" style={{ fontSize: 12, letterSpacing: 2.5 }}>
            CONTINUE
          </span>
          <span className="font-mono-bold text-base">→</span>
        </button>
      </div>
    </div>
  );
}
