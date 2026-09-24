"use client";

import Link from "next/link";
import { useState } from "react";
import { Link2, Plus, X } from "lucide-react";
import { Button, Select, StatusIcon } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import { issueBlockers, issueBlocking, issueRelated } from "@/lib/domain/selectors";
import { useWorkspace } from "@/stores/workspace";
import type { Issue, IssueLink, IssueLinkType, WorkspaceData } from "@/types/domain";
import { errorMessage, MutationError } from "./issue-properties";

type Relation = "blocks" | "blocked_by" | "relates_to";

function otherIssueId(link: IssueLink, issueId: string) {
  return link.sourceIssueId === issueId ? link.targetIssueId : link.sourceIssueId;
}

function DependencyRow({ link, issueId, data, onRemove, disabled }: { link: IssueLink; issueId: string; data: WorkspaceData; onRemove: (id: string) => void; disabled?: boolean }) {
  const { t } = useI18n();
  const other = data.issues[otherIssueId(link, issueId)];
  if (!other) return null;
  return <li className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-[var(--raised)]">
    <StatusIcon status={other.status}/>
    <Link href={`/issues/${other.id}`} className="flex min-w-0 flex-1 items-baseline gap-2">
      <span className="shrink-0 font-mono text-[11px] text-[var(--muted)]">{other.identifier}</span>
      <span className="truncate text-xs">{other.title}</span>
    </Link>
    <Button size="sm" variant="ghost" className="icon-button !h-6 !w-6" aria-label={t("deps.remove")} title={t("deps.remove")} disabled={disabled} onClick={() => onRemove(link.id)}><X size={13}/></Button>
  </li>;
}

export function IssueDependencies({ issue, data, disabled }: { issue: Issue; data: WorkspaceData; disabled?: boolean }) {
  const { mutate, pending } = useWorkspace();
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [relation, setRelation] = useState<Relation>("blocked_by");
  const [targetId, setTargetId] = useState("");
  const blockers = issueBlockers(data, issue.id);
  const blocking = issueBlocking(data, issue.id);
  const related = issueRelated(data, issue.id);
  const empty = !blockers.length && !blocking.length && !related.length;
  const busy = disabled || !!pending;

  const linkedFor = (candidate: Issue) => {
    if (relation === "blocks") return Object.values(data.issueLinks).some((link) => link.type === "blocks" && link.sourceIssueId === issue.id && link.targetIssueId === candidate.id);
    if (relation === "blocked_by") return Object.values(data.issueLinks).some((link) => link.type === "blocks" && link.sourceIssueId === candidate.id && link.targetIssueId === issue.id);
    return Object.values(data.issueLinks).some((link) => link.type === "relates_to" && (link.sourceIssueId === candidate.id || link.targetIssueId === candidate.id) && (link.sourceIssueId === issue.id || link.targetIssueId === issue.id));
  };
  const candidates = Object.values(data.issues)
    .filter((candidate) => !candidate.deletedAt && candidate.id !== issue.id && !linkedFor(candidate))
    .sort((a, b) => Number(a.identifier.split("-").at(-1)) - Number(b.identifier.split("-").at(-1)));

  async function add() {
    if (!targetId) return;
    setError(null);
    const linkType: IssueLinkType = relation === "relates_to" ? "relates_to" : "blocks";
    const command = relation === "blocked_by"
      ? { type: "issue.link" as const, issueId: targetId, targetIssueId: issue.id, linkType }
      : { type: "issue.link" as const, issueId: issue.id, targetIssueId: targetId, linkType };
    try {
      await mutate(command);
      setTargetId("");
      setAdding(false);
    } catch (failure) { setError(errorMessage(failure)); }
  }

  async function remove(linkId: string) {
    setError(null);
    try { await mutate({ type: "issue.unlink", id: linkId }); }
    catch (failure) { setError(errorMessage(failure)); }
  }

  const section = (title: string, links: IssueLink[]) => links.length ? <div>
    <h3 className="mb-1 text-[11px] font-medium text-[var(--muted)]">{title}</h3>
    <ul>{links.map((link) => <DependencyRow key={link.id} link={link} issueId={issue.id} data={data} disabled={busy} onRemove={(id) => { void remove(id); }}/>)}</ul>
  </div> : null;

  return <section aria-label={t("deps.title")} className="border-t border-[var(--border)] pt-5">
    <div className="mb-3 flex items-center justify-between">
      <h2 className="flex items-center gap-2 text-xs font-medium text-[var(--muted)]"><Link2 size={13}/>{t("deps.title")}</h2>
      {!adding && <Button size="sm" variant="ghost" disabled={busy} onClick={() => setAdding(true)}><Plus size={13}/>{t("deps.add")}</Button>}
    </div>
    <MutationError message={error} onDismiss={() => setError(null)}/>
    <div className="space-y-3">
      {section(t("deps.blockedBy"), blockers)}
      {section(t("deps.blocking"), blocking)}
      {section(t("deps.related"), related)}
      {empty && !adding && <p className="text-xs text-[var(--muted)]">{t("deps.none")}</p>}
    </div>
    {adding && <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] p-2">
      <Select aria-label={t("deps.relation")} className="!w-auto" value={relation} disabled={busy} onChange={(event) => { setRelation(event.target.value as Relation); setTargetId(""); }}>
        <option value="blocked_by">{t("deps.relation.blockedBy")}</option>
        <option value="blocks">{t("deps.relation.blocks")}</option>
        <option value="relates_to">{t("deps.relation.relates")}</option>
      </Select>
      <Select aria-label={t("deps.selectIssue")} className="min-w-0 flex-1" value={targetId} disabled={busy} onChange={(event) => setTargetId(event.target.value)}>
        <option value="">{t("deps.selectIssue")}</option>
        {candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.identifier} · {candidate.title}</option>)}
      </Select>
      <Button size="sm" variant="primary" disabled={!targetId || busy} onClick={() => { void add(); }}>{t("deps.add")}</Button>
      <Button size="sm" variant="ghost" disabled={busy} onClick={() => { setAdding(false); setTargetId(""); setError(null); }}>{t("common.cancel")}</Button>
    </div>}
  </section>;
}
