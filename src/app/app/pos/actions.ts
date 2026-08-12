"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { issueInvoice } from "@/lib/invoicing";
import { queueMessage } from "@/lib/whatsapp";
import { subscriptionFromPlan } from "@/lib/membership";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const fmtDate = (d: Date) => new Intl.DateTimeFormat("ar-SA", { dateStyle: "long" }).format(d);

export type CartLine = { kind: "product" | "plan"; id: string; qty: number };

export type SaleResult = {
  ok: boolean;
  message: string;
  invoiceId?: string;
  waUrl?: string;
  tone: "success" | "error";
};

// ═════════ البيع من الكاشير ═════════
// يقبل سلة تحتوي منتجات و/أو باقة اشتراك، ويُصدر فاتورة واحدة،
// ويخصم المخزون، ويجهّز رسالة واتساب بالإيصال.
export async function checkout(
  _prev: SaleResult | null,
  formData: FormData
): Promise<SaleResult> {
  const user = await requireModule("pos");
  const clubId = user.clubId!;

  let cart: CartLine[] = [];
  try {
    cart = JSON.parse(str(formData, "cart") || "[]");
  } catch {
    return { ok: false, message: "سلة غير صالحة", tone: "error" };
  }
  if (cart.length === 0) return { ok: false, message: "السلة فارغة", tone: "error" };

  const method = str(formData, "method") || "cash";
  const memberId = str(formData, "memberId") || null;
  const walkInName = str(formData, "walkInName");
  const walkInPhone = str(formData, "walkInPhone");

  const productIds = cart.filter((c) => c.kind === "product").map((c) => c.id);
  const planIds = cart.filter((c) => c.kind === "plan").map((c) => c.id);

  const [products, plans, member] = await Promise.all([
    db.product.findMany({ where: { id: { in: productIds }, clubId, active: true } }),
    db.plan.findMany({ where: { id: { in: planIds }, clubId, active: true } }),
    memberId ? db.member.findFirst({ where: { id: memberId, clubId } }) : null,
  ]);

  // التحقق من المخزون قبل البيع
  for (const line of cart.filter((c) => c.kind === "product")) {
    const p = products.find((x) => x.id === line.id);
    if (!p) return { ok: false, message: "منتج غير موجود", tone: "error" };
    if (p.trackStock && p.stock < line.qty) {
      return { ok: false, message: `الكمية غير متوفرة من ${p.name} (المتاح ${p.stock})`, tone: "error" };
    }
  }

  const items: { description: string; qty: number; totalWithVat: number; productId?: string }[] = [];

  for (const line of cart) {
    if (line.kind === "product") {
      const p = products.find((x) => x.id === line.id)!;
      items.push({
        description: p.name,
        qty: line.qty,
        totalWithVat: p.priceSAR * line.qty,
        productId: p.id,
      });
    } else {
      const pl = plans.find((x) => x.id === line.id);
      if (!pl) return { ok: false, message: "باقة غير موجودة", tone: "error" };
      if (!memberId) return { ok: false, message: "اختر العضو لبيع اشتراك", tone: "error" };
      items.push({ description: `اشتراك ${pl.name}`, qty: 1, totalWithVat: pl.priceSAR });
    }
  }

  // اشتراك جديد إن كانت السلة تحوي باقة
  let subscriptionId: string | null = null;
  let soldPlanName: string | null = null;
  let endsAt: Date | null = null;

  if (planIds.length > 0 && memberId) {
    const plan = plans.find((p) => p.id === planIds[0])!;
    const last = await db.subscription.findFirst({
      where: { memberId },
      orderBy: { endsAt: "desc" },
    });
    const startsAt = last && last.endsAt > new Date() ? last.endsAt : new Date();
    const shape = subscriptionFromPlan(plan, startsAt);
    endsAt = shape.endsAt;

    const sub = await db.subscription.create({
      data: { memberId, planId: plan.id, startsAt, paidSAR: plan.priceSAR, ...shape },
    });
    subscriptionId = sub.id;
    soldPlanName = plan.name;
  }

  const invoice = await issueInvoice({
    clubId,
    memberId,
    subscriptionId,
    items: items.map(({ description, qty, totalWithVat }) => ({ description, qty, totalWithVat })),
    status: "paid",
    method,
    buyerName: !memberId && walkInName ? walkInName : null,
  });

  // ربط بنود الفاتورة بالمنتجات وخصم المخزون
  const createdItems = await db.invoiceItem.findMany({ where: { invoiceId: invoice.id } });
  for (const line of items.filter((i) => i.productId)) {
    const match = createdItems.find((ci) => ci.description === line.description && !ci.productId);
    if (match) {
      await db.invoiceItem.update({ where: { id: match.id }, data: { productId: line.productId } });
    }
    const p = products.find((x) => x.id === line.productId)!;
    if (p.trackStock) {
      await db.product.update({ where: { id: p.id }, data: { stock: { decrement: line.qty } } });
    }
  }

  // رسالة الإيصال عبر واتساب
  const club = await db.club.findUnique({ where: { id: clubId } });
  const phone = member?.phone ?? walkInPhone;
  const name = member?.name ?? walkInName ?? "عميلنا";
  let waUrl: string | undefined;

  if (club?.waAutoReceipt && phone) {
    const msg = await queueMessage({
      clubId,
      kind: "receipt",
      memberId: member?.id ?? null,
      toName: name,
      phone,
      vars: {
        الاسم: name,
        المبلغ: `${Math.round(invoice.totalSAR)} ر.س`,
        رقم_الفاتورة: invoice.number,
      },
    });
    if (msg && club.waProvider === "link") {
      waUrl = `https://wa.me/${phone.replace(/\D/g, "").replace(/^0/, "966")}?text=${encodeURIComponent(msg.body)}`;
    }
  }

  // رسالة ترحيب عند بيع أول اشتراك
  if (soldPlanName && member && endsAt && club?.waAutoWelcome) {
    const isFirst = await db.subscription.count({ where: { memberId: member.id } });
    if (isFirst === 1) {
      await queueMessage({
        clubId,
        kind: "welcome",
        memberId: member.id,
        toName: member.name,
        phone: member.phone,
        vars: {
          الاسم: member.name,
          الباقة: soldPlanName,
          تاريخ_الانتهاء: fmtDate(endsAt),
          رقم_العضوية: member.memberNo,
        },
      });
    }
  }

  await audit({
    user,
    action: "create",
    entity: "sale",
    entityId: invoice.id,
    summary: `بيع من الكاشير: فاتورة ${invoice.number} بمبلغ ${Math.round(invoice.totalSAR)} ر.س`,
  });

  revalidatePath("/app/pos");
  revalidatePath("/app/invoices");
  revalidatePath("/app/messages");

  return {
    ok: true,
    invoiceId: invoice.id,
    waUrl,
    message: `تم البيع — فاتورة ${invoice.number} بمبلغ ${Math.round(invoice.totalSAR)} ر.س`,
    tone: "success",
  };
}

// ═════════ إدارة المنتجات ═════════

export async function saveProduct(formData: FormData) {
  const user = await requireModule("pos");
  const id = str(formData, "productId");
  const name = str(formData, "name");
  const priceSAR = Number(formData.get("priceSAR"));
  const costSAR = Math.max(0, Number(formData.get("costSAR")) || 0);
  const stock = Math.max(0, Number(formData.get("stock")) || 0);
  const category = str(formData, "category") || "مكملات";
  if (!name || !(priceSAR > 0)) return;

  if (id) {
    const existing = await db.product.findFirst({ where: { id, clubId: user.clubId! } });
    if (!existing) return;
    await db.product.update({
      where: { id },
      data: { name, priceSAR, costSAR, stock, category, trackStock: formData.get("trackStock") === "on" },
    });
    await audit({ user, action: "update", entity: "product", entityId: id, summary: `تعديل منتج «${name}»` });
  } else {
    const p = await db.product.create({
      data: {
        clubId: user.clubId!,
        name,
        priceSAR,
        costSAR,
        stock,
        category,
        trackStock: formData.get("trackStock") === "on",
      },
    });
    await audit({ user, action: "create", entity: "product", entityId: p.id, summary: `إضافة منتج «${name}» بسعر ${priceSAR} ر.س` });
  }

  revalidatePath("/app/pos");
}

export async function deleteProduct(formData: FormData) {
  const user = await requireModule("pos");
  const id = str(formData, "productId");
  const p = await db.product.findFirst({
    where: { id, clubId: user.clubId! },
    include: { _count: { select: { items: true } } },
  });
  if (!p) return;

  // منتج مباع سابقاً يُعطَّل بدل الحذف حفاظاً على الفواتير
  if (p._count.items > 0) {
    await db.product.update({ where: { id }, data: { active: false } });
    await audit({ user, action: "update", entity: "product", entityId: id, summary: `تعطيل منتج «${p.name}» (مباع سابقاً)` });
  } else {
    await db.product.delete({ where: { id } });
    await audit({ user, action: "delete", entity: "product", entityId: id, summary: `حذف منتج «${p.name}»` });
  }
  revalidatePath("/app/pos");
}

export async function restockProduct(formData: FormData) {
  const user = await requireModule("pos");
  const id = str(formData, "productId");
  const qty = Number(formData.get("qty"));
  if (!(qty > 0)) return;

  const p = await db.product.findFirst({ where: { id, clubId: user.clubId! } });
  if (!p) return;

  await db.product.update({ where: { id }, data: { stock: { increment: Math.round(qty) } } });
  await audit({ user, action: "update", entity: "product", entityId: id, summary: `إضافة ${qty} للمخزون: «${p.name}»` });
  revalidatePath("/app/pos");
}
