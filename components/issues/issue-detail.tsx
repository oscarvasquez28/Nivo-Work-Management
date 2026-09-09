"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Check, Copy, ExternalLink, FileText, Pencil, RotateCcw, Trash2, X } from "lucide-react";
import { Badge, Button, EmptyState, Input, StatusIcon, cn } from "@/components/ui";
import { useWorkspace } from "@/stores/workspace";
import type { Issue, IssueInput, WorkspaceData } from "@/types/domain";
import { editorClass, errorMessage, IssueProperties, MutationError } from "./issue-properties";
import { formatTimestamp, IssueActivity, IssueComments } from "./issue-comments";
import { Markdown } from "./markdown";

export function IssueDetail({ issueId, panel = false, onClose }: { issueId: string; panel?: boolean; onClose?: () => void }) {
  const { data, ready, error, retry } = useWorkspace();
  if (!data) return <div className="p-8"><EmptyState title={error ? "Unable to load issue" : "Loading issue…"} description={error || "Getting your workspace ready."} action={error ? <Button onClick={() => { void retry(); }}>Retry</Button> : undefined}/></div>;
  const issue = data.issues[issueId] || Object.values(data.issues).find((item) => item.identifier === issueId);
  if (ready && !issue) return <div className="p-8"><EmptyState icon={<FileText size={28}/>} title="Issue not found" description="This issue does not exist in this workspace. Check the link or return to your issues." action={onClose ? <Button onClick={onClose}>Close issue</Button> : <Link href="/issues" className="text-sm text-[var(--accent)]">Back to issues</Link>}/></div>;
  if (!issue) return null;
  return <IssueEditor key={issue.id} issue={issue} data={data} panel={panel} onClose={onClose}/>;
}

function IssueEditor({ issue, data, panel, onClose }: { issue: Issue; data: WorkspaceData; panel: boolean; onClose?: () => void }) {
  const { mutate, pending } = useWorkspace();
  const [error, setError] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(issue.title);
  const [editingDescription, setEditingDescription] = useState(false);
  const [description, setDescription] = useState(issue.description);
  const [preview, setPreview] = useState(false);
  const [tab, setTab] = useState<"comments" | "activity">("comments");
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);
  async function update(patch: Partial<IssueInput>): Promise<boolean> {
    setError(null);
    try { await mutate({ type: "issue.update", id: issue.id, patch }); return true; }
    catch (failure) { setError(errorMessage(failure)); return false; }
  }
  async function remove() {
    setError(null);
    try { await mutate({ type: "issue.delete", id: issue.id }); setDeleting(false); }
    catch (failure) { setError(errorMessage(failure)); }
  }
  async function restore() {
    setError(null);
    try { await mutate({ type: "issue.restore", id: issue.id }); }
    catch (failure) { setError(errorMessage(failure)); }
  }
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/issues/${issue.id}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { setError("The link could not be copied. You can copy the issue URL from your browser instead."); }
  }
  const comments = Object.values(data.comments).filter((comment) => comment.issueId === issue.id).length;
  return <section className={cn("mx-auto flex min-h-full w-full min-w-0 flex-col", !panel && "max-w-6xl")}>
    <header className="flex min-h-14 items-center justify-between gap-3 border-b border-[var(--border)] px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-2 text-xs text-[var(--muted)]">{!panel && <Link href="/issues" aria-label="Back to issues" className="mr-1 rounded p-1 hover:bg-[var(--raised)]"><ArrowLeft size={15}/></Link>}<span className="truncate">{data.teams[issue.teamId]?.name}</span><span>/</span><span className="shrink-0 font-mono text-[var(--text)]">{issue.identifier}</span></div>
      <div className="flex shrink-0 items-center gap-1"><Button size="sm" variant="ghost" aria-label="Copy issue link" title="Copy issue link" onClick={copyLink}>{copied ? <Check size={15}/> : <Copy size={15}/>}</Button>{panel && <a href={`/issues/${issue.id}`} target="_blank" rel="noreferrer" aria-label="Open issue in new tab" className="rounded-md p-2 text-[var(--muted)] hover:bg-[var(--raised)]"><ExternalLink size={15}/></a>}{!issue.deletedAt && <Button size="sm" variant="ghost" aria-label="Delete issue" title="Delete issue" onClick={() => setDeleting(true)}><Trash2 size={15}/></Button>}{onClose && <Button size="sm" variant="ghost" aria-label="Close issue" onClick={onClose}><X size={18}/></Button>}</div>
    </header>
    <div className="sr-only" role="status">{copied ? "Issue link copied" : ""}</div>
    {issue.deletedAt ? <div className="space-y-4 p-8"><EmptyState icon={<Trash2 size={28}/>} title="This issue was deleted" description="Its history is still here. Restore the issue to return it to your workspace." action={<Button onClick={restore} disabled={!!pending}><RotateCcw size={15}/>Restore issue</Button>}/><MutationError message={error}/></div> : <div className={cn("grid min-w-0 flex-1", !panel && "lg:grid-cols-[minmax(0,1fr)_290px]")}>
      <div className="min-w-0 space-y-7 p-5 sm:p-8">
        <div className="space-y-3"><div className="flex flex-wrap items-center gap-2"><StatusIcon status={issue.status}/><span className="font-mono text-xs text-[var(--muted)]">{issue.identifier}</span>{issue.projectId && <Link href={`/projects/${issue.projectId}`}><Badge color={data.projects[issue.projectId]?.color}>{data.projects[issue.projectId]?.name}</Badge></Link>}</div>
          {editingTitle ? <form onSubmit={async (event) => { event.preventDefault(); if (await update({ title: title.trim() })) setEditingTitle(false); }} className="space-y-2"><Input aria-label="Issue title" autoFocus value={title} maxLength={240} required onChange={(event) => setTitle(event.target.value)} className="!text-xl !font-semibold"/><div className="flex gap-2"><Button size="sm" variant="primary" type="submit" disabled={!title.trim() || !!pending}>Save title</Button><Button size="sm" variant="ghost" type="button" onClick={() => setEditingTitle(false)}>Cancel</Button></div></form> : <div className="group flex items-start gap-2"><h1 className="min-w-0 flex-1 break-words text-2xl font-semibold leading-snug tracking-tight">{issue.title}</h1><Button size="sm" variant="ghost" aria-label="Edit issue title" onClick={() => { setTitle(issue.title); setEditingTitle(true); }}><Pencil size={14}/></Button></div>}
        </div>
        <MutationError message={error} onDismiss={() => setError(null)}/>
        {deleting && <div role="alert" className="rounded-lg border border-red-400/30 bg-red-400/5 p-4"><h2 className="text-sm font-semibold">Delete {issue.identifier}?</h2><p className="mb-3 mt-1 text-xs text-[var(--muted)]">It will be removed from lists, boards, and progress. You can undo this from the confirmation or restore it here.</p><div className="flex gap-2"><Button size="sm" variant="danger" onClick={remove} disabled={!!pending}>Delete issue</Button><Button size="sm" variant="ghost" onClick={() => setDeleting(false)}>Keep issue</Button></div></div>}
        <section aria-label="Issue description"><div className="mb-3 flex items-center justify-between"><h2 className="text-xs font-medium text-[var(--muted)]">Description</h2>{!editingDescription && <Button size="sm" variant="ghost" aria-label="Edit description" onClick={() => { setDescription(issue.description); setPreview(false); setEditingDescription(true); }}><Pencil size={13}/>Edit</Button>}</div>
          {editingDescription ? <div className="space-y-3"><div className="flex gap-1"><Button size="sm" variant={preview ? "ghost" : "secondary"} onClick={() => setPreview(false)}>Write</Button><Button size="sm" variant={preview ? "secondary" : "ghost"} onClick={() => setPreview(true)}>Preview</Button></div>{preview ? <div className="min-h-36 rounded-lg border border-[var(--border)] p-3"><Markdown>{description || "Nothing to preview yet."}</Markdown></div> : <textarea autoFocus aria-label="Issue description" className={editorClass} rows={9} maxLength={50000} value={description} onChange={(event) => setDescription(event.target.value)}/>}<div className="flex items-center gap-2"><Button size="sm" variant="primary" disabled={!!pending} onClick={async () => { if (await update({ description })) setEditingDescription(false); }}>Save description</Button><Button size="sm" variant="ghost" onClick={() => setEditingDescription(false)}>Cancel</Button><span className="ml-auto hidden text-[10px] text-[var(--muted)] sm:block">Markdown supported</span></div></div> : issue.description ? <Markdown>{issue.description}</Markdown> : <button className="w-full rounded-lg border border-dashed border-[var(--border)] p-5 text-left text-sm text-[var(--muted)] hover:bg-[var(--surface)]" onClick={() => { setDescription(""); setEditingDescription(true); }}>Add context or a description…</button>}
        </section>
        {panel && <section className="border-y border-[var(--border)] py-5"><IssueProperties data={data} value={issue} disabled={!!pending} onChange={(patch) => { void update(patch); }} compact/></section>}
        <section className="border-t border-[var(--border)] pt-5"><div className="mb-5 flex gap-5" role="tablist" aria-label="Issue conversation"><button role="tab" aria-selected={tab === "comments"} aria-controls={`conversation-${issue.id}`} className={cn("border-b-2 pb-2 text-xs font-medium", tab === "comments" ? "border-[var(--accent)] text-[var(--text)]" : "border-transparent text-[var(--muted)]")} onClick={() => setTab("comments")}>Comments <span className="ml-1 text-[var(--muted)]">{comments}</span></button><button role="tab" aria-selected={tab === "activity"} aria-controls={`conversation-${issue.id}`} className={cn("border-b-2 pb-2 text-xs font-medium", tab === "activity" ? "border-[var(--accent)] text-[var(--text)]" : "border-transparent text-[var(--muted)]")} onClick={() => setTab("activity")}>Activity</button></div><div id={`conversation-${issue.id}`} role="tabpanel">{tab === "comments" ? <IssueComments issueId={issue.id} data={data}/> : <IssueActivity issueId={issue.id} data={data}/>}</div></section>
        <p className="text-[10px] text-[var(--muted)]">Created {formatTimestamp(issue.createdAt)} · Updated {formatTimestamp(issue.updatedAt)}</p>
      </div>
      {!panel && <aside className="min-w-0 border-t border-[var(--border)] bg-[var(--surface)]/40 p-5 lg:border-l lg:border-t-0"><h2 className="mb-5 text-xs font-semibold">Properties</h2><IssueProperties data={data} value={issue} disabled={!!pending} onChange={(patch) => { void update(patch); }}/></aside>}
    </div>}
  </section>;
}
