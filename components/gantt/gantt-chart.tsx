"use client";

import Link from "next/link";
import { useMemo } from "react";
import { EmptyState, StatusIcon, cn } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import { isIssueBlocked } from "@/lib/domain/selectors";
import type { Issue, WorkspaceData } from "@/types/domain";

const DAY = 86400000;
const ROW_H = 36;
const LABEL_W = 236;
const HEADER_H = 30;

const parseDay = (value: string) => Date.parse(`${value}T00:00:00Z`);
const toDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const monthDay = (ms: number) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(ms));

interface GanttRow {
  issue: Issue;
  plannedStart: number | null;
  plannedEnd: number | null;
  actualStart: number | null;
  actualEnd: number | null;
}

export function GanttChart({ issues, data }: { issues: Issue[]; data: WorkspaceData }) {
  const { t } = useI18n();
  const today = parseDay(new Date().toISOString().slice(0, 10));

  const { rows, unscheduled } = useMemo(() => {
    const list: GanttRow[] = [];
    let skipped = 0;
    for (const issue of issues) {
      if (issue.deletedAt) continue;
      const plannedStart = issue.startDate ? parseDay(issue.startDate) : null;
      const plannedEnd = issue.dueDate ? parseDay(issue.dueDate) : null;
      const actualStart = issue.startedAt ? parseDay(issue.startedAt.slice(0, 10)) : null;
      const actualEnd = issue.actualEndDate ? parseDay(issue.actualEndDate) : issue.completedAt ? parseDay(issue.completedAt.slice(0, 10)) : null;
      if (plannedStart === null && plannedEnd === null && actualStart === null) { skipped++; continue; }
      list.push({ issue, plannedStart, plannedEnd: plannedEnd ?? plannedStart, actualStart, actualEnd });
    }
    list.sort((a, b) => (a.plannedStart ?? a.actualStart ?? a.plannedEnd ?? 0) - (b.plannedStart ?? b.actualStart ?? b.plannedEnd ?? 0) || a.issue.identifier.localeCompare(b.issue.identifier));
    return { rows: list.slice(0, 80), unscheduled: skipped + Math.max(0, list.length - 80) };
  }, [issues]);

  const range = useMemo(() => {
    if (!rows.length) return null;
    let min = today, max = today;
    for (const row of rows) {
      for (const value of [row.plannedStart, row.plannedEnd, row.actualStart, row.actualEnd]) {
        if (value === null) continue;
        min = Math.min(min, value);
        max = Math.max(max, value);
      }
    }
    return { min: min - 4 * DAY, max: max + 6 * DAY };
  }, [rows, today]);

  const rowIndex = useMemo(() => new Map(rows.map((row, index) => [row.issue.id, index])), [rows]);
  const edges = useMemo(() => Object.values(data.issueLinks).filter((link) => link.type === "blocks" && rowIndex.has(link.sourceIssueId) && rowIndex.has(link.targetIssueId)), [data.issueLinks, rowIndex]);

  if (!range) return <EmptyState title={t("gantt.empty")} description={t("gantt.emptyHint")}/>;

  const totalDays = Math.max(1, Math.round((range.max - range.min) / DAY));
  const pxPerDay = Math.max(7, Math.min(30, 1500 / totalDays));
  const width = totalDays * pxPerDay;
  const x = (ms: number) => (ms - range.min) / DAY * pxPerDay;
  const step = totalDays <= 35 ? 7 : totalDays <= 105 ? 14 : 35;
  const firstTick = Math.ceil(range.min / (step * DAY)) * step * DAY;
  const ticks: number[] = [];
  for (let ms = firstTick; ms <= range.max; ms += step * DAY) ticks.push(ms);

  const barX = (row: GanttRow) => {
    const start = row.plannedStart ?? row.plannedEnd!;
    return { left: x(start), width: Math.max(4, x(row.plannedEnd! + DAY) - x(start)) };
  };
  const actualBarX = (row: GanttRow) => {
    const end = row.actualEnd ?? today;
    return { left: x(row.actualStart!), width: Math.max(4, x(end + DAY) - x(row.actualStart!)) };
  };
  const anchorX = (row: GanttRow, side: "start" | "end") => {
    if (side === "end") {
      const end = row.actualEnd ?? row.plannedEnd ?? row.actualStart ?? today;
      return x(end + DAY);
    }
    const start = row.plannedStart ?? row.actualStart ?? row.plannedEnd ?? today;
    return x(start);
  };

  return <div>
    <div className="flex items-center gap-4 px-1 pb-3 text-[10px] text-[var(--muted)]">
      <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-sm border border-[var(--accent)] bg-[var(--accent)]/20"/>{t("gantt.planned")}</span>
      <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-sm bg-[var(--accent)]"/>{t("gantt.actual")}</span>
      <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-sm border border-red-400/60 bg-red-400/20"/>{t("gantt.blocked")}</span>
      {unscheduled > 0 && <span className="ml-auto">{t("gantt.unscheduled", { count: unscheduled })}</span>}
    </div>
    <div className="max-w-full overflow-x-auto rounded-lg border border-[var(--border)]" tabIndex={0} role="region" aria-label={t("gantt.title")}>
      <div className="relative" style={{ width: LABEL_W + width }}>
        <div className="flex border-b border-[var(--border)]" style={{ height: HEADER_H }}>
          <div className="sticky left-0 z-10 shrink-0 border-r border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]" style={{ width: LABEL_W }}>{t("gantt.issue")}</div>
          <div className="relative flex-1">{ticks.map((ms) => <span key={ms} className="absolute top-1.5 border-l border-[var(--border)]/70 pl-1 text-[9px] text-[var(--muted)]" style={{ left: x(ms) }}>{monthDay(ms)}</span>)}</div>
        </div>
        <div className="relative">
          <div className="absolute inset-y-0 right-0" style={{ left: LABEL_W }}>
            {ticks.map((ms) => <span key={ms} className="absolute inset-y-0 border-l border-[var(--border)]/40" style={{ left: x(ms) }}/>)}
            {today >= range.min && today <= range.max && <span className="absolute inset-y-0 z-[5] w-px bg-red-500/70" style={{ left: x(today) }}><span className="absolute -top-0 left-1 text-[8px] font-medium text-red-400">{t("gantt.today")}</span></span>}
          </div>
          <ul>
            {rows.map((row) => {
              const blocked = isIssueBlocked(data, row.issue);
              const planned = row.plannedStart !== null || row.plannedEnd !== null;
              const schedule = { percent: row.issue.status === "done" ? 100 : row.issue.status === "in_review" ? 75 : row.issue.status === "in_progress" ? 50 : 0 };
              return <li key={row.issue.id} className={cn("relative flex items-center border-b border-[var(--border)]/50 hover:bg-[var(--raised)]/40", blocked && "bg-red-500/[.03]")} style={{ height: ROW_H }}>
                <div className="sticky left-0 z-10 flex h-full shrink-0 items-center gap-2 border-r border-[var(--border)] bg-[var(--bg)] px-3" style={{ width: LABEL_W }}>
                  <StatusIcon status={row.issue.status}/>
                  <Link href={`/issues/${row.issue.id}`} className="flex min-w-0 flex-1 items-baseline gap-2 rounded outline-offset-2">
                    <span className="shrink-0 font-mono text-[9px] text-[var(--muted)]">{row.issue.identifier}</span>
                    <span className="truncate text-[11px]">{row.issue.title}</span>
                  </Link>
                </div>
                <div className="relative h-full flex-1">
                  {planned && <span className={cn("absolute top-2 h-2.5 rounded-sm border", blocked ? "border-red-400/70 bg-red-400/15" : "border-[var(--accent)]/70 bg-[var(--accent)]/15")} style={{ left: barX(row).left, width: barX(row).width }} title={`${toDay(row.plannedStart ?? row.plannedEnd!)} → ${toDay(row.plannedEnd!)}`}/>}
                  {row.actualStart !== null && (() => { const bar = actualBarX(row); return <span className="absolute bottom-2 h-2.5 overflow-hidden rounded-sm bg-[var(--accent)]/25" style={{ left: bar.left, width: bar.width }} title={`${toDay(row.actualStart!)} → ${row.actualEnd !== null ? toDay(row.actualEnd) : t("gantt.ongoing")}`}><span className="block h-full bg-[var(--accent)]" style={{ width: `${schedule.percent}%` }}/></span>; })()}
                </div>
              </li>;
            })}
          </ul>
          <svg className="pointer-events-none absolute inset-y-0 right-0 z-[6]" style={{ left: LABEL_W, width }} aria-hidden="true">
            <defs><marker id="gantt-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6" fill="none" stroke="var(--muted)" strokeWidth="1.2"/></marker></defs>
            {edges.map((link) => {
              const source = rows[rowIndex.get(link.sourceIssueId)!];
              const target = rows[rowIndex.get(link.targetIssueId)!];
              const x1 = anchorX(source, "end"), y1 = rowIndex.get(link.sourceIssueId)! * ROW_H + ROW_H / 2;
              const x2 = anchorX(target, "start"), y2 = rowIndex.get(link.targetIssueId)! * ROW_H + ROW_H / 2;
              const elbow = Math.min(x1 + 14, x2 - 6);
              return <path key={link.id} d={`M ${x1} ${y1} H ${elbow} V ${y2} H ${x2 - 3}`} fill="none" stroke="var(--muted)" strokeWidth="1.1" strokeDasharray="3 2" markerEnd="url(#gantt-arrow)"/>;
            })}
          </svg>
        </div>
      </div>
    </div>
  </div>;
}
