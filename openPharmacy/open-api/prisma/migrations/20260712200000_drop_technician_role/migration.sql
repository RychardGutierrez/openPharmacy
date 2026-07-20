-- Drop TECHNICIAN from auth.UserRole.
-- Sequence:
--  1. Drop the FK from users.role_name -> roles.name (it pins the column type).
--  2. Cast both columns to TEXT so they don't depend on the enum type.
--  3. Delete any stale role rows that still reference TECHNICIAN.
--     (No users had role_name='TECHNICIAN' at the time this migration was
--     authored, but the safety net is here.)
--  4. Drop the old enum and recreate it without TECHNICIAN.
--  5. Cast both columns back to the new enum.
--  6. Re-add the foreign key.

-- 1. Drop the FK constraint
ALTER TABLE "auth"."users" DROP CONSTRAINT IF EXISTS "users_role_name_fkey";

-- 2. Cast both columns to TEXT (free of the enum type)
ALTER TABLE "auth"."users"
  ALTER COLUMN "role_name" TYPE TEXT USING "role_name"::TEXT;
ALTER TABLE "auth"."roles"
  ALTER COLUMN "name" TYPE TEXT USING "name"::TEXT;

-- 3. Remove any rows that would not survive the new enum
DELETE FROM "auth"."roles" WHERE "name" = 'TECHNICIAN';

-- 4. Drop old enum and recreate without TECHNICIAN
DROP TYPE "auth"."UserRole";
CREATE TYPE "auth"."UserRole" AS ENUM ('ADMIN', 'PHARMACIST', 'CASHIER');

-- 5. Cast columns back to the new enum
ALTER TABLE "auth"."users"
  ALTER COLUMN "role_name" TYPE "auth"."UserRole"
  USING "role_name"::"auth"."UserRole";
ALTER TABLE "auth"."roles"
  ALTER COLUMN "name" TYPE "auth"."UserRole"
  USING "name"::"auth"."UserRole";

-- 6. Re-add the foreign key
ALTER TABLE "auth"."users"
  ADD CONSTRAINT "users_role_name_fkey"
  FOREIGN KEY ("role_name") REFERENCES "auth"."roles"("name")
  ON DELETE RESTRICT ON UPDATE CASCADE;
