import type { Command, WorkspaceData } from "../../types/domain";
import type { CommandContext } from "../domain/commands";
import { DomainError } from "../domain/validation";

export interface MutationContext extends CommandContext { now: string; mutationId: string }
export interface CommitRequest { command: Command; expectedRevision: number; context: MutationContext }
export interface WorkspaceRepository {
  load(): Promise<WorkspaceData | null>;
  bootstrap(seed: WorkspaceData): Promise<WorkspaceData>;
  commit(request: CommitRequest): Promise<WorkspaceData>;
  exportSnapshot(): Promise<unknown>;
  close(): void;
}

export function persistenceError(error: unknown): DomainError {
  if (error instanceof DomainError) return error;
  const message = error instanceof Error ? error.message : String(error);
  return new DomainError("persistence-unavailable", `Your changes could not be saved to this browser. ${message}`);
}
