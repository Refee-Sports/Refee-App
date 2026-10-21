A small status pill — mono uppercase text in a 1px outline with `radius-full` corners, used for job/assignment state across both apps. Badges are status, not controls: no hover, pressed or focus state.

Seven variants: `live` (hi-vis fill, ink text/border — an active job or game), `confirmed` (`court-ink` text, transparent), `signal` (signal text, transparent — informational), `warn` (`whistle-ink` text with a `whistle` border, never raw `whistle` text), `foul` (`foul-ink` text — errors and expired items), `neutral` (ink text — default/unset, and the right choice for "Declined"), and `ink` (solid ink fill, paper text — emphasis).

Consumer provides: a `label` string; optionally `pulse` (animates the leading dot — mobile uses Reanimated, web uses a CSS `dot-pulse` keyframe, both omitted from this static rendition; `prefers-reduced-motion: reduce` turns it off in the real apps) and `withDot` (a small leading status dot in the variant's color).

**Alignment note (landed in code 2026-10-21):** `confirmed` used to set raw `court` on paper (2.38:1), `foul` raw `foul` (3.19:1) and `warn` raw `whistle` (1.36:1). All three now use the `-ink` tokens for text and clear 4.5:1; borders keep the bright token.

Ported from `apps/web/components/ui/Badge.tsx` and `apps/mobile/components/ui/Badge.tsx` as a static rendition.
