CREATE TABLE installation_state (
  id integer PRIMARY KEY CHECK (id = 1),
  completed_at timestamptz
);
INSERT INTO installation_state (id, completed_at)
VALUES (1, CASE WHEN EXISTS (SELECT 1 FROM credentials) THEN now() ELSE NULL END);

ALTER TABLE workspaces ADD COLUMN timezone text NOT NULL DEFAULT 'UTC';
ALTER TABLE workspaces ADD COLUMN access_model text NOT NULL DEFAULT 'project_legacy' CHECK (access_model IN ('project_legacy', 'team'));
ALTER TABLE teams ADD COLUMN visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('public', 'private'));
ALTER TABLE user_teams ADD COLUMN access text NOT NULL DEFAULT 'member' CHECK (access IN ('owner', 'member'));
UPDATE user_teams SET access = 'owner' WHERE user_id IN (SELECT user_id FROM credentials WHERE role = 'admin' AND NOT disabled);

CREATE UNIQUE INDEX credentials_email_normalized_idx ON credentials (lower(trim(email)));
CREATE UNIQUE INDEX teams_workspace_key_idx ON teams (workspace_id, upper(trim(key)));

ALTER TABLE saved_views ADD COLUMN owner_id text REFERENCES users(id);
ALTER TABLE saved_views ADD COLUMN team_id text REFERENCES teams(id);
ALTER TABLE saved_views ADD COLUMN visibility text NOT NULL DEFAULT 'workspace' CHECK (visibility IN ('personal', 'team', 'workspace'));
UPDATE saved_views SET owner_id = (SELECT current_user_id FROM workspaces WHERE id = saved_views.workspace_id);

CREATE TABLE admin_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id),
  actor_id text NOT NULL REFERENCES users(id),
  action text NOT NULL,
  resource_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
