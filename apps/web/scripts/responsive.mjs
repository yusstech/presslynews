/**
 * Responsive sweep.
 *
 * Checks the things that are objectively wrong at a given width rather than
 * matters of taste: content escaping the viewport, touch targets too small to
 * hit, and text below a readable size. Runs over both LTR and RTL because a
 * layout can be sound in English and broken in Arabic.
 *
 * Needs a live server on :3000 with the API up.
 */
import puppeteer from 'puppeteer';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

const WIDTHS = [
  { name: 'mobile', width: 375, height: 812, touch: true },
  { name: 'tablet', width: 768, height: 1024, touch: true },
  { name: 'laptop', width: 1280, height: 800, touch: false },
  { name: 'desktop', width: 1920, height: 1080, touch: false },
];

/** WCAG 2.5.5 asks for 44×44; 24×24 is the AA floor (2.5.8). */
const MIN_TARGET = 24;
/** Anything under this is not comfortably readable as body text. */
const MIN_FONT_PX = 12;

const results = [];
const check = (name, pass, detail = '') =>
  results.push({ pass, line: `${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}` });

const browser = await puppeteer.launch({ headless: 'new' });

/**
 * @param {object} [opts]
 * @param {boolean} [opts.expectSectionNav] Reader surfaces only — the Newsroom
 *   is the authenticated publishing app and carries no section navigation.
 */
async function sweep(path, label, opts = {}) {
  const { expectSectionNav = true } = opts;
  for (const vp of WIDTHS) {
    const page = await browser.newPage();
    await page.setViewport({ width: vp.width, height: vp.height, hasTouch: vp.touch });
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle0', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 500)); // entrance animations settle

    const findings = await page.evaluate(
      ({ minTarget, minFont }) => {
        const out = { overflow: null, offenders: [], smallTargets: [], smallText: [] };

        // 1. Nothing may scroll the page sideways.
        const de = document.documentElement;
        if (de.scrollWidth > de.clientWidth + 1) {
          out.overflow = { scrollWidth: de.scrollWidth, clientWidth: de.clientWidth };
          // Name what is actually sticking out — a width alone is not actionable.
          for (const el of document.querySelectorAll('body *')) {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) continue;
            if (r.right > de.clientWidth + 1 || r.left < -1) {
              const style = getComputedStyle(el);
              if (style.position === 'fixed') continue;
              out.offenders.push(
                `<${el.tagName.toLowerCase()} class="${(el.className || '').toString().slice(0, 60)}"> right=${Math.round(r.right)}`,
              );
              if (out.offenders.length >= 4) break;
            }
          }
        }

        // 2. Interactive things must be big enough to hit.
        for (const el of document.querySelectorAll('a, button, input, select, [role="button"]')) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue; // hidden
          if (getComputedStyle(el).position === 'fixed') continue;
          if (r.height < minTarget || r.width < minTarget) {
            out.smallTargets.push(
              `<${el.tagName.toLowerCase()}> ${Math.round(r.width)}×${Math.round(r.height)} "${(el.textContent || '').trim().slice(0, 24)}"`,
            );
          }
        }

        // 3. Body copy must be readable.
        for (const el of document.querySelectorAll('p, li, span, a, h1, h2, h3')) {
          if (!el.textContent?.trim()) continue;
          const size = parseFloat(getComputedStyle(el).fontSize);
          if (size && size < minFont) {
            out.smallText.push(`${Math.round(size)}px "${el.textContent.trim().slice(0, 24)}"`);
          }
        }

        // 4. Section navigation must be REACHABLE at every width.
        //    The header nav was `hidden md:flex` with nothing in its place, so
        //    below 768px the Reader had no section links at all — and none of
        //    the checks above noticed, because a missing element cannot
        //    overflow, be too small, or be unreadable.
        const visible = (el) => {
          const s = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0;
        };
        out.sectionLinks = [
          ...document.querySelectorAll('header a[href*="/topic/"]'),
        ].filter(visible).length;

        out.smallTargets = [...new Set(out.smallTargets)].slice(0, 5);
        out.smallText = [...new Set(out.smallText)].slice(0, 5);
        return out;
      },
      { minTarget: MIN_TARGET, minFont: MIN_FONT_PX },
    );

    const tag = `${label} @ ${vp.name} (${vp.width}px)`;
    check(
      `${tag}: no horizontal overflow`,
      !findings.overflow,
      findings.overflow
        ? `${findings.overflow.scrollWidth} > ${findings.overflow.clientWidth}; ${findings.offenders.join(' | ')}`
        : '',
    );
    check(
      `${tag}: touch targets ≥ ${MIN_TARGET}px`,
      findings.smallTargets.length === 0,
      findings.smallTargets.join(' | '),
    );
    check(
      `${tag}: text ≥ ${MIN_FONT_PX}px`,
      findings.smallText.length === 0,
      findings.smallText.join(' | '),
    );
    if (expectSectionNav) {
      check(
        `${tag}: section nav reachable`,
        findings.sectionLinks > 0,
        `${findings.sectionLinks} section link(s) visible in the header`,
      );
    }

    await page.close();
  }
}

await sweep('/en', 'home');
await sweep('/ar', 'home (RTL)');

const articles = await fetch('http://localhost:4000/api/content/articles?limit=1').then((r) =>
  r.json(),
);
if (articles[0]?.slug) {
  await sweep(`/en/article/${articles[0].slug}`, 'article');

  // `--header-h` is a hand-maintained number that must equal the real header
  // height, or the sticky reading-progress bar overlaps the mobile nav strip.
  // Assert it rather than trusting it.
  for (const vp of WIDTHS) {
    const page = await browser.newPage();
    await page.setViewport({ width: vp.width, height: vp.height });
    await page.goto(`${BASE}/en/article/${articles[0].slug}`, { waitUntil: 'networkidle0' });
    const { headerH, declared } = await page.evaluate(() => ({
      headerH: Math.round(document.querySelector('header').getBoundingClientRect().height),
      declared: parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue('--header-h'),
      ),
    }));
    check(
      `--header-h matches the header @ ${vp.name} (${vp.width}px)`,
      Math.abs(headerH - declared) <= 1,
      `declared ${declared}px, actual ${headerH}px`,
    );
    await page.close();
  }
}
await sweep('/en/newsroom/login', 'newsroom login', { expectSectionNav: false });

await browser.close();
for (const r of results) console.log(r.line);
const failures = results.filter((r) => !r.pass).length;
console.log(`\n════ ${failures} responsive issue(s) ════`);
process.exit(failures ? 1 : 0);
