"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "@/components/Wordmark";
import { Icon } from "@/components/ui/Icon";
import { NAV_ITEMS, type NavRole } from "@/components/layout/nav-items";

const ROLE_LABELS: Record<NavRole, string> = {
  referee: "Referee",
  director: "Director",
  assignor: "Assignor",
};

/**
 * Desktop side nav — the same destinations as the bottom TabBar, laid out for
 * a pointer and a wide viewport. Hidden below `lg`, where TabBar takes over.
 */
export function SideNav({ role }: { role: NavRole }) {
  const pathname = usePathname();
  const items = NAV_ITEMS[role];

  return (
    <aside className="sticky top-0 hidden h-screen flex-col border-r border-ink bg-paper lg:flex">
      <div className="border-b border-ink px-6 py-5">
        <Link href={items[0].href} className="inline-block">
          <Wordmark className="text-2xl" />
        </Link>
        <p
          className="mt-1.5 font-mono-bold text-[9px] uppercase text-ink-40"
          style={{ letterSpacing: 2 }}
        >
          {ROLE_LABELS[role]}
        </p>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 border px-3 py-2.5 transition-colors ${
                active
                  ? "border-ink bg-ink text-paper"
                  : "border-transparent text-ink-60 hover:border-ink-20 hover:bg-chalk hover:text-ink"
              }`}
            >
              <Icon name={item.icon} size={18} />
              <span
                className="font-mono-bold text-[10px] uppercase"
                style={{ letterSpacing: 1.4 }}
              >
                {item.label}
              </span>
              {active ? <span className="ml-auto h-1.5 w-1.5 bg-hi-vis" /> : null}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-ink-20 px-6 py-4">
        <p
          className="font-mono text-[9px] uppercase text-ink-40"
          style={{ letterSpacing: 1.6 }}
        >
          Refee · Basketball
        </p>
      </div>
    </aside>
  );
}
