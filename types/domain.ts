export type Status = "backlog" | "todo" | "in_progress" | "in_review" | "done";
export type Priority = "none" | "urgent" | "high" | "medium" | "low";
export type ProjectStatus = "planned" | "in_progress" | "paused" | "completed";
export type Health = "on_track" | "at_risk" | "off_track";
export interface User { id: string; name: string; initials: string; color: string; role: string; teamIds: string[]; }
export interface Team { id: string; name: string; key: string; wipLimit: number; }
export interface Label { id: string; name: string; color: string; }
export interface ProjectInput { name: string; description: string; teamId: string; icon: string; color: string; status: ProjectStatus; health: Health; leadId: string; memberIds: string[]; startDate: string | null; targetDate: string | null; }
export interface Project extends ProjectInput { id: string; createdAt: string; updatedAt: string; archivedAt: string | null; }
export interface IssueInput { title: string; description: string; teamId: string; projectId: string | null; status: Status; priority: Priority; assigneeId: string | null; reporterId: string; cycleId: string | null; labelIds: string[]; estimate: number | null; startDate: string | null; dueDate: string | null; }
export interface Issue extends IssueInput { id: string; identifier: string; order: number; createdAt: string; updatedAt: string; startedAt: string | null; completedAt: string | null; deletedAt: string | null; }
export interface CycleInput { name: string; goal: string; teamId: string; startDate: string; endDate: string; }
export interface Cycle extends CycleInput { id: string; closedAt: string | null; snapshot: { total: number; completed: number; points: number; totalPoints: number } | null; }
export interface Comment { id: string; issueId: string; authorId: string; body: string; createdAt: string; editedAt: string | null; }
export interface Activity { id: string; issueId: string | null; projectId: string | null; cycleId: string | null; actorId: string; message: string; createdAt: string; }
export interface IssueFilters { text: string; statuses: Status[]; priorities: Priority[]; assignees: string[]; projects: string[]; cycles: string[]; labels: string[]; due: "all" | "overdue" | "week" | "none"; estimate: "all" | "none" | "small" | "large"; excludeDone: boolean; }
export type IssueSort = "manual" | "updated" | "priority" | "due" | "title" | "identifier";
export type IssueGroup = "status" | "priority" | "assignee" | "project" | "none";
export interface SavedView { id: string; name: string; filters: IssueFilters; sort: IssueSort; group: IssueGroup; layout: "list" | "board"; }
export interface WorkspaceData { schemaVersion: 1; revision: number; workspace: { id: string; name: string; issuePrefix: string; nextIssueNumber: number; seedAnchorDate: string }; currentUserId: string; users: Record<string, User>; teams: Record<string, Team>; labels: Record<string, Label>; projects: Record<string, Project>; issues: Record<string, Issue>; cycles: Record<string, Cycle>; comments: Record<string, Comment>; activities: Record<string, Activity>; savedViews: Record<string, SavedView>; appliedMutations: string[]; }
export type Command =
  | { type: "issue.create"; input: Partial<IssueInput> & { title: string }; id?: string }
  | { type: "issue.update"; id: string; patch: Partial<IssueInput> }
  | { type: "issue.move"; id: string; status: Status; beforeId?: string }
  | { type: "issue.delete" | "issue.restore"; id: string }
  | { type: "issues.bulk"; ids: string[]; patch?: Partial<IssueInput>; delete?: boolean; addLabel?: string; removeLabel?: string }
  | { type: "project.create"; input: ProjectInput; id?: string }
  | { type: "project.update"; id: string; patch: Partial<ProjectInput> }
  | { type: "project.archive"; id: string; archived: boolean }
  | { type: "cycle.create"; input: CycleInput; id?: string }
  | { type: "cycle.update"; id: string; patch: Partial<CycleInput> }
  | { type: "cycle.close" | "cycle.reopen"; id: string }
  | { type: "comment.add"; issueId: string; body: string; id?: string }
  | { type: "comment.edit"; id: string; body: string }
  | { type: "comment.delete"; id: string }
  | { type: "view.save"; view: SavedView }
  | { type: "view.delete"; id: string };
export const STATUSES: { id: Status; name: string; color: string }[] = [
  { id: "backlog", name: "Backlog", color: "#8b92a1" },
  { id: "todo", name: "Todo", color: "#b3bdcd" },
  { id: "in_progress", name: "In Progress", color: "#eab76b" },
  { id: "in_review", name: "In Review", color: "#ac96ee" },
  { id: "done", name: "Done", color: "#76bea6" },
];
export const PRIORITIES: { id: Priority; name: string }[] = [
  { id: "none", name: "No priority" }, { id: "urgent", name: "Urgent" }, { id: "high", name: "High" }, { id: "medium", name: "Medium" }, { id: "low", name: "Low" },
];
export const EMPTY_FILTERS: IssueFilters = { text: "", statuses: [], priorities: [], assignees: [], projects: [], cycles: [], labels: [], due: "all", estimate: "all", excludeDone: false };
