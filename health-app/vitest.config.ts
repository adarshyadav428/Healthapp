import { defineConfig } from 'vitest/config'

/**
 * This project had no vitest.config.ts for its whole life, and that was worth
 * keeping until render tests needed a setup file — `setupFiles` has no
 * per-file equivalent, so the config is the only place it can be declared.
 *
 * `environment: 'node'` is set EXPLICITLY rather than left to the default, so
 * the ~120 existing specs resolve exactly as they did before this file
 * existed. Render tests opt into jsdom one at a time with a
 *
 *     // @vitest-environment jsdom
 *
 * docblock at the top of the file. That is deliberate over
 * `environmentMatchGlobs`: it keeps the environment visible IN the file, which
 * is how the rest of this suite explains itself, and it has no landmine when a
 * spec is moved between directories.
 */
export default defineConfig({
  test: {
    environment: 'node',
    // Runs for EVERY spec, node and jsdom alike — see the guards in the file.
    setupFiles: ['./tests/render/support/setup.ts'],
    css: false,
  },
  // NOT `esbuild:` — Vitest 4 ships Vite 8, which transforms with **oxc**, and
  // setting both makes Vite print "esbuild options will be ignored" and then
  // fail to parse every .tsx file. tsconfig.json sets "jsx": "preserve"
  // (correctly — Next/SWC does the real transform at build time), oxc honours
  // that, and preserved JSX is a parse error by the time it reaches the
  // runtime. This override applies to the test transform only; `next build` is
  // untouched.
  oxc: {
    jsx: {
      runtime: 'automatic',
      importSource: 'react',
    },
  },
})
