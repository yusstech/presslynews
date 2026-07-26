import { NextResponse } from 'next/server';
import { searchContent } from '@/lib/content-api';

export const runtime = 'nodejs';
// Results must be live — never serve a cached search response.
export const dynamic = 'force-dynamic';

/**
 * Backs the ⌘K palette.
 *
 * Previously this returned seed data and the palette called the NestJS
 * Meilisearch endpoint instead. Both are gone: this is Postgres full-text
 * search, in this app, and it returns a bare array like the API did.
 */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get('q') ?? '';
  return NextResponse.json(await searchContent(q, 8));
}
