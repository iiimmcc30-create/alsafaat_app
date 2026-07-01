BEGIN;

-- Remove circular ButcherApplication.butcherId link (Butcher.sourceApplicationId remains).
ALTER TABLE "ButcherApplication" DROP CONSTRAINT "ButcherApplication_butcherId_fkey";
DROP INDEX "ButcherApplication_butcherId_idx";
ALTER TABLE "ButcherApplication" DROP COLUMN "butcherId";

-- Drop butcher type snapshot and redundant owner name; rename shop contact field.
ALTER TABLE "ButcherApplication" DROP COLUMN "type";
ALTER TABLE "ButcherApplication" DROP COLUMN "ownerName";
ALTER TABLE "ButcherApplication" RENAME COLUMN "phone" TO "shopPhone";

-- Document verification audit fields.
ALTER TABLE "ButcherApplicationDocument" ADD COLUMN "verifiedBy" TEXT;
ALTER TABLE "ButcherApplicationDocument" ADD COLUMN "verifiedAt" TIMESTAMP(3);

-- Simplify document status enum (map any legacy rows before swap).
CREATE TYPE "ButcherApplicationDocumentStatus_new" AS ENUM ('UPLOADED', 'APPROVED', 'REJECTED');
ALTER TABLE "ButcherApplicationDocument" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "ButcherApplicationDocument" ALTER COLUMN "status" TYPE "ButcherApplicationDocumentStatus_new" USING (
  CASE "status"::text
    WHEN 'pending' THEN 'UPLOADED'
    WHEN 'uploaded' THEN 'UPLOADED'
    WHEN 'accepted' THEN 'APPROVED'
    WHEN 'rejected' THEN 'REJECTED'
    ELSE 'UPLOADED'
  END::"ButcherApplicationDocumentStatus_new"
);
DROP TYPE "ButcherApplicationDocumentStatus";
ALTER TYPE "ButcherApplicationDocumentStatus_new" RENAME TO "ButcherApplicationDocumentStatus";
ALTER TABLE "ButcherApplicationDocument" ALTER COLUMN "status" SET DEFAULT 'UPLOADED';

-- Simplify timeline action enum (map any legacy rows before swap).
CREATE TYPE "ButcherApplicationTimelineAction_new" AS ENUM ('CREATE', 'UPDATE', 'SUBMIT', 'APPROVE', 'REJECT', 'WITHDRAW', 'COMMENT');
ALTER TABLE "ButcherApplicationTimelineEvent" ALTER COLUMN "action" TYPE "ButcherApplicationTimelineAction_new" USING (
  CASE "action"::text
    WHEN 'application_created' THEN 'CREATE'
    WHEN 'draft_saved' THEN 'UPDATE'
    WHEN 'document_added' THEN 'UPDATE'
    WHEN 'document_updated' THEN 'UPDATE'
    WHEN 'submitted' THEN 'SUBMIT'
    WHEN 'withdrawn' THEN 'WITHDRAW'
    WHEN 'approved' THEN 'APPROVE'
    WHEN 'rejected' THEN 'REJECT'
    WHEN 'admin_note' THEN 'COMMENT'
    WHEN 'butcher_provisioned' THEN 'UPDATE'
    ELSE 'CREATE'
  END::"ButcherApplicationTimelineAction_new"
);
DROP TYPE "ButcherApplicationTimelineAction";
ALTER TYPE "ButcherApplicationTimelineAction_new" RENAME TO "ButcherApplicationTimelineAction";

-- Timeline metadata: non-null with empty-object default.
UPDATE "ButcherApplicationTimelineEvent" SET "metadata" = '{}' WHERE "metadata" IS NULL;
ALTER TABLE "ButcherApplicationTimelineEvent" ALTER COLUMN "metadata" SET DEFAULT '{}';
ALTER TABLE "ButcherApplicationTimelineEvent" ALTER COLUMN "metadata" SET NOT NULL;

CREATE INDEX "ButcherApplicationDocument_verifiedBy_idx" ON "ButcherApplicationDocument"("verifiedBy");

ALTER TABLE "ButcherApplicationDocument" ADD CONSTRAINT "ButcherApplicationDocument_verifiedBy_fkey" FOREIGN KEY ("verifiedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
