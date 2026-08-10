import { db } from "./db";
import { GENESIS_PIH, sealInvoice, splitVat } from "./zatca";
import { postInvoice } from "./ledger";

// المُصدِر المركزي للفواتير — كل فاتورة في النظام تمر من هنا
// لتضمن تسلسل الأرقام، وتسلسل العدّاد (ICV)، وسلسلة الهاش (PIH).
export async function issueInvoice(input: {
  clubId: string;
  memberId?: string | null;
  subscriptionId?: string | null;
  items: { description: string; qty?: number; totalWithVat: number }[];
  invoiceType?: "simplified" | "standard";
  buyerName?: string | null;
  buyerVat?: string | null;
  status?: "paid" | "unpaid";
  method?: string;
  issuedAt?: Date; // للبيانات التاريخية — الافتراضي الآن
}) {
  const club = await db.club.findUnique({ where: { id: input.clubId } });
  if (!club) throw new Error("النادي غير موجود");

  // آخر فاتورة في هذا النادي تحدد العداد والهاش السابق
  const last = await db.invoice.findFirst({
    where: { clubId: club.id },
    orderBy: { icv: "desc" },
    select: { icv: true, hash: true },
  });

  const icv = (last?.icv ?? 0) + 1;
  const pih = last?.hash ?? GENESIS_PIH;
  const number = `INV-${String(icv).padStart(5, "0")}`;

  const lines = input.items.map((it) => {
    const qty = it.qty ?? 1;
    const money = splitVat(it.totalWithVat);
    return {
      description: it.description,
      qty,
      unitPriceSAR: money.subtotal / qty,
      subtotal: money.subtotal,
      vat: money.vat,
      total: money.total,
    };
  });

  const subtotalSAR = Math.round(lines.reduce((s, l) => s + l.subtotal, 0) * 100) / 100;
  const vatSAR = Math.round(lines.reduce((s, l) => s + l.vat, 0) * 100) / 100;
  const totalSAR = Math.round(lines.reduce((s, l) => s + l.total, 0) * 100) / 100;

  const uuid = crypto.randomUUID();
  const issuedAt = input.issuedAt ?? new Date();
  const invoiceType = input.invoiceType ?? "simplified";

  const { xml, hash, qrTLV } = sealInvoice({
    number,
    uuid,
    issuedAt,
    icv,
    pih,
    invoiceType,
    seller: {
      name: club.name,
      vatNumber: club.vatNumber ?? "",
      crNumber: club.crNumber,
      address: club.address,
    },
    buyerName: input.buyerName,
    buyerVat: input.buyerVat,
    items: lines.map((l) => ({ description: l.description, qty: l.qty, unitPriceSAR: l.unitPriceSAR })),
    subtotalSAR,
    vatSAR,
    totalSAR,
  });

  const status = input.status ?? "paid";

  const created = await db.invoice.create({
    data: {
      clubId: club.id,
      memberId: input.memberId ?? null,
      subscriptionId: input.subscriptionId ?? null,
      number,
      uuid,
      issuedAt,
      subtotalSAR,
      vatSAR,
      totalSAR,
      status,
      qrTLV,
      invoiceType,
      buyerName: input.buyerName ?? null,
      buyerVat: input.buyerVat ?? null,
      icv,
      pih,
      hash,
      xml,
      items: {
        create: lines.map((l) => ({
          description: l.description,
          qty: l.qty,
          unitPriceSAR: Math.round(l.unitPriceSAR * 100) / 100,
        })),
      },
      payments:
        status === "paid"
          ? { create: [{ method: input.method ?? "cash", amountSAR: totalSAR }] }
          : undefined,
    },
  });

  // ترحيل محاسبي تلقائي بقيد مزدوج
  await postInvoice(created.id);

  return created;
}

// يتحقق من سلامة سلسلة الفواتير — أي تلاعب يكسر الترابط
export async function verifyChain(clubId: string) {
  const invoices = await db.invoice.findMany({
    where: { clubId },
    orderBy: { icv: "asc" },
    select: { id: true, number: true, icv: true, pih: true, hash: true },
  });

  const breaks: { number: string; reason: string }[] = [];
  let expectedPih = GENESIS_PIH;

  for (const inv of invoices) {
    if (inv.pih !== expectedPih) {
      breaks.push({ number: inv.number, reason: "الهاش السابق لا يطابق سلسلة الفواتير" });
    }
    expectedPih = inv.hash ?? expectedPih;
  }

  return { total: invoices.length, breaks, intact: breaks.length === 0 };
}
