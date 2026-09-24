import { describe, expect, it } from "vitest";
import { createSeed } from "../../lib/data/seed";
import { applyCommand } from "../../lib/domain/commands";
import { cycleProgress, isIssueBlocked, issueBlockers, issueDuration, issueSchedule, projectProgress, selectIssues } from "../../lib/domain/selectors";
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
    expect(() => validateSnapshot({ ...createSeed(), schemaVersion: 99 })).toThrow(/version/i);
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
    const changed = applyCommand(closed, { type: "issue.update", id: member.id, patch: { status: "done", estimate: 8 } }, { now, mutationId: "finish-later" });
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
    expect(projectProgress(data, "missing")).toEqual({ total: 0, completed: 0, weightTotal: 0, weightCompleted: 0, percent: 0 });
    expect(cycleProgress(data, "missing")).toEqual({ total: 0, completed: 0, weightTotal: 0, weightCompleted: 0, percent: 0, points: 0, totalPoints: 0 });
  });
});

describe("planning: weight, dependencies and notifications", () => {
  it("links issues, derives blocked state and rejects self, duplicate and cyclic links", () => {
    const data = createSeed();
    expect(isIssueBlocked(data, data.issues["issue-143"])).toBe(true);
    expect(issueBlockers(data, "issue-143").map((link) => link.sourceIssueId)).toEqual(["issue-142"]);
    expect(() => applyCommand(data, { type: "issue.link", issueId: "issue-141", targetIssueId: "issue-141", linkType: "blocks" }, context)).toThrow(/itself/i);
    expect(() => applyCommand(data, { type: "issue.link", issueId: "issue-142", targetIssueId: "issue-143", linkType: "blocks" }, context)).toThrow(/already/i);
    expect(() => applyCommand(data, { type: "issue.link", issueId: "issue-146", targetIssueId: "issue-142", linkType: "blocks" }, context)).toThrow(/cycle/i);
    const linked = applyCommand(data, { type: "issue.link", issueId: "issue-141", targetIssueId: "issue-142", linkType: "blocks", id: "link-new" }, context);
    expect(linked.issueLinks["link-new"]).toMatchObject({ type: "blocks", sourceIssueId: "issue-141", targetIssueId: "issue-142" });
    const unlinked = applyCommand(linked, { type: "issue.unlink", id: "link-new" }, { now, mutationId: "unlink" });
    expect(unlinked.issueLinks["link-new"]).toBeUndefined();
  });

  it("removes links when either side is deleted and unblocks dependents on completion", () => {
    const data = createSeed();
    const deleted = applyCommand(data, { type: "issue.delete", id: "issue-142" }, context);
    expect(Object.values(deleted.issueLinks).some((link) => link.sourceIssueId === "issue-142" || link.targetIssueId === "issue-142")).toBe(false);
    const done = applyCommand(data, { type: "issue.move", id: "issue-142", status: "done" }, context);
    expect(isIssueBlocked(done, done.issues["issue-143"])).toBe(false);
    const notice = Object.values(done.notifications).find((entry) => entry.kind === "unblocked" && entry.issueId === "issue-143" && entry.userId === "user-sarah");
    expect(notice).toMatchObject({ userId: "user-sarah", readAt: null });
  });

  it("notifies assignees on create and update, but never the actor", () => {
    const created = applyCommand(createSeed(), { type: "issue.create", id: "delegated", input: { title: "Handoff", assigneeId: "user-sarah" } }, context);
    const assigned = Object.values(created.notifications).find((entry) => entry.issueId === "delegated");
    expect(assigned).toMatchObject({ kind: "assigned", userId: "user-sarah", readAt: null });
    const self = applyCommand(createSeed(), { type: "issue.create", id: "own", input: { title: "Mine", assigneeId: "user-oscar" } }, context);
    expect(Object.values(self.notifications).some((entry) => entry.issueId === "own")).toBe(false);
    const reassigned = applyCommand(created, { type: "issue.update", id: "delegated", patch: { assigneeId: "user-emma" } }, { now, mutationId: "reassign" });
    expect(Object.values(reassigned.notifications).some((entry) => entry.issueId === "delegated" && entry.userId === "user-emma")).toBe(true);
  });

  it("marks notifications read individually or in bulk, scoped to the actor", () => {
    const data = createSeed();
    const read = applyCommand(data, { type: "notification.read", id: "notification-seed-1" }, context);
    expect(read.notifications["notification-seed-1"].readAt).toBe(now);
    expect(read.notifications["notification-seed-2"].readAt).not.toBe(now);
    expect(() => applyCommand(read, { type: "notification.read", id: "notification-seed-1" }, { now, mutationId: "sarah-read", actorId: "user-sarah" })).toThrow(/own/i);
    const all = applyCommand(data, { type: "notifications.readAll" }, context);
    expect(Object.values(all.notifications).filter((entry) => entry.userId === "user-oscar").every((entry) => !!entry.readAt)).toBe(true);
  });

  it("weights progress by issue duration and fills actual dates on status transitions", () => {
    const data = createSeed();
    const projectId = data.issues["issue-141"].projectId!;
    const before = projectProgress(data, projectId);
    const beforeDuration = issueDuration(data.issues["issue-141"]);
    const weighted = applyCommand(data, { type: "issue.update", id: "issue-141", patch: { startDate: "2026-09-01", dueDate: "2026-09-10", status: "done" } }, context);
    const after = projectProgress(weighted, projectId);
    expect(after.weightTotal).toBe(before.weightTotal - beforeDuration + 10);
    expect(after.weightCompleted).toBe(before.weightCompleted + 10);
    expect(after.completed).toBe(before.completed + 1);
    expect(weighted.issues["issue-141"]).toMatchObject({ actualEndDate: "2026-09-09" });
    const started = applyCommand(data, { type: "issue.update", id: "issue-140", patch: { status: "in_progress" } }, context);
    expect(started.issues["issue-140"].startedAt).toBe(now);
    expect(issueSchedule(started.issues["issue-140"], "2026-09-09").actualPercent).toBe(50);
    expect(issueDuration(weighted.issues["issue-141"])).toBe(10);
    expect(issueDuration(started.issues["issue-140"])).toBe(1);
  });

  it("prevents starting a blocked issue until its blockers are done", () => {
    const data = createSeed();
    expect(() => applyCommand(data, { type: "issue.update", id: "issue-146", patch: { status: "in_progress" } }, context)).toThrow(/blocked/i);
    expect(() => applyCommand(data, { type: "issue.move", id: "issue-146", status: "done" }, context)).toThrow(/blocked/i);
    const first = applyCommand(data, { type: "issue.move", id: "issue-142", status: "done" }, context);
    expect(() => applyCommand(first, { type: "issue.move", id: "issue-146", status: "in_progress" }, { now, mutationId: "try-again" })).toThrow(/blocked/i);
    const second = applyCommand(first, { type: "issue.move", id: "issue-143", status: "done" }, { now, mutationId: "finish-143" });
    const started = applyCommand(second, { type: "issue.move", id: "issue-146", status: "in_progress" }, { now, mutationId: "start-146" });
    expect(started.issues["issue-146"]).toMatchObject({ status: "in_progress", startedAt: now });
  });

  it("migrates v2 snapshots to v3", () => {
    const data = createSeed() as unknown as Record<string, unknown>;
    const issues = data.issues as Record<string, Record<string, unknown>>;
    for (const issue of Object.values(issues)) delete issue.actualEndDate;
    issues["issue-142"].weight = 5;
    issues["issue-142"].actualStartDate = "2026-08-01";
    const filters = (data.savedViews as Record<string, { filters: Record<string, unknown> }>);
    for (const view of Object.values(filters)) delete view.filters.blocked;
    const v2 = { ...data, schemaVersion: 2, issueLinks: undefined, notifications: undefined };
    delete v2.issueLinks;
    delete v2.notifications;
    const migrated = validateSnapshot(v2);
    expect(migrated.schemaVersion).toBe(3);
    expect(migrated.issues["issue-142"]).toMatchObject({ actualEndDate: null });
    expect(migrated.issues["issue-142"]).not.toHaveProperty("weight");
    expect(migrated.issues["issue-142"]).not.toHaveProperty("actualStartDate");
    expect(migrated.issueLinks).toEqual({});
    expect(migrated.notifications).toEqual({});
    expect(migrated.savedViews["view-active"].filters.blocked).toBe("all");
  });
});
