import { notFound, redirect } from "next/navigation";
import {
  CalendarCheck,
  CalendarDays,
  Dumbbell,
  LogOut,
  QrCode,
  Receipt,
  Wallet,
  X,
} from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { Badge, Bar, Card, Empty, PageHeader, StatCard, Table, Td, Th, fullDate, num, sar, subStatus, time } from "@/lib/ui";
import { ConfirmButton } from "@/components/dialog";
import { logout } from "@/app/login/actions";
import { bookFromPortal, cancelMyBooking } from "@/app/portal/actions";

const dayLabel = new Intl.DateTimeFormat("ar-SA", { weekday: "long", day: "numeric", month: "short" });

export default async function ClubPortalPage({ params }: PageProps<"/c/[slug]">) {
  const { slug } = await params;

  const club = await db.club.findUnique({ where: { slug }, select: { id: true } });
  if (!club) notFound();

  const user = await getCurrentUser();
  if (!user?.memberId) redirect(`/c/${slug}/login`);

  const member = await db.member.findUnique({
    where: { id: user.memberId },
    include: {
      club: { select: { name: true } },
      branch: { select: { name: true } },
      subscriptions: { include: { plan: true }, orderBy: { endsAt: "desc" }, take: 5 },
      attendance: { orderBy: { checkedAt: "desc" }, take: 10 },
      invoices: { where: { docType: "invoice" }, orderBy: { issuedAt: "desc" }, take: 6 },
      bookings: {
        where: { status: { in: ["booked", "waitlist"] }, session: { startsAt: { gte: new Date() } } },
        include: { session: { include: { gymClass: true } } },
        orderBy: { session: { startsAt: "asc" } },
      },
      _count: { select: { attendance: true } },
    },
  });
  if (!member) redirect(`/c/${slug}/login`);
  // مشترك نادٍ آخر لا يفتح هذه البوابة
  if (member.clubId !== club.id) redirect(`/c/${slug}/login`);

  const sub = member.subscriptions[0];
  const st = sub ? subStatus(sub.endsAt, sub.status) : null;
  const canBook = sub && sub.endsAt >= new Date() && sub.status === "active";

  // حصص الأيام الثلاثة القادمة
  const from = new Date();
  const to = new Date(Date.now() + 3 * 86400000);
  const sessions = await db.classSession.findMany({
    where: {
      gymClass: { clubId: member.clubId, ...(member.branchId ? { branchId: member.branchId } : {}) },
      startsAt: { gte: from, lte: to },
    },
    include: {
      gymClass: true,
      bookings: { where: { status: "booked" }, select: { memberId: true } },
    },
    orderBy: { startsAt: "asc" },
    take: 12,
  });

  const totalPaid = member.invoices
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + i.totalSAR, 0);

  // حضور آخر ٧ أيام
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (6 - i));
    const hit = member.attendance.some(
      (a) => a.checkedAt >= d && a.checkedAt < new Date(d.getTime() + 86400000)
    );
    return { date: d, hit };
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center gap-3">
          <span className="w-9 h-9 rounded-xl bg-emerald-600 grid place-items-center shrink-0">
            <Dumbbell className="w-[18px] h-[18px] text-white" />
          </span>
          <div className="min-w-0">
            <p className="font-extrabold text-slate-900 leading-tight truncate">{member.name}</p>
            <p className="text-[11px] text-slate-400 leading-tight">
              {member.branch?.name ?? member.club.name} · عضوية {num(member.memberNo)}
            </p>
          </div>

          <div className="mr-auto flex items-center gap-2">
            <form action={logout}>
              <button className="h-9 px-3.5 rounded-xl border border-slate-200 text-sm text-slate-600 flex items-center gap-1.5 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition">
                <LogOut className="w-4 h-4" />
                خروج
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-7">
        {/* بطاقة العضوية */}
        <div
          className={`rounded-2xl p-6 mb-6 text-white relative overflow-hidden ${
            st?.key === "expired" ? "bg-red-600" : st?.key === "expiring" ? "bg-amber-600" : "bg-emerald-600"
          }`}
        >
          <div className="absolute -top-16 -left-16 w-56 h-56 rounded-full bg-white/10" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <p className="text-white/80 text-sm">{sub?.plan.name ?? "بلا اشتراك"}</p>
              <p className="text-3xl font-extrabold mt-1">
                {st
                  ? st.key === "expired"
                    ? "اشتراك منتهٍ"
                    : st.key === "frozen"
                      ? "اشتراك مجمّد"
                      : `${num(st.daysLeft)} يوم متبقٍ`
                  : "لا يوجد اشتراك"}
              </p>
              {sub && (
                <p className="text-white/80 text-sm mt-1.5">ينتهي في {fullDate(sub.endsAt)}</p>
              )}
            </div>

            {member.barcode && (
              <div className="bg-white rounded-xl px-4 py-3 text-center shrink-0">
                <QrCode className="w-6 h-6 text-slate-700 mx-auto" />
                <p className="font-mono text-xs text-slate-700 mt-1.5" dir="ltr">{member.barcode}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">رمز دخولك</p>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <StatCard label="مرات الحضور" value={num(member._count.attendance)} icon={<CalendarCheck className="w-5 h-5" />} tone="emerald" />
          <StatCard label="حجوزاتي القادمة" value={num(member.bookings.length)} icon={<CalendarDays className="w-5 h-5" />} tone="sky" />
          <StatCard label="إجمالي مدفوعاتي" value={sar(totalPaid)} icon={<Wallet className="w-5 h-5" />} tone="violet" />
        </div>

        {/* حضور الأسبوع */}
        <Card title="حضوري هذا الأسبوع" className="p-5 pt-4 mb-5">
          <div className="flex gap-2">
            {week.map((d) => (
              <div key={d.date.toISOString()} className="flex-1 text-center">
                <div
                  className={`h-12 rounded-xl grid place-items-center ${
                    d.hit ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-300"
                  }`}
                >
                  {d.hit ? <CalendarCheck className="w-5 h-5" /> : <X className="w-4 h-4" />}
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5">{dayLabel.format(d.date).split("،")[0]}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* حجز الحصص */}
        <Card title="احجز حصتك" className="mb-5">
          {!canBook ? (
            <div className="px-5 py-6 text-center">
              <p className="text-sm text-slate-500">
                {st?.key === "expired"
                  ? "اشتراكك منتهٍ — جدّد لتتمكن من الحجز"
                  : st?.key === "frozen"
                    ? "اشتراكك مجمّد حالياً"
                    : "تحتاج اشتراكاً فعّالاً للحجز"}
              </p>
            </div>
          ) : sessions.length === 0 ? (
            <Empty text="لا توجد حصص متاحة في الأيام القادمة" />
          ) : (
            <div className="grid sm:grid-cols-2 gap-3 p-5">
              {sessions.map((s) => {
                const booked = s.bookings.length;
                const left = s.capacity - booked;
                const mine = s.bookings.some((b) => b.memberId === member.id);
                const tone = left <= 0 ? "red" : left <= 3 ? "amber" : "emerald";

                return (
                  <div key={s.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <p className="font-bold text-sm">{s.gymClass.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{s.gymClass.coach}</p>
                      </div>
                      <Badge tone={tone}>{left <= 0 ? "مكتملة" : `باقي ${num(left)}`}</Badge>
                    </div>

                    <p className="text-xs text-slate-500 mb-2.5">
                      {dayLabel.format(s.startsAt)} · {time(s.startsAt)}
                    </p>

                    <Bar pct={(booked / s.capacity) * 100} tone={tone} />

                    {mine ? (
                      <p className="mt-3 text-center text-xs font-bold text-emerald-700 bg-emerald-50 rounded-xl py-2.5">
                        ✓ محجوزة لك
                      </p>
                    ) : (
                      <form action={bookFromPortal} className="mt-3">
                        <input type="hidden" name="sessionId" value={s.id} />
                        <button className="w-full h-10 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 active:scale-[0.99] transition">
                          {left <= 0 ? "انضم لقائمة الانتظار" : "احجز"}
                        </button>
                      </form>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <div className="grid lg:grid-cols-2 gap-5 items-start">
          <Card title="حجوزاتي">
            {member.bookings.length === 0 ? (
              <Empty text="لا حجوزات قادمة" />
            ) : (
              <ul className="divide-y divide-slate-50">
                {member.bookings.map((b) => (
                  <li key={b.id} className="flex items-center gap-3 px-5 py-3.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold">{b.session.gymClass.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {dayLabel.format(b.session.startsAt)} · {time(b.session.startsAt)}
                      </p>
                    </div>
                    <Badge tone={b.status === "booked" ? "emerald" : "amber"}>
                      {b.status === "booked" ? "مؤكد" : "قائمة انتظار"}
                    </Badge>
                    <form action={cancelMyBooking}>
                      <input type="hidden" name="bookingId" value={b.id} />
                      <ConfirmButton
                        label="إلغاء"
                        message={`إلغاء حجز ${b.session.gymClass.name}؟`}
                        icon={<X className="w-4 h-4" />}
                      />
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="فواتيري">
            {member.invoices.length === 0 ? (
              <Empty text="لا فواتير" />
            ) : (
              <Table
                head={
                  <>
                    <Th>الرقم</Th>
                    <Th>التاريخ</Th>
                    <Th>المبلغ</Th>
                    <Th>الحالة</Th>
                  </>
                }
              >
                {member.invoices.map((i) => (
                  <tr key={i.id} className="hover:bg-slate-50/60 transition">
                    <Td className="font-bold tabular-nums" dir="ltr">{i.number}</Td>
                    <Td className="text-slate-500 text-xs whitespace-nowrap">{fullDate(i.issuedAt)}</Td>
                    <Td className="tabular-nums font-bold whitespace-nowrap">{sar(i.totalSAR)}</Td>
                    <Td>
                      <Badge tone={i.status === "paid" ? "emerald" : "amber"}>
                        {i.status === "paid" ? "مدفوعة" : "غير مدفوعة"}
                      </Badge>
                    </Td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>
        </div>

        <Card title="سجل حضوري" className="mt-5">
          {member.attendance.length === 0 ? (
            <Empty text="لم تحضر بعد" />
          ) : (
            <ul className="divide-y divide-slate-50">
              {member.attendance.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-5 py-3">
                  <CalendarCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="text-sm flex-1">{fullDate(a.checkedAt)}</span>
                  <span className="text-xs text-slate-400 tabular-nums">{time(a.checkedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <p className="text-center text-xs text-slate-400 mt-6 flex items-center justify-center gap-1.5">
          <Receipt className="w-3.5 h-3.5" />
          للاستفسار أو التجديد، تواصل مع استقبال {member.club.name}
        </p>
      </main>
    </div>
  );
}
