import { createSeed } from "../../lib/data/seed";
import { validateSnapshot } from "../../lib/domain/validation";
import { pool, withTransaction } from "./db";
import { loadSnapshot, persistSnapshot } from "./store";

// Usage: npm --prefix server run seed:demo
// Replaces the workspace contents with the demo dataset (users, teams, labels,
// projects, cycles, issues, comments, activity). The admin credential is kept.
const answer = process.argv.includes("--force");
const existing = await withTransaction((client) => loadSnapshot(client));
if (existing && !answer && Object.keys(existing.issues).length > 0) {
  console.error("The workspace already has issues. Re-run with --force to overwrite.");
  process.exit(1);
}

const seed = createSeed(new Date().toISOString().slice(0, 10));
await withTransaction(async (client) => {
  const before = await loadSnapshot(client, true);
  const next = validateSnapshot(seed);
  if (before) {
    // Keep the admin account and current user pointer.
    next.users["user-admin"] = before.users["user-admin"] ?? next.users["user-admin"];
    next.currentUserId = before.currentUserId in next.users ? before.currentUserId : Object.keys(next.users)[0];
  }
  await persistSnapshot(client, before, next);
});

await pool.end();
console.log(`Demo workspace seeded: ${Object.keys(seed.issues).length} issues, ${Object.keys(seed.projects).length} projects.`);
