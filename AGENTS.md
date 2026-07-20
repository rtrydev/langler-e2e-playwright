# This may not be the Playwright in your training data

<!-- Reviewed 2026-07-20. Re-check when bumping @playwright/test. -->

Playwright moves fast and much written material predates the current idioms. Before writing a test, check that you are not reaching for a legacy approach:

- **Locators only.** `page.$`, `page.$$`, `ElementHandle`, and `page.evaluate` for element access are legacy. Use `page.getByRole(...)` and friends; locators re-resolve and auto-wait.
- **Web-first assertions auto-retry.** `await expect(locator).toBeVisible()` waits by itself. Never `page.waitForTimeout`, never a manual polling loop, never `waitForSelector` where an assertion expresses the intent.
- **`page.waitForNavigation` is deprecated.** Use `page.waitForURL` or, better, assert on what the destination page shows.
- **Auth setup is a project, not `globalSetup`.** Use a `setup` project that other projects declare in `dependencies`, and share the session via `storageState`.
- **`waitUntil: "networkidle"` is discouraged.** Assert on visible content instead.

When unsure whether an API is current, check `node_modules/@playwright/test` or the docs rather than guessing from memory.

# langler-e2e-playwright

Browser end-to-end tests for Langler, built on `@playwright/test`. This repo drives the real product over HTTP — the deployed UI, real Cognito, real API, real database — and asserts what a user actually sees on desktop and mobile viewports.

It is deliberately a separate repo: it tests the running system, not any repo's source. Nothing here imports code from `langler-ui` or `langler-backend`, and nothing here mocks what they do. This suite does not build or serve the UI either; it points at a URL — a deployed environment, or a locally served `out/` build of `langler-ui`.

## Commands

- Install: `npm ci`
- Browsers: `npx playwright install --with-deps`
- Lint/typecheck: `npm run lint` — must pass before every commit
- Run the suite: `npm test`
- One file: `npm test -- tests/lessons.spec.ts`
- One test: `npm test -- -g "imports a lesson"`
- Debug interactively: `npx playwright test --ui`
- Last report: `npx playwright show-report`

Running the suite requires a target (see Targets and auth). Before proposing a commit, run `npm run lint` and at minimum the specs you touched against a real target, and say in the summary which target and what passed.

## What you must not do

These are hard limits, not preferences:

- **Never commit credentials, `.env` files, or `.auth/` storage state.** Traces, videos, and screenshots capture a logged-in session; `test-results/` and `playwright-report/` stay gitignored too.
- **Never hardcode a base URL, username, or password** — not in a config default, not as a placeholder. Everything comes from environment variables.
- **Never mutate data the test did not create.** Prod is a live personal app. Tests create their own data, act on it, and clean it up; a test that edits or deletes something it merely found is a data-loss bug.
- **Never stub the Langler API with `page.route`.** Faking the backend in an E2E suite proves nothing this repo exists to prove. Intercepting genuinely third-party noise (telemetry, fonts) is the only exception.
- **Never mask flakiness** — no retry counts raised to make a test pass, no sleeps, no `.serial` to paper over ordering bugs. A flaky test is a failing test: fix it or delete it.

If a task appears to require one of the above, stop and explain what you would need.

## Layout

- `playwright.config.ts` — projects for desktop Chromium and mobile WebKit, plus the `setup` auth project. Trace on first retry, screenshots on failure.
- `tests/` — specs grouped by product area (`lessons.spec.ts`, `glossary.spec.ts`, `assessments.spec.ts`), mirroring the UI's routes. Flat; no per-viewport duplicates.
- `tests/auth.setup.ts` — signs in once through the real UI and writes storage state.
- `fixtures/` — custom `test` fixtures: authenticated pages, per-test data with built-in cleanup.
- `lib/` — the only place that makes raw HTTP calls: typed helpers against the Langler API for test-data setup and teardown. Specs never call `fetch` or `request` inline.
- `.auth/` — storage state written by setup; gitignored.

## Targets and auth

- `LANGLER_E2E_BASE_URL` — the environment under test. Required; there is no default.
- `LANGLER_E2E_EMAIL` / `LANGLER_E2E_PASSWORD` — a dedicated test user's Cognito credentials. Never a real person's account.

The `setup` project logs in through the actual login form and saves `storageState`; every other project reuses it. Do not log in per test — it is slow and hammers Cognito. The exception is tests whose subject *is* authentication (login, logout, session expiry); those start unauthenticated and say so.

## Writing tests

- Test what the user sees and does. Navigate, click, type, and assert on visible content — never on network responses, localStorage internals, or CSS classes. If a behaviour can only be verified by inspecting implementation detail, it belongs in that repo's own tests, not here.
- Locate elements the way a user finds them: `getByRole` with an accessible name first, then `getByLabel` / `getByPlaceholder` / `getByText`. A `data-testid` is the last resort, and adding one means a change in `langler-ui` — propose it there, don't work around its absence with CSS or XPath selectors here.
- Every test is independent and parallel-safe: it creates the data it needs through `lib/` helpers, makes no assumptions about existing content, and does not depend on another test having run. `test.describe.serial` is banned — steps that only make sense in order are one test.
- Cleanup lives in fixtures or `afterEach`, uses the `lib/` helpers, and must cope with the test having failed halfway through. Name created entities with a run-unique prefix so orphans are identifiable.
- Every spec runs in both the desktop and mobile projects by default. Write it once, viewport-agnostic; branch on project only when the UI genuinely differs (a drawer replacing a sidebar), and assert the difference explicitly rather than skipping the mobile run.
- Keep fixtures light. A fixture that yields a page and a couple of typed actions is the ceiling; do not build page-object class hierarchies. If a spec file needs a paragraph of setup prose to understand, restructure it.
- One user journey per test, named for the behaviour: `test("imports a lesson and sees it in the catalog")`, not `test("lesson test 1")`. Assert the outcome the user cares about, not every intermediate state.

## Comments

Same policy as every Langler repo: write tests that do not need explaining. No docstrings, no narration, no section banners, no commented-out code. A comment is warranted only for a constraint the code cannot express — a workaround for a browser or Playwright bug with a link, or a real-world timing constraint that is invisible locally.

## Workflow

- Branch from `main`, conventional commits, never push directly to `main`.
- Keep diffs scoped to the request; mention unrelated breakage rather than fixing it in the same change.
- State in every summary which target URL the suite ran against, which projects (desktop/mobile), and the pass/fail counts. An E2E result is meaningless without its environment.
- When a test fails against a real environment, first determine whether the product or the test is wrong, and say which. A test edited until it passes is evidence destroyed.
