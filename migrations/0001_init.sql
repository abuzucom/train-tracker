-- Schema for the northwest corridor crossing poller.
--
-- All timestamps are epoch milliseconds in UTC. Render in America/Chicago.
-- Never derive a local hour by subtracting a fixed offset: Houston observes a
-- daylight saving change, so a fixed offset drifts by an hour twice a year.
--
-- Columns prefixed feed_ hold values the upstream service reported. Columns
-- without that prefix hold values this poller established.

CREATE TABLE IF NOT EXISTS crossing (
  dot_code          TEXT    PRIMARY KEY,
  name              TEXT    NOT NULL,
  corridor_seq      INTEGER NOT NULL UNIQUE,
  lat               REAL    NOT NULL,
  lon               REAL    NOT NULL,
  arcgis_object_id  INTEGER NOT NULL
);

-- One row per crossing, overwritten on every successful poll.
--
-- observed_at is the only freshness signal. feed_time_updated is stored for
-- completeness and must never be shown as a last-updated time: scheduled batch
-- writes land on exact clock boundaries and contaminate it.
--
-- feed_predicted_end and feed_time_to_clear are predictions revised on every
-- tick. One crossing reported "6 MIN" and cleared within one minute. Advisory
-- only.
CREATE TABLE IF NOT EXISTS crossing_state (
  dot_code            TEXT    PRIMARY KEY REFERENCES crossing(dot_code),
  status              TEXT    NOT NULL CHECK (status IN ('clear', 'blocked')),
  feed_start_time     INTEGER,
  feed_predicted_end  INTEGER,
  feed_time_to_clear  TEXT,
  sensor_status       TEXT,
  feed_time_updated   INTEGER,
  observed_at         INTEGER NOT NULL
);

-- Append-only transition log.
--
-- This is the non-backfillable record. The upstream service keeps no history,
-- change tracking is disabled, and no archive exists, so nothing can
-- reconstruct a row that was never written here.
--
-- feed_start_time is the service's own blockage start and is authoritative.
-- observed_at is when this poller saw the change. Both are kept because the
-- blockage end is never reported upstream and can only be inferred from
-- observation.
CREATE TABLE IF NOT EXISTS crossing_event (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  dot_code         TEXT    NOT NULL REFERENCES crossing(dot_code),
  status           TEXT    NOT NULL CHECK (status IN ('clear', 'blocked')),
  feed_start_time  INTEGER,
  observed_at      INTEGER NOT NULL,
  created_at       INTEGER NOT NULL
);

-- Supports reading one crossing's transitions in order, which is what
-- direction inference will need once blocked/clear is established.
CREATE INDEX IF NOT EXISTS crossing_event_code_time
  ON crossing_event (dot_code, observed_at);

-- One row per poll attempt, successful or not.
--
-- Without this an upstream stall is indistinguishable from a genuinely clear
-- corridor. A gap in these rows is the signal that the poller stopped.
CREATE TABLE IF NOT EXISTS poll_run (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at           INTEGER NOT NULL,
  http_status          INTEGER,
  row_count            INTEGER,
  feed_last_edit_date  INTEGER,
  error                TEXT
);

CREATE INDEX IF NOT EXISTS poll_run_started_at ON poll_run (started_at);
