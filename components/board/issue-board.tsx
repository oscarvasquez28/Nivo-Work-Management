"use client";

import Link from "next/link";
import { useRef } from "react";
import { DragDropProvider, useDroppable } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { move } from "@dnd-kit/helpers";
import { Info, MessageSquare, Plus } from "lucide-react";
import { Badge, Button, StatusIcon, cn } from "@/components/ui";
import { STATUSES, type Issue, type IssueInput, type Status, type WorkspaceData } from "@/types/domain";
import { AssigneePicker, DueDate, PriorityPicker, StatusPicker, type IssuePatchHandler } from "@/components/issues/issue-inline";

interface BoardProps {
  issues: Issue[]; data: WorkspaceData; reorderEnabled: boolean; busy: boolean;
  selected: Set<string>; onSelect: (id: string) => void;
  onPatch: IssuePatchHandler; onMove: (id: string, status: Status, beforeId?: string) => void;
  onCreate: (defaults?: Partial<IssueInput>) => void;
}

export function IssueBoard(props: BoardProps) {
  const { issues, reorderEnabled, busy, onMove } = props;
  const groups = Object.fromEntries(STATUSES.map((status) => [status.id, issues.filter((issue) => issue.status === status.id).map((issue) => issue.id)]));
  const snapshot = useRef(groups);
  return <div className="min-w-0 space-y-3">
    <p id="board-drag-help" className="flex items-start gap-2 px-1 text-[10px] leading-5 text-[var(--muted)]"><Info size={12} className="mt-1 shrink-0"/>{reorderEnabled ? "Drag a card to move it. Every card also has a status picker." : "Drag ordering is off while filters or a non-manual sort are active. Clear filters and choose Manual order to drag. Use each card’s status picker to move it anytime."}</p>
    <DragDropProvider onDragStart={() => { snapshot.current = groups; }} onDragEnd={(event) => {
      if (event.canceled || !reorderEnabled || busy || !event.operation.source || !event.operation.target) return;
      const id = String(event.operation.source.id);
      const next = move(snapshot.current, event);
      const status = STATUSES.find((column) => next[column.id]?.includes(id))?.id;
      if (!status) return;
      const index = next[status].indexOf(id);
      const oldStatus = STATUSES.find((column) => snapshot.current[column.id].includes(id))?.id;
      if (oldStatus === status && snapshot.current[status].indexOf(id) === index) return;
      onMove(id, status, next[status][index + 1]);
    }}>
      <div className="max-w-full overflow-x-auto overscroll-x-contain pb-4" tabIndex={0} aria-label="Issue board, scroll horizontally for more statuses"><div className="grid min-w-[1280px] grid-cols-5 items-start gap-3">{STATUSES.map((status) => <BoardColumn key={status.id} {...props} status={status.id} issues={issues.filter((issue) => issue.status === status.id)}/>)}</div></div>
    </DragDropProvider>
  </div>;
}

function BoardColumn({ status, ...props }: BoardProps & { status: Status }) {
  const { issues, data, onCreate, reorderEnabled, busy } = props;
  const { ref, isDropTarget } = useDroppable({ id: status, type: "column", accept: "issue", collisionPriority: -1, disabled: !reorderEnabled || busy });
  const definition = STATUSES.find((item) => item.id === status)!;
  const points = issues.reduce((sum, issue) => sum + (issue.estimate || 0), 0);
  const teams = [...new Set(issues.map((issue) => issue.teamId))];
  return <section ref={ref} aria-label={`${definition.name} column`} className={cn("min-h-72 min-w-0 rounded-xl border border-transparent bg-[var(--surface)]/45 p-2 transition", isDropTarget && "!border-[var(--accent)] bg-[var(--accent)]/5")}>
    <header className="mb-2 px-1 py-2"><div className="flex items-center gap-2"><StatusIcon status={status}/><h2 className="text-xs font-semibold">{definition.name}</h2><span className="rounded px-1 text-[10px] text-[var(--muted)]">{issues.length}</span><span className="ml-auto text-[10px] text-[var(--muted)]">{points} pt</span><Button size="sm" variant="ghost" className="!h-6 !min-h-0 !px-1" aria-label={`Create issue in ${definition.name}`} onClick={() => onCreate({ status })}><Plus size={14}/></Button></div>
      {status === "in_progress" && teams.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{teams.map((teamId) => {
        const team = data.teams[teamId];
        if (!team?.wipLimit) return null;
        const count = Object.values(data.issues).filter((issue) => !issue.deletedAt && issue.teamId === teamId && issue.status === "in_progress").length;
        return <span key={teamId} title={`${team.name}: ${count} in progress across the workspace; limit ${team.wipLimit}`} className={cn("rounded px-1.5 py-0.5 text-[9px]", count > team.wipLimit ? "bg-amber-400/10 text-amber-400" : "bg-[var(--raised)] text-[var(--muted)]")}>{team.key} WIP {count}/{team.wipLimit}</span>;
      })}</div>}
    </header>
    <div className="space-y-2">{issues.map((issue, index) => <BoardCard key={issue.id} {...props} issue={issue} index={index}/>)}{!issues.length && <button onClick={() => onCreate({ status })} className="flex min-h-32 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--text)]"><Plus size={18}/><span className="text-xs">Add an issue</span><span className="text-[10px]">Nothing in {definition.name.toLowerCase()} yet</span></button>}</div>
    {issues.length > 0 && <button onClick={() => onCreate({ status })} className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs text-[var(--muted)] hover:bg-[var(--raised)]"><Plus size={13}/>Add issue</button>}
  </section>;
}

function BoardCard({ issue, index, data, reorderEnabled, busy, selected, onSelect, onPatch }: Omit<BoardProps, "onMove" | "onCreate"> & { issue: Issue; index: number }) {
  const { ref, isDragging } = useSortable({ id: issue.id, index, group: issue.status, type: "issue", accept: "issue", disabled: !reorderEnabled || busy });
  const comments = Object.values(data.comments).filter((comment) => comment.issueId === issue.id).length;
  return <article ref={ref} className={cn("group min-w-0 cursor-grab rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3 shadow-sm transition hover:border-[var(--muted)]/50 active:cursor-grabbing", isDragging && "z-20 shadow-xl ring-2 ring-[var(--accent)]", selected.has(issue.id) && "!border-[var(--accent)] bg-[var(--accent)]/5")} style={{ touchAction: "none" }}>
    <div className="mb-2 flex items-center gap-2"><input type="checkbox" aria-label={`Select ${issue.identifier}`} checked={selected.has(issue.id)} onChange={() => onSelect(issue.id)} className="size-3 accent-[var(--accent)]"/><span className="font-mono text-[10px] text-[var(--muted)]">{issue.identifier}</span><div className="ml-auto"><PriorityPicker issue={issue} onPatch={onPatch} disabled={busy}/></div></div>
    <Link href={`/issues/${issue.id}`} scroll={false} className="mb-3 block rounded text-[13px] font-medium leading-5 outline-offset-4"><span className="line-clamp-3 break-words">{issue.title}</span></Link>
    {(issue.projectId || issue.labelIds.length > 0) && <div className="mb-3 flex flex-wrap items-center gap-1">{issue.projectId && data.projects[issue.projectId] && <Link href={`/projects/${issue.projectId}`} className="max-w-full"><Badge color={data.projects[issue.projectId].color} className="max-w-44 truncate !text-[9px]">{data.projects[issue.projectId].name}</Badge></Link>}{issue.labelIds.slice(0, 2).map((id) => data.labels[id] && <Badge key={id} color={data.labels[id].color} className="max-w-36 truncate !text-[9px]">{data.labels[id].name}</Badge>)}</div>}
    <div className="flex items-center gap-2 border-t border-[var(--border)]/60 pt-2"><StatusPicker issue={issue} onPatch={onPatch} disabled={busy}/><span className="ml-auto"><AssigneePicker issue={issue} data={data} onPatch={onPatch} disabled={busy}/></span></div>
    {(issue.dueDate || issue.estimate !== null || comments > 0) && <div className="mt-2 flex items-center gap-2 text-[9px] text-[var(--muted)]">{issue.dueDate && <DueDate issue={issue}/>} {issue.estimate !== null && <span className="ml-auto rounded border border-[var(--border)] px-1">{issue.estimate} pt</span>}{comments > 0 && <span className="flex items-center gap-1" title={`${comments} comments`}><MessageSquare size={10}/>{comments}</span>}</div>}
  </article>;
}
