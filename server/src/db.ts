import pg from "pg";
import { env } from "./env";

// Keep `date` columns as YYYY-MM-DD strings and `timestamptz` as ISO instants
// so rows round-trip losslessly with the domain types.
pg.types.setTypeParser(1082, (value) => value);
pg.types.setTypeParser(1184, (value) => new Date(value).toISOString());

export const pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: 10 });

export type Tx = pg.PoolClient;

export async function withTransaction<T>(work: (client: Tx) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
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
