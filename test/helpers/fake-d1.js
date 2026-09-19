/**
 * An in-memory stand-in for the D1 binding.
 *
 * It records every statement and its bound values, and serves reads of
 * crossing_state from a map the test controls. This is the seam that lets the
 * scheduled handler run end to end without any Cloudflare infrastructure. It
 * is deliberately not a SQL engine: it asserts what the code sends, and the
 * real SQL is exercised by applying the migrations against D1.
 */

/** Create a fake D1 binding seeded with existing crossing_state rows. */
export function createFakeD1(existingState = new Map()) {
  const calls = [];
  const state = new Map(existingState);

  /** Build one prepared statement that records its own execution. */
  function prepare(sql) {
    const record = { sql, bindings: null, method: null };
    return {
      bind(...bindings) {
        record.bindings = bindings;
        return this;
      },
      async all() {
        record.method = "all";
        calls.push(record);
        return { results: readState(sql, state) };
      },
      async run() {
        record.method = "run";
        calls.push(record);
        return { success: true };
      },
      /** Expose the record so batch() can log it without executing. */
      _record: record,
    };
  }

  return {
    prepare,
    async batch(statements) {
      for (const statement of statements) {
        statement._record.method = "batch";
        calls.push(statement._record);
      }
      return statements.map(() => ({ success: true }));
    },
    /** Every statement the code ran, in order. */
    calls,
    /**
     * Statements whose SQL mentions one table, reads included.
     *
     * Use this to assert that nothing at all touched a table. To count or
     * inspect writes, use writesFor: the poller reads crossing_state before
     * writing it, so this also matches that SELECT.
     */
    callsFor(table) {
      return calls.filter((call) => call.sql.includes(table));
    },
    /** Insert statements against one table, in order. */
    writesFor(table) {
      return calls.filter((call) => call.sql.includes(`INSERT INTO ${table}`));
    },
  };
}

/** Serve a crossing_state read from the seeded map. */
function readState(sql, state) {
  if (!sql.includes("crossing_state")) {
    return [];
  }
  return [...state.entries()].map(([dotCode, status]) => ({
    dot_code: dotCode,
    status,
  }));
}
