-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "region" TEXT;

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AccessGrant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "manufacturerId" TEXT NOT NULL,
    "stockistId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" DATETIME,
    CONSTRAINT "AccessGrant_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AccessGrant_stockistId_fkey" FOREIGN KEY ("stockistId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_AccessGrant" ("id", "manufacturerId", "status", "stockistId") SELECT "id", "manufacturerId", "status", "stockistId" FROM "AccessGrant";
DROP TABLE "AccessGrant";
ALTER TABLE "new_AccessGrant" RENAME TO "AccessGrant";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
