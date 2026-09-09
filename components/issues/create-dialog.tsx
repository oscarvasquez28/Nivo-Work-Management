"use client";

import { useState, type FormEvent } from "react";
import { ArrowUpRight, FileText, Plus } from "lucide-react";
import { Button, Field, Input, Modal } from "@/components/ui";
import { useWorkspace } from "@/stores/workspace";
import type { IssueInput, WorkspaceData } from "@/types/domain";
import { editorClass, errorMessage, IssueProperties, MutationError } from "./issue-properties";

export function IssueCreateDialog({ open, onOpenChange, defaults }: { open: boolean; onOpenChange: (value: boolean) => void; defaults?: Partial<IssueInput> }) {
  const { data, ready, error } = useWorkspace();
  if (!open) return null;
  if (!data) return <Modal open={open} onOpenChange={onOpenChange} title="Create issue"><p className="text-sm text-[var(--muted)]">{error || (ready ? "Workspace is unavailable. Close this dialog and retry loading your workspace." : "Loading your workspace…")}</p></Modal>;
  return <CreateForm data={data} defaults={defaults} onOpenChange={onOpenChange}/>;
}

function CreateForm({ data, defaults, onOpenChange }: { data: WorkspaceData; defaults?: Partial<IssueInput>; onOpenChange: (value: boolean) => void }) {
  const { mutate, pending } = useWorkspace();
  const [initial] = useState<IssueInput>(() => ({
    title: "", description: "", status: "backlog", priority: "none", projectId: null,
    cycleId: null, assigneeId: null, reporterId: data.currentUserId, labelIds: [], estimate: null,
    startDate: null, dueDate: null, ...defaults,
    teamId: (defaults?.projectId && data.projects[defaults.projectId]?.teamId) || (defaults?.cycleId && data.cycles[defaults.cycleId]?.teamId) || defaults?.teamId || Object.keys(data.teams)[0],
  }));
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [discard, setDiscard] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const requestClose = (next: boolean) => {
    if (next || saving) return;
    if (dirty) setDiscard(true); else onOpenChange(false);
  };
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.title.trim() || saving) return;
    setError(null);
    setSaving(true);
    try {
      await mutate({ type: "issue.create", input: { ...draft, title: draft.title.trim() } });
      onOpenChange(false);
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setSaving(false); }
  }
  return <Modal open onOpenChange={requestClose} title="Create issue" description="A little clarity. A little momentum." wide>
    <form onSubmit={submit} className="space-y-5">
      <div className="flex items-center gap-2 text-xs text-[var(--muted)]"><span className="flex size-6 items-center justify-center rounded bg-[var(--accent)]/15 text-[var(--accent)]"><FileText size={13}/></span>{data.workspace.name}<ArrowUpRight size={12}/><span>New issue</span></div>
      <Field label="Issue title" htmlFor="new-issue-title"><Input id="new-issue-title" autoFocus required maxLength={240} placeholder="What needs to be done?" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} className="!text-lg !font-medium" disabled={saving}/></Field>
      <Field label="Description" htmlFor="new-issue-description"><textarea id="new-issue-description" rows={4} maxLength={50000} className={editorClass} placeholder="Add context, a checklist, or the outcome you’re looking for…" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} disabled={saving}/><span className="mt-1 block text-[11px] text-[var(--muted)]">Markdown supported</span></Field>
      <details className="rounded-lg border border-[var(--border)]" open><summary className="cursor-pointer px-3 py-2 text-xs font-medium text-[var(--muted)]">Issue properties</summary><div className="border-t border-[var(--border)] p-3"><IssueProperties data={data} value={draft} onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))} disabled={saving}/></div></details>
      <MutationError message={error}/>
      {discard && <div role="alert" className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-3"><p className="mb-3 text-sm">Discard this unsaved issue?</p><div className="flex gap-2"><Button type="button" size="sm" onClick={() => setDiscard(false)}>Keep editing</Button><Button type="button" size="sm" variant="danger" onClick={() => onOpenChange(false)}>Discard draft</Button></div></div>}
      <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] pt-4"><Button type="button" variant="ghost" onClick={() => requestClose(false)} disabled={saving}>Cancel</Button><Button type="submit" variant="primary" disabled={!draft.title.trim() || saving || !!pending}><Plus size={15}/>{saving ? "Creating…" : "Create issue"}</Button></div>
    </form>
  </Modal>;
}
