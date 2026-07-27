import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';
import tseslint from 'typescript-eslint';

/**
 * One flat config for the whole monorepo.
 *
 * There was no ESLint configuration anywhere until now, so `pnpm lint` had
 * never run: `next lint` would open its interactive setup prompt and exit 1,
 * which in CI reads as a failing lint step that nobody could reproduce.
 *
 * `eslint-config-next` is still eslintrc-shaped, hence `FlatCompat`. It is
 * scoped to `apps/web` because its rules are about the Next runtime — pages,
 * `next/image`, `next/link` — and applying them to a Node script or a plain
 * package produces noise about files that will never be rendered.
 *
 * Type-aware linting is deliberately not enabled. `tsc --noEmit` already runs
 * over every package and catches what type information buys; turning it on here
 * would mean a second full type-check on every lint for rules that mostly
 * restate it.
 */
const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

export default tseslint.config(
  {
    // Build output, dependencies and the Prisma client. Flat config has no
    // implicit ignores beyond node_modules, so `.next` must be named or every
    // lint walks tens of thousands of generated files.
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/dist/**',
      '**/generated/**',
      'packages/db/prisma/migrations/**',
      // Written by `next dev`/`next build`, not by us.
      '**/next-env.d.ts',
    ],
  },

  ...tseslint.configs.recommended,

  {
    rules: {
      // The codebase uses `_`-prefixed parameters for the ones a signature
      // requires but a body ignores — route handlers do this constantly.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // `any` is a real smell, but an error here would fail the build on
      // existing code that is not wrong, only untyped at a boundary.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },

  // Next-specific rules, wherever code ends up inside the Next runtime. That
  // includes the two packages that render JSX into it — `article-renderer`
  // already carried a `@next/next/no-img-element` disable that did nothing,
  // because the rule was not defined where the file lives.
  ...compat.extends('next/core-web-vitals').map((config) => ({
    ...config,
    files: [
      'apps/web/**/*.{ts,tsx,js,jsx,mjs}',
      'packages/ui/src/**/*.{ts,tsx}',
      'packages/article-renderer/src/**/*.{ts,tsx}',
    ],
  })),

  {
    files: [
      'apps/web/**/*.{ts,tsx,js,jsx,mjs}',
      'packages/ui/src/**/*.{ts,tsx}',
      'packages/article-renderer/src/**/*.{ts,tsx}',
    ],
    rules: {
      // This is an App Router app with no `pages` directory, so the rule has
      // nothing to check and prints a "Pages directory cannot be found"
      // warning on every run instead.
      '@next/next/no-html-link-for-pages': 'off',
    },
  },

  {
    // Verification scripts and Prisma seeds are Node programs run by hand. They
    // print to stdout by design and are not part of the shipped bundle.
    files: ['**/scripts/**', 'packages/db/prisma/**', '**/*.mjs', '**/*.config.*'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      // A config file's default export is the config. Naming it first adds a
      // line and no meaning.
      'import/no-anonymous-default-export': 'off',
    },
  },
);
