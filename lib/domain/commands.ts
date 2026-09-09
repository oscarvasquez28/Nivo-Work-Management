import { STATUSES, type Command, type Issue, type IssueInput, type WorkspaceData } from "../../types/domain";
import { cycleProgress } from "./selectors";
import { assert, DomainError, snapshotSchema, validateCommand, validateReferences } from "./validation";

export interface CommandContext { now?: string; mutationId?: string; actorId?: string; id?: string }

export function applyCommand(data: WorkspaceData, rawCommand: Command, context: CommandContext = {}): WorkspaceData {
  const command = validateCommand(rawCommand);
  const mutationId = context.mutationId ?? `mutation-${data.revision + 1}`;
  if (data.appliedMutations.includes(mutationId)) return data;
  const now = context.now ?? new Date(Date.parse(`${data.workspace.seedAnchorDate}T12:00:00.000Z`) + data.revision).toISOString();
  assert(Number.isFinite(Date.parse(now)) && now === new Date(now).toISOString(), "A valid UTC command timestamp is required");
  const next = structuredClone(data);
  const actorId = context.actorId ?? data.currentUserId;
  assert(Object.hasOwn(next.users, actorId), "The acting user does not exist");
  let activityNumber = 0;
  const entityId = (prefix: string, requested?: string) => requested ?? context.id ?? `${prefix}-${mutationId}`;
  const get = <T,>(map: Record<string, T>, id: string, kind: string): T => {
    assert(Object.hasOwn(map, id), `${kind} was not found`, "not-found");
    return map[id];
  };
  const activity = (message: string, refs: { issueId?: string | null; projectId?: string | null; cycleId?: string | null } = {}) => {
    const id = `activity-${mutationId}-${activityNumber++}`;
    assert(!next.activities[id], "Activity ID already exists", "conflict");
    next.activities[id] = { id, issueId: refs.issueId ?? null, projectId: refs.projectId ?? null, cycleId: refs.cycleId ?? null, actorId, message, createdAt: now };
  };
  const issueActivity = (issue: Issue, message: string) => activity(message, { issueId: issue.id, projectId: issue.projectId, cycleId: issue.cycleId });
  const liveIssue = (id: string) => {
    const issue = get(next.issues, id, "Issue");
    assert(!issue.deletedAt, "Restore this issue before editing it");
    return issue;
  };
  const appendOrder = (status: Issue["status"], excludeId: string) => Math.max(0, ...Object.values(next.issues).filter((issue) => !issue.deletedAt && issue.status === status && issue.id !== excludeId).map((issue) => issue.order)) + 1024;
  const normalizeIssue = (issue: Issue, patch: Partial<IssueInput>, previous?: Issue): Issue => {
    if (patch.projectId) {
      const project = get(next.projects, patch.projectId, "Project");
      assert(!project.archivedAt || previous?.projectId === project.id, "Restore the archived project before adding issues to it");
      assert(!patch.teamId || patch.teamId === project.teamId, "Issue and project must belong to the same team");
      issue.teamId = project.teamId;
    } else if (patch.teamId && issue.projectId && next.projects[issue.projectId]?.teamId !== patch.teamId) issue.projectId = null;
    if (issue.projectId) {
      const project = get(next.projects, issue.projectId, "Project");
      assert(!project.archivedAt || previous?.projectId === project.id, "Restore the archived project before adding issues to it");
      assert(project.teamId === issue.teamId, "Issue and project must belong to the same team");
    }
    if (issue.cycleId) {
      const cycle = get(next.cycles, issue.cycleId, "Cycle");
      if (cycle.teamId !== issue.teamId) {
        assert(!patch.cycleId, "Issue and cycle must belong to the same team");
        issue.cycleId = null;
      }
    }
    if (previous?.cycleId !== issue.cycleId) {
      assert(!previous?.cycleId || !next.cycles[previous.cycleId].closedAt, "Reopen the closed cycle before changing its membership");
      assert(!issue.cycleId || !next.cycles[issue.cycleId].closedAt, "Reopen the closed cycle before adding issues");
    }
    issue.labelIds = [...new Set(issue.labelIds)];
    if (!previous || previous.status !== issue.status) {
      if (["in_progress", "in_review", "done"].includes(issue.status)) issue.startedAt ??= now;
      issue.completedAt = issue.status === "done" ? now : null;
      issue.order = appendOrder(issue.status, issue.id);
    }
    issue.updatedAt = now;
    return issue;
  };
  const updateIssue = (id: string, patch: Partial<IssueInput>) => {
    const previous = liveIssue(id);
    const issue = normalizeIssue({ ...previous, ...patch }, patch, previous);
    next.issues[id] = issue;
    const changes: string[] = [];
    if (previous.status !== issue.status) changes.push(`moved to ${STATUSES.find((entry) => entry.id === issue.status)?.name}`);
    if (previous.title !== issue.title) changes.push("updated the title");
    if (previous.description !== issue.description) changes.push("updated the description");
    if (previous.priority !== issue.priority) changes.push(`set priority to ${issue.priority}`);
    if (previous.assigneeId !== issue.assigneeId) changes.push(issue.assigneeId ? `assigned to ${next.users[issue.assigneeId]?.name ?? issue.assigneeId}` : "removed the assignee");
    if (previous.reporterId !== issue.reporterId) changes.push("updated the reporter");
    if (previous.projectId !== issue.projectId) changes.push(issue.projectId ? `moved to ${next.projects[issue.projectId]?.name ?? issue.projectId}` : "removed from its project");
    if (previous.teamId !== issue.teamId) changes.push(`moved to ${next.teams[issue.teamId]?.name ?? issue.teamId}`);
    if (previous.cycleId !== issue.cycleId) changes.push(issue.cycleId ? `scheduled in ${next.cycles[issue.cycleId]?.name ?? issue.cycleId}` : "removed from its cycle");
    if (previous.estimate !== issue.estimate) changes.push(issue.estimate === null ? "removed the estimate" : `estimated ${issue.estimate} points`);
    if (previous.dueDate !== issue.dueDate || previous.startDate !== issue.startDate) changes.push("updated the dates");
    if (previous.labelIds.join() !== issue.labelIds.join()) changes.push("updated labels");
    issueActivity(issue, changes.length ? `${changes.join("; ")} on ${issue.identifier}` : `updated ${issue.identifier}`);
    return issue;
  };
  const deleteIssue = (id: string) => {
    const issue = liveIssue(id);
    next.issues[id] = { ...issue, deletedAt: now, updatedAt: now };
    issueActivity(issue, `deleted ${issue.identifier}`);
  };

  switch (command.type) {
    case "issue.create": {
      const id = entityId("issue", command.id);
      assert(!Object.hasOwn(next.issues, id), "An issue with this ID already exists", "conflict");
      const input: IssueInput = { description: "", teamId: next.users[actorId].teamIds[0] ?? "engineering", projectId: null, status: "backlog", priority: "none", assigneeId: null, reporterId: actorId, cycleId: null, labelIds: [], estimate: null, startDate: null, dueDate: null, ...command.input, title: command.input.title };
      if (!command.input.teamId && command.input.projectId) input.teamId = get(next.projects, command.input.projectId, "Project").teamId;
      if (!command.input.teamId && !command.input.projectId && command.input.cycleId) input.teamId = get(next.cycles, command.input.cycleId, "Cycle").teamId;
      const issue = normalizeIssue({ ...input, id, identifier: `${next.workspace.issuePrefix}-${next.workspace.nextIssueNumber++}`, order: 0, createdAt: now, updatedAt: now, startedAt: null, completedAt: null, deletedAt: null }, command.input);
      next.issues[id] = issue;
      issueActivity(issue, `created ${issue.identifier}`);
      break;
    }
    case "issue.update": updateIssue(command.id, command.patch); break;
    case "issue.move": {
      const previous = liveIssue(command.id);
      const issue = normalizeIssue({ ...previous, status: command.status }, { status: command.status }, previous);
      if (command.beforeId === command.id) break;
      const siblings = Object.values(next.issues).filter((candidate) => !candidate.deletedAt && candidate.id !== issue.id && candidate.status === issue.status).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
      const index = command.beforeId ? siblings.findIndex((candidate) => candidate.id === command.beforeId) : siblings.length;
      assert(index >= 0, "The ordering target is not in the destination status");
      siblings.splice(index, 0, issue);
      siblings.forEach((candidate, position) => { next.issues[candidate.id] = { ...candidate, order: (position + 1) * 1024 }; });
      issueActivity(issue, previous.status === issue.status ? `reordered ${issue.identifier}` : `moved ${issue.identifier} to ${STATUSES.find((entry) => entry.id === issue.status)?.name}`);
      break;
    }
    case "issue.delete": deleteIssue(command.id); break;
    case "issue.restore": {
      const previous = get(next.issues, command.id, "Issue");
      assert(previous.deletedAt, "This issue is not deleted");
      const issue = normalizeIssue({ ...previous, deletedAt: null }, {}, previous);
      next.issues[issue.id] = issue;
      issueActivity(issue, `restored ${issue.identifier}`);
      break;
    }
    case "issues.bulk": {
      assert(command.patch || command.delete || command.addLabel || command.removeLabel, "Choose at least one bulk change");
      assert(!command.delete || (!command.patch && !command.addLabel && !command.removeLabel), "Delete cannot be combined with other bulk changes");
      if (command.addLabel) get(next.labels, command.addLabel, "Label");
      if (command.removeLabel) get(next.labels, command.removeLabel, "Label");
      for (const id of new Set(command.ids)) {
        if (command.delete) { deleteIssue(id); continue; }
        const issue = liveIssue(id);
        const labels = new Set(command.patch?.labelIds ?? issue.labelIds);
        if (command.addLabel) labels.add(command.addLabel);
        if (command.removeLabel) labels.delete(command.removeLabel);
        updateIssue(id, { ...command.patch, labelIds: [...labels] });
      }
      break;
    }
    case "project.create": {
      const id = entityId("project", command.id);
      assert(!Object.hasOwn(next.projects, id), "A project with this ID already exists", "conflict");
      const project = { ...command.input, id, memberIds: [...new Set([...command.input.memberIds, command.input.leadId])], createdAt: now, updatedAt: now, archivedAt: null };
      next.projects[id] = project;
      activity(`created ${project.name}`, { projectId: id });
      break;
    }
    case "project.update": {
      const previous = get(next.projects, command.id, "Project");
      const project = { ...previous, ...command.patch, updatedAt: now };
      project.memberIds = [...new Set([...project.memberIds, project.leadId])];
      next.projects[project.id] = project;
      if (previous.teamId !== project.teamId) for (const issue of Object.values(next.issues)) {
        if (issue.projectId !== project.id) continue;
        const patch = { projectId: project.id, teamId: project.teamId };
        next.issues[issue.id] = normalizeIssue({ ...issue, ...patch }, patch, issue);
        issueActivity(next.issues[issue.id], `moved ${issue.identifier} with ${project.name} to ${next.teams[project.teamId]?.name ?? project.teamId}`);
      }
      activity(`updated ${project.name}`, { projectId: project.id });
      break;
    }
    case "project.archive": {
      const project = get(next.projects, command.id, "Project");
      next.projects[project.id] = { ...project, archivedAt: command.archived ? now : null, updatedAt: now };
      activity(`${command.archived ? "archived" : "restored"} ${project.name}`, { projectId: project.id });
      break;
    }
    case "cycle.create": {
      const id = entityId("cycle", command.id);
      assert(!Object.hasOwn(next.cycles, id), "A cycle with this ID already exists", "conflict");
      next.cycles[id] = { ...command.input, id, closedAt: null, snapshot: null };
      activity(`created ${command.input.name}`, { cycleId: id });
      break;
    }
    case "cycle.update": {
      const cycle = get(next.cycles, command.id, "Cycle");
      assert(!cycle.closedAt || !["startDate", "endDate", "teamId"].some((key) => key in command.patch), "Reopen the closed cycle before editing its dates or team");
      assert(!command.patch.teamId || command.patch.teamId === cycle.teamId || !Object.values(next.issues).some((issue) => issue.cycleId === cycle.id), "Remove cycle members before changing its team");
      next.cycles[cycle.id] = { ...cycle, ...command.patch };
      activity(`updated ${next.cycles[cycle.id].name}`, { cycleId: cycle.id });
      break;
    }
    case "cycle.close": {
      const cycle = get(next.cycles, command.id, "Cycle");
      assert(!cycle.closedAt, "This cycle is already closed");
      const { total, completed, points, totalPoints } = cycleProgress(next, cycle.id);
      next.cycles[cycle.id] = { ...cycle, closedAt: now, snapshot: { total, completed, points, totalPoints } };
      activity(`completed ${cycle.name} with ${completed} of ${total} issues and ${points} completed points`, { cycleId: cycle.id });
      break;
    }
    case "cycle.reopen": {
      const cycle = get(next.cycles, command.id, "Cycle");
      assert(cycle.closedAt, "This cycle is already open");
      next.cycles[cycle.id] = { ...cycle, closedAt: null, snapshot: null };
      activity(`reopened ${cycle.name}; the previous completion snapshot was cleared`, { cycleId: cycle.id });
      break;
    }
    case "comment.add": {
      const issue = liveIssue(command.issueId);
      const id = entityId("comment", command.id);
      assert(!Object.hasOwn(next.comments, id), "A comment with this ID already exists", "conflict");
      next.comments[id] = { id, issueId: issue.id, authorId: actorId, body: command.body, createdAt: now, editedAt: null };
      next.issues[issue.id] = { ...issue, updatedAt: now };
      issueActivity(issue, `commented on ${issue.identifier}`);
      break;
    }
    case "comment.edit":
    case "comment.delete": {
      const comment = get(next.comments, command.id, "Comment");
      const issue = liveIssue(comment.issueId);
      assert(comment.authorId === actorId, "You can only edit or delete your own comments");
      if (command.type === "comment.delete") delete next.comments[comment.id];
      else next.comments[comment.id] = { ...comment, body: command.body, editedAt: now };
      next.issues[issue.id] = { ...issue, updatedAt: now };
      issueActivity(issue, `${command.type === "comment.delete" ? "deleted" : "edited"} a comment on ${issue.identifier}`);
      break;
    }
    case "view.save": {
      const existed = Object.hasOwn(next.savedViews, command.view.id);
      next.savedViews[command.view.id] = structuredClone(command.view);
      activity(`${existed ? "updated" : "saved"} the view “${command.view.name}”`);
      break;
    }
    case "view.delete": {
      const view = get(next.savedViews, command.id, "Saved view");
      delete next.savedViews[view.id];
      activity(`deleted the view “${view.name}”`);
      break;
    }
    default: {
      const exhaustive: never = command;
      throw new DomainError("validation", `Unsupported command: ${String(exhaustive)}`);
    }
  }
  next.revision += 1;
  next.appliedMutations = [...next.appliedMutations, mutationId].slice(-512);
  const result = snapshotSchema.safeParse(next);
  if (!result.success) throw new DomainError("validation", result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "));
  validateReferences(result.data);
  return result.data;
}

export function commandCreatedId(command: Command): string | undefined {
  if (command.type === "issue.create" || command.type === "project.create" || command.type === "cycle.create" || command.type === "comment.add") return command.id;
  if (command.type === "view.save") return command.view.id;
  return undefined;
}
