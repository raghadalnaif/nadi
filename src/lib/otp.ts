import { createHash, randomInt } from "crypto";
import { db } from "./db";
import { normalizePhone, queueMessage } from "./whatsapp";

// ═══════════════════════════════════════════════════════════
// دخول العضو برقم الجوال ورمز مؤقت — بلا كلمة مرور دائمة
//
// التسليم يتبع إعداد واتساب في النادي:
//   cloud_api → يصل الرمز لجوال العضو تلقائياً خلال ثوانٍ
//   link      → يظهر الرمز في صندوق الرسائل ليرسله الموظف
// ═══════════════════════════════════════════════════════════

const CODE_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 60;

const hash = (code: string) => createHash("sha256").update(code).digest("hex");

export type OtpRequestResult =
  | { ok: true; message: string; devCode?: string }
  | { ok: false; message: string };

// يطلب رمزاً جديداً لرقم الجوال
export async function requestOtp(phone: string, clubSlug?: string): Promise<OtpRequestResult> {
  const normalized = normalizePhone(phone);
  if (normalized.length < 12) {
    return { ok: false, message: "رقم الجوال غير صحيح" };
  }

  // نبحث عن العضو بأي صيغة مخزّنة للرقم
  const local = "0" + normalized.slice(3);
  const member = await db.member.findFirst({
    where: {
      OR: [{ phone: normalized }, { phone: local }, { phone: local.slice(1) }],
      // البوابة الفرعية تقصر البحث على مشتركي ناديها وحده
      ...(clubSlug ? { club: { slug: clubSlug } } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { club: { select: { id: true, name: true, waProvider: true } } },
  });

  // لا نكشف إن كان الرقم مسجلاً أم لا — حماية من استكشاف الأرقام
  if (!member) {
    return { ok: true, message: "إن كان الرقم مسجلاً فسيصلك رمز الدخول خلال لحظات" };
  }

  // منع الإرسال المتكرر
  const recent = await db.otpCode.findFirst({
    where: {
      phone: normalized,
      createdAt: { gte: new Date(Date.now() - RESEND_COOLDOWN_SECONDS * 1000) },
    },
    orderBy: { createdAt: "desc" },
  });
  if (recent) {
    const wait = Math.ceil(
      (recent.createdAt.getTime() + RESEND_COOLDOWN_SECONDS * 1000 - Date.now()) / 1000
    );
    return { ok: false, message: `انتظر ${wait} ثانية قبل طلب رمز جديد` };
  }

  // إبطال أي رموز سابقة لم تُستخدم
  await db.otpCode.updateMany({
    where: { phone: normalized, usedAt: null },
    data: { usedAt: new Date() },
  });

  const code = String(randomInt(100000, 1000000));
  await db.otpCode.create({
    data: {
      clubId: member.clubId,
      phone: normalized,
      codeHash: hash(code),
      expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60000),
    },
  });

  await queueMessage({
    clubId: member.clubId,
    kind: "manual",
    memberId: member.id,
    toName: member.name,
    phone: member.phone,
    body: `رمز دخولك إلى ${member.club.name}\n\n${code}\n\nصالح لمدة ${CODE_TTL_MINUTES} دقائق. لا تشاركه مع أحد.`,
  });

  const auto = member.club.waProvider === "cloud_api";
  return {
    ok: true,
    message: auto
      ? "أُرسل رمز الدخول إلى جوالك"
      : "جُهّز رمز الدخول — اطلبه من موظف الاستقبال",
    // في وضع التطوير نعرض الرمز لتسهيل الاختبار
    devCode: process.env.NODE_ENV !== "production" ? code : undefined,
  };
}

export type OtpVerifyResult =
  | { ok: true; userId: string }
  | { ok: false; message: string };

// يتحقق من الرمز وينشئ حساب البوابة تلقائياً عند أول دخول
export async function verifyOtp(
  phone: string,
  code: string,
  clubSlug?: string
): Promise<OtpVerifyResult> {
  const normalized = normalizePhone(phone);
  const clean = code.replace(/\D/g, "");
  if (clean.length !== 6) return { ok: false, message: "الرمز يتكوّن من ٦ أرقام" };

  const club = clubSlug ? await db.club.findUnique({ where: { slug: clubSlug } }) : null;
  if (clubSlug && !club) return { ok: false, message: "بوابة غير معروفة" };

  const record = await db.otpCode.findFirst({
    where: {
      phone: normalized,
      usedAt: null,
      expiresAt: { gt: new Date() },
      ...(club ? { clubId: club.id } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  if (!record) return { ok: false, message: "الرمز منتهٍ أو غير صحيح — اطلب رمزاً جديداً" };

  if (record.attempts >= MAX_ATTEMPTS) {
    await db.otpCode.update({ where: { id: record.id }, data: { usedAt: new Date() } });
    return { ok: false, message: "تجاوزت عدد المحاولات — اطلب رمزاً جديداً" };
  }

  if (record.codeHash !== hash(clean)) {
    await db.otpCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    const left = MAX_ATTEMPTS - record.attempts - 1;
    return {
      ok: false,
      message: left > 0 ? `رمز غير صحيح — بقي ${left} محاولات` : "رمز غير صحيح",
    };
  }

  await db.otpCode.update({ where: { id: record.id }, data: { usedAt: new Date() } });

  const local = "0" + normalized.slice(3);
  const member = await db.member.findFirst({
    where: {
      clubId: record.clubId,
      OR: [{ phone: normalized }, { phone: local }, { phone: local.slice(1) }],
    },
  });
  if (!member) return { ok: false, message: "لم نجد عضوية مرتبطة بهذا الرقم" };

  // الحساب يُنشأ تلقائياً عند أول دخول — لا يحتاج تدخل الموظف
  const existing = await db.user.findFirst({ where: { memberId: member.id } });
  if (existing) {
    if (!existing.active) return { ok: false, message: "هذا الحساب موقوف — راجع الاستقبال" };
    await db.user.update({ where: { id: existing.id }, data: { lastLoginAt: new Date() } });
    return { ok: true, userId: existing.id };
  }

  const created = await db.user.create({
    data: {
      clubId: member.clubId,
      branchId: member.branchId,
      memberId: member.id,
      name: member.name,
      email: `${normalized}@member.local`,
      role: "member",
      // الدخول بالرمز المؤقت فقط — لا كلمة مرور قابلة للتخمين
      passwordHash: "otp-only:" + randomInt(1e15, 1e16).toString(36),
      lastLoginAt: new Date(),
    },
  });

  return { ok: true, userId: created.id };
}

// تنظيف الرموز المنتهية — يُستدعى دورياً
export async function purgeExpiredOtps() {
  const { count } = await db.otpCode.deleteMany({
    where: { expiresAt: { lt: new Date(Date.now() - 86400000) } },
  });
  return count;
}
