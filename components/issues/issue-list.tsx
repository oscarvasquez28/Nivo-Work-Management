"use client";

import Link from "next/link";
import { Fragment, useEffect, useRef } from "react";
import { ArrowDown, ArrowUp, ChevronDown, Plus } from "lucide-react";
import { Badge, Button, Select, StatusIcon, cn } from "@/components/ui";
import { PRIORITIES, STATUSES, type Issue, type IssueGroup, type IssueInput, type IssueSort, type WorkspaceData } from "@/types/domain";
import { AssigneePicker, DueDate, PriorityPicker, StatusPicker, type IssuePatchHandler } from "./issue-inline";
import { inlineSelectClass } from "./issue-properties";

export const ISSUE_COLUMNS = [
  { id: "priority", name: "Priority" }, { id: "status", name: "Status" }, { id: "labels", name: "Labels" },
  { id: "project", name: "Project" }, { id: "cycle", name: "Cycle" }, { id: "estimate", name: "Estimate" },
  { id: "due", name: "Due date" }, { id: "assignee", name: "Assignee" },
] as const;
export type IssueColumn = typeof ISSUE_COLUMNS[number]["id"];
export const DEFAULT_COLUMNS: IssueColumn[] = ["priority", "labels", "project", "due", "assignee"];

export function groupIssues(issues: Issue[], group: IssueGroup, data: WorkspaceData): { id: string; name: string; issues: Issue[] }[] {
  if (group === "none") return [{ id: "all", name: "All issues", issues }];
  const getKey = (issue: Issue) => group === "status" ? issue.status : group === "priority" ? issue.priority : group === "assignee" ? issue.assigneeId || "none" : issue.projectId || "none";
  const keys = [...new Set(issues.map(getKey))];
  const registry = group === "status" ? STATUSES : group === "priority" ? PRIORITIES : [];
  if (registry.length) keys.sort((a, b) => registry.findIndex((item) => item.id === a) - registry.findIndex((item) => item.id === b));
  return keys.map((id) => ({ id, name: registry.find((item) => item.id === id)?.name || (group === "assignee" ? data.users[id]?.name || "Unassigned" : data.projects[id]?.name || "No project"), issues: issues.filter((issue) => getKey(issue) === id) }));
}

export function IssueList({ issues, data, group, columns, selected, onSelect, onSelectAll, onPatch, onCreate, onSort, onMove, reorderEnabled, busy }: {
  issues: Issue[]; data: WorkspaceData; group: IssueGroup; columns: IssueColumn[]; selected: Set<string>;
  onSelect: (id: string) => void; onSelectAll: () => void; onPatch: IssuePatchHandler; onCreate: (defaults?: Partial<IssueInput>) => void;
  onSort: (sort: IssueSort) => void; onMove: (id: string, status: Issue["status"], beforeId?: string) => void; reorderEnabled: boolean; busy: boolean;
}) {
  const groups = groupIssues(issues, group, data);
  const has = (column: IssueColumn) => columns.includes(column);
  const groupDefaults = (id: string): Partial<IssueInput> => group === "status" ? { status: id as Issue["status"] } : group === "priority" ? { priority: id as Issue["priority"] } : group === "assignee" ? { assigneeId: id === "none" ? null : id } : group === "project" ? { projectId: id === "none" ? null : id } : {};
  const allChecked = issues.length > 0 && issues.every((issue) => selected.has(issue.id));
  return <div className="min-w-0">
    <div className="hidden max-w-full overflow-x-auto md:block"><table className="w-full border-collapse text-left text-xs"><caption className="sr-only">Issues, grouped by {group}. Select issues to apply bulk changes.</caption><thead className="border-y border-[var(--border)] text-[10px] text-[var(--muted)]"><tr><th className="w-10 px-3 py-2"><SelectionCheckbox checked={allChecked} mixed={!allChecked && selected.size > 0} label="Select all visible issues" onChange={onSelectAll}/></th>{has("priority") && <th className="w-9 px-1"><button onClick={() => onSort("priority")} aria-label="Sort by priority">Pri.</button></th>}<th className="min-w-64 py-2 font-normal"><button onClick={() => onSort("title")}>Issue</button></th>{columns.filter((column) => column !== "priority").map((column) => <th key={column} className="whitespace-nowrap px-3 py-2 font-normal">{column === "due" ? <button onClick={() => onSort("due")}>Due date</button> : ISSUE_COLUMNS.find((item) => item.id === column)?.name}</th>)}{reorderEnabled && <th className="w-16"><span className="sr-only">Manual order</span></th>}</tr></thead><tbody>{groups.map((section) => <Fragment key={section.id}>
      <tr className="border-b border-[var(--border)] bg-[var(--surface)]/70"><th colSpan={2 + columns.length + (reorderEnabled ? 1 : 0)} className="px-3 py-2 font-normal"><div className="flex items-center gap-2"><ChevronDown size={12} className="text-[var(--muted)]"/>{group === "status" && <StatusIcon status={section.id as Issue["status"]}/>}<span className="font-medium">{section.name}</span><span className="text-[10px] text-[var(--muted)]">{section.issues.length}</span><Button size="sm" variant="ghost" className="ml-auto !h-5 !min-h-0 !px-1" aria-label={`Add issue to ${section.name}`} onClick={() => onCreate(groupDefaults(section.id))}><Plus size={13}/></Button></div></th></tr>
      {section.issues.map((issue, index) => <tr key={issue.id} className={cn("group border-b border-[var(--border)]/60 transition hover:bg-[var(--raised)]/50", selected.has(issue.id) && "bg-[var(--accent)]/7")}><td className="px-3 py-2"><SelectionCheckbox checked={selected.has(issue.id)} label={`Select ${issue.identifier}`} onChange={() => onSelect(issue.id)}/></td>{has("priority") && <td className="px-1"><PriorityPicker issue={issue} onPatch={onPatch} disabled={busy}/></td>}<td className="py-2"><div className="flex items-center gap-2.5">{!has("status") && <StatusIcon status={issue.status}/>}<Link href={`/issues/${issue.id}`} scroll={false} className="flex min-w-0 flex-1 items-center gap-3 rounded outline-offset-4"><span className="w-[66px] shrink-0 font-mono text-[10px] text-[var(--muted)]">{issue.identifier}</span><span className={cn("line-clamp-1 font-medium", issue.status === "done" && "text-[var(--muted)]")}>{issue.title}</span></Link></div></td>{columns.filter((column) => column !== "priority").map((column) => <td key={column} className="max-w-44 whitespace-nowrap px-3 py-2"><IssueCell column={column} issue={issue} data={data} onPatch={onPatch} busy={busy}/></td>)}{reorderEnabled && <td className="px-1"><div className="flex"><Button size="sm" variant="ghost" className="!px-1" aria-label={`Move ${issue.identifier} up`} disabled={busy || index === 0} onClick={() => onMove(issue.id, issue.status, section.issues[index - 1]?.id)}><ArrowUp size={12}/></Button><Button size="sm" variant="ghost" className="!px-1" aria-label={`Move ${issue.identifier} down`} disabled={busy || index === section.issues.length - 1} onClick={() => onMove(issue.id, issue.status, section.issues[index + 2]?.id)}><ArrowDown size={12}/></Button></div></td>}</tr>)}
    </Fragment>)}</tbody></table></div>
    <div className="md:hidden"><div className="flex items-center gap-2 border-y border-[var(--border)] px-4 py-2 text-xs text-[var(--muted)]"><SelectionCheckbox checked={allChecked} mixed={!allChecked && selected.size > 0} label="Select all visible issues" onChange={onSelectAll}/>Select all</div>{groups.map((section) => <section key={section.id}><header className="flex items-center gap-2 bg-[var(--surface)] px-4 py-2"><span className="text-xs font-medium">{section.name}</span><span className="text-[10px] text-[var(--muted)]">{section.issues.length}</span><Button size="sm" variant="ghost" className="ml-auto" aria-label={`Add issue to ${section.name}`} onClick={() => onCreate(groupDefaults(section.id))}><Plus size={13}/></Button></header>{section.issues.map((issue) => <article key={issue.id} className={cn("flex gap-3 border-b border-[var(--border)] px-4 py-3", selected.has(issue.id) && "bg-[var(--accent)]/7")}><div className="pt-1"><SelectionCheckbox checked={selected.has(issue.id)} label={`Select ${issue.identifier}`} onChange={() => onSelect(issue.id)}/></div><div className="min-w-0 flex-1"><Link href={`/issues/${issue.id}`} scroll={false} className="block"><span className="font-mono text-[10px] text-[var(--muted)]">{issue.identifier}</span><h3 className="mt-1 break-words text-sm font-medium">{issue.title}</h3></Link><div className="mt-2 flex flex-wrap items-center gap-2"><StatusPicker issue={issue} onPatch={onPatch} disabled={busy}/><PriorityPicker issue={issue} onPatch={onPatch} disabled={busy}/>{issue.dueDate && <span className="text-[10px]"><DueDate issue={issue}/></span>}<span className="ml-auto"><AssigneePicker issue={issue} data={data} onPatch={onPatch} disabled={busy}/></span></div></div></article>)}</section>)}</div>
  </div>;
}

function IssueCell({ column, issue, data, onPatch, busy }: { column: IssueColumn; issue: Issue; data: WorkspaceData; onPatch: IssuePatchHandler; busy: boolean }) {
  if (column === "assignee") return <AssigneePicker issue={issue} data={data} onPatch={onPatch} disabled={busy}/>;
  if (column === "status") return <StatusPicker issue={issue} onPatch={onPatch} disabled={busy}/>;
  if (column === "due") return <DueDate issue={issue}/>;
  if (column === "labels") return <div className="flex max-w-40 items-center gap-1 overflow-hidden">{issue.labelIds.slice(0, 2).map((id) => data.labels[id] && <Badge key={id} color={data.labels[id].color} className="max-w-24 truncate !text-[9px]">{data.labels[id].name}</Badge>)}{issue.labelIds.length > 2 && <span className="text-[9px] text-[var(--muted)]">+{issue.labelIds.length - 2}</span>}</div>;
  if (column === "estimate") return <Select className={inlineSelectClass} aria-label={`Estimate for ${issue.identifier}`} value={issue.estimate ?? ""} disabled={busy} onChange={(event) => onPatch(issue.id, { estimate: event.target.value === "" ? null : Number(event.target.value) })}><option value="">—</option>{[0, 1, 2, 3, 5, 8, 9].map((value) => <option key={value} value={value}>{value}</option>)}</Select>;
  if (column === "project") return <Select className={`${inlineSelectClass} !max-w-36`} aria-label={`Project for ${issue.identifier}`} value={issue.projectId || ""} disabled={busy} onChange={(event) => { const project = data.projects[event.target.value]; onPatch(issue.id, project ? { projectId: project.id, teamId: project.teamId, ...(project.teamId !== issue.teamId ? { cycleId: null } : {}) } : { projectId: null }); }}><option value="">No project</option>{Object.values(data.projects).filter((project) => !project.archivedAt || project.id === issue.projectId).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</Select>;
  if (column === "cycle") return <Select className={`${inlineSelectClass} !max-w-32`} aria-label={`Cycle for ${issue.identifier}`} value={issue.cycleId || ""} disabled={busy} onChange={(event) => onPatch(issue.id, { cycleId: event.target.value || null })}><option value="">No cycle</option>{Object.values(data.cycles).filter((cycle) => cycle.teamId === issue.teamId && (!cycle.closedAt || cycle.id === issue.cycleId)).map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.name}</option>)}</Select>;
  return null;
}

function SelectionCheckbox({ checked, mixed = false, label, onChange }: { checked: boolean; mixed?: boolean; label: string; onChange: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = mixed; }, [mixed]);
  return <input ref={ref} type="checkbox" checked={checked} aria-label={label} aria-checked={mixed ? "mixed" : checked} onChange={onChange} className="size-3.5 cursor-pointer rounded border-[var(--border)] accent-[var(--accent)]"/>;
}
