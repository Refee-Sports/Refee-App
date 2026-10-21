Selection controls for the app's option-heavy screens — sports, certifications, levels, rulesets, crew size.

Pieces: `OptionRow` (a full-width selectable row with label + sublabel, `radius-md` — has a `dim` prop for a lighter unselected border), `Chip`/`ChipRow` (wrapping pill filters, `radius-full`), `BigChoice` (the large numeral picker, `radius-md`), and `Toggle` (an accessible pill switch built from a plain button with `role="switch"`, not a native checkbox: a 50×28 track, `ink-10` off and `ink` on, with an 18px thumb inset 4px, `paper` off and `hi-vis` on).

Chips are the light member: a 1px `ink-20` outline on a transparent fill with an `ink-60` mono-bold 10px label. Selected state is consistent across all four: a `signal` border plus a `signal-tint` background wash, and the label recolors to `signal`. This is the one selection idiom in the whole system.

States — "ring to choose":
- **Hover** (pointer devices only): `ring-hover`, or `ring-hover-selected` on a selected item. No movement.
- **Pressed**: chips and big choice scale to 96%, option rows and cards to 98%, with a `chalk-press` (or `ink-10` on chips) tint; a selected item presses to `signal-tint-press`. A toggle's thumb stretches to 24px while held. Releasing commits the selection; sliding off cancels.
- **Focus**: `ring-focus` on `:focus-visible`.
- **Disabled**: 40% opacity.
- **Haptics (mobile)**: light impact on select and on toggle.

Consumer provides: `selected`/`checked` boolean state and an `onClick`/`onChange` handler; `OptionRow`, `Chip`, `BigChoice` and `Toggle` also take `disabled`.

Originally ported from `apps/web/components/ui/Field.tsx` (`OptionRow`, `ChipRow`, `Chip`, `BigChoice`, `Toggle`); the rounded corners and the state system were designed on 2026-10-20 and landed in `Field.tsx` on 2026-10-21. Mobile has no shared Choice components yet; its screens build these inline.
