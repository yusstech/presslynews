'use client';

import { useEffect, useState } from 'react';

/** A persistent, quiet reading-progress bar pinned under the header. */
export function ReadingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    function onScroll() {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(scrollable > 0 ? Math.min(1, window.scrollY / scrollable) : 0);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <div
      className="sticky z-30 h-0.5 w-full bg-transparent"
      style={{ top: 'var(--header-h)' }}
      aria-hidden
    >
      {/* Scaling a full-width bar keeps this on the compositor. Animating
          `width` instead forces layout on every scroll frame, which is what
          made the bar visibly lag behind fast scrolling. `.progress-bar` sets
          the transform origin and flips it for RTL. */}
      <div
        className="progress-bar h-full w-full bg-accent transition-transform duration-fast ease-editorial"
        style={{ transform: `scaleX(${progress})` }}
      />
    </div>
  );
}
