"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Activity, Search } from "lucide-react";
import { Button, EmptyState, Input, Select } from "@/components/ui";
import { useWorkspace } from "@/stores/workspace";
import { dateLabel } from "@/lib/domain/selectors";
import { ActivityFeed, projectActivities } from "./project-shared";

export function ProjectActivity({ projectId }: { projectId: string }) {
  const { data } = useWorkspace();
  const [query, setQuery] = useState("");
  const [actor, setActor] = useState("all");
  const [kind, setKind] = useState("all");
  const [limit, setLimit] = useState(30);
  const all = useMemo(() => data ? projectActivities(data, projectId) : [], [data, projectId]);
  const activities = useMemo(() => all.filter((item) => {
    const issue = item.issueId && data ? data.issues[item.issueId] : null;
    return (actor === "all" || item.actorId === actor) && (kind === "all" || (kind === "project" ? !item.issueId : !!item.issueId)) && `${item.message} ${issue?.title ?? ""} ${data?.users[item.actorId]?.name ?? ""}`.toLowerCase().includes(query.trim().toLowerCase());
  }), [all, actor, kind, query, data]);
  if (!data) return null;
  if (!data.projects[projectId]) return <EmptyState title="Project not found" action={<Link href="/projects" className="button">All projects</Link>} />;
  const actorIds = Array.from(new Set(all.map((item) => item.actorId)));
  const dates = Array.from(new Set(activities.slice(0, limit).map((item) => item.createdAt.slice(0, 10))));
  return <div className="page !pt-6"><div className="mb-5 flex flex-wrap items-center gap-2"><div className="relative min-w-48 flex-1 sm:max-w-72"><Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" /><Input aria-label="Search project activity" className="pl-9" placeholder="Search activity…" value={query} onChange={(event) => { setQuery(event.target.value); setLimit(30); }} /></div><Select aria-label="Filter activity by member" value={actor} onChange={(event) => { setActor(event.target.value); setLimit(30); }}><option value="all">All members</option>{actorIds.map((id) => <option key={id} value={id}>{data.users[id]?.name ?? "Team member"}</option>)}</Select><Select aria-label="Filter activity type" value={kind} onChange={(event) => { setKind(event.target.value); setLimit(30); }}><option value="all">All activity</option><option value="project">Project updates</option><option value="issues">Issue updates</option></Select><span className="ml-auto text-xs text-[var(--muted)]">{activities.length} update{activities.length === 1 ? "" : "s"}</span></div>{!activities.length ? <EmptyState icon={<Activity size={26} />} title={all.length ? "No matching updates" : "Your project’s story starts here"} description={all.length ? "Try a different search or member filter." : "Project changes and issue progress will appear in this feed."} action={all.length ? <Button variant="secondary" onClick={() => { setQuery(""); setActor("all"); setKind("all"); }}>Clear filters</Button> : undefined} /> : <div className="max-w-4xl space-y-5">{dates.map((date) => <section key={date}><h2 className="mb-2 flex items-center gap-2 text-[11px] font-medium text-[var(--muted)]"><span className="h-1 w-1 rounded-full bg-[var(--muted)]" />{date === data.workspace.seedAnchorDate ? "Today" : dateLabel(date)}</h2><div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]"><ActivityFeed data={data} activities={activities.slice(0, limit).filter((item) => item.createdAt.startsWith(date))} limit={limit} /></div></section>)}{activities.length > limit && <div className="flex justify-center"><Button variant="secondary" onClick={() => setLimit((current) => current + 30)}>Show more activity ({activities.length - limit} remaining)</Button></div>}</div>}</div>;
}
