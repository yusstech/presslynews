/**
 * Editorial enums. v1 uses deliberate *subsets* of the full spec:
 *  - status: linear workflow only (full 16-state lifecycle is v2)
 *  - roles: 4 roles (full 12-role matrix is v2)
 */

/** v1 article lifecycle (subset of the full 16-state spec). */
export const ARTICLE_STATUSES = [
  'DRAFT',
  'IN_REVIEW',
  'REVISION_REQUESTED',
  'READY_TO_PUBLISH',
  'SCHEDULED',
  'PUBLISHED',
  'UPDATED',
  'CORRECTED',
  'ARCHIVED',
] as const;
export type ArticleStatus = (typeof ARTICLE_STATUSES)[number];

/**
 * Allowed forward/side transitions between states. The workflow module must
 * reject any transition not listed here and log every accepted one.
 */
export const ARTICLE_STATUS_TRANSITIONS: Record<ArticleStatus, ArticleStatus[]> = {
  DRAFT: ['IN_REVIEW', 'ARCHIVED'],
  IN_REVIEW: ['REVISION_REQUESTED', 'READY_TO_PUBLISH', 'ARCHIVED'],
  REVISION_REQUESTED: ['IN_REVIEW', 'DRAFT', 'ARCHIVED'],
  READY_TO_PUBLISH: ['SCHEDULED', 'PUBLISHED', 'REVISION_REQUESTED', 'ARCHIVED'],
  SCHEDULED: ['PUBLISHED', 'READY_TO_PUBLISH', 'ARCHIVED'],
  PUBLISHED: ['UPDATED', 'CORRECTED', 'ARCHIVED'],
  UPDATED: ['CORRECTED', 'ARCHIVED'],
  CORRECTED: ['UPDATED', 'ARCHIVED'],
  ARCHIVED: [],
};

export function canTransition(from: ArticleStatus, to: ArticleStatus): boolean {
  return ARTICLE_STATUS_TRANSITIONS[from].includes(to);
}

/** Statuses that are publicly visible on the Reader. */
export const PUBLIC_STATUSES: readonly ArticleStatus[] = [
  'PUBLISHED',
  'UPDATED',
  'CORRECTED',
];

export function isPublic(status: ArticleStatus): boolean {
  return PUBLIC_STATUSES.includes(status);
}

/** v1 newsroom roles (subset of the full 12-role matrix). */
export const USER_ROLES = ['SUPER_ADMIN', 'EDITOR', 'JOURNALIST', 'COPY_EDITOR'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ARTICLE_TYPES = [
  'NEWS',
  'ANALYSIS',
  'OPINION',
  'FEATURE',
  'INTERVIEW',
  'BRIEFING',
] as const;
export type ArticleType = (typeof ARTICLE_TYPES)[number];

export type MediaProcessingStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';
