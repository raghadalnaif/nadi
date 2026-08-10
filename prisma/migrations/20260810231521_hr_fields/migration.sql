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
    CONSTRAINT "Employee_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Employee" ("barcode", "clubId", "department", "hireDate", "iban", "id", "jobTitle", "name", "phone", "salarySAR", "status") SELECT "barcode", "clubId", "department", "hireDate", "iban", "id", "jobTitle", "name", "phone", "salarySAR", "status" FROM "Employee";
DROP TABLE "Employee";
ALTER TABLE "new_Employee" RENAME TO "Employee";
CREATE UNIQUE INDEX "Employee_barcode_key" ON "Employee"("barcode");
CREATE TABLE "new_Payroll" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "baseSAR" REAL NOT NULL,
    "housingSAR" REAL NOT NULL DEFAULT 0,
    "transportSAR" REAL NOT NULL DEFAULT 0,
    "otherAllowSAR" REAL NOT NULL DEFAULT 0,
    "overtimeSAR" REAL NOT NULL DEFAULT 0,
    "bonusSAR" REAL NOT NULL DEFAULT 0,
    "absenceSAR" REAL NOT NULL DEFAULT 0,
    "gosiEmpSAR" REAL NOT NULL DEFAULT 0,
    "gosiClubSAR" REAL NOT NULL DEFAULT 0,
    "deductionsSAR" REAL NOT NULL DEFAULT 0,
    "workedDays" INTEGER NOT NULL DEFAULT 0,
    "absentDays" INTEGER NOT NULL DEFAULT 0,
    "netSAR" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paidAt" DATETIME,
    CONSTRAINT "Payroll_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Payroll" ("baseSAR", "bonusSAR", "deductionsSAR", "employeeId", "id", "month", "netSAR", "paidAt", "status") SELECT "baseSAR", "bonusSAR", "deductionsSAR", "employeeId", "id", "month", "netSAR", "paidAt", "status" FROM "Payroll";
DROP TABLE "Payroll";
ALTER TABLE "new_Payroll" RENAME TO "Payroll";
CREATE UNIQUE INDEX "Payroll_employeeId_month_key" ON "Payroll"("employeeId", "month");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
