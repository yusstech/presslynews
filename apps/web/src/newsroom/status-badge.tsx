import type { ArticleStatus } from '@pressly/types';
import { cn } from '@pressly/ui';

const LABELS: Record<ArticleStatus, string> = {
  DRAFT: 'Draft',
  IN_REVIEW: 'In review',
  REVISION_REQUESTED: 'Revision requested',
  READY_TO_PUBLISH: 'Ready',
  SCHEDULED: 'Scheduled',
  PUBLISHED: 'Published',
  UPDATED: 'Updated',
  CORRECTED: 'Corrected',
  ARCHIVED: 'Archived',
};

// Grayscale-first: published gets the one accent; everything else stays quiet.
const TONE: Record<ArticleStatus, string> = {
  DRAFT: 'border-border text-ink-muted',
  IN_REVIEW: 'border-border text-ink',
  REVISION_REQUESTED: 'border-warning/40 text-warning',
  READY_TO_PUBLISH: 'border-border text-ink',
  SCHEDULED: 'border-border text-ink',
  PUBLISHED: 'border-accent bg-accent text-background',
  UPDATED: 'border-accent/40 text-accent',
  CORRECTED: 'border-accent/40 text-accent',
  ARCHIVED: 'border-border text-ink-muted',
};

export function StatusBadge({ status }: { status: ArticleStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wide',
        TONE[status],
      )}
    >
      {LABELS[status]}
    </span>
  );
}
