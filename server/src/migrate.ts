import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pool, withTransaction } from "./db";

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "../migrations");

await withTransaction(async (client) => {
  await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
  const applied = new Set((await client.query<{ name: string }>("SELECT name FROM schema_migrations")).rows.map((row) => row.name));
  for (const file of readdirSync(migrationsDir).filter((name) => name.endsWith(".sql")).sort()) {
    if (applied.has(file)) continue;
    console.log(`Applying ${file}…`);
    await client.query(readFileSync(join(migrationsDir, file), "utf8"));
    await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
  }
});

await pool.end();
console.log("Migrations applied.");
