-- Nivo workspace schema. Entity columns mirror types/domain.ts.
-- Migrations run inside a transaction (see src/migrate.ts).
CREATE TABLE workspaces (
  id text PRIMARY KEY,
  name text NOT NULL,
  issue_prefix text NOT NULL,
  next_issue_number integer NOT NULL CHECK (next_issue_number > 0),
  seed_anchor_date date NOT NULL,
  current_user_id text NOT NULL,
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  applied_mutations text[] NOT NULL DEFAULT '{}'
);

CREATE TABLE teams (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id),
  name text NOT NULL,
  key text NOT NULL,
  wip_limit integer NOT NULL CHECK (wip_limit >= 0)
);

CREATE TABLE users (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id),
  name text NOT NULL,
  initials text NOT NULL,
  color text NOT NULL,
  role text NOT NULL
);

CREATE TABLE user_teams (
  workspace_id text NOT NULL REFERENCES workspaces(id),
  user_id text NOT NULL REFERENCES users(id),
  team_id text NOT NULL REFERENCES teams(id),
  PRIMARY KEY (user_id, team_id)
);

CREATE TABLE labels (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id),
  name text NOT NULL,
  color text NOT NULL
);

CREATE TABLE projects (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id),
  name text NOT NULL,
  description text NOT NULL,
  team_id text NOT NULL REFERENCES teams(id),
  icon text NOT NULL,
  color text NOT NULL,
  status text NOT NULL CHECK (status IN ('planned','in_progress','paused','completed')),
  health text NOT NULL CHECK (health IN ('on_track','at_risk','off_track')),
  lead_id text NOT NULL REFERENCES users(id),
  start_date date,
  target_date date,
  archived_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE project_members (
  workspace_id text NOT NULL REFERENCES workspaces(id),
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id),
  PRIMARY KEY (project_id, user_id)
);

CREATE TABLE cycles (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id),
  name text NOT NULL,
  goal text NOT NULL,
  team_id text NOT NULL REFERENCES teams(id),
  start_date date NOT NULL,
  end_date date NOT NULL,
  closed_at timestamptz,
  snapshot jsonb
);

CREATE TABLE issues (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id),
  identifier text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  team_id text NOT NULL REFERENCES teams(id),
  project_id text REFERENCES projects(id),
  status text NOT NULL CHECK (status IN ('backlog','todo','in_progress','in_review','done')),
  priority text NOT NULL CHECK (priority IN ('none','urgent','high','medium','low')),
  assignee_id text REFERENCES users(id),
  reporter_id text NOT NULL REFERENCES users(id),
  cycle_id text REFERENCES cycles(id),
  estimate integer,
  start_date date,
  due_date date,
  "order" double precision NOT NULL,
  started_at timestamptz,
  completed_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  UNIQUE (workspace_id, identifier)
);
CREATE INDEX issues_project_idx ON issues (project_id) WHERE project_id IS NOT NULL;
CREATE INDEX issues_cycle_idx ON issues (cycle_id) WHERE cycle_id IS NOT NULL;
CREATE INDEX issues_assignee_idx ON issues (assignee_id) WHERE assignee_id IS NOT NULL;
CREATE INDEX issues_status_idx ON issues (status);
CREATE INDEX issues_active_idx ON issues (status, "order") WHERE deleted_at IS NULL;

CREATE TABLE issue_labels (
  workspace_id text NOT NULL REFERENCES workspaces(id),
  issue_id text NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  label_id text NOT NULL REFERENCES labels(id),
  PRIMARY KEY (issue_id, label_id)
);

CREATE TABLE comments (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id),
  issue_id text NOT NULL REFERENCES issues(id),
  author_id text NOT NULL REFERENCES users(id),
  body text NOT NULL,
  created_at timestamptz NOT NULL,
  edited_at timestamptz
);
CREATE INDEX comments_issue_idx ON comments (issue_id);

CREATE TABLE activities (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id),
  issue_id text REFERENCES issues(id),
  project_id text REFERENCES projects(id),
  cycle_id text REFERENCES cycles(id),
  actor_id text NOT NULL REFERENCES users(id),
  message text NOT NULL,
  created_at timestamptz NOT NULL
);
CREATE INDEX activities_created_idx ON activities (created_at DESC);
CREATE INDEX activities_issue_idx ON activities (issue_id) WHERE issue_id IS NOT NULL;
CREATE INDEX activities_project_idx ON activities (project_id) WHERE project_id IS NOT NULL;

CREATE TABLE saved_views (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id),
  name text NOT NULL,
  filters jsonb NOT NULL,
  sort text NOT NULL,
  "group" text NOT NULL,
  layout text NOT NULL
);
