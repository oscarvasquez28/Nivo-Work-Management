"use client";

import Link from "next/link";
import { ArrowUpRight, CalendarDays, CheckCircle2, CircleDot, Flag, Flame, Layers3, Plus } from "lucide-react";
import { Button, EmptyState, PageHeader, PriorityIcon, Progress, StatusIcon, cn } from "@/components/ui";
import { useWorkspace } from "@/stores/workspace";
import { useUI } from "@/components/providers/ui-provider";
import { dateLabel, projectProgress, selectIssues } from "@/lib/domain/selectors";
import { CycleCard, cyclePhase } from "@/components/cycles/cycle-shared";
import { ActivityFeed, ProjectMark, ProjectHealth, SectionHeading, ViewLink } from "@/components/projects/project-shared";
import type { Issue, WorkspaceData } from "@/types/domain";

function isOverdue(issue: Issue, today: string) {
  return !!issue.dueDate && issue.dueDate < today && issue.status !== "done";
}

function MyIssueRow({ issue, data, overdue }: { issue: Issue; data: WorkspaceData; overdue: boolean }) {
  const project = issue.projectId ? data.projects[issue.projectId] : null;
  return <Link href={`/issues/${issue.id}`} scroll={false} className="group flex min-h-14 items-center gap-3 px-5 py-3 transition-colors hover:bg-[var(--raised)]"><StatusIcon status={issue.status} /><div className="min-w-0 flex-1"><div className="flex min-w-0 items-center gap-2"><span className="shrink-0 font-mono text-[11px] tabular-nums text-[var(--muted)]">{issue.identifier}</span><span className="truncate text-[13px] group-hover:text-[var(--accent)]">{issue.title}</span></div><div className="mt-0.5 flex items-center gap-2 text-[10px] text-[var(--muted)]"><span className="truncate">{project?.name ?? data.teams[issue.teamId]?.name ?? "Workspace"}</span>{issue.cycleId && data.cycles[issue.cycleId] && <span className="hidden sm:inline">· {data.cycles[issue.cycleId].name}</span>}</div></div>{issue.dueDate && <span className={cn("hidden shrink-0 items-center gap-1 text-[11px] sm:flex", overdue ? "font-medium text-[#ee8c96]" : "text-[var(--muted)]")}><CalendarDays size={11} />{overdue ? "Overdue · " : "Due "}{dateLabel(issue.dueDate)}</span>}<PriorityIcon priority={issue.priority} /></Link>;
}

export function HomePage() {
  const { data } = useWorkspace();
  const { openCreateIssue } = useUI();
  if (!data) return null;
  const user = data.users[data.currentUserId];
  const today = data.workspace.seedAnchorDate;
  const mine = selectIssues(data, {}, { assigneeId: data.currentUserId });
  const activeMine = mine.filter((issue) => issue.status !== "done");
  const overdue = activeMine.filter((issue) => isOverdue(issue, today));
  const dueSoon = activeMine.filter((issue) => issue.dueDate && issue.dueDate >= today && issue.dueDate <= new Date(Date.parse(`${today}T00:00:00Z`) + 7 * 86400000).toISOString().slice(0, 10)).sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
  const inProgress = activeMine.filter((issue) => issue.status === "in_progress" || issue.status === "in_review").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 7);
  const recentlyCompleted = mine.filter((issue) => issue.status === "done").sort((a, b) => (b.completedAt ?? b.updatedAt).localeCompare(a.completedAt ?? a.updatedAt)).slice(0, 5);
  const projects = Object.values(data.projects).filter((project) => !project.archivedAt && project.status !== "completed").sort((a, b) => projectProgress(data, b.id).percent - projectProgress(data, a.id).percent).slice(0, 4);
  const myTeams = Object.values(data.teams).filter((team) => user?.teamIds.includes(team.id));
  const currentCycle = myTeams.flatMap((team) => Object.values(data.cycles).filter((cycle) => cycle.teamId === team.id)).filter((cycle) => !cycle.closedAt && cyclePhase(cycle, today) === "current").sort((a, b) => a.endDate.localeCompare(b.endDate))[0];
  const activity = Object.values(data.activities).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  const greeting = user?.name.split(" ")[0] ?? "there";
  return <div className="page"><PageHeader eyebrow="Nivo Labs" title={`Good ${today >= "2020-01-01" ? "day" : "day"}, ${greeting}`} description={activeMine.length ? `You have ${activeMine.length} active ${activeMine.length === 1 ? "issue" : "issues"}${overdue.length ? `, ${overdue.length} overdue` : ""}.` : "Your queue is clear. A good moment to plan what’s next."} actions={<Button variant="primary" onClick={() => openCreateIssue()}><Plus size={14} />Create issue</Button>} />
    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"><div className="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-[var(--muted)]"><CircleDot size={12} />Active</div><span className="text-2xl font-medium tabular-nums tracking-tight">{activeMine.length}</span></div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"><div className="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-[var(--muted)]"><Flag size={12} className={overdue.length ? "text-[#ee8c96]" : ""} />Overdue</div><span className={cn("text-2xl font-medium tabular-nums tracking-tight", overdue.length && "text-[#ee8c96]")}>{overdue.length}</span></div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"><div className="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-[var(--muted)]"><CalendarDays size={12} />Due this week</div><span className="text-2xl font-medium tabular-nums tracking-tight">{dueSoon.length}</span></div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"><div className="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-[var(--muted)]"><CheckCircle2 size={12} />Completed</div><span className="text-2xl font-medium tabular-nums tracking-tight">{mine.length - activeMine.length}</span></div>
    </div>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]"><div className="min-w-0 space-y-6">
      {overdue.length > 0 && <section className="overflow-hidden rounded-xl border border-[#ee8c96]/25 bg-[#ee8c96]/[0.04]"><SectionHeading title="Needs attention" count={overdue.length} action={<ViewLink href="/my-issues">My issues</ViewLink>} /><div className="divide-y divide-[var(--border)]">{overdue.slice(0, 5).map((issue) => <MyIssueRow key={issue.id} issue={issue} data={data} overdue />)}</div></section>}
      <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]"><SectionHeading title="In motion" count={inProgress.length} eyebrow="My work" action={<ViewLink href="/my-issues">My issues</ViewLink>} />{inProgress.length ? <div className="divide-y divide-[var(--border)]">{inProgress.map((issue) => <MyIssueRow key={issue.id} issue={issue} data={data} overdue={isOverdue(issue, today)} />)}</div> : <EmptyState title="Nothing in progress" description="Pick up an issue from your queue or create something new." action={<Button size="sm" onClick={() => openCreateIssue({ assigneeId: data.currentUserId })}><Plus size={13} />Create issue</Button>} />}</section>
      {dueSoon.length > 0 && <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]"><SectionHeading title="Due this week" count={dueSoon.length} /><div className="divide-y divide-[var(--border)]">{dueSoon.slice(0, 6).map((issue) => <MyIssueRow key={issue.id} issue={issue} data={data} overdue={false} />)}</div></section>}
      <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]"><SectionHeading title="Active projects" count={projects.length} action={<ViewLink href="/projects">All projects</ViewLink>} />{projects.length ? <div className="grid gap-px bg-[var(--border)] sm:grid-cols-2">{projects.map((project) => { const progress = projectProgress(data, project.id); return <Link key={project.id} href={`/projects/${project.id}`} className="group bg-[var(--surface)] p-5 transition-colors hover:bg-[var(--raised)]"><div className="mb-3 flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><ProjectMark project={project} /><div className="min-w-0"><h3 className="truncate text-sm font-semibold group-hover:text-[var(--accent)]">{project.name}</h3><span className="text-[10px] text-[var(--muted)]">{data.teams[project.teamId]?.name}</span></div></div><ProjectHealth health={project.health} /></div><div className="mb-1.5 flex justify-between text-[11px]"><span className="text-[var(--muted)]">{progress.completed} of {progress.total} done</span><span className="tabular-nums">{progress.percent}%</span></div><Progress value={progress.percent} /></Link>; })}</div> : <EmptyState icon={<Layers3 size={22} />} title="No active projects" description="Create a project to start organizing your team’s work." action={<Link href="/projects" className="button button-primary button-sm">Open projects</Link>} />}</section>
    </div>
      <div className="min-w-0 space-y-6">
        {currentCycle && <section className="overflow-hidden rounded-xl border border-[var(--border)]"><SectionHeading title="Current cycle" eyebrow={data.teams[currentCycle.teamId]?.name} action={<ViewLink href={`/cycles/${currentCycle.id}`}>Open</ViewLink>} /><div className="bg-[var(--surface)] p-1"><CycleCard cycle={currentCycle} data={data} compact /></div></section>}
        <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]"><SectionHeading title="Recently completed" count={recentlyCompleted.length} eyebrow="My work" />{recentlyCompleted.length ? <div className="divide-y divide-[var(--border)]">{recentlyCompleted.map((issue) => <Link key={issue.id} href={`/issues/${issue.id}`} scroll={false} className="flex min-h-12 items-center gap-3 px-5 py-2.5 transition-colors hover:bg-[var(--raised)]"><StatusIcon status="done" /><div className="min-w-0 flex-1"><span className="block truncate text-[13px] text-[var(--muted)] line-through decoration-[var(--muted)]/40">{issue.title}</span><span className="text-[10px] text-[var(--muted)]">{issue.identifier} · {dateLabel((issue.completedAt ?? issue.updatedAt).slice(0, 10))}</span></div></Link>)}</div> : <p className="px-5 py-8 text-center text-xs text-[var(--muted)]">Completed work will appear here.</p>}</section>
        <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]"><SectionHeading title="Team activity" /><ActivityFeed activities={activity} data={data} limit={8} compact /></section>
        <section className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)]/50 p-5"><div className="flex items-start gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)]/10 text-[var(--accent)]"><Flame size={16} /></span><div className="min-w-0"><h3 className="text-sm font-semibold">Keep the momentum</h3><p className="mt-1 text-xs leading-5 text-[var(--muted)]">Press <kbd className="rounded border border-[var(--border)] bg-[var(--raised)] px-1 font-mono text-[10px]">⌘K</kbd> to search anything, or create an issue to capture what’s next.</p><div className="mt-3 flex gap-2"><Button size="sm" variant="primary" onClick={() => openCreateIssue()}><Plus size={13} />New issue</Button><Link href="/issues" className="button button-ghost button-sm">Browse issues<ArrowUpRight size={12} /></Link></div></div></div></section>
      </div></div>
  </div>;
}
