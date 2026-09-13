"use client";

import { usePathname } from "next/navigation";
import { AuthSplit } from "@/components/auth/AuthSplit";

/**
 * Auth shell.
 *
 * Welcome is the front door and carries its own full-bleed hero, so it opts
 * out. Everything else — sign-in, verify, callback — goes through AuthSplit:
 * the phone layout below `lg`, brand panel alongside the form above it.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname?.startsWith("/auth/welcome")) return <>{children}</>;

  return <AuthSplit>{children}</AuthSplit>;
}
