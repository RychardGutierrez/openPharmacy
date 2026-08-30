-- PMS-008-DB: allocate receipt numbers atomically and sequentially.
CREATE SEQUENCE IF NOT EXISTS "pharmacy"."sale_receipt_number_seq"
  AS BIGINT
  MINVALUE 1
  START WITH 1
  INCREMENT BY 1
  NO CYCLE;

-- Continue after existing numeric receipt numbers when upgrading an installation.
SELECT setval(
  'pharmacy.sale_receipt_number_seq',
  COALESCE((
    SELECT MAX(receipt_number::BIGINT)
    FROM pharmacy.sales
    WHERE receipt_number ~ '^[0-9]+$'
  ), 1),
  EXISTS (
    SELECT 1 FROM pharmacy.sales WHERE receipt_number ~ '^[0-9]+$'
  )
);
