import Link from "next/link";
import { Wordmark } from "./Wordmark";

const NAV_LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#officials", label: "For officials" },
  { href: "#assignors", label: "For assignors" },
  { href: "#leagues", label: "For leagues" },
  { href: "#trust", label: "Trust & safety" },
];

export function SiteNav() {
  return (
    <header className="relative z-30 border-b border-dashed border-ink-20">
      <nav className="mx-auto flex max-w-wrap items-center justify-between gap-6 px-6 py-4 md:px-8">
        <Link href="/" className="flex items-center gap-3">
          <Wordmark className="text-2xl" />
          <span className="hidden items-center gap-1.5 text-court sm:inline-flex">
            <span className="dot dot-pulse bg-court" />
            <span className="kicker">Live</span>
          </span>
        </Link>

        <ul className="hidden items-center gap-7 lg:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="kicker transition-colors hover:text-ink"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-3">
          {/* One door. Signing in and signing up are the same phone-number
              step, so two buttons pointing at the same screen only asked
              people to choose before there was anything to choose. */}
          <Link href="/auth/welcome" className="btn btn-hi">
            Log in / Sign up
          </Link>
        </div>
      </nav>
    </header>
  );
}
