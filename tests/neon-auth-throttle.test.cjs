"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

function createSqlStub() {
  const records = new Map();
  const statements = [];
  let now = 0;

  const sql = async (strings, ...values) => {
    const text = strings.join("?").replace(/\s+/g, " ").trim();
    statements.push({ text, values });

    if (/^DELETE FROM lineup_fanta\.auth_throttle WHERE expires_at <= now\(\)/i.test(text)) {
      for (const [key, record] of records) if (record.expiresAt <= now) records.delete(key);
      return [];
    }
    if (/^DELETE FROM lineup_fanta\.auth_throttle WHERE bucket_key =/i.test(text)) {
      records.delete(String(values[0]));
      return [];
    }
    if (/^INSERT INTO lineup_fanta\.auth_throttle/i.test(text)) {
      const key = String(values[0]);
      const windowSeconds = Number(values[1]);
      const ceiling = Number(values[2]);
      const current = records.get(key);
      const attempts = current && current.expiresAt > now ? Math.min(current.attempts + 1, ceiling) : 1;
      const expiresAt = current && current.expiresAt > now ? current.expiresAt : now + windowSeconds * 1000;
      records.set(key, { attempts, expiresAt });
      return [{ attempts: String(attempts), retry_after: Math.max(1, Math.ceil((expiresAt - now) / 1000)) }];
    }
    throw new Error(`Unexpected SQL: ${text}`);
  };

  sql.advance = (milliseconds) => { now += milliseconds; };
  sql.records = records;
  sql.statements = statements;
  return sql;
}

test("auth throttle shares five attempts across store instances and saturates the counter", async () => {
  const { createAuthThrottleStore } = require("../lib/neon.cjs");
  const sql = createSqlStub();

  const attempts = [];
  for (let index = 0; index < 8; index += 1) {
    attempts.push(await createAuthThrottleStore(sql).consume("a".repeat(64)));
  }

  assert.deepEqual(attempts.map((entry) => entry.allowed), [true, true, true, true, true, false, false, false]);
  assert.equal(sql.records.get("a".repeat(64)).attempts, 6);
  assert.match(sql.statements.find((entry) => /^INSERT/i.test(entry.text)).text, /ON CONFLICT.*LEAST.*RETURNING/is);
});

test("auth throttle isolates buckets, resets successes, and expires old windows", async () => {
  const { createAuthThrottleStore } = require("../lib/neon.cjs");
  const sql = createSqlStub();
  const store = createAuthThrottleStore(sql);
  const first = "1".repeat(64);
  const second = "2".repeat(64);

  await Promise.all(Array.from({ length: 5 }, () => store.consume(first)));
  assert.equal((await store.consume(first)).allowed, false);
  assert.equal((await store.consume(second)).allowed, true);

  await store.reset(first);
  assert.equal((await store.consume(first)).allowed, true);

  sql.advance(15 * 60 * 1000 + 1);
  const expired = await store.consume(second);
  assert.equal(expired.allowed, true);
  assert.equal(sql.records.size, 1);
});

test("blocked auth attempts return an integer Retry-After", async () => {
  const { createAuthThrottleStore } = require("../lib/neon.cjs");
  const store = createAuthThrottleStore(createSqlStub());
  const key = "b".repeat(64);
  for (let index = 0; index < 5; index += 1) await store.consume(key);

  const result = await store.consume(key);

  assert.equal(result.allowed, false);
  assert.equal(Number.isInteger(result.retryAfter), true);
  assert.equal(result.retryAfter, 900);
});
