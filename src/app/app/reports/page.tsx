import { CalendarRange, Download, TrendingDown, TrendingUp, UserMinus, UserPlus, Wallet } from "lucide-react";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/auth";
import { Bar, Card, Empty, PageHeader, StatCard, Table, Td, Th, num, sar, sourceLabel } from "@/lib/ui";

const monthLabel = new Intl.DateTimeFormat("ar-SA", { month: "long", year: "numeric" });

export default async function ReportsPage({ searchParams }: PageProps<"/app/reports">) {
  const user = await requireModule("reports");
  const clubId = user.clubId!;
  const params = await searchParams;
  const months = Math.min(12, Math.max(3, Number(params.months) || 6));

  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

  const [invoices, expenses, subs, attendance, members, plans, offers] = await Promise.all([
    db.invoice.findMany({
      where: { clubId, status: "paid", issuedAt: { gte: from } },
      select: { issuedAt: true, totalSAR: true, vatSAR: true, subtotalSAR: true },
    }),
    db.expense.findMany({
      where: { clubId, spentAt: { gte: from } },
      select: { spentAt: true, amountSAR: true, category: true },
    }),
    db.subscription.findMany({
      where: { member: { clubId } },
      select: { createdAt: true, endsAt: true, status: true, planId: true, paidSAR: true, discountSAR: true },
    }),
    db.attendance.findMany({
      where: { member: { clubId }, checkedAt: { gte: from } },
      select: { checkedAt: true, source: true },
    }),
    db.member.findMany({ where: { clubId }, select: { createdAt: true } }),
    db.plan.findMany({ where: { clubId }, select: { id: true, name: true } }),
    db.subscription.aggregate({
      where: { member: { clubId }, discountSAR: { gt: 0 } },
      _sum: { discountSAR: true },
    }),
  ]);

  // تجميع شهري: إيراد، مصروف، ربح
  const buckets = Array.from({ length: months }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const revenue = invoices
      .filter((x) => x.issuedAt >= d && x.issuedAt < next)
      .reduce((s, x) => s + x.totalSAR, 0);
    const cost = expenses
      .filter((x) => x.spentAt >= d && x.spentAt < next)
      .reduce((s, x) => s + x.amountSAR, 0);
    const newMembers = members.filter((m) => m.createdAt >= d && m.createdAt < next).length;
    return { date: d, revenue, cost, profit: revenue - cost, newMembers };
  });

  const peak = Math.max(1, ...buckets.map((b) => Math.max(b.revenue, b.cost)));
  const totalRevenue = buckets.reduce((s, b) => s + b.revenue, 0);
  const totalCost = buckets.reduce((s, b) => s + b.cost, 0);
  const totalVat = invoices.reduce((s, x) => s + x.vatSAR, 0);

  // الباقات الأكثر مبيعاً
  const planStats = plans
    .map((p) => {
      const rows = subs.filter((s) => s.planId === p.id);
      return { name: p.name, count: rows.length, revenue: rows.reduce((s, r) => s + r.paidSAR, 0) };
    })
    .sort((a, b) => b.revenue - a.revenue);
  const planPeak = Math.max(1, ...planStats.map((p) => p.revenue));

  // ساعات الذروة
  const hourly = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    count: attendance.filter((a) => a.checkedAt.getHours() === h).length,
  })).filter((h) => h.count > 0);
  const hourPeak = Math.max(1, ...hourly.map((h) => h.count));

  // مصادر التحضير
  const bySource = attendance.reduce<Record<string, number>>((acc, a) => {
    acc[a.source] = (acc[a.source] ?? 0) + 1;
    return acc;
  }, {});

  // معدل التسرب: منتهية ولم تُجدَّد
  const expired = subs.filter((s) => s.endsAt < now && s.status === "active").length;
  const activeSubs = subs.filter((s) => s.endsAt >= now && s.status === "active").length;
  const churnRate = activeSubs + expired > 0 ? (expired / (activeSubs + expired)) * 100 : 0;

  // بنود المصروفات
  const byCategory = expenses.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + e.amountSAR;
    return acc;
  }, {});
  const catPeak = Math.max(1, ...Object.values(byCategory));

  return (
    <>
      <PageHeader
        title="التقارير"
        subtitle={`تحليل أداء آخر ${num(months)} شهور`}
        action={
          <div className="flex items-center gap-2">
            {[3, 6, 12].map((m) => (
              <a
                key={m}
                href={`/app/reports?months=${m}`}
                className={`px-3.5 h-9 rounded-xl text-sm flex items-center border transition ${
                  months === m
                    ? "bg-emerald-600 text-white border-emerald-600 font-bold"
                    : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300"
                }`}
              >
                {m} شهور
              </a>
            ))}
            <a
              href="/app/reports/export"
              className="px-3.5 h-9 rounded-xl text-sm flex items-center gap-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
            >
              <Download className="w-4 h-4" />
              تصدير CSV
            </a>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard label="إجمالي الإيرادات" value={sar(totalRevenue)} hint={`ضريبة ${sar(totalVat)}`} icon={<TrendingUp className="w-5 h-5" />} tone="emerald" />
        <StatCard label="إجمالي المصروفات" value={sar(totalCost)} icon={<TrendingDown className="w-5 h-5" />} tone="red" />
        <StatCard
          label="صافي الربح"
          value={sar(totalRevenue - totalCost)}
          hint={totalRevenue > 0 ? `هامش ${Math.round(((totalRevenue - totalCost) / totalRevenue) * 100)}%` : undefined}
          icon={<Wallet className="w-5 h-5" />}
          tone={totalRevenue - totalCost >= 0 ? "emerald" : "red"}
        />
        <StatCard
          label="معدل التسرب"
          value={`${Math.round(churnRate)}%`}
          hint={`${num(expired)} اشتراك منتهٍ لم يُجدَّد`}
          icon={<UserMinus className="w-5 h-5" />}
          tone={churnRate > 30 ? "red" : churnRate > 15 ? "amber" : "emerald"}
        />
      </div>

      <Card title="الإيرادات مقابل المصروفات" className="p-5 pt-2 mb-5">
        <div className="flex gap-4 h-64 pt-6">
          {buckets.map((b) => (
            <div key={b.date.toISOString()} className="flex-1 flex flex-col items-center gap-2 h-full">
              <span className="text-[11px] font-bold text-emerald-700 tabular-nums whitespace-nowrap">
                {sar(b.profit)}
              </span>
              <div className="flex-1 w-full flex items-end gap-1">
                <div
                  className="flex-1 bg-emerald-500 rounded-t-md min-h-1 transition-all hover:bg-emerald-600"
                  style={{ height: `${Math.max(2, (b.revenue / peak) * 100)}%` }}
                  title={`إيراد ${sar(b.revenue)}`}
                />
                <div
                  className="flex-1 bg-red-400 rounded-t-md min-h-1 transition-all hover:bg-red-500"
                  style={{ height: `${Math.max(2, (b.cost / peak) * 100)}%` }}
                  title={`مصروف ${sar(b.cost)}`}
                />
              </div>
              <span className="text-[10px] text-slate-400 whitespace-nowrap">
                {monthLabel.format(b.date).replace(" ", " ")}
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center gap-5 mt-4 pt-4 border-t border-slate-100 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-500 inline-block" /> إيرادات
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-red-400 inline-block" /> مصروفات
          </span>
          <span className="text-slate-400">الرقم فوق العمود = صافي الربح</span>
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-5 items-start mb-5">
        <Card title="الباقات الأكثر إيراداً" className="p-5 pt-4">
          {planStats.length === 0 ? (
            <Empty text="لا توجد بيانات" />
          ) : (
            <div className="space-y-3.5">
              {planStats.map((p) => (
                <div key={p.name}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-slate-600">
                      {p.name} <span className="text-slate-400 text-xs">({num(p.count)} اشتراك)</span>
                    </span>
                    <span className="font-bold tabular-nums">{sar(p.revenue)}</span>
                  </div>
                  <Bar pct={(p.revenue / planPeak) * 100} />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="المصروفات حسب البند" className="p-5 pt-4">
          {Object.keys(byCategory).length === 0 ? (
            <Empty text="لا مصروفات" />
          ) : (
            <div className="space-y-3.5">
              {Object.entries(byCategory)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, amount]) => (
                  <div key={cat}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-slate-600">{cat}</span>
                      <span className="font-bold tabular-nums">{sar(amount)}</span>
                    </div>
                    <Bar pct={(amount / catPeak) * 100} tone="amber" />
                  </div>
                ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-5 items-start">
        <Card title="ساعات الذروة" className="p-5 pt-4">
          {hourly.length === 0 ? (
            <Empty text="لا يوجد حضور مسجل" />
          ) : (
            <div className="flex gap-1.5 h-40 items-end">
              {hourly.map((h) => (
                <div key={h.hour} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                  <div
                    className="w-full bg-sky-500 rounded-t-md min-h-1 hover:bg-sky-600 transition-all"
                    style={{ height: `${(h.count / hourPeak) * 100}%` }}
                    title={`${h.count} حضور`}
                  />
                  <span className="text-[10px] text-slate-400 tabular-nums">{h.hour}</span>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-slate-400 mt-3 pt-3 border-t border-slate-100">
            الأرقام أسفل الأعمدة = ساعة اليوم (٢٤ ساعة)
          </p>
        </Card>

        <Card title="النمو ومصادر التحضير">
          <Table
            head={
              <>
                <Th>الشهر</Th>
                <Th>أعضاء جدد</Th>
                <Th>الإيراد</Th>
                <Th>الربح</Th>
              </>
            }
          >
            {buckets
              .slice()
              .reverse()
              .map((b) => (
                <tr key={b.date.toISOString()} className="hover:bg-slate-50/60 transition">
                  <Td className="whitespace-nowrap">{monthLabel.format(b.date)}</Td>
                  <Td className="tabular-nums">
                    <span className="flex items-center gap-1.5">
                      <UserPlus className="w-3.5 h-3.5 text-emerald-500" />
                      {num(b.newMembers)}
                    </span>
                  </Td>
                  <Td className="tabular-nums whitespace-nowrap">{sar(b.revenue)}</Td>
                  <Td className={`tabular-nums font-bold whitespace-nowrap ${b.profit >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                    {sar(b.profit)}
                  </Td>
                </tr>
              ))}
          </Table>
          <div className="px-5 py-3.5 border-t border-slate-100">
            <p className="text-xs text-slate-400 mb-2 flex items-center gap-1.5">
              <CalendarRange className="w-3.5 h-3.5" />
              مصادر التحضير
            </p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(bySource).map(([src, count]) => (
                <span key={src} className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
                  {sourceLabel[src] ?? src}: {num(count)}
                </span>
              ))}
              {Object.keys(bySource).length === 0 && (
                <span className="text-xs text-slate-400">لا يوجد حضور</span>
              )}
            </div>
          </div>
        </Card>
      </div>

      {(offers._sum.discountSAR ?? 0) > 0 && (
        <div className="mt-5 rounded-2xl bg-amber-50 ring-1 ring-amber-100 px-5 py-4 text-sm text-amber-800">
          <b>أثر العروض:</b> مُنحت خصومات بقيمة {sar(offers._sum.discountSAR ?? 0)} — احسبها عند
          تقييم ربحية الحملات التسويقية.
        </div>
      )}
    </>
  );
}
