-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clubId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "category" TEXT NOT NULL DEFAULT 'مكملات',
    "priceSAR" REAL NOT NULL,
    "costSAR" REAL NOT NULL DEFAULT 0,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "trackStock" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Product_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MessageTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clubId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MessageTemplate_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clubId" TEXT NOT NULL,
    "memberId" TEXT,
    "templateId" TEXT,
    "toName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "provider" TEXT NOT NULL DEFAULT 'link',
    "sentAt" DATETIME,
    "sentBy" TEXT,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Message_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Message_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MessageTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clubId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'زيارة',
    "status" TEXT NOT NULL DEFAULT 'new',
    "note" TEXT,
    "followUpAt" DATETIME,
    "handledBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Lead_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Club" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "vatNumber" TEXT,
    "crNumber" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "platformPlan" TEXT NOT NULL DEFAULT 'basic',
    "platformFeeSAR" REAL NOT NULL DEFAULT 299,
    "platformStatus" TEXT NOT NULL DEFAULT 'active',
    "platformEndsAt" DATETIME NOT NULL,
    "checkinManual" BOOLEAN NOT NULL DEFAULT true,
    "checkinBarcode" BOOLEAN NOT NULL DEFAULT true,
    "checkinFingerprint" BOOLEAN NOT NULL DEFAULT false,
    "checkinWristband" BOOLEAN NOT NULL DEFAULT false,
    "checkinGate" BOOLEAN NOT NULL DEFAULT false,
    "blockExpiredEntry" BOOLEAN NOT NULL DEFAULT true,
    "lastBackupAt" DATETIME,
    "waProvider" TEXT NOT NULL DEFAULT 'link',
    "waPhoneId" TEXT,
    "waToken" TEXT,
    "waAutoWelcome" BOOLEAN NOT NULL DEFAULT true,
    "waAutoExpiry" BOOLEAN NOT NULL DEFAULT true,
    "waExpiryDays" INTEGER NOT NULL DEFAULT 3,
    "waAutoWinback" BOOLEAN NOT NULL DEFAULT true,
    "waAutoReceipt" BOOLEAN NOT NULL DEFAULT true,
    "latitude" REAL,
    "longitude" REAL,
    "geofenceMeters" INTEGER NOT NULL DEFAULT 150,
    "requireGeoStaff" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_Club" ("address", "blockExpiredEntry", "checkinBarcode", "checkinFingerprint", "checkinGate", "checkinManual", "checkinWristband", "crNumber", "createdAt", "geofenceMeters", "id", "lastBackupAt", "latitude", "longitude", "name", "phone", "platformEndsAt", "platformFeeSAR", "platformPlan", "platformStatus", "requireGeoStaff", "slug", "vatNumber") SELECT "address", "blockExpiredEntry", "checkinBarcode", "checkinFingerprint", "checkinGate", "checkinManual", "checkinWristband", "crNumber", "createdAt", "geofenceMeters", "id", "lastBackupAt", "latitude", "longitude", "name", "phone", "platformEndsAt", "platformFeeSAR", "platformPlan", "platformStatus", "requireGeoStaff", "slug", "vatNumber" FROM "Club";
DROP TABLE "Club";
ALTER TABLE "new_Club" RENAME TO "Club";
CREATE UNIQUE INDEX "Club_slug_key" ON "Club"("slug");
CREATE TABLE "new_InvoiceItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "productId" TEXT,
    "description" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "unitPriceSAR" REAL NOT NULL,
    CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InvoiceItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_InvoiceItem" ("description", "id", "invoiceId", "qty", "unitPriceSAR") SELECT "description", "id", "invoiceId", "qty", "unitPriceSAR" FROM "InvoiceItem";
DROP TABLE "InvoiceItem";
ALTER TABLE "new_InvoiceItem" RENAME TO "InvoiceItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Product_clubId_active_idx" ON "Product"("clubId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "MessageTemplate_clubId_key_key" ON "MessageTemplate"("clubId", "key");

-- CreateIndex
CREATE INDEX "Message_clubId_status_idx" ON "Message"("clubId", "status");

-- CreateIndex
CREATE INDEX "Message_clubId_createdAt_idx" ON "Message"("clubId", "createdAt");

-- CreateIndex
CREATE INDEX "Lead_clubId_status_idx" ON "Lead"("clubId", "status");
