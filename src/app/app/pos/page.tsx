import { Boxes, PackagePlus, Pencil, Plus, ShoppingBag, Trash2, TriangleAlert } from "lucide-react";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/auth";
import { Badge, Card, Empty, PageHeader, StatCard, Table, Td, Th, num, sar } from "@/lib/ui";
import { ConfirmButton, Dialog } from "@/components/dialog";
import { Field, Input, Select, Submit } from "@/components/form";
import { Register } from "./register";
import { deleteProduct, restockProduct, saveProduct } from "./actions";

const CATEGORIES = ["مكملات", "ملابس", "مشروبات", "خدمات", "أخرى"];

export default async function PosPage() {
  const user = await requireModule("pos");
  const clubId = user.clubId!;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [products, plans, members, todaySales, lowStock] = await Promise.all([
    db.product.findMany({ where: { clubId, active: true }, orderBy: { name: "asc" } }),
    db.plan.findMany({ where: { clubId, active: true }, orderBy: { durationDays: "asc" } }),
    db.member.findMany({
      where: { clubId },
      select: { id: true, name: true, phone: true, memberNo: true },
      orderBy: { name: "asc" },
    }),
    db.invoice.aggregate({
      where: { clubId, issuedAt: { gte: todayStart }, status: "paid", docType: "invoice" },
      _sum: { totalSAR: true },
      _count: true,
    }),
    db.product.count({ where: { clubId, active: true, trackStock: true, stock: { lte: 3 } } }),
  ]);

  const productForm = (p?: (typeof products)[number]) => (
    <form action={saveProduct} className="space-y-3">
      {p && <input type="hidden" name="productId" value={p.id} />}
      <Field label="اسم المنتج">
        <Input name="name" defaultValue={p?.name} required placeholder="بروتين واي 2 كجم" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="السعر (شامل الضريبة)">
          <Input name="priceSAR" type="number" min="1" step="0.01" defaultValue={p?.priceSAR ?? 50} required />
        </Field>
        <Field label="التكلفة">
          <Input name="costSAR" type="number" min="0" step="0.01" defaultValue={p?.costSAR ?? 0} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="التصنيف">
          <Select name="category" defaultValue={p?.category ?? "مكملات"}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="الكمية بالمخزون">
          <Input name="stock" type="number" min="0" defaultValue={p?.stock ?? 0} />
        </Field>
      </div>
      <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 cursor-pointer">
        <input type="checkbox" name="trackStock" defaultChecked={p?.trackStock ?? true} className="w-4 h-4 accent-emerald-600" />
        <span className="text-sm font-bold text-slate-800">تتبّع المخزون</span>
      </label>
      <Submit>{p ? "حفظ" : "إضافة المنتج"}</Submit>
    </form>
  );

  return (
    <>
      <PageHeader
        title="الكاشير"
        subtitle="بيع الاشتراكات والمنتجات وإصدار الفواتير"
        action={
          <Dialog label="منتج جديد" title="إضافة منتج" icon={<Plus className="w-4 h-4" />}>
            {productForm()}
          </Dialog>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard
          label="مبيعات اليوم"
          value={sar(todaySales._sum.totalSAR ?? 0)}
          hint={`${num(todaySales._count)} فاتورة`}
          icon={<ShoppingBag className="w-5 h-5" />}
          tone="emerald"
        />
        <StatCard label="أصناف متاحة" value={num(products.length)} icon={<Boxes className="w-5 h-5" />} tone="sky" />
        <StatCard
          label="أصناف شارفت على النفاد"
          value={num(lowStock)}
          hint="3 قطع أو أقل"
          icon={<TriangleAlert className="w-5 h-5" />}
          tone={lowStock > 0 ? "amber" : "slate"}
        />
      </div>

      <Register
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          priceSAR: p.priceSAR,
          kind: "product" as const,
          stock: p.trackStock ? p.stock : undefined,
          category: p.category,
        }))}
        plans={plans.map((p) => ({
          id: p.id,
          name: p.name,
          priceSAR: p.priceSAR,
          kind: "plan" as const,
        }))}
        members={members}
      />

      <Card title="المخزون" className="mt-6">
        {products.length === 0 ? (
          <Empty text="لا توجد منتجات — أضف أول منتج للبيع من الكاشير" />
        ) : (
          <Table
            head={
              <>
                <Th>المنتج</Th>
                <Th>التصنيف</Th>
                <Th>السعر</Th>
                <Th>التكلفة</Th>
                <Th>هامش الربح</Th>
                <Th>المخزون</Th>
                <Th>إجراء</Th>
              </>
            }
          >
            {products.map((p) => {
              const margin = p.priceSAR > 0 ? ((p.priceSAR - p.costSAR) / p.priceSAR) * 100 : 0;
              return (
                <tr key={p.id} className="hover:bg-slate-50/60 transition">
                  <Td className="font-bold">{p.name}</Td>
                  <Td><Badge tone="slate">{p.category}</Badge></Td>
                  <Td className="tabular-nums whitespace-nowrap">{sar(p.priceSAR)}</Td>
                  <Td className="tabular-nums text-slate-500 whitespace-nowrap">
                    {p.costSAR ? sar(p.costSAR) : "—"}
                  </Td>
                  <Td className="tabular-nums text-emerald-700 font-bold">
                    {p.costSAR ? `${Math.round(margin)}%` : "—"}
                  </Td>
                  <Td>
                    {p.trackStock ? (
                      <Badge tone={p.stock <= 0 ? "red" : p.stock <= 3 ? "amber" : "emerald"}>
                        {num(p.stock)} قطعة
                      </Badge>
                    ) : (
                      <span className="text-xs text-slate-400">غير متتبَّع</span>
                    )}
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1">
                      <Dialog
                        label="إضافة للمخزون"
                        title={`توريد ${p.name}`}
                        variant="icon"
                        icon={<PackagePlus className="w-4 h-4" />}
                      >
                        <form action={restockProduct} className="space-y-3">
                          <input type="hidden" name="productId" value={p.id} />
                          <Field label="الكمية المضافة">
                            <Input name="qty" type="number" min="1" defaultValue={10} required />
                          </Field>
                          <Submit>إضافة للمخزون</Submit>
                        </form>
                      </Dialog>

                      <Dialog label="تعديل" title={`تعديل ${p.name}`} variant="icon" icon={<Pencil className="w-4 h-4" />}>
                        {productForm(p)}
                      </Dialog>

                      <form action={deleteProduct}>
                        <input type="hidden" name="productId" value={p.id} />
                        <ConfirmButton
                          label="حذف"
                          message={`حذف ${p.name}؟ إن كان مباعاً سابقاً فسيُعطَّل بدل الحذف.`}
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
    </>
  );
}
