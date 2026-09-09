"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createStore, type StoreApi } from "zustand/vanilla";
import { useStore } from "zustand";
import type { Command, WorkspaceData } from "../types/domain";
import { createSeed } from "../lib/data/seed";
import { createHttpRepository } from "../lib/repositories/http";
import { createMemoryRepository } from "../lib/repositories/memory";
import type { WorkspaceRepository } from "../lib/repositories/workspace";
import { createMutationCoordinator, type WorkspaceNotice } from "../lib/services/mutation-coordinator";

export interface WorkspaceState {
  data: WorkspaceData | null;
  ready: boolean;
  error: string | null;
  pending: number;
  notice: WorkspaceNotice | null;
  authRequired: boolean;
  login: (email: string, password: string) => Promise<string | undefined>;
  logout: () => Promise<void>;
  refresh: () => void;
  mutate: (command: Command) => Promise<string | undefined>;
  retry: () => void;
  useMemory: () => void;
  dismissNotice: () => void;
}
const WorkspaceContext = createContext<StoreApi<WorkspaceState> | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => createStore<WorkspaceState>(() => ({
    data: null, ready: false, error: null, pending: 0, notice: null, authRequired: false,
    login: async () => "The workspace is still loading.", logout: async () => undefined, refresh: () => undefined,
    mutate: async () => { throw new Error("The workspace is still loading."); },
    retry: () => undefined, useMemory: () => undefined, dismissNotice: () => undefined,
  })));

  useEffect(() => {
    let coordinator: ReturnType<typeof createMutationCoordinator> | null = null;
    let memory = false;
    const repository = createHttpRepository("/api");
    const memoryNotice: WorkspaceNotice = { kind: "error", message: "Session-only mode: the server is unreachable, so changes stay in this tab and will be lost when you reload or close it." };
    const start = (repo: WorkspaceRepository, sessionOnly: boolean) => {
      coordinator?.dispose();
      memory = sessionOnly;
      store.setState({ ready: false, error: null, pending: 0, notice: sessionOnly ? memoryNotice : null });
      coordinator = createMutationCoordinator({
        repository: repo,
        onState: (state) => store.setState(state),
        onNotice: (notice) => store.setState({ notice: memory && notice.kind === "success" ? { ...notice, message: `${notice.message} in this session only. Reloading will lose these changes.` } : notice }),
      });
      store.setState({
        mutate: (command) => coordinator!.mutate(command),
        retry: () => { void coordinator?.refresh(); },
        useMemory: () => {
          const snapshot = store.getState().data ?? createSeed(new Date().toISOString().slice(0, 10));
          start(createMemoryRepository(snapshot), true);
        },
        dismissNotice: () => store.setState({ notice: memory ? memoryNotice : null }),
      });
      void coordinator.initialize();
    };
    const refresh = () => { if (!memory && document.visibilityState === "visible") void coordinator?.refresh(); };
    store.setState({ refresh: () => coordinator?.refresh(),
      login: async (email, password) => {
        try {
          const response = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
          if (response.status === 401) return "Incorrect email or password.";
          if (!response.ok) return "The server could not sign you in. Try again.";
          store.setState({ authRequired: false });
          start(repository, false);
          return undefined;
        } catch {
          return "The Nivo server could not be reached. Check that the API is running.";
        }
      },
      logout: async () => {
        await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
        window.location.reload();
      },
    });
    void (async () => {
      try {
        const me = await fetch("/api/auth/me");
        if (me.status === 401) { store.setState({ authRequired: true }); return; }
      } catch {
        store.setState({ error: "The Nivo server could not be reached. Check that the API is running.", authRequired: false });
        start(repository, false);
        return;
      }
      start(repository, false);
    })();
    const poll = () => {
      if (memory || document.visibilityState !== "visible") return;
      void repository.revision().then((revision) => {
        if (revision !== null && revision > (coordinator?.getCommitted()?.revision ?? -1)) void coordinator?.refresh();
      });
    };
    const interval = window.setInterval(poll, 15000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      coordinator?.dispose();
    };
  }, [store]);

  return <WorkspaceContext.Provider value={store}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceState {
  const store = useContext(WorkspaceContext);
  if (!store) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return useStore(store);
}
