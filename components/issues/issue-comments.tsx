"use client";

import { useState, type FormEvent } from "react";
import { MessageSquare, Pencil, Send, Trash2 } from "lucide-react";
import { Avatar, Button } from "@/components/ui";
import { useWorkspace } from "@/stores/workspace";
import type { Comment, WorkspaceData } from "@/types/domain";
import { editorClass, errorMessage, MutationError } from "./issue-properties";
import { Markdown } from "./markdown";

export function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export function IssueComments({ issueId, data }: { issueId: string; data: WorkspaceData }) {
  const { mutate, pending } = useWorkspace();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const comments = Object.values(data.comments).filter((comment) => comment.issueId === issueId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!body.trim() || saving) return;
    setSaving(true);
    setError(null);
    try { await mutate({ type: "comment.add", issueId, body: body.trim() }); setBody(""); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setSaving(false); }
  }
  return <div className="space-y-5">
    {comments.length ? comments.map((comment) => <CommentItem key={comment.id} comment={comment} data={data}/>) : <div className="flex items-center gap-2 py-3 text-xs text-[var(--muted)]"><MessageSquare size={14}/>No comments yet. Start the conversation.</div>}
    <form onSubmit={submit} className="flex gap-3"><Avatar user={data.users[data.currentUserId]} size="sm"/><div className="min-w-0 flex-1 space-y-2"><label htmlFor={`comment-${issueId}`} className="sr-only">Write a comment</label><textarea id={`comment-${issueId}`} className={editorClass} rows={3} maxLength={20000} placeholder="Leave a comment…" value={body} onChange={(event) => setBody(event.target.value)} disabled={saving}/><MutationError message={error}/><div className="flex items-center justify-between gap-2"><span className="text-[10px] text-[var(--muted)]">Markdown supported</span><Button size="sm" type="submit" variant="secondary" disabled={!body.trim() || saving || !!pending}><Send size={13}/>{saving ? "Sending…" : "Comment"}</Button></div></div></form>
  </div>;
}

function CommentItem({ comment, data }: { comment: Comment; data: WorkspaceData }) {
  const { mutate, pending } = useWorkspace();
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(comment.body);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const author = data.users[comment.authorId];
  const own = comment.authorId === data.currentUserId;
  async function save() {
    setError(null);
    try { await mutate({ type: "comment.edit", id: comment.id, body }); setEditing(false); }
    catch (failure) { setError(errorMessage(failure)); }
  }
  async function remove() {
    setError(null);
    try { await mutate({ type: "comment.delete", id: comment.id }); }
    catch (failure) { setError(errorMessage(failure)); }
  }
  return <article className="flex gap-3"><Avatar user={author} size="sm"/><div className="min-w-0 flex-1"><div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1"><span className="text-xs font-medium">{author?.name || "Unknown member"}</span><time dateTime={comment.createdAt} className="text-[10px] text-[var(--muted)]">{formatTimestamp(comment.createdAt)}{comment.editedAt ? " · edited" : ""}</time>{own && !editing && <div className="ml-auto flex items-center gap-1"><Button size="sm" variant="ghost" aria-label={`Edit comment by ${author?.name}`} onClick={() => { setBody(comment.body); setEditing(true); }}><Pencil size={12}/></Button><Button size="sm" variant="ghost" aria-label={`Delete comment by ${author?.name}`} onClick={() => setDeleting(true)}><Trash2 size={12}/></Button></div>}</div>
      {editing ? <div className="space-y-2"><textarea aria-label="Edit comment" className={editorClass} rows={3} value={body} maxLength={20000} onChange={(event) => setBody(event.target.value)}/><div className="flex gap-2"><Button size="sm" variant="primary" disabled={!body.trim() || !!pending} onClick={save}>Save comment</Button><Button size="sm" variant="ghost" disabled={!!pending} onClick={() => setEditing(false)}>Cancel</Button></div></div> : <Markdown>{comment.body}</Markdown>}
      {deleting && <div role="alert" className="my-2 rounded-lg border border-[var(--border)] p-3"><p className="mb-2 text-xs">Delete this comment? This cannot be undone.</p><div className="flex gap-2"><Button size="sm" variant="danger" disabled={!!pending} onClick={remove}>Delete comment</Button><Button size="sm" variant="ghost" onClick={() => setDeleting(false)}>Cancel</Button></div></div>}
      <MutationError message={error}/>
    </div></article>;
}

export function IssueActivity({ issueId, data }: { issueId: string; data: WorkspaceData }) {
  const activities = Object.values(data.activities).filter((activity) => activity.issueId === issueId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (!activities.length) return <p className="py-3 text-xs text-[var(--muted)]">No activity recorded yet.</p>;
  return <ol className="space-y-4">{activities.map((activity) => <li key={activity.id} className="flex items-start gap-3"><Avatar user={data.users[activity.actorId]} size="sm"/><div className="min-w-0"><p className="text-xs leading-5"><span className="font-medium">{data.users[activity.actorId]?.name || "Workspace member"}</span> <span className="text-[var(--muted)]">{activity.message}</span></p><time dateTime={activity.createdAt} className="text-[10px] text-[var(--muted)]">{formatTimestamp(activity.createdAt)}</time></div></li>)}</ol>;
}
