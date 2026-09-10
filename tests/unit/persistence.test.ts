import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";
import { openDB, deleteDB } from "idb";
import { createSeed } from "../../lib/data/seed";
import { createIndexedDBRepository } from "../../lib/repositories/indexeddb";
import { createMemoryRepository } from "../../lib/repositories/memory";
import { createMutationCoordinator, type CoordinatorState } from "../../lib/services/mutation-coordinator";
import type { CommitRequest, WorkspaceRepository } from "../../lib/repositories/workspace";

const request = (mutationId: string, revision = 0): CommitRequest => ({ command: { type: "issue.create", id: `issue-${mutationId}`, input: { title: `Issue ${mutationId}` } }, expectedRevision: revision, context: { mutationId, now: "2026-09-09T15:00:00.000Z" } });

for (const kind of ["memory", "indexeddb"] as const) describe(`${kind} repository contract`, () => {
  const repository = () => kind === "memory" ? createMemoryRepository() : createIndexedDBRepository(`test-${crypto.randomUUID()}`);
  it("bootstraps once, persists mutations, and isolates returned snapshots", async () => {
    const repo = repository();
    expect(await repo.load()).toBeNull();
    await repo.bootstrap(createSeed());
    const saved = await repo.commit(request("first"));
    expect(saved.revision).toBe(1);
    saved.issues["issue-first"].title = "Accidental external edit";
    expect((await repo.load())?.issues["issue-first"].title).toBe("Issue first");
    expect((await repo.bootstrap(createSeed())).revision).toBe(1);
    repo.close();
  });
  it("checks revisions atomically and deduplicates ambiguous retries", async () => {
    const repo = repository();
    await repo.bootstrap(createSeed());
    const results = await Promise.allSettled([repo.commit(request("first")), repo.commit(request("second"))]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    const data = (await repo.load())!;
    const winner = data.appliedMutations[0];
    expect((await repo.commit(request(winner))).revision).toBe(1);
    expect(Object.keys(data.issues)).toHaveLength(151);
    repo.close();
  });
  it("keeps invalid bulk operations entirely out of durable data", async () => {
    const repo = repository();
    const original = await repo.bootstrap(createSeed());
    await expect(repo.commit({ ...request("bad"), command: { type: "issues.bulk", ids: ["issue-142", "missing"], delete: true } })).rejects.toThrow();
    expect(await repo.load()).toEqual(original);
    repo.close();
  });
});

describe("IndexedDB recovery", () => {
  it("does not overwrite corrupt or newer-version snapshots during bootstrap", async () => {
    const name = `corrupt-${crypto.randomUUID()}`;
    const db = await openDB(name, 1, { upgrade(database) { database.createObjectStore("snapshots"); } });
    const raw = { schemaVersion: 3, important: "Do not overwrite" };
    await db.put("snapshots", raw, "nivo-labs");
    const repo = createIndexedDBRepository(name);
    await expect(repo.load()).rejects.toMatchObject({ code: "unsupported-version" });
    await expect(repo.bootstrap(createSeed())).rejects.toMatchObject({ code: "unsupported-version" });
    expect(await repo.exportSnapshot()).toEqual(raw);
    repo.close();
    db.close();
    await deleteDB(name);
  });
  it("persists across repository connections", async () => {
    const name = `reload-${crypto.randomUUID()}`;
    const first = createIndexedDBRepository(name);
    await first.bootstrap(createSeed());
    await first.commit(request("reload"));
    first.close();
    const second = createIndexedDBRepository(name);
    expect((await second.load())?.issues["issue-reload"].title).toBe("Issue reload");
    second.close();
  });
});

function coordinator(repo: WorkspaceRepository) {
  let state: CoordinatorState = { data: null, ready: false, error: null, pending: 0 };
  let sequence = 0;
  const notices = vi.fn();
  const service = createMutationCoordinator({ repository: repo, onState: (next) => { state = next; }, onNotice: notices, now: () => "2026-09-09T15:00:00.000Z", makeId: () => `intent-${++sequence}` });
  return { service, state: () => state, notices };
}

describe("optimistic mutation coordinator", () => {
  it("replays newer intent after an older persistence failure without losing newer edits", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let calls = 0;
    const repo = createMemoryRepository(createSeed(), { beforeCommit: async () => { if (++calls === 1) { await gate; throw new Error("Quota exceeded"); } } });
    const { service, state } = coordinator(repo);
    await service.initialize();
    const first = service.mutate({ type: "issue.update", id: "issue-142", patch: { title: "Older title" } }).catch((error: Error) => error);
    const second = service.mutate({ type: "issue.update", id: "issue-142", patch: { title: "Newest title", priority: "urgent" } });
    expect(state().pending).toBe(2);
    expect(state().data?.issues["issue-142"].title).toBe("Newest title");
    release();
    expect(await first).toBeInstanceOf(Error);
    await second;
    expect(state().pending).toBe(0);
    expect((await repo.load())?.issues["issue-142"]).toMatchObject({ title: "Newest title", priority: "urgent" });
    service.dispose();
  });
  it("rejects intents that depend on a failed creation", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const repo = createMemoryRepository(createSeed(), { beforeCommit: async () => { await gate; throw new Error("Disk full"); } });
    const { service, state } = coordinator(repo);
    await service.initialize();
    const create = service.mutate({ type: "issue.create", id: "dependent", input: { title: "New" } }).catch((error: Error) => error);
    const edit = service.mutate({ type: "issue.update", id: "dependent", patch: { priority: "high" } }).catch((error: Error) => error);
    release();
    expect(await create).toBeInstanceOf(Error);
    expect(await edit).toBeInstanceOf(Error);
    expect(state().data?.issues.dependent).toBeUndefined();
    expect(state().pending).toBe(0);
    service.dispose();
  });
  it("recognizes a commit receipt when the success response is lost", async () => {
    const repo = createMemoryRepository(createSeed(), { afterCommit: () => { throw new Error("Response lost"); } });
    const { service, state } = coordinator(repo);
    await service.initialize();
    const id = await service.mutate({ type: "issue.create", input: { title: "Exactly once" } });
    expect(id).toBeDefined();
    expect(state().data?.issues[id!].title).toBe("Exactly once");
    expect(Object.keys((await repo.load())!.issues)).toHaveLength(151);
    service.dispose();
  });
  it("refreshes conflicts rather than overwriting another tab", async () => {
    const repo = createMemoryRepository(createSeed());
    const { service, state } = coordinator(repo);
    await service.initialize();
    await repo.commit({ ...request("external"), command: { type: "issue.update", id: "issue-142", patch: { title: "Other tab" } } });
    await expect(service.mutate({ type: "issue.update", id: "issue-142", patch: { title: "Stale local edit" } })).rejects.toMatchObject({ code: "conflict" });
    expect(state().data?.issues["issue-142"].title).toBe("Other tab");
    service.dispose();
  });
});
