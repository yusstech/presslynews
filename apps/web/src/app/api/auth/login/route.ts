import { NextResponse } from 'next/server';
import * as bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { createSession } from '@/lib/session';
import { clientIp, rateLimit, resetRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

/** Ten attempts per address per fifteen minutes — generous for someone who has
 *  forgotten which password they used, useless for guessing one. */
const PER_IP = { limit: 10, windowMs: 15 * 60_000 };
/** Tighter per account, so distributing an attack across addresses still runs
 *  into a wall on the account actually being targeted. */
const PER_EMAIL = { limit: 5, windowMs: 15 * 60_000 };

function tooMany(retryAfter: number) {
  return NextResponse.json(
    { message: 'Too many sign-in attempts. Try again shortly.' },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } },
  );
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    email?: string;
    password?: string;
  } | null;

  const email = body?.email?.trim().toLowerCase();
  const password = body?.password;
  if (!email || !password) {
    return NextResponse.json({ message: 'Email and password are required' }, { status: 400 });
  }

  // Checked before touching the database, so a flood costs a Map lookup rather
  // than a query and a bcrypt comparison — the expensive part is the point of
  // the attack.
  const ip = clientIp(request);
  const byIp = rateLimit(`login:ip:${ip}`, PER_IP.limit, PER_IP.windowMs);
  if (!byIp.ok) return tooMany(byIp.retryAfter);
  const byEmail = rateLimit(`login:email:${email}`, PER_EMAIL.limit, PER_EMAIL.windowMs);
  if (!byEmail.ok) return tooMany(byEmail.retryAfter);

  const user = await prisma.user.findUnique({ where: { email } });

  /**
   * One message and one timing path for "no such user" and "wrong password".
   * Distinguishing them tells an attacker which addresses exist; comparing
   * against a dummy hash when the user is missing keeps the response time from
   * doing the same.
   */
  const hash = user?.hashedPassword ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin';
  const ok = await bcrypt.compare(password, hash);

  if (!user || !user.active || !ok) {
    return NextResponse.json({ message: 'Incorrect email or password' }, { status: 401 });
  }

  // Signing in clears the counters: someone who mistyped twice before getting
  // it right should not carry those attempts into their next session.
  resetRateLimit(`login:ip:${ip}`);
  resetRateLimit(`login:email:${email}`);

  await createSession(user.id);

  return NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name, locale: user.locale },
  });
}
