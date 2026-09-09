import { EMPTY_FILTERS, PRIORITIES, STATUSES, type IssueFilters, type IssueGroup, type IssueSort } from "@/types/domain";

export interface IssueViewState {
  filters: IssueFilters;
  sort: IssueSort;
  group: IssueGroup;
  layout: "list" | "board";
}

export const ISSUE_SORTS: { id: IssueSort; name: string }[] = [
  { id: "manual", name: "Manual order" }, { id: "updated", name: "Last updated" },
  { id: "priority", name: "Priority" }, { id: "due", name: "Due date" },
  { id: "title", name: "Title" }, { id: "identifier", name: "Identifier" },
];
export const ISSUE_GROUPS: { id: IssueGroup; name: string }[] = [
  { id: "status", name: "Status" }, { id: "priority", name: "Priority" },
  { id: "assignee", name: "Assignee" }, { id: "project", name: "Project" }, { id: "none", name: "No grouping" },
];

const strings = (value: unknown): string[] => Array.isArray(value)
  ? [...new Set(value.filter((item): item is string => typeof item === "string" && item.length > 0 && item.length < 200))].slice(0, 100)
  : [];

export function normalizeIssueFilters(value: unknown): IssueFilters {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    text: typeof input.text === "string" ? input.text.slice(0, 500) : "",
    statuses: strings(input.statuses).filter((id): id is IssueFilters["statuses"][number] => STATUSES.some((status) => status.id === id)),
    priorities: strings(input.priorities).filter((id): id is IssueFilters["priorities"][number] => PRIORITIES.some((priority) => priority.id === id)),
    assignees: strings(input.assignees), projects: strings(input.projects), cycles: strings(input.cycles), labels: strings(input.labels),
    due: input.due === "overdue" || input.due === "week" || input.due === "none" ? input.due : "all",
    estimate: input.estimate === "none" || input.estimate === "small" || input.estimate === "large" ? input.estimate : "all",
    excludeDone: input.excludeDone === true,
  };
}

export function readIssueView(params: Pick<URLSearchParams, "get">, initialLayout: "list" | "board" = "list"): IssueViewState {
  let raw: unknown;
  try { raw = JSON.parse(params.get("filters") || "{}"); } catch { raw = {}; }
  const filters = normalizeIssueFilters(raw);
  const assignee = params.get("assignee");
  const label = params.get("label");
  if (assignee && assignee.length < 200) filters.assignees = [...new Set([...filters.assignees, assignee])];
  if (label && label.length < 200) filters.labels = [...new Set([...filters.labels, label])];
  const sort = ISSUE_SORTS.find((item) => item.id === params.get("sort"))?.id || "manual";
  const group = ISSUE_GROUPS.find((item) => item.id === params.get("group"))?.id || "status";
  const layout = params.get("layout");
  return { filters, sort, group, layout: layout === "list" || layout === "board" ? layout : initialLayout };
}

export function writeIssueView(params: URLSearchParams, state: IssueViewState): URLSearchParams {
  const next = new URLSearchParams(params);
  next.delete("assignee");
  next.delete("label");
  if (hasIssueFilters(state.filters)) next.set("filters", JSON.stringify(normalizeIssueFilters(state.filters)));
  else next.delete("filters");
  next.set("layout", state.layout);
  next.set("sort", state.sort);
  next.set("group", state.group);
  return next;
}

export function hasIssueFilters(filters: IssueFilters): boolean {
  return Object.entries(filters).some(([key, value]) => Array.isArray(value) ? value.length > 0 : value !== EMPTY_FILTERS[key as keyof IssueFilters]);
}
