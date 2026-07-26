'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from '@pressly/ui';
import { CommandPalette } from './command-palette';

/** The search entry point in the header + the global ⌘K shortcut. */
export function SearchTrigger() {
  const t = useTranslations('search');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <Button
        variant="plain"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label={t('placeholder')}
        className="border border-border text-ink-muted hover:border-ink/30 hover:text-ink"
      >
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
          <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" />
          <path d="M14 14L18 18" stroke="currentColor" strokeWidth="1.6" />
        </svg>
        <kbd className="hidden font-mono text-meta sm:block">⌘K</kbd>
      </Button>
      <CommandPalette open={open} onClose={() => setOpen(false)} />
    </>
  );
}
