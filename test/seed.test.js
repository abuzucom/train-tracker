import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { CORRIDOR_CROSSINGS } from "../src/corridor.js";

const SEED_PATH = fileURLToPath(
  new URL("../migrations/0002_seed_crossings.sql", import.meta.url),
);

// Matches one VALUES tuple. Each field is anchored and non-greedy inside its
// own delimiter, so the pattern cannot backtrack across tuples.
const ROW_PATTERN =
  /\('([0-9A-Z]+)',\s*'([^']*)',\s*(\d+),\s*(-?\d+\.\d+),\s*(-?\d+\.\d+),\s*(\d+)\)/g;

/** Parse the seed migration into rows. */
function readSeedRows() {
  const sql = readFileSync(SEED_PATH, "utf8");
  return [...sql.matchAll(ROW_PATTERN)].map((match) => ({
    dotCode: match[1],
    name: match[2].trim(),
    corridorSeq: Number(match[3]),
    lat: Number(match[4]),
    lon: Number(match[5]),
    arcgisObjectId: Number(match[6]),
  }));
}

test("the seed migration matches src/corridor.js exactly", () => {
  assert.deepEqual(readSeedRows(), CORRIDOR_CROSSINGS.map((row) => ({ ...row })));
});

test("corridor_seq runs 1 to 11 without a gap", () => {
  const sequence = CORRIDOR_CROSSINGS.map((row) => row.corridorSeq);
  assert.deepEqual(sequence, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
});

test("every federal code is distinct", () => {
  const codes = CORRIDOR_CROSSINGS.map((row) => row.dotCode);
  assert.equal(new Set(codes).size, codes.length);
});

test("the corridor carries the Post Oak on this line, not the other one", () => {
  // 440652H is "POST OAK SOUTHBOUND FRONTAGE", a different corridor ~16 km
  // south. Selecting it would silently corrupt every ordering result.
  const codes = CORRIDOR_CROSSINGS.map((row) => row.dotCode);
  assert.ok(codes.includes("743673P"));
  assert.ok(!codes.includes("440652H"));
});

test("crossings run northwest to southeast", () => {
  // Latitude falls and longitude rises along the corridor. A row inserted out
  // of order would break the ordering that direction inference depends on.
  for (let i = 1; i < CORRIDOR_CROSSINGS.length; i += 1) {
    const previous = CORRIDOR_CROSSINGS[i - 1];
    const current = CORRIDOR_CROSSINGS[i];
    assert.ok(current.lat < previous.lat, `lat at ${current.dotCode}`);
    assert.ok(current.lon > previous.lon, `lon at ${current.dotCode}`);
  }
});
