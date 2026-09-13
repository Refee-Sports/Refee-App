import Link from "next/link";
import { Wordmark } from "./Wordmark";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "#how", label: "How it works" },
      { href: "#officials", label: "For officials" },
      { href: "#leagues", label: "For leagues" },
      { href: "#download", label: "Download" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "#trust", label: "Trust & safety" },
      { href: "#", label: "About" },
      { href: "#", label: "Careers" },
      { href: "#", label: "Contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "#", label: "Privacy" },
      { href: "#", label: "Terms" },
      { href: "#", label: "Background check policy" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="relative z-10 border-t border-ink bg-ink text-paper">
      <div className="mx-auto grid max-w-wrap gap-10 px-6 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr] md:px-8">
        <div>
          <Wordmark className="text-3xl !text-paper [&_.text-signal]:!text-signal-dark" />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-paper/70">
            The on-demand marketplace for sports officials. Vetted,
            background-checked, and ready for game day.
          </p>
          <div className="mt-5 inline-flex items-center gap-2">
            <span className="dot dot-pulse bg-court-dark" />
            <span className="kicker !text-paper/60">
              Officials online now
            </span>
          </div>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h3 className="kicker !text-paper/50">{col.title}</h3>
            <ul className="mt-4 space-y-3">
              {col.links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-paper/80 transition-colors hover:text-hi-vis-dark"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-paper/15">
        <div className="mx-auto flex max-w-wrap flex-col items-start justify-between gap-3 px-6 py-6 text-xs text-paper/50 sm:flex-row sm:items-center md:px-8">
          <span className="font-mono uppercase tracking-widest">
            © {new Date().getFullYear()} Refee. All rights reserved.
          </span>
          <span className="font-mono uppercase tracking-widest">
            Made for game day.
          </span>
        </div>
      </div>
    </footer>
  );
}
