import { db } from "@/lib/db";
import { json, withApi } from "@/lib/api-auth";

// GET /api/v1/classes?days=7 — جدول الحصص مع السعة اللحظية
// هذا ما تقرأه المنصات الخارجية (UrPass وأمثالها) وتطبيق العضو.
export async function GET(req: Request) {
  return withApi(req, "read", async (ctx) => {
    const url = new URL(req.url);
    const days = Math.min(30, Math.max(1, Number(url.searchParams.get("days")) || 7));

    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from.getTime() + days * 86400000);

    const sessions = await db.classSession.findMany({
      where: { gymClass: { clubId: ctx.clubId }, startsAt: { gte: from, lt: to } },
      include: {
        gymClass: true,
        _count: { select: { bookings: { where: { status: "booked" } } } },
      },
      orderBy: { startsAt: "asc" },
    });

    return json({
      count: sessions.length,
      sessions: sessions.map((s) => ({
        sessionId: s.id,
        name: s.gymClass.name,
        coach: s.gymClass.coach,
        durationMin: s.gymClass.durationMin,
        startsAt: s.startsAt,
        capacity: s.capacity,
        booked: s._count.bookings,
        available: Math.max(0, s.capacity - s._count.bookings),
      })),
    });
  });
}
