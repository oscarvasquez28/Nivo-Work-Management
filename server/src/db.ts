import pg from "pg";
import { env } from "./env";

// Keep `date` columns as YYYY-MM-DD strings and `timestamptz` as ISO instants
// so rows round-trip losslessly with the domain types.
pg.types.setTypeParser(1082, (value) => value);
pg.types.setTypeParser(1184, (value) => new Date(value).toISOString());

export const pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: 10 });

export type Tx = pg.PoolClient;

export const withTransaction = <T>(work: (client: Tx) => Promise<T>) => transaction(pool, work);

export async function transaction<T>(database: pg.Pool, work: (client: Tx) => Promise<T>, readOnly = false): Promise<T> {
  const client = await database.connect();
  try {
    await client.query(readOnly ? "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY" : "BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
