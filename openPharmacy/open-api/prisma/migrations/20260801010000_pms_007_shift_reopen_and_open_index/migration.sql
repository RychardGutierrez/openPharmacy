-- Enforce one active shift per cashier at the database level.
CREATE UNIQUE INDEX "shifts_one_open_per_user_id_idx"
ON "auth"."shifts" ("user_id")
WHERE "status" = 'OPEN';

CREATE INDEX "shifts_user_id_status_idx"
ON "auth"."shifts" ("user_id", "status");

CREATE TYPE "auth"."ShiftReopenRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "auth"."shift_reopen_requests" (
    "id" UUID NOT NULL,
    "shift_id" UUID NOT NULL,
    "requested_by" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "auth"."ShiftReopenRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_reopen_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "shift_reopen_requests_shift_id_status_idx"
ON "auth"."shift_reopen_requests" ("shift_id", "status");

CREATE INDEX "shift_reopen_requests_requested_by_status_idx"
ON "auth"."shift_reopen_requests" ("requested_by", "status");

CREATE UNIQUE INDEX "shift_reopen_requests_one_pending_per_shift_idx"
ON "auth"."shift_reopen_requests" ("shift_id")
WHERE "status" = 'PENDING';

ALTER TABLE "auth"."shift_reopen_requests"
  ADD CONSTRAINT "shift_reopen_requests_shift_id_fkey"
  FOREIGN KEY ("shift_id") REFERENCES "auth"."shifts"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "auth"."shift_reopen_requests"
  ADD CONSTRAINT "shift_reopen_requests_requested_by_fkey"
  FOREIGN KEY ("requested_by") REFERENCES "auth"."users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "auth"."shift_reopen_requests"
  ADD CONSTRAINT "shift_reopen_requests_reviewed_by_fkey"
  FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
