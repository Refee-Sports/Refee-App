The REF<EE> lettermark — "REF" set in `ink`, "EE" set in `signal`, both in the display face at heavy weight and tight tracking.

Takes a `size` (px, default 24) and a `mode` (`light` | `dark` | `inverse`) that swaps which literal hex the "REF" portion and the "EE" portion resolve to (the component hard-codes `#08111C`/`#1F4FCC` for light and `#FFFFFF`/`#4F8CFF` for dark, rather than reading the shared `ink`/`signal` tokens — see the alignment note in the system README).

The source component's own comment explains the implementation: React Native has no `-webkit-text-stroke`, so the outlined "EE" treatment seen in the design-reference HTML mockups is approximated here as flat two-tone text rather than a true hollow stroke. For marketing contexts that need the real outlined stroke, the source recommends building it as SVG instead — this system has no such SVG in the codebase yet; the mark used for this system's Logos asset group is the app's `favicon.svg`, a distinct zebra-stripe + ring icon, not the wordmark.

Ported from `apps/mobile/components/ui/Wordmark.tsx` as a static rendition.
