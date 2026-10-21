The call-to-action control — 12px corners (`radius-md`), uppercase mono label, an optional trailing arrow, with a full set of hover, pressed, focus, loading, done and disabled states.

Variants: `primary` (ink fill, paper label — the default), `hi-vis` (hi-vis fill, ink label and border — the loudest CTA), `secondary` (ink outline, transparent fill — Decline, Cancel), `danger` (`foul-ink` outline and label) and `danger-fill` (`foul-ink` fill, white label) for destructive, hard-to-undo actions, and `court` (court fill, ink label) for the Done / confirmed state. Every variant is at least 48px tall.

States:
- **Hover** (pointer devices only): lifts 2px up-left onto the `hard` shadow — "lift to act".
- **Pressed**: scales to 97% instantly; primary darkens to `ink-press`, hi-vis to `hi-vis-press`, outlines fill with `ink-10`, and a `danger` label deepens to `foul-ink-press` so it stays above 4.5:1. No shadow on touch.
- **Focus**: `ring-focus` on `:focus-visible`.
- **Loading**: width held, spinner replaces the label, taps blocked, accessible label announces the action ("Accepting").
- **Done**: `court` variant with a check and past-tense label ("Accepted", "Live"), held about a second. "Declined" uses `secondary`, not green.
- **Disabled**: 40% opacity plus a short reason nearby.

Consumer provides: a `label` string, an `onClick`/`onPress` handler, and optionally `variant`, `disabled`, `loading`, `done`, `showArrow`, `fullWidth`, and a leading `icon` node. Mobile also fires haptics: light on press, success on done.

Do: keep labels short; the component uppercases them. Reserve `hi-vis` for the one primary action on a screen. Use `danger` only for actions that can't easily be undone — cancelling a game, removing a ref from a crew, leaving a crew, dropping out of a game you're confirmed for.

Don't: make Decline red — declining a game is a normal choice and uses `secondary`. Don't stack two `hi-vis` buttons on one screen. Don't put a `court` Done button next to `hi-vis`; they compete.

Originally ported from `apps/web/components/ui/AppButton.tsx` and `apps/mobile/components/ui/Button.tsx`; the rounded corners and the state system were designed on 2026-10-20 and landed in both components on 2026-10-21. Use these components rather than styling a raw `<button>` / `Pressable`.
