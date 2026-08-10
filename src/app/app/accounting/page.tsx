import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Banknote, FileText, Plus, Scale, Wallet } from "lucide-react";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/auth";
import { Badge, Bar, Card, Empty, PageHeader, StatCard, Table, Td, Th, fullDate, num, payMethodLabel, sar } from "@/lib/ui";
import { addExpense, payInvoice } from "../actions";

const categories = ["إيجار", "رواتب", "مرافق", "صيانة", "تسويق", "أخرى"];

export default async function AccountingPage() {
  const user = await requireModule("accounting");
  const clubId = user.clubId!;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [monthPaid, monthVat, unpaid, monthExpenses, invoices, expenses, byCategory, byMethod] =
    await Promise.all([
      db.invoice.aggregate({
        where: { clubId, status: "paid", issuedAt: { gte: monthStart } },
        _sum: { totalSAR: true, subtotalSAR: true },
        _count: true,
      }),
      db.invoice.aggregate({
        where: { clubId, status: "paid", issuedAt: { gte: monthStart } },
        _sum: { vatSAR: true },
      }),
      db.invoice.aggregate({ where: { clubId, status: "unpaid" }, _sum: { totalSAR: true }, _count: true }),
      db.expense.aggregate({ where: { clubId, spentAt: { gte: monthStart } }, _sum: { amountSAR: true } }),
      db.invoice.findMany({
        where: { clubId },
        include: { member: true, payments: true },
        orderBy: { issuedAt: "desc" },
        take: 12,
      }),
      db.expense.findMany({ where: { clubId }, orderBy: { spentAt: "desc" }, take: 8 }),
      db.expense.groupBy({
        by: ["category"],
        where: { clubId, spentAt: { gte: monthStart } },
        _sum: { amountSAR: true },
      }),
      db.payment.groupBy({
        by: ["method"],
        where: { invoice: { clubId }, paidAt: { gte: monthStart } },
        _sum: { amountSAR: true },
      }),
    ]);

  const revenue = monthPaid._sum.totalSAR ?? 0;
  const vat = monthVat._sum.vatSAR ?? 0;
  const costs = monthExpenses._sum.amountSAR ?? 0;
  const profit = revenue - costs;
  const maxCat = Math.max(1, ...byCategory.map((c) => c._sum.amountSAR ?? 0));
  const totalMethods = byMethod.reduce((s, m) => s + (m._sum.amountSAR ?? 0), 0);

  return (
    <>
      <PageHeader title="المحاسبة" subtitle="الفواتير الضريبية، المدفوعات، والمصروفات" />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="إيرادات الشهر"
          value={sar(revenue)}
          hint={`${num(monthPaid._count)} فاتورة`}
          icon={<ArrowUpRight className="w-5 h-5" />}
          tone="emerald"
        />
        <StatCard
          label="مصروفات الشهر"
          value={sar(costs)}
          icon={<ArrowDownLeft className="w-5 h-5" />}
          tone="red"
        />
        <StatCard
          label="صافي الربح"
          value={sar(profit)}
          icon={<Scale className="w-5 h-5" />}
          tone={profit >= 0 ? "emerald" : "red"}
        />
        <StatCard
          label="ضريبة مستحقة (15%)"
          value={sar(vat)}
          hint="للإقرار الضريبي"
          icon={<FileText className="w-5 h-5" />}
          tone="violet"
        />
      </div>

      {unpaid._count > 0 && (
        <div className="mb-5 rounded-2xl bg-amber-50 ring-1 ring-amber-100 px-5 py-4 flex items-center gap-3">
          <Wallet className="w-5 h-5 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800 flex-1">
            لديك <b>{num(unpaid._count)}</b> فاتورة غير مدفوعة بقيمة{" "}
            <b>{sar(unpaid._sum.totalSAR ?? 0)}</b>
          </p>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-5 items-start">
        <Card title="أحدث الفواتير" className="lg:col-span-2">
          {invoices.length === 0 ? (
            <Empty text="لا توجد فواتير بعد" />
          ) : (
            <Table
              head={
                <>
                  <Th>رقم الفاتورة</Th>
                  <Th>العميل</Th>
                  <Th>التاريخ</Th>
                  <Th>الإجمالي</Th>
                  <Th>طريقة الدفع</Th>
                  <Th>الحالة</Th>
                </>
              }
            >
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50/60 transition">
                  <Td>
                    <Link
                      href={`/app/accounting/${inv.id}`}
                      className="font-bold text-emerald-700 hover:underline tabular-nums"
                      dir="ltr"
                    >
                      {inv.number}
                    </Link>
                  </Td>
                  <Td className="text-slate-600">{inv.member?.name ?? "—"}</Td>
                  <Td className="text-slate-500 whitespace-nowrap">{fullDate(inv.issuedAt)}</Td>
                  <Td className="font-bold tabular-nums whitespace-nowrap">{sar(inv.totalSAR)}</Td>
                  <Td className="text-slate-500">
                    {inv.payments[0] ? payMethodLabel[inv.payments[0].method] : "—"}
                  </Td>
                  <Td>
                    {inv.status === "paid" ? (
                      <Badge tone="emerald">مدفوعة</Badge>
                    ) : (
                      <form action={payInvoice} className="flex items-center gap-1.5">
                        <input type="hidden" name="invoiceId" value={inv.id} />
                        <select
                          name="method"
                          className="h-8 text-xs bg-white border border-slate-200 rounded-lg px-2 outline-none"
                        >
                          {Object.entries(payMethodLabel).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                        <button className="h-8 px-3 rounded-lg bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 transition whitespace-nowrap">
                          تحصيل
                        </button>
                      </form>
                    )}
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <div className="space-y-5">
          <Card title="تسجيل مصروف" className="p-5 pt-4">
            <form action={addExpense} className="space-y-3">
              <select
                name="category"
                className="w-full h-11 bg-white border border-slate-200 rounded-xl px-3 text-sm outline-none focus:border-emerald-400"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <input
                name="description"
                required
                placeholder="وصف المصروف"
                className="w-full h-11 bg-white border border-slate-200 rounded-xl px-3.5 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10"
              />
              <input
                name="amountSAR"
                type="number"
                step="0.01"
                min="1"
                required
                placeholder="المبلغ بالريال"
                className="w-full h-11 bg-white border border-slate-200 rounded-xl px-3.5 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10"
              />
              <button className="w-full h-11 rounded-xl bg-slate-900 text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-800 active:scale-[0.99] transition">
                <Plus className="w-4 h-4" />
                إضافة مصروف
              </button>
            </form>
          </Card>

          <Card title="مصروفات الشهر حسب البند" className="p-5 pt-4">
            {byCategory.length === 0 ? (
              <Empty text="لا مصروفات هذا الشهر" />
            ) : (
              <div className="space-y-3">
                {byCategory
                  .sort((a, b) => (b._sum.amountSAR ?? 0) - (a._sum.amountSAR ?? 0))
                  .map((c) => (
                    <div key={c.category}>
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="text-slate-600">{c.category}</span>
                        <span className="font-bold tabular-nums">{sar(c._sum.amountSAR ?? 0)}</span>
                      </div>
                      <Bar pct={((c._sum.amountSAR ?? 0) / maxCat) * 100} tone="amber" />
                    </div>
                  ))}
              </div>
            )}
          </Card>

          <Card title="طرق الدفع هذا الشهر" className="p-5 pt-4">
            {byMethod.length === 0 ? (
              <Empty text="لا مدفوعات بعد" />
            ) : (
              <ul className="space-y-2.5">
                {byMethod
                  .sort((a, b) => (b._sum.amountSAR ?? 0) - (a._sum.amountSAR ?? 0))
                  .map((m) => (
                    <li key={m.method} className="flex items-center gap-3">
                      <Banknote className="w-4 h-4 text-slate-300 shrink-0" />
                      <span className="text-sm text-slate-600 flex-1">{payMethodLabel[m.method] ?? m.method}</span>
                      <span className="text-xs text-slate-400 tabular-nums">
                        {Math.round(((m._sum.amountSAR ?? 0) / (totalMethods || 1)) * 100)}%
                      </span>
                      <span className="text-sm font-bold tabular-nums w-24 text-left">
                        {sar(m._sum.amountSAR ?? 0)}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <Card title="آخر المصروفات" className="mt-5">
        {expenses.length === 0 ? (
          <Empty text="لا مصروفات مسجلة" />
        ) : (
          <Table
            head={
              <>
                <Th>البند</Th>
                <Th>الوصف</Th>
                <Th>التاريخ</Th>
                <Th>المبلغ</Th>
              </>
            }
          >
            {expenses.map((e) => (
              <tr key={e.id} className="hover:bg-slate-50/60 transition">
                <Td><Badge tone="slate">{e.category}</Badge></Td>
                <Td className="text-slate-600">{e.description}</Td>
                <Td className="text-slate-500 whitespace-nowrap">{fullDate(e.spentAt)}</Td>
                <Td className="font-bold text-red-600 tabular-nums whitespace-nowrap">{sar(e.amountSAR)}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
