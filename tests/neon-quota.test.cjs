"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { createBsdQuotaStore } = require("../lib/neon.cjs");

function createSqlStub() {
  const records = new Map();
  const statements = [];

  const sql = async (strings, ...values) => {
    await new Promise((resolve) => setImmediate(resolve));
    const text = strings.join("?").replace(/\s+/g, " ").trim();
    statements.push({ text, values });

    const date = String(values[0]);
    const current = records.get(date) || { calls: 0, rateLimitedUntil: null };
    if (/calls\s*=\s*lineup_fanta\.bsd_quota\.calls\s*\+\s*EXCLUDED\.calls/i.test(text)) {
      current.calls += Number(values[1]);
    }
    if (/rate_limited_until\s*=\s*EXCLUDED\.rate_limited_until/i.test(text)) {
      current.rateLimitedUntil = values[1];
    }
    records.set(date, current);

    return [{
      quota_date: date,
      calls: String(current.calls),
      rate_limited_until: current.rateLimitedUntil
    }];
  };

  sql.statements = statements;
  return sql;
}

test("25 concurrent quota increments are atomic single statements", async () => {
  const sql = createSqlStub();
  const store = createBsdQuotaStore(sql);
  const date = "2026-09-08";

  await Promise.all(Array.from({ length: 25 }, () => store.increment(1, date)));
  const record = await store.read(date);

  assert.equal(record.calls, 25);
  assert.equal(sql.statements.length, 26);
  for (const statement of sql.statements.slice(0, 25)) {
    assert.match(statement.text, /^INSERT INTO lineup_fanta\.bsd_quota/i);
    assert.match(statement.text, /ON CONFLICT/i);
    assert.match(statement.text, /RETURNING/i);
  }
});

test("a new UTC date starts with a fresh quota count", async () => {
  const store = createBsdQuotaStore(createSqlStub());

  await store.increment(7, "2026-09-08");

  assert.deepEqual(await store.read("2026-09-09"), {
    date: "2026-09-09",
    calls: 0,
    rateLimitedUntil: null
  });
});

test("rate limiting preserves calls already recorded for the UTC date", async () => {
  const store = createBsdQuotaStore(createSqlStub());
  const date = "2026-09-08";
  const until = "2026-09-09T00:00:00.000Z";

  await store.increment(4, date);
  const record = await store.markRateLimited(until, date);

  assert.deepEqual(record, { date, calls: 4, rateLimitedUntil: until });
});
