ALTER TABLE "tasks"
  ADD COLUMN IF NOT EXISTS "discount_container" boolean NOT NULL DEFAULT false;
