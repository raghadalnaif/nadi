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
    "latitude" REAL,
    "longitude" REAL,
    "geofenceMeters" INTEGER NOT NULL DEFAULT 150,
    "requireGeoStaff" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_Club" ("address", "blockExpiredEntry", "checkinBarcode", "checkinFingerprint", "checkinGate", "checkinManual", "checkinWristband", "crNumber", "createdAt", "id", "lastBackupAt", "name", "phone", "platformEndsAt", "platformFeeSAR", "platformPlan", "platformStatus", "slug", "vatNumber") SELECT "address", "blockExpiredEntry", "checkinBarcode", "checkinFingerprint", "checkinGate", "checkinManual", "checkinWristband", "crNumber", "createdAt", "id", "lastBackupAt", "name", "phone", "platformEndsAt", "platformFeeSAR", "platformPlan", "platformStatus", "slug", "vatNumber" FROM "Club";
DROP TABLE "Club";
ALTER TABLE "new_Club" RENAME TO "Club";
CREATE UNIQUE INDEX "Club_slug_key" ON "Club"("slug");
CREATE TABLE "new_StaffAttendance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "day" DATETIME NOT NULL,
    "checkIn" DATETIME,
    "checkOut" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'present',
    "method" TEXT NOT NULL DEFAULT 'manual',
    "checkInLat" REAL,
    "checkInLng" REAL,
    "checkInMeters" REAL,
    "checkOutLat" REAL,
    "checkOutLng" REAL,
    "checkOutMeters" REAL,
    "outsideGeofence" BOOLEAN NOT NULL DEFAULT false,
    "lateMinutes" INTEGER NOT NULL DEFAULT 0,
    "earlyLeaveMinutes" INTEGER NOT NULL DEFAULT 0,
    "overtimeMinutes" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "StaffAttendance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_StaffAttendance" ("checkIn", "checkOut", "day", "employeeId", "id", "status") SELECT "checkIn", "checkOut", "day", "employeeId", "id", "status" FROM "StaffAttendance";
DROP TABLE "StaffAttendance";
ALTER TABLE "new_StaffAttendance" RENAME TO "StaffAttendance";
CREATE UNIQUE INDEX "StaffAttendance_employeeId_day_key" ON "StaffAttendance"("employeeId", "day");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
