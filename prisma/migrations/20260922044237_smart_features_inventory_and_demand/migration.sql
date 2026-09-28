-- CreateTable
CREATE TABLE "InventoryBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stockistId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "expiryDate" DATETIME NOT NULL,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceOrderId" TEXT,
    CONSTRAINT "InventoryBatch_stockistId_fkey" FOREIGN KEY ("stockistId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InventoryBatch_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InventoryBatch_sourceOrderId_fkey" FOREIGN KEY ("sourceOrderId") REFERENCES "Order" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DemandSample" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stockistId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "quantity" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'ORDER',
    CONSTRAINT "DemandSample_stockistId_fkey" FOREIGN KEY ("stockistId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DemandSample_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "DemandSample_stockistId_productId_periodStart_key" ON "DemandSample"("stockistId", "productId", "periodStart");
