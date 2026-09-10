"use client";

import { useState } from "react";
import { Plus, Repeat2, Search } from "lucide-react";
import { Button, EmptyState, Input, PageHeader, Select, cn } from "@/components/ui";
import { useWorkspace } from "@/stores/workspace";
import { CycleCard, cyclePhase, type CyclePhase } from "./cycle-shared";
import { CycleFormDialog } from "./cycle-form";

const PHASES: { id: "all" | CyclePhase; label: string }[] = [{ id: "all", label: "All cycles" }, { id: "current", label: "Current" }, { id: "upcoming", label: "Upcoming" }, { id: "previous", label: "Previous" }];
const GROUPS: { id: CyclePhase; title: string; subtitle: string }[] = [{ id: "current", title: "In motion", subtitle: "A shared focus for right now" }, { id: "upcoming", title: "Up next", subtitle: "Plan what comes after" }, { id: "previous", title: "Previous cycles", subtitle: "Progress worth looking back on" }];

export function CyclesPage() {
  const { data } = useWorkspace();
  const [team, setTeam] = useState("engineering");
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState<"all" | CyclePhase>("all");
  const [create, setCreate] = useState(false);
  if (!data) return null;
  const cycles = Object.values(data.cycles).filter((cycle) => (team === "all" || cycle.teamId === team) && `${cycle.name} ${cycle.goal}`.toLowerCase().includes(query.trim().toLowerCase()));
  const visible = cycles.filter((cycle) => phase === "all" || cyclePhase(cycle, data.workspace.seedAnchorDate) === phase);
  function reset() { setTeam("all"); setQuery(""); setPhase("all"); }
  return <div className="page"><PageHeader eyebrow="PLAN & DELIVER" title="Cycles" description="Find your rhythm. Focus on what moves you forward." actions={<Button variant="primary" onClick={() => setCreate(true)}><Plus size={15} />New cycle</Button>} /><div className="mb-5 flex flex-wrap items-center gap-2"><Select aria-label="Filter cycles by team" value={team} onChange={(event) => setTeam(event.target.value)}><option value="all">All teams</option>{Object.values(data.teams).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select><div className="search-input min-w-44 flex-1 sm:max-w-64"><Search size={14} /><Input aria-label="Search cycles" placeholder="Search cycles…" value={query} onChange={(event) => setQuery(event.target.value)} /></div><span className="ml-auto text-xs text-[var(--muted)]">{cycles.length} cycle{cycles.length === 1 ? "" : "s"}</span></div><div className="mb-7 flex gap-5 overflow-x-auto border-b border-[var(--border)]" role="group" aria-label="Cycle phase">{PHASES.map((item) => <button key={item.id} aria-pressed={phase === item.id} onClick={() => setPhase(item.id)} className={cn("flex shrink-0 items-center gap-2 border-b-2 px-0.5 pb-3 text-xs transition-colors", phase === item.id ? "border-[var(--accent)] text-[var(--text)]" : "border-transparent text-[var(--muted)] hover:text-[var(--text)]")}>{item.label}<span className="rounded bg-[var(--raised)] px-1.5 py-0.5 text-[10px] tabular-nums text-[var(--muted)]">{cycles.filter((cycle) => item.id === "all" || cyclePhase(cycle, data.workspace.seedAnchorDate) === item.id).length}</span></button>)}</div>{!visible.length ? <EmptyState icon={<Repeat2 size={27} />} title="A little space to plan ahead" description={query || phase !== "all" ? "No cycles match these filters. Try another search or see all cycles." : "There are no cycles for this team yet. Create one and give your work a clear goal."} action={<div className="flex gap-2"><Button variant="secondary" onClick={reset}>Show all cycles</Button><Button variant="primary" onClick={() => setCreate(true)}>Create cycle</Button></div>} /> : <div className="space-y-8">{GROUPS.map((group) => {
    const entries = visible.filter((cycle) => cyclePhase(cycle, data.workspace.seedAnchorDate) === group.id).sort((a, b) => group.id === "previous" ? b.startDate.localeCompare(a.startDate) : a.startDate.localeCompare(b.startDate));
    if (!entries.length) return null;
    return <section key={group.id}><div className="mb-3 flex items-baseline justify-between gap-3"><h2 className="flex items-center gap-2 text-xs font-medium"><span className={cn("h-1.5 w-1.5 rounded-full", group.id === "current" ? "bg-[var(--accent)]" : group.id === "upcoming" ? "bg-[#eab76b]" : "bg-[var(--muted)]")} />{group.title}</h2><p className="hidden text-[10px] text-[var(--muted)] sm:block">{group.subtitle}</p></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{entries.map((cycle) => <CycleCard key={cycle.id} cycle={cycle} data={data} />)}</div></section>;
  })}</div>}<CycleFormDialog open={create} onOpenChange={setCreate} defaultTeamId={team === "all" ? undefined : team} /></div>;
}
