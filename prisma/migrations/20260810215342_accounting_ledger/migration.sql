-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clubId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isCash" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Account_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clubId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "date" DATETIME NOT NULL,
    "memo" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "refId" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JournalEntry_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JournalLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entryId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "debitSAR" REAL NOT NULL DEFAULT 0,
    "creditSAR" REAL NOT NULL DEFAULT 0,
    "memo" TEXT,
    CONSTRAINT "JournalLine_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "JournalEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "JournalLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

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
    "docType" TEXT NOT NULL DEFAULT 'invoice',
    "refInvoiceId" TEXT,
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
INSERT INTO "new_Invoice" ("buyerName", "buyerVat", "clubId", "hash", "icv", "id", "invoiceType", "issuedAt", "memberId", "number", "pih", "qrTLV", "status", "subscriptionId", "subtotalSAR", "totalSAR", "uuid", "vatSAR", "xml") SELECT "buyerName", "buyerVat", "clubId", "hash", "icv", "id", "invoiceType", "issuedAt", "memberId", "number", "pih", "qrTLV", "status", "subscriptionId", "subtotalSAR", "totalSAR", "uuid", "vatSAR", "xml" FROM "Invoice";
DROP TABLE "Invoice";
ALTER TABLE "new_Invoice" RENAME TO "Invoice";
CREATE INDEX "Invoice_clubId_issuedAt_idx" ON "Invoice"("clubId", "issuedAt");
CREATE UNIQUE INDEX "Invoice_clubId_number_key" ON "Invoice"("clubId", "number");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Account_clubId_type_idx" ON "Account"("clubId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Account_clubId_code_key" ON "Account"("clubId", "code");

-- CreateIndex
CREATE INDEX "JournalEntry_clubId_date_idx" ON "JournalEntry"("clubId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_clubId_number_key" ON "JournalEntry"("clubId", "number");

-- CreateIndex
CREATE INDEX "JournalLine_accountId_idx" ON "JournalLine"("accountId");
