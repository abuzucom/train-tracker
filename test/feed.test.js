import assert from "node:assert/strict";
import { test } from "node:test";

import {
  FEED_QUERY_URL,
  buildQueryUrl,
  fetchSnapshot,
  parseSnapshot,
} from "../src/feed.js";
import { CORRIDOR_CROSSING_COUNT } from "../src/corridor.js";
import { allClearPayload, oneBlockedPayload } from "./fixtures/payloads.js";

test("buildQueryUrl returns a byte-identical URL on every call", () => {
  assert.equal(buildQueryUrl(), buildQueryUrl());
  assert.equal(buildQueryUrl(), FEED_QUERY_URL);
});

test("buildQueryUrl requests every corridor code and suppresses geometry", () => {
  const url = new URL(buildQueryUrl());
  const where = url.searchParams.get("where");
  for (const code of ["743650H", "743673P", "743677S"]) {
    assert.ok(where.includes(`'${code}'`), `missing ${code}`);
  }
  assert.equal(url.searchParams.get("returnGeometry"), "false");
  assert.equal(url.searchParams.get("f"), "json");
});

test("buildQueryUrl does not request the other Post Oak crossing", () => {
  // 440652H is a different corridor about 16 km south.
  assert.ok(!buildQueryUrl().includes("440652H"));
});

test("parseSnapshot reads every row of an all-clear payload", () => {
  const rows = parseSnapshot(allClearPayload());
  assert.equal(rows.length, CORRIDOR_CROSSING_COUNT);
  for (const row of rows) {
    assert.equal(row.status, "clear");
    assert.equal(row.feedStartTime, null);
  }
});

test("parseSnapshot carries blocked-row fields through", () => {
  const rows = parseSnapshot(oneBlockedPayload());
  const blocked = rows.filter((row) => row.status === "blocked");
  assert.equal(blocked.length, 1);
  assert.equal(blocked[0].dotCode, "743662C");
  assert.equal(blocked[0].feedStartTime, 1789000000000);
  assert.equal(blocked[0].feedTimeToClear, "5 MIN");
});

test("parseSnapshot rejects a code the query never asked for", () => {
  const payload = allClearPayload();
  payload.features[0].attributes.code = "440652H";
  assert.throws(() => parseSnapshot(payload), /unexpected code/i);
});

test("parseSnapshot rejects a short snapshot rather than inferring absence", () => {
  const payload = allClearPayload();
  payload.features.pop();
  assert.throws(() => parseSnapshot(payload), /expected 11 rows/i);
});

test("parseSnapshot rejects a duplicated code", () => {
  const payload = allClearPayload();
  payload.features[1].attributes.code = payload.features[0].attributes.code;
  assert.throws(() => parseSnapshot(payload), /duplicate code/i);
});

test("parseSnapshot rejects an unknown crossingStatus value", () => {
  const payload = allClearPayload();
  payload.features[0].attributes.crossingStatus = "PARTIALLY_BLOCKED";
  assert.throws(() => parseSnapshot(payload), /unknown crossingStatus/i);
});

test("parseSnapshot rejects a payload carrying an upstream error", () => {
  assert.throws(
    () => parseSnapshot({ error: { code: 400, message: "Invalid query" } }),
    /upstream error/i,
  );
});

test("parseSnapshot rejects a body with no features array", () => {
  assert.throws(() => parseSnapshot({}), /malformed/i);
});

test("fetchSnapshot returns rows and the service edit stamp on success", async () => {
  const body = allClearPayload();
  body.editingInfo = { lastEditDate: 1789000030000 };
  const result = await fetchSnapshot(stubFetch(200, body));
  assert.equal(result.rows.length, CORRIDOR_CROSSING_COUNT);
  assert.equal(result.httpStatus, 200);
  assert.equal(result.feedLastEditDate, 1789000030000);
});

test("fetchSnapshot reports a non-200 status without throwing", async () => {
  const result = await fetchSnapshot(stubFetch(500, { error: "boom" }));
  assert.equal(result.rows, null);
  assert.equal(result.httpStatus, 500);
  assert.match(result.error, /status 500/);
});

test("fetchSnapshot reports a malformed body without throwing", async () => {
  const result = await fetchSnapshot(async () => ({
    ok: true,
    status: 200,
    json: async () => {
      throw new SyntaxError("Unexpected token <");
    },
  }));
  assert.equal(result.rows, null);
  assert.equal(result.httpStatus, 200);
  assert.ok(result.error);
});

test("fetchSnapshot reports a transport failure without throwing", async () => {
  const result = await fetchSnapshot(async () => {
    throw new TypeError("network unreachable");
  });
  assert.equal(result.rows, null);
  assert.equal(result.httpStatus, null);
  assert.match(result.error, /network unreachable/);
});

/** Return a fetch stub yielding one status and body. */
function stubFetch(status, body) {
  return async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}
