"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Archive, ArrowLeft, CalendarRange, Columns3, LayoutDashboard, ListChecks, Loader2, Pencil, RotateCcw } from "lucide-react";
import { Badge, Button, EmptyState, Modal, cn } from "@/components/ui";
import { useWorkspace } from "@/stores/workspace";
import { ProjectFormDialog } from "./project-form";
import { ProjectHealth, ProjectMark, ProjectStatusBadge } from "./project-shared";

const TABS = [
  { name: "Overview", path: "", icon: LayoutDashboard },
  { name: "Issues", path: "/issues", icon: ListChecks },
  { name: "Board", path: "/board", icon: Columns3 },
  { name: "Cycles", path: "/cycles", icon: CalendarRange },
  { name: "Activity", path: "/activity", icon: Activity },
];

export function ProjectLayout({ projectId, children }: { projectId: string; children: ReactNode }) {
  const { data, mutate } = useWorkspace();
  const pathname = usePathname();
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  if (!data) return null;
  const project = data.projects[projectId];
  if (!project) return <div className="page"><EmptyState icon={<Archive size={28} />} title="Project not found" description="This project may no longer exist, or the link may be incorrect." action={<Link href="/projects" className="button">Back to projects</Link>} /></div>;
  async function toggleArchive() {
    setSaving(true); setError("");
    try { await mutate({ type: "project.archive", id: projectId, archived: !project.archivedAt }); setConfirm(false); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "We couldn’t update this project. Please try again."); }
    finally { setSaving(false); }
  }
  return <div><div className="page !pb-0"><Link href="/projects" className="mb-6 inline-flex items-center gap-1.5 text-xs text-[var(--muted)] hover:text-[var(--text)]"><ArrowLeft size={13} />All projects</Link><div className="flex flex-wrap items-start justify-between gap-4"><div className="flex min-w-0 items-start gap-3.5"><ProjectMark project={project} large /><div className="min-w-0"><div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>{project.archivedAt ? <Badge>Archived</Badge> : <ProjectStatusBadge status={project.status} />}</div><div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]"><span>{data.teams[project.teamId]?.name}</span><span aria-hidden="true">/</span><ProjectHealth health={project.health} /></div></div></div><div className="flex items-center gap-2"><Button variant="ghost" size="sm" onClick={() => { setError(""); setConfirm(true); }}>{project.archivedAt ? <RotateCcw size={14} /> : <Archive size={14} />}{project.archivedAt ? "Restore" : "Archive"}</Button><Button variant="secondary" size="sm" onClick={() => setEditing(true)}><Pencil size={13} />Edit project</Button></div></div>{project.archivedAt && <div className="mt-5 flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs text-[var(--muted)]"><Archive size={14} /><span>This project is archived. Its issues and history are preserved. Restore it to plan new work.</span></div>}<nav aria-label="Project navigation" className="mt-7 flex gap-5 overflow-x-auto border-b border-[var(--border)]">{TABS.map(({ name, path, icon: Icon }) => { const href = `/projects/${projectId}${path}`; const active = pathname === href; return <Link key={name} href={href} aria-current={active ? "page" : undefined} className={cn("relative flex shrink-0 items-center gap-2 border-b-2 px-0.5 pb-3.5 pt-1 text-xs transition-colors", active ? "border-[var(--accent)] text-[var(--text)]" : "border-transparent text-[var(--muted)] hover:text-[var(--text)]")}><Icon size={14} />{name}</Link>; })}</nav></div>{children}<ProjectFormDialog open={editing} onOpenChange={setEditing} project={project} /><Modal open={confirm} onOpenChange={(open) => { if (!saving) setConfirm(open); }} title={project.archivedAt ? "Restore this project?" : "Archive this project?"} description={project.archivedAt ? "The project will return to your active directory. Its issues, members, and progress will stay unchanged." : "The project will leave your active directory. All issues and activity stay intact, and you can restore it at any time."}><div className="rounded-lg border border-[var(--border)] bg-[var(--raised)] px-4 py-3 text-sm font-medium">{project.name}</div>{error && <p role="alert" className="mt-3 text-xs text-red-400">{error}</p>}<div className="mt-5 flex justify-end gap-2"><Button variant="secondary" disabled={saving} onClick={() => setConfirm(false)}>Cancel</Button><Button variant={project.archivedAt ? "primary" : "danger"} disabled={saving} onClick={toggleArchive}>{saving && <Loader2 size={14} className="animate-spin" />}{project.archivedAt ? "Restore project" : "Archive project"}</Button></div></Modal></div>;
}
