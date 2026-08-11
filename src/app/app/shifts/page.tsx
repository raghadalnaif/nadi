import { AlertTriangle, CheckCircle2, CreditCard, LockKeyhole, Wallet } from "lucide-react";
import { db } from "@/lib/db";
import { branchScope, requireModule } from "@/lib/auth";
import { Badge, Card, Empty, PageHeader, StatCard, Table, Td, Th, fullDate, num, sar, time } from "@/lib/ui";
import { Dialog } from "@/components/dialog";
import { Field, Input, Submit } from "@/components/form";
import { closeShift, openShift } from "./actions";

export default async function ShiftsPage() {
  const user = await requireModule("shifts");
  const clubId = user.clubId!;
  const branchId = branchScope(user);

  const [myOpen, recent, todayAgg] = await Promise.all([
    db.cashShift.findFirst({ where: { clubId, userId: user.id, status: "open" } }),
    db.cashShift.findMany({
      where: { clubId, ...(branchId ? { branchId } : {}) },
      orderBy: { openedAt: "desc" },
      take: 20,
    }),
    db.cashShift.aggregate({
      where: {
        clubId,
        status: "closed",
        closedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
      _sum: { countedCashSAR: true, cardTotalSAR: true, varianceSAR: true },
      _count: true,
    }),
  ]);

  // ما تحصّل خلال الوردية المفتوحة حتى الآن
  let live = { cash: 0, card: 0, other: 0, count: 0 };
  if (myOpen) {
    const payments = await db.payment.findMany({
      where: { invoice: { clubId, docType: "invoice" }, paidAt: { gte: myOpen.openedAt } },
      include: { invoice: { select: { branchId: true } } },
    });
    const scoped = payments.filter((p) => !myOpen.branchId || p.invoice.branchId === myOpen.branchId);
    live = {
      cash: scoped.filter((p) => p.method === "cash").reduce((s, p) => s + p.amountSAR, 0),
      card: scoped.filter((p) => ["mada", "visa"].includes(p.method)).reduce((s, p) => s + p.amountSAR, 0),
      other: scoped
        .filter((p) => !["cash", "mada", "visa"].includes(p.method))
        .reduce((s, p) => s + p.amountSAR, 0),
      count: scoped.length,
    };
  }

  const expected = myOpen ? myOpen.openingFloatSAR + live.cash : 0;

  return (
    <>
      <PageHeader
        title="الورديات والصندوق"
        subtitle="افتح ورديتك في بداية الدوام وقفّلها في نهايته"
        action={
          !myOpen ? (
            <Dialog label="فتح وردية" title="فتح وردية جديدة" icon={<Wallet className="w-4 h-4" />}>
              <form action={openShift} className="space-y-3">
                <Field label="العهدة الافتتاحية (النقد في الدرج)">
                  <Input name="openingFloatSAR" type="number" min="0" step="10" defaultValue={500} required />
                </Field>
                <Submit>فتح الوردية</Submit>
              </form>
            </Dialog>
          ) : (
            <Dialog label="تقفيل الوردية" title="تقفيل الوردية" description="اعدّ النقد في الدرج وأدخل المبلغ" icon={<LockKeyhole className="w-4 h-4" />}>
              <form action={closeShift} className="space-y-3">
                <input type="hidden" name="shiftId" value={myOpen.id} />

                <div className="rounded-xl bg-slate-50 px-4 py-3 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">العهدة الافتتاحية</span>
                    <span className="tabular-nums">{sar(myOpen.openingFloatSAR)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">مبيعات نقدية</span>
                    <span className="tabular-nums">{sar(live.cash)}</span>
                  </div>
                  <div className="flex justify-between pt-1.5 border-t border-slate-200 font-bold">
                    <span>المتوقع في الدرج</span>
                    <span className="tabular-nums">{sar(expected)}</span>
                  </div>
                </div>

                <Field label="النقد المعدود فعلياً">
                  <Input name="countedCashSAR" type="number" min="0" step="0.5" defaultValue={expected} required />
                </Field>
                <Field label="ملاحظة">
                  <Input name="note" placeholder="سبب الفرق إن وُجد" />
                </Field>
                <Submit>تقفيل وترحيل الفرق</Submit>
              </form>
            </Dialog>
          )
        }
      />

      {myOpen ? (
        <Card title={`وردية مفتوحة — بدأت ${time(myOpen.openedAt)}`} className="mb-6 p-5 pt-4">
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            {[
              ["العهدة الافتتاحية", sar(myOpen.openingFloatSAR), "slate"],
              ["مبيعات نقدية", sar(live.cash), "emerald"],
              ["شبكة وبطاقات", sar(live.card), "sky"],
              ["المتوقع في الدرج", sar(expected), "violet"],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl bg-slate-50 px-4 py-3">
                <p className="text-xs text-slate-500">{label}</p>
                <p className="font-bold tabular-nums mt-1 text-slate-800">{value}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-3 pt-3 border-t border-slate-100">
            {num(live.count)} عملية بيع خلال الوردية
            {live.other > 0 && ` · ${sar(live.other)} تابي وتمارا وتحويلات`}
          </p>
        </Card>
      ) : (
        <div className="mb-6 rounded-2xl bg-amber-50 ring-1 ring-amber-100 px-5 py-4 flex items-center gap-3">
          <Wallet className="w-5 h-5 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800 flex-1">
            لا توجد وردية مفتوحة باسمك — افتح وردية قبل بدء البيع ليُحسب الصندوق بدقة
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="نقد محصّل اليوم" value={sar(todayAgg._sum.countedCashSAR ?? 0)} icon={<Wallet className="w-5 h-5" />} tone="emerald" />
        <StatCard label="شبكة اليوم" value={sar(todayAgg._sum.cardTotalSAR ?? 0)} icon={<CreditCard className="w-5 h-5" />} tone="sky" />
        <StatCard
          label="فروقات اليوم"
          value={sar(todayAgg._sum.varianceSAR ?? 0)}
          hint={`${num(todayAgg._count)} وردية مقفلة`}
          icon={<AlertTriangle className="w-5 h-5" />}
          tone={Math.abs(todayAgg._sum.varianceSAR ?? 0) > 0.5 ? "amber" : "slate"}
        />
      </div>

      <Card title="سجل الورديات">
        {recent.length === 0 ? (
          <Empty text="لا توجد ورديات بعد" />
        ) : (
          <Table
            head={
              <>
                <Th>الموظف</Th>
                <Th>الفترة</Th>
                <Th>العهدة</Th>
                <Th>المتوقع</Th>
                <Th>المعدود</Th>
                <Th>الفرق</Th>
                <Th>الحالة</Th>
              </>
            }
          >
            {recent.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50/60 transition">
                <Td className="font-bold">{s.userName}</Td>
                <Td className="text-slate-500 text-xs whitespace-nowrap">
                  {fullDate(s.openedAt)} · {time(s.openedAt)}
                  {s.closedAt && ` ← ${time(s.closedAt)}`}
                </Td>
                <Td className="tabular-nums text-slate-500 whitespace-nowrap">{sar(s.openingFloatSAR)}</Td>
                <Td className="tabular-nums whitespace-nowrap">
                  {s.status === "closed" ? sar(s.expectedCashSAR) : "—"}
                </Td>
                <Td className="tabular-nums whitespace-nowrap">
                  {s.status === "closed" ? sar(s.countedCashSAR) : "—"}
                </Td>
                <Td>
                  {s.status === "closed" ? (
                    Math.abs(s.varianceSAR) < 0.5 ? (
                      <Badge tone="emerald">
                        <CheckCircle2 className="w-3 h-3" />
                        مطابق
                      </Badge>
                    ) : (
                      <Badge tone={s.varianceSAR > 0 ? "sky" : "red"}>
                        {s.varianceSAR > 0 ? "زيادة" : "عجز"} {sar(Math.abs(s.varianceSAR))}
                      </Badge>
                    )
                  ) : (
                    "—"
                  )}
                </Td>
                <Td>
                  <Badge tone={s.status === "open" ? "amber" : "slate"}>
                    {s.status === "open" ? "مفتوحة" : "مقفلة"}
                  </Badge>
                </Td>
              </tr>
            ))}
          </Table>
        )}
        <p className="px-5 py-3 text-xs text-slate-400 border-t border-slate-100">
          أي فرق في الصندوق يُقيَّد محاسبياً تلقائياً: الزيادة إيراداً والعجز مصروفاً
        </p>
      </Card>
    </>
  );
}
