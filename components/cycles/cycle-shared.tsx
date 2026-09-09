"use client";

import Link from "next/link";
import { ArrowUpRight, CalendarDays, CheckCircle2, CircleDashed, LockKeyhole, Repeat2 } from "lucide-react";
import { Avatar, Badge, Progress, cn } from "@/components/ui";
import { cycleProgress, dateLabel, selectIssues } from "@/lib/domain/selectors";
import type { Cycle, WorkspaceData } from "@/types/domain";

export type CyclePhase = "current" | "upcoming" | "previous";

export function cyclePhase(cycle: Cycle, today: string): CyclePhase {
  if (cycle.closedAt || cycle.endDate < today) return "previous";
  return cycle.startDate > today ? "upcoming" : "current";
}

export function CyclePhaseBadge({ cycle, today }: { cycle: Cycle; today: string }) {
  const phase = cyclePhase(cycle, today);
  return cycle.closedAt ? <Badge color="#8b92a1"><LockKeyhole size={10} />Completed</Badge> : phase === "current" ? <Badge color="#aaa0f5"><span className="h-1.5 w-1.5 rounded-full bg-current" />Current</Badge> : phase === "upcoming" ? <Badge><CircleDashed size={11} />Upcoming</Badge> : <Badge color="#eab76b">Awaiting completion</Badge>;
}

export function CycleCard({ cycle, data, projectId, compact = false }: { cycle: Cycle; data: WorkspaceData; projectId?: string; compact?: boolean }) {
  const progress = cycleProgress(data, cycle.id);
  const issues = selectIssues(data, {}, { cycleId: cycle.id });
  const members = Array.from(new Set(issues.map((issue) => issue.assigneeId).filter((id): id is string => !!id)));
  const phase = cyclePhase(cycle, data.workspace.seedAnchorDate);
  const days = Math.max(0, Math.ceil((Date.parse(`${cycle.endDate}T00:00:00Z`) - Date.parse(`${data.workspace.seedAnchorDate}T00:00:00Z`)) / 86400000));
  const projectCount = projectId ? issues.filter((issue) => issue.projectId === projectId).length : null;
  return <Link href={`/cycles/${cycle.id}`} className={cn("group flex h-full flex-col rounded-xl border bg-[var(--surface)] transition-colors hover:border-[var(--accent)]/50 hover:bg-[var(--raised)]", phase === "current" ? "border-[var(--accent)]/25" : "border-[var(--border)]")}><div className={compact ? "p-4" : "p-5"}><div className="mb-4 flex items-center justify-between gap-2"><span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", phase === "current" ? "bg-[var(--accent)]/10 text-[var(--accent)]" : "bg-[var(--raised)] text-[var(--muted)]")}>{cycle.closedAt ? <CheckCircle2 size={17} /> : <Repeat2 size={17} />}</span><CyclePhaseBadge cycle={cycle} today={data.workspace.seedAnchorDate} /></div><div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">{cycle.name}</h3><ArrowUpRight size={14} className="text-[var(--muted)] group-hover:text-[var(--accent)]" /></div><div className="mt-2 flex items-center gap-1.5 text-[11px] text-[var(--muted)]"><CalendarDays size={12} />{dateLabel(cycle.startDate)} – {dateLabel(cycle.endDate)}{phase === "current" && <span className="ml-auto text-[var(--accent)]">{days === 0 ? "Ends today" : `${days}d left`}</span>}</div>{!compact && <p className="mt-3 line-clamp-2 min-h-10 text-xs leading-5 text-[var(--muted)]">{cycle.goal || "No goal set for this cycle yet."}</p>}<div className="mb-2 mt-5 flex justify-between text-[11px]"><span className="text-[var(--muted)]">{progress.completed} of {progress.total} issues</span><span className="tabular-nums">{progress.percent}%</span></div><Progress value={progress.percent} /><div className="mt-2 flex justify-between text-[10px] text-[var(--muted)]"><span>{progress.points} / {progress.totalPoints} points</span>{cycle.closedAt && <span>Completion snapshot</span>}{projectCount !== null && !cycle.closedAt && <span>{projectCount} in this project</span>}</div></div><div className={cn("mt-auto flex items-center justify-between border-t border-[var(--border)]", compact ? "px-4 py-2.5" : "px-5 py-3")}><span className="text-[11px] text-[var(--muted)]">{data.teams[cycle.teamId]?.name}</span><div className="flex -space-x-1.5">{members.slice(0, 4).map((id) => <Avatar key={id} user={data.users[id]} size="sm" />)}{members.length > 4 && <span className="flex h-6 w-6 items-center justify-center rounded-full border border-[var(--surface)] bg-[var(--raised)] text-[9px] text-[var(--muted)]">+{members.length - 4}</span>}{!members.length && <span className="text-[10px] text-[var(--muted)]">No assignees yet</span>}</div></div></Link>;
}
