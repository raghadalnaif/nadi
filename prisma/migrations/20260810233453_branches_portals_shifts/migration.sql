-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clubId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "isMain" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Branch_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CashShift" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clubId" TEXT NOT NULL,
    "branchId" TEXT,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "openedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" DATETIME,
    "openingFloatSAR" REAL NOT NULL DEFAULT 0,
    "countedCashSAR" REAL NOT NULL DEFAULT 0,
    "expectedCashSAR" REAL NOT NULL DEFAULT 0,
    "varianceSAR" REAL NOT NULL DEFAULT 0,
    "cardTotalSAR" REAL NOT NULL DEFAULT 0,
    "otherTotalSAR" REAL NOT NULL DEFAULT 0,
    "invoiceCount" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    CONSTRAINT "CashShift_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CashShift_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clubId" TEXT NOT NULL,
    "branchId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'announcement',
    "audience" TEXT NOT NULL DEFAULT 'all',
    "department" TEXT,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Announcement_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AnnouncementRead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "announcementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "readAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnnouncementRead_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Evaluation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "attendance" INTEGER NOT NULL DEFAULT 3,
    "performance" INTEGER NOT NULL DEFAULT 3,
    "teamwork" INTEGER NOT NULL DEFAULT 3,
    "discipline" INTEGER NOT NULL DEFAULT 3,
    "overall" REAL NOT NULL DEFAULT 3,
    "notes" TEXT,
    "byName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Evaluation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Employee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clubId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "salarySAR" REAL NOT NULL,
    "phone" TEXT NOT NULL,
    "iban" TEXT,
    "barcode" TEXT,
    "hireDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "branchId" TEXT,
    "nationalId" TEXT,
    "nationality" TEXT NOT NULL DEFAULT 'سعودي',
    "contractType" TEXT NOT NULL DEFAULT 'full_time',
    "contractEndsAt" DATETIME,
    "idExpiresAt" DATETIME,
    "housingSAR" REAL NOT NULL DEFAULT 0,
    "transportSAR" REAL NOT NULL DEFAULT 0,
    "otherAllowSAR" REAL NOT NULL DEFAULT 0,
    "gosiSubject" BOOLEAN NOT NULL DEFAULT true,
    "shiftStart" TEXT NOT NULL DEFAULT '08:00',
    "shiftEnd" TEXT NOT NULL DEFAULT '17:00',
    "annualLeaveDays" INTEGER NOT NULL DEFAULT 21,
    CONSTRAINT "Employee_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Employee_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Employee" ("annualLeaveDays", "barcode", "clubId", "contractEndsAt", "contractType", "department", "gosiSubject", "hireDate", "housingSAR", "iban", "id", "idExpiresAt", "jobTitle", "name", "nationalId", "nationality", "otherAllowSAR", "phone", "salarySAR", "shiftEnd", "shiftStart", "status", "transportSAR") SELECT "annualLeaveDays", "barcode", "clubId", "contractEndsAt", "contractType", "department", "gosiSubject", "hireDate", "housingSAR", "iban", "id", "idExpiresAt", "jobTitle", "name", "nationalId", "nationality", "otherAllowSAR", "phone", "salarySAR", "shiftEnd", "shiftStart", "status", "transportSAR" FROM "Employee";
DROP TABLE "Employee";
ALTER TABLE "new_Employee" RENAME TO "Employee";
CREATE UNIQUE INDEX "Employee_barcode_key" ON "Employee"("barcode");
CREATE TABLE "new_Expense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clubId" TEXT NOT NULL,
    "branchId" TEXT,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amountSAR" REAL NOT NULL,
    "spentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Expense_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Expense_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Expense" ("amountSAR", "category", "clubId", "description", "id", "spentAt") SELECT "amountSAR", "category", "clubId", "description", "id", "spentAt" FROM "Expense";
DROP TABLE "Expense";
ALTER TABLE "new_Expense" RENAME TO "Expense";
CREATE INDEX "Expense_clubId_spentAt_idx" ON "Expense"("clubId", "spentAt");
CREATE TABLE "new_GymClass" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clubId" TEXT NOT NULL,
    "branchId" TEXT,
    "name" TEXT NOT NULL,
    "coach" TEXT NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL,
    CONSTRAINT "GymClass_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GymClass_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_GymClass" ("capacity", "clubId", "coach", "durationMin", "id", "name") SELECT "capacity", "clubId", "coach", "durationMin", "id", "name" FROM "GymClass";
DROP TABLE "GymClass";
ALTER TABLE "new_GymClass" RENAME TO "GymClass";
CREATE TABLE "new_Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clubId" TEXT NOT NULL,
    "branchId" TEXT,
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
    CONSTRAINT "Invoice_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Invoice_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Invoice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Invoice" ("buyerName", "buyerVat", "clubId", "docType", "hash", "icv", "id", "invoiceType", "issuedAt", "memberId", "number", "pih", "qrTLV", "refInvoiceId", "status", "subscriptionId", "subtotalSAR", "totalSAR", "uuid", "vatSAR", "xml") SELECT "buyerName", "buyerVat", "clubId", "docType", "hash", "icv", "id", "invoiceType", "issuedAt", "memberId", "number", "pih", "qrTLV", "refInvoiceId", "status", "subscriptionId", "subtotalSAR", "totalSAR", "uuid", "vatSAR", "xml" FROM "Invoice";
DROP TABLE "Invoice";
ALTER TABLE "new_Invoice" RENAME TO "Invoice";
CREATE INDEX "Invoice_clubId_issuedAt_idx" ON "Invoice"("clubId", "issuedAt");
CREATE UNIQUE INDEX "Invoice_clubId_number_key" ON "Invoice"("clubId", "number");
CREATE TABLE "new_Leave" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "note" TEXT,
    "requestedBy" TEXT,
    "decidedBy" TEXT,
    "decidedAt" DATETIME,
    "decisionNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Leave_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Leave" ("employeeId", "endsAt", "id", "note", "startsAt", "status", "type") SELECT "employeeId", "endsAt", "id", "note", "startsAt", "status", "type" FROM "Leave";
DROP TABLE "Leave";
ALTER TABLE "new_Leave" RENAME TO "Leave";
CREATE TABLE "new_Member" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clubId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "memberNo" INTEGER NOT NULL,
    "gender" TEXT NOT NULL DEFAULT 'male',
    "branchId" TEXT,
    "barcode" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Member_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Member_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Member" ("barcode", "clubId", "createdAt", "gender", "id", "memberNo", "name", "notes", "phone") SELECT "barcode", "clubId", "createdAt", "gender", "id", "memberNo", "name", "notes", "phone" FROM "Member";
DROP TABLE "Member";
ALTER TABLE "new_Member" RENAME TO "Member";
CREATE UNIQUE INDEX "Member_barcode_key" ON "Member"("barcode");
CREATE INDEX "Member_clubId_name_idx" ON "Member"("clubId", "name");
CREATE INDEX "Member_clubId_phone_idx" ON "Member"("clubId", "phone");
CREATE UNIQUE INDEX "Member_clubId_memberNo_key" ON "Member"("clubId", "memberNo");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clubId" TEXT,
    "branchId" TEXT,
    "memberId" TEXT,
    "employeeId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("active", "clubId", "createdAt", "email", "id", "lastLoginAt", "name", "passwordHash", "role") SELECT "active", "clubId", "createdAt", "email", "id", "lastLoginAt", "name", "passwordHash", "role" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_memberId_key" ON "User"("memberId");
CREATE UNIQUE INDEX "User_employeeId_key" ON "User"("employeeId");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Branch_clubId_active_idx" ON "Branch"("clubId", "active");

-- CreateIndex
CREATE INDEX "CashShift_clubId_status_idx" ON "CashShift"("clubId", "status");

-- CreateIndex
CREATE INDEX "CashShift_clubId_openedAt_idx" ON "CashShift"("clubId", "openedAt");

-- CreateIndex
CREATE INDEX "Announcement_clubId_createdAt_idx" ON "Announcement"("clubId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AnnouncementRead_announcementId_userId_key" ON "AnnouncementRead"("announcementId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Evaluation_employeeId_year_key" ON "Evaluation"("employeeId", "year");
