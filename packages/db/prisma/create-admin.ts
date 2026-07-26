import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

/**
 * Creates (or promotes) the first real Newsroom account.
 *
 * Production deliberately never runs the development seed, so there are no
 * accounts at all after a fresh deploy and no way to sign in. This is that way
 * in.
 *
 * Usage — as a one-off on the host, so the password never lands in a file:
 *
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='…' ADMIN_NAME='Your Name' \
 *     pnpm db:create-admin
 *
 * Idempotent: run it again with a new password to reset your own access.
 */
const MIN_PASSWORD_LENGTH = 12;

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || 'Administrator';

  if (!email || !password) {
    console.error(
      'Missing ADMIN_EMAIL or ADMIN_PASSWORD.\n\n' +
        "  ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='…' pnpm db:create-admin",
    );
    process.exit(1);
  }
  if (!email.includes('@')) {
    console.error(`"${email}" does not look like an email address.`);
    process.exit(1);
  }
  // A weak first-admin password is a weak newsroom: this account can publish.
  if (password.length < MIN_PASSWORD_LENGTH) {
    console.error(`ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    process.exit(1);
  }
  if (password === 'pressly123') {
    console.error('That is the development demo password. Choose another.');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const slug = email
      .split('@')[0]!
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email } });
    const user = await prisma.user.upsert({
      where: { email },
      create: { email, name, slug, role: 'SUPER_ADMIN', hashedPassword },
      update: { role: 'SUPER_ADMIN', hashedPassword },
    });

    console.log(
      `${existing ? 'Updated' : 'Created'} SUPER_ADMIN ${user.email} — sign in at /newsroom/login`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
