import { mkdir, readdir, stat, writeFile } from "fs/promises";
import path from "path";
import { db } from "./db";

const BACKUP_DIR = path.join(process.cwd(), "backups");

// نسخة كاملة من بيانات النادي — كل الجداول المرتبطة به
export async function buildSnapshot(clubId: string) {
  const [club, users, members, plans, offers, subscriptions, attendance, classes, sessions, bookings, invoices, expenses, employees, payrolls, leaves, staffAttendance] =
    await Promise.all([
      db.club.findUnique({ where: { id: clubId } }),
      db.user.findMany({ where: { clubId }, select: { id: true, name: true, email: true, role: true, active: true } }),
      db.member.findMany({ where: { clubId } }),
      db.plan.findMany({ where: { clubId } }),
      db.offer.findMany({ where: { clubId } }),
      db.subscription.findMany({ where: { member: { clubId } } }),
      db.attendance.findMany({ where: { member: { clubId } } }),
      db.gymClass.findMany({ where: { clubId } }),
      db.classSession.findMany({ where: { gymClass: { clubId } } }),
      db.booking.findMany({ where: { member: { clubId } } }),
      db.invoice.findMany({ where: { clubId }, include: { items: true, payments: true } }),
      db.expense.findMany({ where: { clubId } }),
      db.employee.findMany({ where: { clubId } }),
      db.payroll.findMany({ where: { employee: { clubId } } }),
      db.leave.findMany({ where: { employee: { clubId } } }),
      db.staffAttendance.findMany({ where: { employee: { clubId } } }),
    ]);

  return {
    meta: {
      version: 1,
      clubName: club?.name,
      takenAt: new Date().toISOString(),
      counts: {
        members: members.length,
        invoices: invoices.length,
        employees: employees.length,
        subscriptions: subscriptions.length,
      },
    },
    club,
    users,
    members,
    plans,
    offers,
    subscriptions,
    attendance,
    classes,
    sessions,
    bookings,
    invoices,
    expenses,
    employees,
    payrolls,
    leaves,
    staffAttendance,
  };
}

// يحفظ النسخة على القرص ويحدّث تاريخ آخر نسخة
export async function runBackup(clubId: string) {
  const snapshot = await buildSnapshot(clubId);
  await mkdir(BACKUP_DIR, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const file = path.join(BACKUP_DIR, `${snapshot.club?.slug ?? clubId}-${stamp}.json`);
  await writeFile(file, JSON.stringify(snapshot, null, 2), "utf8");

  await db.club.update({ where: { id: clubId }, data: { lastBackupAt: new Date() } });
  return { file: path.basename(file), counts: snapshot.meta.counts };
}

// قائمة النسخ المحفوظة لهذا النادي
export async function listBackups(slug: string) {
  try {
    const files = await readdir(BACKUP_DIR);
    const mine = files.filter((f) => f.startsWith(slug + "-") && f.endsWith(".json"));
    const details = await Promise.all(
      mine.map(async (f) => {
        const s = await stat(path.join(BACKUP_DIR, f));
        return { name: f, size: s.size, at: s.mtime };
      })
    );
    return details.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 10);
  } catch {
    return [];
  }
}
