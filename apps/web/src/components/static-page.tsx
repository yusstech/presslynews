import { Container } from '@pressly/ui';
import type { ReactNode } from 'react';

/**
 * The shared shell for Pressly's standing pages (About, Editorial standards,
 * Contact).
 *
 * These existed as footer links long before they existed as routes — all three
 * used to fall through to the catch-all and render a 404 on every page of the
 * site. They share this shell so they stay typographically identical to an
 * article: same reading measure, same entrance, same rhythm.
 */
export function StaticPage({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Container className="py-16">
      <div className="mx-auto max-w-reading">
        <h1 className="animate-rise font-serif text-h1 font-semibold text-ink">{title}</h1>
        <div className="animate-rise stagger mt-8 space-y-6" style={{ '--stagger': 1 } as never}>
          {children}
        </div>
      </div>
    </Container>
  );
}

/** A body paragraph at the Reader's reading size. */
export function Prose({ children }: { children: ReactNode }) {
  return <p className="font-sans text-body text-ink-muted">{children}</p>;
}
