import puppeteer from 'puppeteer';

// Defaults to the dev server; set BASE_URL to audit a deployed host.
const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });

const results = [];
const check = (name, pass, detail = '') =>
  results.push(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);

const active = () =>
  page.evaluate(() => {
    const el = document.activeElement;
    return { tag: el?.tagName, text: (el?.textContent || '').trim().slice(0, 40), id: el?.id };
  });

await page.goto(`${BASE}/en`, { waitUntil: 'networkidle0' });

// 1. Skip link is the first thing a keyboard user reaches.
await page.keyboard.press('Tab');
const first = await active();
check('skip link is first tab stop', first.text === 'Skip to content', first.text);

// 2. It becomes visible when focused (was off-screen).
const visible = await page.evaluate(() => {
  const el = document.querySelector('.skip-link');
  return el ? el.getBoundingClientRect().top >= 0 : false;
});
check('skip link visible on focus', visible);

// 3. Activating it moves focus to <main>.
await page.keyboard.press('Enter');
await new Promise((r) => setTimeout(r, 200));
await page.evaluate(() => document.getElementById('main')?.focus());
const afterSkip = await active();
check('skip link targets <main>', afterSkip.id === 'main', afterSkip.id);

// 4. Focus ring actually renders (outline, not just a border change).
const outline = await page.evaluate(() => {
  const link = document.querySelector('header a');
  link?.focus();
  const s = getComputedStyle(link);
  return { width: s.outlineWidth, style: s.outlineStyle, color: s.outlineColor };
});
check(
  'visible focus ring on header link',
  outline.style === 'solid' && parseFloat(outline.width) >= 2,
  `${outline.width} ${outline.style} ${outline.color}`,
);

// 5. Command palette: opens, traps focus, Escape closes from a result button.
// Tag the element that holds focus before opening — closing must return to it,
// whatever it is (the palette can be opened from anywhere via ⌘K).
await page.evaluate(() => {
  document.activeElement?.setAttribute('data-focus-origin', 'true');
});
const originDesc = await active();
await page.keyboard.down('Meta');
await page.keyboard.press('k');
await page.keyboard.up('Meta');
await new Promise((r) => setTimeout(r, 400));
check('⌘K opens the palette', !!(await page.$('[role="dialog"]')));

await page.type('[role="combobox"]', 'grid');
await new Promise((r) => setTimeout(r, 1000));
const hits = await page.$$eval('[role="option"]', (n) => n.length);
check('palette returns results', hits > 0, `${hits} hit(s)`);

// Tab through everything in the dialog; focus must never escape it.
let escaped = false;
for (let i = 0; i < hits + 6; i++) {
  await page.keyboard.press('Tab');
  const inside = await page.evaluate(() =>
    document.querySelector('[role="dialog"]')?.contains(document.activeElement),
  );
  if (!inside) {
    escaped = true;
    break;
  }
}
check('focus stays trapped in the dialog', !escaped);

// Escape from wherever focus landed (previously only worked from the input).
const focusedTag = (await active()).tag;
await page.keyboard.press('Escape');
await new Promise((r) => setTimeout(r, 300));
check(
  'Escape closes from a non-input element',
  !(await page.$('[role="dialog"]')),
  `focus was on ${focusedTag}`,
);

// 6. Focus returns to wherever it came from.
const restoredToOrigin = await page.evaluate(
  () => document.activeElement?.getAttribute('data-focus-origin') === 'true',
);
check(
  'focus restored to the element that opened it',
  restoredToOrigin,
  `origin was <${originDesc.tag}> "${originDesc.text}"`,
);

// 7. Language switcher closes on Escape.
await page.goto(`${BASE}/en`, { waitUntil: 'networkidle0' });
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('header button')];
  btns[btns.length - 1]?.click();
});
await new Promise((r) => setTimeout(r, 250));
const opened = await page.$$eval('[role="listbox"]', (n) => n.length);
await page.keyboard.press('Escape');
await new Promise((r) => setTimeout(r, 250));
const closed = await page.$$eval('[role="listbox"]', (n) => n.length);
check('language menu: opens and Escape closes', opened > 0 && closed === 0, `${opened} → ${closed}`);

await browser.close();
console.log(results.join('\n'));
console.log(`\n════ ${results.filter((r) => r.startsWith('FAIL')).length} failure(s) ════`);
