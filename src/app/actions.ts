"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function checkIn(formData: FormData) {
  const memberId = String(formData.get("memberId"));
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const already = await db.attendance.findFirst({
    where: { memberId, checkedAt: { gte: todayStart } },
  });
  if (!already) {
    await db.attendance.create({ data: { memberId, source: "reception" } });
  }
  revalidatePath("/");
}

export async function renew(formData: FormData) {
  const memberId = String(formData.get("memberId"));
  const last = await db.subscription.findFirst({
    where: { memberId },
    orderBy: { endsAt: "desc" },
    include: { plan: true },
  });
  if (!last) return;

  const now = new Date();
  const startsAt = last.endsAt > now ? last.endsAt : now;
  const endsAt = new Date(startsAt);
  endsAt.setDate(endsAt.getDate() + last.plan.durationDays);

  await db.subscription.create({
    data: {
      memberId,
      planId: last.planId,
      startsAt,
      endsAt,
      paidSAR: last.plan.priceSAR,
    },
  });
  revalidatePath("/");
}

export async function book(formData: FormData) {
  const sessionId = String(formData.get("sessionId"));
  const memberId = String(formData.get("memberId"));
  if (!memberId) return;

  const session = await db.classSession.findUnique({
    where: { id: sessionId },
    include: { _count: { select: { bookings: { where: { status: "booked" } } } } },
  });
  if (!session) return;

  const status = session._count.bookings < session.capacity ? "booked" : "waitlist";
  await db.booking
    .create({ data: { sessionId, memberId, status, source: "reception" } })
    .catch(() => {});
  revalidatePath("/schedule");
}
