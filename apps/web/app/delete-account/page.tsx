import type { Metadata } from "next";
import Link from "next/link";
import { LegalShell, Section } from "@/app/legal/LegalShell";

export const metadata: Metadata = {
  title: "Delete your account",
  description: "How to permanently delete a Refee account and its associated personal data.",
};

export default function DeleteAccountPage() {
  return (
    <LegalShell title="Delete your account" updated="September 2026">
      <Section heading="Delete from Refee">
        <p>
          Sign in on the web or in the mobile app, open your profile, and choose{" "}
          <strong>Account &amp; sign-in</strong>. In the Delete account section, type{" "}
          <strong>DELETE</strong> and confirm the permanent deletion.
        </p>
        <p>
          If you are already signed in on this device, you can go directly to{" "}
          <Link className="underline" href="/account">
            Account &amp; sign-in
          </Link>
          .
        </p>
      </Section>

      <Section heading="Before deletion can finish">
        <p>
          Active games, active tournament assignments, unresolved payments, disputes, and
          remaining payout balances must be resolved first. Refee will explain the specific
          blocker instead of partially deleting the account.
        </p>
      </Section>

      <Section heading="What is deleted">
        <p>
          Refee removes your sign-in identities, personal and public profiles, roles, avatar,
          any uploaded background check, roster memberships, device tokens, identity-verification session, and connected payment or payout account
          where the provider permits immediate deletion. Message content is redacted.
        </p>
        <p>
          Transaction and staffing records that another participant, payment reconciliation, or
          legal obligation depends on may remain without your personal profile attached. See the{" "}
          <Link className="underline" href="/privacy">
            privacy notice
          </Link>{" "}
          for more information.
        </p>
      </Section>
    </LegalShell>
  );
}
