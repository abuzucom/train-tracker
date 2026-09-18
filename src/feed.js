/**
 * Reads the upstream ArcGIS feature service.
 *
 * The service is a state table of 56 rows overwritten roughly every 30
 * seconds. It keeps no history, change tracking is disabled, and no archive
 * exists, so a row missed here is lost permanently.
 *
 * Every value the service returns is untrusted input. Nothing read here is
 * ever interpolated into SQL. The store binds values through prepared
 * statements.
 */
import {
  CORRIDOR_CODES,
  CORRIDOR_CROSSINGS,
  CORRIDOR_CROSSING_COUNT,
} from "./corridor.js";

const SERVICE_BASE =
  "https://services.arcgis.com/NummVBqZSIJKUeVR/arcgis/rest/services" +
  "/Train_Watch_Layer/FeatureServer/0/query";

/**
 * Fields the query requests.
 *
 * `timeUpdated` is requested and stored for completeness. It is never a
 * freshness signal: scheduled batch writes land on exact clock boundaries and
 * contaminate it. Freshness comes from the poller's own observation time.
 */
const OUT_FIELDS = [
  "code",
  "crossingStatus",
  "sensorStatus",
  "startTime",
  "endTime",
  "timeToClear",
  "timeUpdated",
].join(",");

/** The two values the upstream `crossingStatus` domain allows. */
const VALID_STATUSES = Object.freeze(new Set(["clear", "blocked"]));

/** ASCII control characters, removed from upstream text before it is stored. */
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/g;

/** Longest upstream fragment repeated back inside an error message. */
const MAX_DESCRIBED_CHARS = 80;

/**
 * Deadline for one upstream read, in milliseconds.
 *
 * Without a deadline an upstream that accepts the connection and then stalls
 * holds the invocation until the runtime kills it. The kill lands before the
 * failed run reaches D1, so no `poll_run` row appears, and an absent row means
 * the Worker never ran. A stalled upstream would therefore be recorded as the
 * one fault it is not, and the gap signal the schema exists to provide would
 * misreport. The deadline sits well inside the cron invocation budget so the
 * ordinary failure path records the run instead.
 */
const FETCH_TIMEOUT_MS = 20_000;

/**
 * Largest upstream body accepted, in bytes.
 *
 * The filtered query returns about 2 KB. The row-count guard runs only after
 * parsing, so an oversized body would already be resident. This bound rejects
 * the read first.
 */
const MAX_BODY_BYTES = 1_048_576;

/**
 * Build the query URL.
 *
 * The URL is constructed once at module load and returned unchanged. The
 * service ETag is a table-version token shared across query shapes, so an ETag
 * taken from one URL returns 304 against a different one. Holding the URL byte
 * identical is what keeps any future conditional request sound.
 */
function composeQueryUrl() {
  const codes = CORRIDOR_CROSSINGS.map((crossing) => `'${crossing.dotCode}'`);
  const url = new URL(SERVICE_BASE);
  url.searchParams.set("where", `code IN (${codes.join(",")})`);
  url.searchParams.set("outFields", OUT_FIELDS);
  url.searchParams.set("returnGeometry", "false");
  url.searchParams.set("f", "json");
  return url.toString();
}

/** The single fixed query URL. */
export const FEED_QUERY_URL = composeQueryUrl();

/** Return the fixed query URL. */
export function buildQueryUrl() {
  return FEED_QUERY_URL;
}

/**
 * Return a trimmed string, or null for an absent or blank value.
 *
 * Control characters are removed rather than trimmed. Upstream text reaches
 * `poll_run.error` through the thrown messages below, and an embedded newline
 * there forges a record boundary for anything reading that column. A renderer
 * added later would inherit the same value, so the stripping happens where the
 * value enters rather than at each use.
 */
function readText(value) {
  if (typeof value !== "string") {
    return null;
  }
  const stripped = value.replace(CONTROL_CHARACTERS, " ").trim();
  return stripped === "" ? null : stripped;
}

/** Return upstream text shortened for safe inclusion in an error message. */
function describe(value) {
  const rendered = String(value).replace(CONTROL_CHARACTERS, " ");
  return rendered.length > MAX_DESCRIBED_CHARS
    ? `${rendered.slice(0, MAX_DESCRIBED_CHARS)}...`
    : rendered;
}

/** Return a reason string for a thrown value of any shape. */
function reason(error) {
  if (error instanceof Error && typeof error.message === "string") {
    return describe(error.message);
  }
  return describe(String(error));
}

/** Return a finite epoch-millisecond number, or null. */
function readEpochMs(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Convert one upstream attribute bag into a stored row. */
function readRow(attributes) {
  const dotCode = readText(attributes.code);
  if (!dotCode || !CORRIDOR_CODES.has(dotCode)) {
    throw new Error(`unexpected code in snapshot: ${describe(dotCode)}`);
  }
  const status = readText(attributes.crossingStatus);
  if (!status || !VALID_STATUSES.has(status)) {
    throw new Error(
      `unknown crossingStatus for ${describe(dotCode)}: ${describe(status)}`,
    );
  }
  return {
    dotCode,
    status,
    sensorStatus: readText(attributes.sensorStatus),
    feedStartTime: readEpochMs(attributes.startTime),
    // endTime and timeToClear are predictions revised on every tick. One
    // crossing reported "6 MIN" and cleared within one minute. Stored as
    // advisory values, never acted on.
    feedPredictedEnd: readEpochMs(attributes.endTime),
    feedTimeToClear: readText(attributes.timeToClear),
    feedTimeUpdated: readEpochMs(attributes.timeUpdated),
  };
}

/**
 * Parse one snapshot body into rows.
 *
 * Throws on anything short of a complete, well formed snapshot. A partial or
 * malformed response is a fault, never evidence that a crossing is clear.
 */
export function parseSnapshot(body) {
  if (!body || typeof body !== "object") {
    throw new Error("malformed snapshot: body is not an object");
  }
  if (body.error) {
    const message = body.error.message ?? "unspecified";
    throw new Error(`upstream error in snapshot: ${describe(message)}`);
  }
  if (!Array.isArray(body.features)) {
    throw new Error("malformed snapshot: features is not an array");
  }
  const rows = body.features.map((feature) => {
    // typeof null is "object", so the null case needs its own test. Without
    // it a null attribute bag reaches readRow and raises a runtime TypeError
    // instead of this diagnostic, degrading the only forensic record kept.
    if (!feature || !feature.attributes
        || typeof feature.attributes !== "object") {
      throw new Error("malformed snapshot: feature has no attributes");
    }
    return readRow(feature.attributes);
  });
  const seen = new Set();
  for (const row of rows) {
    if (seen.has(row.dotCode)) {
      throw new Error(`duplicate code in snapshot: ${row.dotCode}`);
    }
    seen.add(row.dotCode);
  }
  if (rows.length !== CORRIDOR_CROSSING_COUNT) {
    throw new Error(
      `expected ${CORRIDOR_CROSSING_COUNT} rows, received ${rows.length}`,
    );
  }
  return rows;
}

/**
 * Fetch and parse one snapshot.
 *
 * Never throws. A failure is reported as `rows: null` plus an error string so
 * the caller can record the run and leave stored state untouched. Treating a
 * failed fetch as data would publish a false "no train".
 */
export async function fetchSnapshot(fetchImpl) {
  let response;
  try {
    response = await fetchImpl(FEED_QUERY_URL, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (error) {
    return failure(null, `fetch failed: ${reason(error)}`);
  }
  if (!response.ok) {
    return failure(response.status, `fetch failed: status ${response.status}`);
  }
  const declared = declaredLength(response);
  if (declared !== null && declared > MAX_BODY_BYTES) {
    return failure(
      response.status,
      `oversized body: ${declared} bytes exceeds ${MAX_BODY_BYTES}`,
    );
  }
  let body;
  try {
    body = await response.json();
  } catch (error) {
    return failure(response.status, `unreadable body: ${reason(error)}`);
  }
  try {
    return {
      rows: parseSnapshot(body),
      httpStatus: response.status,
      feedLastEditDate: readEpochMs(body.editingInfo?.lastEditDate),
      error: null,
    };
  } catch (error) {
    return failure(response.status, reason(error));
  }
}

/** Return the declared body size in bytes, or null when absent or unusable. */
function declaredLength(response) {
  const raw = response.headers?.get?.("content-length");
  if (typeof raw !== "string") {
    return null;
  }
  const size = Number(raw);
  return Number.isFinite(size) && size >= 0 ? size : null;
}

/** Return a failed snapshot result carrying the reason. */
function failure(httpStatus, error) {
  return { rows: null, httpStatus, feedLastEditDate: null, error };
}
