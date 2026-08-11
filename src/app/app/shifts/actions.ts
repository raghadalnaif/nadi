"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { branchScope, requireModule } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { postEntry } from "@/lib/ledger";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const round = (n: number) => Math.round(n * 100) / 100;

const CASH_METHODS = ["cash"];
const CARD_METHODS = ["mada", "visa"];

// فتح وردية بعهدة افتتاحية
export async function openShift(formData: FormData) {
  const user = await requireModule("shifts");
  const openingFloatSAR = Math.max(0, Number(formData.get("openingFloatSAR")) || 0);

  const already = await db.cashShift.findFirst({
    where: { clubId: user.clubId!, userId: user.id, status: "open" },
  });
  if (already) return;

  await db.cashShift.create({
    data: {
      clubId: user.clubId!,
      branchId: branchScope(user),
      userId: user.id,
      userName: user.name,
      openingFloatSAR,
    },
  });

  await audit({ user, action: "create", entity: "shift", summary: `فتح وردية بعهدة ${openingFloatSAR} ر.س` });
  revalidatePath("/app/shifts");
}

// تقفيل الوردية: يقارن النقد المعدود بالمتوقع ويقيّد الفرق محاسبياً
export async function closeShift(formData: FormData) {
  const user = await requireModule("shifts");
  const id = str(formData, "shiftId");
  const countedCashSAR = Math.max(0, Number(formData.get("countedCashSAR")) || 0);
  const note = str(formData, "note") || null;

  const shift = await db.cashShift.findFirst({
    where: { id, clubId: user.clubId!, status: "open" },
  });
  if (!shift) return;

  // كل المدفوعات المسجلة خلال الوردية
  const payments = await db.payment.findMany({
    where: {
      invoice: { clubId: user.clubId! },
      paidAt: { gte: shift.openedAt },
    },
    include: { invoice: { select: { branchId: true, docType: true } } },
  });

  const scoped = payments.filter(
    (p) => (!shift.branchId || p.invoice.branchId === shift.branchId) && p.invoice.docType === "invoice"
  );

  const cashTotal = round(
    scoped.filter((p) => CASH_METHODS.includes(p.method)).reduce((s, p) => s + p.amountSAR, 0)
  );
  const cardTotal = round(
    scoped.filter((p) => CARD_METHODS.includes(p.method)).reduce((s, p) => s + p.amountSAR, 0)
  );
  const otherTotal = round(
    scoped
      .filter((p) => !CASH_METHODS.includes(p.method) && !CARD_METHODS.includes(p.method))
      .reduce((s, p) => s + p.amountSAR, 0)
  );

  const expectedCashSAR = round(shift.openingFloatSAR + cashTotal);
  const varianceSAR = round(countedCashSAR - expectedCashSAR);

  await db.cashShift.update({
    where: { id },
    data: {
      status: "closed",
      closedAt: new Date(),
      countedCashSAR,
      expectedCashSAR,
      varianceSAR,
      cardTotalSAR: cardTotal,
      otherTotalSAR: otherTotal,
      invoiceCount: scoped.length,
      note,
    },
  });

  // فرق الصندوق يُقيَّد فوراً حتى تبقى الدفاتر صحيحة
  if (Math.abs(varianceSAR) >= 0.5) {
    await postEntry({
      clubId: user.clubId!,
      date: new Date(),
      memo: `فرق صندوق — وردية ${user.name}`,
      source: "manual",
      refId: id,
      createdBy: user.name,
      lines:
        varianceSAR > 0
          ? [
              { code: "1010", debit: varianceSAR, memo: "زيادة نقدية" },
              { code: "4030", credit: varianceSAR, memo: "إيراد فرق صندوق" },
            ]
          : [
              { code: "5090", debit: -varianceSAR, memo: "عجز صندوق" },
              { code: "1010", credit: -varianceSAR, memo: "نقص نقدي" },
            ],
    });
  }

  await audit({
    user,
    action: "update",
    entity: "shift",
    entityId: id,
    summary: `تقفيل وردية: متوقع ${expectedCashSAR} · معدود ${countedCashSAR} · فرق ${varianceSAR}`,
  });

  revalidatePath("/app/shifts");
  revalidatePath("/app/accounting");
}
