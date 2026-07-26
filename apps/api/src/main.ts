import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.setGlobalPrefix('api');

  /**
   * Allowed browser origins.
   *
   * The Newsroom is a browser app talking to this API cross-origin, so this
   * list decides whether editors can sign in at all. It was a single origin
   * from NEXT_PUBLIC_SITE_URL, which breaks the moment the web app is deployed
   * somewhere with more than one hostname — Vercel gives every preview branch
   * its own URL.
   *
   *   CORS_ORIGINS   comma-separated exact origins (production + any custom domain)
   *   CORS_PREVIEW_SUFFIX  optional host suffix to allow, e.g. ".vercel.app"
   *
   * The suffix is opt-in and matched against the host only, never a substring
   * of the whole origin — "evil-vercel.app.attacker.com" must not pass.
   */
  const allowed = (process.env.CORS_ORIGINS ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);
  const previewSuffix = process.env.CORS_PREVIEW_SUFFIX?.trim();

  app.enableCors({
    origin(origin, callback) {
      // Same-origin and non-browser callers (curl, the worker) send no Origin.
      if (!origin) return callback(null, true);
      const normalised = origin.replace(/\/$/, '');
      if (allowed.includes(normalised)) return callback(null, true);
      if (previewSuffix) {
        try {
          const { hostname, protocol } = new URL(normalised);
          if (protocol === 'https:' && hostname.endsWith(previewSuffix)) {
            return callback(null, true);
          }
        } catch {
          /* malformed Origin — fall through to the rejection below */
        }
      }
      return callback(new Error(`Origin ${origin} is not allowed by CORS`), false);
    },
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );

  // Local media fallback (when R2 isn't configured) is served from here. The
  // worker writes derived variants into the same directory.
  const mediaDir = process.env.MEDIA_LOCAL_DIR ?? join(process.cwd(), 'uploads');
  app.useStaticAssets(mediaDir, { prefix: '/uploads' });

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Pressly API listening on http://localhost:${port}/api`);
}

void bootstrap();
