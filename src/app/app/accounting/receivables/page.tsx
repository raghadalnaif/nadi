import Link from "next/link";
import { Clock, MessageCircle, Wallet } from "lucide-react";
import { requireModule } from "@/lib/auth";
import { receivablesAging } from "@/lib/ledger";
import { Badge, Card, Empty, PageHeader, StatCard, Table, Td, Th, fullDate, num, sar } from "@/lib/ui";
import { AccountingTabs } from "../tabs";

export default async function ReceivablesPage() {
  const user = await requireModule("accounting");
  const { rows, buckets, total } = await receivablesAging(user.clubId!);

  return (
    <>
      <PageHeader
        title="أعمار الذمم"
        subtitle="الفواتير غير المحصّلة مصنّفة حسب مدة التأخير"
      />
      <AccountingTabs active="/app/accounting/receivables" />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard label="حتى 30 يوم" value={sar(buckets.current)} icon={<Clock className="w-5 h-5" />} tone="emerald" />
        <StatCard label="31 — 60 يوم" value={sar(buckets.d30)} icon={<Clock className="w-5 h-5" />} tone="sky" />
        <StatCard label="61 — 90 يوم" value={sar(buckets.d60)} icon={<Clock className="w-5 h-5" />} tone="amber" />
        <StatCard label="أكثر من 90 يوم" value={sar(buckets.d90)} hint="متعثرة" icon={<Clock className="w-5 h-5" />} tone="red" />
      </div>

      {rows.length === 0 ? (
        <Card>
          <Empty text="لا توجد ذمم — كل الفواتير محصّلة" />
        </Card>
      ) : (
        <Card
          title="تفاصيل الذمم"
          action={
            <span className="text-sm font-bold flex items-center gap-1.5">
              <Wallet className="w-4 h-4 text-slate-300" />
              {sar(total)}
            </span>
          }
        >
          <Table
            head={
              <>
                <Th>الفاتورة</Th>
                <Th>العميل</Th>
                <Th>تاريخ الإصدار</Th>
                <Th>التأخير</Th>
                <Th className="text-left">المبلغ</Th>
                <Th>متابعة</Th>
              </>
            }
          >
            {rows.map((r) => {
              const tone = r.days <= 30 ? "emerald" : r.days <= 60 ? "sky" : r.days <= 90 ? "amber" : "red";
              const wa = r.phone
                ? `https://wa.me/966${r.phone.replace(/^0/, "")}?text=${encodeURIComponent(
                    `مرحباً ${r.customer}، لديك فاتورة ${r.number} بمبلغ ${Math.round(r.amount)} ر.س غير مسددة. نأمل السداد في أقرب وقت.`
                  )}`
                : null;

              return (
                <tr key={r.id} className="hover:bg-slate-50/60 transition">
                  <Td>
                    <Link href={`/app/invoices/${r.id}`} className="font-bold text-emerald-700 hover:underline" dir="ltr">
                      {r.number}
                    </Link>
                  </Td>
                  <Td className="text-slate-600">{r.customer}</Td>
                  <Td className="text-slate-500 text-xs whitespace-nowrap">{fullDate(r.issuedAt)}</Td>
                  <Td>
                    <Badge tone={tone}>{num(r.days)} يوم</Badge>
                  </Td>
                  <Td className="text-left font-bold tabular-nums whitespace-nowrap">{sar(r.amount)}</Td>
                  <Td>
                    {wa && (
                      <a
                        href={wa}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-8 px-3 rounded-lg border border-slate-200 text-xs flex items-center gap-1.5 hover:bg-slate-50 transition w-fit"
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                        تذكير
                      </a>
                    )}
                  </Td>
                </tr>
              );
            })}
          </Table>
        </Card>
      )}
    </>
  );
}
