import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { ArrowRight, BadgeCheck, Link2, Printer, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/auth";
import { hashInvoice } from "@/lib/zatca";
import { Badge, Card, num, payMethodLabel, sar } from "@/lib/ui";

export default async function InvoicePage({ params }: PageProps<"/app/invoices/[id]">) {
  const user = await requireModule("invoices");
  const { id } = await params;

  const invoice = await db.invoice.findFirst({
    where: { id, clubId: user.clubId! },
    include: { club: true, member: true, items: true, payments: true },
  });
  if (!invoice) notFound();

  const qrDataUrl = invoice.qrTLV
    ? await QRCode.toDataURL(invoice.qrTLV, { width: 240, margin: 1 })
    : null;

  // إعادة حساب الهاش للتحقق من عدم تعديل الفاتورة بعد إصدارها
  const recomputed = invoice.xml ? hashInvoice(invoice.xml) : null;
  const untampered = recomputed !== null && recomputed === invoice.hash;

  const issued = new Intl.DateTimeFormat("ar-SA", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(invoice.issuedAt);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5 print:hidden">
        <Link href="/app/invoices" className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-emerald-700 transition">
          <ArrowRight className="w-4 h-4" />
          رجوع للفواتير
        </Link>
        <div className="flex items-center gap-3">
          <a
            href={`/app/invoices/${invoice.id}/xml`}
            className="h-9 px-3.5 rounded-xl border border-slate-200 text-sm text-slate-600 flex items-center gap-1.5 hover:bg-slate-50 transition"
          >
            تنزيل XML
          </a>
          <span className="flex items-center gap-1.5 text-xs text-slate-400">
            <Printer className="w-3.5 h-3.5" />
            اطبع الصفحة لنسخة ورقية
          </span>
        </div>
      </div>

      <article className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <header className="px-8 py-6 border-b border-slate-100 flex items-start justify-between gap-6">
          <div>
            <p className="text-xs text-slate-400 mb-1">
              {invoice.invoiceType === "standard" ? "فاتورة ضريبية" : "فاتورة ضريبية مبسطة"}
            </p>
            <h1 className="text-xl font-extrabold text-slate-900">{invoice.club.name}</h1>
            <p className="text-sm text-slate-500 mt-1">{invoice.club.address}</p>
            <p className="text-xs text-slate-400 mt-2">
              الرقم الضريبي: <span dir="ltr" className="tabular-nums">{invoice.club.vatNumber}</span>
            </p>
            <p className="text-xs text-slate-400">
              السجل التجاري: <span dir="ltr" className="tabular-nums">{invoice.club.crNumber}</span>
            </p>
          </div>
          <div className="text-left shrink-0">
            <p className="text-2xl font-extrabold tabular-nums" dir="ltr">{invoice.number}</p>
            <p className="text-sm text-slate-500 mt-1">{issued}</p>
            <div className="mt-2 flex gap-1.5 justify-end">
              <Badge tone={invoice.status === "paid" ? "emerald" : "amber"}>
                {invoice.status === "paid" ? "مدفوعة" : "غير مدفوعة"}
              </Badge>
            </div>
          </div>
        </header>

        <div className="px-8 py-5 border-b border-slate-100 grid sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-slate-400 mb-1">
              {invoice.invoiceType === "standard" ? "المشتري" : "العميل"}
            </p>
            <p className="font-bold">{invoice.buyerName ?? invoice.member?.name ?? "عميل نقدي"}</p>
            {invoice.buyerVat && (
              <p className="text-xs text-slate-500" dir="ltr">الرقم الضريبي: {invoice.buyerVat}</p>
            )}
            {invoice.member && !invoice.buyerName && (
              <p className="text-sm text-slate-500 tabular-nums" dir="ltr">{invoice.member.phone}</p>
            )}
          </div>
          <div className="sm:text-left">
            <p className="text-xs text-slate-400 mb-1">طريقة الدفع</p>
            <p className="font-bold">
              {invoice.payments[0] ? payMethodLabel[invoice.payments[0].method] : "—"}
            </p>
          </div>
        </div>

        <table className="w-full">
          <thead className="bg-slate-50/70">
            <tr>
              <th className="text-right text-xs font-medium text-slate-500 px-8 py-3">البند</th>
              <th className="text-center text-xs font-medium text-slate-500 px-4 py-3">الكمية</th>
              <th className="text-left text-xs font-medium text-slate-500 px-8 py-3">السعر</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {invoice.items.map((item) => (
              <tr key={item.id}>
                <td className="px-8 py-4 text-sm">{item.description}</td>
                <td className="px-4 py-4 text-sm text-center tabular-nums">{num(item.qty)}</td>
                <td className="px-8 py-4 text-sm text-left tabular-nums">{sar(item.unitPriceSAR * item.qty)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="px-8 py-5 border-t border-slate-100 flex flex-col sm:flex-row gap-8 justify-between">
          {qrDataUrl && (
            <div className="shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="رمز الفاتورة الإلكترونية" className="w-36 h-36 rounded-lg" />
              <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1 max-w-36 leading-relaxed">
                <BadgeCheck className="w-3 h-3 shrink-0" />
                رمز QR بترميز TLV معتمد
              </p>
            </div>
          )}

          <dl className="flex-1 max-w-xs space-y-2.5 sm:mr-auto">
            <div className="flex justify-between text-sm">
              <dt className="text-slate-500">الإجمالي قبل الضريبة</dt>
              <dd className="tabular-nums">{sar(invoice.subtotalSAR)}</dd>
            </div>
            <div className="flex justify-between text-sm">
              <dt className="text-slate-500">ضريبة القيمة المضافة 15%</dt>
              <dd className="tabular-nums">{sar(invoice.vatSAR)}</dd>
            </div>
            <div className="flex justify-between pt-3 border-t border-slate-200">
              <dt className="font-bold">الإجمالي المستحق</dt>
              <dd className="font-extrabold text-lg text-emerald-700 tabular-nums">{sar(invoice.totalSAR)}</dd>
            </div>
          </dl>
        </div>
      </article>

      {/* بيانات الامتثال — تظهر للمحاسب ولا تُطبع مع الفاتورة */}
      <Card title="بيانات الامتثال للفوترة الإلكترونية" className="mt-5 print:hidden">
        <div className="px-5 py-4 space-y-3">
          <div
            className={`rounded-xl px-4 py-3 flex items-center gap-2.5 ring-1 ${
              untampered ? "bg-emerald-50 ring-emerald-100" : "bg-red-50 ring-red-100"
            }`}
          >
            <ShieldCheck className={`w-4 h-4 shrink-0 ${untampered ? "text-emerald-600" : "text-red-600"}`} />
            <p className={`text-sm ${untampered ? "text-emerald-800" : "text-red-800"}`}>
              {untampered
                ? "الفاتورة لم تُعدَّل منذ إصدارها — الهاش المعاد حسابه يطابق المخزَّن"
                : "تحذير: الهاش لا يطابق محتوى الفاتورة"}
            </p>
          </div>

          <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500 shrink-0">نوع الفاتورة</dt>
              <dd className="font-medium text-left">
                {invoice.invoiceType === "standard" ? "ضريبية (0100000)" : "مبسطة (0200000)"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500 shrink-0">العدّاد التسلسلي (ICV)</dt>
              <dd className="font-medium tabular-nums">{num(invoice.icv)}</dd>
            </div>
            <div className="flex justify-between gap-3 sm:col-span-2">
              <dt className="text-slate-500 shrink-0">المعرّف الفريد (UUID)</dt>
              <dd className="font-mono text-[11px] text-slate-600 truncate" dir="ltr">{invoice.uuid}</dd>
            </div>
            <div className="flex justify-between gap-3 sm:col-span-2">
              <dt className="text-slate-500 shrink-0 flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5" />
                هاش الفاتورة السابقة (PIH)
              </dt>
              <dd className="font-mono text-[11px] text-slate-600 truncate max-w-[60%]" dir="ltr">
                {invoice.pih}
              </dd>
            </div>
            <div className="flex justify-between gap-3 sm:col-span-2">
              <dt className="text-slate-500 shrink-0">هاش هذه الفاتورة</dt>
              <dd className="font-mono text-[11px] text-slate-600 truncate max-w-[60%]" dir="ltr">
                {invoice.hash}
              </dd>
            </div>
          </dl>

          <p className="text-xs text-slate-400 pt-3 border-t border-slate-100 leading-relaxed">
            المستند مولَّد بصيغة UBL 2.1 مع رمز QR بترميز TLV وسلسلة هاش مترابطة وعدّاد تسلسلي.
            التوقيع الإلكتروني والربط المباشر ببوابة «فاتورة» يتطلبان شهادة CSID تصدرها الهيئة بعد
            تسجيل المنشأة — تُضاف عند تفعيل الربط الفعلي.
          </p>
        </div>
      </Card>
    </div>
  );
}
