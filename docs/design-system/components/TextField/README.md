The form-field kit — chalk-filled inputs with 10px corners (`radius-sm`), a 1.5px ink border and a mono uppercase label above. Fields have no hover state; on focus the border turns `signal` with the `glow-field-focus` halo, so focus never looks like a hover ring. Error text and borders use `foul-ink`; placeholders use `ink-60`.

Pieces: `Label` (the standalone uppercase caption), `TextField` (single-line input, with optional `error`/`hint` text below), `TextArea` (multi-line, same treatment), `AffixField` (an input with an ink-filled prefix or suffix block — used for "$" on minimum pay or "MI" on search radius), `SelectField` (native select styled to match, with a mono ▾ indicator), and `DateField` (native date input, same border and fill treatment).

Consumer provides: standard input props (`value`, `onChange`, `placeholder`) plus `error` (switches the border to `foul-ink` and shows `foul-ink` hint text) or `hint` (shows muted `ink-60` helper text) — never both at once. Disabled fields drop to 40% opacity like every other control.

Do: pair every field with a `Label` above it. Keep `hint` text to one short line — the type scale here caps at 9px uppercase, which doesn't hold long sentences well.

Don't: rely on placeholder text as a label substitute — beyond the accessibility issue, the placeholder color itself has a contrast problem (see the system README's alignment notes on `ink-40`).

Ported from `apps/web/components/ui/Field.tsx` (`Label`, `TextField`, `TextArea`, `AffixField`, `SelectField`, `DateField`) as a static rendition; these are web-only in the source. On mobile, `DropdownSelect` (`apps/mobile/components/ui/DropdownSelect.tsx`) is the select counterpart and follows the same rules; mobile text inputs are still built inline per screen.
