import { SiteNav } from "@/components/SiteNav";
import { Footer } from "@/components/Footer";
import { PhoneMock } from "@/components/PhoneMock";
import { StoreButtons } from "@/components/StoreButtons";
import { SectionMark } from "@/components/ui/SectionMark";

export default function HomePage() {
  return (
    <>
      <SiteNav />
      <main className="relative z-10">
        <Hero />
        <StatsStrip />
        <HowItWorks />
        <OfficialsSection />
        <AssignorsSection />
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
          <SectionMark tone="signal">Basketball first · ID-verified · 18+</SectionMark>

          <h1 className="mt-6 font-display font-black leading-[0.95] tracking-tighter text-ink text-[clamp(1.75rem,8vw,3.25rem)] lg:text-[clamp(3rem,5vw,4rem)]">
            <span className="block whitespace-nowrap">Games don&apos;t count</span>
            <span className="block whitespace-nowrap">unless you make it</span>
            <span className="block whitespace-nowrap text-signal">official.</span>
          </h1>

          <p className="mt-6 max-w-md text-lg leading-relaxed text-ink-80">
            Refee is where officials find games and get paid, and where
            assignors and leagues find officials. Pick your side to get
            started.
          </p>

          {/* One card per role on the platform */}
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <PathCard
              kicker="I'm an official"
              title="Get booked & paid"
              desc="Pick your sports, set your rate, and take the games that fit your week."
              cta="Get the app"
              href="#officials"
              accent="hi"
            />
            <PathCard
              kicker="I assign officials"
              title="Staff your events"
              desc="Bring your roster, take on tournaments, and see every game on one board."
              cta="Start assigning"
              href="#assignors"
              accent="whistle"
            />
            <PathCard
              kicker="I run a league"
              title="Fill every game"
              desc="Post your games and see which officials near the venue take them."
              cta="Post games"
              href="#leagues"
              accent="signal"
            />
          </div>

          <p className="mt-6 kicker">
            Free to download · iOS &amp; Android · Officials pay no fees
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

// Spelled out so Tailwind can see each class; see TRACK_ACCENT below.
const PATH_ACCENT = {
  hi: { kicker: "!text-court", hover: "group-hover:bg-hi-vis" },
  whistle: {
    kicker: "!text-whistle-ink",
    hover: "group-hover:bg-whistle",
  },
  signal: {
    kicker: "!text-signal",
    hover: "group-hover:bg-signal group-hover:text-paper",
  },
} as const;

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
  accent: keyof typeof PATH_ACCENT;
}) {
  const tone = PATH_ACCENT[accent];
  return (
    <a
      href={href}
      className="group flex flex-col justify-between border border-ink bg-chalk p-5 transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--ink)]"
    >
      <div>
        <span className={`kicker ${tone.kicker}`}>{kicker}</span>
        <h3 className="mt-2 font-display text-2xl font-black tracking-tight text-ink">
          {title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-ink-60">{desc}</p>
      </div>
      <span
        className={`mt-5 inline-flex w-fit items-center gap-2 border border-ink px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-widest text-ink transition-colors ${tone.hover}`}
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
  { num: "Hoops", label: "Basketball first, more sports soon" },
  { num: "$0", label: "Fees charged to officials" },
  { num: "You", label: "Set your own rate" },
  { num: "ID", label: "Every user ID-verified" },
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
    title: "Get verified",
    desc: "ID check and credentials, all in the app. Add a background check if you have one.",
  },
  {
    title: "Set availability",
    desc: "Choose your sports, travel distance, and rates. Go on duty when you want work.",
  },
  {
    title: "Accept & officiate",
    desc: "Take games near you. Show up, work the game, confirm it's done.",
  },
  {
    title: "Get paid",
    desc: "Payouts go through Stripe. Your first bank deposit can take about a week; after that, a couple of business days.",
  },
];

const ASSIGNOR_STEPS = [
  {
    title: "Get verified",
    desc: "The same ID check every official passes, so directors know who they're scheduling.",
  },
  {
    title: "Take on an event",
    desc: "Directors invite you, or you propose your fee on tournaments that need staffing.",
  },
  {
    title: "Build your roster",
    desc: "Bring the officials you already trust, or pull from verified refs near the venue.",
  },
  {
    title: "Staff every game",
    desc: "Offer games, track confirmations, and fill gaps before game day.",
  },
];

const LEAGUE_STEPS = [
  {
    title: "Post your games",
    desc: "Sport, level, location, and time. Bulk-import a whole season if you want.",
  },
  {
    title: "Officials see it",
    desc: "Officials whose travel range covers the venue see the game and can take it.",
  },
  {
    title: "Confirm",
    desc: "Officials accept and you see confirmations. If someone drops out, the slot reopens.",
  },
  {
    title: "Pay once",
    desc: "Pay the crew in one charge. Refee sends each official their share.",
  },
];

function HowItWorks() {
  return (
    <section id="how" className="mx-auto max-w-wrap px-6 py-16 md:px-8 lg:py-24">
      <SectionHeader
        kicker="How it works"
        title="Pick your side."
        desc="Officials, assignors, and leagues each get four steps."
      />
      <div className="mt-12 grid gap-10 lg:grid-cols-3">
        <StepTrack
          heading="For officials"
          accent="court"
          steps={OFFICIAL_STEPS}
        />
        <StepTrack
          heading="For assignors"
          accent="whistle"
          steps={ASSIGNOR_STEPS}
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

// Written out rather than interpolated: Tailwind only ships classes it can
// see as whole strings in the source.
const TRACK_ACCENT = {
  court: { dot: "bg-court" },
  whistle: { dot: "bg-whistle" },
  signal: { dot: "bg-signal" },
} as const;

function StepTrack({
  heading,
  accent,
  steps,
}: {
  heading: string;
  accent: keyof typeof TRACK_ACCENT;
  steps: { title: string; desc: string }[];
}) {
  const tone = TRACK_ACCENT[accent];
  return (
    <div>
      <div className="flex items-center gap-3">
        <span className={`inline-block h-3 w-3 ${tone.dot}`} />
        <h3 className="font-display text-xl font-black uppercase tracking-tight text-ink">
          {heading}
        </h3>
      </div>
      <ol className="mt-5 space-y-px overflow-hidden rounded-lg border border-ink bg-ink">
        {steps.map((step) => (
          <li key={step.title} className="bg-chalk p-5">
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
    desc: "Set a rate for each sport and level. You see the pay before you accept.",
  },
  {
    title: "Clear pay",
    desc: "See the payout before you accept. Money goes to your bank through Stripe.",
  },
  {
    title: "Games that fit your week",
    desc: "Filter by sport, distance, and time. Go on duty when you want work.",
  },
  {
    title: "Your record stays with you",
    desc: "Directors rate officials after each game, and those ratings show on your profile.",
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
          <SectionMark tone="court">For officials</SectionMark>
          <h2 className="mt-5 font-display text-4xl font-black leading-[0.98] tracking-tighter text-ink sm:text-5xl">
            Pick your games.
            <br />
            Set your rate.
          </h2>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-ink-80">
            Work a few weekends for extra money or run a full schedule. You
            decide which games you take.
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
/* ASSIGNORS SECTION                                                   */
/* ------------------------------------------------------------------ */
const ASSIGNOR_BENEFITS = [
  {
    title: "Your roster travels with you",
    desc: "The officials you trust stay on your roster across every event you staff.",
  },
  {
    title: "Name your fee",
    desc: "Flat rate or a percentage of the officiating budget. You propose, the director agrees.",
  },
  {
    title: "One board, every game",
    desc: "See what's open, what's confirmed, and what still needs an official.",
  },
  {
    title: "Fee on the record",
    desc: "Your fee is recorded on the event once the director agrees to it.",
  },
];

function AssignorsSection() {
  return (
    <section
      id="assignors"
      className="mx-auto max-w-wrap px-6 py-16 md:px-8 lg:py-24"
    >
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <SectionMark tone="whistle">For assignors</SectionMark>
          <h2 className="mt-5 font-display text-4xl font-black leading-[0.98] tracking-tighter text-ink sm:text-5xl">
            You know who can
            <br />
            <span className="text-whistle-ink">work the game.</span>
          </h2>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-ink-80">
            Bring the roster you&apos;ve built. Refee handles ID checks,
            confirmations, and payment. You decide who works.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="/auth/welcome" className="btn btn-primary">
              Start assigning
            </a>
          </div>
        </div>

        <div className="grid gap-px overflow-hidden border border-ink bg-ink sm:grid-cols-2">
          {ASSIGNOR_BENEFITS.map((b) => (
            <div key={b.title} className="bg-chalk p-6">
              <div className="mb-3 h-2 w-8 bg-whistle" />
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
    title: "Post it once",
    desc: "Post a game and officials near the venue see it. No group texts.",
  },
  {
    title: "ID-verified officials",
    desc: "Every official verifies their ID before taking games. Officials can also upload a background check.",
  },
  {
    title: "If someone drops out",
    desc: "When an official withdraws, the slot reopens so another official can take it.",
  },
  {
    title: "One place to pay",
    desc: "Pay your crew in one charge. Refee handles the payouts to each official.",
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
          <SectionMark tone="signal">For leagues &amp; organizers</SectionMark>
          <h2 className="mt-5 font-display text-4xl font-black leading-[0.98] tracking-tighter text-ink sm:text-5xl">
            Fill every game.
            <br />
            <span className="text-signal">Skip the phone tree.</span>
          </h2>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-ink-80">
            Stop texting officials one at a time. Post your games, see who
            takes them, and pay everyone in one place.
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
    title: "Background check uploads",
    desc: "Officials can upload a background check to their profile. Refee doesn't review it yet. Hirers see that one was uploaded and when it expires.",
  },
  {
    title: "Identity verification",
    desc: "A government ID check confirms officials are who they say they are.",
  },
  {
    title: "Privacy by design",
    desc: "Sensitive data is locked down at the database level. Public profiles show first name and last initial, city, and rating.",
  },
  {
    title: "Secure payments",
    desc: "Payouts run through Stripe. Refee never sees your bank details.",
  },
];

function TrustSection() {
  return (
    <section id="trust" className="border-t border-ink bg-ink text-paper">
      <div className="mx-auto max-w-wrap px-6 py-16 md:px-8 lg:py-24">
        <SectionMark tone="hiVis">Trust &amp; safety</SectionMark>
        <h2 className="mt-5 max-w-2xl font-display text-4xl font-black leading-[0.98] tracking-tighter text-paper sm:text-5xl">
          Built for games
          <br />
          with kids in them.
        </h2>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-paper/70">
          Every user verifies their ID. Officials can add a background check to
          their profile. Everyone&apos;s data is private by default.
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
          <span className="kicker">Download</span>
          <h2 className="mt-3 font-display text-5xl font-black leading-[0.95] tracking-tighter text-ink sm:text-6xl">
            Get the app.
            <br />
            Find a game.
          </h2>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-ink-80">
            Free on iOS and Android. Setup takes a few minutes: verify your
            ID, set your rate, and start finding games.
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
