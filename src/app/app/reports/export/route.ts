import { db } from "@/lib/db";
import { requireModule } from "@/lib/auth";

const csvCell = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const csvRow = (cells: unknown[]) => cells.map(csvCell).join(",");

// تصدير تقرير مالي شامل بصيغة CSV — يفتح مباشرة في Excel
export async function GET() {
  const user = await requireModule("reports");
  const clubId = user.clubId!;

  const [club, invoices, expenses] = await Promise.all([
    db.club.findUnique({ where: { id: clubId } }),
    db.invoice.findMany({
      where: { clubId },
      include: { member: true, payments: true },
      orderBy: { icv: "asc" },
    }),
    db.expense.findMany({ where: { clubId }, orderBy: { spentAt: "asc" } }),
  ]);

  const lines: string[] = [];
  lines.push(csvRow([`تقرير مالي — ${club?.name ?? ""}`]));
  lines.push(csvRow([`تاريخ التصدير`, new Date().toISOString().slice(0, 16).replace("T", " ")]));
  lines.push("");

  lines.push(csvRow(["الفواتير"]));
  lines.push(
    csvRow(["الرقم", "العدّاد", "النوع", "التاريخ", "العميل", "قبل الضريبة", "الضريبة", "الإجمالي", "الحالة", "طريقة الدفع"])
  );
  for (const inv of invoices) {
    lines.push(
      csvRow([
        inv.number,
        inv.icv,
        inv.invoiceType === "standard" ? "ضريبية" : "مبسطة",
        inv.issuedAt.toISOString().slice(0, 10),
        inv.buyerName ?? inv.member?.name ?? "عميل نقدي",
        inv.subtotalSAR.toFixed(2),
        inv.vatSAR.toFixed(2),
        inv.totalSAR.toFixed(2),
        inv.status === "paid" ? "مدفوعة" : "غير مدفوعة",
        inv.payments[0]?.method ?? "",
      ])
    );
  }

  lines.push("");
  lines.push(csvRow(["المصروفات"]));
  lines.push(csvRow(["التاريخ", "البند", "الوصف", "المبلغ"]));
  for (const e of expenses) {
    lines.push(
      csvRow([e.spentAt.toISOString().slice(0, 10), e.category, e.description, e.amountSAR.toFixed(2)])
    );
  }

  const revenue = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.totalSAR, 0);
  const vat = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.vatSAR, 0);
  const cost = expenses.reduce((s, e) => s + e.amountSAR, 0);

  lines.push("");
  lines.push(csvRow(["الملخص"]));
  lines.push(csvRow(["إجمالي الإيرادات المحصّلة", revenue.toFixed(2)]));
  lines.push(csvRow(["إجمالي الضريبة", vat.toFixed(2)]));
  lines.push(csvRow(["إجمالي المصروفات", cost.toFixed(2)]));
  lines.push(csvRow(["صافي الربح", (revenue - cost).toFixed(2)]));

  // BOM ليقرأ Excel العربية بشكل صحيح
  const body = "﻿" + lines.join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="report-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
