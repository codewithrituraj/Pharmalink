-- Phase 4 lifecycle fields. Kept additive so Phase 1-3 records remain valid.
ALTER TABLE "Product" ADD COLUMN "availability" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Product" ADD COLUMN "imageUrl" TEXT;
ALTER TABLE "Order" ADD COLUMN "invoiceCreatedAt" DATETIME;
ALTER TABLE "ReturnRequest" ADD COLUMN "creditNoteCreatedAt" DATETIME;
