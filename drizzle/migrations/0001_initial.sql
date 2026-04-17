CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS "personnel" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "full_name" varchar(255) NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "notes" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "personnel_is_active_idx" ON "personnel" ("is_active");

CREATE TABLE IF NOT EXISTS "tasks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "department" varchar(50) NOT NULL,
  "colli_count" integer NOT NULL,
  "expected_minutes" integer NOT NULL,
  "notes" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "tasks_department_idx" ON "tasks" ("department");

CREATE TABLE IF NOT EXISTS "task_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "task_id" uuid NOT NULL REFERENCES "tasks"("id") ON DELETE CASCADE,
  "personnel_id" uuid NOT NULL REFERENCES "personnel"("id") ON DELETE RESTRICT,
  "started_at" timestamptz NOT NULL DEFAULT now(),
  "ended_at" timestamptz,
  "work_date" date NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "sessions_personnel_idx" ON "task_sessions" ("personnel_id");
CREATE INDEX IF NOT EXISTS "sessions_task_idx" ON "task_sessions" ("task_id");
CREATE INDEX IF NOT EXISTS "sessions_work_date_idx" ON "task_sessions" ("work_date");
CREATE INDEX IF NOT EXISTS "sessions_ended_at_idx" ON "task_sessions" ("ended_at");
