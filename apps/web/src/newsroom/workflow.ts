import { ARTICLE_STATUS_TRANSITIONS, type ArticleStatus } from '@pressly/types';

/**
 * Which actions the editor is offered from the article's current state.
 *
 * This used to take a role as well and filter by it — four roles deciding who
 * could publish, approve or request revisions. With a single admin every branch
 * answered the same way, so what remains is the lifecycle itself.
 */
export function availableTransitions(from: ArticleStatus): ArticleStatus[] {
  return ARTICLE_STATUS_TRANSITIONS[from];
}

export const TRANSITION_LABELS: Record<ArticleStatus, string> = {
  DRAFT: 'Back to draft',
  SCHEDULED: 'Schedule',
  PUBLISHED: 'Publish now',
  ARCHIVED: 'Archive',
};
