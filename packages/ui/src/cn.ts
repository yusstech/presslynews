import clsx, { type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';
import { type as typeScale } from '@pressly/config/tokens';

/**
 * tailwind-merge has to be told about our custom font-size scale.
 *
 * It resolves conflicts by class group, and it infers the group from the class
 * name. Out of the box it knows `text-sm` is a size and `text-ink` is a colour
 * — but `text-ui`, `text-meta` and `text-h3` are ours, so it guessed "colour"
 * and treated them as conflicting with real colours.
 *
 * The effect was silent and ugly: in `cn('bg-accent text-background', 'text-ui')`
 * it dropped `text-background`, so the primary button rendered black-on-navy
 * and failed WCAG contrast. `Kicker` lost its font size the same way. Any
 * component mixing a size and a colour through `cn()` was affected.
 *
 * Deriving the list from the tokens means adding a step to the scale can't
 * reintroduce the bug.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: Object.keys(typeScale) }],
    },
  },
});

/** Merge Tailwind classes with correct override precedence. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
