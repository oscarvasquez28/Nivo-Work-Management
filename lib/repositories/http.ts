import type { WorkspaceData } from "../../types/domain";
import { createSeed } from "../data/seed";
import { DomainError, validateSnapshot, type DomainErrorCode } from "../domain/validation";
import { persistenceError, type CommitRequest, type WorkspaceRepository } from "./workspace";

const ERROR_CODES = new Set(["validation", "not-found", "conflict", "persistence-unavailable", "corrupt-snapshot", "unsupported-version"]);

async function request<T>(base: string, path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, { headers: { "content-type": "application/json" }, ...init });
  } catch (error) {
    throw new DomainError("persistence-unavailable", `The Nivo server could not be reached. Check that the API is running. ${error instanceof Error ? error.message : ""}`.trim());
  }
  if (response.status === 404) {
    const body = await response.json().catch(() => null) as { code?: string; message?: string } | null;
    throw new DomainError("not-found", body?.message ?? "The workspace has not been initialized.");
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { code?: string; message?: string } | null;
    const code = body?.code && ERROR_CODES.has(body.code) ? body.code as DomainErrorCode : "persistence-unavailable";
    throw new DomainError(code, body?.message ?? `The server responded with ${response.status}.`);
  }
  return response.json() as Promise<T>;
}

export function createHttpRepository(base = "/api", seed: () => WorkspaceData = () => createSeed(new Date().toISOString().slice(0, 10))): WorkspaceRepository & { revision(): Promise<number | null> } {
  let closed = false;
  const alive = () => { if (closed) throw new DomainError("persistence-unavailable", "The workspace connection is closed."); };
  return {
    async load() {
      alive();
      try {
        return validateSnapshot(await request<WorkspaceData>(base, "/workspace"));
      } catch (error) {
        if (error instanceof DomainError && error.code === "not-found") return null;
        throw persistenceError(error);
      }
    },
    async bootstrap(seedData) {
      alive();
      try {
        return validateSnapshot(await request<WorkspaceData>(base, "/workspace/bootstrap", { method: "POST", body: JSON.stringify({ seed: seedData ?? seed() }) }));
      } catch (error) { throw persistenceError(error); }
    },
    async commit(requestBody: CommitRequest) {
      alive();
      try {
        return validateSnapshot(await request<WorkspaceData>(base, "/commands", { method: "POST", body: JSON.stringify(requestBody) }));
      } catch (error) {
        if (error instanceof DomainError && (error.code === "conflict" || error.code === "validation" || error.code === "not-found")) throw error;
        throw persistenceError(error);
      }
    },
    async revision() {
      try {
        const result = await request<{ revision: number }>(base, "/workspace/revision");
        return result.revision;
      } catch { return null; }
    },
    async exportSnapshot() {
      alive();
      return request<unknown>(base, "/workspace").catch(() => null);
    },
    close() { closed = true; },
  };
}
