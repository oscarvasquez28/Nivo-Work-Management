"use client";

import { Field, Input, Select, cn } from "@/components/ui";
import { PRIORITIES, STATUSES, type IssueInput, type WorkspaceData } from "@/types/domain";

export const editorClass = "w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 disabled:opacity-50";
export const inlineSelectClass = "!h-7 !min-h-0 !w-auto max-w-full !border-transparent !bg-transparent !py-0 !pl-1 !pr-6 !text-xs hover:!bg-[var(--raised)] focus:!border-[var(--accent)]";
export const errorMessage = (error: unknown) => error instanceof Error ? error.message : "This change could not be saved. Please try again.";

export function IssueProperties({ data, value, onChange, disabled = false, compact = false }: {
  data: WorkspaceData; value: IssueInput; onChange: (patch: Partial<IssueInput>) => void; disabled?: boolean; compact?: boolean;
}) {
  const projects = Object.values(data.projects).filter((project) => !project.archivedAt || project.id === value.projectId);
  const cycles = Object.values(data.cycles).filter((cycle) => cycle.teamId === value.teamId && (!cycle.closedAt || cycle.id === value.cycleId));
  return <div className={cn("grid min-w-0 gap-x-4 gap-y-4", compact ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2")}>
    <Field label="Status"><Select aria-label="Status" value={value.status} disabled={disabled} onChange={(event) => onChange({ status: event.target.value as IssueInput["status"] })}>{STATUSES.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
    <Field label="Priority"><Select aria-label="Priority" value={value.priority} disabled={disabled} onChange={(event) => onChange({ priority: event.target.value as IssueInput["priority"] })}>{PRIORITIES.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
    <Field label="Assignee"><Select aria-label="Assignee" value={value.assigneeId || ""} disabled={disabled} onChange={(event) => onChange({ assigneeId: event.target.value || null })}><option value="">Unassigned</option>{Object.values(data.users).map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</Select></Field>
    <Field label="Team"><Select aria-label="Team" value={value.teamId} disabled={disabled} onChange={(event) => onChange({ teamId: event.target.value, projectId: null, cycleId: null })}>{Object.values(data.teams).map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</Select></Field>
    <Field label="Project"><Select aria-label="Project" value={value.projectId || ""} disabled={disabled} onChange={(event) => {
      const project = data.projects[event.target.value];
      onChange(project ? { projectId: project.id, teamId: project.teamId, ...(project.teamId !== value.teamId ? { cycleId: null } : {}) } : { projectId: null });
    }}><option value="">No project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}{project.archivedAt ? " (archived)" : ""}</option>)}</Select></Field>
    <Field label="Cycle"><Select aria-label="Cycle" value={value.cycleId || ""} disabled={disabled} onChange={(event) => onChange({ cycleId: event.target.value || null })}><option value="">No cycle</option>{cycles.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.name}{cycle.closedAt ? " (closed)" : ""}</option>)}</Select></Field>
    <Field label="Estimate"><Select aria-label="Estimate" value={value.estimate ?? ""} disabled={disabled} onChange={(event) => onChange({ estimate: event.target.value === "" ? null : Number(event.target.value) })}><option value="">No estimate</option>{[0, 1, 2, 3, 5, 8, 9].map((points) => <option key={points} value={points}>{points} points</option>)}</Select></Field>
    <Field label="Reporter"><Select aria-label="Reporter" value={value.reporterId} disabled={disabled} onChange={(event) => onChange({ reporterId: event.target.value })}>{Object.values(data.users).map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</Select></Field>
    <Field label="Start date"><Input aria-label="Start date" type="date" value={value.startDate || ""} disabled={disabled} onChange={(event) => onChange({ startDate: event.target.value || null })}/></Field>
    <Field label="Due date"><Input aria-label="Due date" type="date" value={value.dueDate || ""} disabled={disabled} onChange={(event) => onChange({ dueDate: event.target.value || null })}/></Field>
    <fieldset className="col-span-full min-w-0"><legend className="mb-2 text-xs font-medium text-[var(--muted)]">Labels</legend><div className="flex flex-wrap gap-2">{Object.values(data.labels).map((label) => <label key={label.id} className={cn("flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1 text-xs transition", value.labelIds.includes(label.id) ? "border-[var(--accent)] bg-[var(--accent)]/10" : "border-[var(--border)] hover:bg-[var(--raised)]")}><input type="checkbox" className="accent-[var(--accent)]" checked={value.labelIds.includes(label.id)} disabled={disabled} onChange={(event) => onChange({ labelIds: event.target.checked ? [...value.labelIds, label.id] : value.labelIds.filter((id) => id !== label.id) })}/><span className="size-1.5 rounded-full" style={{ backgroundColor: label.color }}/>{label.name}</label>)}</div></fieldset>
  </div>;
}

export function MutationError({ message, onDismiss }: { message: string | null; onDismiss?: () => void }) {
  if (!message) return null;
  return <div role="alert" className="flex items-start justify-between gap-3 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-400"><span>{message}</span>{onDismiss && <button type="button" onClick={onDismiss} className="shrink-0 text-xs underline">Dismiss</button>}</div>;
}
