"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { NAV_ITEMS, type NavRole } from "@/components/layout/nav-items";

/**
 * Bottom tab bar — same items, icons, and colours as the app's tab navigators
 * (refee-mobile/refee/app/(app)/(tabs)/_layout.tsx and the director one).
 * Sticks to the bottom of the phone-width column; from `lg` up the desktop
 * SideNav takes over and this is hidden.
 */
export function TabBar({ role }: { role: NavRole }) {
  const pathname = usePathname();
  const items = NAV_ITEMS[role];

  return (
    <nav
      className="sticky bottom-0 z-20 flex border-t border-ink bg-paper pt-2 lg:hidden"
      style={{ paddingBottom: "calc(8px + env(safe-area-inset-bottom))" }}
    >
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-1 flex-col items-center gap-[3px] py-1 ${
              active ? "text-signal" : "text-ink-40 hover:text-ink-60"
            }`}
          >
            <Icon name={item.icon} size={20} />
            <span
              className="font-mono-bold text-[8px] uppercase"
              style={{ letterSpacing: 0.5 }}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
