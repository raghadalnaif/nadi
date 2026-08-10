import { CheckCircle2, Scale, TriangleAlert } from "lucide-react";
import { requireModule } from "@/lib/auth";
import { trialBalance } from "@/lib/ledger";
import { Card, Empty, PageHeader, Table, Td, Th, sar } from "@/lib/ui";
import { AccountingTabs } from "../tabs";

const TYPE_LABEL: Record<string, string> = {
  asset: "أصول",
  liability: "التزامات",
  equity: "حقوق ملكية",
  revenue: "إيرادات",
  expense: "مصروفات",
};

export default async function TrialBalancePage() {
  const user = await requireModule("accounting");
  const { rows, totalDebit, totalCredit } = await trialBalance(user.clubId!);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.5;

  const groups = ["asset", "liability", "equity", "revenue", "expense"] as const;

  return (
    <>
      <PageHeader title="ميزان المراجعة" subtitle="أرصدة كل الحسابات — يثبت توازن الدفاتر" />
      <AccountingTabs active="/app/accounting/trial-balance" />

      <div
        className={`mb-5 rounded-2xl px-5 py-4 flex items-center gap-3 ring-1 ${
          balanced ? "bg-emerald-50 ring-emerald-100" : "bg-red-50 ring-red-100"
        }`}
      >
        {balanced ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
        ) : (
          <TriangleAlert className="w-5 h-5 text-red-600 shrink-0" />
        )}
        <div className="flex-1">
          <p className={`text-sm font-bold ${balanced ? "text-emerald-800" : "text-red-800"}`}>
            {balanced ? "الدفاتر متوازنة" : "خلل في التوازن"}
          </p>
          <p className={`text-xs mt-0.5 ${balanced ? "text-emerald-700" : "text-red-700"}`}>
            مجموع المدين {sar(totalDebit)} · مجموع الدائن {sar(totalCredit)}
            {!balanced && ` · الفرق ${sar(Math.abs(totalDebit - totalCredit))}`}
          </p>
        </div>
        <Scale className={`w-5 h-5 shrink-0 ${balanced ? "text-emerald-400" : "text-red-400"}`} />
      </div>

      {rows.length === 0 ? (
        <Card>
          <Empty text="لا توجد قيود — ابدأ من دفتر اليومية واضغط «إعادة ترحيل»" />
        </Card>
      ) : (
        <Card>
          <Table
            head={
              <>
                <Th>الحساب</Th>
                <Th>التصنيف</Th>
                <Th className="text-left">مدين</Th>
                <Th className="text-left">دائن</Th>
                <Th className="text-left">الرصيد</Th>
              </>
            }
          >
            {groups.flatMap((g) => {
              const groupRows = rows.filter((r) => r.type === g);
              if (groupRows.length === 0) return [];
              const subtotal = groupRows.reduce((s, r) => s + r.balance, 0);

              return [
                <tr key={`h-${g}`} className="bg-slate-50/70">
                  <td colSpan={5} className="px-5 py-2 text-xs font-bold text-slate-600">
                    {TYPE_LABEL[g]}
                  </td>
                </tr>,
                ...groupRows.map((r) => (
                  <tr key={r.code} className="hover:bg-slate-50/60 transition">
                    <Td>
                      <span className="tabular-nums text-slate-400 text-xs ml-2">{r.code}</span>
                      <span className="font-medium">{r.name}</span>
                    </Td>
                    <Td className="text-slate-400 text-xs">{TYPE_LABEL[r.type]}</Td>
                    <Td className="text-left tabular-nums">{r.debit ? sar(r.debit) : "—"}</Td>
                    <Td className="text-left tabular-nums">{r.credit ? sar(r.credit) : "—"}</Td>
                    <Td className="text-left tabular-nums font-bold">
                      {r.balance >= 0 ? sar(r.balance) : `(${sar(-r.balance)})`}
                    </Td>
                  </tr>
                )),
                <tr key={`s-${g}`} className="border-t border-slate-100">
                  <td colSpan={4} className="px-5 py-2 text-xs text-slate-500 text-left">
                    مجموع {TYPE_LABEL[g]}
                  </td>
                  <td className="px-5 py-2 text-left text-sm font-bold tabular-nums">
                    {subtotal >= 0 ? sar(subtotal) : `(${sar(-subtotal)})`}
                  </td>
                </tr>,
              ];
            })}
            <tr className="bg-slate-900 text-white">
              <td colSpan={2} className="px-5 py-3.5 font-bold">الإجمالي</td>
              <td className="px-5 py-3.5 text-left font-bold tabular-nums">{sar(totalDebit)}</td>
              <td className="px-5 py-3.5 text-left font-bold tabular-nums">{sar(totalCredit)}</td>
              <td className="px-5 py-3.5" />
            </tr>
          </Table>
          <p className="px-5 py-3 text-xs text-slate-400 border-t border-slate-100">
            الرصيد بين قوسين يعني رصيداً دائناً
          </p>
        </Card>
      )}
    </>
  );
}
