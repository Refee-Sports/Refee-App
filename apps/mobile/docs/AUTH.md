# Sign-in

Refee signs people in three ways, all ending at a verified email on the same
account in the app and on the web:

| Method | Notes |
|---|---|
| **Apple** | Native sheet on iOS, web flow elsewhere. Required by App Store rules because Google is offered. |
| **Google** | OAuth web flow. |
| **Email code** | A 6-digit code emailed to the person; the same code creates the account the first time. No passwords. |

There is **no phone/SMS sign-in** (removed Sep 29, 2026): it cost money per
login, invited SMS-pumping fraud, and blocked the App Store reviewer.

Code: `packages/core/src/auth/emailCode.ts` (shared), the sign-in and verify
screens in each app, `supabase/templates/sign_in_code.html` (the email body).

## Local development

`supabase start` runs Mailpit at http://127.0.0.1:54324 — every sign-in email
lands there, nothing leaves your machine. Seeded accounts (`supabase/seed.sql`):

| Email | Who |
|---|---|
| `ref1@refee.local` | Alex, referee |
| `dir1@refee.local` | Jordan, director |
| `ref2`–`ref4@refee.local` | referees |
| `dir2@refee.local` | director |

Enter the address, open Mailpit, type the code. Any other email creates a new account.

## Hosted setup (do this before switching phone off)

1. **Email sender.** Dashboard → Authentication → **SMTP Settings** → enable custom SMTP.
   Supabase's built-in sender only delivers to your own team and is capped at a few
   emails an hour, so real sign-ups need this. Resend works: host `smtp.resend.com`,
   port `465`, username `resend`, password = your Resend API key, sender = an address on
   a domain you've verified in Resend (SPF + DKIM records).
2. **Email templates.** Dashboard → Authentication → **Emails**. Edit both **Confirm
   signup** and **Magic Link**: subject `Your Refee sign-in code`, body = the contents of
   `supabase/templates/sign_in_code.html`. The important part is `{{ .Token }}` — the
   default templates only contain a link, so without this people get an email with no code.
3. **Rate limit.** Authentication → Rate Limits → "Emails sent per hour" — with custom SMTP
   the default is low (30). Raise it to something like 100 to cover launch day.
4. **Existing phone-only accounts.** Anyone who signed up with a phone has no email, and
   signing in with a *new* email creates a *new* account. Attach an email first:
   ```bash
   ./scripts/attach-email.sh 5551234567 person@example.com linked
   ```
   Do this for every account you want to keep (prod had 6 on Sep 29).
5. **Turn phone off.** Dashboard → Authentication → Sign In / Providers → **Phone** → off.
   Remove the Twilio secrets afterwards.
6. Apple and Google providers must be on (Providers page) with their credentials, and
   `refee://auth/callback` must be in URL Configuration → Redirect URLs.

## App Store review

Apple's reviewer needs a way in. A phone test number used to do it; email codes need an
inbox they can open. Options, in order of preference:

1. **A dedicated review mailbox**: create an address (e.g. `appreview@yourdomain`) whose
   inbox you can also open, put its login in the App Review notes, and keep the account
   seeded with a director and a referee role so every flow can be exercised. Codes are
   valid for an hour, so tell them to request the code only when they're ready.
2. Sign in with Apple works for the reviewer's own Apple ID with no setup — mention it.

Do not ship a hidden "test code" backdoor in the production build.

## Changing email provider later

Nothing in the app depends on the provider — only Dashboard → SMTP Settings. Postmark and
SES both work by swapping the host and credentials.
