-- Add pause support to task_sessions
ALTER TABLE "task_sessions"
  ADD COLUMN IF NOT EXISTS "is_paused" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "paused_since" timestamptz,
  ADD COLUMN IF NOT EXISTS "total_paused_minutes" real NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "sessions_is_paused_idx" ON "task_sessions" ("is_paused");
