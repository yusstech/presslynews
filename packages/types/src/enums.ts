/**
 * Editorial enums.
 *
 * These were modelled on a newsroom: a nine-state review pipeline and four
 * roles. Pressly has one admin publishing their own work, so the pipeline had
 * no reviewer and the roles had nobody to tell apart. What is left is the
 * lifecycle a single author actually uses.
 */

export const ARTICLE_STATUSES = ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'] as const;
export type ArticleStatus = (typeof ARTICLE_STATUSES)[number];

/**
 * Allowed transitions. Every state can be archived, and archiving is
 * reversible back to draft — nothing here is a one-way door.
 */
export const ARTICLE_STATUS_TRANSITIONS: Record<ArticleStatus, ArticleStatus[]> = {
  DRAFT: ['SCHEDULED', 'PUBLISHED', 'ARCHIVED'],
  SCHEDULED: ['PUBLISHED', 'DRAFT', 'ARCHIVED'],
  PUBLISHED: ['DRAFT', 'ARCHIVED'],
  ARCHIVED: ['DRAFT'],
};

export function canTransition(from: ArticleStatus, to: ArticleStatus): boolean {
  return ARTICLE_STATUS_TRANSITIONS[from].includes(to);
}

/** Statuses that are publicly visible on the Reader. */
export const PUBLIC_STATUSES: readonly ArticleStatus[] = ['PUBLISHED'];

export function isPublic(status: ArticleStatus): boolean {
  return PUBLIC_STATUSES.includes(status);
}

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
