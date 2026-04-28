CREATE TABLE "personnel_department_daily_stats" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "personnel_id" uuid NOT NULL,
  "work_date" date NOT NULL,
  "department" varchar(50) NOT NULL,
  "session_count" integer NOT NULL DEFAULT 0,
  "actual_minutes_sum" real NOT NULL DEFAULT 0,
  "expected_minutes_sum" real NOT NULL DEFAULT 0,
  "diff_minutes_sum" real NOT NULL DEFAULT 0,
  "actual_per_colli_sum" real NOT NULL DEFAULT 0,
  "actual_per_colli_count" integer NOT NULL DEFAULT 0,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "personnel_department_daily_stats"
  ADD CONSTRAINT "personnel_department_daily_stats_personnel_id_fk"
  FOREIGN KEY ("personnel_id") REFERENCES "personnel"("id") ON DELETE cascade;

CREATE UNIQUE INDEX "personnel_department_daily_stats_unique"
  ON "personnel_department_daily_stats" ("personnel_id", "work_date", "department");

CREATE INDEX "personnel_department_daily_stats_personnel_idx"
  ON "personnel_department_daily_stats" ("personnel_id");

CREATE INDEX "personnel_department_daily_stats_date_idx"
  ON "personnel_department_daily_stats" ("work_date");

CREATE INDEX "personnel_department_daily_stats_dept_idx"
  ON "personnel_department_daily_stats" ("department");
