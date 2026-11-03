-- AlterTable
ALTER TABLE "InventoryBatch" ADD COLUMN "mfgDate" DATETIME;

-- CreateTable
CREATE TABLE "OrderItemAllocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderItemId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    CONSTRAINT "OrderItemAllocation_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OrderItemAllocation_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JobRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "job" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "trigger" TEXT NOT NULL DEFAULT 'SCHEDULE',
    "notificationsCreated" INTEGER NOT NULL DEFAULT 0,
    "notificationsSkipped" INTEGER NOT NULL DEFAULT 0,
    "summary" TEXT,
    "error" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "organizationId" TEXT,
    CONSTRAINT "JobRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "link" TEXT,
    "dedupeKey" TEXT,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Notification" ("createdAt", "id", "message", "organizationId", "readAt", "title", "type") SELECT "createdAt", "id", "message", "organizationId", "readAt", "title", "type" FROM "Notification";
DROP TABLE "Notification";
ALTER TABLE "new_Notification" RENAME TO "Notification";
CREATE INDEX "Notification_organizationId_createdAt_idx" ON "Notification"("organizationId", "createdAt");
CREATE UNIQUE INDEX "Notification_organizationId_dedupeKey_key" ON "Notification"("organizationId", "dedupeKey");
CREATE TABLE "new_Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "manufacturerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "genericName" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'General',
    "dosageForm" TEXT NOT NULL DEFAULT 'Tablet',
    "strength" TEXT NOT NULL DEFAULT '',
    "packSize" TEXT NOT NULL DEFAULT '10 x 10',
    "gstPercent" REAL NOT NULL DEFAULT 12,
    "isPrescription" BOOLEAN NOT NULL DEFAULT false,
    "storage" TEXT NOT NULL DEFAULT 'Store below 25 C',
    "minOrderQty" INTEGER NOT NULL DEFAULT 1,
    "leadTimeDays" INTEGER NOT NULL DEFAULT 7,
    "mrp" REAL NOT NULL,
    "ptr" REAL NOT NULL,
    "pts" REAL NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Product_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Product" ("category", "dosageForm", "genericName", "gstPercent", "id", "isActive", "isPrescription", "manufacturerId", "minOrderQty", "mrp", "name", "packSize", "ptr", "pts", "storage", "strength") SELECT "category", "dosageForm", "genericName", "gstPercent", "id", "isActive", "isPrescription", "manufacturerId", "minOrderQty", "mrp", "name", "packSize", "ptr", "pts", "storage", "strength" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "OrderItemAllocation_orderItemId_batchId_key" ON "OrderItemAllocation"("orderItemId", "batchId");

-- CreateIndex
CREATE INDEX "JobRun_job_startedAt_idx" ON "JobRun"("job", "startedAt");

-- CreateIndex
CREATE INDEX "InventoryBatch_stockistId_productId_idx" ON "InventoryBatch"("stockistId", "productId");

-- CreateIndex
CREATE INDEX "InventoryBatch_stockistId_expiryDate_idx" ON "InventoryBatch"("stockistId", "expiryDate");
