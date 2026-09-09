ALTER TABLE credentials ADD COLUMN role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member'));
ALTER TABLE credentials ADD COLUMN disabled boolean NOT NULL DEFAULT false;
UPDATE credentials SET role = 'admin' WHERE user_id = 'user-admin';
