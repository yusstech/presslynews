import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/session';

export const runtime = 'nodejs';

/** Session check for the Newsroom shell. 401 rather than 200-with-null so the
 *  client can treat "signed out" as an error path like every other call. */
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ message: 'Not signed in' }, { status: 401 });
  return NextResponse.json(user);
}
