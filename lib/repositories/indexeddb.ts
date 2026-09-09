import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { WorkspaceData } from "../../types/domain";
import { applyCommand } from "../domain/commands";
import { assert, DomainError, validateSnapshot } from "../domain/validation";
import { persistenceError, type WorkspaceRepository } from "./workspace";

interface WorkspaceDatabase extends DBSchema { snapshots: { key: string; value: WorkspaceData } }
export const WORKSPACE_DATABASE_NAME = "nivo-workspace";
const key = "nivo-labs";

export function createIndexedDBRepository(databaseName = WORKSPACE_DATABASE_NAME): WorkspaceRepository {
  let connection: Promise<IDBPDatabase<WorkspaceDatabase>> | null = null;
  let closed = false;
  const database = () => {
    if (closed) return Promise.reject(new DomainError("persistence-unavailable", "The workspace database connection is closed."));
    if (!connection) {
      connection = new Promise<IDBPDatabase<WorkspaceDatabase>>((resolve, reject) => {
        let blocked = false;
        try {
          const opening = openDB<WorkspaceDatabase>(databaseName, 1, {
            upgrade(db) { if (!db.objectStoreNames.contains("snapshots")) db.createObjectStore("snapshots"); },
            blocked() { blocked = true; reject(new DomainError("persistence-unavailable", "A different tab is blocking the workspace database. Close other Nivo tabs and retry.")); },
            blocking() { void opening.then((db) => db.close()); connection = null; },
            terminated() { connection = null; },
          });
          opening.then((db) => { if (blocked || closed) { db.close(); reject(new DomainError("persistence-unavailable", "The workspace database was closed before loading.")); } else resolve(db); }, reject);
        } catch (error) { reject(error); }
      }).catch((error) => { connection = null; throw persistenceError(error); });
    }
    return connection;
  };
  return {
    async load() {
      try {
        const db = await database();
        const raw = await db.get("snapshots", key);
        return raw === undefined ? null : validateSnapshot(raw);
      } catch (error) { throw persistenceError(error); }
    },
    async bootstrap(seed) {
      const validSeed = validateSnapshot(seed);
      try {
        const db = await database();
        const tx = db.transaction("snapshots", "readwrite");
        try {
          const raw = await tx.store.get(key);
          const snapshot = raw === undefined ? validSeed : validateSnapshot(raw);
          if (raw === undefined) await tx.store.put(snapshot, key);
          await tx.done;
          return snapshot;
        } catch (error) { try { tx.abort(); } catch {} await tx.done.catch(() => undefined); throw error; }
      } catch (error) { throw persistenceError(error); }
    },
    async commit(request) {
      try {
        const db = await database();
        const tx = db.transaction("snapshots", "readwrite");
        try {
          const raw = await tx.store.get(key);
          assert(raw !== undefined, "The workspace has not been initialized", "not-found");
          const current = validateSnapshot(raw);
          if (current.appliedMutations.includes(request.context.mutationId)) { await tx.done; return current; }
          assert(current.revision === request.expectedRevision, "This workspace changed in another tab. Review the latest changes and try again.", "conflict");
          const snapshot = applyCommand(current, request.command, request.context);
          await tx.store.put(snapshot, key);
          await tx.done;
          return snapshot;
        } catch (error) { try { tx.abort(); } catch {} await tx.done.catch(() => undefined); throw error; }
      } catch (error) { throw persistenceError(error); }
    },
    async exportSnapshot() {
      try { const db = await database(); return (await db.get("snapshots", key)) ?? null; } catch (error) { throw persistenceError(error); }
    },
    close() { closed = true; if (connection) void connection.then((db) => db.close(), () => undefined); connection = null; },
  };
}
