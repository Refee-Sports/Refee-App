# Refee Design System

The source of truth for how Refee looks and behaves on web (`apps/web`) and mobile (`apps/mobile`). Read this file before any UI work.

**Files in this folder**

- `README.md`: this brand book (rules, colors, type, corners, interaction states).
- `tokens.json`: every color (light + dark), type style, radius and shadow value, each with a usage note.
- `components/<Name>/README.md`: guidelines per component (Button, Badge, Choice, TextField, Wordmark, ZebraRule, IconSet).
- `components/bundle.css`: reference CSS for every component and state. A spec to port into Tailwind/NativeWind, not a stylesheet to import.
- `components/index.d.ts`: component prop types, as documentation.

**Where it lives in code**

- `packages/design` (`@refee/design`) holds the token values and the per-variant looks both apps use. Both Tailwind configs and `apps/mobile/lib/theme.ts` read from it; nothing else defines a color, radius or shadow. Its tests fail if it drifts from `tokens.json` here or if a text/fill pair drops below 4.5:1.
- The components themselves stay per platform: `apps/web/components/ui/*` (DOM + Tailwind) and `apps/mobile/components/ui/*` (React Native + NativeWind). Screens use them instead of raw `<button>`/`<input>` or `Pressable`/`TextInput`; ESLint enforces this for new code.

**Quick rules**

- Corners: `rounded-sm` 10px (fields), `rounded-md` 12px (buttons, option rows, big choice), `rounded-lg` 18px (cards), `rounded-full` (badges, chips, toggles). ZebraRule stays square.
- Hover, with a pointer only: "lift to act, ring to choose".
- Pressed: instant scale and tint on touch.
- Focus: signal-blue ring, keyboard only.
- Buttons also have loading, done and disabled states.
- Text colors: green text uses `court-ink`, red text uses `foul-ink`, and yellow text uses `whistle-ink`.
- Red is for errors and hard-to-undo actions only. Declining a game offer is neutral.
- Number things only when they are real steps. No fake "live" indicators.
- Labels and controls are mono uppercase. No emoji and no soft shadows.

Synced from the Refee design system on claude.ai (https://claude.ai/artifact/A7XVyN8yYvsmHMdkjZKapt). When the design system changes there, update this folder and `packages/design` together; the tests will tell you if they disagree.

---

## Content fundamentals

Write in short, mono-cased, uppercase-tracked fragments for labels and telemetry ("LIVE", "CONFIRMED", "4 QUARTERS") — reserve full sentence case for body copy and hints. Address the referee, assignor or director directly and plainly; the source's own hint copy ("Anything the assignor should know", "Shown to the assignor only") is instructional, not marketing voice. Numbers and statuses are the star of this product — a referee shortage, a pay rate, a game count — so let mono/tabular figures carry weight rather than burying them in prose. No emoji anywhere in the UI voice (none appear anywhere in the source).

Number things only when they are a real sequence: steps someone moves through ("01 Photograph your ID", "03 / 09" in onboarding). Section headings, feature lists and marketing columns are not sequences, so they don't get "01 / 02 / 03" labels; a list that is already ordered reads in order without them. Likewise, never fake liveness: a pulsing dot or "LIVE" label appears only on something that is actually live (a game in progress), never as decoration on marketing pages.

## Visual foundations

### Color

Set page backgrounds in `paper`, with `paper-2` for a one-step-darker section fill and `chalk` for anything that needs to read as "filled" above paper — cards, inputs. Set primary text in `ink` at full opacity for headlines and in `ink-80` for body copy; drop to `ink-60` only for mono labels at 9px+ bold, where the lower contrast is legible at that weight and size, and never for anything smaller or lighter.

`signal` is the one brand color that should recur everywhere selection, focus or a primary link appears — it is the system's only "blue," used consistently rather than diluted with secondary blues. `hi-vis` is reserved for the loudest, rarest moment on a screen: a live badge, one hero CTA, the text-selection highlight — never a background wash or a supporting element. `court` (success), `whistle` (warning) and `foul` (danger) are state colors only; never use them decoratively. Each comes as a pair: the bright token for fills, dots, icons and borders, and an `-ink` token for text that must read — `court-ink` (#00733F), `whistle-ink` (#7A5700) and `foul-ink` (#B3202C) all clear 4.5:1 on paper. A Done button is a `court` fill with an `ink` label; a destructive button is `foul-ink` with a white label. Red means an error or a hard-to-undo action (cancel a game, remove a ref, drop out of a game you are confirmed for) — declining a game offer is a normal choice and stays neutral ink, and an open slot left by a decline is a `whistle` warning on the assignor side, not a `foul` error. The "Decline is neutral" rule is about game offers; in the staff tools, rejecting an ID verification is a hard-to-undo decision and may use `danger`.

Both light and dark themes are defined (see `tokens.json` — mobile ships both; the web app currently ships light only). Every dark-theme value here is copied exactly from source, not invented.

### Type

Three families, three jobs, never mixed: `display` (Inter Tight, weight 900, tight tracking) for headlines, the wordmark, and big numeral readouts; `body` (Inter Tight, 500/700) for paragraphs and general UI text; `mono` (JetBrains Mono, 500/700, uppercase, wide tracking) for every label, badge, button, field caption and telemetry string in the product. If it's a caption or a control label, it's mono and uppercase — that rule holds with no exceptions across both apps.

### Spacing & radius

The source has no named spacing scale — both apps consume Tailwind's default spacing utilities directly rather than a custom token set; don't invent one here. Radius follows the Rounded scale (adopted 2026-10-20, replacing the original 0px-everywhere rule): `radius-sm` (10px) for text fields and selects, `radius-md` (12px) for buttons, option rows and big choice tiles, `radius-lg` (18px) for cards and sheets, and `radius-full` for badges, chips, toggles and dots. `radius-none` survives only on stripes — the ZebraRule and full-bleed dividers. The heavy borders, mono labels and hard shadow carry the sporty edge now that corners are soft; don't drift past these four steps.

### Shadows & borders

Borders carry weight, not shadows: 1px for default dividers, 1.5px where a control needs emphasis (buttons, fields, selected states). The one elevation this system uses is `hard` — a flat, un-blurred 4px offset that appears only when a pointer hovers an action button, never at rest and never on touch. It follows the corner radius. The `ring-hover`, `ring-hover-selected` and `ring-focus` tokens are outline rings, not shadows. Don't add blur or soft shadows anywhere.

### Motion & states

Motion is minimal and purposeful: a pulse on a live-status dot, a translate-on-hover for buttons, a flash animation reserved for counts awaiting the user's action (approvals). Every animation in the source respects `prefers-reduced-motion: reduce` by dropping to a static state — carry that forward in anything new. Selected state is one consistent idiom across every choice control (`OptionRow`, `Chip`, `BigChoice`): a `signal` border plus an 8%-opacity `signal-tint` background wash, label recolored to `signal`. Don't invent a second selection treatment.

### Interaction states

Every interactive control has rest, hover, pressed, focus and disabled; buttons add loading and done.

- **Hover — lift to act, ring to choose.** Buttons that commit an action (primary, hi-vis, secondary, danger) rise 2px up-left onto the `hard` shadow. Things you pick, filter or open (chips, option rows, big choice, toggles, tappable cards) get `ring-hover` instead, or `ring-hover-selected` when already selected. Text fields have no hover. Badges are status, not controls, and never react. Hover applies only under `@media (hover: hover)` so nothing sticks after a tap.
- **Pressed — the state touch users feel.** Shows instantly on touch-down and eases back over 120ms on release. Actions scale to 97% and darken (`ink-press`, `hi-vis-press`, `ink-10` behind outlines; a `danger` label deepens to `foul-ink-press`). Choices scale to 96–98% and tint (`chalk-press` on option rows, big choice and cards, `ink-10` on chips, or `signal-tint-press` on a selected item, whose label deepens to `signal-deep`). A toggle's thumb stretches from 18px to 24px while held. Sliding a finger off cancels; scrolling never presses.
- **Focus.** `ring-focus` (2px signal ring with a 2px paper gap) on `:focus-visible` for keyboards, Switch Control and Full Keyboard Access. Fields use a `signal` border plus `glow-field-focus`.
- **Loading.** The button keeps its width, a spinner replaces the label, taps are blocked, and assistive tech hears the action in progress ("Accepting").
- **Done.** A `court` fill with an ink label and a check ("Accepted", "Live") holds about a second, then the screen moves on. A neutral outcome like "Declined" uses the secondary outline, not green.
- **Disabled.** 40% opacity, always with a short reason nearby ("Add your availability first").
- **Haptics (mobile).** Light impact on choices and toggles, success on Done, warning on errors.

### Layout

The web app is mobile-first by design intent — the signed-in experience renders the same phone-width column as the native app, centered on larger screens, and only spreads into a true desktop layout (side nav + canvas) from 1024px up. Treat "how does this look at 375px" as the primary question for any new screen, not an afterthought.

## Iconography

Use the Feather icon set (see the IconSet component) — 34 glyphs, 24×24, stroke-only, `ink`-colored, round caps and joins. This is the complete icon vocabulary read from source; don't introduce a second icon family or filled-style icons alongside it.

## Alignment & modernization notes

This system was built by reading the actual repository rather than a spec, so it surfaces a few real gaps worth fixing at the source, checked with computed WCAG contrast ratios rather than eyeballed:

**Resolved and landed in code (2026-10-21):** `badge-confirmed` set `court` (#00A85C) as text on paper at **2.38:1**, and `foul` (#E63946) measured 3.19:1 as text and 4.17:1 under a white label. Following the source's own `whistle-ink` precedent, the system adds `court-ink` (#00733F, 4.57:1) and `foul-ink` (#B3202C, 5.09:1). Both Tailwind configs and `apps/mobile/lib/theme.ts` now carry them (with dark values), along with `whistle-ink` on mobile, and every green, red and yellow *text* use in both apps has moved to the `-ink` tokens; the bright tokens remain for fills, dots, icons and borders. Placeholder text moved from `ink-40` (2.32:1 on chalk) to `ink-60`. The Rounded scale and the full interaction-state system (Button, Badge, the TextField kit, the Choice kit, cards) are in `components/ui/` on both platforms.

**Still open:** most screens in both apps hand-roll their own buttons, inputs and choice rows instead of using `components/ui/`, so they don't yet get the rounded corners or the states. Screens should use the shared components; moving the remaining screens over is tracked work, not a reason to restyle raw elements. ESLint now fails any new screen that styles a raw control or writes a hex color; the files that predate the rule are listed in each app's `eslint.design-baseline.json`, which only shrinks.

**Where the tokens live in code:** `packages/design` (`@refee/design`). Both Tailwind configs and the mobile theme read from it, mobile's shared components (Button, Badge, TextField, OptionRow, Chip, BigChoice, Toggle, Card, and the `Tappable` base) render from its per-variant look tables, web's class maps are tested against the same tables, and its tests fail if it drifts from this `tokens.json` or a text/fill pair drops below 4.5:1.

**Pressed contrast:** every pressed label meets 4.5:1. Two tints would dip under it, so their labels deepen while held: `danger` goes to `foul-ink-press` on `ink-10` (5.5:1) and a selected choice's label goes to `signal-deep` on `signal-tint-press` (7.6:1).

Dark mode is tokens-only right now, not yet wired into the shared component layer (`court-ink` and `foul-ink` now have dark values in the configs; the components don't branch on theme yet). `apps/mobile/lib/theme.ts` and both Tailwind configs define a complete dark palette (`dark-paper`, `signal.dark`, `hi-vis.dark`, and so on), but `Button.tsx`, `Badge.tsx` and the `Field.tsx` kit all hard-code the light-mode class names (`bg-ink`, `text-paper`, `bg-hi-vis`) with no `dark:` branching observed in any of the files read for this sync. Concretely: if a screen switches its background to `dark-paper` today, an `ink`-filled `Button` or `badge-live` sitting on it would still render with the light-mode fill, since `ink` itself has no dark-mode override in either Tailwind config (only the more colorful accents — signal, hi-vis, court, whistle, foul — do). Before shipping a real dark mode, the shared `components/ui/` primitives need theme-aware variants, not just theme-aware tokens.

Related to that: the web app's `ink-inv` family (white-based text-on-dark-surface tokens) is defined in `apps/web/tailwind.config.ts` but wasn't found consumed by any component in this sync's read set — it looks like preparation for the dark-mode work above rather than something in active use yet.

A few token values have no documented dark-mode counterpart yet: `paper-3`, `signal-deep`, `signal-tint`, `whistle-ink`, and the three `line`/`line-2`/`line-3` hairline tokens (all web-only) fall back to their light value in dark until the team specs one — flagged individually in `tokens.json`.

## Components in this system

Button, Badge, ZebraRule, Wordmark, the TextField kit, the Choice kit and the IconSet — the full `components/ui/` inventory from both apps that has a visual, reusable form. Mobile's `DropdownSelect` is the native counterpart of `SelectField` and follows the TextField rules (10px corners, `ink-60` placeholder, a `radius-lg` bottom sheet whose rows press to `chalk-press` / `signal-tint-press`). The web landing page's `SectionMark` (a small three-bar stripe next to a mono kicker) is a marketing-only label, a cousin of ZebraRule, and stays square. The staff-only admin kit (`apps/web/components/admin/ui.tsx`: underlined `Tabs`, `Pill`, `Card`, `Note`) is not part of this system but follows its rules: pills are badges (`radius-full`), cards are `radius-lg` (contexts, providers and data hooks under `lib/` were excluded, per the source-defines-the-inventory rule). All seven ship as static renditions, not a live bundle: the source components are React Native/NativeWind (mobile) and Tailwind utility classes (web), neither a plain React-DOM bundle this system can run live, so each preview is the component's real markup and CSS classes (ported into `components/bundle.css`), not a screenshot and not an approximation.
