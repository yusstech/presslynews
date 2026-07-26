import { ARTICLE_STATUS_TRANSITIONS, type ArticleStatus, type UserRole } from '@pressly/types';

const PUBLISH_TARGETS: ArticleStatus[] = ['SCHEDULED', 'PUBLISHED'];
const JOURNALIST_TARGETS: ArticleStatus[] = ['IN_REVIEW', 'DRAFT', 'ARCHIVED'];

/** Mirrors the API's role rules so the UI only offers valid actions. */
function roleCanTransition(role: UserRole, to: ArticleStatus): boolean {
  if (role === 'SUPER_ADMIN' || role === 'EDITOR') return true;
  if (PUBLISH_TARGETS.includes(to)) return false;
  if (role === 'COPY_EDITOR') return true;
  if (role === 'JOURNALIST') return JOURNALIST_TARGETS.includes(to);
  return false;
}

/** Transitions the current user may perform from the article's current status. */
export function availableTransitions(from: ArticleStatus, role: UserRole): ArticleStatus[] {
  return ARTICLE_STATUS_TRANSITIONS[from].filter((to) => roleCanTransition(role, to));
}

export const TRANSITION_LABELS: Record<ArticleStatus, string> = {
  DRAFT: 'Move to draft',
  IN_REVIEW: 'Submit for review',
  REVISION_REQUESTED: 'Request revisions',
  READY_TO_PUBLISH: 'Approve',
  SCHEDULED: 'Schedule',
  PUBLISHED: 'Publish now',
  UPDATED: 'Mark updated',
  CORRECTED: 'Add correction',
  ARCHIVED: 'Archive',
};
