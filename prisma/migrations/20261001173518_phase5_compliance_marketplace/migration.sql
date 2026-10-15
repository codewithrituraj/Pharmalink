/*
  Warnings:

  - A unique constraint covering the columns `[qrCode]` on the table `Batch` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Batch" ADD COLUMN "qrCode" TEXT;

-- CreateTable
CREATE TABLE "NppaCeilingPrice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "drugName" TEXT NOT NULL,
    "composition" TEXT NOT NULL,
    "packSize" TEXT NOT NULL,
    "ceilingPrice" REAL NOT NULL,
    "effectiveDate" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ProductPriceViolation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "manufacturerId" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "submittedMrp" REAL NOT NULL,
    "ceilingPrice" REAL NOT NULL,
    "detectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "ProductPriceViolation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProductPriceViolation_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProductPriceViolation_referenceId_fkey" FOREIGN KEY ("referenceId") REFERENCES "NppaCeilingPrice" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "H1RegisterEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "buyerName" TEXT NOT NULL,
    "patientName" TEXT NOT NULL,
    "prescriberName" TEXT NOT NULL,
    "prescriberRegistrationNumber" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "H1RegisterEntry_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "H1RegisterEntry_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "H1RegisterEntry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "H1RegisterEntry_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TraceVerificationLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stockistId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "batchId" TEXT,
    "submittedCode" TEXT NOT NULL,
    "matched" BOOLEAN NOT NULL,
    "details" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TraceVerificationLog_stockistId_fkey" FOREIGN KEY ("stockistId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TraceVerificationLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TraceVerificationLog_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MarketplaceListing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sellerId" TEXT NOT NULL,
    "inventoryBatchId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "pricePerUnit" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MarketplaceListing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MarketplaceListing_inventoryBatchId_fkey" FOREIGN KEY ("inventoryBatchId") REFERENCES "InventoryBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MarketplaceListing_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SwapOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listingId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "pricePerUnit" REAL NOT NULL,
    "total" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ORDERED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shippedAt" DATETIME,
    "deliveredAt" DATETIME,
    CONSTRAINT "SwapOrder_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "MarketplaceListing" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SwapOrder_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SwapOrder_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SwapOrder_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PaymentSubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "stockistId" TEXT NOT NULL,
    "manufacturerId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "reference" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" DATETIME,
    "reviewerUserId" TEXT,
    "reviewNote" TEXT,
    CONSTRAINT "PaymentSubmission_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PaymentSubmission_stockistId_fkey" FOREIGN KEY ("stockistId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PaymentSubmission_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PaymentSubmission_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLACED',
    "subtotal" REAL NOT NULL DEFAULT 0,
    "discount" REAL NOT NULL DEFAULT 0,
    "gst" REAL NOT NULL DEFAULT 0,
    "total" REAL NOT NULL,
    "notes" TEXT,
    "transporter" TEXT,
    "trackingNumber" TEXT,
    "expectedDelivery" DATETIME,
    "invoiceNumber" TEXT,
    "invoiceCreatedAt" DATETIME,
    "poNumber" TEXT,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" DATETIME,
    "paymentRef" TEXT,
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "paidAmount" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Order_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Order_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("buyerId", "createdAt", "discount", "expectedDelivery", "gst", "id", "invoiceCreatedAt", "invoiceNumber", "isPaid", "notes", "paidAt", "paymentRef", "poNumber", "sellerId", "status", "subtotal", "total", "trackingNumber", "transporter") SELECT "buyerId", "createdAt", "discount", "expectedDelivery", "gst", "id", "invoiceCreatedAt", "invoiceNumber", "isPaid", "notes", "paidAt", "paymentRef", "poNumber", "sellerId", "status", "subtotal", "total", "trackingNumber", "transporter" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE TABLE "new_Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "manufacturerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "genericName" TEXT NOT NULL,
    "composition" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'General',
    "dosageForm" TEXT NOT NULL DEFAULT 'Tablet',
    "strength" TEXT NOT NULL DEFAULT '',
    "packSize" TEXT NOT NULL DEFAULT '10 x 10',
    "gstPercent" REAL NOT NULL DEFAULT 12,
    "isPrescription" BOOLEAN NOT NULL DEFAULT false,
    "isScheduleH1" BOOLEAN NOT NULL DEFAULT false,
    "requiresColdChain" BOOLEAN NOT NULL DEFAULT false,
    "storage" TEXT NOT NULL DEFAULT 'Store below 25 C',
    "minOrderQty" INTEGER NOT NULL DEFAULT 1,
    "leadTimeDays" INTEGER NOT NULL DEFAULT 7,
    "mrp" REAL NOT NULL,
    "ptr" REAL NOT NULL,
    "pts" REAL NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "availability" INTEGER NOT NULL DEFAULT 0,
    "imageUrl" TEXT,
    "hsnCode" TEXT NOT NULL DEFAULT '3004',
    CONSTRAINT "Product_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Product" ("availability", "category", "dosageForm", "genericName", "gstPercent", "hsnCode", "id", "imageUrl", "isActive", "isPrescription", "leadTimeDays", "manufacturerId", "minOrderQty", "mrp", "name", "packSize", "ptr", "pts", "storage", "strength") SELECT "availability", "category", "dosageForm", "genericName", "gstPercent", "hsnCode", "id", "imageUrl", "isActive", "isPrescription", "leadTimeDays", "manufacturerId", "minOrderQty", "mrp", "name", "packSize", "ptr", "pts", "storage", "strength" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "NppaCeilingPrice_composition_packSize_effectiveDate_idx" ON "NppaCeilingPrice"("composition", "packSize", "effectiveDate");

-- CreateIndex
CREATE UNIQUE INDEX "NppaCeilingPrice_composition_packSize_effectiveDate_key" ON "NppaCeilingPrice"("composition", "packSize", "effectiveDate");

-- CreateIndex
CREATE INDEX "ProductPriceViolation_active_detectedAt_idx" ON "ProductPriceViolation"("active", "detectedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProductPriceViolation_productId_referenceId_key" ON "ProductPriceViolation"("productId", "referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "H1RegisterEntry_orderItemId_key" ON "H1RegisterEntry"("orderItemId");

-- CreateIndex
CREATE INDEX "H1RegisterEntry_createdAt_productId_idx" ON "H1RegisterEntry"("createdAt", "productId");

-- CreateIndex
CREATE INDEX "H1RegisterEntry_buyerId_createdAt_idx" ON "H1RegisterEntry"("buyerId", "createdAt");

-- CreateIndex
CREATE INDEX "TraceVerificationLog_orderId_createdAt_idx" ON "TraceVerificationLog"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "TraceVerificationLog_matched_createdAt_idx" ON "TraceVerificationLog"("matched", "createdAt");

-- CreateIndex
CREATE INDEX "MarketplaceListing_status_expiresAt_idx" ON "MarketplaceListing"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "MarketplaceListing_sellerId_status_idx" ON "MarketplaceListing"("sellerId", "status");

-- CreateIndex
CREATE INDEX "SwapOrder_buyerId_createdAt_idx" ON "SwapOrder"("buyerId", "createdAt");

-- CreateIndex
CREATE INDEX "SwapOrder_sellerId_createdAt_idx" ON "SwapOrder"("sellerId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentSubmission_manufacturerId_status_submittedAt_idx" ON "PaymentSubmission"("manufacturerId", "status", "submittedAt");

-- CreateIndex
CREATE INDEX "PaymentSubmission_stockistId_submittedAt_idx" ON "PaymentSubmission"("stockistId", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Batch_qrCode_key" ON "Batch"("qrCode");
