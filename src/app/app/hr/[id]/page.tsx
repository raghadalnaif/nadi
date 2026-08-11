import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Clock,
  MapPin,
  Pencil,
  QrCode,
  ShieldCheck,
  Star,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/auth";
import { computePayroll, endOfService, expiryAlerts, gosiFor, leaveEntitlement } from "@/lib/hr";
import { Badge, Card, Empty, PageHeader, StatCard, Table, Td, Th, fullDate, num, sar, time } from "@/lib/ui";
import { Dialog } from "@/components/dialog";
import { Field, Input, Select, Submit } from "@/components/form";
import { generateEmployeeBarcode, saveEmployeeDetails } from "../actions";
import { saveEvaluation } from "@/app/me/actions";

const iso = (d?: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export default async function EmployeePage({ params }: PageProps<"/app/hr/[id]">) {
  const user = await requireModule("hr");
  const { id } = await params;

  const emp = await db.employee.findFirst({
    where: { id, clubId: user.clubId! },
    include: {
      payrolls: { orderBy: { month: "desc" }, take: 6 },
      leaves: { orderBy: { startsAt: "desc" }, take: 6 },
      shifts: { orderBy: { day: "desc" }, take: 14 },
    },
  });
  if (!emp) notFound();

  const isSaudi = emp.nationality === "سعودي";
  const gross = emp.salarySAR + emp.housingSAR + emp.transportSAR + emp.otherAllowSAR;
  const gosi = gosiFor({ basicSAR: emp.salarySAR, housingSAR: emp.housingSAR, isSaudi, subject: emp.gosiSubject });
  const eos = endOfService({ totalMonthlySAR: gross, hireDate: emp.hireDate });
  const leave = leaveEntitlement(emp.hireDate, emp.annualLeaveDays);
  const alerts = expiryAlerts(emp);

  const usedLeaveDays = emp.leaves
    .filter((l) => l.status === "approved")
    .reduce((s, l) => s + Math.ceil((l.endsAt.getTime() - l.startsAt.getTime()) / 86400000) + 1, 0);

  const preview = computePayroll({
    basicSAR: emp.salarySAR,
    housingSAR: emp.housingSAR,
    transportSAR: emp.transportSAR,
    otherAllowSAR: emp.otherAllowSAR,
    isSaudi,
    gosiSubject: emp.gosiSubject,
    absentDays: 0,
    overtimeMinutes: 0,
  });

  const lateTotal = emp.shifts.reduce((s, x) => s + x.lateMinutes, 0);
  const otTotal = emp.shifts.reduce((s, x) => s + x.overtimeMinutes, 0);

  return (
    <>
      <Link href="/app/hr" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-emerald-700 transition mb-5">
        <ArrowRight className="w-4 h-4" />
        رجوع للموارد البشرية
      </Link>

      <PageHeader
        title={emp.name}
        subtitle={`${emp.jobTitle} · ${emp.department} · التحق في ${fullDate(emp.hireDate)}`}
        action={
          <div className="flex items-center gap-2">
            {!emp.barcode && (
              <form action={generateEmployeeBarcode}>
                <input type="hidden" name="employeeId" value={emp.id} />
                <button className="h-9 px-3.5 rounded-xl border border-slate-200 text-sm text-slate-600 flex items-center gap-1.5 hover:bg-slate-50 transition">
                  <QrCode className="w-4 h-4" />
                  توليد باركود
                </button>
              </form>
            )}
            <Dialog label="التقييم السنوي" title={`تقييم ${emp.name}`} variant="ghost" icon={<Star className="w-4 h-4" />}>
              <form action={saveEvaluation} className="space-y-3">
                <input type="hidden" name="employeeId" value={emp.id} />
                <Field label="السنة">
                  <Input name="year" type="number" defaultValue={new Date().getFullYear()} required />
                </Field>
                {[
                  ["attendance", "الالتزام بالحضور"],
                  ["performance", "الأداء الوظيفي"],
                  ["teamwork", "العمل الجماعي"],
                  ["discipline", "الانضباط"],
                ].map(([name, label]) => (
                  <Field key={name} label={`${label} (1-5)`}>
                    <Input name={name} type="number" min="1" max="5" step="1" defaultValue={3} required />
                  </Field>
                ))}
                <Field label="ملاحظات">
                  <Input name="notes" placeholder="نقاط القوة وفرص التحسين" />
                </Field>
                <Submit>حفظ التقييم</Submit>
              </form>
            </Dialog>

            <Dialog label="بيانات التوظيف" title={`بيانات ${emp.name}`} icon={<Pencil className="w-4 h-4" />}>
              <form action={saveEmployeeDetails} className="space-y-3">
                <input type="hidden" name="employeeId" value={emp.id} />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="رقم الهوية / الإقامة">
                    <Input name="nationalId" defaultValue={emp.nationalId ?? ""} dir="ltr" className="text-right" />
                  </Field>
                  <Field label="الجنسية">
                    <Select name="nationality" defaultValue={emp.nationality}>
                      <option value="سعودي">سعودي</option>
                      <option value="مقيم">مقيم</option>
                    </Select>
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="نوع العقد">
                    <Select name="contractType" defaultValue={emp.contractType}>
                      <option value="full_time">دوام كامل</option>
                      <option value="part_time">دوام جزئي</option>
                      <option value="temporary">مؤقت</option>
                    </Select>
                  </Field>
                  <Field label="انتهاء العقد">
                    <Input name="contractEndsAt" type="date" defaultValue={iso(emp.contractEndsAt)} />
                  </Field>
                </div>
                <Field label="انتهاء الهوية / الإقامة">
                  <Input name="idExpiresAt" type="date" defaultValue={iso(emp.idExpiresAt)} />
                </Field>

                <div className="pt-3 border-t border-slate-100">
                  <p className="text-xs text-slate-400 mb-3">البدلات الشهرية</p>
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="سكن">
                      <Input name="housingSAR" type="number" min="0" step="50" defaultValue={emp.housingSAR} />
                    </Field>
                    <Field label="نقل">
                      <Input name="transportSAR" type="number" min="0" step="50" defaultValue={emp.transportSAR} />
                    </Field>
                    <Field label="أخرى">
                      <Input name="otherAllowSAR" type="number" min="0" step="50" defaultValue={emp.otherAllowSAR} />
                    </Field>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <Field label="بداية الدوام">
                    <Input name="shiftStart" type="time" defaultValue={emp.shiftStart} />
                  </Field>
                  <Field label="نهاية الدوام">
                    <Input name="shiftEnd" type="time" defaultValue={emp.shiftEnd} />
                  </Field>
                  <Field label="إجازة سنوية">
                    <Input name="annualLeaveDays" type="number" min="0" defaultValue={emp.annualLeaveDays} />
                  </Field>
                </div>

                <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 cursor-pointer">
                  <input type="checkbox" name="gosiSubject" defaultChecked={emp.gosiSubject} className="w-4 h-4 accent-emerald-600" />
                  <span className="text-sm font-bold text-slate-800">خاضع للتأمينات الاجتماعية</span>
                </label>

                <Submit>حفظ</Submit>
              </form>
            </Dialog>
          </div>
        }
      />

      {alerts.length > 0 && (
        <div className="mb-5 space-y-2">
          {alerts.map((a) => (
            <div
              key={a.label}
              className={`rounded-2xl px-5 py-3.5 flex items-center gap-3 ring-1 ${
                a.tone === "red" ? "bg-red-50 ring-red-100" : "bg-amber-50 ring-amber-100"
              }`}
            >
              <TriangleAlert className={`w-5 h-5 shrink-0 ${a.tone === "red" ? "text-red-600" : "text-amber-600"}`} />
              <p className={`text-sm ${a.tone === "red" ? "text-red-800" : "text-amber-800"}`}>
                <b>{a.label}</b>{" "}
                {a.daysLeft < 0 ? `منتهية منذ ${num(-a.daysLeft)} يوم` : `تنتهي بعد ${num(a.daysLeft)} يوم`}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard label="إجمالي الراتب" value={sar(gross)} hint={`أساسي ${sar(emp.salarySAR)}`} icon={<Wallet className="w-5 h-5" />} tone="emerald" />
        <StatCard label="الصافي الشهري" value={sar(preview.netSAR)} hint={`بعد التأمينات ${sar(gosi.employee)}`} icon={<BadgeCheck className="w-5 h-5" />} tone="sky" />
        <StatCard label="رصيد الإجازات" value={`${num(Math.max(0, leave.accruedDays - usedLeaveDays))} يوم`} hint={`من ${num(leave.annualDays)} · مستخدم ${num(usedLeaveDays)}`} icon={<CalendarDays className="w-5 h-5" />} tone="violet" />
        <StatCard label="مكافأة نهاية الخدمة" value={sar(eos.amountSAR)} hint={`خدمة ${num(eos.years)} سنة`} icon={<ShieldCheck className="w-5 h-5" />} tone="amber" />
      </div>

      <div className="grid lg:grid-cols-2 gap-5 items-start">
        <Card title="هيكل الراتب والتأمينات" className="p-5 pt-4">
          <dl className="space-y-2.5 text-sm">
            {[
              ["الراتب الأساسي", sar(emp.salarySAR)],
              ["بدل سكن", sar(emp.housingSAR)],
              ["بدل نقل", sar(emp.transportSAR)],
              ["بدلات أخرى", sar(emp.otherAllowSAR)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <dt className="text-slate-500">{k}</dt>
                <dd className="tabular-nums">{v}</dd>
              </div>
            ))}
            <div className="flex justify-between pt-2.5 border-t border-slate-100">
              <dt className="font-bold">الإجمالي</dt>
              <dd className="font-bold tabular-nums">{sar(gross)}</dd>
            </div>
            <div className="flex justify-between text-red-600">
              <dt>التأمينات (حصة الموظف {isSaudi ? "9.75%" : "معفي"})</dt>
              <dd className="tabular-nums">− {sar(gosi.employee)}</dd>
            </div>
            <div className="flex justify-between pt-2.5 border-t border-slate-200">
              <dt className="font-bold">صافي المستحق</dt>
              <dd className="font-extrabold text-emerald-700 tabular-nums">{sar(preview.netSAR)}</dd>
            </div>
            <div className="flex justify-between text-xs text-slate-400 pt-2">
              <dt>حصة المنشأة من التأمينات ({isSaudi ? "11.75%" : "2%"})</dt>
              <dd className="tabular-nums">{sar(gosi.employer)}</dd>
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <dt>التكلفة الفعلية على النادي</dt>
              <dd className="tabular-nums font-bold">{sar(preview.clubCostSAR)}</dd>
            </div>
          </dl>
        </Card>

        <Card title="بيانات التوظيف" className="p-5 pt-4">
          <dl className="space-y-3 text-sm">
            {[
              ["رقم الهوية / الإقامة", emp.nationalId ?? "—", true],
              ["الجنسية", emp.nationality, false],
              ["نوع العقد", emp.contractType === "full_time" ? "دوام كامل" : emp.contractType === "part_time" ? "دوام جزئي" : "مؤقت", false],
              ["الدوام", `${emp.shiftStart} — ${emp.shiftEnd}`, true],
              ["انتهاء العقد", emp.contractEndsAt ? fullDate(emp.contractEndsAt) : "—", false],
              ["انتهاء الهوية", emp.idExpiresAt ? fullDate(emp.idExpiresAt) : "—", false],
              ["الآيبان", emp.iban ?? "—", true],
            ].map(([k, v, ltr]) => (
              <div key={String(k)} className="flex justify-between gap-4">
                <dt className="text-slate-500 shrink-0">{k}</dt>
                <dd className="font-medium text-left" dir={ltr ? "ltr" : undefined}>{v}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-4 pt-3 border-t border-slate-100">
              <dt className="text-slate-500 flex items-center gap-1.5">
                <QrCode className="w-3.5 h-3.5" />
                باركود الحضور
              </dt>
              <dd className="font-mono text-sm bg-slate-100 px-2.5 py-1 rounded-lg" dir="ltr">
                {emp.barcode ?? "—"}
              </dd>
            </div>
          </dl>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-5 items-start mt-5">
        <Card
          title="سجل الحضور — آخر 14 يوم"
          action={
            <span className="text-xs text-slate-400">
              تأخير {num(lateTotal)}د · إضافي {num(otTotal)}د
            </span>
          }
        >
          {emp.shifts.length === 0 ? (
            <Empty text="لا سجلات حضور" />
          ) : (
            <Table
              head={
                <>
                  <Th>اليوم</Th>
                  <Th>الدخول</Th>
                  <Th>الخروج</Th>
                  <Th>الانضباط</Th>
                </>
              }
            >
              {emp.shifts.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/60 transition">
                  <Td className="text-slate-600 text-xs whitespace-nowrap">{fullDate(s.day)}</Td>
                  <Td className="tabular-nums text-xs">{s.checkIn ? time(s.checkIn) : "—"}</Td>
                  <Td className="tabular-nums text-xs">{s.checkOut ? time(s.checkOut) : "—"}</Td>
                  <Td>
                    <div className="flex gap-1 flex-wrap">
                      {s.status === "absent" && <Badge tone="red">غياب</Badge>}
                      {s.lateMinutes > 0 && <Badge tone="amber">تأخير {num(s.lateMinutes)}د</Badge>}
                      {s.overtimeMinutes > 0 && <Badge tone="sky">إضافي {num(s.overtimeMinutes)}د</Badge>}
                      {s.outsideGeofence && (
                        <Badge tone="red">
                          <MapPin className="w-3 h-3" />
                          خارج النطاق
                        </Badge>
                      )}
                      {s.status === "present" && s.lateMinutes === 0 && s.overtimeMinutes === 0 && !s.outsideGeofence && (
                        <Badge tone="emerald">منتظم</Badge>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <Card title="مسير الرواتب">
          {emp.payrolls.length === 0 ? (
            <Empty text="لا مسيرات" />
          ) : (
            <Table
              head={
                <>
                  <Th>الشهر</Th>
                  <Th>الأساسي</Th>
                  <Th>الخصومات</Th>
                  <Th>الصافي</Th>
                  <Th>الحالة</Th>
                </>
              }
            >
              {emp.payrolls.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/60 transition">
                  <Td className="tabular-nums" dir="ltr">{p.month}</Td>
                  <Td className="tabular-nums text-slate-500 whitespace-nowrap">{sar(p.baseSAR)}</Td>
                  <Td className="tabular-nums text-red-600 whitespace-nowrap">
                    {p.deductionsSAR ? sar(p.deductionsSAR) : "—"}
                  </Td>
                  <Td className="tabular-nums font-bold whitespace-nowrap">{sar(p.netSAR)}</Td>
                  <Td>
                    <Badge tone={p.status === "paid" ? "emerald" : "amber"}>
                      {p.status === "paid" ? "مصروف" : "معلّق"}
                    </Badge>
                  </Td>
                </tr>
              ))}
            </Table>
          )}

          <div className="px-5 py-3.5 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-400">
            <Clock className="w-3.5 h-3.5" />
            الصافي محسوب من الحضور الفعلي والبدلات والتأمينات
          </div>
        </Card>
      </div>
    </>
  );
}
