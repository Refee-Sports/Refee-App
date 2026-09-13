import { SiteNav } from "@/components/SiteNav";
import { Footer } from "@/components/Footer";
import { PhoneMock } from "@/components/PhoneMock";
import { StoreButtons } from "@/components/StoreButtons";

export default function HomePage() {
  return (
    <>
      <SiteNav />
      <main className="relative z-10">
        <Hero />
        <StatsStrip />
        <HowItWorks />
        <OfficialsSection />
        <LeaguesSection />
        <TrustSection />
        <DownloadCTA />
      </main>
      <Footer />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* HERO — equal-split, two-sided                                       */
/* ------------------------------------------------------------------ */
function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid max-w-wrap items-center gap-12 px-6 py-16 md:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:py-24">
        <div>
          <span className="badge badge-signal">
            <span className="dot dot-pulse" />
            On-demand · Vetted · Background-checked
          </span>

          <h1 className="mt-6 font-display font-black leading-[0.95] tracking-tighter text-ink text-[clamp(1.75rem,8vw,3.25rem)] lg:text-[clamp(3rem,5vw,4rem)]">
            <span className="block whitespace-nowrap">Games don&apos;t count</span>
            <span className="block whitespace-nowrap">unless you make it</span>
            <span className="block whitespace-nowrap text-signal">official.</span>
          </h1>

          <p className="mt-6 max-w-md text-lg leading-relaxed text-ink-80">
            Refee is the on-demand marketplace for sports officials. Refs and
            umpires get booked and paid. Leagues staff every game. Pick your
            side to get started.
          </p>

          {/* Two-sided path cards */}
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <PathCard
              kicker="I'm an official"
              title="Get booked & paid"
              desc="Set your sports, rates, and availability. Accept jobs near you and cash out fast."
              cta="Ref with Refee"
              href="#officials"
              accent="hi"
            />
            <PathCard
              kicker="I run a league"
              title="Staff every game"
              desc="Post games and fill them with vetted, background-checked officials — in minutes."
              cta="Find officials"
              href="#leagues"
              accent="signal"
            />
          </div>

          <p className="mt-6 kicker">
            Free to download · iOS &amp; Android · No booking fees to start
          </p>
        </div>

        <div className="relative">
          {/* signal glow behind phone */}
          <div
            className="pointer-events-none absolute inset-0 -z-10 opacity-70"
            style={{
              background:
                "radial-gradient(circle at 60% 40%, rgba(31,79,204,0.14), transparent 60%)",
            }}
          />
          <PhoneMock />
        </div>
      </div>
      <div className="mx-auto max-w-wrap px-6 md:px-8">
        <div className="zebra-rule" />
      </div>
    </section>
  );
}

function PathCard({
  kicker,
  title,
  desc,
  cta,
  href,
  accent,
}: {
  kicker: string;
  title: string;
  desc: string;
  cta: string;
  href: string;
  accent: "hi" | "signal";
}) {
  return (
    <a
      href={href}
      className="group flex flex-col justify-between border border-ink bg-chalk p-5 transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--ink)]"
    >
      <div>
        <span
          className={`kicker ${accent === "hi" ? "!text-court" : "!text-signal"}`}
        >
          {kicker}
        </span>
        <h3 className="mt-2 font-display text-2xl font-black tracking-tight text-ink">
          {title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-ink-60">{desc}</p>
      </div>
      <span
        className={`mt-5 inline-flex w-fit items-center gap-2 border border-ink px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-widest text-ink transition-colors ${
          accent === "hi"
            ? "group-hover:bg-hi-vis"
            : "group-hover:bg-signal group-hover:text-paper"
        }`}
      >
        {cta} →
      </span>
    </a>
  );
}

/* ------------------------------------------------------------------ */
/* STATS STRIP                                                         */
/* ------------------------------------------------------------------ */
const STATS = [
  { num: "< 5 min", label: "Avg. time to fill a game" },
  { num: "100%", label: "Officials background-checked" },
  { num: "48 hr", label: "Typical payout after a game" },
  { num: "Hoops", label: "Basketball first — more soon" },
];

function StatsStrip() {
  return (
    <section className="mx-auto max-w-wrap px-6 py-10 md:px-8">
      <div className="grid grid-cols-2 gap-px overflow-hidden border border-ink bg-ink lg:grid-cols-4">
        {STATS.map((stat) => (
          <div key={stat.label} className="bg-paper p-6">
            <p className="font-display text-3xl font-black tracking-tight text-ink lg:text-4xl">
              {stat.num}
            </p>
            <p className="mt-1 font-mono text-[10px] uppercase leading-snug tracking-widest text-ink-60">
              {stat.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* HOW IT WORKS                                                        */
/* ------------------------------------------------------------------ */
const OFFICIAL_STEPS = [
  {
    n: "01",
    title: "Get verified",
    desc: "Identity check, background screen, and credentials — all in the app.",
  },
  {
    n: "02",
    title: "Set availability",
    desc: "Choose your sports, travel radius, and rates. Go on-duty when you're ready.",
  },
  {
    n: "03",
    title: "Accept & officiate",
    desc: "Grab jobs near you. Show up, run the game, confirm the result.",
  },
  {
    n: "04",
    title: "Get paid",
    desc: "Payouts land in your bank via Stripe. 1099s handled automatically.",
  },
];

const LEAGUE_STEPS = [
  {
    n: "01",
    title: "Post your games",
    desc: "Sport, level, location, and time. Bulk-import a whole season if you like.",
  },
  {
    n: "02",
    title: "Match instantly",
    desc: "Refee surfaces qualified, available officials near each game.",
  },
  {
    n: "03",
    title: "Confirm & relax",
    desc: "Officials accept, you get confirmations, and no-shows get backfilled.",
  },
  {
    n: "04",
    title: "Pay once",
    desc: "One invoice covers every official. Refee handles the disbursement.",
  },
];

function HowItWorks() {
  return (
    <section id="how" className="mx-auto max-w-wrap px-6 py-16 md:px-8 lg:py-24">
      <SectionHeader
        kicker="How it works"
        title="Two sides. One whistle."
        desc="Whether you blow the whistle or fill the schedule, Refee is four simple steps."
      />
      <div className="mt-12 grid gap-10 lg:grid-cols-2">
        <StepTrack
          heading="For officials"
          accent="court"
          steps={OFFICIAL_STEPS}
        />
        <StepTrack
          heading="For leagues"
          accent="signal"
          steps={LEAGUE_STEPS}
        />
      </div>
    </section>
  );
}

function StepTrack({
  heading,
  accent,
  steps,
}: {
  heading: string;
  accent: "court" | "signal";
  steps: { n: string; title: string; desc: string }[];
}) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <span
          className={`inline-block h-3 w-3 ${accent === "court" ? "bg-court" : "bg-signal"}`}
        />
        <h3 className="font-display text-xl font-black uppercase tracking-tight text-ink">
          {heading}
        </h3>
      </div>
      <ol className="mt-5 space-y-px overflow-hidden border border-ink bg-ink">
        {steps.map((step) => (
          <li
            key={step.n}
            className="flex gap-4 bg-chalk p-5 transition-colors hover:bg-paper"
          >
            <span
              className={`font-mono text-sm font-bold ${accent === "court" ? "text-court" : "text-signal"}`}
            >
              {step.n}
            </span>
            <div>
              <p className="font-display text-lg font-black tracking-tight text-ink">
                {step.title}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-ink-60">
                {step.desc}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* OFFICIALS SECTION                                                   */
/* ------------------------------------------------------------------ */
const OFFICIAL_BENEFITS = [
  {
    title: "You set the price",
    desc: "Name your rate per sport and level. No lowball assignments.",
  },
  {
    title: "Fast, transparent pay",
    desc: "See the payout before you accept. Money hits your bank via Stripe — with tax docs handled.",
  },
  {
    title: "Games that fit your life",
    desc: "Filter by sport, distance, and time. Go on-duty when you want the work.",
  },
  {
    title: "Build your reputation",
    desc: "Ratings and reliability travel with you. Great officials get first pick.",
  },
];

function OfficialsSection() {
  return (
    <section
      id="officials"
      className="relative border-y border-ink bg-paper-2"
    >
      <div className="mx-auto grid max-w-wrap items-center gap-12 px-6 py-16 md:px-8 lg:grid-cols-2 lg:py-24">
        <div>
          <span className="badge badge-confirmed">
            <span className="dot" />
            For officials
          </span>
          <h2 className="mt-5 font-display text-4xl font-black leading-[0.98] tracking-tighter text-ink sm:text-5xl">
            Turn your whistle
            <br />
            into a paycheck.
          </h2>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-ink-80">
            Whether you officiate weekends for extra income or work games
            full-time, Refee puts the schedule in your hands.
          </p>
          <div className="mt-8">
            <StoreButtons />
          </div>
        </div>

        <div className="grid gap-px overflow-hidden border border-ink bg-ink sm:grid-cols-2">
          {OFFICIAL_BENEFITS.map((b) => (
            <div key={b.title} className="bg-chalk p-6">
              <div className="mb-3 h-2 w-8 bg-court" />
              <h3 className="font-display text-lg font-black tracking-tight text-ink">
                {b.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-60">
                {b.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* LEAGUES SECTION                                                     */
/* ------------------------------------------------------------------ */
const LEAGUE_BENEFITS = [
  {
    title: "Never scramble again",
    desc: "Post a game and Refee finds available, qualified officials nearby — automatically.",
  },
  {
    title: "Only vetted officials",
    desc: "Every official is identity-verified and background-checked before they take the field.",
  },
  {
    title: "No-show protection",
    desc: "If an official can't make it, Refee backfills the assignment so your game still runs.",
  },
  {
    title: "One invoice, done",
    desc: "Pay for all your officials in one place. We handle payouts and paperwork.",
  },
];

function LeaguesSection() {
  return (
    <section id="leagues" className="mx-auto max-w-wrap px-6 py-16 md:px-8 lg:py-24">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div className="order-2 grid gap-px overflow-hidden border border-ink bg-ink sm:grid-cols-2 lg:order-1">
          {LEAGUE_BENEFITS.map((b) => (
            <div key={b.title} className="bg-chalk p-6">
              <div className="mb-3 h-2 w-8 bg-signal" />
              <h3 className="font-display text-lg font-black tracking-tight text-ink">
                {b.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-60">
                {b.desc}
              </p>
            </div>
          ))}
        </div>

        <div className="order-1 lg:order-2">
          <span className="badge badge-signal">
            <span className="dot" />
            For leagues &amp; organizers
          </span>
          <h2 className="mt-5 font-display text-4xl font-black leading-[0.98] tracking-tighter text-ink sm:text-5xl">
            Fill every game.
            <br />
            <span className="text-signal">Skip the phone tree.</span>
          </h2>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-ink-80">
            Stop chasing officials one text at a time. Post your schedule and
            let Refee match, confirm, and pay — so you can run the league.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#download" className="btn btn-primary">
              Get the app
            </a>
            <a href="#" className="btn btn-secondary">
              Talk to our team
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* TRUST & SAFETY                                                      */
/* ------------------------------------------------------------------ */
const TRUST_ITEMS = [
  {
    title: "Background checks",
    desc: "Every official is screened through an NCYS-endorsed provider built for youth sports — before their first game.",
  },
  {
    title: "Identity verification",
    desc: "Government-ID identity checks confirm officials are who they say they are.",
  },
  {
    title: "Privacy by design",
    desc: "Sensitive data is locked down at the database level. Public profiles show only first name, city, and rating.",
  },
  {
    title: "Secure payments",
    desc: "Payouts run on Stripe Connect. Refee never touches your bank credentials.",
  },
];

function TrustSection() {
  return (
    <section id="trust" className="border-t border-ink bg-ink text-paper">
      <div className="mx-auto max-w-wrap px-6 py-16 md:px-8 lg:py-24">
        <span className="badge !border-hi-vis-dark !bg-transparent !text-hi-vis-dark">
          <span className="dot dot-pulse" />
          Trust &amp; safety
        </span>
        <h2 className="mt-5 max-w-2xl font-display text-4xl font-black leading-[0.98] tracking-tighter text-paper sm:text-5xl">
          Built safe enough
          <br />
          for youth sports.
        </h2>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-paper/70">
          Trust is the whole product. Refee vets every official and protects
          everyone's data by default — not as an afterthought.
        </p>

        <div className="mt-12 grid gap-px overflow-hidden border border-paper/20 bg-paper/20 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST_ITEMS.map((item) => (
            <div key={item.title} className="bg-ink p-6">
              <div className="mb-4 h-2 w-8 bg-hi-vis-dark" />
              <h3 className="font-display text-lg font-black tracking-tight text-paper">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-paper/60">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* DOWNLOAD CTA                                                        */
/* ------------------------------------------------------------------ */
function DownloadCTA() {
  return (
    <section id="download" className="mx-auto max-w-wrap px-6 py-20 md:px-8">
      <div className="zebra-rule--signal zebra-rule mb-12" />
      <div className="grid items-center gap-10 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <span className="kicker">Ready when you are</span>
          <h2 className="mt-3 font-display text-5xl font-black leading-[0.95] tracking-tighter text-ink sm:text-6xl">
            Get the whistle
            <br />
            in your pocket.
          </h2>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-ink-80">
            Download Refee free. Officials, get booked. Leagues, get covered.
            It only takes a minute to set up.
          </p>
          <div className="mt-8">
            <StoreButtons />
          </div>
        </div>

        <div className="flex justify-center lg:justify-end">
          <div className="border border-ink bg-chalk p-8 text-center shadow-[6px_6px_0_var(--ink)]">
            <div className="mx-auto flex h-40 w-40 items-center justify-center border border-dashed border-ink-40 bg-paper">
              <span className="kicker text-center leading-relaxed">
                QR code
                <br />
                to app
              </span>
            </div>
            <p className="mt-4 font-mono text-[10px] uppercase tracking-widest text-ink-60">
              Scan to download
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* SHARED                                                              */
/* ------------------------------------------------------------------ */
function SectionHeader({
  kicker,
  title,
  desc,
}: {
  kicker: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="max-w-2xl">
      <span className="kicker">{kicker}</span>
      <h2 className="mt-3 font-display text-4xl font-black leading-[0.98] tracking-tighter text-ink sm:text-5xl">
        {title}
      </h2>
      <p className="mt-4 text-lg leading-relaxed text-ink-80">{desc}</p>
    </div>
  );
}
