import Link from "next/link";
import { Wordmark } from "./Wordmark";

const NAV_LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#officials", label: "For officials" },
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
          <Link
            href="/auth/welcome"
            className="kicker hidden transition-colors hover:text-ink sm:inline-flex"
          >
            Log in
          </Link>
          {/* Refee is mobile-first, but the full app runs on the web too */}
          <Link href="/auth/welcome" className="btn btn-hi">
            Open Refee
          </Link>
        </div>
      </nav>
    </header>
  );
}
