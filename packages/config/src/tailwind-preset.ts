import type { Config } from 'tailwindcss';
import { color, elevation, font, layout, motion, spacing, type } from './tokens';

/**
 * Shared Tailwind preset. Both apps/web and packages/ui extend this so the
 * design system stays consistent everywhere.
 */
const preset: Omit<Config, 'content'> = {
  theme: {
    // Replace the default palette entirely — Pressly's system is deliberate and small.
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      background: color.background,
      surface: color.surface,
      ink: {
        DEFAULT: color.ink,
        muted: color.inkMuted,
      },
      border: color.border,
      accent: {
        DEFAULT: color.accent,
        hover: color.accentHover,
      },
      error: color.error,
      success: color.success,
      warning: color.warning,
    },
    /**
     * Spacing and radius are EXTENDED, never replaced.
     *
     * They used to be replaced with an 11-step 8pt scale. That silently
     * redefined what every Tailwind number means (`p-3` became 16px, not 12px)
     * and deleted every step outside 0–10 — so `h-11` on every button, `h-16`
     * on the header, `h-0.5` on the reading-progress bar, `rounded-xl`,
     * `rounded-full` and `divide-y` all compiled to nothing. 35 classes across
     * the app were dead, which is why the layout read as unbalanced and the
     * buttons as too small.
     *
     * Tailwind's own scale is already 4px-based, so it satisfies the spec's 8pt
     * rule by using even steps. Discipline comes from review, not from deleting
     * the scale out from under the markup.
     */
    fontFamily: {
      serif: font.serif,
      sans: font.sans,
      mono: font.mono,
      arabic: font.arabic,
    },
    extend: {
      // The Atlas radii, layered over Tailwind's — so `rounded-full` (pills,
      // badges) and `rounded` still exist.
      borderRadius: layout.radius,
      // Semantic 8pt steps, available by name alongside the numeric scale.
      spacing: {
        13: '3.25rem', // 52px — the large control height; Tailwind skips 13
        section: spacing[8], // 64px — between major page sections
        gutter: spacing[4], // 24px — inside panels and cards
      },
      maxWidth: {
        reading: layout.readingWidth,
        content: layout.contentWidth,
      },
      // The full type scale, from tokens. Components name a role (`text-h2`),
      // never a raw size — Tailwind's numeric sizes stay available but the
      // design-system guard flags new ad-hoc use.
      fontSize: type,
      transitionTimingFunction: {
        editorial: motion.ease,
      },
      transitionDuration: {
        fast: motion.fast,
        base: motion.base,
        slow: motion.slow,
      },
      boxShadow: {
        // Cards use borders, not heavy shadows — but depth still needs a scale,
        // because it's how this design gets dimension without adding colour.
        card: elevation.sm,
        raised: elevation.md,
        overlay: elevation.lg,
      },
      /**
       * Motion vocabulary. Only opacity and transform are ever animated, so
       * every one of these stays on the compositor and never triggers layout.
       *
       * Entrances move on Y only — never X — so they read identically in LTR
       * and RTL without a mirrored variant.
       */
      keyframes: {
        // The content entrance: things arrive from just below where they land.
        rise: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'none' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-out': {
          from: { opacity: '1' },
          to: { opacity: '0' },
        },
        // Overlay panels (⌘K) drop in from above their resting position.
        'panel-in': {
          from: { opacity: '0', transform: 'translateY(-8px) scale(0.98)' },
          to: { opacity: '1', transform: 'none' },
        },
        'panel-out': {
          from: { opacity: '1', transform: 'none' },
          to: { opacity: '0', transform: 'translateY(-4px) scale(0.99)' },
        },
        // Menus are smaller, so they move less and carry no scale.
        'menu-in': {
          from: { opacity: '0', transform: 'translateY(-4px)' },
          to: { opacity: '1', transform: 'none' },
        },
        'menu-out': {
          from: { opacity: '1', transform: 'none' },
          to: { opacity: '0', transform: 'translateY(-4px)' },
        },
      },
      animation: {
        rise: `rise ${motion.base} ${motion.ease} both`,
        'fade-in': `fade-in ${motion.fast} ${motion.ease} both`,
        'fade-out': `fade-out ${motion.fast} ${motion.ease} both`,
        'panel-in': `panel-in ${motion.base} ${motion.ease} both`,
        'panel-out': `panel-out ${motion.fast} ${motion.ease} both`,
        'menu-in': `menu-in ${motion.fast} ${motion.ease} both`,
        'menu-out': `menu-out ${motion.fast} ${motion.ease} both`,
      },
    },
  },
  plugins: [],
};

export default preset;
