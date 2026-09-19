/**
 * Persists crossing state, transitions, and poll outcomes in D1.
 *
 * Every value written here originates upstream and is untrusted. All SQL uses
 * prepared statements with bound parameters. No statement is ever assembled
 * from a feed value.
 *
 * Timestamps are stored as epoch milliseconds in UTC. Rendering in
 * America/Chicago belongs to the reader, which must apply the zone rather than
 * subtract a fixed offset. Houston observes a daylight saving change, so a
 * fixed offset silently drifts by an hour twice a year.
 */

/** Read the stored status of every crossing, keyed by federal code. */
export async function readCurrentStatuses(database) {
  const { results } = await database
    .prepare("SELECT dot_code, status FROM crossing_state")
    .all();
  return new Map((results ?? []).map((row) => [row.dot_code, row.status]));
}

/**
 * Return the rows whose status differs from stored state.
 *
 * A crossing absent from `previous` is a first observation, not a transition,
 * so it yields no event. That keeps the very first poll from writing 11
 * spurious edges.
 */
export function diffStatuses(rows, previous) {
  const changes = [];
  for (const row of rows) {
    const stored = previous.get(row.dotCode);
    if (stored !== undefined && stored !== row.status) {
      changes.push(row);
    }
  }
  return changes;
}

/** Build the statement that overwrites one crossing's current state. */
function upsertStateStatement(database, row, observedAt) {
  return database
    .prepare(
      `INSERT INTO crossing_state (
         dot_code, status, feed_start_time, feed_predicted_end,
         feed_time_to_clear, sensor_status, feed_time_updated, observed_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(dot_code) DO UPDATE SET
         status = excluded.status,
         feed_start_time = excluded.feed_start_time,
         feed_predicted_end = excluded.feed_predicted_end,
         feed_time_to_clear = excluded.feed_time_to_clear,
         sensor_status = excluded.sensor_status,
         feed_time_updated = excluded.feed_time_updated,
         observed_at = excluded.observed_at`,
    )
    .bind(
      row.dotCode,
      row.status,
      row.feedStartTime,
      row.feedPredictedEnd,
      row.feedTimeToClear,
      row.sensorStatus,
      row.feedTimeUpdated,
      observedAt,
    );
}

/**
 * Build the statement that appends one transition.
 *
 * `feed_start_time` is the service's own blockage start and is authoritative.
 * `observed_at` is this poller's clock. Keeping both separates what upstream
 * reported from when the poller saw it, which matters because the blockage end
 * is never reported and can only be inferred from observation.
 */
function appendEventStatement(database, row, observedAt) {
  return database
    .prepare(
      `INSERT INTO crossing_event (
         dot_code, status, feed_start_time, observed_at, created_at
       ) VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(row.dotCode, row.status, row.feedStartTime, observedAt, observedAt);
}

/** Build the statement recording one poll attempt, successful or not. */
function recordPollRunStatement(database, run) {
  return database
    .prepare(
      `INSERT INTO poll_run (
         started_at, http_status, row_count, feed_last_edit_date, error
       ) VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(
      run.startedAt,
      run.httpStatus,
      run.rowCount,
      run.feedLastEditDate,
      run.error,
    );
}

/**
 * Write one successful poll: current state, any transitions, and the run.
 *
 * All statements go in one batch so a partially applied poll cannot leave
 * state and its transition log disagreeing.
 */
export async function writeSnapshot(database, rows, changes, run) {
  const statements = rows.map((row) =>
    upsertStateStatement(database, row, run.startedAt),
  );
  for (const change of changes) {
    statements.push(appendEventStatement(database, change, run.startedAt));
  }
  statements.push(recordPollRunStatement(database, run));
  await database.batch(statements);
}

/**
 * Record a failed poll and touch nothing else.
 *
 * A failed fetch must never reach crossing_state. Writing "clear" because the
 * service was unreachable would render as "no train" on a blocked corridor.
 */
export async function writeFailedRun(database, run) {
  await recordPollRunStatement(database, run).run();
}
