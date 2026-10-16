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
