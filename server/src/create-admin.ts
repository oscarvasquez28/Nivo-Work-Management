import { pool, withTransaction } from "./db";
import { hashPassword } from "./auth";

// Usage: npm --prefix server run create-admin -- <email> <password> [name]
// Creates (or repairs) the minimal workspace: workspace row, a default team,
// the admin user and their login credential. No demo data is seeded.
const [email, password, name] = process.argv.slice(2);
if (!email || !password) {
  console.error("Usage: tsx src/create-admin.ts <email> <password> [name]");
  process.exit(1);
}

const displayName = name ?? email.split("@")[0].split(/[._-]/).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
const initials = displayName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
const today = new Date().toISOString().slice(0, 10);
const userId = "user-admin";

await withTransaction(async (client) => {
  await client.query(
    `INSERT INTO workspaces (id, name, issue_prefix, next_issue_number, seed_anchor_date, current_user_id, timezone, access_model)
     VALUES ('nivo-labs', 'Nivo Labs', 'NIV', 1, $1, $2, 'UTC', 'team')
     ON CONFLICT (id) DO NOTHING`,
    [today, userId],
  );
  await client.query(
    `INSERT INTO teams (id, workspace_id, name, key, wip_limit, visibility) VALUES ('engineering', 'nivo-labs', 'Engineering', 'ENG', 0, 'public')
     ON CONFLICT (id) DO NOTHING`,
  );
  await client.query(
    `INSERT INTO users (id, workspace_id, name, initials, color, role) VALUES ($1, 'nivo-labs', $2, $3, '#9aa8ff', 'Administrator')
     ON CONFLICT (id) DO UPDATE SET name = $2, initials = $3`,
    [userId, displayName, initials],
  );
  await client.query("INSERT INTO user_teams (workspace_id, user_id, team_id, access) VALUES ('nivo-labs', $1, 'engineering', 'owner') ON CONFLICT DO NOTHING", [userId]);
  await client.query(
    `INSERT INTO credentials (user_id, email, password_hash, role) VALUES ($1, $2, $3, 'admin')
     ON CONFLICT (user_id) DO UPDATE SET email = $2, password_hash = $3, role = 'admin'`,
    [userId, email.toLowerCase(), await hashPassword(password)],
  );
  await client.query(
    `INSERT INTO installation_state (id, completed_at) VALUES (1, now())
     ON CONFLICT (id) DO UPDATE SET completed_at = now() WHERE installation_state.completed_at IS NULL`,
  );
  await client.query("UPDATE workspaces SET current_user_id = $1 WHERE id = 'nivo-labs' AND current_user_id NOT IN (SELECT id FROM users)", [userId]);
});

await pool.end();
console.log(`Admin ready: ${displayName} <${email}>`);
