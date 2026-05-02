CREATE TABLE IF NOT EXISTS "auth_user" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "email_verified" boolean DEFAULT false NOT NULL,
  "image" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "username" text,
  "display_username" text,
  "role" text DEFAULT 'user' NOT NULL,
  "banned" boolean DEFAULT false NOT NULL,
  "ban_reason" text,
  "ban_expires" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "auth_session" (
  "id" text PRIMARY KEY NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "token" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "ip_address" text,
  "user_agent" text,
  "user_id" text NOT NULL,
  "impersonated_by" text,
  CONSTRAINT "auth_session_user_id_auth_user_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "auth_user"("id") ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS "auth_account" (
  "id" text PRIMARY KEY NOT NULL,
  "account_id" text NOT NULL,
  "provider_id" text NOT NULL,
  "user_id" text NOT NULL,
  "access_token" text,
  "refresh_token" text,
  "id_token" text,
  "access_token_expires_at" timestamp with time zone,
  "refresh_token_expires_at" timestamp with time zone,
  "scope" text,
  "password" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "auth_account_user_id_auth_user_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "auth_user"("id") ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS "auth_verification" (
  "id" text PRIMARY KEY NOT NULL,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "auth_user_email_idx" ON "auth_user" ("email");
CREATE UNIQUE INDEX IF NOT EXISTS "auth_user_username_idx" ON "auth_user" ("username");
CREATE INDEX IF NOT EXISTS "auth_user_role_idx" ON "auth_user" ("role");
CREATE UNIQUE INDEX IF NOT EXISTS "auth_session_token_idx" ON "auth_session" ("token");
CREATE INDEX IF NOT EXISTS "auth_session_user_id_idx" ON "auth_session" ("user_id");
CREATE INDEX IF NOT EXISTS "auth_account_user_id_idx" ON "auth_account" ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "auth_account_provider_account_idx"
  ON "auth_account" ("provider_id", "account_id");
CREATE INDEX IF NOT EXISTS "auth_verification_identifier_idx"
  ON "auth_verification" ("identifier");
