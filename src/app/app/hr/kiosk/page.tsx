import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/auth";
import { Badge, Card, Empty, PageHeader, num, time } from "@/lib/ui";
import { PunchPad } from "./punch-pad";

export default async function KioskPage() {
  const user = await requireModule("hr");
  const clubId = user.clubId!;

  const day = new Date();
  day.setHours(0, 0, 0, 0);

  const [club, today] = await Promise.all([
    db.club.findUnique({ where: { id: clubId } }),
    db.staffAttendance.findMany({
      where: { employee: { clubId }, day },
      include: { employee: { select: { name: true } } },
      orderBy: { checkIn: "desc" },
    }),
  ]);

  return (
    <>
      <Link
        href="/app/hr"
        className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-emerald-700 transition mb-5"
      >
        <ArrowRight className="w-4 h-4" />
        رجوع للموارد البشرية
      </Link>

      <PageHeader
        title="نقطة الحضور"
        subtitle="شاشة مخصّصة للموظفين — يمسح الموظف باركوده فيُسجّل دخوله أو خروجه تلقائياً"
      />

      <PunchPad
        geoRequired={club?.requireGeoStaff ?? false}
        hasClubLocation={club?.latitude != null && club?.longitude != null}
      />

      <div className="max-w-xl mx-auto mt-5">
        <Card title="حركة اليوم">
          {today.length === 0 ? (
            <Empty text="لا توجد تسجيلات اليوم" />
          ) : (
            <ul className="divide-y divide-slate-50">
              {today.map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-5 py-3">
                  <Clock className="w-4 h-4 text-slate-300 shrink-0" />
                  <span className="text-sm font-medium flex-1 truncate">{s.employee.name}</span>

                  {s.lateMinutes > 0 && <Badge tone="amber">تأخير {num(s.lateMinutes)}د</Badge>}
                  {s.outsideGeofence && <Badge tone="red">خارج النطاق</Badge>}
                  {s.overtimeMinutes > 0 && <Badge tone="sky">إضافي {num(s.overtimeMinutes)}د</Badge>}

                  <span className="text-xs text-slate-500 tabular-nums whitespace-nowrap">
                    {s.checkIn ? time(s.checkIn) : "—"}
                    {s.checkOut ? ` ← ${time(s.checkOut)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
