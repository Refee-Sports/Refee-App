"use client";

import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

// Fields: radius-sm, no hover, signal border + soft glow on focus.
const FIELD =
  "w-full rounded-sm border-[1.5px] bg-chalk px-4 py-3.5 font-mono text-ink outline-none placeholder:text-ink-60 transition-[border-color,box-shadow] duration-[120ms] ease-out focus-visible:border-signal focus-visible:shadow-glow-field-focus motion-reduce:transition-none";

// Choices: "ring to choose" on hover (pointer devices only), instant
// press-in that eases back over 120ms, keyboard-only focus ring.
const CHOICE =
  "transition-[transform,box-shadow,background-color] duration-[120ms] ease-out active:duration-0 focus-visible:outline-none focus-visible:shadow-ring-focus disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:shadow-none disabled:active:scale-100 motion-reduce:transition-none motion-reduce:active:scale-100";
const choiceState = (selected: boolean) =>
  selected
    ? "hover:shadow-ring-hover-selected active:bg-signal-tint-press"
    : "hover:shadow-ring-hover active:bg-chalk-press";

export function Label({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <label
      className={`mb-2 block font-mono-bold text-[9px] uppercase text-ink-60 ${className}`}
      style={{ letterSpacing: 2 }}
    >
      {children}
    </label>
  );
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  error?: string;
  hint?: string;
};

/** The app's StyledInput: squared, chalk fill, 1.5px ink border, mono text. */
export function TextField({ error, hint, className = "", ...props }: FieldProps) {
  return (
    <>
      <input
        {...props}
        className={`${FIELD} disabled:opacity-50 ${error ? "border-foul-ink" : "border-ink"} ${className}`}
        style={{ fontSize: 14, ...props.style }}
      />
      {error ? (
        <p
          className="mt-1 font-mono text-[9px] uppercase text-foul-ink"
          style={{ letterSpacing: 1 }}
        >
          {error}
        </p>
      ) : hint ? (
        <p
          className="mt-1 font-mono text-[9px] uppercase text-ink-60"
          style={{ letterSpacing: 1 }}
        >
          {hint}
        </p>
      ) : null}
    </>
  );
}

export function TextArea({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`${FIELD} border-ink ${className}`}
      style={{ fontSize: 14, ...props.style }}
    />
  );
}

/** Input with an ink-filled affix, e.g. the "$" on min pay or "MI" on radius. */
export function AffixField({
  prefix,
  suffix,
  hint,
  ...props
}: FieldProps & { prefix?: string; suffix?: string }) {
  return (
    <>
      <div className="flex overflow-hidden rounded-sm border-[1.5px] border-ink transition-[border-color,box-shadow] duration-[120ms] ease-out focus-within:border-signal focus-within:shadow-glow-field-focus motion-reduce:transition-none">
        {prefix ? (
          <span className="flex items-center justify-center bg-ink px-4">
            <span
              className="font-mono-bold text-base text-paper"
              style={{ letterSpacing: 0.5 }}
            >
              {prefix}
            </span>
          </span>
        ) : null}
        <input
          {...props}
          className="min-w-0 flex-1 bg-chalk px-4 py-3.5 font-mono text-ink outline-none placeholder:text-ink-60"
          style={{ fontSize: 14, ...props.style }}
        />
        {suffix ? (
          <span className="flex items-center justify-center bg-ink px-4">
            <span
              className="font-mono-bold text-sm text-paper"
              style={{ letterSpacing: 0.5 }}
            >
              {suffix}
            </span>
          </span>
        ) : null}
      </div>
      {hint ? (
        <p
          className="mt-1.5 font-mono text-[9px] uppercase text-ink-60"
          style={{ letterSpacing: 1.2 }}
        >
          {hint}
        </p>
      ) : null}
    </>
  );
}

/** A selectable option row — used for sports, certs, levels, rulesets. */
export function OptionRow({
  label,
  sublabel,
  selected,
  onClick,
  dim = false,
}: {
  label: string;
  sublabel?: string;
  selected: boolean;
  onClick: () => void;
  /** Use the lighter unselected border (the levels list). */
  dim?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex w-full items-center justify-between rounded-md border-[1.5px] px-4 py-3.5 text-left active:scale-[0.98] ${CHOICE} ${choiceState(selected)} ${
        selected
          ? "border-signal bg-signal/10"
          : `${dim ? "border-ink-20" : "border-ink"} bg-chalk`
      }`}
    >
      <span className="flex-1 pr-3">
        <span
          className={`block font-mono-bold text-sm ${selected ? "text-signal" : "text-ink"}`}
          style={{ letterSpacing: 1 }}
        >
          {label}
        </span>
        {sublabel ? (
          <span
            className={`mt-0.5 block truncate font-mono text-[9px] ${
              selected ? "text-signal/70" : "text-ink-60"
            }`}
            style={{ letterSpacing: 0.5 }}
          >
            {sublabel}
          </span>
        ) : null}
      </span>
      {selected && <span className="font-mono-bold text-base text-signal">✓</span>}
    </button>
  );
}

/** Native select styled like the app's DropdownSelect. */
export function SelectField({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { id: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${FIELD} appearance-none border-ink`}
        style={{ fontSize: 14 }}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 font-mono-bold text-ink-60">
        ▾
      </span>
    </div>
  );
}

/** Section divider heading used across the director create/edit forms. */
export function SectionLabel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={`mb-4 border-b border-ink-20 pb-2 font-mono-bold text-[9px] uppercase text-ink ${className}`}
      style={{ letterSpacing: 2.5 }}
    >
      ── {children}
    </h2>
  );
}

/** Native date input, styled to match the app's calendar picker output. */
export function DateField({
  value,
  onChange,
  min,
  max,
}: {
  value: string;
  onChange: (v: string) => void;
  min?: string;
  max?: string;
}) {
  return (
    <input
      type="date"
      value={value}
      min={min}
      max={max}
      onChange={(e) => onChange(e.target.value)}
      className={`${FIELD} border-ink`}
      style={{ fontSize: 14 }}
    />
  );
}

/** Wrapping chip row — rulesets, crew size, levels. */
export function ChipRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-1.5">{children}</div>;
}

export function Chip({
  label,
  selected,
  onClick,
  disabled,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={`rounded-full border-[1.5px] px-4 py-3 active:scale-[0.96] ${CHOICE} ${choiceState(selected)} ${
        selected ? "border-signal bg-signal/10" : "border-ink-20 bg-chalk"
      }`}
    >
      <span
        className={`font-mono text-[11px] ${
          selected ? "font-mono-bold text-signal" : "text-ink"
        }`}
        style={{ letterSpacing: 1 }}
      >
        {label}
      </span>
    </button>
  );
}

/** The big numeric picker used for 4 QUARTERS / 2 HALVES and crew size. */
export function BigChoice({
  num,
  label,
  selected,
  onClick,
}: {
  num: string;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex flex-1 flex-col items-center rounded-md border-[1.5px] py-4 active:scale-[0.97] ${CHOICE} ${choiceState(selected)} ${
        selected ? "border-signal bg-signal/10" : "border-ink bg-chalk"
      }`}
    >
      <span
        className={`font-display ${selected ? "text-signal" : "text-ink"}`}
        style={{ fontSize: 28, letterSpacing: -1 }}
      >
        {num}
      </span>
      <span
        className={`font-mono-bold text-[9px] uppercase ${
          selected ? "text-signal/70" : "text-ink-40"
        }`}
        style={{ letterSpacing: 2 }}
      >
        {label}
      </span>
    </button>
  );
}

/** The app's Switch, as an accessible toggle button. */
export function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`group relative h-6 w-11 shrink-0 rounded-full border border-ink transition-[box-shadow] duration-[120ms] ease-out focus-visible:outline-none focus-visible:shadow-ring-focus disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:shadow-none motion-reduce:transition-none ${
        checked ? "bg-ink hover:shadow-ring-hover-selected" : "bg-ink/15 hover:shadow-ring-hover"
      }`}
    >
      {/* Anchored to the side it rests on, so stretching while held grows it
          toward the middle: 18px → 24px. */}
      <span
        className="absolute top-[2px] h-[18px] w-[18px] rounded-full transition-[width] duration-[120ms] ease-out group-active:w-6 group-active:duration-0 motion-reduce:transition-none group-disabled:w-[18px]"
        style={{
          ...(checked ? { right: 2 } : { left: 2 }),
          backgroundColor: checked ? "#C9F031" : "#E5E1D6",
        }}
      />
    </button>
  );
}
