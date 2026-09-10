import { EMPTY_FILTERS, type Issue, type Project, type Status, type User, type WorkspaceData } from "../../types/domain";

const titles = {
  "nivo-2": [
    "Build the workspace navigation shell", "Design a faster issue creation flow", "Add inline priority editing", "Persist board column ordering", "Support bulk issue assignment", "Refine the issue detail panel", "Add workspace-wide search", "Improve empty state copy", "Build saved issue views", "Add project health indicators", "Support Markdown in descriptions", "Introduce cycle planning", "Improve filter chip interactions", "Add keyboard-accessible menus", "Fix sidebar state on narrow screens", "Add issue activity history", "Handle offline storage gracefully", "Build project membership controls", "Refine date picker accessibility", "Add optimistic status updates", "Preserve filters on navigation", "Support issue soft deletion", "Create a focused My issues view", "Add issue estimates", "Improve board drag feedback", "Make project links shareable", "Tighten list row spacing", "Add loading skeletons to issue lists", "Improve unsaved changes feedback", "Support project archiving", "Add overdue work to the home page", "Improve command search ranking", "Add cycle completion summaries", "Audit high contrast colors", "Test cross-tab workspace updates", "Refine the new workspace experience", "Improve assignee picker search", "Add reliable mutation retries", "Make table headers sticky", "Polish the issue creation confirmation",
  ],
  mobile: [
    "Define the mobile navigation model", "Build the mobile issue list", "Create touch-friendly issue actions", "Design a compact project header", "Improve bottom sheet gestures", "Add mobile search entry point", "Fix safe-area padding on iOS", "Optimize issue detail for small screens", "Prototype quick status changes", "Audit touch target sizes", "Handle virtual keyboard resize", "Keep filter controls within reach", "Improve comment composer on mobile", "Preserve scroll after issue updates", "Optimize avatar rendering", "Reduce initial JavaScript payload", "Improve mobile loading feedback", "Support landscape navigation", "Test Android browser behavior", "Refine mobile empty states", "Fix overflowing issue titles", "Add accessible mobile menus", "Improve swipe cancellation", "Create responsive cycle summaries", "Review mobile typography scale", "Improve slow connection recovery", "Make due date selection easier", "Test tablet split-view layouts", "Reduce layout shifts on navigation", "Simplify the mobile create flow", "Improve focus restoration on sheets", "Audit reduced motion on mobile", "Fix sticky footer overlap", "Document mobile interaction patterns", "Prepare mobile usability sessions",
  ],
  "developer-experience": [
    "Set up strict TypeScript checks", "Create shared domain fixtures", "Add snapshot validation tests", "Speed up the local development server", "Document repository conventions", "Add transactional persistence adapter", "Create a memory repository for tests", "Add continuous integration checks", "Improve domain error messages", "Test optimistic update recovery", "Add browser smoke tests", "Reduce duplicate dependency bundles", "Create accessible component test helpers", "Improve test fixture determinism", "Add revision conflict coverage", "Document command mutation contracts", "Audit package security advisories", "Improve lint feedback in CI", "Build a shared date utility", "Test schema version recovery", "Add keyboard interaction tests", "Create pull request quality checks", "Improve build caching", "Audit client-server boundaries", "Test IndexedDB quota failures", "Document local persistence limits", "Add mutation receipt deduplication", "Improve development error screens", "Measure initial route performance", "Add navigation regression tests", "Simplify workspace store subscriptions", "Test cycle boundary conditions", "Improve contributor onboarding", "Audit effect cleanup behavior", "Prepare the release checklist",
  ],
  "design-system": [
    "Define semantic color tokens", "Build the button component family", "Create a compact status badge", "Refine typography and spacing", "Design accessible dialog primitives", "Add avatar group overflow", "Build the project icon set", "Define motion timing tokens", "Improve form validation styles", "Create a consistent empty state", "Refine hover and focus treatments", "Build responsive table patterns", "Audit light theme contrast", "Create a reusable progress bar", "Design the command palette surface", "Improve checkbox alignment", "Create inline metadata controls", "Document destructive action patterns", "Refine toast placement and timing", "Build a contextual menu system", "Align icon stroke weights", "Create a filter popover pattern", "Improve loading shimmer treatment", "Design a compact date label", "Audit screen reader field labels", "Build the cycle timeline summary", "Create accessible tooltip patterns", "Improve disabled control contrast", "Document density guidelines", "Refine the sidebar active state", "Create consistent skeleton layouts", "Improve long-label truncation", "Audit animation preferences", "Publish the component usage guide", "Prepare design quality review", "Unify border and surface tokens", "Refine the mobile dialog layout", "Build a compact priority picker", "Review project card composition", "Finalize the product visual language",
  ],
};

export function createSeed(anchor = "2026-09-09"): WorkspaceData {
  const date = anchor.slice(0, 10);
  const time = Date.parse(`${date}T12:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== date) throw new Error("Invalid seed anchor date");
  const day = (offset: number) => new Date(time + offset * 86400000).toISOString().slice(0, 10);
  const instant = (offset: number, hour = 12) => `${day(offset)}T${String(hour).padStart(2, "0")}:00:00.000Z`;
  const people: [string, string, string, string, string[]][] = [
    ["oscar", "Oscar Wilson", "#b1a0ef", "Product engineer", ["engineering", "product"]],
    ["sarah", "Sarah Chen", "#dda88d", "Engineering lead", ["engineering"]],
    ["marcus", "Marcus Johnson", "#7eb4c8", "Frontend engineer", ["engineering"]],
    ["emma", "Emma Davis", "#d4a5c5", "Product designer", ["design", "product"]],
    ["alex", "Alex Rivera", "#9dbca2", "Platform engineer", ["engineering"]],
    ["sophie", "Sophie Martin", "#e0bd78", "Product manager", ["product"]],
    ["james", "James Park", "#85a4d2", "Mobile engineer", ["product", "engineering"]],
    ["mia", "Mia Thompson", "#c1a2d6", "Design lead", ["design"]],
    ["daniel", "Daniel Kim", "#82b7ae", "Developer experience", ["engineering"]],
    ["olivia", "Olivia Brooks", "#d9979e", "Growth lead", ["growth"]],
    ["leo", "Leo Andersson", "#a7b880", "Quality engineer", ["engineering", "product"]],
    ["ava", "Ava Patel", "#c6ab88", "Product marketing", ["growth", "design"]],
  ];
  const users = Object.fromEntries(people.map(([slug, name, color, role, teamIds]): [string, User] => [`user-${slug}`, { id: `user-${slug}`, name, color, role, teamIds, initials: name.split(" ").map((part) => part[0]).join("") }]));
  const labelNames = ["Feature", "Bug", "Improvement", "Design", "Frontend", "Backend", "Accessibility", "Performance", "Mobile", "Infrastructure", "Documentation", "Research", "Polish", "Security", "Testing", "Customer feedback"];
  const colors = ["#9c8dd7", "#dc8f95", "#86b8a5", "#ce9ec3", "#88a7d6", "#c0a27c", "#d4b276", "#91b6c0"];
  const labels = Object.fromEntries(labelNames.map((name, index) => {
    const id = name.toLowerCase().replaceAll(" ", "-");
    return [id, { id, name, color: colors[index % colors.length] }];
  }));
  const projectRows: [string, string, string, string, string, string, string[], string][] = [
    ["nivo-2", "Nivo 2.0", "engineering", "layers", "#a99ae4", "user-sarah", ["user-oscar", "user-marcus", "user-emma", "user-alex", "user-leo"], "A calmer, more connected workspace for the way modern teams build. Bring issues, projects, and cycles together without the noise."],
    ["mobile", "Mobile App", "product", "smartphone", "#87b7cb", "user-sophie", ["user-james", "user-oscar", "user-emma", "user-leo"], "Make meaningful progress from anywhere. A focused mobile experience for reviewing work, sharing context, and keeping the team moving."],
    ["developer-experience", "Developer Experience", "engineering", "terminal", "#c5ad79", "user-daniel", ["user-alex", "user-sarah", "user-marcus", "user-leo"], "Give the team a fast, dependable foundation. Improve local tooling, test coverage, persistence reliability, and the path from idea to release."],
    ["design-system", "Design System", "design", "shapes", "#c3a0cc", "user-mia", ["user-emma", "user-ava", "user-marcus"], "One coherent visual language, built with care. Accessible components and considered interaction patterns that make Nivo feel effortless."],
  ];
  const projects = Object.fromEntries(projectRows.map(([id, name, teamId, icon, color, leadId, memberIds, description], index): [string, Project] => [id, { id, name, teamId, icon, color, leadId, memberIds: [leadId, ...memberIds], description, status: "in_progress", health: index === 1 ? "at_risk" : "on_track", startDate: day(-65 + index * 7), targetDate: day(21 + index * 14), createdAt: instant(-90), updatedAt: instant(-index), archivedAt: null }]));
  const data: WorkspaceData = {
    schemaVersion: 2, revision: 0,
    workspace: { id: "nivo-labs", name: "Nivo Labs", issuePrefix: "NIV", nextIssueNumber: 151, seedAnchorDate: date, timezone: "UTC", accessModel: "team" }, currentUserId: "user-oscar", users,
    teams: {
      engineering: { id: "engineering", name: "Engineering", key: "ENG", wipLimit: 12, visibility: "public", ownerIds: ["user-sarah"] },
      product: { id: "product", name: "Product", key: "PRD", wipLimit: 8, visibility: "public", ownerIds: ["user-sophie"] },
      design: { id: "design", name: "Design", key: "DSN", wipLimit: 6, visibility: "public", ownerIds: ["user-mia"] },
      growth: { id: "growth", name: "Growth", key: "GRO", wipLimit: 5, visibility: "public", ownerIds: ["user-olivia"] },
    },
    labels, projects,
    cycles: {
      "cycle-23": { id: "cycle-23", name: "Cycle 23", goal: "Lay the groundwork for the new issue experience.", teamId: "engineering", startDate: day(-21), endDate: day(-8), closedAt: instant(-7), snapshot: null },
      "cycle-24": { id: "cycle-24", name: "Cycle 24", goal: "Make the core issue workflow feel fast, connected, and dependable.", teamId: "engineering", startDate: day(-7), endDate: day(6), closedAt: null, snapshot: null },
      "cycle-25": { id: "cycle-25", name: "Cycle 25", goal: "Polish project planning and prepare for the next release.", teamId: "engineering", startDate: day(7), endDate: day(20), closedAt: null, snapshot: null },
      "cycle-mobile-8": { id: "cycle-mobile-8", name: "Mobile cycle 8", goal: "Validate the compact issue flow across phones and tablets.", teamId: "product", startDate: day(-7), endDate: day(6), closedAt: null, snapshot: null },
      "cycle-mobile-9": { id: "cycle-mobile-9", name: "Mobile cycle 9", goal: "Address usability feedback and interaction edge cases.", teamId: "product", startDate: day(7), endDate: day(20), closedAt: null, snapshot: null },
      "cycle-design-12": { id: "cycle-design-12", name: "Design cycle 12", goal: "Ship the foundational components and interaction guidelines.", teamId: "design", startDate: day(-7), endDate: day(6), closedAt: null, snapshot: null },
    },
    issues: {}, comments: {}, activities: {}, savedViews: {}, appliedMutations: [],
  };
  const statuses: Status[] = ["done", "done", "in_progress", "todo", "in_review", "backlog", "in_progress", "todo", "done", "backlog"];
  const userIds = Object.keys(users);
  const labelIds = Object.keys(labels);
  const projectIds = Object.keys(projects) as (keyof typeof titles)[];
  const offsets = Object.fromEntries(projectIds.map((id) => [id, 0]));
  for (let number = 1; number <= 150; number++) {
    const projectId = projectIds[(number - 1) % projectIds.length];
    const project = projects[projectId];
    const title = titles[projectId][offsets[projectId]++ % titles[projectId].length];
    const status = statuses[(number + Math.floor(number / 4)) % statuses.length];
    const createdOffset = -82 + Math.floor(number / 2);
    const completedOffset = -(number % 7);
    const isUnprojected = number % 23 === 0;
    const teamId = isUnprojected ? "growth" : project.teamId;
    const cycleId = number % 5 === 0 || isUnprojected ? null : teamId === "engineering" ? (number % 7 === 0 ? "cycle-23" : status === "backlog" ? "cycle-25" : "cycle-24") : teamId === "product" ? (status === "backlog" ? "cycle-mobile-9" : "cycle-mobile-8") : "cycle-design-12";
    const completedAt = status === "done" ? instant(cycleId === "cycle-23" ? -9 : completedOffset, 10) : null;
    const issue: Issue = {
      id: `issue-${number}`, identifier: `NIV-${number}`, title,
      description: `## Context\n\n${project.description}\n\n${title} to make the everyday workflow more useful and predictable.\n\n## Acceptance criteria\n\n- [${status === "done" ? "x" : " "}] Cover the primary interaction and its empty state\n- [${status === "done" ? "x" : " "}] Verify keyboard access and responsive behavior\n- [${status === "done" ? "x" : " "}] Add regression coverage and share a review with the team`,
      teamId, projectId: isUnprojected ? null : projectId, status,
      priority: (["medium", "high", "low", "medium", "none", "high", "urgent"] as const)[number % 7],
      assigneeId: number % 9 === 0 ? null : number % 4 === 0 || number === 142 ? "user-oscar" : project.memberIds[number % project.memberIds.length], reporterId: userIds[number % userIds.length], cycleId,
      labelIds: [...new Set([labelIds[number % labelIds.length], projectId === "mobile" ? "mobile" : projectId === "design-system" ? "design" : number % 3 === 0 ? "improvement" : "feature"])],
      estimate: ([null, 1, 2, 3, 5, 8, 0, 2, 3] as const)[number % 9],
      startDate: number % 3 === 0 ? day(Math.max(createdOffset, -14)) : null,
      dueDate: number % 4 === 0 ? null : day((number % 22) - 6),
      order: number * 1024, createdAt: instant(createdOffset, 9), updatedAt: completedAt ?? instant(-(number % 6), 10),
      startedAt: ["in_progress", "in_review", "done"].includes(status) ? instant(Math.max(createdOffset, cycleId === "cycle-23" ? -16 : -12), 10) : null,
      completedAt, deletedAt: null,
    };
    if (issue.startDate && issue.dueDate && issue.startDate > issue.dueDate) issue.startDate = issue.dueDate;
    data.issues[issue.id] = issue;
    const activityId = `activity-seed-${number}`;
    data.activities[activityId] = { id: activityId, issueId: issue.id, projectId: issue.projectId, cycleId: issue.cycleId, actorId: issue.assigneeId ?? issue.reporterId, message: status === "done" ? `completed ${issue.identifier}` : status === "in_review" ? `moved ${issue.identifier} to In Review` : status === "in_progress" ? `started work on ${issue.identifier}` : `created ${issue.identifier}`, createdAt: issue.updatedAt };
    if (number % 3 === 0 || number === 142) {
      const commentId = `comment-${number}-1`;
      const body = number % 2 === 0 ? "The interaction is ready for a first pass. I’ve checked the keyboard flow and noted the remaining edge cases in the acceptance criteria." : "Thanks for writing this up. Let’s keep the first iteration focused and make sure the empty and loading states get the same attention as the happy path.";
      data.comments[commentId] = { id: commentId, issueId: issue.id, authorId: issue.reporterId, body, createdAt: instant(-Math.min(number % 5 + 1, 6), 11), editedAt: null };
      const replyId = `comment-${number}-2`;
      data.comments[replyId] = { id: replyId, issueId: issue.id, authorId: number === 142 ? "user-oscar" : issue.assigneeId ?? "user-sarah", body: status === "done" ? "Verified the final behavior and added coverage. This is ready to ship." : "Agreed. I’ll share an update once the remaining details are ready for review.", createdAt: instant(-(number % 3), 12), editedAt: null };
    }
  }
  const featured = ["Implement command palette", "Improve issue loading state", "Add project timeline", "Fix keyboard navigation", "Redesign project overview"];
  featured.forEach((title, index) => {
    const issue = data.issues[`issue-${142 + index}`];
    issue.title = title;
    issue.projectId = "nivo-2";
    issue.teamId = "engineering";
    issue.cycleId = index === 2 ? "cycle-25" : "cycle-24";
    issue.status = index === 0 ? "in_progress" : index === 2 ? "backlog" : index === 3 ? "in_review" : "todo";
    issue.assigneeId = index === 0 ? "user-oscar" : ["user-sarah", "user-marcus", "user-emma", "user-alex"][index - 1];
    issue.completedAt = null;
    issue.startedAt = ["in_progress", "in_review"].includes(issue.status) ? instant(-3, 10) : null;
    issue.description = `## Why this matters\n\n${title} is part of making Nivo 2.0 a calmer, more focused place to work.\n\n## Scope\n\n${index === 0 ? "One fast entry point for finding issues, projects, cycles, and teammates. Support Cmd/Ctrl + K, clear grouped results, and accessible keyboard navigation." : "Bring the interaction in line with the new workspace patterns. Keep the first iteration focused, accessible, and easy to understand."}\n\n## Acceptance criteria\n\n- [x] Align on the interaction with design\n- [ ] Complete the primary implementation\n- [ ] Verify loading, empty, and error states\n- [ ] Add regression coverage`;
    const activity = data.activities[`activity-seed-${142 + index}`];
    activity.projectId = issue.projectId;
    activity.cycleId = issue.cycleId;
    activity.actorId = issue.assigneeId ?? issue.reporterId;
    activity.message = index === 0 ? `started work on ${issue.identifier}` : `updated ${issue.identifier}`;
  });
  const previous = Object.values(data.issues).filter((issue) => issue.cycleId === "cycle-23");
  data.cycles["cycle-23"].snapshot = { total: previous.length, completed: previous.filter((issue) => issue.status === "done").length, points: previous.reduce((sum, issue) => sum + (issue.status === "done" ? issue.estimate ?? 0 : 0), 0), totalPoints: previous.reduce((sum, issue) => sum + (issue.estimate ?? 0), 0) };
  data.savedViews["view-active"] = { id: "view-active", name: "Active work", filters: { ...EMPTY_FILTERS, statuses: ["in_progress", "in_review"] }, sort: "priority", group: "status", layout: "list" };
  data.savedViews["view-high-priority"] = { id: "view-high-priority", name: "High priority", filters: { ...EMPTY_FILTERS, priorities: ["urgent", "high"], excludeDone: true }, sort: "priority", group: "project", layout: "list" };
  return data;
}
