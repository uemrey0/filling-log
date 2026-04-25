CREATE TABLE "personnel_comments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "personnel_id" uuid NOT NULL REFERENCES "personnel"("id") ON DELETE CASCADE,
  "content" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "comments_personnel_idx" ON "personnel_comments" ("personnel_id");

CREATE TABLE "personnel_ratings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "personnel_id" uuid NOT NULL REFERENCES "personnel"("id") ON DELETE CASCADE,
  "task_id" uuid REFERENCES "tasks"("id") ON DELETE SET NULL,
  "speed_score" integer NOT NULL,
  "quality_score" integer NOT NULL,
  "attitude_score" integer NOT NULL,
  "comment" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "ratings_personnel_idx" ON "personnel_ratings" ("personnel_id");
