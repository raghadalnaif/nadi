import { PauseCircle, PlayCircle, PlusCircle, RefreshCw, Search, Snowflake, UserPlus, Users } from "lucide-react";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/auth";
import { Badge, Card, Empty, PageHeader, StatCard, Table, Td, Th, fullDate, num, sar, sourceLabel, subStatus } from "@/lib/ui";
import { addMember, renew, toggleFreeze } from "../actions";

const filters = [
  { key: "all", label: "الكل" },
  { key: "active", label: "فعّال" },
  { key: "expiring", label: "قرب ينتهي" },
  { key: "expired", label: "منتهي" },
  { key: "frozen", label: "مجمّد" },
];

export default async function SubscriptionsPage({ searchParams }: PageProps<"/app/subscriptions">) {
  const user = await requireModule("subscriptions");
  const clubId = user.clubId!;
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const filter = typeof params.filter === "string" ? params.filter : "all";

  const now = new Date();
  const weekEnd = new Date(Date.now() + 7 * 86400000);

  const [plans, counts, subs] = await Promise.all([
    db.plan.findMany({ where: { clubId, active: true }, orderBy: { durationDays: "asc" } }),
    Promise.all([
      db.subscription.count({ where: { member: { clubId }, status: "active", endsAt: { gte: now } } }),
      db.subscription.count({ where: { member: { clubId }, status: "active", endsAt: { gte: now, lte: weekEnd } } }),
      db.subscription.count({ where: { member: { clubId }, status: "active", endsAt: { lt: now } } }),
      db.subscription.count({ where: { member: { clubId }, status: "frozen" } }),
      db.invoice.aggregate({ where: { clubId, status: "paid" }, _sum: { totalSAR: true } }),
    ]),
    db.subscription.findMany({
      where: {
        member: { clubId, ...(q ? { OR: [{ name: { contains: q } }, { phone: { contains: q } }] } : {}) },
        ...(filter === "active" ? { status: "active", endsAt: { gt: weekEnd } } : {}),
        ...(filter === "expiring" ? { status: "active", endsAt: { gte: now, lte: weekEnd } } : {}),
        ...(filter === "expired" ? { status: "active", endsAt: { lt: now } } : {}),
        ...(filter === "frozen" ? { status: "frozen" } : {}),
      },
      include: { member: true, plan: true },
      orderBy: { endsAt: "asc" },
      take: 50,
    }),
  ]);

  const [activeCount, expiringCount, expiredCount, frozenCount, revenue] = counts;

  return (
    <>
      <PageHeader title="الاشتراكات" subtitle="إدارة العضويات: تجديد، تجميد، وتسجيل أعضاء جدد" />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard label="اشتراكات فعّالة" value={num(activeCount)} icon={<Users className="w-5 h-5" />} tone="emerald" />
        <StatCard label="تنتهي هذا الأسبوع" value={num(expiringCount)} icon={<RefreshCw className="w-5 h-5" />} tone="amber" />
        <StatCard label="منتهية" value={num(expiredCount)} icon={<PauseCircle className="w-5 h-5" />} tone="red" />
        <StatCard label="مجمّدة" value={num(frozenCount)} icon={<Snowflake className="w-5 h-5" />} tone="sky" />
      </div>

      <div className="grid lg:grid-cols-3 gap-5 items-start">
        <div className="lg:col-span-2 space-y-4">
          <form className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2" />
              <input
                name="q"
                defaultValue={q}
                placeholder="ابحث عن عضو…"
                className="w-full h-11 bg-white border border-slate-200 rounded-xl pr-11 pl-4 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10"
              />
            </div>
            <input type="hidden" name="filter" value={filter} />
          </form>

          <div className="flex gap-2 flex-wrap">
            {filters.map((f) => (
              <a
                key={f.key}
                href={`/app/subscriptions?filter=${f.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                className={`px-3.5 h-9 rounded-xl text-sm flex items-center transition border ${
                  filter === f.key
                    ? "bg-emerald-600 text-white border-emerald-600 font-bold"
                    : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300"
                }`}
              >
                {f.label}
              </a>
            ))}
          </div>

          <Card>
            {subs.length === 0 ? (
              <Empty text="لا توجد اشتراكات مطابقة" />
            ) : (
              <Table
                head={
                  <>
                    <Th>العضو</Th>
                    <Th>الباقة</Th>
                    <Th>تنتهي في</Th>
                    <Th>المصدر</Th>
                    <Th>الحالة</Th>
                    <Th>إجراء</Th>
                  </>
                }
              >
                {subs.map((s) => {
                  const st = subStatus(s.endsAt, s.status);
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/60 transition">
                      <Td>
                        <p className="font-bold">{s.member.name}</p>
                        <p className="text-xs text-slate-400 tabular-nums" dir="ltr">{s.member.phone}</p>
                      </Td>
                      <Td className="text-slate-600">{s.plan.name}</Td>
                      <Td className="text-slate-500 whitespace-nowrap">{fullDate(s.endsAt)}</Td>
                      <Td>
                        <span className="text-xs text-slate-500">{sourceLabel[s.source] ?? s.source}</span>
                      </Td>
                      <Td><Badge tone={st.tone}>{st.label}</Badge></Td>
                      <Td>
                        <div className="flex items-center gap-1.5">
                          <form action={toggleFreeze}>
                            <input type="hidden" name="subId" value={s.id} />
                            <button
                              title={s.status === "frozen" ? "استئناف" : "تجميد"}
                              className="w-9 h-9 rounded-lg grid place-items-center text-slate-400 hover:bg-sky-50 hover:text-sky-600 transition"
                            >
                              {s.status === "frozen" ? <PlayCircle className="w-4 h-4" /> : <PauseCircle className="w-4 h-4" />}
                            </button>
                          </form>
                          <form action={renew}>
                            <input type="hidden" name="memberId" value={s.memberId} />
                            <button className="h-9 px-3 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100 transition whitespace-nowrap">
                              تجديد
                            </button>
                          </form>
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </Table>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="تسجيل عضو جديد" className="p-5 pt-4">
            <form action={addMember} className="space-y-3">
              <div>
                <label className="block text-sm text-slate-600 mb-1.5">اسم العضو</label>
                <input
                  name="name"
                  required
                  placeholder="محمد العتيبي"
                  className="w-full h-11 bg-white border border-slate-200 rounded-xl px-3.5 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1.5">رقم الجوال</label>
                <input
                  name="phone"
                  required
                  dir="ltr"
                  placeholder="05xxxxxxxx"
                  className="w-full h-11 bg-white border border-slate-200 rounded-xl px-3.5 text-sm text-right outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1.5">الباقة</label>
                <select
                  name="planId"
                  required
                  className="w-full h-11 bg-white border border-slate-200 rounded-xl px-3 text-sm outline-none focus:border-emerald-400"
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {sar(p.priceSAR)}
                    </option>
                  ))}
                </select>
              </div>
              <button className="w-full h-11 rounded-xl bg-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-emerald-700 active:scale-[0.99] transition">
                <UserPlus className="w-4 h-4" />
                تسجيل وإصدار فاتورة
              </button>
              <p className="text-xs text-slate-400 text-center">تُصدر فاتورة ضريبية تلقائياً عند التسجيل</p>
            </form>
          </Card>

          <Card title="الباقات المتاحة">
            <ul className="divide-y divide-slate-50">
              {plans.map((p) => (
                <li key={p.id} className="flex items-center justify-between px-5 py-3.5">
                  <div>
                    <p className="text-sm font-bold">{p.name}</p>
                    <p className="text-xs text-slate-400">{num(p.durationDays)} يوم</p>
                  </div>
                  <span className="text-sm font-bold text-emerald-700 tabular-nums">{sar(p.priceSAR)}</span>
                </li>
              ))}
            </ul>
            <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-400">إجمالي الإيراد المحصّل</span>
              <span className="text-sm font-bold tabular-nums">{sar(revenue._sum.totalSAR ?? 0)}</span>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
