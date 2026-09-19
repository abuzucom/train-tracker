/**
 * Cron-triggered poller for the northwest corridor crossings.
 *
 * One invocation reads the upstream snapshot, overwrites current state,
 * appends an event for each crossing whose status changed, and records the
 * run. The cron fires every minute, continuously. It is deliberately not
 * aligned to local traffic windows, so no daylight saving change can shift it
 * out of alignment.
 *
 * The transition log this writes is the only history that will ever exist.
 * The upstream service overwrites in place and keeps nothing, so a poll that
 * silently does nothing is unrecoverable data loss.
 */
import { fetchSnapshot } from "./feed.js";
import {
  diffStatuses,
  readCurrentStatuses,
  writeFailedRun,
  writeSnapshot,
} from "./store.js";

/**
 * Run one poll against the given database and fetch implementation.
 *
 * Returns an outcome rather than throwing, so a scheduled invocation always
 * leaves a poll_run row behind. A missing row means the Worker itself did not
 * run, which is a different fault from a failed fetch and should look
 * different in the data.
 */
export async function runPoll(database, fetchImpl, now) {
  const startedAt = now();
  const snapshot = await fetchSnapshot(fetchImpl);
  if (snapshot.rows === null) {
    // Leave crossing_state untouched. A failed read is not an observation,
    // and writing one would publish a false "clear" for a blocked crossing.
    await writeFailedRun(database, {
      startedAt,
      httpStatus: snapshot.httpStatus,
      rowCount: null,
      feedLastEditDate: null,
      error: snapshot.error,
    });
    return { ok: false, error: snapshot.error };
  }
  const previous = await readCurrentStatuses(database);
  const changes = diffStatuses(snapshot.rows, previous);
  await writeSnapshot(database, snapshot.rows, changes, {
    startedAt,
    httpStatus: snapshot.httpStatus,
    rowCount: snapshot.rows.length,
    feedLastEditDate: snapshot.feedLastEditDate,
    error: null,
  });
  return { ok: true, changed: changes.length };
}

export default {
  /** Cloudflare cron entry point. */
  async scheduled(event, env, ctx) {
    const now = () => event.scheduledTime ?? Date.now();
    await runPoll(env.DB, globalThis.fetch, now);
  },
};
