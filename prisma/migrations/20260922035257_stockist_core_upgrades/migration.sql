-- CreateTable
CREATE TABLE "Favourite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Favourite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Favourite_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrderAudit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderAudit_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CartDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stockistId" TEXT NOT NULL,
    "manufacturerId" TEXT NOT NULL,
    "notes" TEXT,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CartDraft_stockistId_fkey" FOREIGN KEY ("stockistId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CartDraft_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CartDraftItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "draftId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    CONSTRAINT "CartDraftItem_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "CartDraft" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CartDraftItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
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
    "invoiceNumber" TEXT,
    "poNumber" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Order_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Order_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("buyerId", "createdAt", "id", "sellerId", "status", "total") SELECT "buyerId", "createdAt", "id", "sellerId", "status", "total" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
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
    "mrp" REAL NOT NULL,
    "ptr" REAL NOT NULL,
    "pts" REAL NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Product_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Product" ("category", "genericName", "id", "isActive", "manufacturerId", "mrp", "name", "ptr", "pts") SELECT "category", "genericName", "id", "isActive", "manufacturerId", "mrp", "name", "ptr", "pts" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Favourite_userId_productId_key" ON "Favourite"("userId", "productId");
