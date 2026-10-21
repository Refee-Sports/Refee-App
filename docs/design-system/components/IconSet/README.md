The 34 Feather icon glyphs (feathericons.com, MIT license) the apps use, inlined as SVG paths in `Icon.tsx` so the web app renders the identical glyphs the mobile app gets from `@expo/vector-icons` without pulling in an icon package.

Every icon is a 24×24 viewBox, `none` fill, `currentColor` stroke at 2px width, round caps and joins — so on the web it recolors via CSS `color`, and this system's copies are fixed to `ink` since a single-ink SVG can't inherit color once exported as a standalone file (per this system's own asset convention).

The full set, alphabetically: alert-circle, arrow-left, arrow-right, arrow-up, bookmark, calendar, camera, check, check-circle, chevron-down, chevron-left, chevron-right, circle, copy, credit-card, dollar-sign, edit-2, file-text, filter, grid, home, log-out, map-pin, message-square, navigation, plus, search, send, star, upload, user, users, x, zap.

Do: use `search` (not `filter`) for a text-search affordance and `filter` for a facet/sort control — the app keeps that distinction consistently in its jobs-feed screens (per `CURSOR_GUIDE.md`'s screen priority notes).

Assets copied under `assets/Icons/` are fixed to the `ink` stroke color; recolor by applying a CSS filter or by re-exporting from source if a different fixed color is needed for a specific surface.

Ported from `apps/web/components/ui/Icon.tsx`.
