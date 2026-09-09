"use client";

import { Suspense, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { CheckCheck, Layers2, LockKeyhole, Plus, SearchX } from "lucide-react";
import { Badge, Button, EmptyState, PageHeader, Progress } from "@/components/ui";
import { useUI } from "@/components/providers/ui-provider";
import { useWorkspace } from "@/stores/workspace";
import { cycleProgress, projectProgress, selectIssues } from "@/lib/domain/selectors";
import { hasIssueFilters, readIssueView, writeIssueView, type IssueViewState } from "@/lib/utils/view-url";
import { EMPTY_FILTERS, STATUSES, type Command, type IssueInput, type SavedView, type WorkspaceData } from "@/types/domain";
import { IssueBoard } from "@/components/board/issue-board";
import { IssueFilters } from "./issue-filters";
import { IssueList, DEFAULT_COLUMNS, ISSUE_COLUMNS, type IssueColumn } from "./issue-list";
import { IssueBulkToolbar } from "./issue-bulk-toolbar";
import { IssueViewControls } from "./issue-view-controls";
import { errorMessage, MutationError } from "./issue-properties";

export interface IssueExplorerProps {
  projectId?: string; cycleId?: string; assigneeId?: string; initialLayout?: "list" | "board"; title?: string;
}

export function IssueExplorer(props: IssueExplorerProps) {
  return <Suspense fallback={<ExplorerLoading/>}><ExplorerBoundary {...props}/></Suspense>;
}

function ExplorerLoading() {
  return <div className="space-y-5 p-6" role="status" aria-label="Loading issues"><div className="h-7 w-40 animate-pulse rounded bg-[var(--raised)]"/><div className="h-9 animate-pulse rounded bg-[var(--raised)]"/>{[0, 1, 2, 3, 4].map((row) => <div key={row} className="h-9 animate-pulse rounded bg-[var(--surface)]"/>)}</div>;
}

function ExplorerBoundary(props: IssueExplorerProps) {
  const { data, error, retry } = useWorkspace();
  const [retryError, setRetryError] = useState<string | null>(null);
  if (!data) return error ? <div className="p-6"><EmptyState title="Your issues couldn’t load" description={retryError || error} action={<Button onClick={() => { Promise.resolve(retry()).catch((failure) => setRetryError(errorMessage(failure))); }}>Try again</Button>}/></div> : <ExplorerLoading/>;
  if ((props.projectId && !data.projects[props.projectId]) || (props.cycleId && !data.cycles[props.cycleId]) || (props.assigneeId && !data.users[props.assigneeId])) return <EmptyState title="This view is unavailable" description="The project, cycle, or member for this view could not be found."/>;
  return <ExplorerContent {...props} data={data}/>;
}

function ExplorerContent({ data, projectId, cycleId, assigneeId, initialLayout = "list", title }: IssueExplorerProps & { data: WorkspaceData }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const { mutate, pending } = useWorkspace();
  const { openCreateIssue } = useUI();
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const query = params.toString();
  const activeViewId = params.get("view");
  const view = useMemo(() => {
    const queryParams = new URLSearchParams(query);
    const saved = activeViewId ? data.savedViews[activeViewId] : undefined;
    const state = saved && !["filters", "layout", "sort", "group", "assignee", "label"].some((key) => queryParams.has(key)) ? { filters: { ...saved.filters }, sort: saved.sort, group: saved.group, layout: saved.layout } : readIssueView(queryParams, initialLayout);
    return { ...state, filters: { ...state.filters, ...(projectId ? { projects: [] } : {}), ...(cycleId ? { cycles: [] } : {}), ...(assigneeId ? { assignees: [] } : {}) } };
  }, [query, activeViewId, data.savedViews, initialLayout, projectId, cycleId, assigneeId]);
  const scope = useMemo(() => ({ projectId, cycleId, assigneeId }), [projectId, cycleId, assigneeId]);
  const issues = useMemo(() => selectIssues(data, view.filters, scope, view.sort), [data, view.filters, scope, view.sort]);
  const allIssues = useMemo(() => selectIssues(data, {}, scope), [data, scope]);
  const selected = new Set(issues.filter((issue) => selection.has(issue.id)).map((issue) => issue.id));
  const columnParam = params.get("columns");
  const columns = columnParam === null ? DEFAULT_COLUMNS : ISSUE_COLUMNS.filter((column) => columnParam.split(",").includes(column.id)).map((column) => column.id);
  const filtered = hasIssueFilters(view.filters);
  const reorderEnabled = view.sort === "manual" && !filtered;
  const locked = !!((projectId && data.projects[projectId]?.archivedAt) || (cycleId && data.cycles[cycleId]?.closedAt));
  const progress = projectId ? projectProgress(data, projectId) : cycleId ? cycleProgress(data, cycleId) : null;
  const pageTitle = title || (assigneeId ? "My issues" : projectId ? "Project issues" : cycleId ? "Cycle issues" : "All issues");

  function updateURL(next: URLSearchParams) {
    window.history.replaceState(null, "", `${pathname}${next.size ? `?${next.toString()}` : ""}`);
  }
  function changeView(patch: Partial<IssueViewState>, savedId?: string) {
    const next = writeIssueView(new URLSearchParams(query), { ...view, ...patch });
    if (savedId) next.set("view", savedId);
    updateURL(next);
  }
  function changeColumns(nextColumns: IssueColumn[]) {
    const next = new URLSearchParams(query);
    next.set("columns", nextColumns.join(","));
    updateURL(next);
  }
  function loadView(saved: SavedView) {
    setSelection(new Set());
    changeView({ filters: saved.filters, sort: saved.sort, group: saved.group, layout: saved.layout }, saved.id);
  }
  async function command(command: Command): Promise<boolean> {
    setError(null);
    setMessage("");
    try {
      await mutate(command);
      setMessage(command.type === "view.save" ? "View saved" : command.type === "view.delete" ? "View deleted" : "Changes saved");
      return true;
    } catch (failure) { setError(errorMessage(failure)); return false; }
  }
  function create(extra?: Partial<IssueInput>) {
    const f = view.filters;
    const defaults: Partial<IssueInput> = {
      ...(f.statuses.length === 1 ? { status: f.statuses[0] } : {}), ...(f.priorities.length === 1 ? { priority: f.priorities[0] } : {}),
      ...(f.assignees.length === 1 ? { assigneeId: f.assignees[0] === "none" ? null : f.assignees[0] } : {}),
      ...(f.projects.length === 1 ? { projectId: f.projects[0] === "none" ? null : f.projects[0] } : {}),
      ...(f.cycles.length === 1 ? { cycleId: f.cycles[0] === "none" ? null : f.cycles[0] } : {}),
      ...(f.labels.length ? { labelIds: f.labels.filter((id) => !!data.labels[id]) } : {}), ...extra,
      ...(projectId ? { projectId } : {}), ...(cycleId ? { cycleId } : {}), ...(assigneeId ? { assigneeId } : {}),
    };
    openCreateIssue(defaults);
  }
  const onPatch = (id: string, patch: Partial<IssueInput>) => { void command({ type: "issue.update", id, patch }); };
  const onMove = (id: string, status: IssueInput["status"], beforeId?: string) => { void command({ type: "issue.move", id, status, beforeId }); };
  const onSelect = (id: string) => setSelection((previous) => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const onCreate = (extra?: Partial<IssueInput>) => { if (!locked) create(extra); else setError("Reopen this cycle or restore this project before creating issues here."); };
  return <div className="flex min-w-0 flex-col">
    <div className="px-4 pt-6 sm:px-6 sm:pt-8"><PageHeader title={pageTitle} eyebrow={projectId ? data.projects[projectId]?.name : cycleId ? data.cycles[cycleId]?.name : "Workspace"} description={assigneeId ? "Your focus, one issue at a time." : "The details that move the bigger picture."} actions={<Button variant="primary" size="sm" onClick={() => onCreate()} disabled={locked}><Plus size={14}/>New issue</Button>}/></div>
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-5 sm:px-6"><div className="flex flex-wrap items-center gap-3"><span className="flex items-center gap-1.5 text-xs"><Layers2 size={13} className="text-[var(--muted)]"/>{allIssues.length} <span className="text-[var(--muted)]">issues</span></span><span className="h-3 w-px bg-[var(--border)]"/><span className="flex items-center gap-1.5 text-xs text-[var(--muted)]"><CheckCheck size={13}/>{allIssues.filter((issue) => issue.status === "done").length} completed</span>{(projectId || cycleId || assigneeId) && <Badge><LockKeyhole size={9}/>{projectId ? data.projects[projectId].name : cycleId ? data.cycles[cycleId].name : data.users[assigneeId!].name}</Badge>}</div>{progress && <div className="flex w-44 items-center gap-2"><div className="min-w-0 flex-1"><Progress value={progress.percent}/></div><span className="text-[10px] text-[var(--muted)]">{progress.percent}%</span></div>}</div>
    {locked && <p className="mx-4 mb-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--muted)] sm:mx-6">{cycleId && data.cycles[cycleId]?.closedAt ? "This cycle is closed. Reopen it from the cycle overview to add work." : "This project is archived. Restore it from the project overview to add work."}</p>}
    <div className="border-y border-[var(--border)] px-4 py-3 sm:px-6"><div className="flex flex-wrap items-start justify-between gap-3"><IssueFilters data={data} filters={view.filters} onChange={(filters) => { setSelection(new Set()); changeView({ filters }); }} scope={scope}/><IssueViewControls data={data} view={view} onChange={changeView} columns={columns} onColumns={changeColumns} activeViewId={activeViewId} onLoadView={loadView} onCommand={command} busy={!!pending}/></div></div>
    <div className="space-y-3 px-4 pt-3 sm:px-6"><MutationError message={error} onDismiss={() => setError(null)}/>{selected.size > 0 && <IssueBulkToolbar ids={[...selected]} data={data} busy={!!pending} onCommand={command} onClear={() => setSelection(new Set())}/>}<div className="flex items-center justify-between gap-2"><span className="text-[10px] text-[var(--muted)]">{filtered ? `${issues.length} of ${allIssues.length} issues` : `${issues.length} issues`}{view.layout === "list" && view.sort === "manual" && view.group !== "status" ? " · Group by status to reorder" : ""}</span><div className="flex items-center gap-1" aria-label="Visible issue status distribution">{STATUSES.map((status) => { const count = issues.filter((issue) => issue.status === status.id).length; return count ? <span key={status.id} title={`${status.name}: ${count}`} className="h-1.5 rounded-full" style={{ width: Math.max(6, count / Math.max(issues.length, 1) * 80), backgroundColor: status.color }}/> : null; })}</div></div></div>
    <div className="sr-only" role="status">{message}</div>
    <div className={view.layout === "board" ? "min-w-0 p-4 sm:px-6" : "min-w-0 pt-3"}>{!issues.length && view.layout === "list" ? <EmptyState icon={<SearchX size={26}/>} title={filtered ? "No issues match this view" : "A clear space for what’s next"} description={filtered ? "Try adjusting your filters. Your project, cycle, or personal scope will stay in place." : "Create the first issue and give your team a clear next step."} action={filtered ? <Button onClick={() => changeView({ filters: { ...EMPTY_FILTERS } })}>Clear filters</Button> : !locked ? <Button variant="primary" onClick={() => onCreate()}><Plus size={14}/>Create issue</Button> : undefined}/> : view.layout === "board" ? <IssueBoard issues={issues} data={data} reorderEnabled={reorderEnabled} busy={!!pending} selected={selected} onSelect={onSelect} onPatch={onPatch} onMove={onMove} onCreate={onCreate}/> : <IssueList issues={issues} data={data} group={view.group} columns={columns} selected={selected} onSelect={onSelect} onSelectAll={() => setSelection(selected.size === issues.length ? new Set() : new Set(issues.map((issue) => issue.id)))} onPatch={onPatch} onCreate={onCreate} onSort={(sort) => changeView({ sort })} onMove={onMove} reorderEnabled={reorderEnabled && view.group === "status"} busy={!!pending}/>}</div>
  </div>;
}
