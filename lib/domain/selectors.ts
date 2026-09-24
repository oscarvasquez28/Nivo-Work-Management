import { EMPTY_FILTERS, type Issue, type IssueFilters, type IssueLink, type IssueSort, type WorkspaceData } from "../../types/domain";

const priorityRank = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };
const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const included = (values: string[], value: string | null) => !values.length || values.includes(value ?? "none") || (value === null && values.includes("unassigned"));
const compareText = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

export function selectIssues(data: WorkspaceData, filters: Partial<IssueFilters> = {}, scope: { projectId?: string; cycleId?: string; assigneeId?: string } = {}, sort: IssueSort = "manual"): Issue[] {
  const f = { ...EMPTY_FILTERS, ...filters };
  const query = normalize(f.text.trim());
  const today = new Date().toISOString().slice(0, 10);
  const week = new Date(Date.parse(`${today}T00:00:00Z`) + 7 * 86400000).toISOString().slice(0, 10);
  return Object.values(data.issues).filter((issue) => {
    if (issue.deletedAt || (scope.projectId !== undefined && issue.projectId !== scope.projectId) || (scope.cycleId !== undefined && issue.cycleId !== scope.cycleId) || (scope.assigneeId !== undefined && issue.assigneeId !== scope.assigneeId)) return false;
    if (f.excludeDone && issue.status === "done") return false;
    if (!included(f.statuses, issue.status) || !included(f.priorities, issue.priority) || !included(f.assignees, issue.assigneeId) || !included(f.projects, issue.projectId) || !included(f.cycles, issue.cycleId)) return false;
    if (f.labels.length && !f.labels.some((id) => id === "none" ? !issue.labelIds.length : issue.labelIds.includes(id))) return false;
    if (query && !normalize(`${issue.identifier} ${issue.title} ${issue.description}`).includes(query)) return false;
    if (f.due === "none" && issue.dueDate !== null) return false;
    if (f.due === "overdue" && (!issue.dueDate || issue.dueDate >= today || issue.status === "done")) return false;
    if (f.due === "week" && (!issue.dueDate || issue.dueDate < today || issue.dueDate > week)) return false;
    if (f.estimate === "none" && issue.estimate !== null) return false;
    if (f.estimate === "small" && (issue.estimate === null || issue.estimate > 3)) return false;
    if (f.estimate === "large" && (issue.estimate === null || issue.estimate < 5)) return false;
    if (f.blocked !== "all" && (f.blocked === "blocked") !== isIssueBlocked(data, issue)) return false;
    return true;
  }).sort((a, b) => {
    let order = 0;
    switch (sort) {
      case "manual": order = a.order - b.order; break;
      case "updated": order = compareText(b.updatedAt, a.updatedAt); break;
      case "priority": order = priorityRank[a.priority] - priorityRank[b.priority]; break;
      case "due": order = compareText(a.dueDate ?? "9999-12-31", b.dueDate ?? "9999-12-31"); break;
      case "title": order = compareText(normalize(a.title), normalize(b.title)); break;
      case "identifier": order = Number(a.identifier.split("-").at(-1)) - Number(b.identifier.split("-").at(-1)); break;
    }
    return order || compareText(a.id, b.id);
  });
}

export function issueDuration(issue: Issue): number {
  if (!issue.startDate || !issue.dueDate) return 1;
  const days = Math.round((Date.parse(`${issue.dueDate}T00:00:00Z`) - Date.parse(`${issue.startDate}T00:00:00Z`)) / 86400000) + 1;
  return Math.max(1, days);
}

function progress(issues: Issue[]) {
  const total = issues.length;
  const completed = issues.filter((issue) => issue.status === "done").length;
  const weightTotal = issues.reduce((sum, issue) => sum + issueDuration(issue), 0);
  const weightCompleted = issues.reduce((sum, issue) => sum + (issue.status === "done" ? issueDuration(issue) : 0), 0);
  return { total, completed, weightTotal, weightCompleted, percent: weightTotal ? Math.round(weightCompleted / weightTotal * 100) : 0 };
}

export function projectProgress(data: WorkspaceData, id: string): { total: number; completed: number; weightTotal: number; weightCompleted: number; percent: number } {
  return progress(Object.values(data.issues).filter((issue) => !issue.deletedAt && issue.projectId === id));
}

export function cycleProgress(data: WorkspaceData, id: string): { total: number; completed: number; weightTotal: number; weightCompleted: number; percent: number; points: number; totalPoints: number } {
  const cycle = data.cycles[id];
  if (cycle?.closedAt && cycle.snapshot) {
    const weightTotal = cycle.snapshot.weightTotal ?? cycle.snapshot.total;
    const weightCompleted = cycle.snapshot.weightCompleted ?? cycle.snapshot.completed;
    return { ...cycle.snapshot, weightTotal, weightCompleted, percent: weightTotal ? Math.round(weightCompleted / weightTotal * 100) : 0 };
  }
  const issues = Object.values(data.issues).filter((issue) => !issue.deletedAt && issue.cycleId === id);
  return { ...progress(issues), points: issues.reduce((sum, issue) => sum + (issue.status === "done" ? issue.estimate ?? 0 : 0), 0), totalPoints: issues.reduce((sum, issue) => sum + (issue.estimate ?? 0), 0) };
}

export function issueBlockers(data: WorkspaceData, issueId: string): IssueLink[] {
  return Object.values(data.issueLinks).filter((link) => link.type === "blocks" && link.targetIssueId === issueId && !data.issues[link.sourceIssueId]?.deletedAt);
}

export function issueBlocking(data: WorkspaceData, issueId: string): IssueLink[] {
  return Object.values(data.issueLinks).filter((link) => link.type === "blocks" && link.sourceIssueId === issueId && !data.issues[link.targetIssueId]?.deletedAt);
}

export function issueRelated(data: WorkspaceData, issueId: string): IssueLink[] {
  return Object.values(data.issueLinks).filter((link) => link.type === "relates_to" && (link.sourceIssueId === issueId || link.targetIssueId === issueId) && !data.issues[link.sourceIssueId === issueId ? link.targetIssueId : link.sourceIssueId]?.deletedAt);
}

export function isIssueBlocked(data: WorkspaceData, issue: Issue): boolean {
  return issueBlockers(data, issue.id).some((link) => data.issues[link.sourceIssueId]?.status !== "done");
}

export function issueSchedule(issue: Issue, today: string): { plannedPercent: number | null; actualPercent: number; plannedDays: number | null; actualDays: number | null } {
  let plannedPercent: number | null = null;
  let plannedDays: number | null = null;
  if (issue.startDate && issue.dueDate) {
    const start = Date.parse(`${issue.startDate}T00:00:00Z`);
    const end = Date.parse(`${issue.dueDate}T00:00:00Z`);
    plannedDays = Math.max(1, Math.round((end - start) / 86400000) + 1);
    plannedPercent = Math.max(0, Math.min(100, Math.round((Date.parse(`${today}T00:00:00Z`) - start) / 86400000 / plannedDays * 100)));
  }
  let actualDays: number | null = null;
  if (issue.startedAt) {
    const actualEnd = issue.actualEndDate ?? today;
    actualDays = Math.max(1, Math.round((Date.parse(`${actualEnd}T00:00:00Z`) - Date.parse(issue.startedAt)) / 86400000) + 1);
  }
  const actualPercent = issue.status === "done" ? 100 : issue.status === "in_review" ? 75 : issue.status === "in_progress" ? 50 : 0;
  return { plannedPercent, actualPercent, plannedDays, actualDays };
}

export function overdueIssuesFor(data: WorkspaceData, userId: string): Issue[] {
  const today = new Date().toISOString().slice(0, 10);
  return Object.values(data.issues)
    .filter((issue) => !issue.deletedAt && issue.assigneeId === userId && issue.status !== "done" && !!issue.dueDate && issue.dueDate < today)
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? "") || a.identifier.localeCompare(b.identifier));
}

export function dateLabel(date: string | null): string {
  if (!date) return "No date";
  const parsed = new Date(date.length === 10 ? `${date}T12:00:00.000Z` : date);
  if (!Number.isFinite(parsed.getTime())) return "Invalid date";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(parsed);
}
