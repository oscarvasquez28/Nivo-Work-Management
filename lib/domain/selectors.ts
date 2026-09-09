import { EMPTY_FILTERS, type Issue, type IssueFilters, type IssueSort, type WorkspaceData } from "../../types/domain";

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

function progress(issues: Issue[]) {
  const total = issues.length;
  const completed = issues.filter((issue) => issue.status === "done").length;
  return { total, completed, percent: total ? Math.round(completed / total * 100) : 0 };
}

export function projectProgress(data: WorkspaceData, id: string): { total: number; completed: number; percent: number } {
  return progress(Object.values(data.issues).filter((issue) => !issue.deletedAt && issue.projectId === id));
}

export function cycleProgress(data: WorkspaceData, id: string): { total: number; completed: number; percent: number; points: number; totalPoints: number } {
  const cycle = data.cycles[id];
  if (cycle?.closedAt && cycle.snapshot) return { ...cycle.snapshot, percent: cycle.snapshot.total ? Math.round(cycle.snapshot.completed / cycle.snapshot.total * 100) : 0 };
  const issues = Object.values(data.issues).filter((issue) => !issue.deletedAt && issue.cycleId === id);
  return { ...progress(issues), points: issues.reduce((sum, issue) => sum + (issue.status === "done" ? issue.estimate ?? 0 : 0), 0), totalPoints: issues.reduce((sum, issue) => sum + (issue.estimate ?? 0), 0) };
}

export function dateLabel(date: string | null): string {
  if (!date) return "No date";
  const parsed = new Date(date.length === 10 ? `${date}T12:00:00.000Z` : date);
  if (!Number.isFinite(parsed.getTime())) return "Invalid date";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(parsed);
}
