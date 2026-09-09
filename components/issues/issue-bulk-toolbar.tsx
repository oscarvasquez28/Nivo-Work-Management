"use client";

import { useState } from "react";
import { CheckSquare2, Trash2, X } from "lucide-react";
import { Button, ConfirmDialog, Select } from "@/components/ui";
import { PRIORITIES, STATUSES, type Command, type IssueInput, type WorkspaceData } from "@/types/domain";

type BulkCommand = Extract<Command, { type: "issues.bulk" }>;

export function IssueBulkToolbar({ ids, data, busy, onCommand, onClear }: { ids: string[]; data: WorkspaceData; busy: boolean; onCommand: (command: BulkCommand) => Promise<boolean>; onClear: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const patch = (value: Partial<IssueInput>) => { void onCommand({ type: "issues.bulk", ids, patch: value }); };
  const teams = new Set(ids.map((id) => data.issues[id]?.teamId));
  return <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--accent)]/40 bg-[var(--accent)]/5 px-3 py-2" aria-label="Bulk issue actions">
    <span className="mr-2 flex items-center gap-2 text-xs font-medium"><CheckSquare2 size={14} className="text-[var(--accent)]"/>{ids.length} selected</span>
    <Select aria-label="Bulk change status" value="" className="!h-7 !w-auto !text-xs" disabled={busy} onChange={(event) => patch({ status: event.target.value as IssueInput["status"] })}><option value="" disabled>Status</option>{STATUSES.map((status) => <option key={status.id} value={status.id}>{status.name}</option>)}</Select>
    <Select aria-label="Bulk change priority" value="" className="!h-7 !w-auto !text-xs" disabled={busy} onChange={(event) => patch({ priority: event.target.value as IssueInput["priority"] })}><option value="" disabled>Priority</option>{PRIORITIES.map((priority) => <option key={priority.id} value={priority.id}>{priority.name}</option>)}</Select>
    <Select aria-label="Bulk change assignee" value="" className="!h-7 !w-auto !text-xs" disabled={busy} onChange={(event) => patch({ assigneeId: event.target.value === "none" ? null : event.target.value })}><option value="" disabled>Assignee</option><option value="none">Unassigned</option>{Object.values(data.users).map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</Select>
    <Select aria-label="Bulk move to project" value="" className="!h-7 !w-auto !text-xs" disabled={busy} onChange={(event) => { const project = data.projects[event.target.value]; patch(project ? { projectId: project.id, teamId: project.teamId, cycleId: null } : { projectId: null }); }}><option value="" disabled>Project</option><option value="none">No project</option>{Object.values(data.projects).filter((project) => !project.archivedAt).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</Select>
    <Select aria-label="Bulk move to team" value="" className="!h-7 !w-auto !text-xs" disabled={busy} onChange={(event) => patch({ teamId: event.target.value, projectId: null, cycleId: null })}><option value="" disabled>Team</option>{Object.values(data.teams).map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</Select>
    <Select aria-label="Bulk change cycle" value="" className="!h-7 !w-auto !text-xs" disabled={busy} onChange={(event) => patch({ cycleId: event.target.value === "none" ? null : event.target.value })}><option value="" disabled>Cycle</option><option value="none">No cycle</option>{Object.values(data.cycles).filter((cycle) => !cycle.closedAt && teams.size === 1 && teams.has(cycle.teamId)).map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.name}</option>)}</Select>
    <Select aria-label="Bulk add label" value="" className="!h-7 !w-auto !text-xs" disabled={busy} onChange={(event) => { void onCommand({ type: "issues.bulk", ids, addLabel: event.target.value }); }}><option value="" disabled>Add label</option>{Object.values(data.labels).map((label) => <option key={label.id} value={label.id}>{label.name}</option>)}</Select>
    <Select aria-label="Bulk remove label" value="" className="!h-7 !w-auto !text-xs" disabled={busy} onChange={(event) => { void onCommand({ type: "issues.bulk", ids, removeLabel: event.target.value }); }}><option value="" disabled>Remove label</option>{Object.values(data.labels).map((label) => <option key={label.id} value={label.id}>{label.name}</option>)}</Select>
    <Button size="sm" variant="ghost" aria-label="Delete selected issues" disabled={busy} onClick={() => setDeleting(true)}><Trash2 size={14}/></Button><Button size="sm" variant="ghost" aria-label="Clear selection" onClick={onClear} className="ml-auto"><X size={14}/></Button>
    <ConfirmDialog open={deleting} onOpenChange={setDeleting} title={`Delete ${ids.length} issues?`} description="These issues will be removed from your lists, boards, and progress. The confirmation notice will offer an undo." confirmLabel="Delete issues" onConfirm={async () => { if (await onCommand({ type: "issues.bulk", ids, delete: true })) { setDeleting(false); onClear(); } }}/>
  </div>;
}
