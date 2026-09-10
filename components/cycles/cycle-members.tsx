"use client";

import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Avatar, Button, EmptyState, Input, Modal, Select, StatusIcon } from "@/components/ui";
import { useWorkspace } from "@/stores/workspace";
import { selectIssues } from "@/lib/domain/selectors";
import type { Cycle, WorkspaceData } from "@/types/domain";

export function CycleMembersDialog({ open, onOpenChange, cycle, mode }: { open: boolean; onOpenChange: (open: boolean) => void; cycle: Cycle; mode: "add" | "remove" }) {
  const { data } = useWorkspace();
  const [busy, setBusy] = useState(false);
  return <Modal open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next); }} title={mode === "add" ? "Add issues to cycle" : "Remove issues from cycle"} description={mode === "add" ? `Choose ${data?.teams[cycle.teamId]?.name ?? "team"} issues to plan into ${cycle.name}.` : "Issues stay in your workspace. Only their cycle assignment changes."} wide>{open && data && <MembershipPicker key={`${cycle.id}-${mode}`} data={data} cycle={cycle} mode={mode} onDone={() => onOpenChange(false)} setBusy={setBusy} />}</Modal>;
}

function MembershipPicker({ data, cycle, mode, onDone, setBusy }: { data: WorkspaceData; cycle: Cycle; mode: "add" | "remove"; onDone: () => void; setBusy: (busy: boolean) => void }) {
  const { mutate } = useWorkspace();
  const [query, setQuery] = useState("");
  const [project, setProject] = useState("all");
  const [unscheduled, setUnscheduled] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const eligible = selectIssues(data, {}, {}, "priority").filter((issue) => issue.teamId === cycle.teamId && (mode === "remove" ? issue.cycleId === cycle.id : issue.cycleId !== cycle.id && (!issue.cycleId || !data.cycles[issue.cycleId]?.closedAt)));
  const issues = eligible.filter((issue) => (mode === "remove" || !unscheduled || !issue.cycleId) && (project === "all" || (project === "none" ? !issue.projectId : issue.projectId === project)) && `${issue.identifier} ${issue.title}`.toLowerCase().includes(query.trim().toLowerCase()));
  const validSelected = selected.filter((id) => eligible.some((issue) => issue.id === id));
  const moving = mode === "add" ? eligible.filter((issue) => validSelected.includes(issue.id) && issue.cycleId).length : 0;
  const allVisibleSelected = issues.length > 0 && issues.every((issue) => selected.includes(issue.id));
  async function save() {
    if (!validSelected.length) return;
    setSaving(true); setBusy(true); setError("");
    try { await mutate({ type: "issues.bulk", ids: validSelected, patch: { cycleId: mode === "add" ? cycle.id : null } }); onDone(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "The issues couldn’t be updated. Your selection is still here; please try again."); }
    finally { setSaving(false); setBusy(false); }
  }
  return <div className="space-y-4"><div className="flex flex-wrap gap-2"><div className="search-input min-w-48 flex-1"><Search size={14} /><Input autoFocus aria-label="Search eligible issues" placeholder="Search by title or identifier…" value={query} onChange={(event) => setQuery(event.target.value)} /></div><Select aria-label="Filter issues by project" value={project} onChange={(event) => setProject(event.target.value)}><option value="all">All projects</option><option value="none">No project</option>{Object.values(data.projects).filter((item) => item.teamId === cycle.teamId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></div>{mode === "add" && <label className="flex items-center gap-2 text-xs text-[var(--muted)]"><input type="checkbox" checked={unscheduled} onChange={(event) => setUnscheduled(event.target.checked)} />Only issues without a cycle</label>}<div className="overflow-hidden rounded-lg border border-[var(--border)]"><div className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--raised)] px-3 py-2 text-[11px]"><label className="flex items-center gap-2"><input type="checkbox" checked={allVisibleSelected} disabled={!issues.length || saving} onChange={(event) => setSelected((current) => event.target.checked ? Array.from(new Set([...current, ...issues.map((issue) => issue.id)])) : current.filter((id) => !issues.some((issue) => issue.id === id)))} />Select visible ({issues.length})</label><span className="text-[var(--muted)]">{validSelected.length} selected{validSelected.length > 0 && <button className="ml-2 text-[var(--accent)]" onClick={() => setSelected([])} disabled={saving}>Clear</button>}</span></div><div className="max-h-80 divide-y divide-[var(--border)] overflow-y-auto">{issues.length ? issues.map((issue) => <label key={issue.id} className="flex cursor-pointer items-center gap-3 px-3 py-3 transition-colors hover:bg-[var(--raised)]"><input type="checkbox" disabled={saving} checked={selected.includes(issue.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, issue.id] : current.filter((id) => id !== issue.id))} /><StatusIcon status={issue.status} /><div className="min-w-0 flex-1"><div className="truncate text-xs">{issue.title}</div><div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-[var(--muted)]"><span>{issue.identifier}</span><span>{issue.projectId ? data.projects[issue.projectId]?.name : "No project"}</span>{mode === "add" && issue.cycleId && <span className="text-[#eab76b]">Moving from {data.cycles[issue.cycleId]?.name}</span>}</div></div><Avatar user={issue.assigneeId ? data.users[issue.assigneeId] : null} size="sm" /></label>) : <EmptyState title="No eligible issues" description={mode === "remove" ? "Try another search, or this cycle may be empty." : "Try another filter. Issues from other teams or completed cycles aren’t available."} />}</div></div>{moving > 0 && <p className="text-xs leading-5 text-[#eab76b]">{moving} selected issue{moving === 1 ? " will leave its" : "s will leave their"} current cycle and move into {cycle.name}.</p>}{error && <p role="alert" className="text-xs text-red-400">{error}</p>}<div className="flex items-center justify-between gap-3 border-t border-[var(--border)] pt-4"><span className="text-[10px] text-[var(--muted)]">{mode === "add" ? "Same-team issues only · saved together" : "No issues will be deleted"}</span><div className="flex gap-2"><Button variant="secondary" disabled={saving} onClick={onDone}>Cancel</Button><Button variant="primary" disabled={saving || !validSelected.length || !!cycle.closedAt} onClick={save}>{saving && <Loader2 size={14} className="animate-spin" />}{saving ? "Saving…" : `${mode === "add" ? "Add" : "Remove"} ${validSelected.length || ""} issue${validSelected.length === 1 ? "" : "s"}`}</Button></div></div></div>;
}
