import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { applyCommand } from "../../lib/domain/commands";
import { createSeed } from "../../lib/data/seed";
import type { Command } from "../../types/domain";

// Requires a dedicated scratch database: NIVO_TEST_DATABASE_URL=postgres://nivo:nivo@127.0.0.1:5432/nivo_test
// (create it once with `docker exec <db> createdb -U nivo nivo_test`). Skipped when unset.
const DATABASE_URL = process.env.NIVO_TEST_DATABASE_URL;
const describeDb = DATABASE_URL ? describe : describe.skip;

pg.types.setTypeParser(1082, (value: string) => value);
pg.types.setTypeParser(1184, (value: string) => new Date(value).toISOString());

// Integration test for the SQL repository: seeds a scratch workspace table set
// in its own schema and verifies commit semantics against the shared domain logic.
describeDb("postgres workspace store", () => {
  let pool: pg.Pool;
  let store: typeof import("../../server/src/store");

  beforeAll(async () => {
    process.env.DATABASE_URL = `${DATABASE_URL}`;
    pool = new pg.Pool({ connectionString: DATABASE_URL });
    const sql = readFileSync(join(__dirname, "../../server/migrations/001_init.sql"), "utf8");
    await pool.query(sql);
    store = await import("../../server/src/store");
  }, 30000);

  afterAll(async () => {
    await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    await pool.end();
  });

  const commit = async (command: Command, expectedRevision: number, mutationId: string) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const current = await store.loadSnapshot(client, true);
      const next = applyCommand(current!, command, { now: "2026-01-01T12:00:00.000Z", mutationId, actorId: current!.currentUserId });
      await store.persistSnapshot(client, current, next);
      await client.query("COMMIT");
      return next;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  };

  it("round-trips the seed snapshot through normalized tables", async () => {
    const seed = createSeed("2026-01-01");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await store.persistSnapshot(client, null, seed);
      const loaded = await store.loadSnapshot(client);
      await client.query("COMMIT");
      expect(loaded).toEqual(seed);
    } finally {
      client.release();
    }
  });

  it("applies a command and persists the diff", async () => {
    const next = await commit({ type: "issue.update", id: "issue-142", patch: { status: "done" } }, 0, "t-1");
    expect(next.revision).toBe(1);
    expect(next.issues["issue-142"].status).toBe("done");
    const { rows } = await pool.query("SELECT status FROM issues WHERE id = 'issue-142'");
    expect(rows[0].status).toBe("done");
  });

  it("keeps activity rows for mutations", async () => {
    const { rows } = await pool.query("SELECT message FROM activities WHERE id LIKE 'activity-t-1%'");
    expect(rows.length).toBeGreaterThan(0);
  });
});
