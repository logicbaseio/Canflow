-- Canflow — Postgres schema (Neon). Idempotent: safe to run multiple times.
-- Run with: npm run db:setup   (uses DATABASE_URL)

CREATE TABLE IF NOT EXISTS boards (
  id            SERIAL PRIMARY KEY,
  title         TEXT NOT NULL,
  description   TEXT,
  color         TEXT,
  board_type    TEXT DEFAULT 'kanban',
  public_key    TEXT UNIQUE,
  is_public     BOOLEAN DEFAULT FALSE,
  public_theme  TEXT DEFAULT 'auto',
  invite_mode   TEXT DEFAULT 'none',
  owner_id      TEXT,          -- neon_auth.user.id of the board owner (null = legacy/shared)
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_boards_owner ON boards(owner_id);

CREATE TABLE IF NOT EXISTS columns (
  id          SERIAL PRIMARY KEY,
  board_id    INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  position    INTEGER NOT NULL,
  color       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tasks (
  id          SERIAL PRIMARY KEY,
  column_id   INTEGER NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  position    INTEGER NOT NULL,
  priority    TEXT,
  due_date    DATE,
  tags        TEXT,
  intensity   INTEGER DEFAULT 0,
  category    TEXT,
  image_url   TEXT,
  upvotes     INTEGER DEFAULT 0,
  downvotes   INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invitations (
  id          SERIAL PRIMARY KEY,
  board_id    INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  column_id   INTEGER,
  email       TEXT NOT NULL,
  invited_by  TEXT,
  token       TEXT NOT NULL,
  status      TEXT DEFAULT 'pending',
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS beta_categories (
  id          SERIAL PRIMARY KEY,
  board_id    INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       TEXT DEFAULT '#6b7280',
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id     TEXT PRIMARY KEY,
  org_name    TEXT,
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_columns_board ON columns(board_id);
CREATE INDEX IF NOT EXISTS idx_tasks_column ON tasks(column_id);
CREATE INDEX IF NOT EXISTS idx_invitations_board ON invitations(board_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_beta_categories_board ON beta_categories(board_id);

-- Starter board (only when the table is empty)
INSERT INTO boards (title, description, color, board_type, public_key, is_public, public_theme, invite_mode)
SELECT 'My First Board', 'A simple Kanban board to get started', '#1d1d1f', 'kanban', 'demo-kanban-0001', FALSE, 'auto', 'none'
WHERE NOT EXISTS (SELECT 1 FROM boards);

INSERT INTO columns (board_id, title, position, color)
SELECT b.id, c.title, c.position, c.color
FROM boards b
CROSS JOIN (VALUES ('To Do', 0, '#e2e8f0'), ('In Progress', 1, '#fef3c7'), ('Done', 2, '#d1fae5')) AS c(title, position, color)
WHERE b.public_key = 'demo-kanban-0001'
  AND NOT EXISTS (SELECT 1 FROM columns WHERE board_id = b.id);
