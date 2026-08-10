import Link from "next/link";
import { ArrowUpLeft, BadgeCheck, CalendarCheck, TrendingUp, UsersRound, Wallet } from "lucide-react";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/auth";
import { Badge, Bar, Card, PageHeader, StatCard, Table, Td, Th, num, sar, shortDate, subStatus } from "@/lib/ui";

export default async function DashboardPage() {
  const user = await requireModule("dashboard");
  const clubId = user.clubId!;

  const now = new Date();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekEnd = new Date(Date.now() + 7 * 86400000);

  const [activeMembers, attendanceToday, monthInvoices, monthExpenses, expiring, recentMembers, lastYearAttendance] =
    await Promise.all([
      db.subscription.count({ where: { status: "active", endsAt: { gte: now }, member: { clubId } } }),
      db.attendance.count({ where: { checkedAt: { gte: todayStart }, member: { clubId } } }),
      db.invoice.aggregate({
        where: { clubId, issuedAt: { gte: monthStart }, status: "paid" },
        _sum: { totalSAR: true },
        _count: true,
      }),
      db.expense.aggregate({ where: { clubId, spentAt: { gte: monthStart } }, _sum: { amountSAR: true } }),
      db.subscription.findMany({
        where: { status: "active", endsAt: { gte: now, lte: weekEnd }, member: { clubId } },
        include: { member: true, plan: true },
        orderBy: { endsAt: "asc" },
        take: 6,
      }),
      db.member.findMany({
        where: { clubId },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { subscriptions: { orderBy: { endsAt: "desc" }, take: 1, include: { plan: true } } },
      }),
      db.attendance.findMany({
        where: { member: { clubId }, checkedAt: { gte: new Date(Date.now() - 7 * 86400000) } },
        select: { checkedAt: true },
      }),
    ]);

  const revenue = monthInvoices._sum.totalSAR ?? 0;
  const expenses = monthExpenses._sum.amountSAR ?? 0;
  const profit = revenue - expenses;

  // حضور آخر 7 أيام لرسم الأعمدة
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (6 - i));
    const count = lastYearAttendance.filter(
      (a) => a.checkedAt >= d && a.checkedAt < new Date(d.getTime() + 86400000)
    ).length;
    return { date: d, count };
  });
  const peak = Math.max(1, ...days.map((d) => d.count));

  return (
    <>
      <PageHeader
        title={`أهلاً، ${user.name.split(" ")[0]} 👋`}
        subtitle="نظرة سريعة على أداء ناديك اليوم"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="أعضاء نشطون"
          value={num(activeMembers)}
          icon={<UsersRound className="w-5 h-5" />}
          tone="emerald"
        />
        <StatCard
          label="حضور اليوم"
          value={num(attendanceToday)}
          icon={<CalendarCheck className="w-5 h-5" />}
          tone="sky"
        />
        <StatCard
          label="إيراد الشهر"
          value={sar(revenue)}
          hint={`${num(monthInvoices._count)} فاتورة مدفوعة`}
          icon={<Wallet className="w-5 h-5" />}
          tone="violet"
        />
        <StatCard
          label="صافي الربح"
          value={sar(profit)}
          hint={`بعد مصروفات ${sar(expenses)}`}
          icon={<TrendingUp className="w-5 h-5" />}
          tone={profit >= 0 ? "emerald" : "red"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card title="الحضور خلال الأسبوع" className="lg:col-span-2 p-5 pt-2">
          <div className="flex gap-3 h-52 px-1 pt-6">
            {days.map((d) => (
              <div key={d.date.toISOString()} className="flex-1 flex flex-col items-center gap-2 h-full">
                <span className="text-xs font-bold text-slate-600 tabular-nums">{num(d.count)}</span>
                <div className="flex-1 w-full flex items-end">
                  <div
                    className="w-full bg-emerald-500 rounded-t-lg transition-all hover:bg-emerald-600 min-h-1"
                    style={{ height: `${Math.max(4, (d.count / peak) * 100)}%` }}
                  />
                </div>
                <span className="text-[11px] text-slate-400 whitespace-nowrap">{shortDate(d.date)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card
          title="تنتهي قريباً"
          action={
            <Link href="/app/subscriptions" className="text-xs text-emerald-700 font-bold flex items-center gap-1 hover:gap-1.5 transition-all">
              الكل <ArrowUpLeft className="w-3.5 h-3.5" />
            </Link>
          }
        >
          {expiring.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-10">لا توجد اشتراكات تنتهي قريباً</p>
          ) : (
            <ul className="divide-y divide-slate-50">
              {expiring.map((s) => {
                const st = subStatus(s.endsAt, s.status);
                return (
                  <li key={s.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="w-9 h-9 rounded-full bg-amber-50 text-amber-700 grid place-items-center text-xs font-bold shrink-0">
                      {s.member.name.slice(0, 1)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold truncate">{s.member.name}</p>
                      <p className="text-xs text-slate-400">{s.plan.name}</p>
                    </div>
                    <Badge tone={st.tone}>{num(st.daysLeft)} يوم</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <Card title="أحدث الأعضاء" className="mt-5">
        <Table
          head={
            <>
              <Th>العضو</Th>
              <Th>رقم العضوية</Th>
              <Th>الجوال</Th>
              <Th>الباقة</Th>
              <Th>الحالة</Th>
            </>
          }
        >
          {recentMembers.map((m) => {
            const sub = m.subscriptions[0];
            const st = sub ? subStatus(sub.endsAt, sub.status) : null;
            return (
              <tr key={m.id} className="hover:bg-slate-50/60 transition">
                <Td className="font-bold">{m.name}</Td>
                <Td className="text-slate-500 tabular-nums">{num(m.memberNo)}</Td>
                <Td className="text-slate-500" dir="ltr">{m.phone}</Td>
                <Td className="text-slate-500">{sub?.plan.name ?? "—"}</Td>
                <Td>{st ? <Badge tone={st.tone}>{st.label}</Badge> : "—"}</Td>
              </tr>
            );
          })}
        </Table>
      </Card>

      <div className="grid sm:grid-cols-2 gap-5 mt-5">
        <Card title="نسبة الإشغال المالي" className="p-5 pt-4">
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-slate-600">الإيرادات</span>
                <span className="font-bold tabular-nums">{sar(revenue)}</span>
              </div>
              <Bar pct={100} tone="emerald" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-slate-600">المصروفات</span>
                <span className="font-bold tabular-nums">{sar(expenses)}</span>
              </div>
              <Bar pct={revenue ? (expenses / revenue) * 100 : 0} tone={expenses > revenue ? "red" : "amber"} />
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-4 flex items-center gap-1.5">
            <BadgeCheck className="w-3.5 h-3.5" />
            محسوبة من فواتير ومصروفات الشهر الحالي
          </p>
        </Card>

        <Card title="اختصارات سريعة" className="p-5 pt-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              { href: "/app/reception", label: "تحضير عضو", icon: CalendarCheck },
              { href: "/app/subscriptions", label: "عضو جديد", icon: UsersRound },
              { href: "/app/accounting", label: "الفواتير", icon: Wallet },
              { href: "/app/hr", label: "الموظفون", icon: BadgeCheck },
            ].map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className="flex items-center gap-2.5 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:border-emerald-300 hover:bg-emerald-50/50 hover:text-emerald-700 transition"
              >
                <s.icon className="w-4 h-4" />
                {s.label}
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
