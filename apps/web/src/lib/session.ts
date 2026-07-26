import 'server-only';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { prisma } from './prisma';

/**
 * Newsroom sessions.
 *
 * The token used to live in localStorage and travel as a bearer header, which
 * is the pattern you reach for when the API is a separate origin. It no longer
 * is — so the session is an httpOnly cookie instead. That removes the token
 * plumbing from every client call and puts it out of reach of any script on the
 * page, which localStorage never was.
 */
const COOKIE = 'pressly_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  locale: string;
}

function secret(): Uint8Array {
  const value = process.env.SESSION_SECRET ?? process.env.JWT_SECRET;
  if (!value || value.length < 16) {
    // Failing loudly beats signing sessions with a guessable key.
    throw new Error('SESSION_SECRET is missing or too short (need at least 16 characters).');
  }
  return new TextEncoder().encode(value);
}

export async function createSession(userId: string): Promise<void> {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/**
 * The signed-in user, or null.
 *
 * Deliberately re-reads the user row rather than trusting the claims in the
 * token: it means deactivating an account takes effect immediately instead of
 * whenever the cookie happens to expire.
 */
export async function currentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub) return null;

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, locale: true, active: true },
    });
    if (!user?.active) return null;

    return { id: user.id, email: user.email, name: user.name, locale: user.locale };
  } catch {
    // Expired or tampered-with token.
    return null;
  }
}

/** Guard for newsroom route handlers. Throws a 401 Response when signed out. */
export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) {
    throw new Response(JSON.stringify({ message: 'Not signed in' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return user;
}
