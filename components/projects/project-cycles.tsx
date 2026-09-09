"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Repeat2 } from "lucide-react";
import { Button, EmptyState, Select } from "@/components/ui";
import { useWorkspace } from "@/stores/workspace";
import { CycleCard, cyclePhase, type CyclePhase } from "@/components/cycles/cycle-shared";
import { CycleFormDialog } from "@/components/cycles/cycle-form";

const GROUPS: { phase: CyclePhase; title: string; description: string }[] = [
  { phase: "current", title: "Current cycle", description: "The team’s focus right now" },
  { phase: "upcoming", title: "Coming up", description: "Room for the next priorities" },
  { phase: "previous", title: "Previous cycles", description: "A record of the work behind you" },
];

export function ProjectCycles({ projectId }: { projectId: string }) {
  const { data } = useWorkspace();
  const [create, setCreate] = useState(false);
  const [scope, setScope] = useState("team");
  if (!data) return null;
  const project = data.projects[projectId];
  if (!project) return <EmptyState title="Project not found" action={<Link href="/projects" className="button">All projects</Link>} />;
  const projectCycleIds = new Set(Object.values(data.issues).filter((issue) => issue.projectId === projectId && !issue.deletedAt).map((issue) => issue.cycleId));
  const cycles = Object.values(data.cycles).filter((cycle) => cycle.teamId === project.teamId && (scope === "team" || projectCycleIds.has(cycle.id))).sort((a, b) => b.startDate.localeCompare(a.startDate));
  return <div className="page !pt-6"><div className="mb-7 flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-sm font-medium">Build a little momentum</h2><p className="mt-1.5 max-w-xl text-xs leading-5 text-[var(--muted)]">Cycles belong to {data.teams[project.teamId]?.name}. Plan this project’s work alongside the team’s other priorities.</p></div><div className="flex items-center gap-2"><Select aria-label="Project cycle scope" value={scope} onChange={(event) => setScope(event.target.value)}><option value="team">All team cycles</option><option value="project">With project issues</option></Select><Button variant="primary" size="sm" onClick={() => setCreate(true)}><Plus size={14} />New cycle</Button></div></div>{!cycles.length ? <EmptyState icon={<Repeat2 size={26} />} title={scope === "project" ? "This project isn’t in a cycle yet" : "Find your team’s rhythm"} description={scope === "project" ? "Open a team cycle and add this project’s issues to get started." : "Create a cycle to give your team a focused goal and a clear finish line."} action={<Button variant="secondary" onClick={scope === "project" ? () => setScope("team") : () => setCreate(true)}>{scope === "project" ? "Show team cycles" : "Create cycle"}</Button>} /> : <div className="space-y-8">{GROUPS.map((group) => {
    const entries = cycles.filter((cycle) => cyclePhase(cycle, data.workspace.seedAnchorDate) === group.phase).sort((a, b) => group.phase === "upcoming" ? a.startDate.localeCompare(b.startDate) : b.startDate.localeCompare(a.startDate));
    if (!entries.length) return null;
    return <section key={group.phase}><div className="mb-3 flex items-baseline gap-2"><h3 className="text-xs font-medium">{group.title}</h3><span className="text-[10px] text-[var(--muted)]">{entries.length}</span><span className="ml-auto hidden text-[10px] text-[var(--muted)] sm:inline">{group.description}</span></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{entries.map((cycle) => <CycleCard key={cycle.id} cycle={cycle} data={data} projectId={projectId} />)}</div></section>;
  })}</div>}<CycleFormDialog open={create} onOpenChange={setCreate} defaultTeamId={project.teamId} /></div>;
}
