-- Add HSN code to Product, invoice payment ledger to Order, and freeQuantity to OrderItem
ALTER TABLE "Product" ADD COLUMN "hsnCode" TEXT NOT NULL DEFAULT '3004';
ALTER TABLE "Order" ADD COLUMN "isPaid" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN "paidAt" DATETIME;
ALTER TABLE "Order" ADD COLUMN "paymentRef" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN "freeQuantity" INTEGER NOT NULL DEFAULT 0;
