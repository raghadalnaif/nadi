import { BriefcaseBusiness, CalendarOff, CalendarPlus, Check, CircleDollarSign, LogIn, LogOut, Pencil, Plus, ScanLine, Trash2, UserPlus, UserX, Users, X } from "lucide-react";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/auth";
import { Badge, Card, Empty, PageHeader, StatCard, Table, Td, Th, fullDate, num, sar } from "@/lib/ui";
import { ConfirmButton, Dialog } from "@/components/dialog";
import { Field, Input, Select, Submit } from "@/components/form";
import { decideLeave, payPayroll } from "../actions";
import { addLeave, deleteEmployee, generatePayroll, saveEmployee } from "../manage-actions";
import { markStaffAbsent, staffCheckIn, staffCheckOut } from "../ops-actions";
import { generatePayrollPro } from "./actions";
import Link from "next/link";

const departments = ["إدارة", "تدريب", "استقبال", "محاسبة", "صيانة"];

const hhmm = new Intl.DateTimeFormat("ar-SA", { hour: "numeric", minute: "2-digit" });
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
      <PageHeader
        title="الموارد البشرية"
        subtitle="الموظفون، الرواتب، الإجازات، والحضور"
        action={
          <div className="flex items-center gap-2">
            <Dialog label="تسجيل إجازة" title="تسجيل طلب إجازة" variant="ghost" icon={<CalendarPlus className="w-4 h-4" />}>
              <form action={addLeave} className="space-y-3">
                <Field label="الموظف">
                  <Select name="employeeId" required>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </Select>
                </Field>
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
                <Field label="ملاحظة">
                  <Input name="note" placeholder="سبب الإجازة (اختياري)" />
                </Field>
                <Submit>تسجيل الطلب</Submit>
              </form>
            </Dialog>

            <Link
              href="/app/hr/kiosk"
              className="h-9 px-3.5 rounded-xl bg-slate-900 text-white text-sm font-bold flex items-center gap-1.5 hover:bg-slate-800 transition whitespace-nowrap"
            >
              <ScanLine className="w-4 h-4" />
              نقطة الحضور
            </Link>

            <Dialog label="مسير رواتب" title="إنشاء مسير رواتب" description="يُحسب من الحضور الفعلي والبدلات والتأمينات" variant="ghost" icon={<Plus className="w-4 h-4" />}>
              <form action={generatePayrollPro} className="space-y-3">
                <Field label="الشهر">
                  <Input name="month" defaultValue={thisMonth} placeholder="2026-08" dir="ltr" className="text-right" required />
                </Field>
                <Submit>إنشاء المسير</Submit>
              </form>
            </Dialog>

            <Dialog label="موظف جديد" title="إضافة موظف" icon={<UserPlus className="w-4 h-4" />}>
              <form action={saveEmployee} className="space-y-3">
                <Field label="الاسم">
                  <Input name="name" required placeholder="محمد العتيبي" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="المسمى الوظيفي">
                    <Input name="jobTitle" required placeholder="مدرب" />
                  </Field>
                  <Field label="القسم">
                    <Select name="department" defaultValue="تدريب">
                      {departments.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="الراتب الشهري">
                    <Input name="salarySAR" type="number" min="0" step="100" required defaultValue={5000} />
                  </Field>
                  <Field label="الجوال">
                    <Input name="phone" dir="ltr" className="text-right" placeholder="05xxxxxxxx" required />
                  </Field>
                </div>
                <Field label="الآيبان">
                  <Input name="iban" dir="ltr" className="text-right" placeholder="SA…" />
                </Field>
                <Submit>إضافة الموظف</Submit>
              </form>
            </Dialog>
          </div>
        }
      />

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
                <Th>إجراء</Th>
              </>
            }
          >
            {employees.map((e) => (
              <tr key={e.id} className="hover:bg-slate-50/60 transition">
                <Td>
                  <Link href={`/app/hr/${e.id}`} className="font-bold hover:text-emerald-700 transition">
                    {e.name}
                  </Link>
                  <p className="text-xs text-slate-400">{e.jobTitle}</p>
                </Td>
                <Td className="text-slate-600">{e.department}</Td>
                <Td className="font-bold tabular-nums whitespace-nowrap">{sar(e.salarySAR)}</Td>
                <Td>
                  <Badge tone={e.status === "active" ? "emerald" : "amber"}>
                    {e.status === "active" ? "على رأس العمل" : "في إجازة"}
                  </Badge>
                </Td>
                <Td>
                  <div className="flex items-center gap-1">
                    <Dialog label="تعديل" title={`تعديل ${e.name}`} variant="icon" icon={<Pencil className="w-4 h-4" />}>
                      <form action={saveEmployee} className="space-y-3">
                        <input type="hidden" name="employeeId" value={e.id} />
                        <Field label="الاسم">
                          <Input name="name" defaultValue={e.name} required />
                        </Field>
                        <div className="grid grid-cols-2 gap-3">
                          <Field label="المسمى الوظيفي">
                            <Input name="jobTitle" defaultValue={e.jobTitle} required />
                          </Field>
                          <Field label="القسم">
                            <Select name="department" defaultValue={e.department}>
                              {departments.map((d) => (
                                <option key={d} value={d}>{d}</option>
                              ))}
                            </Select>
                          </Field>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <Field label="الراتب">
                            <Input name="salarySAR" type="number" min="0" step="100" defaultValue={e.salarySAR} required />
                          </Field>
                          <Field label="الجوال">
                            <Input name="phone" defaultValue={e.phone} dir="ltr" className="text-right" required />
                          </Field>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <Field label="الآيبان">
                            <Input name="iban" defaultValue={e.iban ?? ""} dir="ltr" className="text-right" />
                          </Field>
                          <Field label="الحالة">
                            <Select name="status" defaultValue={e.status}>
                              <option value="active">على رأس العمل</option>
                              <option value="on_leave">في إجازة</option>
                              <option value="terminated">منتهي الخدمة</option>
                            </Select>
                          </Field>
                        </div>
                        <Submit>حفظ</Submit>
                      </form>
                    </Dialog>

                    <form action={deleteEmployee}>
                      <input type="hidden" name="employeeId" value={e.id} />
                      <ConfirmButton
                        label="حذف"
                        message={`حذف الموظف ${e.name} نهائياً؟ ستُحذف رواتبه وإجازاته وسجل حضوره.`}
                        icon={<Trash2 className="w-4 h-4" />}
                      />
                    </form>
                  </div>
                </Td>
              </tr>
            ))}
          </Table>
          {employees.length === 0 && <Empty text="لا يوجد موظفون — أضف أول موظف" />}
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
        <Table
          head={
            <>
              <Th>الموظف</Th>
              <Th>الدخول</Th>
              <Th>الخروج</Th>
              <Th>ساعات العمل</Th>
              <Th>الحالة</Th>
              <Th>تسجيل</Th>
            </>
          }
        >
          {employees.map((e) => {
            const shift = todayShifts.find((s) => s.employeeId === e.id);
            const hours =
              shift?.checkIn && shift?.checkOut
                ? (shift.checkOut.getTime() - shift.checkIn.getTime()) / 3600000
                : null;

            return (
              <tr key={e.id} className="hover:bg-slate-50/60 transition">
                <Td className="font-bold">{e.name}</Td>
                <Td className="text-slate-600 tabular-nums">
                  {shift?.checkIn ? hhmm.format(shift.checkIn) : "—"}
                </Td>
                <Td className="text-slate-600 tabular-nums">
                  {shift?.checkOut ? hhmm.format(shift.checkOut) : "—"}
                </Td>
                <Td className="text-slate-600 tabular-nums whitespace-nowrap">
                  {hours !== null ? `${hours.toFixed(1)} ساعة` : "—"}
                </Td>
                <Td>
                  <Badge
                    tone={
                      shift?.status === "present" ? "emerald" : shift?.status === "absent" ? "red" : "slate"
                    }
                  >
                    {shift?.status === "present" ? "حاضر" : shift?.status === "absent" ? "غائب" : "لم يسجّل"}
                  </Badge>
                </Td>
                <Td>
                  <div className="flex items-center gap-1">
                    {!shift?.checkIn && (
                      <form action={staffCheckIn}>
                        <input type="hidden" name="employeeId" value={e.id} />
                        <button className="h-8 px-3 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 hover:bg-emerald-700 transition whitespace-nowrap">
                          <LogIn className="w-3.5 h-3.5" />
                          دخول
                        </button>
                      </form>
                    )}
                    {shift?.checkIn && !shift?.checkOut && (
                      <form action={staffCheckOut}>
                        <input type="hidden" name="employeeId" value={e.id} />
                        <button className="h-8 px-3 rounded-lg border border-slate-200 text-slate-600 text-xs font-bold flex items-center gap-1.5 hover:bg-slate-50 transition whitespace-nowrap">
                          <LogOut className="w-3.5 h-3.5" />
                          خروج
                        </button>
                      </form>
                    )}
                    {shift?.status !== "absent" && (
                      <form action={markStaffAbsent}>
                        <input type="hidden" name="employeeId" value={e.id} />
                        <ConfirmButton
                          label="تسجيل غياب"
                          message={`تسجيل غياب ${e.name} اليوم؟`}
                          icon={<UserX className="w-4 h-4" />}
                        />
                      </form>
                    )}
                  </div>
                </Td>
              </tr>
            );
          })}
        </Table>
        {employees.length === 0 && <Empty text="لا يوجد موظفون" />}
      </Card>
    </>
  );
}
