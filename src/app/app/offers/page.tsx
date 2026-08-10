import { Pencil, Plus, Power, Tag, TicketPercent, TrendingDown, Trash2, Users } from "lucide-react";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/auth";
import { Badge, Card, Empty, PageHeader, StatCard, Table, Td, Th, fullDate, num, sar } from "@/lib/ui";
import { ConfirmButton, Dialog } from "@/components/dialog";
import { Field, Input, Select, Submit } from "@/components/form";
import { deleteOffer, saveOffer, toggleOffer } from "../ops-actions";

const iso = (d: Date) => d.toISOString().slice(0, 10);

export default async function OffersPage() {
  const user = await requireModule("offers");
  const clubId = user.clubId!;
  const now = new Date();

  const [offers, plans, discountAgg, usageByOffer] = await Promise.all([
    db.offer.findMany({
      where: { clubId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { subscriptions: true } } },
    }),
    db.plan.findMany({ where: { clubId }, orderBy: { durationDays: "asc" } }),
    db.subscription.aggregate({
      where: { member: { clubId }, discountSAR: { gt: 0 } },
      _sum: { discountSAR: true },
      _count: true,
    }),
    db.subscription.groupBy({
      by: ["offerId"],
      where: { member: { clubId }, offerId: { not: null } },
      _sum: { discountSAR: true },
    }),
  ]);

  const activeNow = offers.filter(
    (o) => o.active && o.startsAt <= now && o.endsAt >= now
  ).length;

  const planName = (id: string | null) =>
    id ? (plans.find((p) => p.id === id)?.name ?? "باقة محذوفة") : "كل الباقات";

  const offerForm = (offer?: (typeof offers)[number]) => (
    <form action={saveOffer} className="space-y-3">
      {offer && <input type="hidden" name="offerId" value={offer.id} />}
      <Field label="اسم العرض">
        <Input name="name" defaultValue={offer?.name} required placeholder="عرض الصيف" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="كود الخصم">
          <Input
            name="code"
            defaultValue={offer?.code}
            required
            dir="ltr"
            className="text-right uppercase"
            placeholder="SUMMER25"
          />
        </Field>
        <Field label="نوع الخصم">
          <Select name="kind" defaultValue={offer?.kind ?? "percent"}>
            <option value="percent">نسبة مئوية %</option>
            <option value="fixed">مبلغ ثابت ر.س</option>
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="القيمة">
          <Input name="value" type="number" min="1" step="0.01" defaultValue={offer?.value ?? 20} required />
        </Field>
        <Field label="حد الاستخدام (0 = بلا حد)">
          <Input name="maxUses" type="number" min="0" defaultValue={offer?.maxUses ?? 0} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="يبدأ في">
          <Input name="startsAt" type="date" defaultValue={iso(offer?.startsAt ?? now)} required />
        </Field>
        <Field label="ينتهي في">
          <Input
            name="endsAt"
            type="date"
            defaultValue={iso(offer?.endsAt ?? new Date(Date.now() + 30 * 86400000))}
            required
          />
        </Field>
      </div>
      <Field label="يشمل">
        <Select name="planId" defaultValue={offer?.planId ?? ""}>
          <option value="">كل الباقات</option>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </Select>
      </Field>
      <Submit>{offer ? "حفظ التعديلات" : "إنشاء العرض"}</Submit>
    </form>
  );

  return (
    <>
      <PageHeader
        title="العروض والخصومات"
        subtitle="أكواد خصم تُطبَّق عند تسجيل الاشتراك وتظهر في الفاتورة"
        action={
          <Dialog label="عرض جديد" title="إنشاء عرض" icon={<Plus className="w-4 h-4" />}>
            {offerForm()}
          </Dialog>
        }
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard label="عروض سارية الآن" value={num(activeNow)} icon={<TicketPercent className="w-5 h-5" />} tone="emerald" />
        <StatCard label="إجمالي العروض" value={num(offers.length)} icon={<Tag className="w-5 h-5" />} tone="violet" />
        <StatCard label="اشتراكات بخصم" value={num(discountAgg._count)} icon={<Users className="w-5 h-5" />} tone="sky" />
        <StatCard
          label="قيمة الخصومات الممنوحة"
          value={sar(discountAgg._sum.discountSAR ?? 0)}
          hint="مخصومة من الإيراد"
          icon={<TrendingDown className="w-5 h-5" />}
          tone="amber"
        />
      </div>

      <Card title="كل العروض">
        {offers.length === 0 ? (
          <Empty text="لا توجد عروض — أنشئ أول عرض لجذب مشتركين جدد" />
        ) : (
          <Table
            head={
              <>
                <Th>العرض</Th>
                <Th>الكود</Th>
                <Th>الخصم</Th>
                <Th>يشمل</Th>
                <Th>الفترة</Th>
                <Th>الاستخدام</Th>
                <Th>الحالة</Th>
                <Th>إجراء</Th>
              </>
            }
          >
            {offers.map((o) => {
              const expired = o.endsAt < now;
              const notStarted = o.startsAt > now;
              const exhausted = o.maxUses > 0 && o.usedCount >= o.maxUses;
              const live = o.active && !expired && !notStarted && !exhausted;
              const granted = usageByOffer.find((u) => u.offerId === o.id)?._sum.discountSAR ?? 0;

              return (
                <tr key={o.id} className="hover:bg-slate-50/60 transition">
                  <Td className="font-bold">{o.name}</Td>
                  <Td>
                    <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-lg" dir="ltr">
                      {o.code}
                    </span>
                  </Td>
                  <Td className="font-bold text-emerald-700 whitespace-nowrap">
                    {o.kind === "percent" ? `${num(o.value)}%` : sar(o.value)}
                  </Td>
                  <Td className="text-slate-600 text-xs">{planName(o.planId)}</Td>
                  <Td className="text-slate-500 text-xs whitespace-nowrap">
                    {fullDate(o.startsAt)} — {fullDate(o.endsAt)}
                  </Td>
                  <Td className="text-slate-600 text-xs whitespace-nowrap">
                    {num(o.usedCount)}
                    {o.maxUses > 0 ? ` / ${num(o.maxUses)}` : ""}
                    {granted > 0 && <span className="text-slate-400"> · {sar(granted)}</span>}
                  </Td>
                  <Td>
                    <Badge tone={live ? "emerald" : exhausted ? "amber" : "slate"}>
                      {!o.active
                        ? "موقوف"
                        : exhausted
                          ? "استُنفد"
                          : expired
                            ? "منتهٍ"
                            : notStarted
                              ? "لم يبدأ"
                              : "ساري"}
                    </Badge>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1">
                      <Dialog label="تعديل" title={`تعديل ${o.name}`} variant="icon" icon={<Pencil className="w-4 h-4" />}>
                        {offerForm(o)}
                      </Dialog>
                      <form action={toggleOffer}>
                        <input type="hidden" name="offerId" value={o.id} />
                        <button
                          title={o.active ? "إيقاف" : "تفعيل"}
                          className="w-9 h-9 rounded-lg grid place-items-center text-slate-400 hover:bg-amber-50 hover:text-amber-600 transition"
                        >
                          <Power className="w-4 h-4" />
                        </button>
                      </form>
                      <form action={deleteOffer}>
                        <input type="hidden" name="offerId" value={o.id} />
                        <ConfirmButton
                          label="حذف"
                          message={`حذف عرض ${o.name}؟ إذا كان مستخدماً في اشتراكات فسيُعطَّل بدل الحذف.`}
                          icon={<Trash2 className="w-4 h-4" />}
                        />
                      </form>
                    </div>
                  </Td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>

      <div className="mt-5 rounded-2xl bg-sky-50 ring-1 ring-sky-100 px-5 py-4 text-sm text-sky-800">
        <b>كيف يُستخدم؟</b> عند تسجيل عضو جديد في قسم الاشتراكات، يُدخل الموظف كود الخصم في
        الحقل المخصص — يتحقق النظام من صلاحيته تلقائياً ويطبّق الخصم على السعر ويسجّله في الفاتورة.
      </div>
    </>
  );
}
