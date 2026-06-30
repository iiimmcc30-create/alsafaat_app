BEGIN;

-- CreateEnum
CREATE TYPE "PaymentReferenceType" AS ENUM ('subscription', 'fee', 'listing_fee');

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "referenceId" TEXT,
ADD COLUMN "referenceType" "PaymentReferenceType";

-- Backfill from FK columns and legacy metadata (all rows; paid/failed history preserved)
UPDATE "Payment" p
SET
  "referenceId" = COALESCE(p."referenceId", p."subscriptionId", p."feeId", NULLIF(p.metadata->>'referenceId', '')),
  "referenceType" = COALESCE(
    p."referenceType",
    CASE
      WHEN p."subscriptionId" IS NOT NULL THEN 'subscription'::"PaymentReferenceType"
      WHEN p."feeId" IS NOT NULL AND p.metadata->>'type' = 'listing_fee' THEN 'listing_fee'::"PaymentReferenceType"
      WHEN p."feeId" IS NOT NULL THEN 'fee'::"PaymentReferenceType"
      WHEN p.metadata->>'type' = 'subscription' THEN 'subscription'::"PaymentReferenceType"
      WHEN p.metadata->>'type' = 'listing_fee' THEN 'listing_fee'::"PaymentReferenceType"
      WHEN p.metadata->>'type' = 'fee' THEN 'fee'::"PaymentReferenceType"
      ELSE NULL
    END
  );

-- Second pass: pending rows whose reference lived only in metadata
UPDATE "Payment" p
SET
  "referenceId" = COALESCE(p."referenceId", NULLIF(p.metadata->>'referenceId', '')),
  "referenceType" = COALESCE(
    p."referenceType",
    CASE p.metadata->>'type'
      WHEN 'subscription' THEN 'subscription'::"PaymentReferenceType"
      WHEN 'fee'          THEN 'fee'::"PaymentReferenceType"
      WHEN 'listing_fee'  THEN 'listing_fee'::"PaymentReferenceType"
      ELSE NULL
    END
  )
WHERE p.status = 'pending'
  AND (p."referenceId" IS NULL OR p."referenceType" IS NULL)
  AND NULLIF(p.metadata->>'referenceId', '') IS NOT NULL
  AND p.metadata->>'type' IN ('subscription', 'fee', 'listing_fee');

-- Resolve duplicate pending rows before adding the unique index (keep oldest; extras → failed)
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "userId", "referenceId", "referenceType"
      ORDER BY "createdAt" ASC
    ) AS rn
  FROM "Payment"
  WHERE status = 'pending'
    AND "referenceId" IS NOT NULL
    AND "referenceType" IS NOT NULL
)
UPDATE "Payment" p
SET status = 'failed'
FROM ranked r
WHERE p.id = r.id
  AND r.rn > 1;

-- One pending payment per user + reference (paid/failed/refunded rows excluded by predicate)
CREATE UNIQUE INDEX "Payment_userId_referenceId_referenceType_pending_key"
ON "Payment" ("userId", "referenceId", "referenceType")
WHERE status = 'pending'
  AND "referenceId" IS NOT NULL
  AND "referenceType" IS NOT NULL;

-- Supports initiate.ts pending lookup: WHERE userId + referenceId + referenceType + status
CREATE INDEX "Payment_userId_referenceId_referenceType_status_idx"
ON "Payment" ("userId", "referenceId", "referenceType", "status");

COMMIT;
