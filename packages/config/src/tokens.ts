/**
 * Pressly design tokens — the single source of truth for the visual system.
 * Values are taken verbatim from the UI/UX spec ("Project Atlas").
 *
 * Design law: build grayscale-first. The accent (Midnight Navy) is ONLY for
 * interactive elements (buttons, links, focus) — never decorative.
 */

export const color = {
  /** Warm white — the page background. NEVER pure white for the page. */
  background: '#FAFAF8',
  /** Pure white — cards only, with a 1px border and no heavy shadow. */
  surface: '#FFFFFF',
  /** Rich black — primary text. */
  ink: '#111111',
  /** Secondary text. */
  inkMuted: '#666666',
  /** Hairline borders. */
  border: '#E8E8E8',
  /** Midnight Navy — interactive only. */
  accent: '#16213E',
  accentHover: '#24345F',
  /** Feedback — all muted, never loud. */
  error: '#B4423A',
  success: '#3F7A52',
  warning: '#C9902B',
} as const;

/** 8pt spacing scale. Avoid arbitrary spacing — whitespace creates hierarchy. */
export const spacing = {
  0: '0px',
  1: '4px',
  2: '8px',
  3: '16px',
  4: '24px',
  5: '32px',
  6: '40px',
  7: '48px',
  8: '64px',
  9: '80px',
  10: '96px',
} as const;

export const font = {
  /** Headlines — bold, large, elegant. */
  serif: ['"Newsreader"', 'Georgia', 'serif'],
  /** Body — 18–20px, line-height 1.8, max width 700px. */
  sans: ['"Inter"', 'system-ui', 'sans-serif'],
  /** Numbers, dates, live updates, reading time, analytics. */
  mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
  /** Arabic (RTL). Newsreader/Inter don't cover Arabic. */
  arabic: ['"IBM Plex Sans Arabic"', '"Noto Naskh Arabic"', 'serif'],
} as const;

/**
 * The type scale. Every size in the product comes from here — before this
 * existed the app carried 11 ad-hoc sizes (including `text-[10px]` fifteen
 * times), which is why nothing felt like one system.
 *
 * Steps are named for their role, not their size, so a component asks for
 * "h2" rather than guessing at rem values.
 */
export const type = {
  /** Home hero only. One per page, at most. */
  display: ['3.5rem', { lineHeight: '1.05', letterSpacing: '-0.02em' }],
  h1: ['2.75rem', { lineHeight: '1.12', letterSpacing: '-0.015em' }],
  h2: ['2rem', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
  h3: ['1.5rem', { lineHeight: '1.3' }],
  h4: ['1.25rem', { lineHeight: '1.35' }],
  /** Standfirst / lede under a headline. */
  lede: ['1.375rem', { lineHeight: '1.6' }],
  /** Article body — 18–20px at line-height 1.8 per the spec. */
  body: ['1.1875rem', { lineHeight: '1.8' }],
  'body-lg': ['1.25rem', { lineHeight: '1.8' }],
  /** UI text: labels, buttons, nav. */
  ui: ['0.9375rem', { lineHeight: '1.5' }],
  'ui-sm': ['0.875rem', { lineHeight: '1.45' }],
  /** Captions and secondary notes. */
  caption: ['0.8125rem', { lineHeight: '1.45' }],
  /**
   * Kickers, reading time, dates — always mono, always tracked out.
   * 12px is the floor: the responsive sweep flagged the previous 11px (and the
   * 10px badges) as below comfortable reading size, and tracked-out uppercase
   * is harder to read than its size suggests, not easier.
   */
  meta: ['0.75rem', { lineHeight: '1.4', letterSpacing: '0.12em' }],
} as const;

/**
 * Elevation. The spec says cards use borders, not heavy shadows — so this is a
 * restrained scale, but it is a scale: depth is how the design gets dimension
 * without adding colour, which the grayscale-first brief rules out.
 */
export const elevation = {
  /** Resting card. Barely there. */
  sm: '0 1px 2px rgba(17, 17, 17, 0.04)',
  /** Hovered card / raised surface. */
  md: '0 2px 4px rgba(17, 17, 17, 0.05), 0 6px 16px rgba(17, 17, 17, 0.06)',
  /** Overlays: command palette, menus. */
  lg: '0 8px 24px rgba(17, 17, 17, 0.08), 0 2px 6px rgba(17, 17, 17, 0.04)',
} as const;

export const layout = {
  /** Maximum reading measure for article body. */
  readingWidth: '700px',
  /** Desktop content max width (12-col grid). */
  contentWidth: '1440px',
  radius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
  },
} as const;

export const motion = {
  /** Motion communicates; it never decorates. Keep it 150–300ms. */
  fast: '150ms',
  base: '220ms',
  slow: '300ms',
  ease: 'cubic-bezier(0.2, 0.0, 0.2, 1)',
  /**
   * The same durations as numbers, for JS that has to agree with the CSS —
   * chiefly delayed unmounts, where a component must stay mounted for exactly
   * as long as its exit animation runs.
   */
  ms: {
    fast: 150,
    base: 220,
    slow: 300,
  },
} as const;

export const tokens = { color, spacing, font, type, elevation, layout, motion } as const;
export type Tokens = typeof tokens;
