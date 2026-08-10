import { db } from "@/lib/db";
import { apiError, json, withApi } from "@/lib/api-auth";

const shape = (m: {
  id: string;
  name: string;
  phone: string;
  memberNo: number;
  barcode: string | null;
  createdAt: Date;
  subscriptions?: { endsAt: Date; status: string; plan: { name: string } }[];
}) => {
  const sub = m.subscriptions?.[0];
  const daysLeft = sub ? Math.ceil((sub.endsAt.getTime() - Date.now()) / 86400000) : null;
  return {
    id: m.id,
    name: m.name,
    phone: m.phone,
    memberNo: m.memberNo,
    barcode: m.barcode,
    joinedAt: m.createdAt,
    subscription: sub
      ? {
          plan: sub.plan.name,
          endsAt: sub.endsAt,
          status: sub.status === "frozen" ? "frozen" : daysLeft! > 0 ? "active" : "expired",
          daysLeft,
        }
      : null,
  };
};

// GET /api/v1/members?q=&limit=  — قائمة الأعضاء مع حالة الاشتراك
export async function GET(req: Request) {
  return withApi(req, "read", async (ctx) => {
    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim() ?? "";
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 50));

    const members = await db.member.findMany({
      where: {
        clubId: ctx.clubId,
        ...(q ? { OR: [{ name: { contains: q } }, { phone: { contains: q } }] } : {}),
      },
      include: {
        subscriptions: { orderBy: { endsAt: "desc" }, take: 1, include: { plan: true } },
      },
      orderBy: { memberNo: "asc" },
      take: limit,
    });

    return json({ count: members.length, members: members.map(shape) });
  });
}

// POST /api/v1/members — تسجيل عضو من التطبيق (بلا اشتراك)
export async function POST(req: Request) {
  return withApi(req, "write", async (ctx) => {
    const body = await req.json().catch(() => null);
    if (!body?.name || !body?.phone) {
      return apiError("الحقول name و phone مطلوبة", 422, "validation_error");
    }

    const exists = await db.member.findFirst({
      where: { clubId: ctx.clubId, phone: String(body.phone) },
    });
    if (exists) return apiError("يوجد عضو بنفس رقم الجوال", 409, "duplicate_phone");

    const last = await db.member.findFirst({
      where: { clubId: ctx.clubId },
      orderBy: { memberNo: "desc" },
    });
    const memberNo = (last?.memberNo ?? 1000) + 1;

    const member = await db.member.create({
      data: {
        clubId: ctx.clubId,
        name: String(body.name).trim(),
        phone: String(body.phone).trim(),
        memberNo,
        gender: body.gender === "female" ? "female" : "male",
        barcode: `M${memberNo}${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      },
    });

    return json({ member: shape({ ...member, subscriptions: [] }) }, 201);
  });
}
