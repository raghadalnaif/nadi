import { redirect } from "next/navigation";
import {
  CalendarCheck,
  CalendarPlus,
  CheckCheck,
  Clock,
  Dumbbell,
  LogOut,
  Megaphone,
  Star,
  Trash2,
  Wallet,
} from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { computePayroll, leaveEntitlement } from "@/lib/hr";
import { Badge, Card, Empty, PageHeader, StatCard, Table, Td, Th, fullDate, num, sar, time } from "@/lib/ui";
import { ConfirmButton, Dialog } from "@/components/dialog";
import { Field, Input, Select, Submit } from "@/components/form";
import { logout } from "../login/actions";
import { markRead } from "../app/board/actions";
import { cancelMyLeave, requestLeave } from "./actions";

export default async function MyPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.employeeId) redirect("/login");

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const year = new Date().getFullYear();

  const emp = await db.employee.findUnique({
    where: { id: user.employeeId },
    include: {
      leaves: { orderBy: { startsAt: "desc" }, take: 10 },
      evaluations: { orderBy: { year: "desc" }, take: 3 },
      shifts: { where: { day: { gte: monthStart } }, orderBy: { day: "desc" } },
      branch: { select: { name: true } },
    },
  });
  if (!emp) redirect("/login");

  const announcements = await db.announcement.findMany({
    where: {
      clubId: user.clubId!,
      OR: [{ audience: "all" }, { audience: "department", department: emp.department }],
    },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take: 8,
    include: { reads: { where: { userId: user.id }, select: { id: true } } },
  });

  const leave = leaveEntitlement(emp.hireDate, emp.annualLeaveDays);
  const usedDays = emp.leaves
    .filter((l) => l.status === "approved")
    .reduce((s, l) => s + Math.ceil((l.endsAt.getTime() - l.startsAt.getTime()) / 86400000) + 1, 0);
  const remaining = Math.max(0, leave.accruedDays - usedDays);

  const presentDays = emp.shifts.filter((s) => s.status === "present").length;
  const absentDays = emp.shifts.filter((s) => s.status === "absent").length;
  const lateTotal = emp.shifts.reduce((s, x) => s + x.lateMinutes, 0);
  const otTotal = emp.shifts.reduce((s, x) => s + x.overtimeMinutes, 0);

  const pay = computePayroll({
    basicSAR: emp.salarySAR,
    housingSAR: emp.housingSAR,
    transportSAR: emp.transportSAR,
    otherAllowSAR: emp.otherAllowSAR,
    isSaudi: emp.nationality === "سعودي",
    gosiSubject: emp.gosiSubject,
    absentDays,
    overtimeMinutes: otTotal,
  });

  const evalThis = emp.evaluations.find((e) => e.year === year) ?? emp.evaluations[0];
  const stars = (n: number) => "★".repeat(Math.round(n)) + "☆".repeat(5 - Math.round(n));

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center gap-3">
          <span className="w-9 h-9 rounded-xl bg-emerald-600 grid place-items-center shrink-0">
            <Dumbbell className="w-[18px] h-[18px] text-white" />
          </span>
          <div className="min-w-0">
            <p className="font-extrabold text-slate-900 leading-tight truncate">{emp.name}</p>
            <p className="text-[11px] text-slate-400 leading-tight">
              {emp.jobTitle} · {emp.branch?.name ?? user.club?.name}
            </p>
          </div>
          <form action={logout} className="mr-auto">
            <button className="h-9 px-3.5 rounded-xl border border-slate-200 text-sm text-slate-600 flex items-center gap-1.5 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition">
              <LogOut className="w-4 h-4" />
              خروج
            </button>
          </form>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-7">
        <PageHeader
          title="ملفي الوظيفي"
          subtitle={`التحقت في ${fullDate(emp.hireDate)} · خدمة ${num(leave.serviceYears)} سنة`}
          action={
            <Dialog label="طلب إجازة" title="رفع طلب إجازة" icon={<CalendarPlus className="w-4 h-4" />}>
              <form action={requestLeave} className="space-y-3">
                <div className="rounded-xl bg-emerald-50 ring-1 ring-emerald-100 px-4 py-3 text-sm text-emerald-800">
                  رصيدك المتبقي: <b>{num(remaining)} يوم</b> من {num(leave.annualDays)}
                </div>
                <Field label="نوع الإجازة">
                  <Select name="type" defaultValue="سنوية">
                    {["سنوية", "مرضية", "اضطرارية", "بدون راتب"].map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </Select>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="من">
                    <Input name="startsAt" type="date" required />
                  </Field>
                  <Field label="إلى">
                    <Input name="endsAt" type="date" required />
                  </Field>
                </div>
                <Field label="السبب">
                  <Input name="note" placeholder="سفر، ظرف عائلي…" />
                </Field>
                <Submit>رفع الطلب للموارد البشرية</Submit>
              </form>
            </Dialog>
          }
        />

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          <StatCard
            label="رصيد الإجازات"
            value={`${num(remaining)} يوم`}
            hint={`مستخدم ${num(usedDays)} من ${num(leave.annualDays)}`}
            icon={<CalendarPlus className="w-5 h-5" />}
            tone={remaining > 5 ? "emerald" : "amber"}
          />
          <StatCard
            label="حضور هذا الشهر"
            value={`${num(presentDays)} يوم`}
            hint={absentDays > 0 ? `غياب ${num(absentDays)} يوم` : "بلا غياب"}
            icon={<CalendarCheck className="w-5 h-5" />}
            tone="sky"
          />
          <StatCard
            label="التقييم السنوي"
            value={evalThis ? `${evalThis.overall} / 5` : "لم يُقيَّم"}
            hint={evalThis ? `عن سنة ${num(evalThis.year)}` : undefined}
            icon={<Star className="w-5 h-5" />}
            tone={evalThis ? (evalThis.overall >= 4 ? "emerald" : evalThis.overall >= 3 ? "sky" : "amber") : "slate"}
          />
          <StatCard
            label="صافي راتبي المتوقع"
            value={sar(pay.netSAR)}
            hint={`إجمالي ${sar(pay.grossSAR)}`}
            icon={<Wallet className="w-5 h-5" />}
            tone="violet"
          />
        </div>

        <div className="grid lg:grid-cols-2 gap-5 items-start">
          <Card title="طلبات إجازاتي">
            {emp.leaves.length === 0 ? (
              <Empty text="لا توجد طلبات — ارفع طلبك الأول" />
            ) : (
              <ul className="divide-y divide-slate-50">
                {emp.leaves.map((l) => (
                  <li key={l.id} className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold">إجازة {l.type}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {fullDate(l.startsAt)} — {fullDate(l.endsAt)}
                        </p>
                      </div>
                      <Badge
                        tone={l.status === "approved" ? "emerald" : l.status === "rejected" ? "red" : "amber"}
                      >
                        {l.status === "approved" ? "مقبولة" : l.status === "rejected" ? "مرفوضة" : "قيد الدراسة"}
                      </Badge>
                      {l.status === "pending" && (
                        <form action={cancelMyLeave}>
                          <input type="hidden" name="leaveId" value={l.id} />
                          <ConfirmButton label="سحب الطلب" message="سحب طلب الإجازة؟" icon={<Trash2 className="w-4 h-4" />} />
                        </form>
                      )}
                    </div>
                    {l.decisionNote && (
                      <p className="text-xs text-slate-500 mt-2 bg-slate-50 rounded-lg px-3 py-2">
                        <b>رد الموارد البشرية:</b> {l.decisionNote}
                        {l.decidedBy && ` — ${l.decidedBy}`}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="تقييمي السنوي">
            {!evalThis ? (
              <Empty text="لم يصدر تقييم بعد" />
            ) : (
              <div className="p-5 pt-4">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl font-extrabold text-emerald-700 tabular-nums">
                    {evalThis.overall}
                  </span>
                  <div>
                    <p className="text-amber-500 text-lg leading-none">{stars(evalThis.overall)}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      تقييم {num(evalThis.year)} · بواسطة {evalThis.byName}
                    </p>
                  </div>
                </div>

                <dl className="space-y-2.5">
                  {[
                    ["الالتزام بالحضور", evalThis.attendance],
                    ["الأداء الوظيفي", evalThis.performance],
                    ["العمل الجماعي", evalThis.teamwork],
                    ["الانضباط", evalThis.discipline],
                  ].map(([label, score]) => (
                    <div key={String(label)}>
                      <div className="flex justify-between text-sm mb-1">
                        <dt className="text-slate-600">{label}</dt>
                        <dd className="font-bold tabular-nums">{num(Number(score))} / 5</dd>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${(Number(score) / 5) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </dl>

                {evalThis.notes && (
                  <p className="text-sm text-slate-600 mt-4 pt-3 border-t border-slate-100">
                    {evalThis.notes}
                  </p>
                )}
              </div>
            )}
          </Card>
        </div>

        <Card
          title="سجل حضوري هذا الشهر"
          className="mt-5"
          action={
            <span className="text-xs text-slate-400">
              تأخير {num(lateTotal)}د · إضافي {num(otTotal)}د
            </span>
          }
        >
          {emp.shifts.length === 0 ? (
            <Empty text="لا سجلات هذا الشهر" />
          ) : (
            <Table
              head={
                <>
                  <Th>اليوم</Th>
                  <Th>الدخول</Th>
                  <Th>الخروج</Th>
                  <Th>الحالة</Th>
                </>
              }
            >
              {emp.shifts.slice(0, 15).map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/60 transition">
                  <Td className="text-slate-600 text-xs whitespace-nowrap">{fullDate(s.day)}</Td>
                  <Td className="tabular-nums text-xs">{s.checkIn ? time(s.checkIn) : "—"}</Td>
                  <Td className="tabular-nums text-xs">{s.checkOut ? time(s.checkOut) : "—"}</Td>
                  <Td>
                    <div className="flex gap-1 flex-wrap">
                      {s.status === "absent" && <Badge tone="red">غياب</Badge>}
                      {s.lateMinutes > 0 && <Badge tone="amber">تأخير {num(s.lateMinutes)}د</Badge>}
                      {s.overtimeMinutes > 0 && <Badge tone="sky">إضافي {num(s.overtimeMinutes)}د</Badge>}
                      {s.status === "present" && s.lateMinutes === 0 && s.overtimeMinutes === 0 && (
                        <Badge tone="emerald">منتظم</Badge>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <Card
          title="إعلانات الإدارة"
          className="mt-5"
          action={<span className="text-xs text-slate-400 flex items-center gap-1.5"><Megaphone className="w-3.5 h-3.5" />{num(announcements.length)}</span>}
        >
          {announcements.length === 0 ? (
            <Empty text="لا توجد إعلانات" />
          ) : (
            <ul className="divide-y divide-slate-50">
              {announcements.map((a) => {
                const read = a.reads.length > 0;
                return (
                  <li key={a.id} className={`px-5 py-4 ${read ? "" : "bg-emerald-50/30"}`}>
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-sm">{a.title}</p>
                          {a.pinned && <Badge tone="amber">مثبّت</Badge>}
                          {!read && <Badge tone="emerald">جديد</Badge>}
                        </div>
                        <p className="text-sm text-slate-600 mt-1.5 whitespace-pre-line leading-relaxed">
                          {a.body}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-2">
                          {a.authorName} · {fullDate(a.createdAt)}
                        </p>
                      </div>

                      {!read && (
                        <form action={markRead} className="shrink-0">
                          <input type="hidden" name="announcementId" value={a.id} />
                          <button className="h-9 px-3.5 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 hover:bg-emerald-700 transition whitespace-nowrap">
                            <CheckCheck className="w-3.5 h-3.5" />
                            اطّلعت
                          </button>
                        </form>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <p className="text-center text-xs text-slate-400 mt-6 flex items-center justify-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          دوامك الرسمي {emp.shiftStart} — {emp.shiftEnd}
        </p>
      </main>
    </div>
  );
}
