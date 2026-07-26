/**
 * Proves that interactive states are actually VISIBLE.
 *
 * This exists because a previous pass shipped hover states that were verified
 * by computed style — `transform` really did go 1 → 1.02 — and were completely
 * invisible on screen. The headline hover was a colour shift from #111111 to
 * #16213E, a 1.19:1 contrast ratio, and the image zoom only existed on cards
 * that had an image, which most seeded articles do not.
 *
 * So: screenshot the element at rest, screenshot it hovered, and compare the
 * actual pixels. A change a human cannot see fails.
 *
 * Needs a live server on :3000 (pnpm dev / pnpm start) with the API up.
 */
import puppeteer from 'puppeteer';
import { PNG } from 'pngjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

/** Minimum share of pixels that must change for a hover to count as visible. */
const MIN_CHANGED_RATIO = 0.02;
/** A pixel counts as changed only if it moves by more than this, per channel. */
const CHANNEL_THRESHOLD = 8;

const results = [];
const check = (name, pass, detail = '') =>
  results.push(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);

function diffRatio(aBuf, bBuf) {
  // Puppeteer returns a Uint8Array; pngjs needs a Node Buffer.
  const a = PNG.sync.read(Buffer.from(aBuf));
  const b = PNG.sync.read(Buffer.from(bBuf));
  if (a.width !== b.width || a.height !== b.height) return 1;
  let changed = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    if (
      Math.abs(a.data[i] - b.data[i]) > CHANNEL_THRESHOLD ||
      Math.abs(a.data[i + 1] - b.data[i + 1]) > CHANNEL_THRESHOLD ||
      Math.abs(a.data[i + 2] - b.data[i + 2]) > CHANNEL_THRESHOLD
    ) {
      changed++;
    }
  }
  return changed / (a.width * a.height);
}

const browser = await puppeteer.launch({ headless: 'new' });

/**
 * Hover `selector` and report how much of its bounding box changed. `pad`
 * widens the capture so lift/shadow that spills outside the box is counted.
 */
async function hoverDiff(page, selector, label, pad = 16) {
  const el = await page.$(selector);
  if (!el) return check(label, false, 'element not found');

  // The element must be inside the viewport: the pointer cannot reach a card
  // that is below the fold, and a rect read while it is off-screen produces a
  // clip that captures the wrong part of the page.
  await page.evaluate((s) => {
    document.querySelector(s).scrollIntoView({ block: 'center', behavior: 'instant' });
  }, selector);
  await new Promise((r) => setTimeout(r, 300));

  const box = await page.evaluate((s) => {
    const r = document.querySelector(s).getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  }, selector);

  // `clip` is document-relative, the rect is viewport-relative — add the scroll
  // offset or we screenshot the wrong region entirely.
  const scroll = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
  const clip = {
    x: Math.max(0, box.x + scroll.x - pad),
    y: Math.max(0, box.y + scroll.y - pad),
    width: box.width + pad * 2,
    height: box.height + pad * 2,
  };

  // Park the pointer somewhere inert first so nothing is hovered.
  await page.mouse.move(2, 2);
  await new Promise((r) => setTimeout(r, 400));
  const rest = await page.screenshot({ clip });

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await new Promise((r) => setTimeout(r, 500)); // let the transition finish
  const hovered = await page.screenshot({ clip });

  const ratio = diffRatio(rest, hovered);
  check(
    label,
    ratio >= MIN_CHANGED_RATIO,
    `${(ratio * 100).toFixed(2)}% of pixels changed (floor ${(MIN_CHANGED_RATIO * 100).toFixed(0)}%)`,
  );
}

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1000 });
await page.goto(`${BASE}/en`, { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 600)); // entrance animations settle

// Every card in the Latest grid — including the imageless ones, which is
// exactly the case that silently had no hover treatment at all.
const cards = await page.$$eval('#latest a.group', (n) => n.length);
for (let i = 0; i < Math.min(cards, 3); i++) {
  await hoverDiff(page, `#latest a.group:nth-of-type(${i + 1})`, `latest card ${i + 1} hover`);
}

// Both the active chip and a plain navigational one — the active branch used to
// have no hover styles at all, which this check found.
await hoverDiff(page, 'a.rounded-full:nth-of-type(1)', 'active chip hover', 6);
await hoverDiff(page, 'a.rounded-full:nth-of-type(2)', 'topic chip hover', 6);
await hoverDiff(page, 'form button[type=submit]', 'subscribe button hover', 6);

await browser.close();
console.log(results.join('\n'));
const failures = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n════ ${failures} invisible interaction(s) ════`);
process.exit(failures ? 1 : 0);
