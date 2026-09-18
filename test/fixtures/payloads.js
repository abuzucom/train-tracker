/**
 * Snapshot payloads shaped like the upstream ArcGIS query response.
 *
 * Each builder returns a fresh deep copy so one test's mutation cannot reach
 * another. Field names and value spellings match captures recorded in
 * docs/recon/feed-behavior.md.
 */
import { CORRIDOR_CROSSINGS } from "../../src/corridor.js";

/** Epoch milliseconds used for the blocked fixture's start time. */
const BLOCKED_START_MS = 1789000000000;

/** Return one clear attribute row for a crossing. */
function clearAttributes(crossing) {
  return {
    code: crossing.dotCode,
    crossingStatus: "clear",
    sensorStatus: "UP",
    startTime: null,
    endTime: null,
    timeToClear: null,
    timeUpdated: 1788000000000,
  };
}

/** Return a payload with all 11 corridor crossings clear. */
export function allClearPayload() {
  return {
    features: CORRIDOR_CROSSINGS.map((crossing) => ({
      attributes: clearAttributes(crossing),
    })),
  };
}

/**
 * Return a payload identical to the all-clear one except that Bingle
 * (743662C) is blocked, with the advisory prediction fields populated.
 */
export function oneBlockedPayload() {
  const payload = allClearPayload();
  const bingle = payload.features.find(
    (feature) => feature.attributes.code === "743662C",
  );
  Object.assign(bingle.attributes, {
    crossingStatus: "blocked",
    startTime: BLOCKED_START_MS,
    endTime: BLOCKED_START_MS + 300000,
    timeToClear: "5 MIN",
  });
  return payload;
}
