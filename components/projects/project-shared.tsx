"use client";

import Link from "next/link";
import { ArrowUpRight, Box, Code2, Layers3, Rocket, Smartphone, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { Avatar, Badge, PriorityIcon, StatusIcon, cn } from "@/components/ui";
import { dateLabel } from "@/lib/domain/selectors";
import type { Activity, Health, Issue, Project, ProjectStatus, WorkspaceData } from "@/types/domain";

export const PROJECT_STATUSES: { value: ProjectStatus; label: string; color: string }[] = [
  { value: "planned", label: "Planned", color: "#8b92a1" },
  { value: "in_progress", label: "In progress", color: "#aaa0f5" },
  { value: "paused", label: "Paused", color: "#eab76b" },
  { value: "completed", label: "Completed", color: "#76bea6" },
];

export const PROJECT_HEALTH: { value: Health; label: string; color: string }[] = [
  { value: "on_track", label: "On track", color: "#76bea6" },
  { value: "at_risk", label: "At risk", color: "#eab76b" },
  { value: "off_track", label: "Off track", color: "#ee8c96" },
];

export const PROJECT_ICONS = [
  { value: "layers", label: "Layers", icon: Layers3 },
  { value: "rocket", label: "Rocket", icon: Rocket },
  { value: "smartphone", label: "Mobile", icon: Smartphone },
  { value: "code", label: "Code", icon: Code2 },
  { value: "sparkles", label: "Sparkles", icon: Sparkles },
  { value: "box", label: "Box", icon: Box },
];

export function ProjectMark({ project, large = false }: { project: Pick<Project, "icon" | "color">; large?: boolean }) {
  const Icon = PROJECT_ICONS.find((item) => item.value === project.icon)?.icon ?? Layers3;
  return <span className={cn("inline-flex shrink-0 items-center justify-center rounded-xl border", large ? "h-12 w-12" : "h-9 w-9")} style={{ color: project.color, background: `color-mix(in srgb, ${project.color} 10%, transparent)`, borderColor: `color-mix(in srgb, ${project.color} 20%, transparent)` }}><Icon size={large ? 23 : 18} strokeWidth={1.7} /></span>;
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const item = PROJECT_STATUSES.find((entry) => entry.value === status)!;
  return <Badge color={item.color}><span className="h-1.5 w-1.5 rounded-full" style={{ background: item.color }} />{item.label}</Badge>;
}

export function ProjectHealth({ health }: { health: Health }) {
  const item = PROJECT_HEALTH.find((entry) => entry.value === health)!;
  return <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs" style={{ color: item.color }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: item.color }} />{item.label}</span>;
}

export function SectionHeading({ title, count, action, eyebrow }: { title: string; count?: number; action?: ReactNode; eyebrow?: string }) {
  return <div className="flex min-h-12 items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3"><div>{eyebrow && <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--muted)]">{eyebrow}</div>}<h2 className="flex items-center gap-2 text-sm font-medium">{title}{count !== undefined && <span className="rounded bg-[var(--raised)] px-1.5 py-0.5 text-[10px] tabular-nums text-[var(--muted)]">{count}</span>}</h2></div>{action}</div>;
}

export function ViewLink({ href, children = "View all" }: { href: string; children?: ReactNode }) {
  return <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-xs text-[var(--muted)] transition-colors hover:text-[var(--text)]">{children}<ArrowUpRight size={13} /></Link>;
}

export function IssuePreviewList({ issues, data, empty = "No issues to show. You’re all caught up.", showProject = false }: { issues: Issue[]; data: WorkspaceData; empty?: string; showProject?: boolean }) {
  if (!issues.length) return <p className="px-5 py-10 text-center text-xs text-[var(--muted)]">{empty}</p>;
  return <div className="divide-y divide-[var(--border)]">{issues.map((issue) => <Link key={issue.id} href={`/issues/${issue.id}`} scroll={false} className="group flex min-h-14 items-center gap-3 px-5 py-3 transition-colors hover:bg-[var(--raised)]"><StatusIcon status={issue.status} /><div className="min-w-0 flex-1"><div className="flex min-w-0 items-center gap-2"><span className="hidden shrink-0 text-[11px] tabular-nums text-[var(--muted)] sm:inline">{issue.identifier}</span><span className="truncate text-[13px] group-hover:text-[var(--accent)]">{issue.title}</span></div>{showProject && <div className="mt-1 text-[10px] text-[var(--muted)]">{issue.projectId ? data.projects[issue.projectId]?.name : data.teams[issue.teamId]?.name}</div>}</div><span className="hidden shrink-0 text-[11px] text-[var(--muted)] md:block">{issue.dueDate ? dateLabel(issue.dueDate) : ""}</span><PriorityIcon priority={issue.priority} /><Avatar user={issue.assigneeId ? data.users[issue.assigneeId] : null} size="sm" /></Link>)}</div>;
}

export function projectActivities(data: WorkspaceData, projectId: string) {
  return Object.values(data.activities).filter((activity) => activity.projectId === projectId || (activity.issueId && data.issues[activity.issueId]?.projectId === projectId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
}

export function ActivityFeed({ activities, data, limit = 10, compact = false }: { activities: Activity[]; data: WorkspaceData; limit?: number; compact?: boolean }) {
  if (!activities.length) return <p className="px-5 py-10 text-center text-xs text-[var(--muted)]">Updates will appear here as your team makes progress.</p>;
  return <ol className="divide-y divide-[var(--border)]">{activities.slice(0, limit).map((activity) => {
    const actor = data.users[activity.actorId];
    const issue = activity.issueId ? data.issues[activity.issueId] : null;
    const project = activity.projectId ? data.projects[activity.projectId] : null;
    const cycle = activity.cycleId ? data.cycles[activity.cycleId] : null;
    const href = issue && !issue.deletedAt ? `/issues/${issue.id}` : project ? `/projects/${project.id}` : cycle ? `/cycles/${cycle.id}` : null;
    return <li key={activity.id} className={cn("flex gap-3 px-5", compact ? "py-3" : "py-4")}><Avatar user={actor} size="sm" /><div className="min-w-0 flex-1"><div className="text-xs leading-relaxed"><span className="font-medium">{actor?.name ?? "Team member"}</span><span className="text-[var(--muted)]"> {activity.message}</span></div>{href && <Link href={href} scroll={false} className="mt-1 block truncate text-[11px] text-[var(--muted)] hover:text-[var(--accent)]">{issue ? `${issue.identifier} · ${issue.title}` : project?.name ?? cycle?.name}</Link>}<time dateTime={activity.createdAt} className="mt-1.5 block text-[10px] text-[var(--muted)]">{dateLabel(activity.createdAt.slice(0, 10))} · {new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(new Date(activity.createdAt))} UTC</time></div></li>;
  })}</ol>;
}
