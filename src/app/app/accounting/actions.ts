"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { ensureChart, postEntry, postInvoice } from "@/lib/ledger";
import { GENESIS_PIH, sealInvoice } from "@/lib/zatca";

// إشعار دائن — إلزامي من الهيئة لأي استرجاع أو إلغاء فاتورة.
// يُصدر كمستند مستقل في نفس سلسلة ZATCA برمز نوع 381.
export async function issueCreditNote(formData: FormData) {
  const user = await requireModule("accounting");
  const invoiceId = String(formData.get("invoiceId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || "استرجاع";

  const original = await db.invoice.findFirst({
    where: { id: invoiceId, clubId: user.clubId!, docType: "invoice" },
    include: { club: true, member: true, items: true },
  });
  if (!original) return;

  // لا نصدر إشعارين لنفس الفاتورة
  const existing = await db.invoice.findFirst({
    where: { clubId: user.clubId!, docType: "credit_note", refInvoiceId: invoiceId },
  });
  if (existing) return;

  const last = await db.invoice.findFirst({
    where: { clubId: user.clubId! },
    orderBy: { icv: "desc" },
    select: { icv: true, hash: true },
  });

  const icv = (last?.icv ?? 0) + 1;
  const pih = last?.hash ?? GENESIS_PIH;
  const number = `CN-${String(icv).padStart(5, "0")}`;
  const uuid = crypto.randomUUID();
  const issuedAt = new Date();

  const { xml, hash, qrTLV } = sealInvoice({
    number,
    uuid,
    issuedAt,
    icv,
    pih,
    invoiceType: original.invoiceType as "simplified" | "standard",
    seller: {
      name: original.club.name,
      vatNumber: original.club.vatNumber ?? "",
      crNumber: original.club.crNumber,
      address: original.club.address,
    },
    buyerName: original.buyerName,
    buyerVat: original.buyerVat,
    items: original.items.map((i) => ({
      description: `إشعار دائن: ${i.description}`,
      qty: i.qty,
      unitPriceSAR: i.unitPriceSAR,
    })),
    subtotalSAR: original.subtotalSAR,
    vatSAR: original.vatSAR,
    totalSAR: original.totalSAR,
  });

  const note = await db.invoice.create({
    data: {
      clubId: user.clubId!,
      memberId: original.memberId,
      number,
      uuid,
      issuedAt,
      subtotalSAR: original.subtotalSAR,
      vatSAR: original.vatSAR,
      totalSAR: original.totalSAR,
      status: "paid",
      qrTLV,
      docType: "credit_note",
      refInvoiceId: original.id,
      invoiceType: original.invoiceType,
      buyerName: original.buyerName,
      buyerVat: original.buyerVat,
      icv,
      pih,
      hash,
      xml,
      items: {
        create: original.items.map((i) => ({
          description: `إشعار دائن: ${i.description}`,
          qty: i.qty,
          unitPriceSAR: i.unitPriceSAR,
        })),
      },
    },
  });

  await db.invoice.update({ where: { id: original.id }, data: { status: "refunded" } });
  await postInvoice(note.id);

  await audit({
    user,
    action: "create",
    entity: "credit_note",
    entityId: note.id,
    summary: `إشعار دائن ${number} على الفاتورة ${original.number} — ${reason}`,
  });

  revalidatePath("/app/invoices");
  revalidatePath("/app/accounting");
}

// قيد يدوي — للحالات التي لا يغطيها الترحيل التلقائي
export async function addManualEntry(formData: FormData) {
  const user = await requireModule("accounting");
  await ensureChart(user.clubId!);

  const memo = String(formData.get("memo") ?? "").trim();
  const debitCode = String(formData.get("debitCode") ?? "");
  const creditCode = String(formData.get("creditCode") ?? "");
  const amount = Number(formData.get("amount"));

  if (!memo || !debitCode || !creditCode || !(amount > 0)) return;
  if (debitCode === creditCode) return;

  await postEntry({
    clubId: user.clubId!,
    date: new Date(),
    memo,
    source: "manual",
    createdBy: user.name,
    lines: [
      { code: debitCode, debit: amount },
      { code: creditCode, credit: amount },
    ],
  });

  await audit({ user, action: "create", entity: "journal_entry", summary: `قيد يدوي: ${memo} بمبلغ ${amount} ر.س` });
  revalidatePath("/app/accounting/journal");
  revalidatePath("/app/accounting");
}

// إعادة ترحيل كل المستندات — لبناء الدفاتر من بيانات موجودة
export async function rebuildLedger() {
  const user = await requireModule("accounting");
  const clubId = user.clubId!;

  await db.journalLine.deleteMany({ where: { entry: { clubId } } });
  await db.journalEntry.deleteMany({ where: { clubId } });
  await ensureChart(clubId);

  const invoices = await db.invoice.findMany({
    where: { clubId },
    orderBy: { icv: "asc" },
    select: { id: true },
  });
  for (const inv of invoices) await postInvoice(inv.id);

  const expenses = await db.expense.findMany({
    where: { clubId },
    orderBy: { spentAt: "asc" },
    select: { id: true },
  });
  const { postExpense } = await import("@/lib/ledger");
  for (const e of expenses) await postExpense(e.id);

  await audit({
    user,
    action: "update",
    entity: "ledger",
    summary: `إعادة ترحيل الدفاتر: ${invoices.length} فاتورة و${expenses.length} مصروف`,
  });

  revalidatePath("/app/accounting");
  revalidatePath("/app/accounting/journal");
}
