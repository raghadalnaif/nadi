import { db } from "@/lib/db";
import { json, withApi } from "@/lib/api-auth";

// GET /api/v1/plans — الباقات المتاحة للبيع في التطبيق
export async function GET(req: Request) {
  return withApi(req, "read", async (ctx) => {
    const plans = await db.plan.findMany({
      where: { clubId: ctx.clubId, active: true },
      orderBy: { durationDays: "asc" },
      select: { id: true, name: true, durationDays: true, priceSAR: true },
    });
    return json({ club: ctx.clubName, plans });
  });
}
