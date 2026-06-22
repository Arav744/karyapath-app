-- Karyapath schema for Supabase / Postgres.
-- Run this once in the Supabase SQL Editor before pointing the server
-- at your project. Safe to re-run: uses IF NOT EXISTS / drop-and-recreate
-- only where harmless.

create table if not exists users (
  id            text primary key,        -- login id, e.g. 'rajat', 'admin'
  password      text not null,           -- plain text for this demo - see note below
  display_name  text not null,
  phone         text,                    -- E.164 format, used for WhatsApp poke links
  is_admin      boolean not null default false,
  created_at    timestamptz not null default now()
);

create table if not exists workspaces (
  id            bigserial primary key,
  name          text not null,
  color         text not null default '#5b93ff',
  owner_id      text not null references users(id),
  parent_id     bigint references workspaces(id), -- null = top-level; set = private sub-workspace
  created_at    timestamptz not null default now()
);

create table if not exists memberships (
  workspace_id  bigint not null references workspaces(id) on delete cascade,
  user_id       text not null references users(id) on delete cascade,
  primary key (workspace_id, user_id)
);

create table if not exists tasks (
  id            bigserial primary key,
  workspace_id  bigint not null references workspaces(id) on delete cascade,
  name          text not null,
  priority      text not null default 'Medium', -- High | Medium | Low
  due_date      date,
  due_time      time,                    -- paired with due_date; null = end-of-day (23:59) for alert purposes
  status        text not null default 'Ready to start', -- Ready to start | In progress | Waiting for review | Done
  notes         text default '',
  attachments   integer default 0,
  archived_at   date,
  created_at    timestamptz not null default now()
);

create table if not exists task_assignees (
  task_id       bigint not null references tasks(id) on delete cascade,
  user_id       text not null references users(id) on delete cascade,
  primary key (task_id, user_id)
);

create table if not exists pokes (
  id            bigserial primary key,
  task_id       bigint not null references tasks(id) on delete cascade,
  by_user_id    text not null references users(id),
  to_user_id    text not null references users(id),
  at            timestamptz not null default now()
);

-- One row per (assignee, due-date escalation step) notification that
-- has actually fired. The in-app bell reads from here.
create table if not exists notifications (
  id            bigserial primary key,
  user_id       text not null references users(id) on delete cascade,
  task_id       bigint not null references tasks(id) on delete cascade,
  threshold_key text not null,    -- e.g. '1d', '12h', '6h', '3h', '1h', '30m', '15m', 'overdue:1', 'overdue:2', ...
  message       text not null,
  created_at    timestamptz not null default now(),
  read_at       timestamptz
);

-- Tracks which (task_id, user_id, threshold_key) combinations have
-- already fired, so the 5-minute scheduler sweep never sends the same
-- escalation step twice. Cleared automatically when a task is marked
-- Done, archived, or its due date/time changes (see lib/alerts.js).
create table if not exists sent_alerts (
  task_id       bigint not null references tasks(id) on delete cascade,
  user_id       text not null references users(id) on delete cascade,
  threshold_key text not null,
  sent_at       timestamptz not null default now(),
  primary key (task_id, user_id, threshold_key)
);

create index if not exists idx_notifications_user on notifications(user_id, read_at);
create index if not exists idx_workspaces_parent on workspaces(parent_id);
create index if not exists idx_tasks_workspace on tasks(workspace_id);
create index if not exists idx_pokes_task on pokes(task_id);

-- NOTE on passwords: this app does its own login check inside the
-- Express server (server/lib/auth.js) rather than using Supabase Auth,
-- so passwords here are stored as plain text for demo simplicity. This
-- is NOT production-safe. Before any real deployment, replace this with
-- bcrypt-hashed passwords (or migrate to Supabase Auth properly) - see
-- the comment in server/lib/auth.js for exactly where to change it.

-- Row Level Security is intentionally left OFF on these tables. The
-- server connects with the service_role key and enforces all access
-- rules (membership, private-workspace ownership, admin override) in
-- application code - see server/lib/access.js. If you later expose
-- Supabase directly to a browser client, you must add RLS policies
-- first; do not skip that step.
