"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/auth";
import { issueInvoice } from "@/lib/invoicing";
import { postExpense, postPayment } from "@/lib/ledger";
import { queueMessage } from "@/lib/whatsapp";

// يمنع تعديل بيانات نادٍ آخر — تُستدعى في كل إجراء
async function memberOfMyClub(memberId: string, clubId: string) {
  return db.member.findFirst({ where: { id: memberId, clubId } });
}

// يتحقق من كود العرض ويحسب السعر بعد الخصم
async function applyOffer(clubId: string, planId: string, price: number, code: string) {
  if (!code) return { finalPrice: price, discountSAR: 0, offer: null };

  const now = new Date();
  const offer = await db.offer.findFirst({
    where: {
      clubId,
      code,
      active: true,
      startsAt: { lte: now },
      endsAt: { gte: now },
      OR: [{ planId: null }, { planId }],
    },
  });

  // كود غير صالح أو منتهٍ أو استُنفد → السعر كامل بلا خصم
  if (!offer) return { finalPrice: price, discountSAR: 0, offer: null };
  if (offer.maxUses > 0 && offer.usedCount >= offer.maxUses) {
    return { finalPrice: price, discountSAR: 0, offer: null };
  }

  const raw = offer.kind === "percent" ? (price * offer.value) / 100 : offer.value;
  const discountSAR = Math.min(price, Math.round(raw * 100) / 100);

  await db.offer.update({ where: { id: offer.id }, data: { usedCount: { increment: 1 } } });

  return { finalPrice: Math.round((price - discountSAR) * 100) / 100, discountSAR, offer };
}

export async function checkIn(formData: FormData) {
  const user = await requireModule("reception");
  const memberId = String(formData.get("memberId"));
  if (!(await memberOfMyClub(memberId, user.clubId!))) return;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const already = await db.attendance.findFirst({
    where: { memberId, checkedAt: { gte: todayStart } },
  });
  if (!already) await db.attendance.create({ data: { memberId, source: "reception" } });

  revalidatePath("/app/reception");
}

export async function renew(formData: FormData) {
  const user = await requireModule("subscriptions");
  const memberId = String(formData.get("memberId"));
  const club = await db.club.findUnique({ where: { id: user.clubId! } });
  if (!club || !(await memberOfMyClub(memberId, club.id))) return;

  const last = await db.subscription.findFirst({
    where: { memberId },
    orderBy: { endsAt: "desc" },
    include: { plan: true },
  });
  if (!last) return;

  const now = new Date();
  const startsAt = last.endsAt > now ? last.endsAt : now;
  const endsAt = new Date(startsAt);
  endsAt.setDate(endsAt.getDate() + last.plan.durationDays);

  const sub = await db.subscription.create({
    data: { memberId, planId: last.planId, startsAt, endsAt, paidSAR: last.plan.priceSAR },
  });

  // كل تجديد يولّد فاتورة ضريبية مرتبطة بسلسلة ZATCA
  await issueInvoice({
    clubId: club.id,
    memberId,
    subscriptionId: sub.id,
    items: [{ description: `تجديد اشتراك ${last.plan.name}`, totalWithVat: last.plan.priceSAR }],
  });

  revalidatePath("/app/reception");
  revalidatePath("/app/subscriptions");
  revalidatePath("/app/invoices");
  revalidatePath("/app/accounting");
}

export async function toggleFreeze(formData: FormData) {
  const user = await requireModule("subscriptions");
  const subId = String(formData.get("subId"));

  const sub = await db.subscription.findFirst({
    where: { id: subId, member: { clubId: user.clubId! } },
  });
  if (!sub) return;

  if (sub.status === "frozen") {
    // عند الاستئناف نمدد النهاية بعدد أيام التجميد
    const frozenDays = sub.frozenAt
      ? Math.ceil((Date.now() - sub.frozenAt.getTime()) / 86400000)
      : 0;
    const endsAt = new Date(sub.endsAt);
    endsAt.setDate(endsAt.getDate() + frozenDays);
    await db.subscription.update({
      where: { id: subId },
      data: { status: "active", frozenAt: null, frozenDays: sub.frozenDays + frozenDays, endsAt },
    });
  } else {
    await db.subscription.update({
      where: { id: subId },
      data: { status: "frozen", frozenAt: new Date() },
    });
  }

  revalidatePath("/app/subscriptions");
}

export async function addMember(formData: FormData) {
  const user = await requireModule("subscriptions");
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const planId = String(formData.get("planId") ?? "");
  const offerCode = String(formData.get("offerCode") ?? "").trim().toUpperCase();
  if (!name || !phone || !planId) return;

  const club = await db.club.findUnique({ where: { id: user.clubId! } });
  const plan = await db.plan.findFirst({ where: { id: planId, clubId: user.clubId! } });
  if (!club || !plan) return;

  const { finalPrice, discountSAR, offer } = await applyOffer(club.id, plan.id, plan.priceSAR, offerCode);

  const last = await db.member.findFirst({
    where: { clubId: club.id },
    orderBy: { memberNo: "desc" },
  });

  const memberNo = (last?.memberNo ?? 1000) + 1;
  const member = await db.member.create({
    data: {
      clubId: club.id,
      name,
      phone,
      memberNo,
      // باركود العضوية يُولَّد تلقائياً للمسح الضوئي
      barcode: `M${memberNo}${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    },
  });

  const endsAt = new Date();
  endsAt.setDate(endsAt.getDate() + plan.durationDays);
  const sub = await db.subscription.create({
    data: {
      memberId: member.id,
      planId: plan.id,
      startsAt: new Date(),
      endsAt,
      paidSAR: finalPrice,
      discountSAR,
      offerId: offer?.id ?? null,
    },
  });

  await issueInvoice({
    clubId: club.id,
    memberId: member.id,
    subscriptionId: sub.id,
    items: [
      {
        description: offer ? `اشتراك ${plan.name} — عرض ${offer.name}` : `اشتراك ${plan.name}`,
        totalWithVat: finalPrice,
      },
    ],
  });

  // رسالة ترحيب تلقائية
  if (club.waAutoWelcome) {
    await queueMessage({
      clubId: club.id,
      kind: "welcome",
      memberId: member.id,
      toName: member.name,
      phone: member.phone,
      vars: {
        الاسم: member.name,
        الباقة: plan.name,
        تاريخ_الانتهاء: new Intl.DateTimeFormat("ar-SA", { dateStyle: "long" }).format(endsAt),
        رقم_العضوية: memberNo,
      },
    });
  }

  revalidatePath("/app/subscriptions");
  revalidatePath("/app/invoices");
  revalidatePath("/app/messages");
  revalidatePath("/app/accounting");
}

export async function book(formData: FormData) {
  const user = await requireModule("schedule");
  const sessionId = String(formData.get("sessionId"));
  const memberId = String(formData.get("memberId"));
  if (!memberId || !(await memberOfMyClub(memberId, user.clubId!))) return;

  const session = await db.classSession.findFirst({
    where: { id: sessionId, gymClass: { clubId: user.clubId! } },
    include: { _count: { select: { bookings: { where: { status: "booked" } } } } },
  });
  if (!session) return;

  const status = session._count.bookings < session.capacity ? "booked" : "waitlist";
  await db.booking
    .create({ data: { sessionId, memberId, status, source: "reception" } })
    .catch(() => {});

  revalidatePath("/app/schedule");
}

export async function addExpense(formData: FormData) {
  const user = await requireModule("accounting");
  const category = String(formData.get("category") ?? "أخرى");
  const description = String(formData.get("description") ?? "").trim();
  const amountSAR = Number(formData.get("amountSAR"));
  if (!description || !Number.isFinite(amountSAR) || amountSAR <= 0) return;

  const exp = await db.expense.create({
    data: { clubId: user.clubId!, category, description, amountSAR },
  });
  await postExpense(exp.id);
  revalidatePath("/app/accounting");
}

export async function payInvoice(formData: FormData) {
  const user = await requireModule("accounting");
  const invoiceId = String(formData.get("invoiceId"));
  const method = String(formData.get("method") ?? "cash");

  const invoice = await db.invoice.findFirst({ where: { id: invoiceId, clubId: user.clubId! } });
  if (!invoice || invoice.status === "paid") return;

  await db.invoice.update({ where: { id: invoiceId }, data: { status: "paid" } });
  await db.payment.create({ data: { invoiceId, method, amountSAR: invoice.totalSAR } });
  await postPayment(invoiceId, method, invoice.totalSAR);

  revalidatePath("/app/accounting");
  revalidatePath("/app/invoices");
}

export async function payPayroll(formData: FormData) {
  const user = await requireModule("hr");
  const payrollId = String(formData.get("payrollId"));

  const payroll = await db.payroll.findFirst({
    where: { id: payrollId, employee: { clubId: user.clubId! } },
    include: { employee: true },
  });
  if (!payroll || payroll.status === "paid") return;

  await db.payroll.update({
    where: { id: payrollId },
    data: { status: "paid", paidAt: new Date() },
  });
  // صرف الراتب يُقيَّد مصروفاً تلقائياً
  const salaryExpense = await db.expense.create({
    data: {
      clubId: user.clubId!,
      category: "رواتب",
      description: `راتب ${payroll.employee.name} — ${payroll.month}`,
      amountSAR: payroll.netSAR,
    },
  });
  await postExpense(salaryExpense.id);

  revalidatePath("/app/hr");
  revalidatePath("/app/accounting");
}

export async function decideLeave(formData: FormData) {
  const user = await requireModule("hr");
  const leaveId = String(formData.get("leaveId"));
  const decision = String(formData.get("decision"));
  if (!["approved", "rejected"].includes(decision)) return;

  const leave = await db.leave.findFirst({
    where: { id: leaveId, employee: { clubId: user.clubId! } },
  });
  if (!leave) return;

  await db.leave.update({ where: { id: leaveId }, data: { status: decision } });
  revalidatePath("/app/hr");
}

// إصدار فاتورة يدوية (بيع منتج، خدمة، أو فاتورة B2B لشركة)
export async function createManualInvoice(formData: FormData) {
  const user = await requireModule("accounting");
  const description = String(formData.get("description") ?? "").trim();
  const totalWithVat = Number(formData.get("totalWithVat"));
  const invoiceType = String(formData.get("invoiceType") ?? "simplified") as
    | "simplified"
    | "standard";
  const buyerName = String(formData.get("buyerName") ?? "").trim();
  const buyerVat = String(formData.get("buyerVat") ?? "").trim();
  const memberId = String(formData.get("memberId") ?? "");
  const status = String(formData.get("status") ?? "paid") as "paid" | "unpaid";
  const method = String(formData.get("method") ?? "cash");
  const qty = Math.max(1, Number(formData.get("qty")) || 1);

  if (!description || !Number.isFinite(totalWithVat) || totalWithVat <= 0) return;
  if (invoiceType === "standard" && !buyerName) return;

  await issueInvoice({
    clubId: user.clubId!,
    memberId: memberId || null,
    items: [{ description, qty, totalWithVat: totalWithVat * qty }],
    invoiceType,
    buyerName: buyerName || null,
    buyerVat: buyerVat || null,
    status,
    method,
  });

  revalidatePath("/app/invoices");
  revalidatePath("/app/accounting");
}
