import puppeteer from 'puppeteer';
import { AxePuppeteer } from '@axe-core/puppeteer';
import { findArticleSlug } from './find-article.mjs';

// Defaults to the dev server; set BASE_URL to audit a deployed host.
const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

const PAGES = [
  ['reader home (en)', `${BASE}/en`],
  ['reader home (ar, RTL)', `${BASE}/ar`],
  ['article', null], // resolved below
  ['country', `${BASE}/en/country/sa`],
  ['country empty', `${BASE}/en/country/de`],
  ['topic', `${BASE}/en/topic/energy`],
  ['search results', `${BASE}/en/search?q=grid`],
  ['search empty', `${BASE}/en/search?q=zzzznothing`],
  ['newsroom login', `${BASE}/en/newsroom/login`],
  ['forgot password', `${BASE}/en/newsroom/forgot-password`],
  ['reset password', `${BASE}/en/newsroom/reset-password?token=abc`],
];

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

// Find a real published article slug to audit, by reading the home page — the
// API this used to ask no longer exists.
const slug = await findArticleSlug(BASE);
PAGES[2][1] = slug ? `${BASE}/en/article/${slug}` : null;

const browser = await puppeteer.launch({ headless: 'new' });
let total = 0;

for (const [label, url] of PAGES) {
  if (!url) {
    console.log(`\n─ ${label}: skipped (no URL)`);
    continue;
  }
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });

  const { violations } = await new AxePuppeteer(page).withTags(TAGS).analyze();
  total += violations.length;

  const mark = violations.length === 0 ? 'PASS' : 'FAIL';
  console.log(`\n─ ${label} … ${mark}`);
  for (const v of violations) {
    console.log(`   [${v.impact}] ${v.id} — ${v.help} (${v.nodes.length} node(s))`);
    for (const n of v.nodes.slice(0, 3)) {
      console.log(`      ${n.html.slice(0, 130).replace(/\s+/g, ' ')}`);
    }
  }
  await page.close();
}

// The ⌘K palette only exists once opened, so audit it separately.
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
await page.goto(`${BASE}/en`, { waitUntil: 'networkidle0' });
await page.keyboard.down('Meta');
await page.keyboard.press('k');
await page.keyboard.up('Meta');
await new Promise((r) => setTimeout(r, 400));
const dialog = await page.$('[role="dialog"]');
if (dialog) {
  await page.type('[role="combobox"]', 'grid');
  await new Promise((r) => setTimeout(r, 900));
  const { violations } = await new AxePuppeteer(page).withTags(TAGS).analyze();
  total += violations.length;
  console.log(`\n─ command palette (open, with results) … ${violations.length ? 'FAIL' : 'PASS'}`);
  for (const v of violations) {
    console.log(`   [${v.impact}] ${v.id} — ${v.help} (${v.nodes.length} node(s))`);
    for (const n of v.nodes.slice(0, 3)) {
      console.log(`      ${n.html.slice(0, 130).replace(/\s+/g, ' ')}`);
    }
  }
} else {
  console.log('\n─ command palette … COULD NOT OPEN');
}

await browser.close();
console.log(`\n════ ${total} violation type(s) across all pages ════`);
