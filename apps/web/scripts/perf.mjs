/**
 * Page-weight and Core Web Vitals check.
 *
 * Measures what a reader actually downloads at a given viewport, plus LCP and
 * CLS. The image budget is the point: the media pipeline produces four widths,
 * and this is what proves the browser is picking the right one rather than
 * pulling a 1600px hero onto a phone.
 *
 * Needs a live server on :3000 with the API up.
 */
import puppeteer from 'puppeteer';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812, dpr: 2 },
  { name: 'desktop', width: 1440, height: 900, dpr: 1 },
];

/**
 * Budgets, set from measured reality (mobile 347KB img / 799KB total; desktop
 * 389KB / 836KB) plus ~20% headroom. They exist to catch a regression — a new
 * font weight, a hero served at `original`, a dependency landing in the shared
 * chunk — not to certify perfection. Tighten them as the numbers improve;
 * never raise one to make a failure go away without understanding it.
 */
const BUDGET = {
  mobile: { imageKB: 450, totalKB: 950 },
  desktop: { imageKB: 500, totalKB: 1000 },
};
const LCP_MS = 2500; // "good" per Core Web Vitals
const CLS = 0.1;

const results = [];
const check = (name, pass, detail = '') =>
  results.push({ pass, line: `${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}` });

const browser = await puppeteer.launch({ headless: 'new' });

for (const vp of VIEWPORTS) {
  const page = await browser.newPage();
  await page.setViewport({
    width: vp.width,
    height: vp.height,
    deviceScaleFactor: vp.dpr,
  });
  await page.setCacheEnabled(false);

  const bytes = { image: 0, script: 0, style: 0, font: 0, other: 0 };
  const imagesSeen = [];

  /**
   * Measure bytes ON THE WIRE, via CDP's `encodedDataLength`.
   *
   * The obvious approach — `content-length`, falling back to the response
   * buffer — is wrong in both directions: a gzipped response has no
   * content-length, so the fallback reports the DECOMPRESSED size (this
   * overstated JS by roughly 3×), and with the cache disabled a preloaded font
   * is fetched twice, so it gets double-charged.
   */
  const cdp = await page.createCDPSession();
  await cdp.send('Network.enable');
  const meta = new Map(); // requestId → { type, url }
  const counted = new Set(); // url → already charged
  cdp.on('Network.responseReceived', (e) => {
    meta.set(e.requestId, { type: e.type, url: e.response.url });
  });
  cdp.on('Network.loadingFinished', (e) => {
    const m = meta.get(e.requestId);
    if (!m || counted.has(m.url)) return;
    counted.add(m.url);
    const type = m.type.toLowerCase();
    const size = e.encodedDataLength || 0;
    const bucket = ['image', 'script', 'stylesheet', 'font'].includes(type)
      ? type === 'stylesheet'
        ? 'style'
        : type
      : 'other';
    bytes[bucket] += size;
    if (type === 'image') imagesSeen.push({ url: m.url.split('/').pop(), size });
  });

  await page.goto(`${BASE}/en`, { waitUntil: 'networkidle0', timeout: 60000 });

  const vitals = await page.evaluate(
    () =>
      new Promise((resolve) => {
        let lcp = 0;
        let cls = 0;
        new PerformanceObserver((list) => {
          for (const e of list.getEntries()) lcp = Math.max(lcp, e.startTime);
        }).observe({ type: 'largest-contentful-paint', buffered: true });
        new PerformanceObserver((list) => {
          for (const e of list.getEntries()) if (!e.hadRecentInput) cls += e.value;
        }).observe({ type: 'layout-shift', buffered: true });
        setTimeout(() => resolve({ lcp, cls }), 1200);
      }),
  );

  const kb = (n) => Math.round(n / 1024);
  const budget = BUDGET[vp.name];

  check(
    `${vp.name}: image weight ≤ ${budget.imageKB}KB`,
    kb(bytes.image) <= budget.imageKB,
    `${kb(bytes.image)}KB across ${imagesSeen.length} image(s)`,
  );
  const total = Object.values(bytes).reduce((a, b) => a + b, 0);
  check(`${vp.name}: total weight ≤ ${budget.totalKB}KB`, kb(total) <= budget.totalKB, `${kb(total)}KB`);
  check(`${vp.name}: LCP ≤ ${LCP_MS}ms`, vitals.lcp <= LCP_MS, `${Math.round(vitals.lcp)}ms`);
  check(`${vp.name}: CLS ≤ ${CLS}`, vitals.cls <= CLS, vitals.cls.toFixed(4));

  console.log(
    `\n─ ${vp.name} (${vp.width}px @${vp.dpr}x): js ${kb(bytes.script)}KB · css ${kb(bytes.style)}KB · font ${kb(bytes.font)}KB · img ${kb(bytes.image)}KB`,
  );
  // Which variant the browser actually chose — the whole point of srcset.
  for (const i of imagesSeen.sort((a, b) => b.size - a.size).slice(0, 4)) {
    console.log(`    ${i.url}  ${kb(i.size)}KB`);
  }

  await page.close();
}

await browser.close();
console.log('');
for (const r of results) console.log(r.line);
const failures = results.filter((r) => !r.pass).length;
console.log(`\n════ ${failures} budget breach(es) ════`);
process.exit(failures ? 1 : 0);
