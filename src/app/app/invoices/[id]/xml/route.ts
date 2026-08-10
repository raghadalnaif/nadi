import { db } from "@/lib/db";
import { requireModule } from "@/lib/auth";

// تنزيل مستند UBL 2.1 الخاص بالفاتورة — للتدقيق أو الرفع للهيئة
export async function GET(_req: Request, { params }: RouteContext<"/app/invoices/[id]/xml">) {
  const user = await requireModule("invoices");
  const { id } = await params;

  const invoice = await db.invoice.findFirst({
    where: { id, clubId: user.clubId! },
    select: { number: true, xml: true },
  });

  if (!invoice?.xml) {
    return new Response("لا يوجد مستند XML لهذه الفاتورة", { status: 404 });
  }

  return new Response(invoice.xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${invoice.number}.xml"`,
    },
  });
}
