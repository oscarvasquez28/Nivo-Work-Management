"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Command } from "cmdk";
import { motion, useReducedMotion } from "motion/react";
import { ArrowDown, ArrowUp, CircleUserRound, CornerDownLeft, House, Layers3, ListFilter, Moon, PanelLeftClose, PanelLeftOpen, Plus, Search, Sun, Tag, Timer } from "lucide-react";
import { Avatar, StatusIcon } from "@/components/ui";
import { useUI } from "@/components/providers/ui-provider";
import { useWorkspace } from "@/stores/workspace";

type SearchResult = { id: string; href: string; title: string; context: string; keywords: string; kind: "Issues" | "Projects" | "Cycles" | "Members" | "Labels"; icon: ReactNode };
type PaletteAction = { id: string; title: string; keywords: string; icon: ReactNode; run: () => void; group: "Create" | "Navigate" | "Preferences" };
const recentKey = "nivo:recent-entities";
const groups: SearchResult["kind"][] = ["Issues", "Projects", "Cycles", "Members", "Labels"];

function matches(query: string, text: string) {
  const haystack = text.toLocaleLowerCase();
  return query.toLocaleLowerCase().split(/\s+/).filter(Boolean).every((word) => haystack.includes(word));
}

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data, ready } = useWorkspace();
  const { openCreateIssue, openCreateProject, openCreateCycle, theme, toggleTheme, sidebarCollapsed, toggleSidebar } = useUI();
  const reducedMotion = useReducedMotion();
  const [query, setQuery] = useState("");
  const [recentPaths, setRecentPaths] = useState<string[]>([]);
  const returnFocus = useRef<HTMLElement | null>(null);
  const transitioning = useRef(false);

  useEffect(() => {
    let stored: string[] = [];
    try {
      const value: unknown = JSON.parse(localStorage.getItem(recentKey) ?? "[]");
      if (Array.isArray(value)) stored = value.filter((item): item is string => typeof item === "string" && /^\/(issues|projects|cycles)\/[^/?#]+$/.test(item)).slice(0, 8);
    } catch {}
    const entityPath = pathname.match(/^\/(issues|projects|cycles)\/[^/?#]+/)?.[0];
    const next = entityPath ? [entityPath, ...stored.filter((path) => path !== entityPath)].slice(0, 8) : stored;
    requestAnimationFrame(() => setRecentPaths(next));
    if (entityPath) { try { localStorage.setItem(recentKey, JSON.stringify(next)); } catch {} }
  }, [pathname]);

  const results = useMemo<SearchResult[]>(() => {
    if (!data) return [];
    return [
      ...Object.values(data.issues).filter((issue) => !issue.deletedAt).map((issue): SearchResult => ({ id: `issue:${issue.id}`, href: `/issues/${encodeURIComponent(issue.id)}`, title: issue.title, context: `${issue.identifier}${issue.projectId && data.projects[issue.projectId] ? ` · ${data.projects[issue.projectId].name}` : ` · ${data.teams[issue.teamId]?.name ?? "Workspace"}`}`, keywords: `${issue.identifier} ${issue.title} ${issue.description} ${issue.projectId ? data.projects[issue.projectId]?.name ?? "" : ""}`, kind: "Issues", icon: <StatusIcon status={issue.status} /> })),
      ...Object.values(data.projects).filter((project) => !project.archivedAt).map((project): SearchResult => ({ id: `project:${project.id}`, href: `/projects/${encodeURIComponent(project.id)}`, title: project.name, context: `${data.teams[project.teamId]?.name ?? "Workspace"} · Project`, keywords: `${project.name} ${project.description} project`, kind: "Projects", icon: <Layers3 size={16} style={{ color: project.color }} /> })),
      ...Object.values(data.cycles).map((cycle): SearchResult => ({ id: `cycle:${cycle.id}`, href: `/cycles/${encodeURIComponent(cycle.id)}`, title: cycle.name, context: `${data.teams[cycle.teamId]?.name ?? "Workspace"} · ${cycle.closedAt ? "Completed cycle" : `${cycle.startDate} – ${cycle.endDate}`}`, keywords: `${cycle.name} ${cycle.goal} ${data.teams[cycle.teamId]?.name ?? ""} cycle`, kind: "Cycles", icon: <Timer size={16} /> })),
      ...Object.values(data.users).map((user): SearchResult => ({ id: `member:${user.id}`, href: `/issues?assignee=${encodeURIComponent(user.id)}`, title: user.name, context: `${user.role} · View assigned issues`, keywords: `${user.name} ${user.role} member assignee`, kind: "Members", icon: <Avatar user={user} size="sm" /> })),
      ...Object.values(data.labels).map((label): SearchResult => ({ id: `label:${label.id}`, href: `/issues?label=${encodeURIComponent(label.id)}`, title: label.name, context: "View issues with this label", keywords: `${label.name} label tag`, kind: "Labels", icon: <Tag size={15} style={{ color: label.color }} /> })),
    ];
  }, [data]);

  function run(action: () => void) {
    transitioning.current = true;
    onOpenChange(false);
    requestAnimationFrame(action);
  }
  function navigate(href: string) { run(() => router.push(href)); }

  const actions: PaletteAction[] = [
    ...(data && ready ? [
      { id: "create-issue", title: "Create issue", keywords: "new task ticket", icon: <Plus size={16} />, run: () => openCreateIssue(), group: "Create" as const },
      { id: "create-project", title: "Create project", keywords: "new project", icon: <Layers3 size={16} />, run: openCreateProject, group: "Create" as const },
      { id: "create-cycle", title: "Create cycle", keywords: "new sprint iteration", icon: <Timer size={16} />, run: openCreateCycle, group: "Create" as const },
    ] : []),
    { id: "home", title: "Go to Home", keywords: "workspace dashboard overview", icon: <House size={16} />, run: () => router.push("/"), group: "Navigate" },
    { id: "my-issues", title: "Go to My issues", keywords: "assigned to me tasks", icon: <CircleUserRound size={16} />, run: () => router.push("/my-issues"), group: "Navigate" },
    { id: "issues", title: "Go to Issues", keywords: "all tasks work board list", icon: <ListFilter size={16} />, run: () => router.push("/issues"), group: "Navigate" },
    { id: "projects", title: "Go to Projects", keywords: "project directory", icon: <Layers3 size={16} />, run: () => router.push("/projects"), group: "Navigate" },
    { id: "cycles", title: "Go to Cycles", keywords: "sprints iterations", icon: <Timer size={16} />, run: () => router.push("/cycles"), group: "Navigate" },
    { id: "theme", title: `Switch to ${theme === "dark" ? "light" : "dark"} theme`, keywords: "appearance preferences mode", icon: theme === "dark" ? <Sun size={16} /> : <Moon size={16} />, run: toggleTheme, group: "Preferences" },
    { id: "sidebar", title: `${sidebarCollapsed ? "Expand" : "Collapse"} sidebar`, keywords: "navigation preferences", icon: sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />, run: toggleSidebar, group: "Preferences" },
  ];
  const search = query.trim();
  const filteredResults = search ? results.filter((result) => matches(search, `${result.title} ${result.context} ${result.keywords}`)) : [];
  const filteredActions = actions.filter((action) => matches(search, `${action.title} ${action.keywords}`));
  const recentResults = recentPaths.flatMap((path) => { const result = results.find((item) => item.href === path); return result ? [result] : []; }).slice(0, 5);
  const resultCount = filteredResults.length + filteredActions.length;

  function resultItem(result: SearchResult, recent = false) {
    return <Command.Item className="command-item" key={`${recent ? "recent:" : ""}${result.id}`} value={`${recent ? "recent:" : ""}${result.id}`} onSelect={() => navigate(result.href)}><span className="command-item-icon" aria-hidden="true">{result.icon}</span><span className="command-item-copy"><span className="command-item-title">{result.title}</span><span className="command-item-context">{result.context}</span></span>{recent && <span className="command-item-type">{result.kind.slice(0, -1)}</span>}<CornerDownLeft size={13} className="command-item-return" aria-hidden="true" /></Command.Item>;
  }

  return <Dialog.Root open={open} onOpenChange={onOpenChange}><Dialog.Portal><Dialog.Overlay className="dialog-overlay command-overlay" /><Dialog.Content asChild onOpenAutoFocus={() => { returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; transitioning.current = false; setQuery(""); }} onCloseAutoFocus={(event) => { event.preventDefault(); if (!transitioning.current && returnFocus.current?.isConnected) returnFocus.current.focus(); }}><motion.div className="command-dialog" initial={reducedMotion ? false : { opacity: 0, y: -5, scale: .99 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: .15, ease: "easeOut" }}><Dialog.Title className="sr-only">Search workspace and commands</Dialog.Title><Dialog.Description className="sr-only">Find issues, projects, cycles, members and labels, or run a command. Use the arrow keys to navigate and Enter to select.</Dialog.Description><Command label="Workspace search" shouldFilter={false} loop><div className="command-input-wrap"><Search size={19} strokeWidth={1.7} aria-hidden="true" /><Command.Input className="command-input" placeholder="Search your workspace…" value={query} onValueChange={setQuery} autoComplete="off" autoCorrect="off" spellCheck={false} /><Dialog.Close className="command-close" aria-label="Close search"><kbd>esc</kbd></Dialog.Close></div><Command.List className="command-list"><Command.Empty className="command-empty"><strong>No results for “{search}”</strong>Try an issue identifier, project name, member or label.</Command.Empty>{!data && <div className="command-empty" role="status">Workspace data is not available yet. You can still navigate or change your preferences.</div>}{!search && recentResults.length > 0 && <Command.Group heading="Recently viewed">{recentResults.map((result) => resultItem(result, true))}</Command.Group>}{search && groups.map((group) => { const items = filteredResults.filter((result) => result.kind === group); return items.length > 0 ? <Command.Group key={group} heading={`${group} · ${items.length}${items.length > 8 ? " (first 8)" : ""}`}>{items.slice(0, 8).map((result) => resultItem(result))}</Command.Group> : null; })}{(["Create", "Navigate", "Preferences"] as const).map((group) => { const items = filteredActions.filter((action) => action.group === group); return items.length ? <Command.Group key={group} heading={group}>{items.map((action) => <Command.Item className="command-item" key={action.id} value={`action:${action.id}`} onSelect={() => run(action.run)}><span className="command-item-icon" aria-hidden="true">{action.icon}</span><span className="command-item-title">{action.title}</span><CornerDownLeft size={13} className="command-item-return" aria-hidden="true" /></Command.Item>)}</Command.Group> : null; })}</Command.List><div className="command-footer"><span><kbd><ArrowUp size={10} /></kbd><kbd><ArrowDown size={10} /></kbd>Navigate</span><span><kbd><CornerDownLeft size={10} /></kbd>Select</span><span className="command-footer-brand" aria-live="polite">{search ? `${resultCount} result${resultCount === 1 ? "" : "s"}` : "Nivo Labs"}</span></div></Command></motion.div></Dialog.Content></Dialog.Portal></Dialog.Root>;
}
