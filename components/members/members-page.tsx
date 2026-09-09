"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Ban, Check, Loader2, Pencil, Plus, RotateCcw, Shield, UserRound, Users } from "lucide-react";
import { Avatar, Badge, Button, EmptyState, Field, Input, Modal, PageHeader, Select, cn } from "@/components/ui";
import { useWorkspace } from "@/stores/workspace";
import type { User } from "@/types/domain";

export interface Member {
  id: string;
  name: string;
  initials: string;
  color: string;
  title: string | null;
  email: string | null;
  access: "admin" | "member";
  disabled: boolean;
  teamIds: string[];
  projectIds: string[];
}

const COLORS = ["#9aa8ff", "#5ec9a7", "#e2a54e", "#e06a6a", "#c984e3", "#6ab8e0", "#8fbc6a", "#e3896a"];

export function MembersPage() {
  const { data } = useWorkspace();
  const [members, setMembers] = useState<Member[]>([]);
  const [me, setMe] = useState<{ id: string; access: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Member | "new" | null>(null);

  const load = useCallback(async () => {
    try {
      const [membersRes, meRes] = await Promise.all([fetch("/api/members"), fetch("/api/auth/me")]);
      if (!membersRes.ok) throw new Error();
      setMembers((await membersRes.json()).members);
      if (meRes.ok) setMe((await meRes.json()).user);
      setError(null);
    } catch {
      setError("Could not load members.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const isAdmin = me?.access === "admin";
  const teamNames = useMemo(() => new Map(data ? Object.values(data.teams).map((team) => [team.id, team.name]) : []), [data]);
  const projects = useMemo(() => (data ? Object.values(data.projects).sort((a, b) => a.name.localeCompare(b.name)) : []), [data]);

  if (loading && members.length === 0) return <div className="page"><div className="flex items-center gap-2 text-sm text-[var(--muted)]"><Loader2 size={14} className="animate-spin" /> Loading members…</div></div>;

  return <div className="page">
    <PageHeader eyebrow="WORKSPACE" title="Members" description="Who can access Nivo Labs, their access level and team membership." actions={isAdmin ? <Button variant="primary" onClick={() => setDialog("new")}><Plus size={15} />Invite member</Button> : undefined} />
    {error && <div className="notice-error"><AlertCircle size={15} /><span>{error}</span><Button variant="ghost" size="sm" onClick={() => void load()}>Retry</Button></div>}
    {members.length === 0 && !error
      ? <EmptyState icon={<Users size={27} />} title="No members yet" description="Invite people to give them access to this workspace." action={isAdmin ? <Button variant="primary" onClick={() => setDialog("new")}><Plus size={15} />Invite member</Button> : undefined} />
      : <section className="panel overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-[var(--border)] text-left text-[11px] uppercase tracking-wide text-[var(--muted)]">
            <th className="px-4 py-2.5 font-medium">Member</th><th className="hidden px-4 py-2.5 font-medium sm:table-cell">Email</th><th className="hidden px-4 py-2.5 font-medium md:table-cell">Title</th><th className="px-4 py-2.5 font-medium">Access</th><th className="hidden px-4 py-2.5 font-medium lg:table-cell">Teams</th><th className="hidden px-4 py-2.5 font-medium lg:table-cell">Projects</th><th className="w-20 px-4 py-2.5"><span className="sr-only">Actions</span></th>
          </tr></thead>
          <tbody>
            {members.map((member) => <tr key={member.id} className={cn("border-b border-[var(--border)]/60 last:border-0", member.disabled && "opacity-50")}>
              <td className="px-4 py-2.5"><span className="flex items-center gap-2.5"><Avatar user={member as unknown as User} size="sm" /><span className="font-medium text-[var(--text)]">{member.name}{member.id === me?.id && <span className="ml-1.5 text-[10px] text-[var(--muted)]">(you)</span>}</span></span></td>
              <td className="hidden px-4 py-2.5 text-[var(--text-secondary)] sm:table-cell">{member.email ?? <span className="text-[var(--faint)]">—</span>}</td>
              <td className="hidden px-4 py-2.5 text-[var(--text-secondary)] md:table-cell">{member.title ?? "—"}</td>
              <td className="px-4 py-2.5">{member.disabled ? <Badge color="var(--danger)">Deactivated</Badge> : member.access === "admin" ? <Badge color="var(--accent)"><Shield size={10} />Admin</Badge> : <Badge><UserRound size={10} />Member</Badge>}</td>
              <td className="hidden px-4 py-2.5 text-[var(--muted)] lg:table-cell">{member.teamIds.map((id) => teamNames.get(id) ?? id).join(", ") || "—"}</td>
              <td className="hidden px-4 py-2.5 text-[var(--muted)] lg:table-cell">{member.access === "admin" ? "All" : member.projectIds.map((id) => data?.projects[id]?.name ?? id).join(", ") || <span className="text-[var(--faint)]">None</span>}</td>
              <td className="px-4 py-2.5">{isAdmin && member.id !== me?.id && <div className="flex justify-end gap-1">
                <Button variant="ghost" size="sm" className="icon-button" aria-label={`Edit ${member.name}`} onClick={() => setDialog(member)}><Pencil size={13} /></Button>
                <Button variant="ghost" size="sm" className="icon-button" aria-label={member.disabled ? `Reactivate ${member.name}` : `Deactivate ${member.name}`} onClick={async () => {
                  const res = await fetch(`/api/members/${member.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ disabled: !member.disabled }) });
                  if (res.ok) void load();
                }}>{member.disabled ? <RotateCcw size={13} /> : <Ban size={13} />}</Button>
              </div>}</td>
            </tr>)}
          </tbody>
        </table>
      </section>}
    {dialog && <MemberDialog member={dialog === "new" ? null : dialog} teams={data ? Object.values(data.teams) : []} projects={projects} onClose={(saved) => { setDialog(null); if (saved) void load(); }} />}
  </div>;
}

function MemberDialog({ member, teams, projects, onClose }: { member: Member | null; teams: { id: string; name: string }[]; projects: { id: string; name: string }[]; onClose: (saved: boolean) => void }) {
  const isNew = !member;
  const [name, setName] = useState(member?.name ?? "");
  const [email, setEmail] = useState(member?.email ?? "");
  const [title, setTitle] = useState(member?.title ?? "");
  const [access, setAccess] = useState<"admin" | "member">(member?.access ?? "member");
  const [password, setPassword] = useState("");
  const [color, setColor] = useState(member?.color ?? COLORS[0]);
  const [teamIds, setTeamIds] = useState<string[]>(member?.teamIds ?? [teams[0]?.id].filter(Boolean));
  const [projectIds, setProjectIds] = useState<string[]>(member?.projectIds ?? []);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setFormError(null);
    const body: Record<string, unknown> = isNew
      ? { name: name.trim(), email: email.trim(), password, access, title: title.trim() || undefined, color, teamIds, projectIds }
      : { name: name.trim(), title: title.trim(), access, color, teamIds, projectIds, ...(email.trim() !== (member?.email ?? "") ? { email: email.trim() } : {}), ...(password ? { password } : {}) };
    const res = await fetch(isNew ? "/api/members" : `/api/members/${member!.id}`, { method: isNew ? "POST" : "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    if (res.ok) { onClose(true); return; }
    const result = await res.json().catch(() => null);
    setFormError(result?.message ?? "Could not save the member.");
  }

  return <Modal open onOpenChange={(open) => { if (!open) onClose(false); }} title={isNew ? "Invite member" : `Edit ${member!.name}`} description={isNew ? "Create an account so this person can sign in to Nivo Labs." : "Update profile, access level and team membership."}>
    <form onSubmit={submit} className="space-y-5">
      <Field label="Name" htmlFor="m-name"><Input id="m-name" autoFocus required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="Ada Lovelace" /></Field>
      <Field label="Email" htmlFor="m-email"><Input id="m-email" type="email" required maxLength={320} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ada@company.com" /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" htmlFor="m-title"><Input id="m-title" maxLength={40} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Product engineer" /></Field>
        <Field label="Access level" htmlFor="m-access"><Select id="m-access" value={access} onChange={(event) => setAccess(event.target.value as "admin" | "member")}><option value="member">Member — can use the workspace</option><option value="admin">Admin — can manage members</option></Select></Field>
      </div>
      <Field label={isNew ? "Password" : "Reset password"} htmlFor="m-password"><Input id="m-password" type="password" required={isNew} minLength={6} maxLength={200} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={isNew ? "Minimum 6 characters" : "Leave empty to keep the current one"} /></Field>
      <Field label="Avatar color"><div className="flex flex-wrap gap-2">{COLORS.map((option) => <button key={option} type="button" aria-label={`Color ${option}`} aria-pressed={color === option} onClick={() => setColor(option)} className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-transparent outline-offset-2" style={{ background: option, outline: color === option ? `1px solid ${option}` : undefined }}>{color === option && <Check size={15} className="text-[#17181f]" />}</button>)}</div></Field>
      {teams.length > 0 && <Field label="Teams"><div className="flex flex-wrap gap-1.5">{teams.map((team) => <button key={team.id} type="button" aria-pressed={teamIds.includes(team.id)} onClick={() => setTeamIds((prev) => prev.includes(team.id) ? prev.filter((id) => id !== team.id) : [...prev, team.id])} className={cn("rounded-full border px-3 py-1.5 text-xs transition-colors", teamIds.includes(team.id) ? "border-[var(--accent)] bg-[var(--accent)]/12 text-[var(--text)]" : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]")}>{team.name}</button>)}</div></Field>}
      {projects.length > 0 && <Field label={access === "admin" ? "Project access (admins see all projects)" : "Project access"}><div className="grid max-h-36 grid-cols-1 gap-1 overflow-y-auto rounded-lg border border-[var(--border)] p-2">{projects.map((project) => <label key={project.id} className={cn("flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-[var(--raised)]", access === "admin" && "pointer-events-none opacity-50")}><input type="checkbox" className="accent-[var(--accent)]" disabled={access === "admin"} checked={access === "admin" || projectIds.includes(project.id)} onChange={(event) => setProjectIds((prev) => event.target.checked ? [...prev, project.id] : prev.filter((id) => id !== project.id))} /><span className="truncate">{project.name}</span></label>)}</div><p className="mt-1.5 text-[10px] text-[var(--muted)]">Members only see the projects they belong to — and their issues. Issues without a project stay visible to everyone.</p></Field>}
      {formError && <div role="alert" className="rounded-lg border border-red-400/20 bg-red-400/5 px-3 py-2 text-xs text-red-400">{formError}</div>}
      <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4"><Button type="button" variant="secondary" disabled={busy} onClick={() => onClose(false)}>Cancel</Button><Button type="submit" variant="primary" disabled={busy}>{busy && <Loader2 size={14} className="animate-spin" />}{busy ? "Saving…" : isNew ? "Invite member" : "Save changes"}</Button></div>
    </form>
  </Modal>;
}
