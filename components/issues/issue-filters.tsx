"use client";

import { Filter, Search, X } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import { EMPTY_FILTERS, PRIORITIES, STATUSES, type IssueFilters as Filters, type WorkspaceData } from "@/types/domain";
import { hasIssueFilters } from "@/lib/utils/view-url";

export function IssueFilters({ data, filters, onChange, scope }: {
  data: WorkspaceData; filters: Filters; onChange: (filters: Filters) => void;
  scope: { projectId?: string; cycleId?: string; assigneeId?: string };
}) {
  const sets = [
    { key: "statuses" as const, name: "Status", values: STATUSES },
    { key: "priorities" as const, name: "Priority", values: PRIORITIES },
    ...(!scope.assigneeId ? [{ key: "assignees" as const, name: "Assignee", values: [{ id: "none", name: "Unassigned" }, ...Object.values(data.users)] }] : []),
    ...(!scope.projectId ? [{ key: "projects" as const, name: "Project", values: [{ id: "none", name: "No project" }, ...Object.values(data.projects).filter((project) => !project.archivedAt)] }] : []),
    ...(!scope.cycleId ? [{ key: "cycles" as const, name: "Cycle", values: [{ id: "none", name: "No cycle" }, ...Object.values(data.cycles)] }] : []),
    { key: "labels" as const, name: "Label", values: Object.values(data.labels) },
  ];
  const chips: { key: string; name: string; remove: () => void }[] = sets.flatMap((set) => filters[set.key].map((id) => ({ key: `${set.key}:${id}`, name: `${set.name}: ${set.values.find((value) => value.id === id)?.name || id}`, remove: () => onChange({ ...filters, [set.key]: filters[set.key].filter((value) => value !== id) }) })));
  if (filters.due !== "all") chips.push({ key: "due", name: `Due: ${{ overdue: "Overdue", week: "Next 7 days", none: "No due date" }[filters.due]}`, remove: () => onChange({ ...filters, due: "all" }) });
  if (filters.estimate !== "all") chips.push({ key: "estimate", name: `Estimate: ${{ none: "Unestimated", small: "Small (0–3)", large: "Large (5+)" }[filters.estimate]}`, remove: () => onChange({ ...filters, estimate: "all" }) });
  if (filters.excludeDone) chips.push({ key: "excludeDone", name: "Hide completed", remove: () => onChange({ ...filters, excludeDone: false }) });
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-2"><details className="relative"><summary className="flex h-8 cursor-pointer list-none items-center gap-2 rounded-md border border-[var(--border)] px-2.5 text-xs text-[var(--muted)] hover:bg-[var(--raised)] [&::-webkit-details-marker]:hidden"><Filter size={13}/>Filter{chips.length > 0 && <span className="rounded bg-[var(--accent)]/15 px-1 text-[var(--accent)]">{chips.length}</span>}</summary><div className="absolute left-0 top-10 z-30 max-h-[65vh] w-[min(560px,calc(100vw-3rem))] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xl"><div className="mb-4 flex items-center justify-between"><h3 className="text-sm font-semibold">Filter issues</h3><Button size="sm" variant="ghost" onClick={() => onChange({ ...EMPTY_FILTERS })}>Reset filters</Button></div><div className="grid grid-cols-2 gap-5 sm:grid-cols-3">{sets.map((set) => <fieldset key={set.key} className="min-w-0"><legend className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">{set.name}</legend><div className="max-h-40 space-y-1.5 overflow-y-auto">{set.values.map((value) => <label key={value.id} className="flex cursor-pointer items-start gap-2 text-xs"><input type="checkbox" className="mt-0.5 accent-[var(--accent)]" checked={(filters[set.key] as string[]).includes(value.id)} onChange={(event) => onChange({ ...filters, [set.key]: event.target.checked ? [...filters[set.key], value.id] : filters[set.key].filter((id) => id !== value.id) })}/><span className="min-w-0 break-words">{value.name}</span></label>)}</div></fieldset>)}<label className="space-y-2 text-xs"><span className="text-[var(--muted)]">Due date</span><Select aria-label="Filter due date" value={filters.due} onChange={(event) => onChange({ ...filters, due: event.target.value as Filters["due"] })}><option value="all">Any date</option><option value="overdue">Overdue</option><option value="week">Next 7 days</option><option value="none">No due date</option></Select></label><label className="space-y-2 text-xs"><span className="text-[var(--muted)]">Estimate</span><Select aria-label="Filter estimate" value={filters.estimate} onChange={(event) => onChange({ ...filters, estimate: event.target.value as Filters["estimate"] })}><option value="all">Any estimate</option><option value="none">Unestimated</option><option value="small">Small (0–3)</option><option value="large">Large (5+)</option></Select></label><label className="flex items-center gap-2 self-end py-2 text-xs"><input type="checkbox" className="accent-[var(--accent)]" checked={filters.excludeDone} onChange={(event) => onChange({ ...filters, excludeDone: event.target.checked })}/>Hide completed</label></div></div></details>
      <div className="relative min-w-36 max-w-64 flex-1"><Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)]"/><Input aria-label="Search issues in this view" placeholder="Search issues…" value={filters.text} onChange={(event) => onChange({ ...filters, text: event.target.value })} className="!h-8 !border-transparent !bg-transparent !pl-8 !text-xs"/></div>
    </div>
    {(chips.length > 0 || filters.text) && <div className="flex flex-wrap items-center gap-1.5">{filters.text && <FilterChip name={`Search: ${filters.text}`} remove={() => onChange({ ...filters, text: "" })}/>} {chips.map((chip) => <FilterChip key={chip.key} name={chip.name} remove={chip.remove}/>)}{hasIssueFilters(filters) && <button className="px-2 text-[10px] text-[var(--muted)] hover:text-[var(--text)]" onClick={() => onChange({ ...EMPTY_FILTERS })}>Clear all</button>}</div>}
  </div>;
}

function FilterChip({ name, remove }: { name: string; remove: () => void }) {
  return <button onClick={remove} aria-label={`Remove ${name} filter`} className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[10px] text-[var(--muted)] hover:border-[var(--accent)]"><span className="truncate">{name}</span><X size={10} className="shrink-0"/></button>;
}
