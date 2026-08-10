import Link from "next/link";
import { db } from "@/lib/db";
import { book } from "../actions";

const dayMs = 24 * 60 * 60 * 1000;
const fmtNum = new Intl.NumberFormat("ar-SA");
const fmtTime = new Intl.DateTimeFormat("ar-SA", { hour: "numeric", minute: "2-digit" });
const fmtDay = new Intl.DateTimeFormat("ar-SA", { weekday: "long", day: "numeric", month: "long" });

const sourceLabel: Record<string, string> = {
  app: "التطبيق",
  reception: "الاستقبال",
  urpass: "UrPass",
};

export default async function SchedulePage({ searchParams }: PageProps<"/schedule">) {
  const params = await searchParams;
  const day = Math.min(6, Math.max(0, Number(params.day) || 0));

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  dayStart.setDate(dayStart.getDate() + day);
  const dayEnd = new Date(dayStart.getTime() + dayMs);

  const [sessions, members] = await Promise.all([
    db.classSession.findMany({
      where: { startsAt: { gte: dayStart, lt: dayEnd } },
      include: { gymClass: true, bookings: true },
      orderBy: { startsAt: "asc" },
    }),
    db.member.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div>
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {Array.from({ length: 7 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() + i);
          const active = i === day;
          return (
            <Link
              key={i}
              href={`/schedule?day=${i}`}
              className={`px-4 py-2 rounded-xl text-sm whitespace-nowrap border ${
                active
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300"
              }`}
            >
              {i === 0 ? "اليوم" : fmtDay.format(d)}
            </Link>
          );
        })}
      </div>

      <div className="flex flex-col gap-4">
        {sessions.map((s) => {
          const booked = s.bookings.filter((b) => b.status === "booked");
          const waitlist = s.bookings.filter((b) => b.status === "waitlist");
          const left = s.capacity - booked.length;
          const pct = Math.min(100, Math.round((booked.length / s.capacity) * 100));
          const barColor = left <= 0 ? "bg-red-500" : left <= 3 ? "bg-amber-500" : "bg-emerald-500";

          const bySource = booked.reduce<Record<string, number>>((acc, b) => {
            acc[b.source] = (acc[b.source] ?? 0) + 1;
            return acc;
          }, {});

          return (
            <div key={s.id} className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="flex items-center gap-4 mb-3">
                <div className="text-center min-w-14">
                  <p className="font-bold text-lg">{fmtTime.format(s.startsAt)}</p>
                </div>
                <div className="w-px self-stretch bg-slate-200" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold">{s.gymClass.name}</p>
                  <p className="text-sm text-slate-500">
                    {s.gymClass.coach} · {fmtNum.format(s.gymClass.durationMin)} دقيقة
                  </p>
                </div>
                <span
                  className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap ${
                    left <= 0
                      ? "bg-red-50 text-red-700"
                      : left <= 3
                        ? "bg-amber-50 text-amber-700"
                        : "bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {left <= 0 ? "مكتملة" : `باقي ${fmtNum.format(left)} مقاعد`}
                </span>
              </div>

              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-3">
                <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {Object.entries(bySource).map(([src, count]) => (
                  <span
                    key={src}
                    className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full"
                  >
                    {sourceLabel[src] ?? src}: {fmtNum.format(count)}
                  </span>
                ))}
                {waitlist.length > 0 && (
                  <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
                    قائمة الانتظار: {fmtNum.format(waitlist.length)}
                  </span>
                )}

                <form action={book} className="mr-auto flex items-center gap-2">
                  <input type="hidden" name="sessionId" value={s.id} />
                  <select
                    name="memberId"
                    className="text-sm bg-white border border-slate-200 rounded-xl px-3 py-2"
                    defaultValue=""
                  >
                    <option value="" disabled>
                      اختر عضواً…
                    </option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                  <button className="text-sm bg-emerald-600 text-white rounded-xl px-4 py-2 hover:bg-emerald-700 whitespace-nowrap">
                    {left <= 0 ? "قائمة الانتظار" : "احجز"}
                  </button>
                </form>
              </div>
            </div>
          );
        })}
        {sessions.length === 0 && (
          <p className="text-center text-slate-500 py-10">لا توجد حصص في هذا اليوم</p>
        )}
      </div>
    </div>
  );
}
