import { randomBytes } from "node:crypto";
import Fastify from "fastify";
import { z } from "zod";
import type { Command } from "../../types/domain";
import { applyCommand } from "../../lib/domain/commands";
import { DomainError, validateSnapshot } from "../../lib/domain/validation";
import { createSession, deleteSession, findCredential, hashPassword, lookupSession, readSessionToken, sessionCookie, sessionMaxAge, verifyPassword } from "./auth";
import { pool, withTransaction } from "./db";
import { env } from "./env";
import { loadSnapshot, persistSnapshot, WORKSPACE_ID } from "./store";

const app = Fastify({ logger: { level: "info" } });

declare module "fastify" {
  interface FastifyRequest { userId: string; access: string }
}

const errorStatus: Record<string, number> = { validation: 400, "not-found": 404, conflict: 409, "persistence-unavailable": 503, "corrupt-snapshot": 500, "unsupported-version": 500 };

import type { WorkspaceData } from "../../types/domain";

function visibleScope(data: WorkspaceData, userId: string) {
  const projectIds = new Set(Object.values(data.projects).filter((project) => project.leadId === userId || project.memberIds.includes(userId)).map((project) => project.id));
  const issueIds = new Set(Object.values(data.issues).filter((issue) => !issue.projectId || projectIds.has(issue.projectId)).map((issue) => issue.id));
  return { projectIds, issueIds };
}

function scopedSnapshot(data: WorkspaceData, userId: string, access: string): WorkspaceData {
  const snapshot = { ...data, currentUserId: userId };
  if (access === "admin") return snapshot;
  const { projectIds, issueIds } = visibleScope(data, userId);
  return {
    ...snapshot,
    projects: Object.fromEntries(Object.entries(data.projects).filter(([id]) => projectIds.has(id))),
    issues: Object.fromEntries(Object.entries(data.issues).filter(([id]) => issueIds.has(id))),
    comments: Object.fromEntries(Object.entries(data.comments).filter(([, comment]) => issueIds.has(comment.issueId))),
    activities: Object.fromEntries(Object.entries(data.activities).filter(([, activity]) => (!activity.issueId || issueIds.has(activity.issueId)) && (!activity.projectId || projectIds.has(activity.projectId)))),
  };
}

function assertCommandScope(data: WorkspaceData, userId: string, command: Command) {
  const { projectIds, issueIds } = visibleScope(data, userId);
  const denied = () => { throw new DomainError("not-found", "That item is not available in your workspace scope."); };
  const checkProject = (id: string | null | undefined) => { if (id && !projectIds.has(id)) denied(); };
  const checkIssue = (id: string) => { if (!issueIds.has(id)) denied(); };
  switch (command.type) {
    case "issue.create": checkProject(command.input.projectId); break;
    case "issue.update": checkIssue(command.id); checkProject(command.patch.projectId); break;
    case "issue.move": case "issue.delete": case "issue.restore": checkIssue(command.id); break;
    case "issues.bulk": command.ids.forEach(checkIssue); checkProject(command.patch?.projectId); break;
    case "project.update": case "project.archive": if (!projectIds.has(command.id)) denied(); break;
    case "comment.add": checkIssue(command.issueId); break;
    case "comment.edit": case "comment.delete": { const comment = data.comments[command.id]; if (comment) checkIssue(comment.issueId); break; }
    default: break;
  }
}

app.setErrorHandler((error, _request, reply) => {
  if (error instanceof DomainError) return reply.status(errorStatus[error.code] ?? 500).send({ code: error.code, message: error.message });
  app.log.error(error);
  return reply.status(500).send({ code: "internal", message: "Unexpected server error." });
});

const credentialsSchema = z.object({ email: z.string().email().max(320), password: z.string().min(1).max(200) }).strict();

app.post("/api/auth/login", async (request, reply) => {
  const body = credentialsSchema.safeParse(request.body);
  if (!body.success) return reply.status(400).send({ code: "validation", message: "Enter a valid email and password." });
  const credential = await findCredential(body.data.email);
  if (!credential || credential.disabled || !verifyPassword(body.data.password, credential.passwordHash)) {
    return reply.status(401).send({ code: "unauthorized", message: "Incorrect email or password." });
  }
  const token = await createSession(credential.userId);
  reply.header("set-cookie", sessionCookie(token, sessionMaxAge()));
  return { user: { id: credential.userId } };
});

app.post("/api/auth/logout", async (request, reply) => {
  const token = readSessionToken(request);
  if (token) await deleteSession(token);
  reply.header("set-cookie", sessionCookie("", 0));
  return { ok: true };
});

app.get("/api/auth/me", async (request, reply) => {
  const session = await lookupSession(readSessionToken(request));
  if (!session) return reply.status(401).send({ code: "unauthorized", message: "Sign in to continue." });
  return { user: { id: session.userId, name: session.name, email: session.email, access: session.access } };
});

const guarded: import("fastify").preHandlerAsyncHookHandler = async (request, reply) => {
  const session = await lookupSession(readSessionToken(request));
  if (!session) return reply.status(401).send({ code: "unauthorized", message: "Your session has expired. Sign in again." });
  request.userId = session.userId;
  request.access = session.access;
};

const adminOnly: import("fastify").preHandlerAsyncHookHandler = async (request, reply) => {
  const session = await lookupSession(readSessionToken(request));
  if (!session) return reply.status(401).send({ code: "unauthorized", message: "Your session has expired. Sign in again." });
  if (session.access !== "admin") return reply.status(403).send({ code: "forbidden", message: "Only administrators can manage members." });
  request.userId = session.userId;
  request.access = session.access;
};

const memberCreateSchema = z.object({
  name: z.string().min(1).max(80), email: z.string().email().max(320), password: z.string().min(6).max(200),
  access: z.enum(["admin", "member"]), title: z.string().max(40).optional(), color: z.string().max(20).optional(),
  teamIds: z.array(z.string()).max(10).optional(), projectIds: z.array(z.string()).max(50).optional(),
}).strict();

const memberUpdateSchema = z.object({
  name: z.string().min(1).max(80).optional(), initials: z.string().max(4).optional(), color: z.string().max(20).optional(),
  title: z.string().max(40).optional(), teamIds: z.array(z.string()).max(10).optional(), projectIds: z.array(z.string()).max(50).optional(),
  email: z.string().email().max(320).optional(), access: z.enum(["admin", "member"]).optional(),
  password: z.string().min(6).max(200).optional(), disabled: z.boolean().optional(),
}).strict();

const bumpRevision = "UPDATE workspaces SET revision = revision + 1 WHERE id = $1";

app.get("/api/members", { preHandler: guarded }, async () => {
  const result = await pool.query(
    `SELECT u.id, u.name, u.initials, u.color, u.role AS title, c.email, c.role AS access, c.disabled,
            COALESCE(array_agg(DISTINCT ut.team_id) FILTER (WHERE ut.team_id IS NOT NULL), '{}') AS team_ids,
            COALESCE(array_agg(DISTINCT pm.project_id) FILTER (WHERE pm.project_id IS NOT NULL), '{}') AS project_ids
     FROM users u
     LEFT JOIN credentials c ON c.user_id = u.id
     LEFT JOIN user_teams ut ON ut.user_id = u.id AND ut.workspace_id = u.workspace_id
     LEFT JOIN project_members pm ON pm.user_id = u.id AND pm.workspace_id = u.workspace_id
     WHERE u.workspace_id = $1 GROUP BY u.id, c.email, c.role, c.disabled ORDER BY u.name`,
    [WORKSPACE_ID],
  );
  return { members: result.rows.map((row) => ({ id: row.id, name: row.name, initials: row.initials, color: row.color, title: row.title, email: row.email, access: row.access ?? "member", disabled: row.disabled ?? false, teamIds: row.team_ids, projectIds: row.project_ids })) };
});

app.post("/api/members", { preHandler: adminOnly }, async (request, reply) => {
  const body = memberCreateSchema.safeParse(request.body);
  if (!body.success) return reply.status(400).send({ code: "validation", message: "Invalid member data." });
  const { name, email, password, access, title, color, teamIds, projectIds } = body.data;
  const existing = await findCredential(email);
  if (existing) return reply.status(409).send({ code: "conflict", message: "A member with this email already exists." });
  const id = `user-${randomBytes(6).toString("hex")}`;
  const initials = name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  await withTransaction(async (client) => {
    await client.query("INSERT INTO users (id, workspace_id, name, initials, color, role) VALUES ($1,$2,$3,$4,$5,$6)", [id, WORKSPACE_ID, name, initials, color ?? "#9aa8ff", title ?? "Member"]);
    for (const team of teamIds ?? ["engineering"]) await client.query("INSERT INTO user_teams (workspace_id, user_id, team_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING", [WORKSPACE_ID, id, team]);
    for (const project of projectIds ?? []) await client.query("INSERT INTO project_members (workspace_id, project_id, user_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING", [WORKSPACE_ID, project, id]);
    await client.query("INSERT INTO credentials (user_id, email, password_hash, role) VALUES ($1,$2,$3,$4)", [id, email.toLowerCase(), hashPassword(password), access]);
    await client.query(bumpRevision, [WORKSPACE_ID]);
  });
  return reply.status(201).send({ member: { id } });
});

app.patch("/api/members/:id", { preHandler: adminOnly }, async (request, reply) => {
  const body = memberUpdateSchema.safeParse(request.body);
  if (!body.success) return reply.status(400).send({ code: "validation", message: "Invalid member data." });
  const { id } = request.params as { id: string };
  const { name, initials, color, title, teamIds, projectIds, email, access, password, disabled } = body.data;
  if (id === request.userId && (access === "member" || disabled)) return reply.status(400).send({ code: "validation", message: "You cannot demote or deactivate your own account." });
  const target = await pool.query("SELECT id FROM users WHERE id = $1 AND workspace_id = $2", [id, WORKSPACE_ID]);
  if (!target.rows[0]) return reply.status(404).send({ code: "not-found", message: "Member not found." });
  await withTransaction(async (client) => {
    if (name !== undefined) await client.query("UPDATE users SET name = $1 WHERE id = $2", [name, id]);
    if (initials !== undefined) await client.query("UPDATE users SET initials = $1 WHERE id = $2", [initials, id]);
    if (color !== undefined) await client.query("UPDATE users SET color = $1 WHERE id = $2", [color, id]);
    if (title !== undefined) await client.query("UPDATE users SET role = $1 WHERE id = $2", [title, id]);
    if (teamIds !== undefined) {
      await client.query("DELETE FROM user_teams WHERE workspace_id = $1 AND user_id = $2", [WORKSPACE_ID, id]);
      for (const team of teamIds) await client.query("INSERT INTO user_teams (workspace_id, user_id, team_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING", [WORKSPACE_ID, id, team]);
    }
    if (projectIds !== undefined) {
      await client.query("DELETE FROM project_members WHERE workspace_id = $1 AND user_id = $2", [WORKSPACE_ID, id]);
      for (const project of projectIds) await client.query("INSERT INTO project_members (workspace_id, project_id, user_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING", [WORKSPACE_ID, project, id]);
    }
    if (email !== undefined || access !== undefined || password !== undefined || disabled !== undefined) {
      const cred = await client.query("SELECT user_id FROM credentials WHERE user_id = $1", [id]);
      if (!cred.rows[0]) {
        if (!email || !password) return reply.status(400).send({ code: "validation", message: "Email and password are required to enable sign-in for this member." });
        await client.query("INSERT INTO credentials (user_id, email, password_hash, role) VALUES ($1,$2,$3,$4)", [id, email.toLowerCase(), hashPassword(password), access ?? "member"]);
      } else {
        if (email !== undefined) await client.query("UPDATE credentials SET email = $1 WHERE user_id = $2", [email.toLowerCase(), id]);
        if (access !== undefined) await client.query("UPDATE credentials SET role = $1 WHERE user_id = $2", [access, id]);
        if (password !== undefined) await client.query("UPDATE credentials SET password_hash = $1 WHERE user_id = $2", [hashPassword(password), id]);
        if (disabled !== undefined) {
          await client.query("UPDATE credentials SET disabled = $1 WHERE user_id = $2", [disabled, id]);
          if (disabled) await client.query("DELETE FROM sessions WHERE user_id = $1", [id]);
        }
      }
    }
    await client.query(bumpRevision, [WORKSPACE_ID]);
  });
  return { ok: true };
});

const teamCreateSchema = z.object({ name: z.string().min(1).max(50), key: z.string().min(2).max(6).toUpperCase(), wipLimit: z.number().int().min(0).max(1000) }).strict();
const teamUpdateSchema = z.object({ name: z.string().min(1).max(50).optional(), key: z.string().min(2).max(6).toUpperCase().optional(), wipLimit: z.number().int().min(0).max(1000).optional() }).strict();

app.get("/api/teams", { preHandler: guarded }, async () => {
  const result = await pool.query<{ id: string; name: string; key: string; wip_limit: number }>("SELECT id, name, key, wip_limit FROM teams WHERE workspace_id = $1 ORDER BY name", [WORKSPACE_ID]);
  return { teams: result.rows.map((row) => ({ id: row.id, name: row.name, key: row.key, wipLimit: row.wip_limit })) };
});

app.post("/api/teams", { preHandler: adminOnly }, async (request, reply) => {
  const body = teamCreateSchema.safeParse(request.body);
  if (!body.success) return reply.status(400).send({ code: "validation", message: body.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ") });
  const { name, key, wipLimit } = body.data;
  const id = `team-${randomBytes(4).toString("hex")}`;
  const taken = await pool.query("SELECT id FROM teams WHERE workspace_id = $1 AND (key = $2 OR id = $3) LIMIT 1", [WORKSPACE_ID, key.toUpperCase(), id]);
  if (taken.rows[0]) return reply.status(409).send({ code: "conflict", message: "A team with this id or key already exists." });
  await withTransaction(async (client) => {
    await client.query("INSERT INTO teams (id, workspace_id, name, key, wip_limit) VALUES ($1,$2,$3,$4,$5)", [id, WORKSPACE_ID, name, key.toUpperCase(), wipLimit]);
    await client.query(bumpRevision, [WORKSPACE_ID]);
  });
  return reply.status(201).send({ team: { id } });
});

app.patch("/api/teams/:id", { preHandler: adminOnly }, async (request, reply) => {
  const body = teamUpdateSchema.safeParse(request.body);
  if (!body.success) return reply.status(400).send({ code: "validation", message: body.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ") });
  const { id } = request.params as { id: string };
  const exists = await pool.query("SELECT id FROM teams WHERE id = $1 AND workspace_id = $2", [id, WORKSPACE_ID]);
  if (!exists.rows[0]) return reply.status(404).send({ code: "not-found", message: "Team not found." });
  const { name, key, wipLimit } = body.data;
  if (key) {
    const taken = await pool.query("SELECT id FROM teams WHERE workspace_id = $1 AND key = $2 AND id <> $3 LIMIT 1", [WORKSPACE_ID, key.toUpperCase(), id]);
    if (taken.rows[0]) return reply.status(409).send({ code: "conflict", message: "This team key is already in use." });
  }
  const sets: string[] = []; const values: unknown[] = [];
  if (name !== undefined) { sets.push(`name=$${sets.length + 1}`); values.push(name); }
  if (key !== undefined) { sets.push(`key=$${sets.length + 1}`); values.push(key.toUpperCase()); }
  if (wipLimit !== undefined) { sets.push(`wip_limit=$${sets.length + 1}`); values.push(wipLimit); }
  if (!sets.length) return reply.status(400).send({ code: "validation", message: "No fields to update." });
  values.push(id);
  await withTransaction(async (client) => {
    await client.query(`UPDATE teams SET ${sets.join(", ")} WHERE id=$${sets.length + 1}`, values);
    await client.query(bumpRevision, [WORKSPACE_ID]);
  });
  return { ok: true };
});

app.delete("/api/teams/:id", { preHandler: adminOnly }, async (request, reply) => {
  const { id } = request.params as { id: string };
  const inUse = await pool.query("SELECT 1 FROM projects WHERE workspace_id = $1 AND team_id = $2 UNION SELECT 1 FROM cycles WHERE workspace_id = $1 AND team_id = $2 UNION SELECT 1 FROM user_teams WHERE workspace_id = $1 AND team_id = $2 LIMIT 1", [WORKSPACE_ID, id]);
  if (inUse.rows[0]) return reply.status(400).send({ code: "validation", message: "This team has projects, cycles or members assigned. Reassign them before deleting." });
  await withTransaction(async (client) => {
    await client.query("DELETE FROM teams WHERE id = $1 AND workspace_id = $2", [id, WORKSPACE_ID]);
    await client.query(bumpRevision, [WORKSPACE_ID]);
  });
  return { ok: true };
});

app.get("/api/health", async () => ({ ok: true }));

app.get("/api/workspace", { preHandler: guarded }, async (request, reply) => {
  const snapshot = await withTransaction((client) => loadSnapshot(client));
  if (!snapshot) return reply.status(404).send({ code: "not-found", message: "The workspace has not been initialized." });
  return validateSnapshot(scopedSnapshot(snapshot, request.userId, request.access));
});

app.get("/api/workspace/revision", { preHandler: guarded }, async (_request, reply) => {
  const result = await pool.query("SELECT revision FROM workspaces WHERE id = $1", [WORKSPACE_ID]);
  if (!result.rows[0]) return reply.status(404).send({ code: "not-found", message: "The workspace has not been initialized." });
  return { revision: result.rows[0].revision };
});

app.post("/api/workspace/bootstrap", { preHandler: guarded }, async (request) => withTransaction(async (client) => {
  const existing = await loadSnapshot(client);
  if (existing) return validateSnapshot(existing);
  // Minimal empty workspace bound to the signed-in user — no demo data.
  const today = new Date().toISOString().slice(0, 10);
  await client.query(`INSERT INTO teams (id, workspace_id, name, key, wip_limit) VALUES ('engineering', $1, 'Engineering', 'ENG', 0) ON CONFLICT (id) DO NOTHING`, [WORKSPACE_ID]);
  await client.query(
    `INSERT INTO workspaces (id, name, issue_prefix, next_issue_number, seed_anchor_date, current_user_id) VALUES ($1, 'Nivo Labs', 'NIV', 1, $2, $3)`,
    [WORKSPACE_ID, today, request.userId],
  );
  await client.query("INSERT INTO user_teams (workspace_id, user_id, team_id) VALUES ($1, $2, 'engineering') ON CONFLICT DO NOTHING", [WORKSPACE_ID, request.userId]);
  return loadSnapshot(client);
}));

const commandBodySchema = z.object({
  command: z.record(z.string(), z.unknown()),
  expectedRevision: z.number().int().nonnegative(),
  context: z.object({ now: z.string(), mutationId: z.string().min(1), actorId: z.string().min(1) }).strict(),
}).strict();

app.post("/api/commands", { preHandler: guarded }, async (request, reply) => {
  const body = commandBodySchema.safeParse(request.body);
  if (!body.success) return reply.status(400).send({ code: "validation", message: body.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ") });
  const { expectedRevision } = body.data;
  const command = body.data.command as Command;
  const context = { now: body.data.context.now, mutationId: body.data.context.mutationId, actorId: request.userId };
  return withTransaction(async (client) => {
    const current = await loadSnapshot(client, true);
    if (!current) throw new DomainError("not-found", "The workspace has not been initialized.");
    if (current.appliedMutations.includes(context.mutationId)) return scopedSnapshot(current, request.userId, request.access);
    if (current.revision !== expectedRevision) throw new DomainError("conflict", "This workspace changed on another client. Review the latest changes and try again.");
    if (request.access !== "admin") assertCommandScope(current, request.userId, command);
    const next = applyCommand(current, command, context);
    await persistSnapshot(client, current, next);
    return scopedSnapshot(next, request.userId, request.access);
  });
});

const shutdown = async () => { await app.close(); await pool.end(); process.exit(0); };
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

app.listen({ port: env.PORT, host: env.HOST }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
