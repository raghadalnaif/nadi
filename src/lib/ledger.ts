import { db } from "./db";

// ═══════════════════════════════════════════════════════════
// المحرك المحاسبي — قيد مزدوج
// كل حركة مالية في النظام تُرحَّل هنا تلقائياً بقيد متوازن.
// ═══════════════════════════════════════════════════════════

// دليل الحسابات الافتراضي — مبني على تسلسل رباعي متعارف عليه
export const DEFAULT_CHART: {
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "revenue" | "expense";
  isCash?: boolean;
}[] = [
  // الأصول
  { code: "1010", name: "الصندوق", type: "asset", isCash: true },
  { code: "1020", name: "البنك — مدى وشبكة", type: "asset", isCash: true },
  { code: "1030", name: "محافظ الدفع الآجل (تابي/تمارا)", type: "asset", isCash: true },
  { code: "1100", name: "ذمم العملاء المدينة", type: "asset" },
  { code: "1200", name: "أصول ثابتة — أجهزة رياضية", type: "asset" },
  // الالتزامات
  { code: "2100", name: "ضريبة القيمة المضافة المستحقة", type: "liability" },
  { code: "2200", name: "رواتب مستحقة", type: "liability" },
  { code: "2300", name: "إيرادات مقدمة (اشتراكات غير مكتسبة)", type: "liability" },
  // حقوق الملكية
  { code: "3100", name: "رأس المال", type: "equity" },
  { code: "3200", name: "الأرباح المبقاة", type: "equity" },
  // الإيرادات
  { code: "4010", name: "إيرادات الاشتراكات", type: "revenue" },
  { code: "4020", name: "إيرادات الحصص والتدريب", type: "revenue" },
  { code: "4030", name: "إيرادات أخرى", type: "revenue" },
  { code: "4090", name: "خصومات ممنوحة", type: "revenue" },
  // المصروفات
  { code: "5010", name: "الرواتب والأجور", type: "expense" },
  { code: "5020", name: "الإيجار", type: "expense" },
  { code: "5030", name: "المرافق (كهرباء ومياه)", type: "expense" },
  { code: "5040", name: "الصيانة", type: "expense" },
  { code: "5050", name: "التسويق والإعلان", type: "expense" },
  { code: "5090", name: "مصروفات أخرى", type: "expense" },
];

// ربط بنود المصروفات في الواجهة بحسابات الدليل
const EXPENSE_ACCOUNT: Record<string, string> = {
  رواتب: "5010",
  إيجار: "5020",
  مرافق: "5030",
  صيانة: "5040",
  تسويق: "5050",
  أخرى: "5090",
};

// ربط طرق الدفع بالحسابات النقدية
const PAYMENT_ACCOUNT: Record<string, string> = {
  cash: "1010",
  mada: "1020",
  visa: "1020",
  transfer: "1020",
  tabby: "1030",
  tamara: "1030",
};

export async function ensureChart(clubId: string) {
  const count = await db.account.count({ where: { clubId } });
  if (count > 0) return;

  await db.account.createMany({
    data: DEFAULT_CHART.map((a) => ({
      clubId,
      code: a.code,
      name: a.name,
      type: a.type,
      isCash: a.isCash ?? false,
    })),
  });
}

async function accountId(clubId: string, code: string) {
  const acc = await db.account.findUnique({ where: { clubId_code: { clubId, code } } });
  if (acc) return acc.id;
  // حساب مفقود من الدليل — ننشئه ضمن «أخرى» حتى لا يسقط القيد
  const fallback = DEFAULT_CHART.find((a) => a.code === code);
  const created = await db.account.create({
    data: {
      clubId,
      code,
      name: fallback?.name ?? `حساب ${code}`,
      type: fallback?.type ?? "expense",
      isCash: fallback?.isCash ?? false,
    },
  });
  return created.id;
}

const round = (n: number) => Math.round(n * 100) / 100;

// إنشاء قيد يومية متوازن — يرفض القيد غير المتوازن
export async function postEntry(input: {
  clubId: string;
  date: Date;
  memo: string;
  source: string;
  refId?: string;
  createdBy?: string;
  lines: { code: string; debit?: number; credit?: number; memo?: string }[];
}) {
  await ensureChart(input.clubId);

  const totalDebit = round(input.lines.reduce((s, l) => s + (l.debit ?? 0), 0));
  const totalCredit = round(input.lines.reduce((s, l) => s + (l.credit ?? 0), 0));

  if (totalDebit === 0 && totalCredit === 0) return null;
  if (Math.abs(totalDebit - totalCredit) > 0.02) {
    throw new Error(
      `قيد غير متوازن: مدين ${totalDebit} ≠ دائن ${totalCredit} (${input.memo})`
    );
  }

  const last = await db.journalEntry.findFirst({
    where: { clubId: input.clubId },
    orderBy: { number: "desc" },
    select: { number: true },
  });

  const resolved = await Promise.all(
    input.lines.map(async (l) => ({
      accountId: await accountId(input.clubId, l.code),
      debitSAR: round(l.debit ?? 0),
      creditSAR: round(l.credit ?? 0),
      memo: l.memo ?? null,
    }))
  );

  return db.journalEntry.create({
    data: {
      clubId: input.clubId,
      number: (last?.number ?? 0) + 1,
      date: input.date,
      memo: input.memo,
      source: input.source,
      refId: input.refId,
      createdBy: input.createdBy,
      lines: { create: resolved.filter((l) => l.debitSAR > 0 || l.creditSAR > 0) },
    },
  });
}

// ───────── الترحيل التلقائي للمستندات ─────────

// فاتورة مبيعات: مدين ذمم/نقد — دائن إيراد + ضريبة مستحقة
export async function postInvoice(invoiceId: string) {
  const inv = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: { payments: true, member: true, subscription: true },
  });
  if (!inv) return;

  const paid = inv.status === "paid" && inv.payments.length > 0;
  const cashCode = paid ? PAYMENT_ACCOUNT[inv.payments[0].method] ?? "1010" : null;
  const revenueCode = inv.subscriptionId ? "4010" : "4030";
  const who = inv.buyerName ?? inv.member?.name ?? "عميل نقدي";

  if (inv.docType === "credit_note") {
    // إشعار دائن: عكس القيد — نرد المبلغ ونخفّض الإيراد والضريبة
    await postEntry({
      clubId: inv.clubId,
      date: inv.issuedAt,
      memo: `إشعار دائن ${inv.number} — ${who}`,
      source: "credit_note",
      refId: inv.id,
      lines: [
        { code: revenueCode, debit: inv.subtotalSAR, memo: "تخفيض إيراد" },
        { code: "2100", debit: inv.vatSAR, memo: "تخفيض ضريبة مستحقة" },
        { code: cashCode ?? "1100", credit: inv.totalSAR, memo: "رد للعميل" },
      ],
    });
    return;
  }

  await postEntry({
    clubId: inv.clubId,
    date: inv.issuedAt,
    memo: `فاتورة ${inv.number} — ${who}`,
    source: "invoice",
    refId: inv.id,
    lines: [
      paid
        ? { code: cashCode!, debit: inv.totalSAR, memo: "تحصيل" }
        : { code: "1100", debit: inv.totalSAR, memo: "ذمة على العميل" },
      { code: revenueCode, credit: inv.subtotalSAR, memo: "إيراد" },
      { code: "2100", credit: inv.vatSAR, memo: "ضريبة القيمة المضافة 15%" },
    ],
  });
}

// تحصيل فاتورة آجلة: مدين نقد — دائن ذمم
export async function postPayment(invoiceId: string, method: string, amount: number) {
  const inv = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: { member: true },
  });
  if (!inv) return;

  await postEntry({
    clubId: inv.clubId,
    date: new Date(),
    memo: `تحصيل فاتورة ${inv.number} — ${inv.member?.name ?? "عميل"}`,
    source: "payment",
    refId: inv.id,
    lines: [
      { code: PAYMENT_ACCOUNT[method] ?? "1010", debit: amount, memo: "تحصيل" },
      { code: "1100", credit: amount, memo: "إقفال ذمة" },
    ],
  });
}

// مصروف: مدين حساب المصروف — دائن الصندوق
export async function postExpense(expenseId: string) {
  const exp = await db.expense.findUnique({ where: { id: expenseId } });
  if (!exp) return;

  await postEntry({
    clubId: exp.clubId,
    date: exp.spentAt,
    memo: `${exp.category} — ${exp.description}`,
    source: "expense",
    refId: exp.id,
    lines: [
      { code: EXPENSE_ACCOUNT[exp.category] ?? "5090", debit: exp.amountSAR },
      { code: "1010", credit: exp.amountSAR, memo: "صرف نقدي" },
    ],
  });
}

// ───────── التقارير المالية ─────────

export type TrialRow = {
  code: string;
  name: string;
  type: string;
  debit: number;
  credit: number;
  balance: number; // موجب = رصيد مدين، سالب = رصيد دائن
};

export async function trialBalance(clubId: string, from?: Date, to?: Date) {
  const accounts = await db.account.findMany({
    where: { clubId },
    orderBy: { code: "asc" },
    include: {
      lines: {
        where: { entry: { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } },
        select: { debitSAR: true, creditSAR: true },
      },
    },
  });

  const rows: TrialRow[] = accounts
    .map((a) => {
      const debit = round(a.lines.reduce((s, l) => s + l.debitSAR, 0));
      const credit = round(a.lines.reduce((s, l) => s + l.creditSAR, 0));
      return { code: a.code, name: a.name, type: a.type, debit, credit, balance: round(debit - credit) };
    })
    .filter((r) => r.debit !== 0 || r.credit !== 0);

  return {
    rows,
    totalDebit: round(rows.reduce((s, r) => s + r.debit, 0)),
    totalCredit: round(rows.reduce((s, r) => s + r.credit, 0)),
  };
}

// قائمة الدخل: الإيرادات ناقص المصروفات
export async function incomeStatement(clubId: string, from: Date, to: Date) {
  const { rows } = await trialBalance(clubId, from, to);
  const revenue = rows.filter((r) => r.type === "revenue").map((r) => ({ ...r, amount: -r.balance }));
  const expenses = rows.filter((r) => r.type === "expense").map((r) => ({ ...r, amount: r.balance }));

  const totalRevenue = round(revenue.reduce((s, r) => s + r.amount, 0));
  const totalExpenses = round(expenses.reduce((s, r) => s + r.amount, 0));

  return { revenue, expenses, totalRevenue, totalExpenses, netIncome: round(totalRevenue - totalExpenses) };
}

// الميزانية العمومية: الأصول = الالتزامات + حقوق الملكية + صافي الدخل
export async function balanceSheet(clubId: string, asOf: Date) {
  const { rows } = await trialBalance(clubId, undefined, asOf);
  const assets = rows.filter((r) => r.type === "asset").map((r) => ({ ...r, amount: r.balance }));
  const liabilities = rows.filter((r) => r.type === "liability").map((r) => ({ ...r, amount: -r.balance }));
  const equity = rows.filter((r) => r.type === "equity").map((r) => ({ ...r, amount: -r.balance }));

  const totalAssets = round(assets.reduce((s, r) => s + r.amount, 0));
  const totalLiabilities = round(liabilities.reduce((s, r) => s + r.amount, 0));
  const totalEquity = round(equity.reduce((s, r) => s + r.amount, 0));

  const revenue = rows.filter((r) => r.type === "revenue").reduce((s, r) => s + -r.balance, 0);
  const expenses = rows.filter((r) => r.type === "expense").reduce((s, r) => s + r.balance, 0);
  const retained = round(revenue - expenses);

  return {
    assets,
    liabilities,
    equity,
    totalAssets,
    totalLiabilities,
    totalEquity,
    retainedEarnings: retained,
    balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity + retained)) < 0.5,
  };
}

// الإقرار الضريبي — ضريبة المبيعات المستحقة خلال الفترة
export async function vatReturn(clubId: string, from: Date, to: Date) {
  const invoices = await db.invoice.findMany({
    where: { clubId, issuedAt: { gte: from, lte: to } },
    select: { docType: true, subtotalSAR: true, vatSAR: true, totalSAR: true },
  });

  const sales = invoices.filter((i) => i.docType !== "credit_note");
  const credits = invoices.filter((i) => i.docType === "credit_note");

  const salesBase = round(sales.reduce((s, i) => s + i.subtotalSAR, 0));
  const salesVat = round(sales.reduce((s, i) => s + i.vatSAR, 0));
  const creditBase = round(credits.reduce((s, i) => s + i.subtotalSAR, 0));
  const creditVat = round(credits.reduce((s, i) => s + i.vatSAR, 0));

  return {
    salesBase,
    salesVat,
    creditBase,
    creditVat,
    netBase: round(salesBase - creditBase),
    netVat: round(salesVat - creditVat),
    invoiceCount: sales.length,
    creditNoteCount: credits.length,
  };
}

// أعمار الذمم — من عليه فلوس ومنذ متى
export async function receivablesAging(clubId: string) {
  const unpaid = await db.invoice.findMany({
    where: { clubId, status: "unpaid", docType: "invoice" },
    include: { member: true },
    orderBy: { issuedAt: "asc" },
  });

  const now = Date.now();
  const buckets = { current: 0, d30: 0, d60: 0, d90: 0 };

  const rows = unpaid.map((inv) => {
    const days = Math.floor((now - inv.issuedAt.getTime()) / 86400000);
    if (days <= 30) buckets.current += inv.totalSAR;
    else if (days <= 60) buckets.d30 += inv.totalSAR;
    else if (days <= 90) buckets.d60 += inv.totalSAR;
    else buckets.d90 += inv.totalSAR;

    return {
      id: inv.id,
      number: inv.number,
      customer: inv.buyerName ?? inv.member?.name ?? "عميل نقدي",
      phone: inv.member?.phone ?? null,
      issuedAt: inv.issuedAt,
      days,
      amount: inv.totalSAR,
    };
  });

  return {
    rows,
    buckets: {
      current: round(buckets.current),
      d30: round(buckets.d30),
      d60: round(buckets.d60),
      d90: round(buckets.d90),
    },
    total: round(rows.reduce((s, r) => s + r.amount, 0)),
  };
}
