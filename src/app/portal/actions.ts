"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { hashPassword, requireMember, requireModule } from "@/lib/auth";
import { audit } from "@/lib/audit";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

// إنشاء حساب بوابة للمشترك — يُستدعى من ملف العضو
export async function createMemberAccount(formData: FormData) {
  const user = await requireModule("subscriptions");
  const memberId = str(formData, "memberId");
  const password = str(formData, "password") || "123456";

  const member = await db.member.findFirst({ where: { id: memberId, clubId: user.clubId! } });
  if (!member) return;

  const existing = await db.user.findFirst({ where: { memberId } });
  if (existing) {
    // إعادة تعيين كلمة المرور
    await db.user.update({ where: { id: existing.id }, data: { passwordHash: hashPassword(password) } });
    await audit({ user, action: "update", entity: "user", summary: `تصفير كلمة مرور بوابة «${member.name}»` });
    revalidatePath(`/app/subscriptions/${memberId}`);
    return;
  }

  // البريد يُشتق من الجوال ليدخل المشترك برقمه
  const email = `${member.phone.replace(/\D/g, "")}@member.local`;
  if (await db.user.findUnique({ where: { email } })) return;

  await db.user.create({
    data: {
      clubId: user.clubId!,
      branchId: member.branchId,
      memberId,
      name: member.name,
      email,
      role: "member",
      passwordHash: hashPassword(password),
    },
  });

  await audit({
    user,
    action: "create",
    entity: "user",
    summary: `إنشاء حساب بوابة للمشترك «${member.name}» (${email})`,
  });
  revalidatePath(`/app/subscriptions/${memberId}`);
}

// المشترك يحجز حصة بنفسه من البوابة
export async function bookFromPortal(formData: FormData) {
  const user = await requireMember();
  const sessionId = str(formData, "sessionId");

  const member = await db.member.findUnique({
    where: { id: user.memberId! },
    include: { subscriptions: { orderBy: { endsAt: "desc" }, take: 1 } },
  });
  if (!member) return;

  // لا حجز باشتراك منتهٍ أو مجمّد
  const sub = member.subscriptions[0];
  if (!sub || sub.endsAt < new Date() || sub.status !== "active") return;

  const session = await db.classSession.findFirst({
    where: { id: sessionId, gymClass: { clubId: member.clubId } },
    include: { _count: { select: { bookings: { where: { status: "booked" } } } } },
  });
  if (!session) return;

  const status = session._count.bookings < session.capacity ? "booked" : "waitlist";
  await db.booking
    .create({ data: { sessionId, memberId: member.id, status, source: "app" } })
    .catch(() => {});

  revalidatePath("/portal");
}

export async function cancelMyBooking(formData: FormData) {
  const user = await requireMember();
  const id = str(formData, "bookingId");

  const booking = await db.booking.findFirst({ where: { id, memberId: user.memberId! } });
  if (!booking) return;

  await db.booking.delete({ where: { id } });

  // ترقية أول شخص في قائمة الانتظار
  if (booking.status === "booked") {
    const next = await db.booking.findFirst({
      where: { sessionId: booking.sessionId, status: "waitlist" },
      orderBy: { createdAt: "asc" },
    });
    if (next) await db.booking.update({ where: { id: next.id }, data: { status: "booked" } });
  }

  revalidatePath("/portal");
}

export async function changeMyPortalPassword(formData: FormData) {
  const user = await requireMember();
  const password = str(formData, "password");
  if (password.length < 6) return;

  await db.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(password) } });
  revalidatePath("/portal");
}
