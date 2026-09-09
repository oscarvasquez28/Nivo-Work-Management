import type { WorkspaceData } from "../../types/domain";
import { applyCommand } from "../domain/commands";
import { assert, validateSnapshot } from "../domain/validation";
import type { CommitRequest, WorkspaceRepository } from "./workspace";

export interface MemoryRepositoryHooks { beforeCommit?: (request: CommitRequest) => void | Promise<void>; afterCommit?: (request: CommitRequest) => void | Promise<void> }

export function createMemoryRepository(initial?: WorkspaceData, hooks: MemoryRepositoryHooks = {}): WorkspaceRepository {
  let snapshot: WorkspaceData | null = initial ? validateSnapshot(initial) : null;
  return {
    async load() { return snapshot ? validateSnapshot(snapshot) : null; },
    async bootstrap(seed) {
      if (!snapshot) snapshot = validateSnapshot(seed);
      return validateSnapshot(snapshot);
    },
    async commit(request) {
      await hooks.beforeCommit?.(request);
      assert(snapshot, "The workspace has not been initialized", "not-found");
      if (snapshot.appliedMutations.includes(request.context.mutationId)) return validateSnapshot(snapshot);
      assert(snapshot.revision === request.expectedRevision, "This workspace changed in another tab. Review the latest changes and try again.", "conflict");
      snapshot = applyCommand(snapshot, request.command, request.context);
      await hooks.afterCommit?.(request);
      return validateSnapshot(snapshot);
    },
    async exportSnapshot() { return structuredClone(snapshot); },
    close() {},
  };
}
