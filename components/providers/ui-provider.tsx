"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { IssueCreateDialog } from "@/components/issues/create-dialog";
import { ProjectFormDialog } from "@/components/projects/project-form";
import { CycleFormDialog } from "@/components/cycles/cycle-form";
import { CommandPalette } from "@/components/command-palette";
import type { IssueInput } from "@/types/domain";

type Theme = "dark" | "light";
type UIContextValue = {
  openCreateIssue: (defaults?: Partial<IssueInput>) => void;
  openCreateProject: () => void;
  openCreateCycle: () => void;
  openSearch: () => void;
  toggleSidebar: () => void;
  sidebarCollapsed: boolean;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  theme: Theme;
  toggleTheme: () => void;
};

const UIContext = createContext<UIContextValue | null>(null);
const preferenceKey = "nivo:ui-preferences";

export function UIProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [cycleOpen, setCycleOpen] = useState(false);
  const [issueDefaults, setIssueDefaults] = useState<Partial<IssueInput> | undefined>();

  useEffect(() => {
    let storedTheme: Theme = "dark";
    let storedCollapsed = false;
    try {
      const preferences: unknown = JSON.parse(localStorage.getItem(preferenceKey) ?? "{}");
      if (preferences && typeof preferences === "object") {
        const stored = preferences as Record<string, unknown>;
        if (stored.theme === "dark" || stored.theme === "light") storedTheme = stored.theme;
        if (typeof stored.sidebarCollapsed === "boolean") storedCollapsed = stored.sidebarCollapsed;
      }
    } catch {}
    document.documentElement.dataset.theme = storedTheme;
    requestAnimationFrame(() => {
      setTheme(storedTheme);
      setSidebarCollapsed(storedCollapsed);
      setPreferencesReady(true);
    });
  }, []);

  useEffect(() => {
    if (!preferencesReady) return;
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(preferenceKey, JSON.stringify({ theme, sidebarCollapsed })); } catch {}
  }, [theme, sidebarCollapsed, preferencesReady]);

  const openSearch = useCallback(() => {
    setMobileOpen(false);
    setIssueOpen(false);
    setProjectOpen(false);
    setCycleOpen(false);
    setSearchOpen(true);
  }, []);
  const openCreateIssue = useCallback((defaults?: Partial<IssueInput>) => {
    setSearchOpen(false);
    setMobileOpen(false);
    setProjectOpen(false);
    setCycleOpen(false);
    setIssueDefaults(defaults);
    setIssueOpen(true);
  }, []);
  const openCreateProject = useCallback(() => {
    setSearchOpen(false);
    setMobileOpen(false);
    setIssueOpen(false);
    setCycleOpen(false);
    setProjectOpen(true);
  }, []);
  const openCreateCycle = useCallback(() => {
    setSearchOpen(false);
    setMobileOpen(false);
    setIssueOpen(false);
    setProjectOpen(false);
    setCycleOpen(true);
  }, []);
  const toggleTheme = useCallback(() => setTheme((current) => current === "dark" ? "light" : "dark"), []);
  const toggleSidebar = useCallback(() => setSidebarCollapsed((current) => !current), []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing || event.keyCode === 229 || event.repeat || event.altKey || !(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return;
      const target = event.target;
      if (target instanceof Element && target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')) return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      event.preventDefault();
      openSearch();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [openSearch]);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 761px)");
    const closeOnDesktop = () => { if (media.matches) setMobileOpen(false); };
    media.addEventListener("change", closeOnDesktop);
    return () => media.removeEventListener("change", closeOnDesktop);
  }, []);

  const value = useMemo<UIContextValue>(() => ({ openCreateIssue, openCreateProject, openCreateCycle, openSearch, toggleSidebar, sidebarCollapsed, mobileOpen, setMobileOpen, theme, toggleTheme }), [openCreateIssue, openCreateProject, openCreateCycle, openSearch, toggleSidebar, sidebarCollapsed, mobileOpen, theme, toggleTheme]);

  return <UIContext.Provider value={value}>{children}<CommandPalette open={searchOpen} onOpenChange={setSearchOpen} /><IssueCreateDialog open={issueOpen} onOpenChange={setIssueOpen} defaults={issueDefaults} /><ProjectFormDialog open={projectOpen} onOpenChange={setProjectOpen} /><CycleFormDialog open={cycleOpen} onOpenChange={setCycleOpen} /></UIContext.Provider>;
}

export function useUI() {
  const context = useContext(UIContext);
  if (!context) throw new Error("useUI must be used inside UIProvider");
  return context;
}
