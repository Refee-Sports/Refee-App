import Link from "next/link";
import { SiteNav } from "@/components/SiteNav";
import { Footer } from "@/components/Footer";

/**
 * Shared frame for the legal pages.
 *
 * These are drafts. They describe what Refee actually does with data — which
 * is knowable from the code — so that counsel writes the binding language
 * instead of starting from a blank page. The banner says so plainly, because
 * a page that looks like a reviewed policy and isn't one is worse than no
 * page at all.
 */
export function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-3xl px-6 py-12 md:px-8">
        <div
          role="note"
          className="mb-8 border-l-4 border-foul bg-foul/5 px-5 py-4"
        >
          <p
            className="font-mono-bold text-[10px] uppercase text-foul"
            style={{ letterSpacing: 1.5 }}
          >
            Draft — not legal advice, not yet reviewed
          </p>
          <p className="mt-2 text-[13px] leading-5 text-ink-80">
            This page records how Refee handles data today so a lawyer can turn
            it into binding terms. It has not been reviewed by counsel and is
            not in force. Do not rely on it.
          </p>
        </div>

        <h1 className="font-display text-4xl font-black leading-[1.05] tracking-tighter text-ink sm:text-5xl">
          {title}
        </h1>
        <p
          className="mt-3 font-mono text-[10px] uppercase text-ink-60"
          style={{ letterSpacing: 1.5 }}
        >
          Last updated {updated}
        </p>

        <div className="mt-10 flex flex-col gap-8">{children}</div>

        <p className="mt-12 border-t border-ink-20 pt-6 text-[13px] text-ink-60">
          Questions about this page:{" "}
          <Link href="/" className="text-signal underline">
            contact Refee
          </Link>
          .
        </p>
      </main>
      <Footer />
    </>
  );
}

export function Section({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="font-display text-xl font-black tracking-tight text-ink">
        {heading}
      </h2>
      <div className="mt-3 flex flex-col gap-3 text-[15px] leading-relaxed text-ink-80">
        {children}
      </div>
    </section>
  );
}

/** Marks language that a lawyer still has to supply. */
export function NeedsCounsel({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-l-2 border-whistle-ink bg-whistle/5 py-2 pl-3 text-[13px] leading-5 text-ink">
      <span
        className="font-mono-bold text-[9px] uppercase text-whistle-ink"
        style={{ letterSpacing: 1.2 }}
      >
        Needs counsel ·{" "}
      </span>
      {children}
    </p>
  );
}
