// ═══════════════════════════════════════════════════════════
// نوعا العضوية: اشتراك زمني أو باقة حصص
//
//   duration → صالح حتى تاريخ الانتهاء بلا حد للزيارات
//   sessions → عدد حصص محدود، وله مهلة استخدام كذلك
//
// كل شاشة تعرض الحالة عبر membershipStatus لتبقى القواعد
// في مكان واحد بدل تكرارها في كل صفحة.
// ═══════════════════════════════════════════════════════════

export type PlanLike = { kind: string; sessionCount: number; durationDays: number };

export type SubLike = {
  endsAt: Date;
  status: string;
  sessionsTotal: number;
  sessionsUsed: number;
  plan?: PlanLike | null;
};

export type MembershipTone = "emerald" | "amber" | "red" | "sky" | "slate";

export type MembershipStatus = {
  key: "active" | "expiring" | "expired" | "frozen" | "exhausted" | "cancelled";
  label: string;
  tone: MembershipTone;
  /** نص مختصر يصف ما تبقّى — أيام أو حصص */
  remaining: string;
  daysLeft: number;
  sessionsLeft: number;
  isSessionPlan: boolean;
  /** هل يُسمح بالدخول الآن؟ */
  canEnter: boolean;
};

const ar = new Intl.NumberFormat("ar-SA");

export function membershipStatus(sub: SubLike | null | undefined): MembershipStatus | null {
  if (!sub) return null;

  const isSessionPlan = sub.plan?.kind === "sessions" || sub.sessionsTotal > 0;
  const sessionsLeft = Math.max(0, sub.sessionsTotal - sub.sessionsUsed);
  const daysLeft = Math.ceil((sub.endsAt.getTime() - Date.now()) / 86400000);

  const base = { daysLeft, sessionsLeft, isSessionPlan };

  if (sub.status === "cancelled") {
    return { ...base, key: "cancelled", label: "ملغي", tone: "slate", remaining: "—", canEnter: false };
  }

  if (sub.status === "frozen") {
    return {
      ...base,
      key: "frozen",
      label: "مجمّد",
      tone: "sky",
      remaining: isSessionPlan ? `${ar.format(sessionsLeft)} حصة محفوظة` : "التجميد يوقف العدّ",
      canEnter: false,
    };
  }

  // باقة الحصص تنتهي باستهلاكها حتى لو بقيت المهلة
  if (isSessionPlan && sessionsLeft <= 0) {
    return {
      ...base,
      key: "exhausted",
      label: "انتهت الحصص",
      tone: "red",
      remaining: "لا حصص متبقية",
      canEnter: false,
    };
  }

  if (daysLeft <= 0) {
    return {
      ...base,
      key: "expired",
      label: "منتهي",
      tone: "red",
      remaining: `انتهى قبل ${ar.format(Math.abs(daysLeft))} يوم`,
      canEnter: false,
    };
  }

  // تحذير قرب النفاد: أيام قليلة أو حصص قليلة
  const lowSessions = isSessionPlan && sessionsLeft <= 2;
  const lowDays = daysLeft <= 7;

  if (lowSessions || lowDays) {
    return {
      ...base,
      key: "expiring",
      label: lowSessions ? "حصص قليلة" : "قرب ينتهي",
      tone: "amber",
      remaining: isSessionPlan
        ? `${ar.format(sessionsLeft)} حصة · ${ar.format(daysLeft)} يوم`
        : `${ar.format(daysLeft)} يوم`,
      canEnter: true,
    };
  }

  return {
    ...base,
    key: "active",
    label: "فعّال",
    tone: "emerald",
    remaining: isSessionPlan
      ? `${ar.format(sessionsLeft)} حصة متبقية`
      : `${ar.format(daysLeft)} يوم متبقٍ`,
    canEnter: true,
  };
}

/** قيم الاشتراك الجديد حسب نوع الباقة */
export function subscriptionFromPlan(plan: PlanLike, startsAt: Date) {
  const endsAt = new Date(startsAt);
  endsAt.setDate(endsAt.getDate() + plan.durationDays);

  return {
    endsAt,
    sessionsTotal: plan.kind === "sessions" ? plan.sessionCount : 0,
    sessionsUsed: 0,
  };
}

/** وصف الباقة للعرض في القوائم */
export function planSummary(plan: PlanLike) {
  return plan.kind === "sessions"
    ? `${ar.format(plan.sessionCount)} حصة · صالحة ${ar.format(plan.durationDays)} يوم`
    : `${ar.format(plan.durationDays)} يوم`;
}
