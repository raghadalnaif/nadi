import { db } from "@/lib/db";
import { apiError, json, withApi } from "@/lib/api-auth";
import { issueInvoice } from "@/lib/invoicing";

// POST /api/v1/subscriptions
// يسجّل اشتراكاً من تطبيق خارجي (تطبيق الجوال، UrPass، موقع النادي)
// ويُصدر فاتورة ضريبية مرتبطة بسلسلة ZATCA تلقائياً.
//
// body: { memberId? , member?: {name, phone}, planId, offerCode?, source?, paid? }
export async function POST(req: Request) {
  return withApi(req, "write", async (ctx) => {
    const body = await req.json().catch(() => null);
    if (!body?.planId) return apiError("الحقل planId مطلوب", 422, "validation_error");

    const plan = await db.plan.findFirst({
      where: { id: String(body.planId), clubId: ctx.clubId, active: true },
    });
    if (!plan) return apiError("الباقة غير موجودة أو غير مفعّلة", 404, "plan_not_found");

    // إمّا عضو موجود، أو ننشئه من بيانات الطلب
    let memberId = body.memberId ? String(body.memberId) : "";
    if (memberId) {
      const found = await db.member.findFirst({ where: { id: memberId, clubId: ctx.clubId } });
      if (!found) return apiError("العضو غير موجود", 404, "member_not_found");
    } else if (body.member?.name && body.member?.phone) {
      const phone = String(body.member.phone).trim();
      const existing = await db.member.findFirst({ where: { clubId: ctx.clubId, phone } });
      if (existing) {
        memberId = existing.id;
      } else {
        const last = await db.member.findFirst({
          where: { clubId: ctx.clubId },
          orderBy: { memberNo: "desc" },
        });
        const memberNo = (last?.memberNo ?? 1000) + 1;
        const created = await db.member.create({
          data: {
            clubId: ctx.clubId,
            name: String(body.member.name).trim(),
            phone,
            memberNo,
            barcode: `M${memberNo}${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
          },
        });
        memberId = created.id;
      }
    } else {
      return apiError("مطلوب memberId أو بيانات member (name, phone)", 422, "validation_error");
    }

    // كود الخصم — نفس قواعد الواجهة
    let discountSAR = 0;
    let offerId: string | null = null;
    const code = String(body.offerCode ?? "").trim().toUpperCase();
    if (code) {
      const now = new Date();
      const offer = await db.offer.findFirst({
        where: {
          clubId: ctx.clubId,
          code,
          active: true,
          startsAt: { lte: now },
          endsAt: { gte: now },
          OR: [{ planId: null }, { planId: plan.id }],
        },
      });
      if (offer && (offer.maxUses === 0 || offer.usedCount < offer.maxUses)) {
        const raw = offer.kind === "percent" ? (plan.priceSAR * offer.value) / 100 : offer.value;
        discountSAR = Math.min(plan.priceSAR, Math.round(raw * 100) / 100);
        offerId = offer.id;
        await db.offer.update({ where: { id: offer.id }, data: { usedCount: { increment: 1 } } });
      }
    }

    const finalPrice = Math.round((plan.priceSAR - discountSAR) * 100) / 100;

    // الاشتراك الجديد يبدأ بعد الحالي إن كان ساريًا
    const current = await db.subscription.findFirst({
      where: { memberId, status: "active" },
      orderBy: { endsAt: "desc" },
    });
    const startsAt = current && current.endsAt > new Date() ? current.endsAt : new Date();
    const endsAt = new Date(startsAt);
    endsAt.setDate(endsAt.getDate() + plan.durationDays);

    const allowed = ["app", "urpass", "reception", "website", "partner"];
    const source = allowed.includes(String(body.source)) ? String(body.source) : "app";

    const sub = await db.subscription.create({
      data: { memberId, planId: plan.id, startsAt, endsAt, paidSAR: finalPrice, discountSAR, offerId, source },
    });

    const invoice = await issueInvoice({
      clubId: ctx.clubId,
      memberId,
      subscriptionId: sub.id,
      items: [{ description: `اشتراك ${plan.name}`, totalWithVat: finalPrice }],
      status: body.paid === false ? "unpaid" : "paid",
      method: typeof body.method === "string" ? body.method : "app",
    });

    const member = await db.member.findUnique({ where: { id: memberId } });

    return json(
      {
        subscription: {
          id: sub.id,
          startsAt: sub.startsAt,
          endsAt: sub.endsAt,
          plan: plan.name,
          priceSAR: plan.priceSAR,
          discountSAR,
          paidSAR: finalPrice,
          source,
        },
        member: { id: member!.id, name: member!.name, memberNo: member!.memberNo, barcode: member!.barcode },
        invoice: { number: invoice.number, totalSAR: invoice.totalSAR, vatSAR: invoice.vatSAR },
      },
      201
    );
  });
}

// GET /api/v1/subscriptions?status=active — قائمة الاشتراكات
export async function GET(req: Request) {
  return withApi(req, "read", async (ctx) => {
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const now = new Date();

    const subs = await db.subscription.findMany({
      where: {
        member: { clubId: ctx.clubId },
        ...(status === "active" ? { status: "active", endsAt: { gte: now } } : {}),
        ...(status === "expired" ? { status: "active", endsAt: { lt: now } } : {}),
        ...(status === "frozen" ? { status: "frozen" } : {}),
      },
      include: { member: true, plan: true },
      orderBy: { endsAt: "desc" },
      take: 100,
    });

    return json({
      count: subs.length,
      subscriptions: subs.map((s) => ({
        id: s.id,
        memberId: s.memberId,
        memberName: s.member.name,
        plan: s.plan.name,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        paidSAR: s.paidSAR,
        discountSAR: s.discountSAR,
        status: s.status,
        source: s.source,
      })),
    });
  });
}
