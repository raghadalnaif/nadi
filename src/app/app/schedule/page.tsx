import Link from "next/link";
import { Clock, Pencil, Plus, Trash2, Users2, X } from "lucide-react";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/auth";
import { Badge, Bar, Card, Empty, PageHeader, num, sourceLabel, time } from "@/lib/ui";
import { ConfirmButton, Dialog } from "@/components/dialog";
import { Field, Input, Select, Submit } from "@/components/form";
import { book } from "../actions";
import { cancelBooking, deleteClass, saveClass } from "../manage-actions";

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

  const [sessions, members, classes] = await Promise.all([
    db.classSession.findMany({
      where: { gymClass: { clubId }, startsAt: { gte: dayStart, lt: dayEnd } },
      include: {
        gymClass: true,
        bookings: { include: { member: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
      },
      orderBy: { startsAt: "asc" },
    }),
    db.member.findMany({ where: { clubId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.gymClass.findMany({ where: { clubId }, orderBy: { name: "asc" } }),
  ]);

  const totalBooked = sessions.reduce((s, x) => s + x.bookings.filter((b) => b.status === "booked").length, 0);
  const totalCapacity = sessions.reduce((s, x) => s + x.capacity, 0);

  return (
    <>
      <PageHeader
        title="الحصص والحجوزات"
        subtitle={`${num(totalBooked)} حجز من أصل ${num(totalCapacity)} مقعد متاح`}
        action={
          <div className="flex items-center gap-2">
            <Dialog label="إدارة الحصص" title="الحصص الحالية" variant="ghost" icon={<Pencil className="w-4 h-4" />}>
              <ul className="divide-y divide-slate-100 -mx-5 -mt-5 mb-4">
                {classes.map((c) => (
                  <li key={c.id} className="flex items-center gap-2 px-5 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold">{c.name}</p>
                      <p className="text-xs text-slate-400">
                        {c.coach} · {num(c.durationMin)}د · {num(c.capacity)} مقعد
                      </p>
                    </div>
                    <Dialog label="تعديل" title={`تعديل ${c.name}`} variant="icon" icon={<Pencil className="w-4 h-4" />}>
                      <form action={saveClass} className="space-y-3">
                        <input type="hidden" name="classId" value={c.id} />
                        <Field label="اسم الحصة">
                          <Input name="name" defaultValue={c.name} required />
                        </Field>
                        <Field label="المدرب">
                          <Input name="coach" defaultValue={c.coach} required />
                        </Field>
                        <div className="grid grid-cols-2 gap-3">
                          <Field label="المدة (دقيقة)">
                            <Input name="durationMin" type="number" min="1" defaultValue={c.durationMin} required />
                          </Field>
                          <Field label="السعة">
                            <Input name="capacity" type="number" min="1" defaultValue={c.capacity} required />
                          </Field>
                        </div>
                        <Submit>حفظ</Submit>
                      </form>
                    </Dialog>
                    <form action={deleteClass}>
                      <input type="hidden" name="classId" value={c.id} />
                      <ConfirmButton
                        label="حذف"
                        message={`حذف حصة ${c.name}؟ ستُحذف كل جلساتها وحجوزاتها.`}
                        icon={<Trash2 className="w-4 h-4" />}
                      />
                    </form>
                  </li>
                ))}
                {classes.length === 0 && (
                  <li className="px-5 py-6 text-center text-sm text-slate-400">لا توجد حصص</li>
                )}
              </ul>
            </Dialog>

            <Dialog
              label="حصة جديدة"
              title="إضافة حصة"
              description="تُولَّد الجلسات تلقائياً للأيام القادمة"
              icon={<Plus className="w-4 h-4" />}
            >
              <form action={saveClass} className="space-y-3">
                <Field label="اسم الحصة">
                  <Input name="name" required placeholder="بيلاتس" />
                </Field>
                <Field label="المدرب">
                  <Input name="coach" required placeholder="المدرب سعد" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="المدة (دقيقة)">
                    <Input name="durationMin" type="number" min="1" defaultValue={60} required />
                  </Field>
                  <Field label="السعة">
                    <Input name="capacity" type="number" min="1" defaultValue={15} required />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="ساعة البداية">
                    <Select name="hour" defaultValue="18">
                      {Array.from({ length: 17 }, (_, i) => i + 6).map((h) => (
                        <option key={h} value={h}>
                          {h > 12 ? `${h - 12} مساءً` : `${h} صباحاً`}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="عدد الأيام">
                    <Select name="days" defaultValue="7">
                      {[7, 14, 30].map((d) => (
                        <option key={d} value={d}>{d} يوم</option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <Submit>إضافة الحصة</Submit>
              </form>
            </Dialog>
          </div>
        }
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

              <div className="flex gap-2">
                <form action={book} className="flex gap-2 flex-1 min-w-0">
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

                <Dialog
                  label={`المحجوزون (${num(s.bookings.length)})`}
                  title={`حجوزات ${s.gymClass.name}`}
                  description="إلغاء أي حجز يرقّي أول شخص في قائمة الانتظار تلقائياً"
                  variant="icon"
                  icon={<Users2 className="w-4 h-4" />}
                >
                  <ul className="divide-y divide-slate-100 -mx-5 -mt-5">
                    {s.bookings.map((b) => (
                      <li key={b.id} className="flex items-center gap-3 px-5 py-3">
                        <span className="text-sm flex-1 truncate">{b.member.name}</span>
                        <Badge tone={b.status === "booked" ? "emerald" : "amber"}>
                          {b.status === "booked" ? "مؤكد" : "انتظار"}
                        </Badge>
                        <span className="text-[11px] text-slate-400">{sourceLabel[b.source] ?? b.source}</span>
                        <form action={cancelBooking}>
                          <input type="hidden" name="bookingId" value={b.id} />
                          <ConfirmButton
                            label="إلغاء الحجز"
                            message={`إلغاء حجز ${b.member.name}؟`}
                            icon={<X className="w-4 h-4" />}
                          />
                        </form>
                      </li>
                    ))}
                    {s.bookings.length === 0 && (
                      <li className="px-5 py-6 text-center text-sm text-slate-400">لا حجوزات بعد</li>
                    )}
                  </ul>
                </Dialog>
              </div>
            </Card>
          );
        })}
      </div>

      {sessions.length === 0 && <Empty text="لا توجد حصص في هذا اليوم" />}
    </>
  );
}
