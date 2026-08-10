import { db } from "@/lib/db";
import { apiError, json, withApi } from "@/lib/api-auth";

// POST /api/v1/checkin
// يستقبل التحضير من الأجهزة: البصمة، الأساور، بوابة الدخول، أو التطبيق.
// body: { code, source }  — code = باركود أو رقم عضوية أو جوال
//
// الرد يحدد للجهاز: هل يفتح البوابة أم لا (allow).
export async function POST(req: Request) {
  return withApi(req, "checkin", async (ctx) => {
    const body = await req.json().catch(() => null);
    const code = String(body?.code ?? "").trim();
    if (!code) return apiError("الحقل code مطلوب", 422, "validation_error");

    const club = await db.club.findUnique({ where: { id: ctx.clubId } });
    if (!club) return apiError("النادي غير موجود", 404);

    const allowedSources: Record<string, boolean> = {
      fingerprint: club.checkinFingerprint,
      wristband: club.checkinWristband,
      gate: club.checkinGate,
      barcode: club.checkinBarcode,
      app: true,
    };
    const source = String(body?.source ?? "gate");
    if (!allowedSources[source]) {
      return apiError(`طريقة التحضير ${source} غير مفعّلة في إعدادات النادي`, 403, "method_disabled");
    }

    const member = await db.member.findFirst({
      where: {
        clubId: ctx.clubId,
        OR: [{ barcode: code }, { memberNo: Number(code) || -1 }, { phone: code }],
      },
      include: { subscriptions: { orderBy: { endsAt: "desc" }, take: 1, include: { plan: true } } },
    });

    if (!member) {
      return json({ allow: false, reason: "member_not_found", message: "لا يوجد عضو بهذا الرمز" }, 404);
    }

    const sub = member.subscriptions[0];
    const daysLeft = sub ? Math.ceil((sub.endsAt.getTime() - Date.now()) / 86400000) : -1;
    const blocked = club.blockExpiredEntry && (!sub || daysLeft <= 0 || sub.status === "frozen");

    if (blocked) {
      return json({
        allow: false,
        reason: sub?.status === "frozen" ? "subscription_frozen" : "subscription_expired",
        message: sub?.status === "frozen" ? "الاشتراك مجمّد" : "الاشتراك منتهٍ — يلزم التجديد",
        member: { id: member.id, name: member.name, memberNo: member.memberNo },
      });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const already = await db.attendance.findFirst({
      where: { memberId: member.id, checkedAt: { gte: todayStart } },
    });

    if (!already) {
      await db.attendance.create({ data: { memberId: member.id, source } });
    }

    return json({
      allow: true,
      duplicate: !!already,
      message: already ? "حاضر مسبقاً اليوم" : "تم التحضير",
      member: {
        id: member.id,
        name: member.name,
        memberNo: member.memberNo,
        plan: sub?.plan.name ?? null,
        daysLeft,
        expiringSoon: daysLeft > 0 && daysLeft <= 7,
      },
    });
  });
}
