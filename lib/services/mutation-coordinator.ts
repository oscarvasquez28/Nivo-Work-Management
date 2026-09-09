import type { Command, WorkspaceData } from "../../types/domain";
import { createSeed } from "../data/seed";
import { applyCommand, commandCreatedId } from "../domain/commands";
import { DomainError } from "../domain/validation";
import type { MutationContext, WorkspaceRepository } from "../repositories/workspace";

export interface WorkspaceNotice { message: string; kind: "success" | "error"; undo?: () => void }
export interface CoordinatorState { data: WorkspaceData | null; ready: boolean; error: string | null; pending: number }
export interface CoordinatorOptions {
  repository: WorkspaceRepository;
  onState: (state: CoordinatorState) => void;
  onNotice?: (notice: WorkspaceNotice) => void;
  onCommit?: (data: WorkspaceData) => void;
  now?: () => string;
  makeId?: () => string;
}
interface Intent { command: Command; context: MutationContext; resolve: (id?: string) => void; reject: (error: Error) => void }
const message = (error: unknown) => error instanceof Error ? error.message : "An unexpected workspace error occurred.";

export function createMutationCoordinator(options: CoordinatorOptions) {
  const { repository } = options;
  let base: WorkspaceData | null = null;
  let projection: WorkspaceData | null = null;
  let queue: Intent[] = [];
  let processing = false;
  let disposed = false;
  let blocked: string | null = null;
  let refreshRequested = false;
  let initializing: Promise<void> | null = null;
  const notice = (value: WorkspaceNotice) => { if (!disposed) options.onNotice?.(value); };
  const emit = () => { if (!disposed) options.onState({ data: projection, ready: !!base && !blocked, error: blocked, pending: queue.length }); };
  const fail = (intent: Intent, error: unknown) => intent.reject(error instanceof Error ? error : new Error(message(error)));
  const replay = () => {
    projection = base;
    const valid: Intent[] = [];
    for (const intent of queue) {
      try {
        if (!projection) throw new DomainError("not-found", "The workspace is not ready.");
        projection = applyCommand(projection, intent.command, intent.context);
        valid.push(intent);
      } catch (error) {
        fail(intent, error);
        notice({ kind: "error", message: `A pending change could not be applied: ${message(error)}` });
      }
    }
    queue = valid;
    emit();
  };
  const rejectQueue = (error: Error) => {
    for (const intent of queue) fail(intent, error);
    queue = [];
  };
  const saved = (intent: Intent) => {
    let undo: (() => void) | undefined;
    const command = intent.command;
    if (command.type === "issue.delete") {
      undo = () => {
        if (!base || base.issues[command.id]?.deletedAt !== intent.context.now) { notice({ kind: "error", message: "This issue changed after deletion. Open it to review the latest state before restoring." }); return; }
        void mutate({ type: "issue.restore", id: command.id }).catch(() => undefined);
      };
    } else if (command.type === "project.archive" && command.archived) {
      undo = () => {
        if (base?.projects[command.id]?.archivedAt !== intent.context.now) { notice({ kind: "error", message: "This project changed after archiving. Review its latest state first." }); return; }
        void mutate({ type: "project.archive", id: command.id, archived: false }).catch(() => undefined);
      };
    }
    const result = commandCreatedId(command);
    intent.resolve(result);
    const noun = command.type.startsWith("comment.") ? "Comment" : command.type.startsWith("project.") ? "Project" : command.type.startsWith("cycle.") ? "Cycle" : command.type.startsWith("view.") ? "View" : command.type === "issues.bulk" ? "Issues" : "Issue";
    notice({ kind: "success", message: `${noun} ${command.type.endsWith("delete") || (command.type === "issues.bulk" && command.delete) ? "deleted" : command.type.endsWith("restore") ? "restored" : "saved"}`, undo });
    if (base && !disposed) options.onCommit?.(base);
  };
  const drain = async () => {
    if (processing || disposed || blocked || !base) return;
    processing = true;
    try {
      while (queue.length && !disposed && !blocked && base) {
        const intent = queue[0];
        const previousRevision = base.revision;
        try {
          const committed = await repository.commit({ command: intent.command, context: intent.context, expectedRevision: base.revision });
          if (disposed) return;
          base = committed;
          queue = queue.filter((pending) => pending !== intent);
          saved(intent);
        } catch (error) {
          if (disposed) return;
          let latest: WorkspaceData | null = null;
          try {
            latest = await repository.load();
            if (!latest) throw new DomainError("not-found", "The persisted workspace is missing. Retry loading or explicitly choose a session-only workspace.");
          } catch (loadError) { blocked = `Saving failed and the saved workspace could not be verified. ${message(loadError)}`; }
          if (disposed) return;
          queue = queue.filter((pending) => pending !== intent);
          if (latest) base = latest;
          if (latest?.appliedMutations.includes(intent.context.mutationId)) saved(intent);
          else {
            fail(intent, error);
            notice({ kind: "error", message: `Change not saved. ${message(error)}` });
            if ((error instanceof DomainError && error.code === "conflict") || (latest && latest.revision !== previousRevision)) {
              rejectQueue(new DomainError("conflict", "The workspace changed in another tab. Your pending change was not saved; review the latest data and try again."));
            }
          }
        }
        replay();
      }
    } finally {
      processing = false;
      if (refreshRequested && !disposed && !blocked) { refreshRequested = false; void refresh(); }
    }
  };
  async function mutate(raw: Command): Promise<string | undefined> {
    if (disposed || !projection || blocked) {
      const error = new DomainError("persistence-unavailable", blocked ?? "The workspace is still loading. Try again when it is ready.");
      notice({ kind: "error", message: error.message });
      throw error;
    }
    const mutationId = options.makeId?.() ?? crypto.randomUUID();
    const command = structuredClone(raw);
    if ((command.type === "issue.create" || command.type === "project.create" || command.type === "cycle.create" || command.type === "comment.add") && !command.id) command.id = `${command.type.split(".")[0]}-${mutationId}`;
    const context: MutationContext = { mutationId, now: options.now?.() ?? new Date().toISOString(), actorId: projection.currentUserId };
    try { projection = applyCommand(projection, command, context); } catch (error) { notice({ kind: "error", message: message(error) }); throw error; }
    return new Promise<string | undefined>((resolve, reject) => {
      queue.push({ command, context, resolve, reject });
      emit();
      void drain();
    });
  }
  async function initialize(seed: () => WorkspaceData = () => createSeed(new Date().toISOString().slice(0, 10))) {
    if (disposed) return;
    if (initializing) return initializing;
    initializing = (async () => {
      blocked = null;
      emit();
      try {
        const loaded = await repository.load();
        const snapshot = loaded ?? await repository.bootstrap(seed());
        if (disposed) return;
        if (base && snapshot.revision !== base.revision && queue.length) rejectQueue(new DomainError("conflict", "Saved data changed while storage was unavailable. Review the latest workspace and retry your changes."));
        base = snapshot;
        replay();
        void drain();
      } catch (error) {
        if (disposed) return;
        blocked = message(error);
        emit();
      }
    })().finally(() => { initializing = null; });
    return initializing;
  }
  async function refresh() {
    if (disposed) return;
    if (processing) { refreshRequested = true; return; }
    if (!base || blocked) { await initialize(); return; }
    try {
      const latest = await repository.load();
      if (disposed) return;
      if (!latest) throw new DomainError("not-found", "The saved workspace is missing. Your current data has not been overwritten.");
      if (latest.revision !== base.revision) {
        if (queue.length) rejectQueue(new DomainError("conflict", "Another tab updated the workspace. Review its changes before retrying yours."));
        base = latest;
        replay();
      }
    } catch (error) { if (!disposed) { blocked = message(error); emit(); notice({ kind: "error", message: blocked }); } }
  }
  return {
    initialize, mutate, refresh,
    getCommitted: () => base,
    dispose() {
      disposed = true;
      rejectQueue(new DomainError("persistence-unavailable", "The workspace session was closed before this change could be confirmed."));
      repository.close();
    },
  };
}
