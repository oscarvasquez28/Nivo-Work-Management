import { describe, expect, it } from "vitest";
import { createSeed } from "../../lib/data/seed";
import { assertCommandAccess, scopeSnapshot } from "../../lib/domain/permissions";
import { validateSnapshot } from "../../lib/domain/validation";

const member = { id: "user-olivia", access: "member" as const };

function fixture() {
  const data = createSeed();
  data.workspace.accessModel = "team";
  data.teams.engineering.visibility = "private";
  return data;
}

describe("team authorization", () => {
  it("hides private projects, issues, cycles and activity with valid references", () => {
    const scoped = scopeSnapshot(fixture(), member);
    expect(scoped.projects["nivo-2"]).toBeUndefined();
    expect(scoped.issues["issue-142"]).toBeUndefined();
    expect(scoped.cycles["cycle-24"]).toBeUndefined();
    expect(scoped.currentUserId).toBe(member.id);
    expect(validateSnapshot(scoped)).toEqual(scoped);
  });
  it("grants administrators workspace-wide visibility, including private teams", () => {
    const scoped = scopeSnapshot(fixture(), { ...member, access: "admin" });
    expect(scoped.issues["issue-142"]).toBeDefined();
    expect(scoped.projects["nivo-2"]).toBeDefined();
    expect(scoped.cycles["cycle-24"]).toBeDefined();
    expect(validateSnapshot(scoped)).toEqual(scoped);
  });
  it("lets members create in public teams but rejects private sources and destinations", () => {
    const data = fixture();
    expect(() => assertCommandAccess(data, member, { type: "issue.create", input: { title: "Public", teamId: "product" } })).not.toThrow();
    expect(() => assertCommandAccess(data, member, { type: "issue.update", id: "issue-142", patch: { title: "Hidden" } })).toThrow();
    expect(() => assertCommandAccess(data, member, { type: "issue.create", input: { title: "Private", projectId: "nivo-2" } })).toThrow();
    expect(() => assertCommandAccess(data, member, { type: "cycle.close", id: "cycle-24" })).toThrow();
  });
  it("does not grant team access through project membership", () => {
    const data = fixture();
    data.projects["nivo-2"].memberIds.push(member.id);
    expect(scopeSnapshot(data, member).projects["nivo-2"]).toBeUndefined();
  });
  it("keeps legacy project restrictions and filters saved view references", () => {
    const data = fixture();
    data.workspace.accessModel = "project_legacy";
    data.savedViews["view-active"].filters.projects = ["nivo-2"];
    const scoped = scopeSnapshot(data, member);
    expect(scoped.projects["nivo-2"]).toBeUndefined();
    expect(scoped.savedViews["view-active"]).toBeUndefined();
    expect(validateSnapshot(scoped)).toEqual(scoped);
  });
});
