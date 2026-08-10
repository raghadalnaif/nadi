import { CheckCircle2, MessageCircle, RefreshCw, Search, UserCheck, Users } from "lucide-react";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/auth";
import { Badge, Card, Empty, PageHeader, StatCard, num, sar, subStatus, time } from "@/lib/ui";
import { checkIn, renew } from "../actions";

export default async function ReceptionPage({ searchParams }: PageProps<"/app/reception">) {
  const user = await requireModule("reception");
  const clubId = user.clubId!;
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [attendanceToday, activeCount, todayRevenue, members, recentCheckins] = await Promise.all([
    db.attendance.count({ where: { checkedAt: { gte: todayStart }, member: { clubId } } }),
    db.subscription.count({ where: { status: "active", endsAt: { gte: new Date() }, member: { clubId } } }),
    db.invoice.aggregate({
      where: { clubId, issuedAt: { gte: todayStart }, status: "paid" },
      _sum: { totalSAR: true },
    }),
    db.member.findMany({
      where: {
        clubId,
        ...(q ? { OR: [{ name: { contains: q } }, { phone: { contains: q } }] } : {}),
      },
      include: {
        subscriptions: { orderBy: { endsAt: "desc" }, take: 1, include: { plan: true } },
        attendance: { where: { checkedAt: { gte: todayStart } }, take: 1 },
      },
      orderBy: { memberNo: "asc" },
      take: q ? 30 : 12,
    }),
    db.attendance.findMany({
      where: { checkedAt: { gte: todayStart }, member: { clubId } },
      include: { member: true },
      orderBy: { checkedAt: "desc" },
      take: 8,
    }),
  ]);

  return (
    <>
      <PageHeader title="الاستقبال" subtitle="ابحث عن العضو وحضّره بضغطة واحدة" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="حضور اليوم" value={num(attendanceToday)} icon={<UserCheck className="w-5 h-5" />} tone="emerald" />
        <StatCard label="أعضاء نشطون" value={num(activeCount)} icon={<Users className="w-5 h-5" />} tone="sky" />
        <StatCard label="مبيعات اليوم" value={sar(todayRevenue._sum.totalSAR ?? 0)} icon={<CheckCircle2 className="w-5 h-5" />} tone="violet" />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <form className="relative mb-4">
            <Search className="w-4 h-4 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2" />
            <input
              name="q"
              defaultValue={q}
              autoFocus
              placeholder="ابحث بالاسم أو رقم الجوال…"
              className="w-full h-12 bg-white border border-slate-200 rounded-xl pr-11 pl-4 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10"
            />
          </form>

          <div className="flex flex-col gap-2.5">
            {members.map((m) => {
              const sub = m.subscriptions[0];
              const st = sub ? subStatus(sub.endsAt, sub.status) : null;
              const attended = m.attendance.length > 0;
              const wa = `https://wa.me/966${m.phone.replace(/^0/, "")}?text=${encodeURIComponent(
                `مرحباً ${m.name}، انتهى اشتراكك في ${user.club?.name}. جدّد الآن وواصل تقدمك 💪`
              )}`;

              return (
                <div
                  key={m.id}
                  className="bg-white rounded-2xl border border-slate-200/80 p-4 flex items-center gap-4 transition hover:border-slate-300 hover:shadow-sm"
                >
                  <span
                    className={`w-11 h-11 rounded-full grid place-items-center text-sm font-bold shrink-0 ${
                      st?.tone === "red"
                        ? "bg-red-50 text-red-700"
                        : st?.tone === "amber"
                          ? "bg-amber-50 text-amber-700"
                          : st?.tone === "sky"
                            ? "bg-sky-50 text-sky-700"
                            : "bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {m.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                  </span>

                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate">{m.name}</p>
                    <p className="text-sm text-slate-500">
                      {sub?.plan.name ?? "بلا اشتراك"}
                      {st && st.key !== "frozen" && (
                        <>
                          {" · "}
                          {st.daysLeft <= 0
                            ? `انتهى قبل ${num(-st.daysLeft)} يوم`
                            : `تنتهي بعد ${num(st.daysLeft)} يوم`}
                        </>
                      )}
                    </p>
                  </div>

                  {st && <Badge tone={st.tone}>{st.label}</Badge>}

                  {st?.key === "expired" ? (
                    <>
                      <a
                        href={wa}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-10 px-3.5 rounded-xl border border-slate-200 text-sm flex items-center gap-1.5 hover:bg-slate-50 transition whitespace-nowrap"
                      >
                        <MessageCircle className="w-4 h-4 text-emerald-600" />
                        واتساب
                      </a>
                      <form action={renew}>
                        <input type="hidden" name="memberId" value={m.id} />
                        <button className="h-10 px-4 rounded-xl bg-emerald-600 text-white text-sm font-bold flex items-center gap-1.5 hover:bg-emerald-700 active:scale-[0.98] transition whitespace-nowrap">
                          <RefreshCw className="w-4 h-4" />
                          تجديد
                        </button>
                      </form>
                    </>
                  ) : attended ? (
                    <span className="h-10 px-4 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-bold flex items-center gap-1.5 whitespace-nowrap">
                      <CheckCircle2 className="w-4 h-4" />
                      حاضر اليوم
                    </span>
                  ) : (
                    <form action={checkIn}>
                      <input type="hidden" name="memberId" value={m.id} />
                      <button className="h-10 px-5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 active:scale-[0.98] transition whitespace-nowrap">
                        تحضير
                      </button>
                    </form>
                  )}
                </div>
              );
            })}
            {members.length === 0 && <Empty text={`لا توجد نتائج للبحث «${q}»`} />}
          </div>
        </div>

        <Card title="آخر من حضر">
          {recentCheckins.length === 0 ? (
            <Empty text="لم يحضر أحد بعد اليوم" />
          ) : (
            <ul className="divide-y divide-slate-50">
              {recentCheckins.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-700 grid place-items-center text-xs font-bold shrink-0">
                    {a.member.name.slice(0, 1)}
                  </span>
                  <p className="text-sm font-medium flex-1 truncate">{a.member.name}</p>
                  <span className="text-xs text-slate-400 tabular-nums">{time(a.checkedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
