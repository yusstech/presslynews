/**
 * Finds a published article slug to test against.
 *
 * The gate scripts used to ask the NestJS API for one. There is no API any
 * more, and adding an endpoint purely so the tests can find a slug would be
 * building product for the test suite. Reading the home page instead uses
 * exactly what a reader sees — and if no article link is on the home page,
 * that is worth failing on regardless.
 */
export async function findArticleSlug(base = 'http://localhost:3000', locale = 'en') {
  const html = await fetch(`${base}/${locale}`).then((r) => r.text());
  const match = html.match(new RegExp(`/${locale}/article/([a-z0-9-]+)`, 'i'));
  return match?.[1] ?? null;
}
