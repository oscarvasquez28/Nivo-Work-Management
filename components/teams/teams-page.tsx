"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button, EmptyState, Field, Input, Modal, PageHeader, Select } from "@/components/ui";
import { useWorkspace } from "@/stores/workspace";
import type { Team } from "@/types/domain";

export function TeamsPage() {
  const { data, refresh } = useWorkspace();
  const [dialog, setDialog] = useState<Team | "new" | null>(null);

  if (!data) return null;
  const teams = Object.values(data.teams).sort((a, b) => a.name.localeCompare(b.name));

  return <div className="page">
    <PageHeader eyebrow="WORKSPACE" title="Teams" description="Create and manage the teams that own cycles and projects." actions={<Button variant="primary" onClick={() => setDialog("new")}><Plus size={15} />New team</Button>} />
    {teams.length === 0
      ? <EmptyState title="No teams yet" description="Create the first team to start grouping cycles and projects." action={<Button variant="primary" onClick={() => setDialog("new")}><Plus size={15} />New team</Button>} />
      : <section className="panel p-0 overflow-hidden"><table className="w-full text-sm"><thead><tr className="border-b border-[var(--border)] text-left text-[11px] uppercase tracking-wide text-[var(--muted)]"><th className="px-4 py-2.5 font-medium">Team</th><th className="px-4 py-2.5 font-medium">Key</th><th className="px-4 py-2.5 font-medium">Visibility</th><th className="px-4 py-2.5 font-medium">WIP limit</th><th className="w-20 px-4 py-2.5"><span className="sr-only">Actions</span></th></tr></thead><tbody>{teams.map((team) => <tr key={team.id} className="border-b border-[var(--border)]/60 last:border-0"><td className="px-4 py-2.5 font-medium text-[var(--text)]">{team.name}</td><td className="px-4 py-2.5 text-[var(--text-secondary)]">{team.key}</td><td className="px-4 py-2.5 text-[var(--text-secondary)]">{team.visibility === "public" ? "Public" : "Private"}</td><td className="px-4 py-2.5 text-[var(--text-secondary)]">{team.wipLimit || "—"}</td><td className="px-4 py-2.5"><div className="flex justify-end gap-1"><Button variant="ghost" size="sm" className="icon-button" aria-label={`Edit ${team.name}`} onClick={() => setDialog(team)}><Pencil size={13} /></Button><Button variant="ghost" size="sm" className="icon-button" aria-label={`Delete ${team.name}`} onClick={async () => { if (confirm(`Delete ${team.name}?`)) { const res = await fetch(`/api/teams/${team.id}`, { method: "DELETE" }); if (res.ok) refresh(); else alert("Could not delete the team. Make sure no projects, cycles or members are using it."); } }}><Trash2 size={13} /></Button></div></td></tr>)}</tbody></table></section>}
    {dialog && <TeamDialog team={dialog === "new" ? null : dialog} onClose={(saved) => { setDialog(null); if (saved) refresh(); }} />}
  </div>;
}

function TeamDialog({ team, onClose }: { team: Team | null; onClose: (saved: boolean) => void }) {
  const isNew = !team;
  const [name, setName] = useState(team?.name ?? "");
  const [key, setKey] = useState(team?.key ?? "");
  const [wipLimit, setWipLimit] = useState(team?.wipLimit ?? 0);
  const [visibility, setVisibility] = useState(team?.visibility ?? "public");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || !key.trim()) { setError("Name and key are required."); return; }
    setBusy(true); setError(null);
    const res = await fetch(isNew ? "/api/teams" : `/api/teams/${team!.id}`, { method: isNew ? "POST" : "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: name.trim(), key: key.toUpperCase(), wipLimit: Number(wipLimit), visibility }) });
    setBusy(false);
    if (res.ok) { onClose(true); return; }
    const result = await res.json().catch(() => null);
    setError(result?.message ?? "Could not save the team.");
  }

  return <Modal open onOpenChange={(open) => { if (!open) onClose(false); }} title={isNew ? "New team" : `Edit ${team!.name}`} description={isNew ? "A team owns cycles and can lead projects." : "Update the team's name, key, visibility and WIP limit."}>
    <form onSubmit={submit} className="space-y-5">
      <Field label="Team name" htmlFor="t-name"><Input id="t-name" required autoFocus maxLength={50} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Product" /></Field>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Key" htmlFor="t-key"><Input id="t-key" required maxLength={6} value={key} onChange={(event) => setKey(event.target.value.toUpperCase())} placeholder="PROD" /></Field><Field label="WIP limit" htmlFor="t-wip"><Input id="t-wip" type="number" min={0} max={1000} value={wipLimit} onChange={(event) => setWipLimit(Number(event.target.value))} /></Field></div>
      <Field label="Visibility" htmlFor="t-visibility"><Select id="t-visibility" value={visibility} onChange={(event) => setVisibility(event.target.value as "public" | "private")}><option value="public">Public — visible to workspace members</option><option value="private">Private — visible to team members only</option></Select></Field>
      {error && <div role="alert" className="rounded-lg border border-red-400/20 bg-red-400/5 px-3 py-2 text-xs text-red-400">{error}</div>}
      <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4"><Button type="button" variant="secondary" onClick={() => onClose(false)}>Cancel</Button><Button type="submit" variant="primary" disabled={busy}>{isNew ? "Create team" : "Save changes"}</Button></div>
    </form>
  </Modal>;
}
