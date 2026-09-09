import { describe, expect, it } from "vitest";
import { createSeed } from "../../lib/data/seed";
import { applyCommand } from "../../lib/domain/commands";
import { cycleProgress, projectProgress, selectIssues } from "../../lib/domain/selectors";
import { validateSnapshot } from "../../lib/domain/validation";
import { EMPTY_FILTERS } from "../../types/domain";

const now = "2026-09-09T14:00:00.000Z";
const context = { now, mutationId: "test-mutation" };

describe("deterministic workspace", () => {
  it("creates a coherent, richly populated fixture", () => {
    const data = createSeed("2026-09-09");
    expect(createSeed("2026-09-09")).toEqual(data);
    expect(Object.keys(data.issues)).toHaveLength(150);
    expect(Object.keys(data.users)).toHaveLength(12);
    expect(Object.keys(data.cycles)).toHaveLength(6);
    expect(data.currentUserId).toBe("user-oscar");
    expect(Object.values(data.issues).find((issue) => issue.identifier === "NIV-142")?.title).toBe("Implement command palette");
    expect(validateSnapshot(data)).toEqual(data);
  });

  it("rejects corrupt references and unknown schema versions", () => {
    const data = createSeed();
    data.issues["issue-142"].assigneeId = "missing";
    expect(() => validateSnapshot(data)).toThrow();
    expect(() => validateSnapshot({ ...createSeed(), schemaVersion: 2 })).toThrow(/version/i);
  });
});

describe("atomic domain commands", () => {
  it("creates with defaults, trims titles, allocates a sequence and logs activity", () => {
    const data = createSeed();
    const result = applyCommand(data, { type: "issue.create", id: "new-issue", input: { title: "  Build a better workspace  " } }, context);
    expect(result.issues["new-issue"]).toMatchObject({ title: "Build a better workspace", identifier: "NIV-151", teamId: "engineering", reporterId: "user-oscar", status: "backlog" });
    expect(result.workspace.nextIssueNumber).toBe(152);
    expect(result.revision).toBe(data.revision + 1);
    expect(result.appliedMutations).toContain("test-mutation");
    expect(Object.keys(result.activities).length).toBe(Object.keys(data.activities).length + 1);
    expect(data.issues["new-issue"]).toBeUndefined();
    expect(applyCommand(result, { type: "issue.create", id: "new-issue", input: { title: "Build a better workspace" } }, context)).toEqual(result);
  });

  it("rejects invalid titles, estimates, dates and immutable-field injection", () => {
    const data = createSeed();
    for (const input of [{ title: " " }, { title: "X", estimate: -1 }, { title: "X", dueDate: "2026-02-30" }, { title: "X", status: "unknown" }]) {
      expect(() => applyCommand(data, { type: "issue.create", input } as never, context)).toThrow();
    }
    expect(() => applyCommand(data, { type: "issue.update", id: "issue-142", patch: { identifier: "HACK-1" } } as never, context)).toThrow();
  });

  it("sets transition timestamps and preserves first start when reopened", () => {
    const created = applyCommand(createSeed(), { type: "issue.create", id: "new", input: { title: "Lifecycle" } }, context);
    const started = applyCommand(created, { type: "issue.update", id: "new", patch: { status: "in_progress" } }, { now, mutationId: "start" });
    const done = applyCommand(started, { type: "issue.move", id: "new", status: "done" }, { now: "2026-09-10T12:00:00.000Z", mutationId: "finish" });
    expect(done.issues.new.completedAt).toBe("2026-09-10T12:00:00.000Z");
    const reopened = applyCommand(done, { type: "issue.update", id: "new", patch: { status: "todo" } }, { now: "2026-09-11T12:00:00.000Z", mutationId: "reopen" });
    expect(reopened.issues.new.completedAt).toBeNull();
    expect(reopened.issues.new.startedAt).toBe(now);
  });

  it("moves project/team together and clears an incompatible cycle", () => {
    const data = applyCommand(createSeed(), { type: "issue.create", id: "new", input: { title: "Move me", projectId: "nivo-2", cycleId: "cycle-24" } }, context);
    const result = applyCommand(data, { type: "issue.update", id: "new", patch: { projectId: "mobile" } }, { now, mutationId: "move-project" });
    expect(result.issues.new).toMatchObject({ projectId: "mobile", teamId: "product", cycleId: null });
    expect(() => applyCommand(data, { type: "issue.update", id: "new", patch: { cycleId: "cycle-mobile-8" } }, { now })).toThrow(/team/i);
  });

  it("fails an entire bulk operation without changing the original snapshot", () => {
    const data = createSeed();
    const before = structuredClone(data);
    expect(() => applyCommand(data, { type: "issues.bulk", ids: ["issue-142", "missing"], patch: { priority: "urgent" } }, context)).toThrow();
    expect(data).toEqual(before);
    expect(() => applyCommand(data, { type: "issues.bulk", ids: ["issue-142"], addLabel: "missing" }, context)).toThrow();
  });

  it("orders against the full destination list and excludes tombstones", () => {
    const data = createSeed();
    const anchor = selectIssues(data).find((issue) => issue.status === "todo")!;
    const moved = applyCommand(data, { type: "issue.move", id: "issue-142", status: "todo", beforeId: anchor.id }, context);
    const ordered = selectIssues(moved).filter((issue) => issue.status === "todo");
    expect(ordered.findIndex((issue) => issue.id === "issue-142")).toBeLessThan(ordered.findIndex((issue) => issue.id === anchor.id));
    const deleted = applyCommand(moved, { type: "issue.delete", id: "issue-142" }, { now, mutationId: "delete" });
    expect(selectIssues(deleted).some((issue) => issue.id === "issue-142")).toBe(false);
    const restored = applyCommand(deleted, { type: "issue.restore", id: "issue-142" }, { now, mutationId: "restore" });
    expect(selectIssues(restored).some((issue) => issue.id === "issue-142")).toBe(true);
  });

  it("limits comment editing to the current actor and records edits", () => {
    const data = applyCommand(createSeed(), { type: "comment.add", id: "my-comment", issueId: "issue-142", body: "  Ready for review.  " }, context);
    expect(data.comments["my-comment"].body).toBe("Ready for review.");
    expect(() => applyCommand(data, { type: "comment.edit", id: "my-comment", body: "No" }, { now, actorId: "user-sarah" })).toThrow();
    const edited = applyCommand(data, { type: "comment.edit", id: "my-comment", body: "Looks good." }, { now, mutationId: "edit-comment" });
    expect(edited.comments["my-comment"].editedAt).toBe(now);
  });

  it("retains archived project work while rejecting new membership", () => {
    const data = createSeed();
    const archived = applyCommand(data, { type: "project.archive", id: "nivo-2", archived: true }, context);
    expect(projectProgress(archived, "nivo-2")).toEqual(projectProgress(data, "nivo-2"));
    expect(() => applyCommand(archived, { type: "issue.create", input: { title: "Blocked", projectId: "nivo-2" } }, { now })).toThrow(/archiv/i);
  });
});

describe("selectors and cycles", () => {
  it("combines route scope and filters, with OR within a clause", () => {
    const data = createSeed();
    const filters = { ...EMPTY_FILTERS, statuses: ["todo", "in_progress"] as const, priorities: ["high", "urgent"] as const };
    const actual = selectIssues(data, { ...filters, statuses: [...filters.statuses], priorities: [...filters.priorities] }, { projectId: "nivo-2" }, "priority");
    const expected = Object.values(data.issues).filter((issue) => !issue.deletedAt && issue.projectId === "nivo-2" && ["todo", "in_progress"].includes(issue.status) && ["high", "urgent"].includes(issue.priority));
    expect(actual.map((issue) => issue.id).sort()).toEqual(expected.map((issue) => issue.id).sort());
    expect(selectIssues(data, { ...EMPTY_FILTERS, text: "niv-142" }).map((issue) => issue.id)).toEqual(["issue-142"]);
  });

  it("freezes closed cycle metrics, blocks membership/date edits, and recalculates on reopen", () => {
    const data = createSeed();
    const initial = cycleProgress(data, "cycle-24");
    const closed = applyCommand(data, { type: "cycle.close", id: "cycle-24" }, context);
    expect(cycleProgress(closed, "cycle-24")).toEqual(initial);
    const member = Object.values(closed.issues).find((issue) => issue.cycleId === "cycle-24" && issue.status !== "done")!;
    const changed = applyCommand(closed, { type: "issue.update", id: member.id, patch: { status: "done", estimate: 13 } }, { now, mutationId: "finish-later" });
    expect(cycleProgress(changed, "cycle-24")).toEqual(initial);
    expect(() => applyCommand(changed, { type: "issue.update", id: member.id, patch: { cycleId: null } }, { now })).toThrow(/closed/i);
    expect(() => applyCommand(changed, { type: "cycle.update", id: "cycle-24", patch: { endDate: "2026-09-20" } }, { now })).toThrow(/closed/i);
    const reopened = applyCommand(changed, { type: "cycle.reopen", id: "cycle-24" }, { now, mutationId: "cycle-reopen" });
    expect(reopened.cycles["cycle-24"].snapshot).toBeNull();
    expect(cycleProgress(reopened, "cycle-24").completed).toBe(initial.completed + 1);
  });

  it("rejects overlapping open cycles and reports empty progress honestly", () => {
    const data = createSeed();
    expect(() => applyCommand(data, { type: "cycle.create", input: { name: "Overlap", goal: "", teamId: "engineering", startDate: "2026-09-09", endDate: "2026-09-12" } }, context)).toThrow(/overlap/i);
    expect(projectProgress(data, "missing")).toEqual({ total: 0, completed: 0, percent: 0 });
    expect(cycleProgress(data, "missing")).toEqual({ total: 0, completed: 0, percent: 0, points: 0, totalPoints: 0 });
  });
});
