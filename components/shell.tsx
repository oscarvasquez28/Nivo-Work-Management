"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { AlertCircle, ArrowUpRight, CheckCircle2, ChevronRight, ChevronsUpDown, CircleUserRound, Group, HardDrive, House, Layers3, ListFilter, Loader2, LogOut, Menu, Moon, PanelLeftClose, PanelLeftOpen, Plus, RotateCcw, Search, Sun, Timer, Users, X } from "lucide-react";
import { useWorkspace } from "@/stores/workspace";
import { LoginScreen } from "@/components/auth/login-screen";
import { useUI } from "@/components/providers/ui-provider";
import { Avatar, Button, EmptyState, Skeleton, cn } from "@/components/ui";
import type { WorkspaceData } from "@/types/domain";

const navigation = [
  { href: "/", label: "Home", icon: House },
  { href: "/my-issues", label: "My issues", icon: CircleUserRound },
  { href: "/issues", label: "Issues", icon: ListFilter },
  { href: "/projects", label: "Projects", icon: Layers3 },
  { href: "/cycles", label: "Cycles", icon: Timer },
  { href: "/teams", label: "Teams", icon: Group },
  { href: "/members", label: "Members", icon: Users },
];

function Brand() {
  return <><span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 18 18" fill="none"><path d="M3.5 13.5v-9L14.5 13.5v-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg></span><span className="brand-name">Nivo <span>Labs</span></span></>;
}

function SidebarContents({ data, mobile = false }: { data: WorkspaceData | null; mobile?: boolean }) {
  const pathname = usePathname();
  const { logout } = useWorkspace();
  const { openSearch, openCreateIssue, openCreateProject, theme, toggleTheme, sidebarCollapsed, toggleSidebar, setMobileOpen } = useUI();
  const user = data ? data.users[data.currentUserId] : null;
  const projects = data ? Object.values(data.projects).filter((project) => !project.archivedAt && project.status !== "completed").slice(0, 5) : [];
  const myCount = data ? Object.values(data.issues).filter((issue) => !issue.deletedAt && issue.assigneeId === data.currentUserId && issue.status !== "done").length : 0;
  function closeMobile() { if (mobile) setMobileOpen(false); }
  return <div className="sidebar-inner">
    <Link href="/" className="sidebar-brand" aria-label="Nivo Labs home" onClick={closeMobile}><Brand /><span className="workspace-indicator" aria-hidden="true"><ChevronsUpDown size={12} /></span></Link>
    <div className="sidebar-quick-actions"><button className="sidebar-search" onClick={() => { closeMobile(); openSearch(); }} aria-label="Search workspace, Command or Control K" title="Search workspace"><Search size={14} aria-hidden="true" /><span>Search anything</span><kbd>⌘ K</kbd></button><Button className="sidebar-create" aria-label="Create issue" title="Create issue" onClick={() => { closeMobile(); openCreateIssue(); }} disabled={!data}><Plus size={15} /></Button></div>
    <div className="sidebar-scroll"><div className="sidebar-section-label">Workspace</div><nav className="sidebar-nav" aria-label={mobile ? "Mobile workspace navigation" : "Workspace navigation"}>{navigation.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={closeMobile} className={cn("nav-item", (href === "/" ? pathname === "/" : pathname.startsWith(href)) && "nav-item-active")} aria-current={(href === "/" ? pathname === "/" : pathname.startsWith(href)) ? "page" : undefined} aria-label={label} title={label}><Icon size={16} strokeWidth={1.65} aria-hidden="true" /><span className="nav-label">{label}</span>{href === "/my-issues" && data && myCount > 0 && <span className="nav-count">{myCount}</span>}</Link>)}</nav>
      <div className="sidebar-projects"><div className="sidebar-section-label"><span>Projects</span><Button variant="ghost" size="sm" className="icon-button" aria-label="Create project" title="Create project" disabled={!data} onClick={() => { closeMobile(); openCreateProject(); }}><Plus size={13} /></Button></div><nav className="sidebar-nav" aria-label="Active projects">{data ? projects.map((project) => <Link key={project.id} href={`/projects/${encodeURIComponent(project.id)}`} onClick={closeMobile} className={cn("nav-item", pathname.startsWith(`/projects/${project.id}`) && "nav-item-active")} aria-current={pathname.startsWith(`/projects/${project.id}`) ? "page" : undefined}><span className="sidebar-project-icon" style={{ color: project.color }}><Layers3 size={12} strokeWidth={1.8} aria-hidden="true" /></span><span className="nav-label">{project.name}</span></Link>) : [0, 1, 2].map((item) => <div className="nav-item" key={item}><Skeleton className="w-4 h-4" /><Skeleton className="w-28 h-2" /></div>)}{data && projects.length === 0 && <p className="sidebar-empty">No active projects yet</p>}</nav></div>
    </div>
    <div className="sidebar-footer">{data && user ? <DropdownMenu.Root><DropdownMenu.Trigger asChild><button className="profile-trigger" aria-label={`${user.name}, appearance and preferences`} title="Appearance and preferences"><Avatar user={user} /><span className="profile-copy"><span className="profile-name truncate">{user.name}</span><span className="profile-role truncate">{user.role}</span></span><ChevronsUpDown className="profile-chevron muted" size={12} /></button></DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content className="dropdown-content" side={mobile || !sidebarCollapsed ? "top" : "right"} align="start" sideOffset={8}><DropdownMenu.Label className="dropdown-label">Appearance & preferences</DropdownMenu.Label><DropdownMenu.Item className="dropdown-item" onSelect={toggleTheme}>{theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}Switch to {theme === "dark" ? "light" : "dark"} theme</DropdownMenu.Item>{!mobile && <DropdownMenu.Item className="dropdown-item" onSelect={toggleSidebar}>{sidebarCollapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}{sidebarCollapsed ? "Expand" : "Collapse"} sidebar</DropdownMenu.Item>}<DropdownMenu.Separator className="dropdown-separator" /><DropdownMenu.Item className="dropdown-item" onSelect={() => void logout()}><LogOut size={14} />Sign out</DropdownMenu.Item></DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root> : <div className="profile-trigger"><Skeleton className="skeleton-avatar" /><span className="profile-copy"><Skeleton className="w-24 h-2" /><Skeleton className="w-16 h-2 mt-1" /></span></div>}<div className="sidebar-local"><HardDrive size={10} aria-hidden="true" /><span>Server workspace</span></div></div>
  </div>;
}

function Breadcrumbs({ data }: { data: WorkspaceData | null }) {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean).map((part) => { try { return decodeURIComponent(part); } catch { return part; } });
  const root = navigation.find((item) => item.href === `/${parts[0]}`);
  const entityId = parts[1];
  const entity = entityId && data ? parts[0] === "issues" ? data.issues[entityId] : parts[0] === "projects" ? data.projects[entityId] : parts[0] === "cycles" ? data.cycles[entityId] : null : null;
  const entityName = entity ? "identifier" in entity ? entity.identifier : entity.name : null;
  return <nav className="breadcrumbs" aria-label="Breadcrumb"><Link className="breadcrumb-workspace" href="/">Nivo Labs</Link><ChevronRight size={11} className="breadcrumb-workspace-separator" aria-hidden="true" />{entityId && root ? <><Link href={root.href}>{root.label}</Link><ChevronRight size={11} aria-hidden="true" /><span className="breadcrumb-current" aria-current={parts.length < 3 ? "page" : undefined}>{entityName ?? (data ? "Detail" : "Loading…")}</span>{parts[2] && <><ChevronRight size={11} aria-hidden="true" /><span className="breadcrumb-current" aria-current="page">{parts[2].charAt(0).toUpperCase() + parts[2].slice(1)}</span></>}</> : <span className="breadcrumb-current" aria-current="page">{root?.label ?? (pathname === "/" ? "Home" : "Workspace")}</span>}</nav>;
}

function ShellLoading() {
  return <div className="page" aria-busy="true" aria-label="Loading workspace"><span className="sr-only" role="status">Loading your workspace…</span><Skeleton className="w-20 h-2 mb-4" /><Skeleton className="skeleton-title" /><Skeleton className="skeleton-description" /><div className="shell-loading-stats">{[0, 1, 2, 3].map((item) => <Skeleton className="skeleton-stat" key={item} />)}</div><Skeleton className="w-32 h-3 mb-5" /><div className="shell-loading-list">{[0, 1, 2, 3, 4, 5].map((item) => <Skeleton key={item} className="skeleton-row" />)}</div></div>;
}

export function AppShell({ children, panel }: { children: ReactNode; panel?: ReactNode }) {
  const { data, ready, error, pending, notice, authRequired, retry, useMemory, dismissNotice } = useWorkspace();
  const { sidebarCollapsed, toggleSidebar, mobileOpen, setMobileOpen, openSearch, openCreateIssue } = useUI();
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(dismissNotice, 5000);
    return () => clearTimeout(timer);
  }, [notice, dismissNotice]);
  const mobileTrigger = useRef<HTMLButtonElement>(null);
  const errorMessage = error ? String(error) : null;
  if (authRequired) return <LoginScreen />;
  return <div className={cn("app-shell", sidebarCollapsed && "sidebar-collapsed")}>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <aside className="sidebar desktop-sidebar" aria-label="Workspace sidebar"><SidebarContents data={data} /></aside>
    <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}><Dialog.Portal><Dialog.Overlay className="dialog-overlay mobile-sidebar-overlay" /><Dialog.Content className="sidebar mobile-sidebar" onCloseAutoFocus={(event) => { event.preventDefault(); mobileTrigger.current?.focus(); }}><Dialog.Title className="sr-only">Workspace navigation</Dialog.Title><Dialog.Description className="sr-only">Navigate your Nivo Labs workspace and projects.</Dialog.Description><SidebarContents data={data} mobile /><Dialog.Close asChild><Button variant="ghost" className="icon-button mobile-sidebar-close" aria-label="Close navigation"><X size={17} /></Button></Dialog.Close></Dialog.Content></Dialog.Portal></Dialog.Root>
    <div className="app-main"><header className="app-topbar"><div className="topbar-leading"><Button ref={mobileTrigger} variant="ghost" className="icon-button mobile-menu-button" aria-label="Open navigation" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}><Menu size={17} /></Button><Button variant="ghost" className="icon-button desktop-collapse-button" aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!sidebarCollapsed} onClick={toggleSidebar}>{sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}</Button><Breadcrumbs data={data} /></div><div className="topbar-actions">{Boolean(pending) && <span className="sync-status" role="status"><Loader2 size={11} className="spin" />Saving</span>}<button className="topbar-search" onClick={openSearch} aria-label="Search workspace" title="Search workspace (Command or Control K)"><Search size={15} /><span>Search</span><kbd>⌘ K</kbd></button><span className="divider" aria-hidden="true" /><Button variant="primary" onClick={() => openCreateIssue()} disabled={!data || !ready} aria-label="Create issue"><Plus size={14} /><span className="topbar-create-label">Create issue</span></Button></div></header>
      {data && errorMessage && <div className="workspace-banner" role="alert"><AlertCircle size={14} /><p>{errorMessage}</p><div className="workspace-banner-actions"><Button size="sm" variant="ghost" onClick={() => void retry()}><RotateCcw size={12} />Retry connection</Button><Button size="sm" variant="ghost" onClick={useMemory}>Continue for this session</Button></div></div>}
      <main id="main-content" className="main-content" tabIndex={-1}>{!data ? errorMessage ? <div className="workspace-recovery"><EmptyState icon={<HardDrive size={22} />} title="Your workspace couldn’t be opened" description={errorMessage} action={<><Button onClick={() => void retry()}><RotateCcw size={13} />Try again</Button><Button variant="primary" onClick={useMemory}>Use session-only workspace<ArrowUpRight size={13} /></Button></>} /><p className="workspace-recovery-detail">Your saved data will not be overwritten. Session-only changes stay in this tab and will be lost when you reload.</p></div> : <ShellLoading /> : children}</main>
    </div>
    {data && panel}
    {notice && <div className={cn("notice", `notice-${notice.kind}`)} role={notice.kind === "error" ? "alert" : "status"} aria-live={notice.kind === "error" ? "assertive" : "polite"}>{notice.kind === "error" ? <AlertCircle size={16} /> : notice.kind === "success" ? <CheckCircle2 size={16} /> : <HardDrive size={16} />}<span className="notice-message">{notice.message}</span>{notice.undo && <Button variant="ghost" size="sm" onClick={() => notice.undo?.()}>Undo</Button>}<Button variant="ghost" size="sm" className="icon-button" onClick={dismissNotice} aria-label="Dismiss notification"><X size={14} /></Button></div>}
  </div>;
}
