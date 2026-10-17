# Agent notes

Conventions for anyone (human or AI) changing this repository.

- TypeScript, strict mode. No `any` without a comment saying why.
- Domain logic lives in `src/lib/` as pure functions, with tests next to it
  (`*.test.ts`). UI code in `src/app/` stays thin and calls into `src/lib/`.
- Styling with Tailwind utility classes; follow the patterns already in
  `src/app/page.tsx`, including the `dark:` variants.
- Before you finish any change, these must pass:

  ```bash
  npm run lint
  npm run test
  npm run build
  ```

- Add a test with every behaviour change in `src/lib/`. Keep tests
  deterministic: pass `id` and `now` into `createTask` instead of relying on
  randomness or the clock.
- Do not add dependencies for things that are a few lines of code.

- The production build is a static export (`output: "export"` in next.config.ts) deployed to GitHub Pages; keep the app fully client-side.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
