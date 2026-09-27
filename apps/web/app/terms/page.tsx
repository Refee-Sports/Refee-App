import type { Metadata } from "next";
import { LegalShell, NeedsCounsel, Section } from "@/app/legal/LegalShell";

export const metadata: Metadata = {
  // The root layout appends " · Refee".
  title: "Terms",
  description: "The rules for using Refee.",
};

/**
 * Draft terms of service.
 *
 * Describes how the product actually behaves — verification, the money flow,
 * cancellations — so counsel writes the binding clauses against something
 * real. Everything that creates or limits legal liability is flagged rather
 * than guessed at.
 */
export default function TermsPage() {
  return (
    <LegalShell title="Terms" updated="September 2026">
      <Section heading="What Refee is">
        <p>
          Refee is a marketplace. Tournament directors and assignors post and
          staff games; referees accept and work them. Refee is not the employer
          of any official, and does not assign, supervise or control how a game
          is officiated.
        </p>
        <NeedsCounsel>
          Worker classification is the central legal question for this product.
          The independent-contractor position needs review against the tests
          that apply in each state you operate in, and the language here has to
          match how the product actually behaves.
        </NeedsCounsel>
      </Section>

      <Section heading="Who can use it">
        <p>
          You must be 18 or older. You must give your real legal name and
          complete identity verification before you can take, post or staff
          games. You may hold one account.
        </p>
      </Section>

      <Section heading="Verification">
        <p>
          Everyone is verified before working. Until verification is approved a
          referee cannot accept games, a director cannot post them and an
          assignor cannot staff them. Refee may decline or withdraw
          verification, and may suspend an account.
        </p>
        <p>
          A verified badge means an identity check passed. It is not a
          background check, an endorsement, or a guarantee of anyone&apos;s
          conduct or competence.
        </p>
      </Section>

      <Section heading="Money">
        <p>
          Pay for a game is set when it is posted. Payment is collected from the
          director up front and released to the crew after the game is
          completed. Refee takes a platform fee, shown before you commit.
          Payments are processed by Stripe under its own terms.
        </p>
        <NeedsCounsel>
          Needs the final fee schedule, refund and cancellation terms, what
          happens on a dispute or chargeback, how long funds are held, and who
          bears loss when a charge fails after a game has been worked. There is
          an open product decision on this (PAY-03) that these terms must
          follow, not lead.
        </NeedsCounsel>
      </Section>

      <Section heading="Showing up">
        <p>
          Accepting a game is a commitment. Withdrawing late leaves a director
          without officials and a game that may not be played.
        </p>
        <NeedsCounsel>
          The reliability mechanic is undecided (TRUST-02). Once it exists —
          show rate, strikes, or otherwise — these terms need to state the rule,
          the lookback period and any appeal.
        </NeedsCounsel>
      </Section>

      <Section heading="Conduct">
        <p>
          Do not misrepresent who you are or what you are qualified to
          officiate. Do not harass anyone. Do not use Refee to arrange work off
          the platform in order to avoid its protections. Do not attempt to
          access another person&apos;s account or data.
        </p>
        <p>
          Refee may suspend an account that breaks these rules. Suspension stops
          new work; it does not erase records of games already worked or money
          already owed.
        </p>
      </Section>

      <Section heading="Safety">
        <p>
          Refee verifies identity. It does not supervise games, inspect venues,
          or vet the people you will meet there. Use your own judgement.
        </p>
        <NeedsCounsel>
          Needs the liability limitation, disclaimers, indemnity and insurance
          position — particularly for youth events, where duty-of-care exposure
          is highest and where a background-check policy will eventually be
          referenced.
        </NeedsCounsel>
      </Section>

      <Section heading="Changes and disputes">
        <NeedsCounsel>
          Needs governing law, venue, whether arbitration and a class-action
          waiver apply, how changes to these terms are notified and when they
          take effect, and the termination process for both sides.
        </NeedsCounsel>
      </Section>
    </LegalShell>
  );
}
