import type { ArticleStatus } from '@pressly/types';
import { cn } from '@pressly/ui';

const LABELS: Record<ArticleStatus, string> = {
  DRAFT: 'Draft',
  SCHEDULED: 'Scheduled',
  PUBLISHED: 'Published',
  ARCHIVED: 'Archived',
};

// Grayscale-first: published gets the one accent; everything else stays quiet.
const TONE: Record<ArticleStatus, string> = {
  DRAFT: 'border-border text-ink-muted',
  SCHEDULED: 'border-border text-ink',
  PUBLISHED: 'border-accent bg-accent text-background',
  ARCHIVED: 'border-border text-ink-muted',
};

export function StatusBadge({ status }: { status: ArticleStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-meta uppercase',
        TONE[status],
      )}
    >
      {LABELS[status]}
    </span>
  );
}
