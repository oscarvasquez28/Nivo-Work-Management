import type { WorkspaceData } from "../../types/domain";
import type { Tx } from "./db";

export const WORKSPACE_ID = "nivo-labs";

interface Row { [key: string]: unknown }

const rows = async <T extends Row>(client: Tx, sql: string): Promise<T[]> => (await client.query<T>(sql, [WORKSPACE_ID])).rows;
const dates = (value: unknown) => (value instanceof Date ? value.toISOString() : value) as string | null;

export async function loadSnapshot(client: Tx, lock = false): Promise<WorkspaceData | null> {
  const found = await client.query(`SELECT * FROM workspaces WHERE id = $1 ${lock ? "FOR UPDATE" : ""}`, [WORKSPACE_ID]);
  const workspace = found.rows[0];
  if (!workspace) return null;

  const [users, userTeams, teams, labels, projects, projectMembers, cycles, issues, issueLabels, comments, activities, views] = await Promise.all([
    rows<Row>(client, "SELECT * FROM users WHERE workspace_id = $1"),
    rows<Row>(client, "SELECT * FROM user_teams WHERE workspace_id = $1"),
    rows<Row>(client, "SELECT * FROM teams WHERE workspace_id = $1"),
    rows<Row>(client, "SELECT * FROM labels WHERE workspace_id = $1"),
    rows<Row>(client, "SELECT * FROM projects WHERE workspace_id = $1"),
    rows<Row>(client, "SELECT * FROM project_members WHERE workspace_id = $1"),
    rows<Row>(client, "SELECT * FROM cycles WHERE workspace_id = $1"),
    rows<Row>(client, "SELECT * FROM issues WHERE workspace_id = $1"),
    rows<Row>(client, "SELECT * FROM issue_labels WHERE workspace_id = $1"),
    rows<Row>(client, "SELECT * FROM comments WHERE workspace_id = $1"),
    rows<Row>(client, "SELECT * FROM activities WHERE workspace_id = $1"),
    rows<Row>(client, "SELECT * FROM saved_views WHERE workspace_id = $1"),
  ]);

  return {
    schemaVersion: 2,
    revision: workspace.revision,
    workspace: { id: workspace.id, name: workspace.name, issuePrefix: workspace.issue_prefix, nextIssueNumber: workspace.next_issue_number, seedAnchorDate: workspace.seed_anchor_date, timezone: workspace.timezone, accessModel: workspace.access_model },
    currentUserId: workspace.current_user_id,
    users: Object.fromEntries(users.map((row) => [row.id, { id: row.id, name: row.name, initials: row.initials, color: row.color, role: row.role, teamIds: userTeams.filter((link) => link.user_id === row.id).map((link) => link.team_id) }])),
    teams: Object.fromEntries(teams.map((row) => [row.id, { id: row.id, name: row.name, key: row.key, wipLimit: row.wip_limit, visibility: row.visibility, ownerIds: userTeams.filter((link) => link.team_id === row.id && link.access === "owner").map((link) => link.user_id) }])),
    labels: Object.fromEntries(labels.map((row) => [row.id, { id: row.id, name: row.name, color: row.color }])),
    projects: Object.fromEntries(projects.map((row) => [row.id, { id: row.id, name: row.name, description: row.description, teamId: row.team_id, icon: row.icon, color: row.color, status: row.status, health: row.health, leadId: row.lead_id, memberIds: projectMembers.filter((link) => link.project_id === row.id).map((link) => link.user_id), startDate: row.start_date, targetDate: row.target_date, archivedAt: dates(row.archived_at), createdAt: dates(row.created_at)!, updatedAt: dates(row.updated_at)! }])),
    cycles: Object.fromEntries(cycles.map((row) => [row.id, { id: row.id, name: row.name, goal: row.goal, teamId: row.team_id, startDate: row.start_date, endDate: row.end_date, closedAt: dates(row.closed_at), snapshot: row.snapshot }])),
    issues: Object.fromEntries(issues.map((row) => [row.id, { id: row.id, identifier: row.identifier, title: row.title, description: row.description, teamId: row.team_id, projectId: row.project_id, status: row.status, priority: row.priority, assigneeId: row.assignee_id, reporterId: row.reporter_id, cycleId: row.cycle_id, labelIds: issueLabels.filter((link) => link.issue_id === row.id).map((link) => link.label_id), estimate: row.estimate, startDate: row.start_date, dueDate: row.due_date, order: row.order, startedAt: dates(row.started_at), completedAt: dates(row.completed_at), deletedAt: dates(row.deleted_at), createdAt: dates(row.created_at)!, updatedAt: dates(row.updated_at)! }])),
    comments: Object.fromEntries(comments.map((row) => [row.id, { id: row.id, issueId: row.issue_id, authorId: row.author_id, body: row.body, createdAt: dates(row.created_at)!, editedAt: dates(row.edited_at) }])),
    activities: Object.fromEntries(activities.map((row) => [row.id, { id: row.id, issueId: row.issue_id, projectId: row.project_id, cycleId: row.cycle_id, actorId: row.actor_id, message: row.message, createdAt: dates(row.created_at)! }])),
    savedViews: Object.fromEntries(views.map((row) => [row.id, { id: row.id, name: row.name, filters: row.filters, sort: row.sort, group: row.group, layout: row.layout, ownerId: row.owner_id, teamId: row.team_id, visibility: row.visibility }])),
    appliedMutations: workspace.applied_mutations,
  };
}

const changed = (before: Record<string, object> | undefined, after: Record<string, object>) => {
  const removed = before ? Object.keys(before).filter((id) => !(id in after)) : [];
  const written = Object.entries(after).filter(([id, entity]) => !before || JSON.stringify(before[id]) !== JSON.stringify(entity)) as [string, Record<string, unknown>][];
  return { removed, written };
};

export async function persistSnapshot(client: Tx, before: WorkspaceData | null, after: WorkspaceData) {
  const b = before ?? undefined;
  await client.query(
    `INSERT INTO workspaces (id, name, issue_prefix, next_issue_number, seed_anchor_date, current_user_id, revision, applied_mutations, timezone, access_model)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (id) DO UPDATE SET name=$2, issue_prefix=$3, next_issue_number=$4, seed_anchor_date=$5, current_user_id=$6, revision=$7, applied_mutations=$8, timezone=$9, access_model=$10`,
    [WORKSPACE_ID, after.workspace.name, after.workspace.issuePrefix, after.workspace.nextIssueNumber, after.workspace.seedAnchorDate, after.currentUserId, after.revision, after.appliedMutations, after.workspace.timezone, after.workspace.accessModel],
  );

  const diff = (map: Record<string, object>, previous: Record<string, object> | undefined) => changed(previous as Record<string, object> | undefined, map);
  const savedViewChanges = diff(after.savedViews, b?.savedViews);
  const commentChanges = diff(after.comments, b?.comments);
  const activityChanges = diff(after.activities, b?.activities);
  const issueChanges = diff(after.issues, b?.issues);
  const projectChanges = diff(after.projects, b?.projects);
  const cycleChanges = diff(after.cycles, b?.cycles);
  const labelChanges = diff(after.labels, b?.labels);
  const userChanges = diff(after.users, b?.users);
  const teamChanges = diff(after.teams, b?.teams);

  const upsertUser = async (u: Record<string, unknown>) => {
    await client.query(`INSERT INTO users (id, workspace_id, name, initials, color, role) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO UPDATE SET name=$3, initials=$4, color=$5, role=$6`, [u.id, WORKSPACE_ID, u.name, u.initials, u.color, u.role]);
    await client.query("DELETE FROM user_teams WHERE workspace_id=$1 AND user_id=$2", [WORKSPACE_ID, u.id]);
    for (const teamId of u.teamIds as string[]) {
      if (!after.teams[teamId]) continue;
      const access = (after.teams[teamId].ownerIds as string[] | undefined)?.includes(u.id as string) ? "owner" : "member";
      await client.query("INSERT INTO user_teams (workspace_id, user_id, team_id, access) VALUES ($1,$2,$3,$4)", [WORKSPACE_ID, u.id, teamId, access]);
    }
  };

  const upsertProject = async (p: Record<string, unknown>) => {
    await client.query(`INSERT INTO projects (id, workspace_id, name, description, team_id, icon, color, status, health, lead_id, start_date, target_date, archived_at, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      ON CONFLICT (id) DO UPDATE SET name=$3, description=$4, team_id=$5, icon=$6, color=$7, status=$8, health=$9, lead_id=$10, start_date=$11, target_date=$12, archived_at=$13, created_at=$14, updated_at=$15`,
      [p.id, WORKSPACE_ID, p.name, p.description, p.teamId, p.icon, p.color, p.status, p.health, p.leadId, p.startDate, p.targetDate, p.archivedAt, p.createdAt, p.updatedAt]);
    await client.query("DELETE FROM project_members WHERE workspace_id=$1 AND project_id=$2", [WORKSPACE_ID, p.id]);
    for (const memberId of p.memberIds as string[]) await client.query("INSERT INTO project_members (workspace_id, project_id, user_id) VALUES ($1,$2,$3)", [WORKSPACE_ID, p.id, memberId]);
  };

  const upsertIssue = async (i: Record<string, unknown>) => {
    await client.query(`INSERT INTO issues (id, workspace_id, identifier, title, description, team_id, project_id, status, priority, assignee_id, reporter_id, cycle_id, estimate, start_date, due_date, "order", started_at, completed_at, deleted_at, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
      ON CONFLICT (id) DO UPDATE SET identifier=$3, title=$4, description=$5, team_id=$6, project_id=$7, status=$8, priority=$9, assignee_id=$10, reporter_id=$11, cycle_id=$12, estimate=$13, start_date=$14, due_date=$15, "order"=$16, started_at=$17, completed_at=$18, deleted_at=$19, created_at=$20, updated_at=$21`,
      [i.id, WORKSPACE_ID, i.identifier, i.title, i.description, i.teamId, i.projectId, i.status, i.priority, i.assigneeId, i.reporterId, i.cycleId, i.estimate, i.startDate, i.dueDate, i.order, i.startedAt, i.completedAt, i.deletedAt, i.createdAt, i.updatedAt]);
    await client.query("DELETE FROM issue_labels WHERE workspace_id=$1 AND issue_id=$2", [WORKSPACE_ID, i.id]);
    for (const labelId of i.labelIds as string[]) await client.query("INSERT INTO issue_labels (workspace_id, issue_id, label_id) VALUES ($1,$2,$3)", [WORKSPACE_ID, i.id, labelId]);
  };

  // Delete children before parents to keep foreign keys happy.
  for (const id of savedViewChanges.removed) await client.query("DELETE FROM saved_views WHERE id=$1", [id]);
  for (const id of commentChanges.removed) await client.query("DELETE FROM comments WHERE id=$1", [id]);
  for (const id of activityChanges.removed) await client.query("DELETE FROM activities WHERE id=$1", [id]);
  for (const id of issueChanges.removed) {
    await client.query("DELETE FROM comments WHERE workspace_id=$1 AND issue_id=$2", [WORKSPACE_ID, id]);
    await client.query("DELETE FROM activities WHERE workspace_id=$1 AND issue_id=$2", [WORKSPACE_ID, id]);
    await client.query("DELETE FROM issue_labels WHERE workspace_id=$1 AND issue_id=$2", [WORKSPACE_ID, id]);
    await client.query("DELETE FROM issues WHERE id=$1", [id]);
  }
  for (const id of projectChanges.removed) {
    await client.query("DELETE FROM activities WHERE workspace_id=$1 AND project_id=$2", [WORKSPACE_ID, id]);
    await client.query("DELETE FROM project_members WHERE workspace_id=$1 AND project_id=$2", [WORKSPACE_ID, id]);
    await client.query("DELETE FROM projects WHERE id=$1", [id]);
  }
  for (const id of cycleChanges.removed) {
    await client.query("DELETE FROM activities WHERE workspace_id=$1 AND cycle_id=$2", [WORKSPACE_ID, id]);
    await client.query("DELETE FROM cycles WHERE id=$1", [id]);
  }
  for (const id of labelChanges.removed) {
    await client.query("DELETE FROM issue_labels WHERE workspace_id=$1 AND label_id=$2", [WORKSPACE_ID, id]);
    await client.query("DELETE FROM labels WHERE id=$1", [id]);
  }
  for (const id of userChanges.removed) {
    await client.query("DELETE FROM comments WHERE workspace_id=$1 AND author_id=$2", [WORKSPACE_ID, id]);
    await client.query("DELETE FROM activities WHERE workspace_id=$1 AND actor_id=$2", [WORKSPACE_ID, id]);
    await client.query("DELETE FROM user_teams WHERE workspace_id=$1 AND user_id=$2", [WORKSPACE_ID, id]);
    await client.query("DELETE FROM users WHERE id=$1", [id]);
  }
  for (const id of teamChanges.removed) {
    await client.query("DELETE FROM user_teams WHERE workspace_id=$1 AND team_id=$2", [WORKSPACE_ID, id]);
    await client.query("DELETE FROM teams WHERE id=$1", [id]);
  }

  // Upsert parents before children so foreign keys resolve.
  for (const [, t] of teamChanges.written) await client.query(`INSERT INTO teams (id, workspace_id, name, key, wip_limit, visibility) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO UPDATE SET name=$3, key=$4, wip_limit=$5, visibility=$6`, [t.id, WORKSPACE_ID, t.name, t.key, t.wipLimit, t.visibility]);
  for (const [, l] of labelChanges.written) await client.query(`INSERT INTO labels (id, workspace_id, name, color) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO UPDATE SET name=$3, color=$4`, [l.id, WORKSPACE_ID, l.name, l.color]);
  for (const [, u] of userChanges.written) await upsertUser(u);
  for (const [, c] of cycleChanges.written) await client.query(`INSERT INTO cycles (id, workspace_id, name, goal, team_id, start_date, end_date, closed_at, snapshot) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO UPDATE SET name=$3, goal=$4, team_id=$5, start_date=$6, end_date=$7, closed_at=$8, snapshot=$9`, [c.id, WORKSPACE_ID, c.name, c.goal, c.teamId, c.startDate, c.endDate, c.closedAt, c.snapshot ? JSON.stringify(c.snapshot) : null]);
  for (const [, p] of projectChanges.written) await upsertProject(p);
  for (const [, i] of issueChanges.written) await upsertIssue(i);
  for (const [, c] of commentChanges.written) await client.query(`INSERT INTO comments (id, workspace_id, issue_id, author_id, body, created_at, edited_at) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO UPDATE SET issue_id=$3, author_id=$4, body=$5, created_at=$6, edited_at=$7`, [c.id, WORKSPACE_ID, c.issueId, c.authorId, c.body, c.createdAt, c.editedAt]);
  for (const [, a] of activityChanges.written) await client.query(`INSERT INTO activities (id, workspace_id, issue_id, project_id, cycle_id, actor_id, message, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO UPDATE SET issue_id=$3, project_id=$4, cycle_id=$5, actor_id=$6, message=$7, created_at=$8`, [a.id, WORKSPACE_ID, a.issueId, a.projectId, a.cycleId, a.actorId, a.message, a.createdAt]);
  for (const [, v] of savedViewChanges.written) await client.query(`INSERT INTO saved_views (id, workspace_id, name, filters, sort, "group", layout, owner_id, team_id, visibility) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO UPDATE SET name=$3, filters=$4, sort=$5, "group"=$6, layout=$7, owner_id=$8, team_id=$9, visibility=$10`, [v.id, WORKSPACE_ID, v.name, JSON.stringify(v.filters), v.sort, v.group, v.layout, v.ownerId ?? null, v.teamId ?? null, v.visibility ?? "workspace"]);
}
