"use client";

import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

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
        className={`w-full border-[1.5px] bg-chalk px-4 py-3.5 font-mono text-ink outline-none placeholder:text-ink-40 focus-visible:shadow-[3px_3px_0_var(--signal)] disabled:opacity-50 ${
          error ? "border-foul" : "border-ink"
        } ${className}`}
        style={{ fontSize: 14, ...props.style }}
      />
      {error ? (
        <p
          className="mt-1 font-mono text-[9px] uppercase text-foul"
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
      className={`w-full border-[1.5px] border-ink bg-chalk px-4 py-3.5 font-mono text-ink outline-none placeholder:text-ink-40 focus-visible:shadow-[3px_3px_0_var(--signal)] ${className}`}
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
      <div className="flex border-[1.5px] border-ink">
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
          className="min-w-0 flex-1 bg-chalk px-4 py-3.5 font-mono text-ink outline-none placeholder:text-ink-40"
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
      className={`flex w-full items-center justify-between border-[1.5px] px-4 py-3.5 text-left hover:opacity-80 ${
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
        className="w-full appearance-none border-[1.5px] border-ink bg-chalk px-4 py-3.5 font-mono text-ink outline-none focus-visible:shadow-[3px_3px_0_var(--signal)]"
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
      className="w-full border-[1.5px] border-ink bg-chalk px-4 py-3.5 font-mono text-ink outline-none focus-visible:shadow-[3px_3px_0_var(--signal)]"
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
      className={`border-[1.5px] px-4 py-3 hover:opacity-80 disabled:opacity-40 ${
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
      className={`flex flex-1 flex-col items-center border-[1.5px] py-4 hover:opacity-80 ${
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
      className={`relative h-6 w-11 shrink-0 border border-ink disabled:opacity-60 ${
        checked ? "bg-ink" : "bg-ink/15"
      }`}
    >
      <span
        className="absolute top-[2px] h-[18px] w-[18px]"
        style={{
          left: checked ? 22 : 2,
          backgroundColor: checked ? "#C9F031" : "#E5E1D6",
        }}
      />
    </button>
  );
}
