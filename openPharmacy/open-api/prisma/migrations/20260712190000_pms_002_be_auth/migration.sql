-- AlterTable: add lockout and password-change tracking columns to auth.users
ALTER TABLE "auth"."users"
  ADD COLUMN "failed_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "locked_until" TIMESTAMP(3),
  ADD COLUMN "last_failed_at" TIMESTAMP(3),
  ADD COLUMN "password_changed_at" TIMESTAMP(3);

-- NOTE: TECHNICIAN is intentionally kept in auth.UserRole so existing rows are
-- not invalidated. The application code only accepts ADMIN, PHARMACIST, CASHIER.

-- CreateTable: auth.refresh_tokens
CREATE TABLE "auth"."refresh_tokens" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "hashed_jti" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "replaced_by" UUID,

  CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "refresh_tokens_hashed_jti_key" ON "auth"."refresh_tokens"("hashed_jti");
CREATE INDEX "refresh_tokens_user_id_idx" ON "auth"."refresh_tokens"("user_id");
CREATE INDEX "refresh_tokens_expires_at_idx" ON "auth"."refresh_tokens"("expires_at");

ALTER TABLE "auth"."refresh_tokens"
  ADD CONSTRAINT "refresh_tokens_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: auth.audit_logs
CREATE TABLE "auth"."audit_logs" (
  "id" UUID NOT NULL,
  "user_id" UUID,
  "event" TEXT NOT NULL,
  "ip" TEXT,
  "user_agent" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_logs_user_id_created_at_idx" ON "auth"."audit_logs"("user_id", "created_at");
CREATE INDEX "audit_logs_event_created_at_idx" ON "auth"."audit_logs"("event", "created_at");

ALTER TABLE "auth"."audit_logs"
  ADD CONSTRAINT "audit_logs_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
