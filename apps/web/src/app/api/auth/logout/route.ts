import { NextResponse } from 'next/server';
import { destroySession } from '@/lib/session';

export const runtime = 'nodejs';

/** POST, not GET: signing out changes state, and a GET would let any page
 *  log the editor out by embedding an image. */
export async function POST() {
  await destroySession();
  return NextResponse.json({ ok: true });
}
