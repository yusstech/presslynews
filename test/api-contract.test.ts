import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every endpoint the client calls must exist.
 *
 * The Newsroom editor called `/api/taxonomy/countries` and
 * `/api/taxonomy/topics` for months after both routes were deleted with the
 * NestJS API. Its three startup requests are one `Promise.all`, so the 404
 * rejected the batch, the article was never set, and the page sat on
 * "Loading…" — the editor was completely unopenable and nothing said so. The
 * Reader was unaffected, so the site looked healthy the whole time.
 *
 * Typecheck cannot catch this: a route path is a string. This walks the client
 * source for the paths it asks for and the app directory for the routes that
 * exist, and compares them.
 */

const ROOT = fileURLToPath(new URL('../apps/web/src', import.meta.url));
const API_DIR = join(ROOT, 'app/api');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

/** Route paths that exist, e.g. `/newsroom/articles/[id]/transition`. */
function existingRoutes(): string[] {
  return walk(API_DIR)
    .filter((f) => /[/\\]route\.ts$/.test(f))
    .map((f) => `/${relative(API_DIR, f).replace(/[/\\]route\.ts$/, '').split(/[/\\]/).join('/')}`);
}

/**
 * Paths the client asks for. `api('/x')` and `upload('/x')` both resolve
 * against `/api`, and a template literal's `${...}` is a dynamic segment.
 */
function requestedPaths(): Array<{ path: string; file: string }> {
  const files = walk(ROOT).filter(
    (f) => /\.tsx?$/.test(f) && !f.includes(`${'app'}/api/`) && !f.endsWith('.d.ts'),
  );

  const found: Array<{ path: string; file: string }> = [];
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    // api('/path'), api<T>('/path'), api(`/path/${x}`), upload('/path')
    const calls = src.matchAll(/\b(?:api|upload)\s*(?:<[^>]*>)?\s*\(\s*(['"`])(\/[^'"`]*)\1/g);
    for (const match of calls) {
      const path = match[2]!.replace(/\$\{[^}]*\}/g, ':param').replace(/\/+$/, '');
      found.push({ path, file: relative(ROOT, file) });
    }
  }
  return found;
}

/** Does `requested` match `route`, treating `[x]` and `:param` as wildcards? */
function matches(requested: string, route: string): boolean {
  const a = requested.split('/').filter(Boolean);
  const b = route.split('/').filter(Boolean);
  if (a.length !== b.length) return false;
  return a.every((segment, i) => {
    const routeSegment = b[i]!;
    if (routeSegment.startsWith('[') || segment === ':param') return true;
    return segment === routeSegment;
  });
}

describe('client/server API contract', () => {
  const routes = existingRoutes();
  const requested = requestedPaths();

  it('finds the route handlers', () => {
    expect(routes.length).toBeGreaterThan(0);
  });

  it('finds the calls the client makes', () => {
    // If this regex ever stops matching, the whole file silently passes.
    expect(requested.length).toBeGreaterThan(0);
  });

  it('has a route handler for every path the client requests', () => {
    const missing = requested
      .filter(({ path }) => !routes.some((route) => matches(path, route)))
      .map(({ path, file }) => `${path}  (called from ${file})`);

    expect(missing, `No route handler for:\n  ${missing.join('\n  ')}`).toEqual([]);
  });
});
