import Link from "next/link";
import { ArrowRight, Printer } from "lucide-react";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/auth";
import { balanceSheet, incomeStatement, receivablesAging, trialBalance, vatReturn } from "@/lib/ledger";
import { fullDate, num, sar } from "@/lib/ui";
import { PrintControls } from "./controls";

const REPORTS = {
  income: "قائمة الدخل",
  balance: "الميزانية العمومية",
  trial: "ميزان المراجعة",
  vat: "الإقرار الضريبي",
  receivables: "أعمار الذمم",
  summary: "الملخص المالي الشامل",
} as const;

type ReportKey = keyof typeof REPORTS;

const parseDate = (v: unknown, fallback: Date) => {
  if (typeof v !== "string" || !v) return fallback;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? fallback : d;
};

function Row({ label, value, bold, indent }: { label: string; value: string; bold?: boolean; indent?: boolean }) {
  return (
    <tr className={bold ? "font-bold" : ""}>
      <td className={`py-2 border-b border-slate-100 ${indent ? "pr-6" : ""}`}>{label}</td>
      <td className="py-2 border-b border-slate-100 text-left tabular-nums whitespace-nowrap">{value}</td>
    </tr>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8 break-inside-avoid">
      <h2 className="text-base font-bold text-slate-900 border-b-2 border-slate-800 pb-1.5 mb-3">
        {title}
      </h2>
      <table className="w-full text-sm">
        <tbody>{children}</tbody>
      </table>
    </section>
  );
}

export default async function PrintReportPage({ searchParams }: PageProps<"/app/accounting/print">) {
  const user = await requireModule("accounting");
  const clubId = user.clubId!;
  const params = await searchParams;

  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const from = parseDate(params.from, defaultFrom);
  const to = parseDate(params.to, now);
  to.setHours(23, 59, 59, 999);

  const report = (typeof params.report === "string" && params.report in REPORTS
    ? params.report
    : "summary") as ReportKey;

  const club = await db.club.findUnique({ where: { id: clubId } });
  if (!club) return null;

  const wants = (k: ReportKey) => report === "summary" || report === k;

  const [income, sheet, trial, vat, aging] = await Promise.all([
    wants("income") ? incomeStatement(clubId, from, to) : null,
    wants("balance") ? balanceSheet(clubId, to) : null,
    wants("trial") ? trialBalance(clubId, from, to) : null,
    wants("vat") ? vatReturn(clubId, from, to) : null,
    wants("receivables") ? receivablesAging(clubId) : null,
  ]);

  const printedAt = new Intl.DateTimeFormat("ar-SA", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date());

  return (
    <>
      <PrintControls from={from} to={to} report={report} reports={REPORTS} />

      <div className="print:hidden mb-5 flex items-center justify-between">
        <Link
          href="/app/accounting"
          className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-emerald-700 transition"
        >
          <ArrowRight className="w-4 h-4" />
          رجوع للمحاسبة
        </Link>
        <span className="text-xs text-slate-400 flex items-center gap-1.5">
          <Printer className="w-3.5 h-3.5" />
          الطباعة تُخرج التقرير وحده بلا القوائم
        </span>
      </div>

      {/* ورقة التقرير */}
      <article className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-10 max-w-4xl mx-auto print:border-0 print:shadow-none print:rounded-none print:p-0 print:max-w-none">
        <header className="border-b-2 border-slate-800 pb-4 mb-6 flex items-start justify-between gap-6">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">{club.name}</h1>
            <p className="text-sm text-slate-600 mt-1">{club.address}</p>
            <p className="text-xs text-slate-500 mt-1.5">
              الرقم الضريبي: <span dir="ltr">{club.vatNumber}</span> · السجل التجاري:{" "}
              <span dir="ltr">{club.crNumber}</span>
            </p>
          </div>
          <div className="text-left shrink-0">
            <p className="text-lg font-bold text-slate-900">{REPORTS[report]}</p>
            <p className="text-sm text-slate-600 mt-1">
              من {fullDate(from)} إلى {fullDate(to)}
            </p>
            <p className="text-xs text-slate-400 mt-1.5">طُبع في {printedAt}</p>
          </div>
        </header>

        {income && (
          <Section title="قائمة الدخل">
            <tr className="bg-slate-50">
              <td colSpan={2} className="py-1.5 px-2 text-xs font-bold text-slate-600">الإيرادات</td>
            </tr>
            {income.revenue.map((r) => (
              <Row key={r.code} label={`${r.code} — ${r.name}`} value={sar(r.amount)} indent />
            ))}
            <Row label="مجموع الإيرادات" value={sar(income.totalRevenue)} bold />

            <tr className="bg-slate-50">
              <td colSpan={2} className="py-1.5 px-2 text-xs font-bold text-slate-600">المصروفات</td>
            </tr>
            {income.expenses.map((r) => (
              <Row key={r.code} label={`${r.code} — ${r.name}`} value={sar(r.amount)} indent />
            ))}
            <Row label="مجموع المصروفات" value={sar(income.totalExpenses)} bold />

            <tr className="bg-slate-800 text-white">
              <td className="py-2.5 px-2 font-bold">صافي الدخل</td>
              <td className="py-2.5 px-2 text-left font-bold tabular-nums">{sar(income.netIncome)}</td>
            </tr>
          </Section>
        )}

        {sheet && (
          <Section title={`الميزانية العمومية — كما في ${fullDate(to)}`}>
            <tr className="bg-slate-50">
              <td colSpan={2} className="py-1.5 px-2 text-xs font-bold text-slate-600">الأصول</td>
            </tr>
            {sheet.assets.map((r) => (
              <Row key={r.code} label={`${r.code} — ${r.name}`} value={sar(r.amount)} indent />
            ))}
            <Row label="مجموع الأصول" value={sar(sheet.totalAssets)} bold />

            <tr className="bg-slate-50">
              <td colSpan={2} className="py-1.5 px-2 text-xs font-bold text-slate-600">الالتزامات</td>
            </tr>
            {sheet.liabilities.map((r) => (
              <Row key={r.code} label={`${r.code} — ${r.name}`} value={sar(r.amount)} indent />
            ))}
            <Row label="مجموع الالتزامات" value={sar(sheet.totalLiabilities)} bold />

            <tr className="bg-slate-50">
              <td colSpan={2} className="py-1.5 px-2 text-xs font-bold text-slate-600">حقوق الملكية</td>
            </tr>
            {sheet.equity.map((r) => (
              <Row key={r.code} label={`${r.code} — ${r.name}`} value={sar(r.amount)} indent />
            ))}
            <Row label="الأرباح المبقاة" value={sar(sheet.retainedEarnings)} indent />

            <tr className="bg-slate-800 text-white">
              <td className="py-2.5 px-2 font-bold">الالتزامات وحقوق الملكية</td>
              <td className="py-2.5 px-2 text-left font-bold tabular-nums">
                {sar(sheet.totalLiabilities + sheet.totalEquity + sheet.retainedEarnings)}
              </td>
            </tr>
          </Section>
        )}

        {trial && (
          <section className="mb-8 break-inside-avoid">
            <h2 className="text-base font-bold text-slate-900 border-b-2 border-slate-800 pb-1.5 mb-3">
              ميزان المراجعة
            </h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-right py-2 px-2 text-xs font-bold text-slate-600">الحساب</th>
                  <th className="text-left py-2 px-2 text-xs font-bold text-slate-600">مدين</th>
                  <th className="text-left py-2 px-2 text-xs font-bold text-slate-600">دائن</th>
                </tr>
              </thead>
              <tbody>
                {trial.rows.map((r) => (
                  <tr key={r.code}>
                    <td className="py-2 border-b border-slate-100">
                      {r.code} — {r.name}
                    </td>
                    <td className="py-2 border-b border-slate-100 text-left tabular-nums">
                      {r.debit ? sar(r.debit) : "—"}
                    </td>
                    <td className="py-2 border-b border-slate-100 text-left tabular-nums">
                      {r.credit ? sar(r.credit) : "—"}
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-800 text-white">
                  <td className="py-2.5 px-2 font-bold">الإجمالي</td>
                  <td className="py-2.5 px-2 text-left font-bold tabular-nums">{sar(trial.totalDebit)}</td>
                  <td className="py-2.5 px-2 text-left font-bold tabular-nums">{sar(trial.totalCredit)}</td>
                </tr>
              </tbody>
            </table>
          </section>
        )}

        {vat && (
          <Section title="الإقرار الضريبي">
            <Row label="المبيعات الخاضعة (قبل الضريبة)" value={sar(vat.salesBase)} />
            <Row label="ضريبة المخرجات 15%" value={sar(vat.salesVat)} />
            <Row label={`يُخصم: إشعارات دائنة (${num(vat.creditNoteCount)})`} value={sar(vat.creditBase)} indent />
            <Row label="ضريبة الإشعارات الدائنة" value={sar(vat.creditVat)} indent />
            <Row label="صافي المبيعات" value={sar(vat.netBase)} bold />
            <tr className="bg-slate-800 text-white">
              <td className="py-2.5 px-2 font-bold">صافي الضريبة المستحقة</td>
              <td className="py-2.5 px-2 text-left font-bold tabular-nums">{sar(vat.netVat)}</td>
            </tr>
          </Section>
        )}

        {aging && (
          <section className="mb-8 break-inside-avoid">
            <h2 className="text-base font-bold text-slate-900 border-b-2 border-slate-800 pb-1.5 mb-3">
              أعمار الذمم المدينة
            </h2>
            <table className="w-full text-sm mb-4">
              <tbody>
                <Row label="حتى 30 يوم" value={sar(aging.buckets.current)} />
                <Row label="31 — 60 يوم" value={sar(aging.buckets.d30)} />
                <Row label="61 — 90 يوم" value={sar(aging.buckets.d60)} />
                <Row label="أكثر من 90 يوم" value={sar(aging.buckets.d90)} />
                <tr className="bg-slate-800 text-white">
                  <td className="py-2.5 px-2 font-bold">الإجمالي</td>
                  <td className="py-2.5 px-2 text-left font-bold tabular-nums">{sar(aging.total)}</td>
                </tr>
              </tbody>
            </table>

            {aging.rows.length > 0 && (
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-right py-2 px-2 font-bold text-slate-600">الفاتورة</th>
                    <th className="text-right py-2 px-2 font-bold text-slate-600">العميل</th>
                    <th className="text-right py-2 px-2 font-bold text-slate-600">التاريخ</th>
                    <th className="text-left py-2 px-2 font-bold text-slate-600">التأخير</th>
                    <th className="text-left py-2 px-2 font-bold text-slate-600">المبلغ</th>
                  </tr>
                </thead>
                <tbody>
                  {aging.rows.slice(0, 40).map((r) => (
                    <tr key={r.id}>
                      <td className="py-1.5 border-b border-slate-100" dir="ltr">{r.number}</td>
                      <td className="py-1.5 border-b border-slate-100">{r.customer}</td>
                      <td className="py-1.5 border-b border-slate-100">{fullDate(r.issuedAt)}</td>
                      <td className="py-1.5 border-b border-slate-100 text-left tabular-nums">
                        {num(r.days)} يوم
                      </td>
                      <td className="py-1.5 border-b border-slate-100 text-left tabular-nums">
                        {sar(r.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}

        <footer className="mt-10 pt-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-400">
          <span>{club.name} — تقرير مُولَّد من نظام إدارة الأندية</span>
          <span>
            الفترة: {fullDate(from)} — {fullDate(to)}
          </span>
        </footer>
      </article>
    </>
  );
}
