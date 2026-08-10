-- CreateTable
CREATE TABLE "Club" (
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
    "lastBackupAt" DATETIME
);

-- CreateTable
CREATE TABLE "PlatformInvoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clubId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "amountSAR" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'unpaid',
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" DATETIME,
    CONSTRAINT "PlatformInvoice_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clubId" TEXT,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "summary" TEXT NOT NULL,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clubId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clubId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "memberNo" INTEGER NOT NULL,
    "gender" TEXT NOT NULL DEFAULT 'male',
    "barcode" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Member_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clubId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "priceSAR" REAL NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Plan_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "paidSAR" REAL NOT NULL,
    "discountSAR" REAL NOT NULL DEFAULT 0,
    "offerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "frozenAt" DATETIME,
    "frozenDays" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'reception',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Subscription_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Subscription_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberId" TEXT NOT NULL,
    "checkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'reception',
    CONSTRAINT "Attendance_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clubId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'percent',
    "value" REAL NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "maxUses" INTEGER NOT NULL DEFAULT 0,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "planId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Offer_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GymClass" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clubId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "coach" TEXT NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL,
    CONSTRAINT "GymClass_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClassSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "classId" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "capacity" INTEGER NOT NULL,
    CONSTRAINT "ClassSession_classId_fkey" FOREIGN KEY ("classId") REFERENCES "GymClass" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'booked',
    "source" TEXT NOT NULL DEFAULT 'reception',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Booking_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClassSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Booking_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Invoice" (
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

-- CreateTable
CREATE TABLE "InvoiceItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "unitPriceSAR" REAL NOT NULL,
    CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "amountSAR" REAL NOT NULL,
    "paidAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clubId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amountSAR" REAL NOT NULL,
    "spentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Expense_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Employee" (
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
    CONSTRAINT "Employee_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Leave" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "note" TEXT,
    CONSTRAINT "Leave_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Payroll" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "baseSAR" REAL NOT NULL,
    "bonusSAR" REAL NOT NULL DEFAULT 0,
    "deductionsSAR" REAL NOT NULL DEFAULT 0,
    "netSAR" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paidAt" DATETIME,
    CONSTRAINT "Payroll_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StaffAttendance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "day" DATETIME NOT NULL,
    "checkIn" DATETIME,
    "checkOut" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'present',
    CONSTRAINT "StaffAttendance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Club_slug_key" ON "Club"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformInvoice_clubId_month_key" ON "PlatformInvoice"("clubId", "month");

-- CreateIndex
CREATE INDEX "AuditLog_clubId_at_idx" ON "AuditLog"("clubId", "at");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Member_barcode_key" ON "Member"("barcode");

-- CreateIndex
CREATE INDEX "Member_clubId_name_idx" ON "Member"("clubId", "name");

-- CreateIndex
CREATE INDEX "Member_clubId_phone_idx" ON "Member"("clubId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "Member_clubId_memberNo_key" ON "Member"("clubId", "memberNo");

-- CreateIndex
CREATE INDEX "Subscription_memberId_endsAt_idx" ON "Subscription"("memberId", "endsAt");

-- CreateIndex
CREATE INDEX "Attendance_memberId_checkedAt_idx" ON "Attendance"("memberId", "checkedAt");

-- CreateIndex
CREATE INDEX "Offer_clubId_active_idx" ON "Offer"("clubId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Offer_clubId_code_key" ON "Offer"("clubId", "code");

-- CreateIndex
CREATE INDEX "ClassSession_classId_startsAt_idx" ON "ClassSession"("classId", "startsAt");

-- CreateIndex
CREATE INDEX "Booking_sessionId_status_idx" ON "Booking"("sessionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_sessionId_memberId_key" ON "Booking"("sessionId", "memberId");

-- CreateIndex
CREATE INDEX "Invoice_clubId_issuedAt_idx" ON "Invoice"("clubId", "issuedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_clubId_number_key" ON "Invoice"("clubId", "number");

-- CreateIndex
CREATE INDEX "Expense_clubId_spentAt_idx" ON "Expense"("clubId", "spentAt");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_barcode_key" ON "Employee"("barcode");

-- CreateIndex
CREATE UNIQUE INDEX "Payroll_employeeId_month_key" ON "Payroll"("employeeId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "StaffAttendance_employeeId_day_key" ON "StaffAttendance"("employeeId", "day");
