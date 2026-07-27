import { NextResponse } from 'next/server';
import { getTopics } from '@/lib/content-api';
import { requireUser } from '@/lib/session';

export const runtime = 'nodejs';

/**
 * The topic list for the editor's section picker. See the countries route
 * beside this one for why it was missing.
 *
 * Authenticated, though the data is public — every topic already appears in the
 * Reader's navigation. The only consumer is the editor, so there is no reason
 * to widen the unauthenticated surface to match.
 */
export async function GET() {
  try {
    await requireUser();
  } catch (res) {
    return res as Response;
  }

  return NextResponse.json(await getTopics());
}
