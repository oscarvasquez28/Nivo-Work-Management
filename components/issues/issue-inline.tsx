"use client";

import { Avatar, PriorityIcon, Select, StatusIcon } from "@/components/ui";
import { PRIORITIES, STATUSES, type Issue, type IssueInput, type WorkspaceData } from "@/types/domain";
import { inlineSelectClass } from "./issue-properties";

export type IssuePatchHandler = (id: string, patch: Partial<IssueInput>) => void;

export function StatusPicker({ issue, onPatch, disabled }: { issue: Issue; onPatch: IssuePatchHandler; disabled?: boolean }) {
  return <div className="flex min-w-0 items-center gap-1"><StatusIcon status={issue.status}/><Select aria-label={`Status for ${issue.identifier}`} title="Change status" className={inlineSelectClass} value={issue.status} disabled={disabled} onChange={(event) => onPatch(issue.id, { status: event.target.value as Issue["status"] })}>{STATUSES.map((status) => <option key={status.id} value={status.id}>{status.name}</option>)}</Select></div>;
}

export function PriorityPicker({ issue, onPatch, disabled }: { issue: Issue; onPatch: IssuePatchHandler; disabled?: boolean }) {
  return <div className="relative flex size-7 items-center justify-center rounded hover:bg-[var(--raised)]"><PriorityIcon priority={issue.priority}/><select aria-label={`Priority for ${issue.identifier}`} title={PRIORITIES.find((priority) => priority.id === issue.priority)?.name} value={issue.priority} disabled={disabled} className="absolute inset-0 w-full cursor-pointer opacity-0 focus:opacity-100" onChange={(event) => onPatch(issue.id, { priority: event.target.value as Issue["priority"] })}>{PRIORITIES.map((priority) => <option key={priority.id} value={priority.id}>{priority.name}</option>)}</select></div>;
}

export function AssigneePicker({ issue, data, onPatch, disabled }: { issue: Issue; data: WorkspaceData; onPatch: IssuePatchHandler; disabled?: boolean }) {
  const user = issue.assigneeId ? data.users[issue.assigneeId] : null;
  return <div className="relative flex size-7 items-center justify-center rounded-full ring-offset-[var(--bg)] focus-within:ring-2 focus-within:ring-[var(--accent)]" title={user?.name || "Unassigned"}><Avatar user={user} size="sm"/><select aria-label={`Assignee for ${issue.identifier}`} value={issue.assigneeId || ""} disabled={disabled} className="absolute inset-0 w-full cursor-pointer opacity-0" onChange={(event) => onPatch(issue.id, { assigneeId: event.target.value || null })}><option value="">Unassigned</option>{Object.values(data.users).map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></div>;
}

export function DueDate({ issue }: { issue: Issue }) {
  if (!issue.dueDate) return <span className="text-[var(--muted)]">—</span>;
  const overdue = issue.status !== "done" && issue.dueDate < new Date().toLocaleDateString("en-CA");
  return <time dateTime={issue.dueDate} title={`${overdue ? "Overdue · " : "Due "}${issue.dueDate}`} className={overdue ? "text-red-400" : "text-[var(--muted)]"}>{new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${issue.dueDate}T12:00:00Z`))}</time>;
}
