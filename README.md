# langler-e2e-playwright

Browser end-to-end tests for [Langler](https://langler.rtrydev.com). The suite drives the
**real** product over HTTP — deployed UI, real Cognito, real API, real DynamoDB — and asserts
what a user sees on desktop (Chromium) and mobile (WebKit) viewports. It builds and mocks
nothing; it points at a URL and signs in as a dedicated test user.

See `AGENTS.md` for conventions. This README is the operator's guide: how to get credentials,
which environment variables to set, the two run targets, and why the worker count is what it is.

## Prerequisites

```bash
npm ci
npx playwright install --with-deps
```

Node 20+ is required.

## The test user comes from Terraform — no manual steps

The suite signs in as a dedicated Cognito user that exists purely from `terraform apply`. In
`langler-tf-infrastructure`, set `e2e_user_email` (via `TF_VAR_e2e_user_email`) and apply; the
`modules/auth` module creates a `CONFIRMED` user with a permanent 24-char password and suppresses
the invite email. Sign-in through the UI then works immediately — there is no console/CLI
activation step. Rotating the password is `terraform apply -replace='module.auth.random_password.e2e[0]'`.

Pull the credentials and endpoints straight from Terraform outputs (run from
`langler-tf-infrastructure/environments/prod`):

```bash
export LANGLER_E2E_EMAIL="$(terraform output -raw e2e_user_email)"
export LANGLER_E2E_PASSWORD="$(terraform output -raw e2e_user_password)"
export LANGLER_E2E_API_URL="$(terraform output -raw api_url)"
export LANGLER_E2E_MACHINE_API_URL="$(terraform output -raw machine_api_url)"
export LANGLER_E2E_COGNITO_CLIENT_ID="$(terraform output -raw cognito_client_id)"
```

`e2e_user_password` is a `sensitive` output; it lives in Terraform state. That is an accepted
trade-off for a user that owns only throwaway `e2e-`-prefixed data.

## Environment variables

| Variable | Required | Source | Purpose |
|---|---|---|---|
| `LANGLER_E2E_BASE_URL` | yes | you choose the target (below) | The environment under test. No default. |
| `LANGLER_E2E_EMAIL` | yes | `terraform output -raw e2e_user_email` | Test user's Cognito username. |
| `LANGLER_E2E_PASSWORD` | yes | `terraform output -raw e2e_user_password` | Test user's password. |
| `LANGLER_E2E_API_URL` | yes | `terraform output -raw api_url` | Human (Cognito-JWT) API base, used by `lib/` for data setup/teardown. |
| `LANGLER_E2E_MACHINE_API_URL` | yes | `terraform output -raw machine_api_url` | Machine (Bearer-token) API base, used by the agentic-import test. |
| `LANGLER_E2E_COGNITO_CLIENT_ID` | yes | `terraform output -raw cognito_client_id` | App client id for the `USER_PASSWORD_AUTH` token `lib/` obtains. |
| `LANGLER_E2E_AWS_REGION` | no (default `eu-central-1`) | deploy region | Cognito region. |
| `LANGLER_E2E_RUN_ID` | no (default random) | you choose | Groups a run's created entities under one `e2e-<runId>-` prefix. |

Nothing is committed: no `.env`, no defaults, no credentials in config. `.auth/` (the saved
session), `test-results/`, and `playwright-report/` are gitignored.

## Targets

### Deployed prod (primary)

```bash
export LANGLER_E2E_BASE_URL="https://langler.rtrydev.com"
npm test
```

This exercises the live personal app. It is safe: every test creates its own run-unique data and
deletes it on teardown (even after a mid-test failure). Durable-state areas (placement tests,
lesson results, SRS rows) have no delete endpoint, so those specs assert **relative** changes
against the dedicated test user, never absolute counts.

### Local static build (pre-deploy)

Serve `langler-ui/out/` (a static export built against the real prod API/Cognito — the
`NEXT_PUBLIC_*` values are baked in at build time) with a server that resolves `/path/` to
`/path/index.html`:

```bash
# in langler-ui, after `npm run build`
npx serve out -l 3000
```

```bash
export LANGLER_E2E_BASE_URL="http://localhost:3000"
npm test
```

The API/Cognito/token endpoints still point at prod, so the same Terraform-sourced credentials and
`LANGLER_E2E_API_URL`/`LANGLER_E2E_MACHINE_API_URL` apply.

## Workers and pacing are a correctness constraint, not tuning

`playwright.config.ts` runs `workers: 2`. This is deliberate. The human API throttles at burst 10
/ 5 req/s overall and **burst 5 / 2 req/s on `POST /lessons/import`**, and both Lambdas run with
reserved concurrency 5. All lesson imports are routed through a single paced helper in `lib/`
(`PacedQueue`, ~1 import/1.2s per worker) with a 429 backoff, so parallel specs cannot rate-limit
each other. Raising the worker count risks `429`s on import; do not increase it without re-checking
those throttles. Machine-token imports additionally respect the per-token 60/min limit — the
agentic test uses one token per run.

## Running

```bash
npm test                              # both projects (desktop-chromium, mobile-webkit)
npm test -- tests/lessons.spec.ts     # one file
npm test -- -g "imports a lesson"     # one test by title
npm test -- --project=desktop-chromium
npx playwright show-report            # last HTML report
npm run lint                          # eslint + tsc --noEmit; must pass before commit
```

The `setup` project signs in once and saves `.auth/user.json`; the two viewport projects reuse it.
Auth-subject tests (`auth.spec.ts`) start unauthenticated by design.

## Reporting a run

State the target URL, the projects, and pass/fail counts in every run summary — an E2E result is
meaningless without its environment. When a test fails against prod, first decide whether the
product or the test is wrong and say which; a failing test against a real defect stays red.

## Cleanup verification

After a run, no `e2e-`-prefixed lessons or tokens should remain. To confirm manually:

```bash
# lessons: none of these should be e2e-<runId>-… titles
curl -s -H "authorization: Bearer $TOKEN" "$LANGLER_E2E_API_URL/lessons" | jq '.items[].title'
```

(Fixtures delete what they create; this is a belt-and-suspenders check.)
