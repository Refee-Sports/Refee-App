# Refee

## Design system

The Refee design system lives in `docs/design-system/`. Before any UI work:

- Read `docs/design-system/README.md`, and the component's `docs/design-system/components/<Name>/README.md` when touching that component.
- Token values come from `@refee/design` (`packages/design`), which both Tailwind configs and `apps/mobile/lib/theme.ts` read. Never write a hex color, radius or shadow in app code; use the Tailwind class or `palette` from `@refee/design`. Never invent new values.
- Build screens from the shared components in `apps/web/components/ui/` and `apps/mobile/components/ui/` (Button, TextField, OptionRow, Chip, BigChoice, Toggle, Card, Badge). Don't style a raw `<button>`/`<input>` or `Pressable`/`TextInput`; if nothing fits, add a component there. ESLint enforces this for new files.
- Corners follow the Rounded scale: fields 10px, buttons/option rows/big choice 12px, cards 18px, badges/chips/toggles full. ZebraRule stays square.
- Every interactive component needs rest, hover, pressed, focus and disabled states; buttons also need loading and done. Hover is pointer-only: action buttons lift onto the hard shadow, choices get an outline ring. Pressed scales and tints instantly on touch. Focus is the signal ring on `:focus-visible`.
- Green text uses `court-ink`, red text uses `foul-ink`, and yellow text uses `whistle-ink`. Red is only for errors and hard-to-undo actions (cancel a game, remove a ref, drop out of a confirmed game); declining a game offer is neutral (`secondary`).
- Number things only when they're real steps; never fake "live" indicators.
