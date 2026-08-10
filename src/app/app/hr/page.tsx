import { BriefcaseBusiness, CalendarOff, Check, CircleDollarSign, Users, X } from "lucide-react";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/auth";
import { Badge, Card, Empty, PageHeader, StatCard, Table, Td, Th, fullDate, num, sar } from "@/lib/ui";
import { decideLeave, payPayroll } from "../actions";

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export default async function HrPage() {
  const user = await requireModule("hr");
  const clubId = user.clubId!;
  const thisMonth = monthKey(new Date());

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [employees, payrolls, pendingLeaves, todayShifts, salaryTotal] = await Promise.all([
    db.employee.findMany({ where: { clubId }, orderBy: { salarySAR: "desc" } }),
    db.payroll.findMany({
      where: { month: thisMonth, employee: { clubId } },
      include: { employee: true },
      orderBy: { netSAR: "desc" },
    }),
    db.leave.findMany({
      where: { employee: { clubId }, status: "pending" },
      include: { employee: true },
      orderBy: { startsAt: "asc" },
    }),
    db.staffAttendance.findMany({
      where: { employee: { clubId }, day: todayStart },
      include: { employee: true },
    }),
    db.employee.aggregate({ where: { clubId, status: "active" }, _sum: { salarySAR: true } }),
  ]);

  const presentToday = todayShifts.filter((s) => s.status === "present").length;
  const pendingPayroll = payrolls.filter((p) => p.status === "pending");
  const pendingTotal = pendingPayroll.reduce((s, p) => s + p.netSAR, 0);

  return (
    <>
      <PageHeader title="الموارد البشرية" subtitle="الموظفون، الرواتب، الإجازات، والحضور" />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard label="عدد الموظفين" value={num(employees.length)} icon={<Users className="w-5 h-5" />} tone="emerald" />
        <StatCard
          label="حضور اليوم"
          value={`${num(presentToday)} / ${num(todayShifts.length)}`}
          icon={<BriefcaseBusiness className="w-5 h-5" />}
          tone="sky"
        />
        <StatCard
          label="رواتب مستحقة"
          value={sar(pendingTotal)}
          hint={`${num(pendingPayroll.length)} موظف`}
          icon={<CircleDollarSign className="w-5 h-5" />}
          tone="amber"
        />
        <StatCard
          label="إجمالي الرواتب الشهرية"
          value={sar(salaryTotal._sum.salarySAR ?? 0)}
          icon={<CircleDollarSign className="w-5 h-5" />}
          tone="violet"
        />
      </div>

      {pendingLeaves.length > 0 && (
        <Card title="طلبات إجازة بانتظار قرارك" className="mb-5">
          <ul className="divide-y divide-slate-50">
            {pendingLeaves.map((l) => (
              <li key={l.id} className="flex items-center gap-4 px-5 py-4">
                <CalendarOff className="w-5 h-5 text-amber-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm">
                    {l.employee.name} — إجازة {l.type}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    من {fullDate(l.startsAt)} إلى {fullDate(l.endsAt)}
                    {l.note && ` · ${l.note}`}
                  </p>
                </div>
                <form action={decideLeave} className="flex gap-2">
                  <input type="hidden" name="leaveId" value={l.id} />
                  <button
                    name="decision"
                    value="approved"
                    className="h-9 px-3.5 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 hover:bg-emerald-700 transition"
                  >
                    <Check className="w-3.5 h-3.5" />
                    موافقة
                  </button>
                  <button
                    name="decision"
                    value="rejected"
                    className="h-9 px-3.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-bold flex items-center gap-1.5 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition"
                  >
                    <X className="w-3.5 h-3.5" />
                    رفض
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-5 items-start">
        <Card title="الموظفون">
          <Table
            head={
              <>
                <Th>الموظف</Th>
                <Th>القسم</Th>
                <Th>الراتب</Th>
                <Th>الحالة</Th>
              </>
            }
          >
            {employees.map((e) => (
              <tr key={e.id} className="hover:bg-slate-50/60 transition">
                <Td>
                  <p className="font-bold">{e.name}</p>
                  <p className="text-xs text-slate-400">{e.jobTitle}</p>
                </Td>
                <Td className="text-slate-600">{e.department}</Td>
                <Td className="font-bold tabular-nums whitespace-nowrap">{sar(e.salarySAR)}</Td>
                <Td>
                  <Badge tone={e.status === "active" ? "emerald" : "amber"}>
                    {e.status === "active" ? "على رأس العمل" : "في إجازة"}
                  </Badge>
                </Td>
              </tr>
            ))}
          </Table>
        </Card>

        <Card title={`مسير رواتب ${thisMonth}`}>
          {payrolls.length === 0 ? (
            <Empty text="لا يوجد مسير لهذا الشهر" />
          ) : (
            <Table
              head={
                <>
                  <Th>الموظف</Th>
                  <Th>الأساسي</Th>
                  <Th>الصافي</Th>
                  <Th>الحالة</Th>
                </>
              }
            >
              {payrolls.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/60 transition">
                  <Td className="font-bold">{p.employee.name}</Td>
                  <Td className="text-slate-500 tabular-nums whitespace-nowrap">{sar(p.baseSAR)}</Td>
                  <Td className="font-bold tabular-nums whitespace-nowrap">{sar(p.netSAR)}</Td>
                  <Td>
                    {p.status === "paid" ? (
                      <Badge tone="emerald">مصروف</Badge>
                    ) : (
                      <form action={payPayroll}>
                        <input type="hidden" name="payrollId" value={p.id} />
                        <button className="h-8 px-3 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition whitespace-nowrap">
                          صرف
                        </button>
                      </form>
                    )}
                  </Td>
                </tr>
              ))}
            </Table>
          )}
          <p className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400">
            صرف الراتب يُقيَّد تلقائياً كمصروف في قسم المحاسبة
          </p>
        </Card>
      </div>

      <Card title="حضور الموظفين اليوم" className="mt-5">
        {todayShifts.length === 0 ? (
          <Empty text="لا يوجد سجل حضور اليوم" />
        ) : (
          <Table
            head={
              <>
                <Th>الموظف</Th>
                <Th>الدخول</Th>
                <Th>الخروج</Th>
                <Th>الحالة</Th>
              </>
            }
          >
            {todayShifts.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50/60 transition">
                <Td className="font-bold">{s.employee.name}</Td>
                <Td className="text-slate-600 tabular-nums">
                  {s.checkIn ? new Intl.DateTimeFormat("ar-SA", { hour: "numeric", minute: "2-digit" }).format(s.checkIn) : "—"}
                </Td>
                <Td className="text-slate-600 tabular-nums">
                  {s.checkOut ? new Intl.DateTimeFormat("ar-SA", { hour: "numeric", minute: "2-digit" }).format(s.checkOut) : "—"}
                </Td>
                <Td>
                  <Badge tone={s.status === "present" ? "emerald" : "red"}>
                    {s.status === "present" ? "حاضر" : "غائب"}
                  </Badge>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
