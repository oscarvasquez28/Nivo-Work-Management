import { z } from "zod";
import type { Command, WorkspaceData } from "../../types/domain";

export type DomainErrorCode = "validation" | "not-found" | "conflict" | "persistence-unavailable" | "corrupt-snapshot" | "unsupported-version" | "unauthorized" | "forbidden";
export class DomainError extends Error {
  constructor(public code: DomainErrorCode, message: string) { super(message); this.name = "DomainError"; }
}
export function assert(condition: unknown, message: string, code: DomainErrorCode = "validation"): asserts condition {
  if (!condition) throw new DomainError(code, message);
}

const id = z.string().min(1).max(180).regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/).refine((value) => !["__proto__", "constructor", "prototype"].includes(value), "Invalid identifier");
const name = z.string().trim().min(1).max(160);
const title = z.string().trim().min(1, "A title is required").max(240, "Titles must be 240 characters or fewer");
const description = z.string().max(50000);
const body = z.string().trim().min(1, "A comment cannot be empty").max(20000);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid YYYY-MM-DD date").refine((value) => {
  const time = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}, "Use a valid calendar date");
const instant = z.string().datetime();
const status = z.enum(["backlog", "todo", "in_progress", "in_review", "done"]);
const priority = z.enum(["none", "urgent", "high", "medium", "low"]);
const estimate = z.number().refine((value) => [0, 1, 2, 3, 5, 8, 9].includes(value), "Estimate must be 0, 1, 2, 3, 5, 8, 9, or unestimated").nullable();
const ids = z.array(id).max(1000);
export const issueInputSchema = z.object({ title, description, teamId: id, projectId: id.nullable(), status, priority, assigneeId: id.nullable(), reporterId: id, cycleId: id.nullable(), labelIds: ids, estimate, startDate: date.nullable(), dueDate: date.nullable() }).strict();
export const projectInputSchema = z.object({ name, description, teamId: id, icon: z.string().min(1).max(80), color: z.string().max(80), status: z.enum(["planned", "in_progress", "paused", "completed"]), health: z.enum(["on_track", "at_risk", "off_track"]), leadId: id, memberIds: ids, startDate: date.nullable(), targetDate: date.nullable() }).strict();
export const cycleInputSchema = z.object({ name, goal: z.string().max(10000), teamId: id, startDate: date, endDate: date }).strict();
export const filtersSchema = z.object({ text: z.string().max(1000), statuses: z.array(status), priorities: z.array(priority), assignees: ids, projects: ids, cycles: ids, labels: ids, due: z.enum(["all", "overdue", "week", "none"]), estimate: z.enum(["all", "none", "small", "large"]), excludeDone: z.boolean() }).strict();
export const savedViewSchema = z.object({ id, name, filters: filtersSchema, sort: z.enum(["manual", "updated", "priority", "due", "title", "identifier"]), group: z.enum(["status", "priority", "assignee", "project", "none"]), layout: z.enum(["list", "board"]), ownerId: id.nullable().optional(), teamId: id.nullable().optional(), visibility: z.enum(["personal", "team", "workspace"]).optional() }).strict();
const issueSchema = issueInputSchema.extend({ id, identifier: z.string().regex(/^[A-Z][A-Z0-9]*-\d+$/), order: z.number().finite(), createdAt: instant, updatedAt: instant, startedAt: instant.nullable(), completedAt: instant.nullable(), deletedAt: instant.nullable() });
const projectSchema = projectInputSchema.extend({ id, createdAt: instant, updatedAt: instant, archivedAt: instant.nullable() });
const cycleSchema = cycleInputSchema.extend({ id, closedAt: instant.nullable(), snapshot: z.object({ total: z.number().int().nonnegative(), completed: z.number().int().nonnegative(), points: z.number().nonnegative(), totalPoints: z.number().nonnegative() }).strict().nullable() });
const commentSchema = z.object({ id, issueId: id, authorId: id, body, createdAt: instant, editedAt: instant.nullable() }).strict();
const activitySchema = z.object({ id, issueId: id.nullable(), projectId: id.nullable(), cycleId: id.nullable(), actorId: id, message: z.string().min(1).max(2000), createdAt: instant }).strict();
const userSchema = z.object({ id, name, initials: z.string().min(1).max(8), color: z.string().max(80), role: z.string().max(160), teamIds: ids }).strict();
const teamSchema = z.object({ id, name, key: z.string().min(1).max(20), wipLimit: z.number().int().nonnegative(), visibility: z.enum(["public", "private"]), ownerIds: ids }).strict();
export const timezoneSchema = z.string().max(100).refine((value) => { try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; } }, "Choose a valid time zone");
const labelSchema = z.object({ id, name, color: z.string().max(80) }).strict();
export const snapshotSchema = z.object({
  schemaVersion: z.literal(2), revision: z.number().int().nonnegative(),
  workspace: z.object({ id: z.literal("nivo-labs"), name, issuePrefix: z.string().regex(/^[A-Z][A-Z0-9]*$/), nextIssueNumber: z.number().int().positive(), seedAnchorDate: date, timezone: timezoneSchema, accessModel: z.enum(["project_legacy", "team"]) }).strict(),
  currentUserId: id, users: z.record(id, userSchema), teams: z.record(id, teamSchema), labels: z.record(id, labelSchema), projects: z.record(id, projectSchema), issues: z.record(id, issueSchema), cycles: z.record(id, cycleSchema), comments: z.record(id, commentSchema), activities: z.record(id, activitySchema), savedViews: z.record(id, savedViewSchema), appliedMutations: z.array(id).max(512),
}).strict();

const commandSchema = z.union([
  z.object({ type: z.literal("issue.create"), input: issueInputSchema.partial().extend({ title }), id: id.optional() }).strict(),
  z.object({ type: z.literal("issue.update"), id, patch: issueInputSchema.partial() }).strict(),
  z.object({ type: z.literal("issue.move"), id, status, beforeId: id.optional() }).strict(),
  z.object({ type: z.enum(["issue.delete", "issue.restore"]), id }).strict(),
  z.object({ type: z.literal("issues.bulk"), ids: ids.min(1), patch: issueInputSchema.partial().optional(), delete: z.boolean().optional(), addLabel: id.optional(), removeLabel: id.optional() }).strict(),
  z.object({ type: z.literal("project.create"), input: projectInputSchema, id: id.optional() }).strict(),
  z.object({ type: z.literal("project.update"), id, patch: projectInputSchema.partial() }).strict(),
  z.object({ type: z.literal("project.archive"), id, archived: z.boolean() }).strict(),
  z.object({ type: z.literal("cycle.create"), input: cycleInputSchema, id: id.optional() }).strict(),
  z.object({ type: z.literal("cycle.update"), id, patch: cycleInputSchema.partial() }).strict(),
  z.object({ type: z.enum(["cycle.close", "cycle.reopen"]), id }).strict(),
  z.object({ type: z.literal("comment.add"), issueId: id, body, id: id.optional() }).strict(),
  z.object({ type: z.literal("comment.edit"), id, body }).strict(),
  z.object({ type: z.literal("comment.delete"), id }).strict(),
  z.object({ type: z.literal("view.save"), view: savedViewSchema }).strict(),
  z.object({ type: z.literal("view.delete"), id }).strict(),
]);

export function validateCommand(command: Command): Command {
  const result = commandSchema.safeParse(command);
  if (!result.success) throw new DomainError("validation", result.error.issues.map((issue) => issue.message).join("; "));
  return result.data as Command;
}

export function validateReferences(data: WorkspaceData) {
  const ref = (map: Record<string, unknown>, value: string | null, label: string) => assert(value === null || Object.hasOwn(map, value), `${label} does not exist: ${value}`);
  ref(data.users, data.currentUserId, "Current user");
  const maps = [data.users, data.teams, data.labels, data.projects, data.issues, data.cycles, data.comments, data.activities, data.savedViews];
  for (const map of maps) for (const [key, entity] of Object.entries(map)) assert(key === entity.id, "Entity map key does not match its ID");
  for (const user of Object.values(data.users)) for (const teamId of user.teamIds) ref(data.teams, teamId, "User team");
  for (const team of Object.values(data.teams)) for (const ownerId of team.ownerIds) {
    ref(data.users, ownerId, "Team owner");
    assert(data.users[ownerId].teamIds.includes(team.id), "Team owners must be members");
  }
  for (const project of Object.values(data.projects)) {
    ref(data.teams, project.teamId, "Project team");
    ref(data.users, project.leadId, "Project lead");
    for (const memberId of project.memberIds) ref(data.users, memberId, "Project member");
    assert(project.memberIds.includes(project.leadId), "Project lead must be a member");
    assert(!project.startDate || !project.targetDate || project.startDate <= project.targetDate, "Project target date cannot be before its start date");
    assert(project.createdAt <= project.updatedAt, "Project update cannot precede creation");
  }
  const cycles = Object.values(data.cycles);
  for (const cycle of cycles) {
    ref(data.teams, cycle.teamId, "Cycle team");
    assert(cycle.startDate <= cycle.endDate, "Cycle end date cannot be before its start date");
    assert(Boolean(cycle.closedAt) === Boolean(cycle.snapshot), "Closed cycles require a snapshot; open cycles cannot have one");
    if (cycle.snapshot) assert(cycle.snapshot.completed <= cycle.snapshot.total && cycle.snapshot.points <= cycle.snapshot.totalPoints, "Cycle snapshot totals are invalid");
    if (!cycle.closedAt) for (const other of cycles) {
      if (other.id <= cycle.id || other.closedAt || other.teamId !== cycle.teamId) continue;
      assert(cycle.endDate < other.startDate || other.endDate < cycle.startDate, "Open cycles for the same team cannot overlap");
    }
  }
  const identifiers = new Set<string>();
  for (const issue of Object.values(data.issues)) {
    ref(data.teams, issue.teamId, "Issue team");
    ref(data.projects, issue.projectId, "Issue project");
    ref(data.cycles, issue.cycleId, "Issue cycle");
    ref(data.users, issue.assigneeId, "Assignee");
    ref(data.users, issue.reporterId, "Reporter");
    for (const labelId of issue.labelIds) ref(data.labels, labelId, "Label");
    assert(new Set(issue.labelIds).size === issue.labelIds.length, "Issue labels must be unique");
    assert(!issue.projectId || data.projects[issue.projectId].teamId === issue.teamId, "Issue and project must belong to the same team");
    assert(!issue.cycleId || data.cycles[issue.cycleId].teamId === issue.teamId, "Issue and cycle must belong to the same team");
    assert(!issue.startDate || !issue.dueDate || issue.startDate <= issue.dueDate, "Issue due date cannot be before its start date");
    assert(issue.createdAt <= issue.updatedAt, "Issue update cannot precede creation");
    assert(!issue.startedAt || issue.startedAt >= issue.createdAt, "Issue start cannot precede creation");
    assert((issue.status === "done") === Boolean(issue.completedAt), "Issue completion timestamp must match its status");
    assert(!issue.completedAt || issue.completedAt >= (issue.startedAt ?? issue.createdAt), "Issue completion cannot precede its start");
    assert(!identifiers.has(issue.identifier), "Issue identifiers must be unique");
    assert(issue.identifier.startsWith(`${data.workspace.issuePrefix}-`) && Number(issue.identifier.split("-").at(-1)) < data.workspace.nextIssueNumber, "Issue sequence is invalid");
    identifiers.add(issue.identifier);
  }
  for (const comment of Object.values(data.comments)) {
    ref(data.issues, comment.issueId, "Comment issue");
    ref(data.users, comment.authorId, "Comment author");
    assert(comment.createdAt >= data.issues[comment.issueId].createdAt, "Comment cannot precede its issue");
    assert(!comment.editedAt || comment.editedAt >= comment.createdAt, "Comment edit cannot precede creation");
  }
  for (const activity of Object.values(data.activities)) {
    ref(data.users, activity.actorId, "Activity actor");
    ref(data.issues, activity.issueId, "Activity issue");
    ref(data.projects, activity.projectId, "Activity project");
    ref(data.cycles, activity.cycleId, "Activity cycle");
  }
  for (const view of Object.values(data.savedViews)) {
    for (const value of view.filters.assignees) if (!["none", "unassigned"].includes(value)) ref(data.users, value, "View assignee");
    for (const value of view.filters.projects) if (value !== "none") ref(data.projects, value, "View project");
    for (const value of view.filters.cycles) if (value !== "none") ref(data.cycles, value, "View cycle");
    for (const value of view.filters.labels) if (value !== "none") ref(data.labels, value, "View label");
  }
}

export function validateSnapshot(raw: unknown): WorkspaceData {
  if (raw && typeof raw === "object" && "schemaVersion" in raw && raw.schemaVersion !== 2) throw new DomainError("unsupported-version", "This workspace uses an unsupported schema version. Your saved data has not been changed.");
  const result = snapshotSchema.safeParse(raw);
  if (!result.success) throw new DomainError("corrupt-snapshot", `The saved workspace is invalid: ${result.error.issues.slice(0, 3).map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`);
  try { validateReferences(result.data); } catch (error) { throw new DomainError("corrupt-snapshot", error instanceof Error ? error.message : "The saved workspace contains invalid references."); }
  return result.data;
}
