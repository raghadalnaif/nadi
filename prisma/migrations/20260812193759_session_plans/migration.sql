-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Plan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clubId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'duration',
    "durationDays" INTEGER NOT NULL,
    "sessionCount" INTEGER NOT NULL DEFAULT 0,
    "priceSAR" REAL NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Plan_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Plan" ("active", "clubId", "durationDays", "id", "name", "priceSAR") SELECT "active", "clubId", "durationDays", "id", "name", "priceSAR" FROM "Plan";
DROP TABLE "Plan";
ALTER TABLE "new_Plan" RENAME TO "Plan";
CREATE TABLE "new_Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "paidSAR" REAL NOT NULL,
    "discountSAR" REAL NOT NULL DEFAULT 0,
    "sessionsTotal" INTEGER NOT NULL DEFAULT 0,
    "sessionsUsed" INTEGER NOT NULL DEFAULT 0,
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
INSERT INTO "new_Subscription" ("createdAt", "discountSAR", "endsAt", "frozenAt", "frozenDays", "id", "memberId", "offerId", "paidSAR", "planId", "source", "startsAt", "status") SELECT "createdAt", "discountSAR", "endsAt", "frozenAt", "frozenDays", "id", "memberId", "offerId", "paidSAR", "planId", "source", "startsAt", "status" FROM "Subscription";
DROP TABLE "Subscription";
ALTER TABLE "new_Subscription" RENAME TO "Subscription";
CREATE INDEX "Subscription_memberId_endsAt_idx" ON "Subscription"("memberId", "endsAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
