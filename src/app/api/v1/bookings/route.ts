import { db } from "@/lib/db";
import { apiError, json, withApi } from "@/lib/api-auth";

// POST /api/v1/bookings — حجز حصة من تطبيق خارجي
// السعة مصدرها النظام وحده، فلا يقع حجز مزدوج بين القنوات.
// body: { sessionId, memberId, source? }
export async function POST(req: Request) {
  return withApi(req, "write", async (ctx) => {
    const body = await req.json().catch(() => null);
    if (!body?.sessionId || !body?.memberId) {
      return apiError("الحقول sessionId و memberId مطلوبة", 422, "validation_error");
    }

    const member = await db.member.findFirst({
      where: { id: String(body.memberId), clubId: ctx.clubId },
      include: { subscriptions: { orderBy: { endsAt: "desc" }, take: 1 } },
    });
    if (!member) return apiError("العضو غير موجود", 404, "member_not_found");

    const sub = member.subscriptions[0];
    if (!sub || sub.endsAt < new Date() || sub.status !== "active") {
      return apiError("لا يمكن الحجز — الاشتراك غير فعّال", 403, "subscription_inactive");
    }

    const session = await db.classSession.findFirst({
      where: { id: String(body.sessionId), gymClass: { clubId: ctx.clubId } },
      include: {
        gymClass: true,
        _count: { select: { bookings: { where: { status: "booked" } } } },
      },
    });
    if (!session) return apiError("الحصة غير موجودة", 404, "session_not_found");
    if (session.startsAt < new Date()) return apiError("انتهت هذه الحصة", 409, "session_past");

    const existing = await db.booking.findUnique({
      where: { sessionId_memberId: { sessionId: session.id, memberId: member.id } },
    });
    if (existing) return apiError("العضو محجوز مسبقاً في هذه الحصة", 409, "already_booked");

    const allowed = ["app", "urpass", "website", "partner"];
    const source = allowed.includes(String(body.source)) ? String(body.source) : "app";
    const status = session._count.bookings < session.capacity ? "booked" : "waitlist";

    const booking = await db.booking.create({
      data: { sessionId: session.id, memberId: member.id, status, source },
    });

    return json(
      {
        booking: {
          id: booking.id,
          status, // booked = مؤكد | waitlist = قائمة انتظار
          className: session.gymClass.name,
          startsAt: session.startsAt,
          memberName: member.name,
        },
      },
      201
    );
  });
}

// DELETE /api/v1/bookings?id=  — إلغاء حجز مع ترقية قائمة الانتظار
export async function DELETE(req: Request) {
  return withApi(req, "write", async (ctx) => {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return apiError("المعامل id مطلوب", 422, "validation_error");

    const booking = await db.booking.findFirst({
      where: { id, member: { clubId: ctx.clubId } },
    });
    if (!booking) return apiError("الحجز غير موجود", 404, "booking_not_found");

    await db.booking.delete({ where: { id } });

    let promoted = null;
    if (booking.status === "booked") {
      const next = await db.booking.findFirst({
        where: { sessionId: booking.sessionId, status: "waitlist" },
        orderBy: { createdAt: "asc" },
        include: { member: true },
      });
      if (next) {
        await db.booking.update({ where: { id: next.id }, data: { status: "booked" } });
        promoted = { bookingId: next.id, memberName: next.member.name, phone: next.member.phone };
      }
    }

    return json({ cancelled: true, promotedFromWaitlist: promoted });
  });
}
