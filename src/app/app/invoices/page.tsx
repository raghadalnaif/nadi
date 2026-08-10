import Link from "next/link";
import { BadgeCheck, FileText, Link2, Plus, Search, ShieldCheck, TriangleAlert } from "lucide-react";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/auth";
import { verifyChain } from "@/lib/invoicing";
import {
  Badge,
  Card,
  Empty,
  PageHeader,
  StatCard,
  Table,
  Td,
  Th,
  fullDate,
  num,
  payMethodLabel,
  sar,
} from "@/lib/ui";
import { Dialog } from "@/components/dialog";
import { Field, Input, Select, Submit } from "@/components/form";
import { createManualInvoice, payInvoice } from "../actions";

const filters = [
  { key: "all", label: "الكل" },
  { key: "paid", label: "مدفوعة" },
  { key: "unpaid", label: "غير مدفوعة" },
  { key: "standard", label: "ضريبية (B2B)" },
  { key: "simplified", label: "مبسطة (B2C)" },
];

export default async function InvoicesPage({ searchParams }: PageProps<"/app/invoices">) {
  const user = await requireModule("invoices");
  const clubId = user.clubId!;
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const filter = typeof params.filter === "string" ? params.filter : "all";

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [invoices, totals, monthAgg, unpaidAgg, chain, members] = await Promise.all([
    db.invoice.findMany({
      where: {
        clubId,
        ...(filter === "paid" ? { status: "paid" } : {}),
        ...(filter === "unpaid" ? { status: "unpaid" } : {}),
        ...(filter === "standard" ? { invoiceType: "standard" } : {}),
        ...(filter === "simplified" ? { invoiceType: "simplified" } : {}),
        ...(q
          ? {
              OR: [
                { number: { contains: q } },
                { member: { name: { contains: q } } },
                { buyerName: { contains: q } },
              ],
            }
          : {}),
      },
      include: { member: true, payments: true },
      orderBy: { icv: "desc" },
      take: 40,
    }),
    db.invoice.aggregate({ where: { clubId }, _count: true, _sum: { totalSAR: true, vatSAR: true } }),
    db.invoice.aggregate({
      where: { clubId, status: "paid", issuedAt: { gte: monthStart } },
      _sum: { totalSAR: true, vatSAR: true },
      _count: true,
    }),
    db.invoice.aggregate({ where: { clubId, status: "unpaid" }, _sum: { totalSAR: true }, _count: true }),
    verifyChain(clubId),
    db.member.findMany({ where: { clubId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <PageHeader
        title="الفواتير الضريبية"
        subtitle="فواتير متوافقة مع متطلبات هيئة الزكاة والضريبة والدخل"
        action={
          <Dialog
            label="فاتورة جديدة"
            title="إصدار فاتورة يدوية"
            description="لبيع منتج أو خدمة خارج الاشتراكات"
            icon={<Plus className="w-4 h-4" />}
          >
            <form action={createManualInvoice} className="space-y-3">
              <Field label="نوع الفاتورة">
                <Select name="invoiceType" defaultValue="simplified">
                  <option value="simplified">مبسطة — لفرد (B2C)</option>
                  <option value="standard">ضريبية — لمنشأة (B2B)</option>
                </Select>
              </Field>
              <Field label="الوصف">
                <Input name="description" required placeholder="بروتين / حذاء رياضي / تدريب خاص" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="السعر شامل الضريبة">
                  <Input name="totalWithVat" type="number" min="1" step="0.01" required defaultValue={100} />
                </Field>
                <Field label="الكمية">
                  <Input name="qty" type="number" min="1" defaultValue={1} />
                </Field>
              </div>
              <Field label="العضو (اختياري)">
                <Select name="memberId" defaultValue="">
                  <option value="">— بدون —</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="اسم المشتري (للـ B2B)">
                  <Input name="buyerName" placeholder="شركة …" />
                </Field>
                <Field label="الرقم الضريبي للمشتري">
                  <Input name="buyerVat" dir="ltr" className="text-right" placeholder="3000…" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="الحالة">
                  <Select name="status" defaultValue="paid">
                    <option value="paid">مدفوعة</option>
                    <option value="unpaid">غير مدفوعة</option>
                  </Select>
                </Field>
                <Field label="طريقة الدفع">
                  <Select name="method" defaultValue="cash">
                    {Object.entries(payMethodLabel).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Submit>إصدار الفاتورة</Submit>
            </form>
          </Dialog>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard label="إجمالي الفواتير" value={num(totals._count)} hint={sar(totals._sum.totalSAR ?? 0)} icon={<FileText className="w-5 h-5" />} tone="violet" />
        <StatCard label="مبيعات الشهر" value={sar(monthAgg._sum.totalSAR ?? 0)} hint={`${num(monthAgg._count)} فاتورة`} icon={<BadgeCheck className="w-5 h-5" />} tone="emerald" />
        <StatCard label="ضريبة الشهر (15%)" value={sar(monthAgg._sum.vatSAR ?? 0)} hint="للإقرار الضريبي" icon={<ShieldCheck className="w-5 h-5" />} tone="sky" />
        <StatCard label="غير محصّلة" value={sar(unpaidAgg._sum.totalSAR ?? 0)} hint={`${num(unpaidAgg._count)} فاتورة`} icon={<TriangleAlert className="w-5 h-5" />} tone={unpaidAgg._count > 0 ? "amber" : "slate"} />
      </div>

      {/* حالة سلسلة الترابط — أي تلاعب في فاتورة يكسرها */}
      <div
        className={`mb-5 rounded-2xl px-5 py-4 flex items-center gap-3 ring-1 ${
          chain.intact ? "bg-emerald-50 ring-emerald-100" : "bg-red-50 ring-red-100"
        }`}
      >
        <Link2 className={`w-5 h-5 shrink-0 ${chain.intact ? "text-emerald-600" : "text-red-600"}`} />
        <div className="flex-1">
          <p className={`text-sm font-bold ${chain.intact ? "text-emerald-800" : "text-red-800"}`}>
            {chain.intact ? "سلسلة الفواتير سليمة" : "تحذير: سلسلة الفواتير مكسورة"}
          </p>
          <p className={`text-xs mt-0.5 ${chain.intact ? "text-emerald-700" : "text-red-700"}`}>
            {chain.intact
              ? `${num(chain.total)} فاتورة مترابطة بهاش متسلسل (PIH) وعدّاد تسلسلي (ICV) — أي تعديل لاحق يكسر السلسلة ويُكتشف فوراً`
              : `${num(chain.breaks.length)} فاتورة بها خلل في الترابط: ${chain.breaks.map((b) => b.number).join("، ")}`}
          </p>
        </div>
      </div>

      <form className="relative mb-4">
        <Search className="w-4 h-4 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2" />
        <input
          name="q"
          defaultValue={q}
          placeholder="ابحث برقم الفاتورة أو اسم العميل…"
          className="w-full h-11 bg-white border border-slate-200 rounded-xl pr-11 pl-4 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10"
        />
        <input type="hidden" name="filter" value={filter} />
      </form>

      <div className="flex gap-2 flex-wrap mb-4">
        {filters.map((f) => (
          <a
            key={f.key}
            href={`/app/invoices?filter=${f.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={`px-3.5 h-9 rounded-xl text-sm flex items-center transition border ${
              filter === f.key
                ? "bg-emerald-600 text-white border-emerald-600 font-bold"
                : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300"
            }`}
          >
            {f.label}
          </a>
        ))}
      </div>

      <Card>
        {invoices.length === 0 ? (
          <Empty text="لا توجد فواتير مطابقة" />
        ) : (
          <Table
            head={
              <>
                <Th>الرقم</Th>
                <Th>العدّاد</Th>
                <Th>النوع</Th>
                <Th>العميل</Th>
                <Th>التاريخ</Th>
                <Th>الإجمالي</Th>
                <Th>الضريبة</Th>
                <Th>الحالة</Th>
              </>
            }
          >
            {invoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-slate-50/60 transition">
                <Td>
                  <Link href={`/app/invoices/${inv.id}`} className="font-bold text-emerald-700 hover:underline" dir="ltr">
                    {inv.number}
                  </Link>
                </Td>
                <Td className="text-slate-400 tabular-nums text-xs">{num(inv.icv)}</Td>
                <Td>
                  <Badge tone={inv.invoiceType === "standard" ? "violet" : "slate"}>
                    {inv.invoiceType === "standard" ? "ضريبية" : "مبسطة"}
                  </Badge>
                </Td>
                <Td className="text-slate-600">{inv.buyerName ?? inv.member?.name ?? "عميل نقدي"}</Td>
                <Td className="text-slate-500 whitespace-nowrap text-xs">{fullDate(inv.issuedAt)}</Td>
                <Td className="font-bold tabular-nums whitespace-nowrap">{sar(inv.totalSAR)}</Td>
                <Td className="text-slate-500 tabular-nums whitespace-nowrap">{sar(inv.vatSAR)}</Td>
                <Td>
                  {inv.status === "paid" ? (
                    <Badge tone="emerald">مدفوعة</Badge>
                  ) : (
                    <form action={payInvoice} className="flex items-center gap-1.5">
                      <input type="hidden" name="invoiceId" value={inv.id} />
                      <select name="method" className="h-8 text-xs bg-white border border-slate-200 rounded-lg px-2 outline-none">
                        {Object.entries(payMethodLabel).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                      <button className="h-8 px-3 rounded-lg bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 transition">
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
    </>
  );
}
