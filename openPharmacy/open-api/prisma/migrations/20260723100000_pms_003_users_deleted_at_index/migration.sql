-- Add an index on users.deleted_at for fast active-only lookups and soft-delete checks.
CREATE INDEX "users_deleted_at_idx" ON "auth"."users"("deleted_at");
