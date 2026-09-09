"use client";

import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CalendarRange, Loader2 } from "lucide-react";
import { Button, Field, Input, Modal, Select } from "@/components/ui";
import { useWorkspace } from "@/stores/workspace";
import { dateLabel } from "@/lib/domain/selectors";
import type { Cycle, CycleInput, WorkspaceData } from "@/types/domain";

function shiftDay(day: string, amount: number) { return new Date(Date.parse(`${day}T00:00:00Z`) + amount * 86400000).toISOString().slice(0, 10); }

function nextDates(data: WorkspaceData, teamId: string) {
  const latest = Object.values(data.cycles).filter((cycle) => cycle.teamId === teamId && !cycle.closedAt && cycle.endDate >= data.workspace.seedAnchorDate).sort((a, b) => b.endDate.localeCompare(a.endDate))[0];
  const startDate = latest ? shiftDay(latest.endDate, 1) : data.workspace.seedAnchorDate;
  return { startDate, endDate: shiftDay(startDate, 13) };
}

export function CycleFormDialog({ open, onOpenChange, cycle, defaultTeamId }: { open: boolean; onOpenChange: (open: boolean) => void; cycle?: Cycle; defaultTeamId?: string }) {
  const { data } = useWorkspace();
  const [busy, setBusy] = useState(false);
  return <Modal open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next); }} title={cycle ? "Edit cycle" : "Create a cycle"} description={cycle ? "Keep your goal and schedule in sync with your team." : "A clear goal. A focused stretch of work. A little momentum."}>{open && data && <CycleEditor key={cycle?.id ?? `new-${defaultTeamId ?? "engineering"}`} data={data} cycle={cycle} defaultTeamId={defaultTeamId} onDone={() => onOpenChange(false)} setBusy={setBusy} />}</Modal>;
}

function CycleEditor({ data, cycle, defaultTeamId, onDone, setBusy }: { data: WorkspaceData; cycle?: Cycle; defaultTeamId?: string; onDone: () => void; setBusy: (busy: boolean) => void }) {
  const { mutate } = useWorkspace();
  const router = useRouter();
  const id = useId();
  const teamId = defaultTeamId && data.teams[defaultTeamId] ? defaultTeamId : data.teams.engineering ? "engineering" : Object.keys(data.teams)[0];
  const [draft, setDraft] = useState<CycleInput>(() => cycle ? { name: cycle.name, goal: cycle.goal, teamId: cycle.teamId, startDate: cycle.startDate, endDate: cycle.endDate } : { name: "", goal: "", teamId, ...nextDates(data, teamId) });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const hasIssues = cycle && Object.values(data.issues).some((issue) => issue.cycleId === cycle.id);
  const conflict = !cycle?.closedAt && Object.values(data.cycles).find((other) => other.id !== cycle?.id && !other.closedAt && other.teamId === draft.teamId && draft.startDate <= other.endDate && other.startDate <= draft.endDate);
  const duration = draft.startDate && draft.endDate ? Math.round((Date.parse(`${draft.endDate}T00:00:00Z`) - Date.parse(`${draft.startDate}T00:00:00Z`)) / 86400000) + 1 : 0;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.name.trim()) { setError("Give your cycle a name."); return; }
    if (draft.endDate < draft.startDate) { setError("End date must be on or after the start date."); return; }
    if (conflict) { setError(`These dates overlap with ${conflict.name}. Open cycles on the same team need separate dates.`); return; }
    setSaving(true); setBusy(true); setError("");
    try {
      const input = { ...draft, name: draft.name.trim() };
      const result = await mutate(cycle ? { type: "cycle.update", id: cycle.id, patch: cycle.closedAt ? { name: input.name, goal: input.goal } : input } : { type: "cycle.create", input });
      onDone();
      if (!cycle && result) router.push(`/cycles/${result}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "We couldn’t save this cycle. Your changes are still here; please try again."); }
    finally { setSaving(false); setBusy(false); }
  }
  return <form onSubmit={submit} className="space-y-5"><Field label="Cycle name" htmlFor={`${id}-name`}><Input id={`${id}-name`} autoFocus required maxLength={160} placeholder="e.g. Cycle 26" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></Field><Field label="Goal" htmlFor={`${id}-goal`}><textarea id={`${id}-goal`} className="input min-h-24 w-full resize-y" placeholder="What should feel different by the end of this cycle?" value={draft.goal} onChange={(event) => setDraft((current) => ({ ...current, goal: event.target.value }))} /></Field><Field label="Team" htmlFor={`${id}-team`}><Select id={`${id}-team`} value={draft.teamId} disabled={!!hasIssues || !!cycle?.closedAt} onChange={(event) => { const nextTeam = event.target.value; setDraft((current) => ({ ...current, teamId: nextTeam, ...(!cycle ? nextDates(data, nextTeam) : {}) })); }}>{Object.values(data.teams).map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</Select>{hasIssues && <p className="mt-1.5 text-[10px] text-[var(--muted)]">The team is fixed while this cycle contains issues.</p>}</Field><div className="grid grid-cols-2 gap-4"><Field label="Start date" htmlFor={`${id}-start`}><Input id={`${id}-start`} required disabled={!!cycle?.closedAt} type="date" value={draft.startDate} onChange={(event) => setDraft((current) => ({ ...current, startDate: event.target.value }))} /></Field><Field label="End date" htmlFor={`${id}-end`}><Input id={`${id}-end`} required disabled={!!cycle?.closedAt} type="date" min={draft.startDate} value={draft.endDate} onChange={(event) => setDraft((current) => ({ ...current, endDate: event.target.value }))} /></Field></div>{duration > 0 && <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--raised)] px-3 py-2.5 text-xs text-[var(--muted)]"><CalendarRange size={14} /><span>{duration} day{duration === 1 ? "" : "s"} · {dateLabel(draft.startDate)} – {dateLabel(draft.endDate)}</span></div>}{conflict && <p className="text-xs leading-5 text-[#eab76b]">Overlaps {conflict.name} ({dateLabel(conflict.startDate)} – {dateLabel(conflict.endDate)}). Choose a different date range.</p>}{cycle?.closedAt && <p className="text-xs leading-5 text-[var(--muted)]">Name and goal can be updated without changing the snapshot. Reopen this cycle to edit dates, team, or issue membership.</p>}{error && <p role="alert" className="rounded-lg border border-red-400/20 bg-red-400/5 px-3 py-2 text-xs text-red-400">{error}</p>}<div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4"><Button variant="secondary" disabled={saving} onClick={onDone}>Cancel</Button><Button type="submit" variant="primary" disabled={saving}>{saving && <Loader2 size={14} className="animate-spin" />}{saving ? "Saving…" : cycle ? "Save changes" : "Create cycle"}</Button></div></form>;
}
