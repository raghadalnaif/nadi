import { FileText, ShieldCheck } from "lucide-react";
import { requireModule } from "@/lib/auth";
import { vatReturn } from "@/lib/ledger";
import { Card, PageHeader, StatCard, Table, Td, Th, fullDate, num, sar } from "@/lib/ui";
import { AccountingTabs } from "../tabs";

// أرباع السنة الميلادية كما تعتمدها الهيئة
function quarterRange(year: number, q: number) {
  const from = new Date(year, (q - 1) * 3, 1);
  const to = new Date(year, q * 3, 0, 23, 59, 59);
  return { from, to };
}

export default async function VatPage({ searchParams }: PageProps<"/app/accounting/vat">) {
  const user = await requireModule("accounting");
  const params = await searchParams;

  const now = new Date();
  const year = Number(params.year) || now.getFullYear();
  const q = Math.min(4, Math.max(1, Number(params.q) || Math.floor(now.getMonth() / 3) + 1));
  const { from, to } = quarterRange(year, q);

  const vat = await vatReturn(user.clubId!, from, to);

  return (
    <>
      <PageHeader
        title="الإقرار الضريبي"
        subtitle={`الربع ${num(q)} من ${num(year)} — من ${fullDate(from)} إلى ${fullDate(to)}`}
        action={
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((n) => (
              <a
                key={n}
                href={`/app/accounting/vat?year=${year}&q=${n}`}
                className={`w-10 h-9 rounded-xl text-sm flex items-center justify-center border transition tabular-nums ${
                  q === n
                    ? "bg-emerald-600 text-white border-emerald-600 font-bold"
                    : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300"
                }`}
              >
                {num(n)}
              </a>
            ))}
          </div>
        }
      />
      <AccountingTabs active="/app/accounting/vat" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard
          label="المبيعات الخاضعة (قبل الضريبة)"
          value={sar(vat.netBase)}
          hint={`${num(vat.invoiceCount)} فاتورة`}
          icon={<FileText className="w-5 h-5" />}
          tone="sky"
        />
        <StatCard
          label="ضريبة المخرجات المستحقة"
          value={sar(vat.netVat)}
          hint="الواجب سداده للهيئة"
          icon={<ShieldCheck className="w-5 h-5" />}
          tone="violet"
        />
        <StatCard
          label="إشعارات دائنة"
          value={sar(vat.creditBase)}
          hint={`${num(vat.creditNoteCount)} إشعار — مخصومة`}
          icon={<FileText className="w-5 h-5" />}
          tone={vat.creditNoteCount > 0 ? "amber" : "slate"}
        />
      </div>

      <Card title="نموذج الإقرار">
        <Table
          head={
            <>
              <Th>البند</Th>
              <Th className="text-left">الأساس الخاضع</Th>
              <Th className="text-left">الضريبة 15%</Th>
            </>
          }
        >
          <tr className="hover:bg-slate-50/60 transition">
            <Td className="font-medium">المبيعات الخاضعة للنسبة الأساسية</Td>
            <Td className="text-left tabular-nums">{sar(vat.salesBase)}</Td>
            <Td className="text-left tabular-nums">{sar(vat.salesVat)}</Td>
          </tr>
          <tr className="hover:bg-slate-50/60 transition">
            <Td className="font-medium">يُخصم: الإشعارات الدائنة (مرتجعات)</Td>
            <Td className="text-left tabular-nums text-red-600">
              {vat.creditBase ? `(${sar(vat.creditBase)})` : "—"}
            </Td>
            <Td className="text-left tabular-nums text-red-600">
              {vat.creditVat ? `(${sar(vat.creditVat)})` : "—"}
            </Td>
          </tr>
          <tr className="border-t border-slate-100">
            <Td className="font-bold">صافي المبيعات</Td>
            <Td className="text-left tabular-nums font-bold">{sar(vat.netBase)}</Td>
            <Td className="text-left tabular-nums font-bold">{sar(vat.netVat)}</Td>
          </tr>
          <tr className="hover:bg-slate-50/60 transition">
            <Td className="text-slate-500">ضريبة المدخلات (مشتريات بفواتير ضريبية)</Td>
            <Td className="text-left tabular-nums text-slate-400">—</Td>
            <Td className="text-left tabular-nums text-slate-400">—</Td>
          </tr>
          <tr className="bg-slate-900 text-white">
            <td className="px-5 py-3.5 font-bold">صافي الضريبة المستحقة للهيئة</td>
            <td className="px-5 py-3.5" />
            <td className="px-5 py-3.5 text-left font-bold tabular-nums">{sar(vat.netVat)}</td>
          </tr>
        </Table>

        <div className="m-5 rounded-xl bg-sky-50 ring-1 ring-sky-100 px-4 py-3.5 text-sm text-sky-800 leading-relaxed">
          <b>ملاحظة:</b> ضريبة المدخلات تُحتسب من فواتير المشتريات الضريبية من المورّدين — وهي
          غير مُدخلة في النظام بعد. الرقم أعلاه يمثل ضريبة المخرجات فقط، وتُطرح منه المدخلات
          عند تقديم الإقرار الفعلي على منصة الهيئة.
        </div>
      </Card>
    </>
  );
}
