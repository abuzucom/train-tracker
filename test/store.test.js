import assert from "node:assert/strict";
import { test } from "node:test";

import { diffStatuses, readCurrentStatuses } from "../src/store.js";
import { createFakeD1 } from "./helpers/fake-d1.js";
import { parseSnapshot } from "../src/feed.js";
import { allClearPayload, oneBlockedPayload } from "./fixtures/payloads.js";

test("readCurrentStatuses returns stored statuses by code", async () => {
  const database = createFakeD1(new Map([["743662C", "blocked"]]));
  const statuses = await readCurrentStatuses(database);
  assert.equal(statuses.get("743662C"), "blocked");
});

test("diffStatuses appends nothing on a first run against empty state", () => {
  const rows = parseSnapshot(allClearPayload());
  assert.deepEqual(diffStatuses(rows, new Map()), []);
});

test("diffStatuses appends exactly one event at a clear-to-blocked edge", () => {
  const previous = statusesFrom(allClearPayload());
  const rows = parseSnapshot(oneBlockedPayload());
  const changes = diffStatuses(rows, previous);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].dotCode, "743662C");
  assert.equal(changes[0].status, "blocked");
  assert.equal(changes[0].feedStartTime, 1789000000000);
});

test("diffStatuses appends one event at a blocked-to-clear edge", () => {
  const previous = statusesFrom(oneBlockedPayload());
  const rows = parseSnapshot(allClearPayload());
  const changes = diffStatuses(rows, previous);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].dotCode, "743662C");
  assert.equal(changes[0].status, "clear");
});

test("diffStatuses appends nothing when a snapshot repeats", () => {
  const previous = statusesFrom(oneBlockedPayload());
  const rows = parseSnapshot(oneBlockedPayload());
  assert.deepEqual(diffStatuses(rows, previous), []);
});

test("diffStatuses ignores a crossing whose advisory fields moved only", () => {
  // timeToClear is revised on every tick. A revision is not a transition.
  const previous = statusesFrom(oneBlockedPayload());
  const payload = oneBlockedPayload();
  const bingle = payload.features.find(
    (feature) => feature.attributes.code === "743662C",
  );
  bingle.attributes.timeToClear = "2 MIN";
  bingle.attributes.endTime = 1789000120000;
  assert.deepEqual(diffStatuses(parseSnapshot(payload), previous), []);
});

test("diffStatuses reports every crossing that changed", () => {
  const previous = statusesFrom(allClearPayload());
  const payload = allClearPayload();
  payload.features[0].attributes.crossingStatus = "blocked";
  payload.features[1].attributes.crossingStatus = "blocked";
  assert.equal(diffStatuses(parseSnapshot(payload), previous).length, 2);
});

test("store binds values rather than building SQL text", async () => {
  const database = createFakeD1();
  await readCurrentStatuses(database);
  for (const call of database.calls) {
    assert.ok(!/'\s*\|\|/.test(call.sql), "SQL builds a value by concatenation");
    assert.ok(!call.sql.includes("743"), "a crossing code is inlined into SQL");
  }
});

/** Return a status map matching one payload, as prior stored state. */
function statusesFrom(payload) {
  return new Map(
    parseSnapshot(payload).map((row) => [row.dotCode, row.status]),
  );
}
