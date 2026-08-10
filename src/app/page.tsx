import { db } from "@/lib/db";
import { checkIn, renew } from "./actions";

const dayMs = 24 * 60 * 60 * 1000;
const fmtNum = new Intl.NumberFormat("ar-SA");

function statusOf(endsAt: Date) {
  const daysLeft = Math.ceil((endsAt.getTime() - Date.now()) / dayMs);
  if (daysLeft <= 0) return { key: "expired", daysLeft } as const;
  if (daysLeft <= 7) return { key: "expiring", daysLeft } as const;
  return { key: "active", daysLeft } as const;
}

const statusStyle = {
  active: { badge: "bg-emerald-50 text-emerald-700", avatar: "bg-emerald-50 text-emerald-700", label: "فعّال" },
  expiring: { badge: "bg-amber-50 text-amber-700", avatar: "bg-amber-50 text-amber-700", label: "قرب ينتهي" },
  expired: { badge: "bg-red-50 text-red-700", avatar: "bg-red-50 text-red-700", label: "منتهي" },
};

export default async function Home({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart.getTime() + dayMs);
  const weekEnd = new Date(Date.now() + 7 * dayMs);

  const [attendanceToday, expiringWeek, bookingsToday, members] = await Promise.all([
    db.attendance.count({ where: { checkedAt: { gte: todayStart } } }),
    db.subscription.count({
      where: { endsAt: { gte: new Date(), lte: weekEnd }, status: "active" },
    }),
    db.booking.count({
      where: { status: "booked", session: { startsAt: { gte: todayStart, lt: todayEnd } } },
    }),
    db.member.findMany({
      where: q ? { OR: [{ name: { contains: q } }, { phone: { contains: q } }] } : {},
      include: {
        subscriptions: { orderBy: { endsAt: "desc" }, take: 1, include: { plan: true } },
        attendance: { where: { checkedAt: { gte: todayStart } }, take: 1 },
      },
      orderBy: { memberNo: "asc" },
      take: 20,
    }),
  ]);

  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-sm text-slate-500 mb-1">حضور اليوم</p>
          <p className="text-3xl font-bold">{fmtNum.format(attendanceToday)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-sm text-slate-500 mb-1">تنتهي هذا الأسبوع</p>
          <p className="text-3xl font-bold text-amber-600">{fmtNum.format(expiringWeek)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-sm text-slate-500 mb-1">حجوزات حصص اليوم</p>
          <p className="text-3xl font-bold">{fmtNum.format(bookingsToday)}</p>
        </div>
      </div>

      <form className="mb-6" action="/">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="ابحث بالاسم أو الجوال…"
          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-400"
        />
      </form>

      <div className="flex flex-col gap-3">
        {members.map((m) => {
          const sub = m.subscriptions[0];
          if (!sub) return null;
          const st = statusOf(sub.endsAt);
          const style = statusStyle[st.key];
          const attendedToday = m.attendance.length > 0;
          const waPhone = "966" + m.phone.replace(/^0/, "");
          const waText = encodeURIComponent(
            `مرحباً ${m.name}، انتهى اشتراكك في النادي. جدّد الآن وواصل تقدمك 💪`
          );

          return (
            <div
              key={m.id}
              className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-4"
            >
              <div
                className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${style.avatar}`}
              >
                {m.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold">{m.name}</p>
                <p className="text-sm text-slate-500">
                  {sub.plan.name} ·{" "}
                  {st.key === "expired"
                    ? `انتهى قبل ${fmtNum.format(-st.daysLeft)} يوم`
                    : `تنتهي بعد ${fmtNum.format(st.daysLeft)} يوم`}
                </p>
              </div>
              <span className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap ${style.badge}`}>
                {style.label}
              </span>

              {st.key === "expired" ? (
                <>
                  <a
                    href={`https://wa.me/${waPhone}?text=${waText}`}
                    target="_blank"
                    className="text-sm border border-slate-200 rounded-xl px-4 py-2 hover:bg-slate-50 whitespace-nowrap"
                  >
                    تذكير واتساب
                  </a>
                  <form action={renew}>
                    <input type="hidden" name="memberId" value={m.id} />
                    <button className="text-sm bg-emerald-600 text-white rounded-xl px-4 py-2 hover:bg-emerald-700 whitespace-nowrap">
                      تجديد
                    </button>
                  </form>
                </>
              ) : (
                <>
                  {st.key === "expiring" && (
                    <form action={renew}>
                      <input type="hidden" name="memberId" value={m.id} />
                      <button className="text-sm border border-slate-200 rounded-xl px-4 py-2 hover:bg-slate-50 whitespace-nowrap">
                        تجديد
                      </button>
                    </form>
                  )}
                  {attendedToday ? (
                    <span className="text-sm text-emerald-700 bg-emerald-50 rounded-xl px-4 py-2 whitespace-nowrap">
                      ✓ حاضر اليوم
                    </span>
                  ) : (
                    <form action={checkIn}>
                      <input type="hidden" name="memberId" value={m.id} />
                      <button className="text-sm bg-emerald-600 text-white rounded-xl px-4 py-2 hover:bg-emerald-700 whitespace-nowrap">
                        تحضير
                      </button>
                    </form>
                  )}
                </>
              )}
            </div>
          );
        })}
        {members.length === 0 && (
          <p className="text-center text-slate-500 py-10">لا توجد نتائج للبحث «{q}»</p>
        )}
      </div>
    </div>
  );
}
