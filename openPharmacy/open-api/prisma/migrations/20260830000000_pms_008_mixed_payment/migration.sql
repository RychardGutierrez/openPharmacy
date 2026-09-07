-- PMS-008-BE: mixed payments (cash + one electronic leg).
-- Add the MIXED member to the payment method enum. `cash_received` stores the
-- cash leg; `secondary_method` records the electronic method used for the rest.
ALTER TYPE "pharmacy"."PaymentMethod" ADD VALUE IF NOT EXISTS 'MIXED';

ALTER TABLE "pharmacy"."sales"
  ADD COLUMN "secondary_method" "pharmacy"."PaymentMethod";
