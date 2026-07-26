import { Container } from '@pressly/ui';
import { Link } from '@/i18n/navigation';

interface EmptyStateProps {
  title: string;
  body: string;
  action?: { label: string; href: string };
  /** Full-height treatment for pages that have nothing else on them. */
  standalone?: boolean;
}

/**
 * The calm empty state.
 *
 * Per the design spec an absence of content should read as a quiet pause
 * rather than an error — so this is typography on the page background, not a
 * warning panel, and it always offers somewhere to go next.
 */
export function EmptyState({ title, body, action, standalone = false }: EmptyStateProps) {
  const content = (
    <div className="animate-rise mx-auto max-w-md text-center">
      <p className="font-serif text-xl text-ink">{title}</p>
      <p className="mt-2 font-sans text-ink-muted">{body}</p>
      {action && (
        <Link
          href={action.href}
          className="mt-6 inline-block rounded-md border border-border px-4 py-2 font-sans text-sm text-accent transition-[border-color,transform] duration-fast ease-editorial hover:border-accent active:scale-[0.98]"
        >
          {action.label}
        </Link>
      )}
    </div>
  );

  if (standalone) {
    return (
      <Container className="flex min-h-[60vh] flex-col items-center justify-center py-20">
        {content}
      </Container>
    );
  }

  return <div className="rounded-xl border border-border bg-surface p-12">{content}</div>;
}
