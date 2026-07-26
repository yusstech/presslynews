import { NextResponse } from 'next/server';
import { searchArticles } from '@/data/seed';

/**
 * Search endpoint backing the ⌘K palette. In Phase 5 this is swapped for a
 * Meilisearch-backed API without changing the client.
 */
export function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q') ?? '';
  const results = searchArticles(query).slice(0, 8);
  return NextResponse.json({ results });
}
