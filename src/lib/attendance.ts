import { db } from "./db";
import { membershipStatus } from "./membership";

// ═══════════════════════════════════════════════════════════
// تسجيل الحضور — نقطة واحدة تمر بها كل الطرق
// (استقبال، باركود، بصمة، بوابة، API) حتى تبقى قواعد
// استهلاك الحصص والتحقق من الاشتراك في مكان واحد.
// ═══════════════════════════════════════════════════════════

export type CheckInOutcome = {
  ok: boolean;
  /** لم يُسجَّل لأنه حاضر مسبقاً اليوم */
  duplicate?: boolean;
  message: string;
  tone: "success" | "warn" | "error";
  memberName: string;
  /** الحصص المتبقية بعد هذا الحضور — لباقات الحصص */
  sessionsLeft?: number;
};

export async function recordAttendance(input: {
  memberId: string;
  source: string;
  /** يمنع دخول منتهي الاشتراك — من إعدادات النادي */
  blockExpired: boolean;
}): Promise<CheckInOutcome> {
  const member = await db.member.findUnique({
    where: { id: input.memberId },
    include: {
      subscriptions: {
        where: { status: { not: "cancelled" } },
        orderBy: { endsAt: "desc" },
        take: 1,
        include: { plan: true },
      },
    },
  });

  if (!member) {
    return { ok: false, message: "العضو غير موجود", tone: "error", memberName: "" };
  }

  const sub = member.subscriptions[0] ?? null;
  const status = membershipStatus(sub);

  // منع الدخول عند انتهاء المدة أو نفاد الحصص أو التجميد
  if (input.blockExpired && (!status || !status.canEnter)) {
    const reason =
      status?.key === "exhausted"
        ? "انتهت حصص باقته"
        : status?.key === "frozen"
          ? "اشتراكه مجمّد"
          : "اشتراكه منتهٍ";
    return {
      ok: false,
      message: `${member.name} — ${reason}`,
      tone: "error",
      memberName: member.name,
      sessionsLeft: status?.sessionsLeft,
    };
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const already = await db.attendance.findFirst({
    where: { memberId: member.id, checkedAt: { gte: todayStart } },
  });

  if (already) {
    return {
      ok: true,
      duplicate: true,
      message: `${member.name} حاضر مسبقاً اليوم`,
      tone: "warn",
      memberName: member.name,
      sessionsLeft: status?.sessionsLeft,
    };
  }

  await db.attendance.create({ data: { memberId: member.id, source: input.source } });

  // باقة الحصص تُخصم حصة واحدة لكل يوم حضور
  let sessionsLeft = status?.sessionsLeft;
  if (status?.isSessionPlan && sub) {
    const updated = await db.subscription.update({
      where: { id: sub.id },
      data: { sessionsUsed: { increment: 1 } },
    });
    sessionsLeft = Math.max(0, updated.sessionsTotal - updated.sessionsUsed);
  }

  const warn =
    (status?.isSessionPlan && (sessionsLeft ?? 0) <= 2) ||
    (!status?.isSessionPlan && (status?.daysLeft ?? 99) <= 7);

  const detail = status?.isSessionPlan
    ? `تبقّى ${new Intl.NumberFormat("ar-SA").format(sessionsLeft ?? 0)} حصة`
    : status?.daysLeft !== undefined && status.daysLeft <= 7
      ? `اشتراكه ينتهي بعد ${new Intl.NumberFormat("ar-SA").format(status.daysLeft)} يوم`
      : "";

  return {
    ok: true,
    message: detail ? `${member.name} — ${detail}` : `${member.name} — تم التحضير`,
    tone: warn ? "warn" : "success",
    memberName: member.name,
    sessionsLeft,
  };
}
