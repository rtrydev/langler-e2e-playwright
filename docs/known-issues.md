# Known issues

Product defects the E2E suite has surfaced. Tests blocked by an open defect are
disabled with `test.fixme` and listed here; re-enable them once the defect is
fixed and any corrupted data is repaired.

## BUG-1 — `GET /progress` and lesson-result submission return 500 (SM-2 interval overflow)

**Status:** fixed (found 2026-07-21, fixed 2026-07-21 on `langler-backend`
`fix/srs-interval-overflow`). `Schedule` now caps `IntervalDays` at
`progress.MaxIntervalDays` (365), and the progress repository clamps an
unparseable stored `dueDate` to `updatedAt` plus the capped interval instead of
failing the read, so pre-fix corrupted rows recover and self-heal on their next
save. The affected E2E account's corrupted rows were removed. The previously
disabled tests below are re-enabled.

**Symptoms**
- `GET /progress` → `500 {"error":"internal error"}` for the affected user.
- `POST /lessons/{id}/results` → `500` when the lesson references a vocab/grammar
  item whose spaced-repetition row has overflowed (see below). Lessons that
  reference only unaffected items still save.

**Root cause**
`langler-backend/internal/domain/progress/progress.go`:
- `nextInterval` (line ~166) multiplies `IntervalDays` by the ease factor on
  every reschedule with **no upper bound**. Re-studying the same words (each
  `RecordLesson` reschedules the referenced items) grows the interval
  exponentially.
- `Schedule` (line ~152) sets `DueDate = day.AddDate(0, 0, item.IntervalDays)`.
  Once the interval is large enough, the due date overflows past year 9999.
- On read, the persisted due date (observed value `"36646-03-17T00:00:00Z"`)
  fails `time.Parse` against the `2006-01-02T15:04:05...` layout, which only
  accepts a 4-digit year, so the progress repository returns
  `invalid due date: parsing time "36646-03-17T00:00:00Z" ...`.

**Evidence** (CloudWatch `/aws/lambda/langler-prod-api`):
```
ERROR msg="progress request failed" method=GET path=/progress
  error="progress storage failed: invalid due date: parsing time
  \"36646-03-17T00:00:00Z\" as \"2006-01-02T15:04:05.999999999Z07:00\":
  cannot parse \"6-03-17T00:00:00Z\" as \"-\""
```

**Impact**
- The dashboard "Due today" / per-language progress panel cannot render (it
  reads `/progress`).
- A lesson result cannot be saved when it touches an affected item.
- Any real user who reviews the same items enough times reaches the same state;
  it is not specific to the test account. The E2E account hit it after many
  repeated runs seeded the same vocabulary.

**Suggested fix**
1. Cap `IntervalDays` at a sane maximum (e.g. one year, or a small number of
   years) in `nextInterval` / `Schedule` so the due date can never overflow.
2. Make the progress repository tolerant of an out-of-range / unparseable stored
   due date (clamp it, or treat the item as due) so already-corrupted rows
   recover instead of failing the whole request.
3. Repair the existing corrupted progress rows for affected users (no delete
   endpoint exists; an owner break-glass DynamoDB edit is required).

**Formerly disabled tests** (re-enabled with the fix):
- `tests/player.spec.ts` → **"plays the auto-graded lesson to a saved result"** —
  the playthrough works, but the final "Your result was saved." step fails
  because the auto-graded fixture references vocab whose progress row has
  overflowed, so `POST /lessons/{id}/results` returns 500.
- `tests/review.spec.ts` → **"surfaces the due-today review state on the
  dashboard"** — the dashboard calls `GET /progress`, which returns 500, so the
  "Due today" card never renders.

The other player specs (self-assessed, Polish orthography) and the review-session
spec are unaffected and still run — they reference different items or read
`/reviews/due` (which works), not `/progress`.
