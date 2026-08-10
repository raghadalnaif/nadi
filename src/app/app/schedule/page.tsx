import Link from "next/link";
import { Clock, Users2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/auth";
import { Badge, Bar, Card, Empty, PageHeader, num, sourceLabel, time } from "@/lib/ui";
import { book } from "../actions";

const dayLabel = new Intl.DateTimeFormat("ar-SA", { weekday: "long", day: "numeric", month: "short" });

export default async function SchedulePage({ searchParams }: PageProps<"/app/schedule">) {
  const user = await requireModule("schedule");
  const clubId = user.clubId!;
  const params = await searchParams;
  const day = Math.min(6, Math.max(0, Number(params.day) || 0));

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  dayStart.setDate(dayStart.getDate() + day);
  const dayEnd = new Date(dayStart.getTime() + 86400000);

  const [sessions, members] = await Promise.all([
    db.classSession.findMany({
      where: { gymClass: { clubId }, startsAt: { gte: dayStart, lt: dayEnd } },
      include: { gymClass: true, bookings: true },
      orderBy: { startsAt: "asc" },
    }),
    db.member.findMany({ where: { clubId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const totalBooked = sessions.reduce((s, x) => s + x.bookings.filter((b) => b.status === "booked").length, 0);
  const totalCapacity = sessions.reduce((s, x) => s + x.capacity, 0);

  return (
    <>
      <PageHeader
        title="الحصص والحجوزات"
        subtitle={`${num(totalBooked)} حجز من أصل ${num(totalCapacity)} مقعد متاح`}
      />

      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {Array.from({ length: 7 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() + i);
          const active = i === day;
          return (
            <Link
              key={i}
              href={`/app/schedule?day=${i}`}
              className={`px-4 h-11 rounded-xl text-sm whitespace-nowrap border flex items-center transition ${
                active
                  ? "bg-emerald-600 text-white border-emerald-600 font-bold"
                  : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300"
              }`}
            >
              {i === 0 ? "اليوم" : dayLabel.format(d)}
            </Link>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {sessions.map((s) => {
          const booked = s.bookings.filter((b) => b.status === "booked");
          const waitlist = s.bookings.filter((b) => b.status === "waitlist");
          const left = s.capacity - booked.length;
          const pct = (booked.length / s.capacity) * 100;
          const tone = left <= 0 ? "red" : left <= 3 ? "amber" : "emerald";

          const bySource = booked.reduce<Record<string, number>>((acc, b) => {
            acc[b.source] = (acc[b.source] ?? 0) + 1;
            return acc;
          }, {});

          return (
            <Card key={s.id} className="p-5">
              <div className="flex items-start gap-4 mb-4">
                <div className="text-center shrink-0">
                  <p className="text-lg font-extrabold tabular-nums whitespace-nowrap">{time(s.startsAt)}</p>
                  <p className="text-[11px] text-slate-400 flex items-center gap-1 justify-center mt-0.5">
                    <Clock className="w-3 h-3" />
                    {num(s.gymClass.durationMin)}د
                  </p>
                </div>
                <div className="w-px self-stretch bg-slate-100" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold">{s.gymClass.name}</p>
                  <p className="text-sm text-slate-500">{s.gymClass.coach}</p>
                </div>
                <Badge tone={tone}>{left <= 0 ? "مكتملة" : `باقي ${num(left)}`}</Badge>
              </div>

              <Bar pct={pct} tone={tone} />

              <div className="flex items-center gap-1.5 flex-wrap mt-3.5 mb-4">
                <Users2 className="w-3.5 h-3.5 text-slate-300" />
                {Object.entries(bySource).map(([src, count]) => (
                  <span key={src} className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                    {sourceLabel[src] ?? src}: {num(count)}
                  </span>
                ))}
                {waitlist.length > 0 && (
                  <span className="text-[11px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
                    انتظار: {num(waitlist.length)}
                  </span>
                )}
              </div>

              <form action={book} className="flex gap-2">
                <input type="hidden" name="sessionId" value={s.id} />
                <select
                  name="memberId"
                  defaultValue=""
                  required
                  className="flex-1 min-w-0 h-10 bg-white border border-slate-200 rounded-xl px-3 text-sm outline-none focus:border-emerald-400"
                >
                  <option value="" disabled>اختر عضواً…</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
                <button className="h-10 px-4 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 active:scale-[0.98] transition whitespace-nowrap">
                  {left <= 0 ? "قائمة الانتظار" : "احجز"}
                </button>
              </form>
            </Card>
          );
        })}
      </div>

      {sessions.length === 0 && <Empty text="لا توجد حصص في هذا اليوم" />}
    </>
  );
}
