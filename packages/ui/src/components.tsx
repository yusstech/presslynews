import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { cn } from './cn';

/**
 * The Pressly design system.
 *
 * These components exist so a design decision is made once. Before this file
 * was filled out the app carried 20 raw `<button>` elements across 18 different
 * hand-written class strings — which meant changing "the button" changed
 * nothing. Reach for a component here rather than assembling utilities; the
 * `no-raw-controls` check in apps/web/scripts enforces it.
 *
 * Design law (Project Atlas): grayscale first. The Midnight Navy accent is for
 * interactive elements only — never decoration.
 */

/** Centered content column at the design-system max width. */
export function Container({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mx-auto w-full max-w-content px-4 sm:px-6', className)} {...props} />;
}

/* ---------------------------------------------------------------- buttons -- */

type ButtonVariant = 'filled' | 'tinted' | 'plain';
type ButtonSize = 'sm' | 'md' | 'lg';

const buttonBase =
  'inline-flex select-none items-center justify-center gap-2 rounded-md font-sans font-medium ' +
  'transition-[background-color,border-color,color,box-shadow,transform] duration-fast ease-editorial ' +
  // The press is acknowledged, not decorated.
  'active:scale-[0.98] disabled:active:scale-100 ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ' +
  'focus-visible:ring-offset-background ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

const buttonVariants: Record<ButtonVariant, string> = {
  /** Primary call to action. One per view. */
  filled: 'bg-accent text-background shadow-card hover:bg-accent-hover hover:shadow-raised',
  /** Secondary: reads as interactive without competing with `filled`. */
  tinted: 'bg-accent/[0.08] text-accent hover:bg-accent/[0.14]',
  /** Tertiary: toolbar and inline actions. */
  plain: 'text-ink hover:bg-ink/[0.06]',
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'h-9 px-3.5 text-ui-sm',
  md: 'h-11 px-5 text-ui',
  lg: 'h-13 px-7 text-body',
};

interface ButtonOwnProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Renders a spinner and blocks input without collapsing the layout. */
  busy?: boolean;
  /** Stretch to the width of the container (forms, mobile). */
  block?: boolean;
}

export function Button({
  variant = 'filled',
  size = 'md',
  busy = false,
  block = false,
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & ButtonOwnProps) {
  return (
    <button
      className={cn(
        buttonBase,
        buttonVariants[variant],
        buttonSizes[size],
        block && 'w-full',
        className,
      )}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...props}
    >
      {busy && <Spinner />}
      {children}
    </button>
  );
}

/** The same surface treatment as Button, for anchors. */
export function ButtonLink({
  variant = 'filled',
  size = 'md',
  block = false,
  className,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & Omit<ButtonOwnProps, 'busy'>) {
  return (
    <a
      className={cn(
        buttonBase,
        buttonVariants[variant],
        buttonSizes[size],
        block && 'w-full',
        className,
      )}
      {...props}
    />
  );
}

const iconSizes: Record<ButtonSize, string> = {
  sm: 'h-9 w-9',
  md: 'h-11 w-11',
  lg: 'h-13 w-13',
};

/** A square, icon-only control. `label` is required — it becomes the a11y name. */
export function IconButton({
  variant = 'plain',
  size = 'md',
  label,
  className,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> &
  Omit<ButtonOwnProps, 'busy' | 'block'> & { label: string }) {
  return (
    <button
      aria-label={label}
      className={cn(buttonBase, buttonVariants[variant], iconSizes[size], 'px-0', className)}
      {...props}
    />
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="2" opacity="0.25" />
      <path d="M14.5 8A6.5 6.5 0 0 0 8 1.5" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

/** A horizontal topic chip (used in the trending strip). */
export function Chip({
  className,
  active,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { active?: boolean }) {
  return (
    <a
      className={cn(
        'inline-flex shrink-0 select-none items-center rounded-full border px-3.5 py-1.5 font-sans text-ui-sm ' +
          'transition-[background-color,border-color,color,transform] duration-fast ease-editorial ' +
          'active:scale-[0.98]',
        active
          ? // The current chip is still a link, so it still answers the pointer.
            'border-accent bg-accent text-background hover:border-accent-hover hover:bg-accent-hover'
          : 'border-border text-ink hover:border-ink/30 hover:bg-ink/[0.03]',
        className,
      )}
      {...props}
    />
  );
}

/* ----------------------------------------------------------------- inputs -- */

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-11 w-full rounded-md border border-border bg-surface px-3.5 font-sans text-ui text-ink',
        'transition-[border-color,box-shadow] duration-fast ease-editorial',
        'placeholder:text-ink-muted hover:border-ink/25',
        'focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'w-full resize-none rounded-md border border-border bg-surface px-3.5 py-2.5',
        'font-sans text-ui text-ink transition-[border-color,box-shadow] duration-fast ease-editorial',
        'placeholder:text-ink-muted hover:border-ink/25',
        'focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  options,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <select
      className={cn(
        'h-11 w-full rounded-md border border-border bg-surface px-3 font-sans text-ui text-ink',
        'transition-[border-color,box-shadow] duration-fast ease-editorial hover:border-ink/25',
        'focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** A checkbox with its label — the two belong together, so they ship together. */
export function Checkbox({
  label,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: string }) {
  return (
    <label className={cn('inline-flex cursor-pointer items-center gap-2.5', className)}>
      <input
        type="checkbox"
        className="h-4 w-4 accent-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        {...props}
      />
      <span className="font-sans text-ui-sm text-ink">{label}</span>
    </label>
  );
}

/** A labelled field. Always render a label — placeholders are not labels. */
export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="font-sans text-ui-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {hint && !error && <p className="font-sans text-caption text-ink-muted">{hint}</p>}
      {error && (
        <p role="alert" className="font-sans text-caption text-error">
          {error}
        </p>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- surfaces -- */

/**
 * A minimal card — pure white, 1px border, no heavy shadow (per spec).
 * `interactive` adds the lift that tells a reader the whole card is a target.
 */
export function Card({
  className,
  interactive = false,
  ...props
}: HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-surface shadow-card',
        interactive &&
          'transition-[border-color,box-shadow,transform] duration-base ease-editorial ' +
            'hover:-translate-y-0.5 hover:border-ink/20 hover:shadow-raised',
        className,
      )}
      {...props}
    />
  );
}

/* ------------------------------------------------------------- typography -- */

/** Small uppercase category / kicker label. */
export function Kicker({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'font-mono text-meta font-medium uppercase text-ink-muted ' +
          'transition-colors duration-fast ease-editorial',
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Reading-time / metadata token rendered in mono (numbers are mono per spec). */
export function Meta({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('font-mono text-caption text-ink-muted', className)}>{children}</span>;
}

/** A section label — the small tracked-out mono heading above a group. */
export function SectionLabel({
  children,
  className,
  as: As = 'h2',
}: {
  children: ReactNode;
  className?: string;
  as?: 'h2' | 'h3';
}) {
  return (
    <As
      className={cn(
        'mb-6 font-mono text-meta font-medium uppercase text-ink-muted',
        className,
      )}
    >
      {children}
    </As>
  );
}
