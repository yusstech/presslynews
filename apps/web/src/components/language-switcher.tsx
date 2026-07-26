'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState, useRef, useEffect } from 'react';
import { motion } from '@pressly/config/tokens';
import { LOCALES, LOCALE_NATIVE_NAMES, type Locale } from '@pressly/types';
import { cn } from '@pressly/ui';
import { usePathname, useRouter } from '@/i18n/navigation';
import { useDisclosure } from '@/lib/use-disclosure';

/**
 * A quiet language switcher. Geo picks a first guess; this always lets the
 * reader override it, and next-intl persists the choice in the NEXT_LOCALE
 * cookie so it survives future visits.
 */
export function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const t = useTranslations('language');
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // Hold the menu in the DOM while it animates out; `closing` drives the CSS.
  const { mounted, state } = useDisclosure(open, motion.ms.fast);
  const closing = state === 'closing';

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    // A keyboard user needs a way out of the menu that isn't a mouse click.
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  function choose(next: Locale) {
    setOpen(false);
    if (next !== locale) router.replace(pathname, { locale: next });
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        // Without this a screen reader announces only "EN, button".
        aria-label={t('change')}
        className={cn(
          'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-mono text-xs uppercase',
          'tracking-wide text-ink-muted transition-colors duration-fast hover:text-ink',
        )}
      >
        {locale}
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden fill="none">
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </button>

      {mounted && (
        <ul
          // Like the palette, a menu on its way out is no longer a listbox —
          // dropping the role first keeps it out of the accessibility tree
          // (and out of the a11y check's `[role="listbox"]` count) at once.
          role={closing ? undefined : 'listbox'}
          aria-hidden={closing || undefined}
          className={cn(
            'absolute end-0 z-50 mt-2 w-40 overflow-hidden rounded-lg border',
            'border-border bg-surface shadow-card',
            closing ? 'pointer-events-none animate-menu-out' : 'animate-menu-in',
          )}
        >
          {LOCALES.map((l) => (
            <li key={l}>
              <button
                type="button"
                role="option"
                aria-selected={l === locale}
                onClick={() => choose(l)}
                className={cn(
                  'flex w-full items-center justify-between px-3.5 py-2.5 text-start font-sans text-sm',
                  'transition-colors duration-fast hover:bg-border/40',
                  l === locale ? 'text-ink' : 'text-ink-muted',
                )}
              >
                <span className={l === 'ar' ? 'font-arabic' : undefined}>
                  {LOCALE_NATIVE_NAMES[l]}
                </span>
                <span className="font-mono text-xs uppercase">{l}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
