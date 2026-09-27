import type { Metadata } from "next";
import { LegalShell, NeedsCounsel, Section } from "@/app/legal/LegalShell";

export const metadata: Metadata = {
  // The root layout appends " · Refee".
  title: "Privacy",
  description: "What Refee collects, why, and who else sees it.",
};

/**
 * Draft privacy policy.
 *
 * Every factual claim here was read off the schema and the edge functions, so
 * it describes what the product actually does rather than what a template
 * assumes. The biometric section is the one that carries real liability and is
 * flagged for counsel throughout.
 */
export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy" updated="September 2026">
      <Section heading="What this covers">
        <p>
          Refee is a marketplace for sports officials. Referees, tournament
          directors and assignors use it to find each other, staff games and get
          paid. This page describes what we collect to do that, and who else
          receives it.
        </p>
      </Section>

      <Section heading="What we collect">
        <p>
          <strong>To create your account:</strong> your phone number, and your
          name, city and state.
        </p>
        <p>
          <strong>To verify who you are:</strong> your legal name and date of
          birth, and — through our identity partner — a photograph of a
          government ID and a selfie. See the next section.
        </p>
        <p>
          <strong>To match you to work near you:</strong> your home city, which
          we convert to approximate coordinates so games can be sorted by
          distance. These coordinates are visible only to you; they are not part
          of the profile other people can see.
        </p>
        <p>
          <strong>To pay you:</strong> payout account details, held by Stripe.
          Refee does not store card or bank numbers.
        </p>
        <p>
          <strong>As you use the product:</strong> games applied to and worked,
          ratings, messages with the people you work with, and device tokens so
          we can send notifications.
        </p>
      </Section>

      <Section heading="Identity verification and biometrics">
        <p>
          Refee is open to anyone, so every person is checked before they can
          take, post or staff games. That check is performed by{" "}
          <strong>Didit</strong>, our identity partner. You photograph a
          government ID and take a selfie. Didit reads the ID and{" "}
          <strong>
            compares your face in the selfie to the face on the ID
          </strong>
          , and checks that a live person is present.
        </p>
        <p>
          That comparison is biometric processing. The images and any biometric
          data are captured and held by Didit, not by Refee. Refee receives only
          a decision, a session identifier, your legal name and your date of
          birth.
        </p>
        <NeedsCounsel>
          Illinois (BIPA) and Texas (CUBI) require written notice and consent
          before biometric capture, and BIPA carries a private right of action.
          This section needs counsel-approved notice-and-consent wording, a
          stated retention and destruction schedule, and confirmation that
          Didit&apos;s own retention matches what we promise. Several other
          states have comparable rules. Do not launch on this text.
        </NeedsCounsel>
        <p>
          Refee requires everyone on the platform to be 18 or older, and the
          date of birth read from your ID is used to enforce that.
        </p>
      </Section>

      <Section heading="Who else sees your information">
        <p>
          <strong>Other people on Refee</strong> see your first name and last
          initial, your city and state, your sports and levels, your rating, and
          whether you are verified. They do not see your legal name, date of
          birth, phone number, address or home coordinates.
        </p>
        <p>
          <strong>Didit</strong> — identity verification, as described above.
        </p>
        <p>
          <strong>Stripe</strong> — payments and payouts. Stripe holds the
          financial details.
        </p>
        <p>
          <strong>Supabase</strong> — our database and backend hosting.
        </p>
        <p>
          <strong>Twilio</strong> — the SMS that carries your sign-in code.
        </p>
        <p>
          <strong>Anthropic</strong> — when a director imports a schedule, the
          document is sent to an AI model to extract game details. Do not
          include information in an imported file that you do not want
          processed this way.
        </p>
        <p>We do not sell your information.</p>
      </Section>

      <Section heading="Your choices">
        <p>
          You can edit your profile, turn availability off, and stop
          notifications from your device settings at any time.
        </p>
        <NeedsCounsel>
          Needs the account deletion and data export process, retention periods
          per data type, and the rights language required where users are —
          which for a US consumer product means at least CCPA/CPRA, and GDPR if
          anyone in the EU or UK signs up. Note that games, payments and ratings
          reference an account, so deletion policy has to say what happens to
          the other party&apos;s records.
        </NeedsCounsel>
      </Section>

      <Section heading="Security">
        <p>
          Access to your data is enforced in the database itself, not only in
          the apps: your private details are readable only by you, and actions
          like verification and payouts can only be set by Refee&apos;s backend.
        </p>
        <NeedsCounsel>
          Needs a breach notification commitment and the timeline required by
          applicable state law.
        </NeedsCounsel>
      </Section>

      <Section heading="Children">
        <p>
          Refee is not for anyone under 18. Accounts are refused at sign-up, and
          again if the date of birth on a verified ID shows the person is a
          minor.
        </p>
      </Section>
    </LegalShell>
  );
}
