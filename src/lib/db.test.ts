import { test } from "node:test";
import { strict as assert } from "node:assert";

const db = await import("@/lib/db");

test("db basic read/write/read", async () => {
  // Use an isolated prefix so we don't pollute production data
  const code = `testjs-${Date.now()}`;
  await db.createLink({ code, url: "https://example.com" });

  const record = await db.findByCode(code);
  assert.ok(record);
  assert.strictEqual(record.url, "https://example.com");
  assert.strictEqual(record.clicks, 0);

  const updated = await db.recordClick(code, {
    ip: "127.0.0.1",
    userAgent: "test",
    referrer: "direct",
    country: "US",
    device: "desktop",
  });
  assert.ok(updated);
  assert.strictEqual(updated.clicks, 1);
  assert.strictEqual(updated.clickHistory.length, 1);
  assert.deepStrictEqual(updated.clickHistory[0], {
    ip: "127.0.0.1",
    userAgent: "test",
    referrer: "direct",
    country: "US",
    device: "desktop",
    timestamp: updated.clickHistory[0].timestamp,
  });

  const analytics = await db.getAnalytics(code);
  assert.ok(analytics);
  assert.strictEqual(analytics.totalClicks, 1);
  assert.strictEqual(analytics.clicks24h, 1);
});
