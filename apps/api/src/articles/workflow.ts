import type { ArticleStatus, UserRole } from '@pressly/types';

/** Transitions that publish (or schedule) — restricted to editors & admins. */
const PUBLISH_TARGETS: ArticleStatus[] = ['SCHEDULED', 'PUBLISHED'];

/** Targets a journalist may move an article to. */
const JOURNALIST_TARGETS: ArticleStatus[] = ['IN_REVIEW', 'DRAFT', 'ARCHIVED'];

/**
 * Role-based permission for a workflow transition (on top of the state-machine
 * rules in @pressly/types). SUPER_ADMIN and EDITOR can do anything; others are
 * scoped so only editors can actually publish.
 */
export function roleCanTransition(role: UserRole, to: ArticleStatus): boolean {
  if (role === 'SUPER_ADMIN' || role === 'EDITOR') return true;
  if (PUBLISH_TARGETS.includes(to)) return false;
  if (role === 'COPY_EDITOR') return true;
  if (role === 'JOURNALIST') return JOURNALIST_TARGETS.includes(to);
  return false;
}

export function isPublishTarget(to: ArticleStatus): boolean {
  return PUBLISH_TARGETS.includes(to);
}
