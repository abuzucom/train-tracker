import assert from "node:assert/strict";
import { test } from "node:test";

import worker, { runPoll } from "../src/index.js";
import { createFakeD1 } from "./helpers/fake-d1.js";
import { allClearPayload, oneBlockedPayload } from "./fixtures/payloads.js";
import { CORRIDOR_CROSSING_COUNT } from "../src/corridor.js";

const OBSERVED_AT = 1789000060000;

test("a first poll seeds every crossing and appends no event", async () => {
  const database = createFakeD1();
  await runPoll(database, okFetch(allClearPayload()), () => OBSERVED_AT);
  assert.equal(
    database.writesFor("crossing_state").length,
    CORRIDOR_CROSSING_COUNT,
  );
  assert.equal(database.writesFor("crossing_event").length, 0);
  assert.equal(database.writesFor("poll_run").length, 1);
});

test("a clear-to-blocked edge appends exactly one event", async () => {
  const database = createFakeD1(allClearState());
  await runPoll(database, okFetch(oneBlockedPayload()), () => OBSERVED_AT);
  const events = database.writesFor("crossing_event");
  assert.equal(events.length, 1);
  assert.equal(events[0].bindings[0], "743662C");
  assert.equal(events[0].bindings[1], "blocked");
});

test("an unchanged repeat poll appends no event", async () => {
  const database = createFakeD1(allClearState());
  await runPoll(database, okFetch(allClearPayload()), () => OBSERVED_AT);
  assert.equal(database.callsFor("crossing_event").length, 0);
});

test("the same snapshot twice appends nothing the second time", async () => {
  const state = allClearState();
  const first = createFakeD1(state);
  await runPoll(first, okFetch(oneBlockedPayload()), () => OBSERVED_AT);
  assert.equal(first.writesFor("crossing_event").length, 1);

  state.set("743662C", "blocked");
  const second = createFakeD1(state);
  await runPoll(second, okFetch(oneBlockedPayload()), () => OBSERVED_AT);
  assert.equal(second.callsFor("crossing_event").length, 0);
});

test("an HTTP 500 records the run and writes no crossing state", async () => {
  const database = createFakeD1(allClearState());
  const result = await runPoll(
    database,
    async () => ({ ok: false, status: 500, json: async () => ({}) }),
    () => OBSERVED_AT,
  );
  assert.equal(result.ok, false);
  assert.equal(database.callsFor("crossing_state").length, 0);
  assert.equal(database.callsFor("crossing_event").length, 0);
  const runs = database.callsFor("poll_run");
  assert.equal(runs.length, 1);
  assert.equal(runs[0].bindings[1], 500);
  assert.ok(runs[0].bindings[4], "poll_run carries the error");
});

test("a malformed body records the run and writes no crossing state", async () => {
  const database = createFakeD1(allClearState());
  const result = await runPoll(
    database,
    async () => ({ ok: true, status: 200, json: async () => ({ nope: true }) }),
    () => OBSERVED_AT,
  );
  assert.equal(result.ok, false);
  assert.equal(database.callsFor("crossing_state").length, 0);
  assert.equal(database.callsFor("poll_run").length, 1);
});

test("a short snapshot is a fault and never clears a blocked crossing", async () => {
  const state = allClearState();
  state.set("743662C", "blocked");
  const database = createFakeD1(state);
  const payload = allClearPayload();
  payload.features.pop();
  const result = await runPoll(database, okFetch(payload), () => OBSERVED_AT);
  assert.equal(result.ok, false);
  assert.equal(database.callsFor("crossing_state").length, 0);
  assert.equal(database.callsFor("crossing_event").length, 0);
});

test("a successful poll records its row count and edit stamp", async () => {
  const database = createFakeD1();
  const body = allClearPayload();
  body.editingInfo = { lastEditDate: 1789000030000 };
  await runPoll(database, okFetch(body), () => OBSERVED_AT);
  const run = database.writesFor("poll_run")[0];
  assert.equal(run.bindings[0], OBSERVED_AT);
  assert.equal(run.bindings[1], 200);
  assert.equal(run.bindings[2], CORRIDOR_CROSSING_COUNT);
  assert.equal(run.bindings[3], 1789000030000);
  assert.equal(run.bindings[4], null);
});

test("state rows carry the observation time, not the feed's timeUpdated", async () => {
  const database = createFakeD1();
  await runPoll(database, okFetch(allClearPayload()), () => OBSERVED_AT);
  const stateCall = database.writesFor("crossing_state")[0];
  // observed_at is the last bound column and is the only freshness signal.
  assert.equal(stateCall.bindings.at(-1), OBSERVED_AT);
  assert.equal(stateCall.bindings[6], 1788000000000);
});

test("the scheduled handler does not reject when the feed fails", async () => {
  const database = createFakeD1();
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new TypeError("network unreachable");
  };
  try {
    await worker.scheduled(
      { scheduledTime: OBSERVED_AT },
      { DB: database },
      { waitUntil() {} },
    );
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.equal(database.callsFor("poll_run").length, 1);
  assert.equal(database.callsFor("crossing_state").length, 0);
});

/** Return a fetch stub yielding one successful payload. */
function okFetch(body) {
  return async () => ({ ok: true, status: 200, json: async () => body });
}

/** Return prior stored state with every corridor crossing clear. */
function allClearState() {
  return new Map(
    allClearPayload().features.map((feature) => [
      feature.attributes.code,
      "clear",
    ]),
  );
}
