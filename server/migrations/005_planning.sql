-- Planning extensions: issue weight, actual dates, issue links and notifications.
ALTER TABLE issues ADD COLUMN weight integer;
ALTER TABLE issues ADD COLUMN actual_start_date date;
ALTER TABLE issues ADD COLUMN actual_end_date date;

CREATE TABLE issue_links (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id),
  type text NOT NULL CHECK (type IN ('blocks','relates_to')),
  source_issue_id text NOT NULL REFERENCES issues(id),
  target_issue_id text NOT NULL REFERENCES issues(id),
  created_at timestamptz NOT NULL,
  UNIQUE (source_issue_id, target_issue_id, type)
);
CREATE INDEX issue_links_source_idx ON issue_links (source_issue_id);
CREATE INDEX issue_links_target_idx ON issue_links (target_issue_id);

CREATE TABLE notifications (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id),
  user_id text NOT NULL REFERENCES users(id),
  issue_id text REFERENCES issues(id),
  kind text NOT NULL CHECK (kind IN ('assigned','unblocked')),
  message text NOT NULL,
  created_at timestamptz NOT NULL,
  read_at timestamptz
);
CREATE INDEX notifications_user_unread_idx ON notifications (user_id) WHERE read_at IS NULL;
