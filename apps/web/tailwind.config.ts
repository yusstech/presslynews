import type { Config } from 'tailwindcss';
import preset from '@pressly/config/tailwind-preset';

const config: Config = {
  presets: [preset],
  content: [
    './src/**/*.{ts,tsx}',
    // Include workspace packages that carry Tailwind classes.
    '../../packages/ui/src/**/*.{ts,tsx}',
    '../../packages/article-renderer/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        // Bind CSS variables set by next/font to the design-system stacks.
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
        arabic: ['var(--font-arabic)', 'serif'],
      },
    },
  },
};

export default config;
