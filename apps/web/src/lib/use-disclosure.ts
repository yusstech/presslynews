'use client';

import { useEffect, useState } from 'react';

export type DisclosureState = 'open' | 'closing';

interface Disclosure {
  /** Whether the element should be in the DOM at all. */
  mounted: boolean;
  /** Which half of the transition is playing. Drive CSS off this. */
  state: DisclosureState;
}

/**
 * Keeps a conditionally-rendered element mounted long enough to play its exit
 * animation.
 *
 * This is the one thing CSS genuinely cannot do on its own: React unmounts the
 * node the instant `open` flips false, so an exit animation never gets a frame.
 * The hook holds the node for `exitMs` and reports the phase, which is enough
 * to build every overlay transition in the app without an animation library.
 *
 * The phase is derived from `open` rather than stored, so the first painted
 * frame is already the entering one. That works because these are keyframe
 * animations, which run on mount — a transition would need an extra frame at
 * its initial state first.
 *
 * Callers keep their existing shape — `if (!mounted) return null` — and should
 * treat the closing node as decoration: drop its ARIA role and hide it from
 * assistive tech, because a dialog that is fading out is no longer a dialog.
 *
 * `exitMs` must match the CSS exit duration; both come from `motion` in
 * @pressly/config so they can't drift.
 */
export function useDisclosure(open: boolean, exitMs: number): Disclosure {
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    const timer = setTimeout(() => setMounted(false), exitMs);
    return () => clearTimeout(timer);
  }, [open, exitMs]);

  return { mounted, state: open ? 'open' : 'closing' };
}
