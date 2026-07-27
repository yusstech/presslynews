import { NextResponse } from 'next/server';
import { getCountries } from '@/lib/content-api';
import { requireUser } from '@/lib/session';

export const runtime = 'nodejs';

/**
 * The country list for the editor's country picker.
 *
 * This endpoint went with the NestJS API in the collapse and was never rebuilt,
 * but the editor never stopped calling it. Its three startup requests are one
 * `Promise.all`, so a 404 here rejected the whole batch, the article was never
 * set, and the page rendered its loading state forever — the Newsroom editor
 * has been unopenable since. Nothing in the Reader depends on this route, which
 * is why the site looked healthy throughout.
 *
 * Reads through the same cached accessor the sitemap and listing pages use, so
 * the taxonomy is fetched once per revalidation window rather than per editor
 * load.
 */
export async function GET() {
  try {
    await requireUser();
  } catch (res) {
    return res as Response;
  }

  return NextResponse.json(await getCountries());
}
