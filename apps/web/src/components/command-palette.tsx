'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from '@pressly/config/tokens';
import { cn } from '@pressly/ui';
import { useRouter } from '@/i18n/navigation';
import { useDisclosure } from '@/lib/use-disclosure';

interface Hit {
  id: string;
  slug: string;
  headline: string;
  countryName: string | null;
  topicName: string | null;
  language: string;
}

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * ⌘K command palette — the primary way to move around Pressly. Backed by
 * Meilisearch (fast, typo-tolerant, multilingual); results appear instantly.
 */
export function CommandPalette({ open, onClose }: Props) {
  const t = useTranslations('search');
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Hit[]>([]);
  const [active, setActive] = useState(0);
  // Hold the palette in the DOM while it animates out; `closing` drives the CSS.
  const { mounted, state } = useDisclosure(open, motion.ms.fast);
  const closing = state === 'closing';

  useEffect(() => {
    if (open) {
      // Remember where focus came from so closing returns the user there.
      restoreFocusRef.current = document.activeElement as HTMLElement | null;
      setQuery('');
      setResults([]);
      setActive(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      restoreFocusRef.current?.focus();
    }
  }, [open]);

  /**
   * A dialog that declares aria-modal must actually behave like one: Escape
   * closes it from anywhere inside, and Tab cycles within it rather than
   * wandering into the page behind.
   */
  useEffect(() => {
    if (!open) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'input, button, [href], [tabindex]:not([tabindex="-1"])',
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`${API}/api/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        const data = (await res.json()) as Hit[];
        setResults(Array.isArray(data) ? data : []);
        setActive(0);
      } catch {
        /* aborted */
      }
    }, 120);
    return () => {
      clearTimeout(id);
      controller.abort();
    };
  }, [query]);

  const go = useCallback(
    (hit: Hit) => {
      onClose();
      router.push(`/article/${hit.slug}`);
    },
    [onClose, router],
  );

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, Math.max(results.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const chosen = results[active];
      if (chosen) go(chosen);
      else if (query.trim()) {
        onClose();
        router.push(`/search?q=${encodeURIComponent(query)}`);
      }
    }
    // Escape is handled by the dialog-level listener, so it works from any
    // element inside the palette rather than only from this input.
  }

  if (!mounted) return null;

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-start justify-center bg-ink/20 px-4 pt-[12vh] backdrop-blur-sm',
        closing ? 'pointer-events-none animate-fade-out' : 'animate-fade-in',
      )}
      onMouseDown={onClose}
      // While it animates out this is decoration, not a dialog: the role and
      // modal semantics go first, so assistive tech (and the keyboard a11y
      // check, which queries [role="dialog"]) see it as closed immediately
      // rather than racing the exit animation.
      role={closing ? undefined : 'dialog'}
      aria-modal={closing ? undefined : true}
      aria-hidden={closing || undefined}
      aria-label={t('placeholder')}
    >
      <div
        ref={dialogRef}
        className={cn(
          'w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-surface shadow-card',
          closing ? 'animate-panel-out' : 'animate-panel-in',
        )}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-border px-4">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
            <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" className="text-ink-muted" />
            <path d="M14 14L18 18" stroke="currentColor" strokeWidth="1.6" className="text-ink-muted" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t('placeholder')}
            aria-label={t('placeholder')}
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls="palette-results"
            aria-activedescendant={results[active] ? `palette-hit-${results[active].id}` : undefined}
            className="h-14 flex-1 bg-transparent font-sans text-base text-ink outline-none placeholder:text-ink-muted"
          />
          <kbd className="hidden rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-ink-muted sm:block">
            ESC
          </kbd>
        </div>

        {query.trim() && results.length === 0 && (
          <div className="px-4 py-8 text-center">
            <p className="font-serif text-lg text-ink">{t('noResultsTitle')}</p>
            <p className="mt-1 font-sans text-sm text-ink-muted">{t('noResultsBody')}</p>
          </div>
        )}

        {/* Typing changes results silently for sighted users; a screen reader
            needs the count announced. */}
        <p aria-live="polite" className="sr-only">
          {results.length > 0 ? t('resultCount', { count: results.length }) : ''}
        </p>

        {results.length > 0 && (
          <ul id="palette-results" role="listbox" className="max-h-[50vh] overflow-y-auto py-2">
            {results.map((r, i) => (
              <li key={r.id} role="presentation">
                <button
                  id={`palette-hit-${r.id}`}
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(r)}
                  className={cn(
                    'flex w-full flex-col items-start gap-1 px-4 py-3 text-start transition-colors duration-fast',
                    i === active ? 'bg-border/40' : 'hover:bg-border/25',
                  )}
                >
                  <span className="font-mono text-[10px] uppercase tracking-widest text-ink-muted">
                    {[r.countryName, r.topicName].filter(Boolean).join(' · ')}
                  </span>
                  <span className={cn('font-serif text-base leading-snug text-ink', r.language === 'ar' && 'font-arabic')}>
                    {r.headline}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
