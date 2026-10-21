The brand's signature divider — a repeating striped rule, referenced throughout the codebase's own comments as "the signature divider."

Three color variants (`ink`, `signal`, `hi-vis`) and a `thin` size (4px vs the default 12px). The stripe repeats every 12px, alternating the variant color with transparent — never rounded, never blurred.

Consumer provides: nothing beyond the variant and size props — this is a pure divider, no children or content.

Do: use it as a section break between distinct blocks of content (e.g. above a sticky action bar, between onboarding steps). It's a strong visual signal — the app's own screens use it sparingly.

Ported from `apps/web/components/ui/ZebraRule.tsx` and `apps/mobile/components/ui/ZebraRule.tsx`; also appears as the pattern element on this system's cover.
