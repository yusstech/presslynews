/**
 * Keeps the design system real.
 *
 * An audit on 2026-07-26 found `@pressly/ui` exported a Button that the app used
 * ZERO times, while carrying 20 raw `<button>` elements across 18 different
 * hand-written class strings. The consequence was that editing the shared
 * component changed nothing on screen — the exact reason design fixes "didn't
 * show up consistently across pages".
 *
 * This check fails the build when a control is hand-rolled instead of composed,
 * so the system cannot quietly erode again.
 *
 * Run: pnpm --filter @pressly/web design-system
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'src');

/**
 * Genuine exemptions — these cannot use the component and never will.
 * The palette and switcher rows are listbox options carrying combobox ARIA
 * that Button must not impose.
 */
const EXEMPT = new Set([
  'src/components/command-palette.tsx',
  'src/components/language-switcher.tsx',
]);

/**
 * DEBT, not exemption — now empty. Reader and Newsroom are both fully migrated.
 * If you ever add an entry here, it is a promise to come back, not a licence to
 * hand-roll: the list must only ever shrink.
 */
const PENDING_MIGRATION = new Set([]);

const ALLOWED = new Set([...EXEMPT, ...PENDING_MIGRATION]);

const files = [];
(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx$/.test(p)) files.push(p);
  }
})(SRC);

const findings = [];

for (const file of files) {
  const rel = relative(ROOT, file);
  if (ALLOWED.has(rel)) continue;
  const src = readFileSync(file, 'utf8');
  const lines = src.split('\n');

  lines.forEach((line, i) => {
    const at = `${rel}:${i + 1}`;
    const trimmed = line.trim();

    // Prose mentioning a tag is not a use of it — a doc comment reading
    // "value for <input type=datetime-local>" was being reported as a control.
    if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')) return;

    // An escape hatch for the genuinely different cases — chiefly the article
    // editor's writing canvas, where the headline and summary are deliberately
    // unstyled text surfaces rather than form fields. Requires a reason nearby,
    // so every exception is auditable in the diff. The window covers a wrapped
    // multi-line comment.
    const preceding = lines.slice(Math.max(0, i - 4), i).join('\n');
    if (/design-system-ignore:/.test(preceding)) return;

    // `$` matters: most of these are multi-line elements whose opening tag is
    // the whole line, so a trailing-character class alone misses them.
    if (/<button(\s|>|$)/.test(line)) {
      findings.push([at, 'raw <button> — use <Button>/<IconButton> from @pressly/ui']);
    }
    // A hand-rolled input is the same failure in a different shape. Hidden
    // fields and file pickers are exempt: a `type="file"` input is a native
    // control that the design system wraps with a Button and triggers
    // programmatically, so it is never styled directly.
    if (
      /<input(\s|>|$)/.test(line) &&
      !/type=["'](hidden|file)["']/.test(line)
    ) {
      findings.push([at, 'raw <input> — use <Input>/<Field> from @pressly/ui']);
    }
    // The tell-tale of a button assembled from utilities.
    if (/className=["'][^"']*\bbg-accent\b[^"']*\brounded-/.test(line)) {
      findings.push([at, 'hand-rolled accent button styling — use <Button variant="filled">']);
    }
  });
}

if (findings.length === 0) {
  console.log(`PASS  no hand-rolled controls in ${files.length - ALLOWED.size} checked files`);
  if (PENDING_MIGRATION.size > 0) {
    console.log(
      `\n      ${PENDING_MIGRATION.size} file(s) still awaiting migration (tracked debt, not exempt):`,
    );
    for (const f of PENDING_MIGRATION) console.log(`        ${f}`);
  }
  process.exit(0);
}

console.log(`FAIL  ${findings.length} hand-rolled control(s) — compose from @pressly/ui instead:\n`);
for (const [at, why] of findings) console.log(`  ${at}\n      ${why}`);
console.log(
  `\nIf a case genuinely cannot use the component, add it to ALLOWED in ${relative(ROOT, new URL(import.meta.url).pathname)} with a reason.`,
);
process.exit(1);
