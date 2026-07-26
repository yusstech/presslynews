'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ArticleStatus } from '@pressly/types';
import { ARTICLE_TYPES, LOCALES, LOCALE_NATIVE_NAMES } from '@pressly/types';
import { Button, Checkbox, Container, Field, Input, Select, Textarea } from '@pressly/ui';
import { api, ApiError } from '@/lib/api';
import { Link } from '@/i18n/navigation';
import { useAuth } from '@/newsroom/auth-context';
import { RequireAuth } from '@/newsroom/require-auth';
import { StatusBadge } from '@/newsroom/status-badge';
import { ArticleEditor } from '@/newsroom/editor';
import { HeroImageField } from '@/newsroom/hero-image';
import { availableTransitions, TRANSITION_LABELS } from '@/newsroom/workflow';
import type { NewsroomArticle, NewsroomMedia } from '@/newsroom/types';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';
type Taxo = { id: string; name: string; code?: string; slug?: string };

export default function EditorPage() {
  return (
    <RequireAuth>
      <Editor />
    </RequireAuth>
  );
}

function Editor() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [article, setArticle] = useState<NewsroomArticle | null>(null);
  const [countries, setCountries] = useState<Taxo[]>([]);
  const [topics, setTopics] = useState<Taxo[]>([]);
  const [save, setSave] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);

  const pending = useRef<Record<string, unknown>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Promise.all([
      api<NewsroomArticle>(`/newsroom/articles/${id}`),
      api<Taxo[]>('/taxonomy/countries'),
      api<Taxo[]>('/taxonomy/topics'),
    ]).then(([a, c, t]) => {
      setArticle(a);
      setCountries(c);
      setTopics(t);
    });
  }, [id]);

  const flush = useCallback(async () => {
    if (Object.keys(pending.current).length === 0) return;
    const payload = pending.current;
    pending.current = {};
    setSave('saving');
    try {
      const updated = await api<NewsroomArticle>(`/newsroom/articles/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      setArticle((prev) => (prev ? { ...prev, ...updated } : updated));
      setSave('saved');
    } catch (err) {
      setSave('error');
      setError(err instanceof ApiError ? err.message : 'Save failed');
    }
  }, [id]);

  // Merge a change locally and debounce a save.
  const patch = useCallback(
    (change: Partial<NewsroomArticle>) => {
      setArticle((prev) => (prev ? { ...prev, ...change } : prev));
      Object.assign(pending.current, change);
      setSave('saving');
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, 800);
    },
    [flush],
  );

  async function transition(to: ArticleStatus) {
    if (timer.current) clearTimeout(timer.current);
    await flush();
    setError(null);
    try {
      const updated = await api<NewsroomArticle>(`/newsroom/articles/${id}/transition`, {
        method: 'POST',
        body: JSON.stringify({ toStatus: to }),
      });
      setArticle((prev) => (prev ? { ...prev, ...updated } : updated));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Transition failed');
    }
  }

  if (!article || !user) {
    return (
      <Container className="py-20">
        <p className="font-mono text-xs uppercase tracking-widest text-ink-muted">Loading…</p>
      </Container>
    );
  }

  const dir = article.primaryLanguage === 'ar' ? 'rtl' : 'ltr';
  const transitions = availableTransitions(article.status, user.role);

  return (
    <>
      {/* Action bar */}
      <div className="sticky top-14 z-20 border-b border-border bg-background/90 backdrop-blur">
        <Container className="flex h-14 items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/newsroom" className="font-sans text-sm text-ink-muted hover:text-ink">
              ← Stories
            </Link>
            <StatusBadge status={article.status} />
            <SaveIndicator state={save} />
          </div>
          <div className="flex items-center gap-2">
            {transitions.map((to) => (
              <Button
                key={to}
                size="sm"
                // Publishing is the consequential action, so it is the only
                // filled control in the bar.
                variant={to === 'PUBLISHED' ? 'filled' : 'plain'}
                onClick={() => transition(to)}
                className={to === 'PUBLISHED' ? undefined : 'border border-border'}
              >
                {TRANSITION_LABELS[to]}
              </Button>
            ))}
            <Button
              size="sm"
              variant="plain"
              aria-expanded={panelOpen}
              onClick={() => setPanelOpen((v) => !v)}
              className="border border-border text-ink-muted"
            >
              {panelOpen ? 'Hide settings' : 'Settings'}
            </Button>
          </div>
        </Container>
      </div>

      {error && (
        <Container className="pt-4">
          <p className="rounded-md border border-error/30 bg-error/5 px-4 py-2 font-sans text-sm text-error">
            {error}
          </p>
        </Container>
      )}

      <Container className="py-8">
        <div className={panelOpen ? 'grid gap-10 lg:grid-cols-[1fr_320px]' : ''}>
          {/* Editor column */}
          <div className="mx-auto w-full max-w-reading">
            <HeroImageField
              current={article.heroImage}
              onUploaded={(media: NewsroomMedia) => {
                setArticle((prev) => (prev ? { ...prev, heroImage: media } : prev));
                patch({ heroImageId: media.id });
              }}
            />
            {/* design-system-ignore: writing canvas, not a form field — the
                headline must look exactly like the published headline while
                being edited, so it is deliberately chrome-less. */}
            <input
              value={article.headline}
              onChange={(e) => patch({ headline: e.target.value, workingTitle: e.target.value })}
              placeholder="Headline"
              aria-label="Headline"
              dir={dir}
              className={`w-full bg-transparent font-serif text-h1 font-semibold text-ink outline-none placeholder:text-ink-muted/50 ${
                dir === 'rtl' ? 'font-arabic' : ''
              }`}
            />
            {/* design-system-ignore: writing canvas, see above. */}
            <input
              value={article.subheadline ?? ''}
              onChange={(e) => patch({ subheadline: e.target.value })}
              placeholder="Subheadline"
              aria-label="Subheadline"
              dir={dir}
              className={`mt-3 w-full bg-transparent font-sans text-lede text-ink-muted outline-none placeholder:text-ink-muted/50 ${
                dir === 'rtl' ? 'font-arabic' : ''
              }`}
            />
            {/* design-system-ignore: writing canvas, see above. */}
            <textarea
              value={article.summary ?? ''}
              onChange={(e) => patch({ summary: e.target.value })}
              placeholder="Quick summary — the one thing a reader should take away."
              dir={dir}
              rows={2}
              className={`mt-5 w-full resize-none border-s-2 border-border bg-transparent ps-4 font-serif text-lg text-ink outline-none placeholder:text-ink-muted/50 focus:border-accent ${
                dir === 'rtl' ? 'font-arabic' : ''
              }`}
            />
            <div className="mt-8">
              <ArticleEditor
                initialContent={article.bodyJson}
                onChange={(doc) => patch({ bodyJson: doc })}
                dir={dir}
              />
            </div>
          </div>

          {/* Publishing panel */}
          {panelOpen && (
            <aside className="space-y-6 lg:border-s lg:border-border lg:ps-8">
              <PanelSection title="Publishing">
                <Field label="Language" htmlFor="primaryLanguage">
                  <Select
                    id="primaryLanguage"
                    value={article.primaryLanguage}
                    onChange={(e) => patch({ primaryLanguage: e.target.value })}
                    options={LOCALES.map((l) => ({ value: l, label: LOCALE_NATIVE_NAMES[l] }))}
                  />
                </Field>
                <Field label="Type" htmlFor="articleType">
                  <Select
                    id="articleType"
                    value={article.articleType}
                    onChange={(e) =>
                      patch({ articleType: e.target.value as NewsroomArticle['articleType'] })
                    }
                    options={ARTICLE_TYPES.map((t) => ({ value: t, label: title(t) }))}
                  />
                </Field>
                <Field label="Country" htmlFor="countryId">
                  <Select
                    id="countryId"
                    value={article.countryId ?? ''}
                    onChange={(e) => patch({ countryId: e.target.value || null })}
                    options={[{ value: '', label: '—' }, ...countries.map((c) => ({ value: c.id, label: c.name }))]}
                  />
                </Field>
                <Field label="Topic" htmlFor="topicId">
                  <Select
                    id="topicId"
                    value={article.topicId ?? ''}
                    onChange={(e) => patch({ topicId: e.target.value || null })}
                    options={[{ value: '', label: '—' }, ...topics.map((t) => ({ value: t.id, label: t.name }))]}
                  />
                </Field>
                <Checkbox
                  className="pt-1"
                  label="Breaking news"
                  checked={article.isBreaking}
                  onChange={(e) => patch({ isBreaking: e.target.checked })}
                />
                <Field label="Publish date" htmlFor="publishAt">
                  <Input
                    id="publishAt"
                    type="datetime-local"
                    value={toLocalInput(article.publishAt)}
                    onChange={(e) =>
                      patch({ publishAt: e.target.value ? fromLocalInput(e.target.value) : null })
                    }
                    className="font-mono text-caption"
                  />
                  <p className="mt-1 font-sans text-xs text-ink-muted">
                    {article.publishedAt
                      ? `Showing: ${new Date(article.publishedAt).toLocaleString()}`
                      : 'Sets the scheduled time and the date shown when published.'}
                  </p>
                </Field>
              </PanelSection>

              <PanelSection title="SEO & social">
                <Field label="SEO title" htmlFor="seoTitle">
                  <Input
                    id="seoTitle"
                    value={article.seoTitle ?? ''}
                    onChange={(e) => patch({ seoTitle: e.target.value })}
                  />
                </Field>
                <Field label="Meta description" htmlFor="metaDescription">
                  <Textarea
                    id="metaDescription"
                    rows={3}
                    value={article.metaDescription ?? ''}
                    onChange={(e) => patch({ metaDescription: e.target.value })}
                  />
                </Field>
                <Field label="URL slug" htmlFor="urlSlug">
                  <p id="urlSlug" className="font-mono text-caption text-ink-muted">
                    /{article.slug}
                  </p>
                </Field>
              </PanelSection>

              <PanelSection title="Reading time">
                <p className="font-mono text-sm text-ink">{article.readingTime} min · v{article.version}</p>
              </PanelSection>
            </aside>
          )}
        </div>
      </Container>
    </>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  const label =
    state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : state === 'error' ? 'Save failed' : '';
  return <span className="font-mono text-xs text-ink-muted">{label}</span>;
}

function PanelSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 font-mono text-meta uppercase tracking-widest text-ink-muted">{title}</h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

/* Field / Input / Textarea / Select used to be redefined locally here, which is
   how the settings panel drifted from the rest of the product. They now come
   from @pressly/ui. */

function title(s: string): string {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

/** Stored ISO → value for <input type="datetime-local"> (local time). */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

/** datetime-local value (local time) → ISO for the API. */
function fromLocalInput(value: string): string {
  return new Date(value).toISOString();
}
