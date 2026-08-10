-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clubId" TEXT NOT NULL,
    "memberId" TEXT,
    "subscriptionId" TEXT,
    "number" TEXT NOT NULL,
    "uuid" TEXT NOT NULL,
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subtotalSAR" REAL NOT NULL,
    "vatSAR" REAL NOT NULL,
    "totalSAR" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'paid',
    "qrTLV" TEXT,
    "invoiceType" TEXT NOT NULL DEFAULT 'simplified',
    "buyerName" TEXT,
    "buyerVat" TEXT,
    "icv" INTEGER NOT NULL DEFAULT 1,
    "pih" TEXT,
    "hash" TEXT,
    "xml" TEXT,
    CONSTRAINT "Invoice_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Invoice_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Invoice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Invoice" ("clubId", "id", "issuedAt", "memberId", "number", "qrTLV", "status", "subscriptionId", "subtotalSAR", "totalSAR", "uuid", "vatSAR") SELECT "clubId", "id", "issuedAt", "memberId", "number", "qrTLV", "status", "subscriptionId", "subtotalSAR", "totalSAR", "uuid", "vatSAR" FROM "Invoice";
DROP TABLE "Invoice";
ALTER TABLE "new_Invoice" RENAME TO "Invoice";
CREATE INDEX "Invoice_clubId_issuedAt_idx" ON "Invoice"("clubId", "issuedAt");
CREATE UNIQUE INDEX "Invoice_clubId_number_key" ON "Invoice"("clubId", "number");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
