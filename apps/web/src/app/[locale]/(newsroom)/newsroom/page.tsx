'use client';

import { useEffect, useState } from 'react';
import { Button, Container } from '@pressly/ui';
import { api } from '@/lib/api';
import { useRouter } from '@/i18n/navigation';
import { RequireAuth } from '@/newsroom/require-auth';
import { StatusBadge } from '@/newsroom/status-badge';
import type { NewsroomArticleSummary } from '@/newsroom/types';

export default function DashboardPage() {
  return (
    <RequireAuth>
      <Dashboard />
    </RequireAuth>
  );
}

function Dashboard() {
  const router = useRouter();
  const [articles, setArticles] = useState<NewsroomArticleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api<NewsroomArticleSummary[]>('/newsroom/articles')
      .then(setArticles)
      .finally(() => setLoading(false));
  }, []);

  async function createArticle() {
    setCreating(true);
    try {
      const article = await api<NewsroomArticleSummary>('/newsroom/articles', {
        method: 'POST',
        body: JSON.stringify({ workingTitle: 'Untitled story' }),
      });
      router.push(`/newsroom/articles/${article.id}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <Container className="py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-ink">Stories</h1>
          <p className="mt-1 font-sans text-sm text-ink-muted">
            {articles.length} {articles.length === 1 ? 'story' : 'stories'}
          </p>
        </div>
        <Button onClick={createArticle} busy={creating}>
          {creating ? 'Creating…' : 'New story'}
        </Button>
      </div>

      {loading ? (
        <p className="font-mono text-xs uppercase tracking-widest text-ink-muted">Loading…</p>
      ) : articles.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-12 text-center">
          <p className="font-serif text-lg text-ink">No stories yet</p>
          <p className="mt-1 font-sans text-sm text-ink-muted">
            Create your first story to get started.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full text-start">
            <thead>
              <tr className="border-b border-border text-start">
                <th className="px-5 py-3 text-start font-mono text-meta uppercase tracking-widest text-ink-muted">
                  Headline
                </th>
                <th className="px-5 py-3 text-start font-mono text-meta uppercase tracking-widest text-ink-muted">
                  Status
                </th>
                <th className="hidden px-5 py-3 text-start font-mono text-meta uppercase tracking-widest text-ink-muted sm:table-cell">
                  Author
                </th>
                <th className="hidden px-5 py-3 text-start font-mono text-meta uppercase tracking-widest text-ink-muted md:table-cell">
                  Updated
                </th>
              </tr>
            </thead>
            <tbody>
              {articles.map((a) => (
                <tr
                  key={a.id}
                  onClick={() => router.push(`/newsroom/articles/${a.id}`)}
                  className="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-border/25"
                >
                  <td className="px-5 py-4">
                    <span className="font-serif text-base text-ink">
                      {a.headline || a.workingTitle}
                    </span>
                    {a.country && (
                      <span className="ms-2 font-mono text-meta uppercase text-ink-muted">
                        {a.country.name}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge status={a.status} />
                  </td>
                  <td className="hidden px-5 py-4 font-sans text-sm text-ink-muted sm:table-cell">
                    {a.author?.name ?? '—'}
                  </td>
                  <td className="hidden px-5 py-4 font-mono text-xs text-ink-muted md:table-cell">
                    {new Date(a.updatedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Container>
  );
}
