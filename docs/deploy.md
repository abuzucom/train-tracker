# Deploying the poller

Every step here is an active-human action. Agents author `wrangler.toml` and
`migrations/` as repository content and run no `wrangler` command, no deploy,
and no `d1 execute`. `hooks/block_infrastructure_access.py` matches cloud
credential paths, Terraform, and Kubernetes, and does not match
`wrangler.toml`, so no checker enforces this. It is a human control.

Read `wrangler.toml` and both migrations before running anything.

## 1. Create the database

```console
npx wrangler d1 create train-tracker
```

Copy the printed `database_id` into the empty `database_id` field in
`wrangler.toml`, then commit that change.

## 2. Apply the migrations

```console
npx wrangler d1 migrations apply train-tracker --remote
```

`0001_init.sql` creates the four tables and two indexes. `0002_seed_crossings.sql`
inserts the 11 crossings. Both are re-runnable: the schema uses
`CREATE TABLE IF NOT EXISTS` and the seed upserts.

Confirm the seed landed:

```console
npx wrangler d1 execute train-tracker --remote \
  --command "SELECT corridor_seq, dot_code, name FROM crossing ORDER BY corridor_seq"
```

Expect 11 rows, sequence 1 through 11, starting at Gessner `743650H` and ending
at Hempstead `743677S`.

## 3. Deploy

```console
npx wrangler deploy
```

The cron trigger `* * * * *` starts immediately. It runs continuously and is
not aligned to local traffic windows, so no daylight saving change affects it.

## 4. Confirm it is running

After roughly 30 minutes:

```console
npx wrangler d1 execute train-tracker --remote \
  --command "SELECT COUNT(*) AS runs, MAX(started_at) AS latest FROM poll_run"
```

Expect about one row per minute. A gap means the Worker stopped, which is a
different fault from a failed fetch and looks different in the data: a failed
fetch still writes a `poll_run` row, carrying `error` and leaving
`crossing_state` untouched.

Check for errors:

```console
npx wrangler d1 execute train-tracker --remote \
  --command "SELECT started_at, http_status, error FROM poll_run WHERE error IS NOT NULL ORDER BY started_at DESC LIMIT 20"
```

## 5. Watch for the first real transition

```console
npx wrangler d1 execute train-tracker --remote \
  --command "SELECT observed_at, dot_code, status FROM crossing_event ORDER BY observed_at DESC LIMIT 50"
```

This is what answers the open question about whether the corridor's
`sensorType: V` crossings report at all. The corridor's traffic is sporadic and
concentrated in three local windows, so give it about a day covering all three
before drawing any conclusion. `docs/recon/feed-behavior.md` records why a
short null sample proves nothing.

`observed_at` is epoch milliseconds in UTC. Render in `America/Chicago`. Never
subtract a fixed offset.

## Rolling back

The Worker holds no state of its own. Stopping collection leaves the recorded
history intact.

To stop it, remove the `[triggers]` block from `wrangler.toml` and redeploy:

```console
npx wrangler deploy
```

A deploy with no `crons` entry clears the schedule. Deleting the Worker
entirely also works and is the heavier option.

Prefer stopping the trigger over deleting the database. `crossing_event` cannot
be rebuilt from any source, so a deleted database is unrecoverable history.
