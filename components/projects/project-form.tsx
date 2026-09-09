"use client";

import { useId, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Search } from "lucide-react";
import { Avatar, Button, Field, Input, Modal, Select, cn } from "@/components/ui";
import { useWorkspace } from "@/stores/workspace";
import type { Project, ProjectInput, WorkspaceData } from "@/types/domain";
import { PROJECT_HEALTH, PROJECT_ICONS, PROJECT_STATUSES } from "./project-shared";

const COLORS = ["#aaa0f5", "#76bea6", "#78a9ef", "#eab76b", "#ee8c96", "#c895da"];

export function ProjectFormDialog({ open, onOpenChange, project }: { open: boolean; onOpenChange: (open: boolean) => void; project?: Project }) {
  const { data } = useWorkspace();
  const [busy, setBusy] = useState(false);
  return <Modal open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next); }} title={project ? "Edit project" : "Create a project"} description={project ? "Keep your team aligned with clear project details." : "Give your next big idea a place to take shape."} wide>{open && data && <ProjectEditor key={project?.id ?? "new"} data={data} project={project} onDone={() => onOpenChange(false)} setBusy={setBusy} />}</Modal>;
}

function ProjectEditor({ data, project, onDone, setBusy }: { data: WorkspaceData; project?: Project; onDone: () => void; setBusy: (value: boolean) => void }) {
  const { mutate } = useWorkspace();
  const router = useRouter();
  const id = useId();
  const defaultTeam = data.teams.engineering ? "engineering" : Object.keys(data.teams)[0];
  const defaultLead = Object.values(data.users).find((user) => user.id === data.currentUserId && user.teamIds.includes(defaultTeam)) ?? Object.values(data.users).find((user) => user.teamIds.includes(defaultTeam));
  const [draft, setDraft] = useState<ProjectInput>(() => project ? { name: project.name, description: project.description, teamId: project.teamId, icon: project.icon, color: project.color, status: project.status, health: project.health, leadId: project.leadId, memberIds: [...project.memberIds], startDate: project.startDate, targetDate: project.targetDate } : { name: "", description: "", teamId: defaultTeam, icon: "layers", color: COLORS[0], status: "planned", health: "on_track", leadId: defaultLead?.id ?? "", memberIds: defaultLead ? [defaultLead.id] : [], startDate: null, targetDate: null });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [memberQuery, setMemberQuery] = useState("");
  const allUsers = useMemo(() => Object.values(data.users).sort((a, b) => a.name.localeCompare(b.name)), [data.users]);
  const filteredUsers = useMemo(() => {
    const query = memberQuery.trim().toLowerCase();
    if (!query) return allUsers;
    return allUsers.filter((user) => user.name.toLowerCase().includes(query) || user.initials.toLowerCase().includes(query));
  }, [allUsers, memberQuery]);
  const teamUsers = Object.values(data.users).filter((user) => user.teamIds.includes(draft.teamId));
  function patch<K extends keyof ProjectInput>(key: K, value: ProjectInput[K]) { setDraft((current) => ({ ...current, [key]: value })); }
  function changeTeam(teamId: string) {
    const users = Object.values(data.users).filter((user) => user.teamIds.includes(teamId));
    const leadId = users.some((user) => user.id === draft.leadId) ? draft.leadId : users[0]?.id ?? "";
    setDraft((current) => ({ ...current, teamId, leadId, memberIds: Array.from(new Set([leadId, ...current.memberIds.filter((member) => users.some((user) => user.id === member))])).filter(Boolean) }));
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.name.trim()) { setError("Give your project a name."); return; }
    if (draft.startDate && draft.targetDate && draft.targetDate < draft.startDate) { setError("Target date must be on or after the start date."); return; }
    setSaving(true); setBusy(true); setError("");
    try {
      const input = { ...draft, name: draft.name.trim(), memberIds: Array.from(new Set([...draft.memberIds, draft.leadId])) };
      const result = await mutate(project ? { type: "project.update", id: project.id, patch: input } : { type: "project.create", input });
      onDone();
      if (!project && result) router.push(`/projects/${result}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "We couldn’t save this project. Your changes are still here; please try again."); }
    finally { setSaving(false); setBusy(false); }
  }
  return <form onSubmit={submit} className="space-y-5"><Field label="Project name" htmlFor={`${id}-name`}><Input id={`${id}-name`} autoFocus required maxLength={160} placeholder="e.g. Customer experience" value={draft.name} onChange={(event) => patch("name", event.target.value)} /></Field><Field label="Description" htmlFor={`${id}-description`}><textarea id={`${id}-description`} className="input min-h-24 w-full resize-y" placeholder="What are we building, and why does it matter?" value={draft.description} onChange={(event) => patch("description", event.target.value)} /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Team" htmlFor={`${id}-team`}><Select id={`${id}-team`} value={draft.teamId} onChange={(event) => changeTeam(event.target.value)}>{Object.values(data.teams).map((team) => <option value={team.id} key={team.id}>{team.name}</option>)}</Select></Field><Field label="Project lead" htmlFor={`${id}-lead`}><Select id={`${id}-lead`} required value={draft.leadId} onChange={(event) => setDraft((current) => ({ ...current, leadId: event.target.value, memberIds: Array.from(new Set([...current.memberIds, event.target.value])) }))}>{teamUsers.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</Select></Field><Field label="Status" htmlFor={`${id}-status`}><Select id={`${id}-status`} value={draft.status} onChange={(event) => patch("status", event.target.value as ProjectInput["status"])}>{PROJECT_STATUSES.map((status) => <option value={status.value} key={status.value}>{status.label}</option>)}</Select></Field><Field label="Health" htmlFor={`${id}-health`}><Select id={`${id}-health`} value={draft.health} onChange={(event) => patch("health", event.target.value as ProjectInput["health"])}>{PROJECT_HEALTH.map((health) => <option value={health.value} key={health.value}>{health.label}</option>)}</Select></Field><Field label="Start date" htmlFor={`${id}-start`}><Input id={`${id}-start`} type="date" value={draft.startDate ?? ""} onChange={(event) => patch("startDate", event.target.value || null)} /></Field><Field label="Target date" htmlFor={`${id}-target`}><Input id={`${id}-target`} type="date" min={draft.startDate ?? undefined} value={draft.targetDate ?? ""} onChange={(event) => patch("targetDate", event.target.value || null)} /></Field></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Icon"><div className="flex flex-wrap gap-1.5">{PROJECT_ICONS.map(({ value, label, icon: Icon }) => <button type="button" key={value} aria-label={`${label} icon`} aria-pressed={draft.icon === value} onClick={() => patch("icon", value)} className={cn("flex h-9 w-9 items-center justify-center rounded-lg border transition-colors", draft.icon === value ? "border-[var(--accent)] bg-[var(--raised)] text-[var(--accent)]" : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]")}><Icon size={17} /></button>)}</div></Field><Field label="Color"><div className="flex flex-wrap gap-2">{COLORS.map((color) => <button key={color} type="button" aria-label={`Project color ${color}`} aria-pressed={draft.color === color} onClick={() => patch("color", color)} className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-transparent outline-offset-2" style={{ background: color, outline: draft.color === color ? `1px solid ${color}` : undefined }}>{draft.color === color && <Check size={16} className="text-[#17181f]" />}</button>)}</div></Field></div><Field label={`Members · ${draft.memberIds.length}`}><div className="space-y-2"><div className="relative"><Search size={14} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" /><Input aria-label="Search members" className="!pl-11" placeholder="Search members…" value={memberQuery} onChange={(event) => setMemberQuery(event.target.value)} /></div><div className="grid max-h-44 grid-cols-1 gap-1 overflow-y-auto rounded-lg border border-[var(--border)] p-2 sm:grid-cols-2">{filteredUsers.map((user) => <label key={user.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-[var(--raised)]"><input type="checkbox" className="accent-[var(--accent)]" checked={draft.memberIds.includes(user.id)} disabled={user.id === draft.leadId} onChange={(event) => patch("memberIds", event.target.checked ? [...draft.memberIds, user.id] : draft.memberIds.filter((member) => member !== user.id))} /><Avatar user={user} size="sm" /><span className="truncate">{user.name}</span>{user.id === draft.leadId && <span className="ml-auto text-[10px] text-[var(--muted)]">Lead</span>}</label>)}{filteredUsers.length === 0 && <p className="col-span-2 text-xs text-[var(--muted)]">No users match your search.</p>}</div></div></Field>{error && <div role="alert" className="rounded-lg border border-red-400/20 bg-red-400/5 px-3 py-2 text-xs text-red-400">{error}</div>}<div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4"><Button type="button" variant="secondary" disabled={saving} onClick={onDone}>Cancel</Button><Button type="submit" disabled={saving}>{saving && <Loader2 size={14} className="animate-spin" />}{saving ? "Saving…" : project ? "Save changes" : "Create project"}</Button></div></form>;
}
