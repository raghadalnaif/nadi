import { CheckCircle2, TrendingDown, TrendingUp, TriangleAlert } from "lucide-react";
import { requireModule } from "@/lib/auth";
import { balanceSheet, incomeStatement } from "@/lib/ledger";
import { Card, Empty, PageHeader, StatCard, Table, Td, Th, fullDate, sar } from "@/lib/ui";
import { AccountingTabs } from "../tabs";

export default async function StatementsPage({ searchParams }: PageProps<"/app/accounting/statements">) {
  const user = await requireModule("accounting");
  const clubId = user.clubId!;
  const params = await searchParams;
  const months = Math.min(12, Math.max(1, Number(params.months) || 12));

  const to = new Date();
  const from = new Date(to.getFullYear(), to.getMonth() - (months - 1), 1);

  const [income, sheet] = await Promise.all([
    incomeStatement(clubId, from, to),
    balanceSheet(clubId, to),
  ]);

  const empty = income.revenue.length === 0 && income.expenses.length === 0;

  return (
    <>
      <PageHeader
        title="القوائم المالية"
        subtitle={`قائمة الدخل والميزانية العمومية — آخر ${months} شهر`}
        action={
          <div className="flex gap-2">
            {[3, 6, 12].map((m) => (
              <a
                key={m}
                href={`/app/accounting/statements?months=${m}`}
                className={`px-3.5 h-9 rounded-xl text-sm flex items-center border transition ${
                  months === m
                    ? "bg-emerald-600 text-white border-emerald-600 font-bold"
                    : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300"
                }`}
              >
                {m} شهور
              </a>
            ))}
          </div>
        }
      />
      <AccountingTabs active="/app/accounting/statements" />

      {empty ? (
        <Card>
          <Empty text="لا توجد قيود بعد — ابدأ من دفتر اليومية واضغط «إعادة ترحيل»" />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <StatCard label="إجمالي الإيرادات" value={sar(income.totalRevenue)} icon={<TrendingUp className="w-5 h-5" />} tone="emerald" />
            <StatCard label="إجمالي المصروفات" value={sar(income.totalExpenses)} icon={<TrendingDown className="w-5 h-5" />} tone="red" />
            <StatCard
              label="صافي الدخل"
              value={sar(income.netIncome)}
              hint={income.totalRevenue > 0 ? `هامش ${Math.round((income.netIncome / income.totalRevenue) * 100)}%` : undefined}
              icon={<TrendingUp className="w-5 h-5" />}
              tone={income.netIncome >= 0 ? "emerald" : "red"}
            />
          </div>

          <div className="grid lg:grid-cols-2 gap-5 items-start">
            <Card title="قائمة الدخل">
              <Table
                head={
                  <>
                    <Th>البند</Th>
                    <Th className="text-left">المبلغ</Th>
                  </>
                }
              >
                <tr className="bg-slate-50/70">
                  <td colSpan={2} className="px-5 py-2 text-xs font-bold text-slate-600">الإيرادات</td>
                </tr>
                {income.revenue.map((r) => (
                  <tr key={r.code} className="hover:bg-slate-50/60 transition">
                    <Td>
                      <span className="tabular-nums text-slate-400 text-xs ml-2">{r.code}</span>
                      {r.name}
                    </Td>
                    <Td className="text-left tabular-nums">{sar(r.amount)}</Td>
                  </tr>
                ))}
                <tr className="border-t border-slate-100">
                  <td className="px-5 py-2.5 text-sm font-bold">مجموع الإيرادات</td>
                  <td className="px-5 py-2.5 text-left text-sm font-bold tabular-nums text-emerald-700">
                    {sar(income.totalRevenue)}
                  </td>
                </tr>

                <tr className="bg-slate-50/70">
                  <td colSpan={2} className="px-5 py-2 text-xs font-bold text-slate-600">المصروفات</td>
                </tr>
                {income.expenses.map((r) => (
                  <tr key={r.code} className="hover:bg-slate-50/60 transition">
                    <Td>
                      <span className="tabular-nums text-slate-400 text-xs ml-2">{r.code}</span>
                      {r.name}
                    </Td>
                    <Td className="text-left tabular-nums">{sar(r.amount)}</Td>
                  </tr>
                ))}
                <tr className="border-t border-slate-100">
                  <td className="px-5 py-2.5 text-sm font-bold">مجموع المصروفات</td>
                  <td className="px-5 py-2.5 text-left text-sm font-bold tabular-nums text-red-600">
                    {sar(income.totalExpenses)}
                  </td>
                </tr>

                <tr className="bg-slate-900 text-white">
                  <td className="px-5 py-3.5 font-bold">صافي الدخل</td>
                  <td className="px-5 py-3.5 text-left font-bold tabular-nums">{sar(income.netIncome)}</td>
                </tr>
              </Table>
            </Card>

            <Card title={`الميزانية العمومية — كما في ${fullDate(to)}`}>
              <Table
                head={
                  <>
                    <Th>البند</Th>
                    <Th className="text-left">المبلغ</Th>
                  </>
                }
              >
                <tr className="bg-slate-50/70">
                  <td colSpan={2} className="px-5 py-2 text-xs font-bold text-slate-600">الأصول</td>
                </tr>
                {sheet.assets.map((r) => (
                  <tr key={r.code} className="hover:bg-slate-50/60 transition">
                    <Td>
                      <span className="tabular-nums text-slate-400 text-xs ml-2">{r.code}</span>
                      {r.name}
                    </Td>
                    <Td className="text-left tabular-nums">{sar(r.amount)}</Td>
                  </tr>
                ))}
                <tr className="border-t border-slate-100">
                  <td className="px-5 py-2.5 text-sm font-bold">مجموع الأصول</td>
                  <td className="px-5 py-2.5 text-left text-sm font-bold tabular-nums">{sar(sheet.totalAssets)}</td>
                </tr>

                <tr className="bg-slate-50/70">
                  <td colSpan={2} className="px-5 py-2 text-xs font-bold text-slate-600">الالتزامات</td>
                </tr>
                {sheet.liabilities.map((r) => (
                  <tr key={r.code} className="hover:bg-slate-50/60 transition">
                    <Td>
                      <span className="tabular-nums text-slate-400 text-xs ml-2">{r.code}</span>
                      {r.name}
                    </Td>
                    <Td className="text-left tabular-nums">{sar(r.amount)}</Td>
                  </tr>
                ))}
                <tr className="border-t border-slate-100">
                  <td className="px-5 py-2.5 text-sm font-bold">مجموع الالتزامات</td>
                  <td className="px-5 py-2.5 text-left text-sm font-bold tabular-nums">{sar(sheet.totalLiabilities)}</td>
                </tr>

                <tr className="bg-slate-50/70">
                  <td colSpan={2} className="px-5 py-2 text-xs font-bold text-slate-600">حقوق الملكية</td>
                </tr>
                {sheet.equity.map((r) => (
                  <tr key={r.code} className="hover:bg-slate-50/60 transition">
                    <Td>
                      <span className="tabular-nums text-slate-400 text-xs ml-2">{r.code}</span>
                      {r.name}
                    </Td>
                    <Td className="text-left tabular-nums">{sar(r.amount)}</Td>
                  </tr>
                ))}
                <tr className="hover:bg-slate-50/60 transition">
                  <Td>الأرباح المبقاة (الفترة)</Td>
                  <Td className="text-left tabular-nums">{sar(sheet.retainedEarnings)}</Td>
                </tr>

                <tr className="bg-slate-900 text-white">
                  <td className="px-5 py-3.5 font-bold">الالتزامات + حقوق الملكية</td>
                  <td className="px-5 py-3.5 text-left font-bold tabular-nums">
                    {sar(sheet.totalLiabilities + sheet.totalEquity + sheet.retainedEarnings)}
                  </td>
                </tr>
              </Table>

              <div
                className={`m-5 rounded-xl px-4 py-3 flex items-center gap-2.5 ring-1 ${
                  sheet.balanced ? "bg-emerald-50 ring-emerald-100" : "bg-amber-50 ring-amber-100"
                }`}
              >
                {sheet.balanced ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <TriangleAlert className="w-4 h-4 text-amber-600 shrink-0" />
                )}
                <p className={`text-sm ${sheet.balanced ? "text-emerald-800" : "text-amber-800"}`}>
                  {sheet.balanced
                    ? "الميزانية متوازنة: الأصول = الالتزامات + حقوق الملكية"
                    : "الميزانية غير متوازنة — راجع القيود اليدوية"}
                </p>
              </div>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
