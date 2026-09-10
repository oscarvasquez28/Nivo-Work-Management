import type { Command, IssueInput, SessionUser, WorkspaceData } from "../../types/domain";
import { assert } from "./validation";

export type Actor = Pick<SessionUser, "id" | "access">;
export const isTeamMember = (data: WorkspaceData, userId: string, teamId: string) => !!data.users[userId]?.teamIds.includes(teamId);
export const canAccessTeam = (data: WorkspaceData, userId: string, teamId: string) => !!data.teams[teamId] && (data.teams[teamId].visibility === "public" || isTeamMember(data, userId, teamId));
export const canManageTeam = (data: WorkspaceData, actor: Actor, teamId: string) => actor.access === "admin" || !!data.teams[teamId]?.ownerIds.includes(actor.id);
export const canAccessProject = (data: WorkspaceData, actor: Actor, id: string) => {
  const project = data.projects[id];
  return !!project && (actor.access === "admin" || (data.workspace.accessModel === "project_legacy" ? project.leadId === actor.id || project.memberIds.includes(actor.id) : canAccessTeam(data, actor.id, project.teamId)));
};
export const canAccessIssue = (data: WorkspaceData, actor: Actor, id: string) => {
  const issue = data.issues[id];
  return !!issue && (actor.access === "admin" || (issue.projectId ? canAccessProject(data, actor, issue.projectId) : data.workspace.accessModel === "project_legacy" ? isTeamMember(data, actor.id, issue.teamId) : canAccessTeam(data, actor.id, issue.teamId)));
};

export function scopeSnapshot(data: WorkspaceData, actor: Actor): WorkspaceData {
  const legacy = data.workspace.accessModel === "project_legacy";
  const projects = Object.fromEntries(Object.entries(data.projects).filter(([id]) => canAccessProject(data, actor, id)));
  const issues = Object.fromEntries(Object.entries(data.issues).filter(([id]) => canAccessIssue(data, actor, id)).map(([id, issue]) => [id, { ...issue }]));
  const cycles = Object.fromEntries(Object.entries(data.cycles).filter(([, cycle]) => {
    if (actor.access === "admin") return true;
    return canAccessTeam(data, actor.id, cycle.teamId) && (!legacy || Object.values(data.issues).filter((issue) => issue.cycleId === cycle.id).every((issue) => !!issues[issue.id]));
  }));
  for (const issue of Object.values(issues)) if (issue.cycleId && !cycles[issue.cycleId]) issue.cycleId = null;
  const teamIds = new Set([...Object.values(projects).map((p) => p.teamId), ...Object.values(issues).map((i) => i.teamId), ...Object.values(cycles).map((c) => c.teamId)]);
  const teams = Object.fromEntries(Object.entries(data.teams).filter(([id]) => actor.access === "admin" || canAccessTeam(data, actor.id, id) || teamIds.has(id)));
  const users = Object.fromEntries(Object.entries(data.users).map(([id, user]) => [id, { ...user, teamIds: user.teamIds.filter((team) => !!teams[team]) }]));
  const savedViews = Object.fromEntries(Object.entries(data.savedViews).filter(([, view]) => {
    if (view.visibility === "personal" && view.ownerId !== actor.id) return false;
    if (view.teamId && !canAccessTeam(data, actor.id, view.teamId)) return false;
    return view.filters.projects.every((id) => id === "none" || !!projects[id]) && view.filters.cycles.every((id) => id === "none" || !!cycles[id]);
  }));
  return {
    ...data, currentUserId: actor.id, users, teams, projects, issues, cycles, savedViews,
    comments: Object.fromEntries(Object.entries(data.comments).filter(([, comment]) => !!issues[comment.issueId])),
    activities: Object.fromEntries(Object.entries(data.activities).filter(([, a]) =>
      (a.issueId || a.projectId || a.cycleId) && (!a.issueId || !!issues[a.issueId]) && (!a.projectId || !!projects[a.projectId]) && (!a.cycleId || !!cycles[a.cycleId]))),
  };
}

export function assertCommandAccess(data: WorkspaceData, actor: Actor, command: Command) {
  const legacy = data.workspace.accessModel === "project_legacy";
  const requireAccess = (allowed: boolean) => assert(allowed, "This action is not permitted for this resource.", "forbidden");
  const team = (id: string) => requireAccess(actor.access === "admin" || canAccessTeam(data, actor.id, id));
  const project = (id: string) => requireAccess(canAccessProject(data, actor, id));
  const issue = (id: string) => requireAccess(canAccessIssue(data, actor, id));
  const patch = (input: Partial<IssueInput>, previousId?: string) => {
    const previous = previousId ? data.issues[previousId] : undefined;
    const projectId = input.projectId === undefined ? previous?.projectId : input.projectId;
    const teamId = input.teamId ?? (input.projectId ? data.projects[input.projectId]?.teamId : undefined) ?? previous?.teamId ?? (input.cycleId ? data.cycles[input.cycleId]?.teamId : undefined) ?? data.users[actor.id]?.teamIds[0];
    requireAccess(!!teamId);
    if (projectId) project(projectId);
    else team(teamId!);
    if (input.teamId) team(input.teamId);
    if (input.cycleId) { requireAccess(!!data.cycles[input.cycleId]); team(data.cycles[input.cycleId].teamId); }
    if (input.assigneeId) requireAccess(canAccessTeam(data, input.assigneeId, teamId!));
  };
  switch (command.type) {
    case "issue.create": patch(command.input); break;
    case "issue.update": issue(command.id); patch(command.patch, command.id); break;
    case "issue.move":
      issue(command.id);
      if (command.beforeId) { issue(command.beforeId); requireAccess(data.issues[command.id].teamId === data.issues[command.beforeId].teamId); }
      break;
    case "issue.delete": case "issue.restore": issue(command.id); break;
    case "issues.bulk": for (const id of command.ids) { issue(id); patch(command.patch ?? {}, id); } break;
    case "project.create":
      team(command.input.teamId);
      for (const id of [...command.input.memberIds, command.input.leadId]) requireAccess(canAccessTeam(data, id, command.input.teamId));
      break;
    case "project.update": case "project.archive": {
      project(command.id);
      const existing = data.projects[command.id];
      if (legacy) requireAccess(actor.access === "admin" || existing.leadId === actor.id);
      if (command.type === "project.update") {
        const target = command.patch.teamId ?? existing.teamId;
        if (target !== existing.teamId) requireAccess(canManageTeam(data, actor, target) && canManageTeam(data, actor, existing.teamId));
        team(target);
        for (const id of command.patch.memberIds ?? []) requireAccess(canAccessTeam(data, id, target));
        if (command.patch.leadId) requireAccess(canAccessTeam(data, command.patch.leadId, target));
      }
      break;
    }
    case "cycle.create": team(command.input.teamId); requireAccess(canManageTeam(data, actor, command.input.teamId)); break;
    case "cycle.update": case "cycle.close": case "cycle.reopen": {
      const cycle = data.cycles[command.id];
      requireAccess(!!cycle);
      team(cycle.teamId);
      requireAccess(canManageTeam(data, actor, cycle.teamId));
      if (command.type === "cycle.update" && command.patch.teamId) { team(command.patch.teamId); requireAccess(canManageTeam(data, actor, command.patch.teamId)); }
      break;
    }
    case "comment.add": issue(command.issueId); break;
    case "comment.edit": case "comment.delete": {
      const comment = data.comments[command.id];
      requireAccess(!!comment);
      issue(comment.issueId);
      requireAccess(comment.authorId === actor.id);
      break;
    }
    case "view.save": case "view.delete": {
      const id = command.type === "view.save" ? command.view.id : command.id;
      const existing = data.savedViews[id];
      if (existing) requireAccess(!!scopeSnapshot(data, actor).savedViews[id] && (existing.ownerId === actor.id || actor.access === "admin"));
      if (command.type === "view.save") {
        if (command.view.teamId) team(command.view.teamId);
        if (command.view.ownerId) requireAccess(command.view.ownerId === actor.id || existing?.ownerId === command.view.ownerId && actor.access === "admin");
        if (command.view.visibility === "workspace") requireAccess(actor.access === "admin");
        for (const id of command.view.filters.projects) if (id !== "none") project(id);
        for (const id of command.view.filters.cycles) if (id !== "none") { requireAccess(!!data.cycles[id]); team(data.cycles[id].teamId); }
      }
      break;
    }
    default: { const unsupported: never = command; throw new Error(`Unknown action: ${String(unsupported)}`); }
  }
}
