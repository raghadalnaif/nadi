"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { generateApiKey } from "@/lib/api-auth";
import { requireModule } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { runBackup } from "@/lib/backup";
import { recordAttendance } from "@/lib/attendance";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const numOf = (fd: FormData, k: string) => Number(fd.get(k));

// ═════════ تحضير الأعضاء بكل الطرق ═════════

export type CheckinResult = {
  ok: boolean;
  message: string;
  memberName?: string;
  tone: "success" | "warn" | "error";
};

// تحضير بالباركود أو رقم العضوية — يُستخدم من قارئ الباركود مباشرة
export async function checkInByCode(
  _prev: CheckinResult | null,
  formData: FormData
): Promise<CheckinResult> {
  const user = await requireModule("reception");
  const code = str(formData, "code");
  const source = str(formData, "source") || "barcode";
  if (!code) return { ok: false, message: "أدخل الرمز", tone: "error" };

  const club = await db.club.findUnique({ where: { id: user.clubId! } });
  if (!club) return { ok: false, message: "خطأ في النادي", tone: "error" };

  // تحقق أن الطريقة مفعّلة في إعدادات النادي
  const enabled: Record<string, boolean> = {
    barcode: club.checkinBarcode,
    fingerprint: club.checkinFingerprint,
    wristband: club.checkinWristband,
    gate: club.checkinGate,
    reception: club.checkinManual,
  };
  if (!enabled[source]) {
    return { ok: false, message: "هذه الطريقة غير مفعّلة في إعدادات النادي", tone: "error" };
  }

  const member = await db.member.findFirst({
    where: {
      clubId: club.id,
      OR: [{ barcode: code }, { memberNo: Number(code) || -1 }, { phone: code }],
    },
  });

  if (!member) return { ok: false, message: `لا يوجد عضو بالرمز ${code}`, tone: "error" };

  const result = await recordAttendance({
    memberId: member.id,
    source,
    blockExpired: club.blockExpiredEntry,
  });

  revalidatePath("/app/reception");

  return {
    ok: result.ok,
    memberName: result.memberName,
    message: result.ok && !result.duplicate ? `أهلاً ${result.message}` : result.message,
    tone: result.tone,
  };
}


// توليد باركود لعضو ليس لديه واحد
export async function generateMemberBarcode(formData: FormData) {
  const user = await requireModule("subscriptions");
  const memberId = str(formData, "memberId");
  const member = await db.member.findFirst({ where: { id: memberId, clubId: user.clubId! } });
  if (!member) return;

  const barcode = `M${member.memberNo}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  await db.member.update({ where: { id: memberId }, data: { barcode } });
  await audit({ user, action: "update", entity: "member", entityId: memberId, summary: `توليد باركود للعضو «${member.name}»` });

  revalidatePath(`/app/subscriptions/${memberId}`);
}

// ═════════ إعدادات طرق التحضير ═════════

export async function saveCheckinSettings(formData: FormData) {
  const user = await requireModule("settings");
  const on = (k: string) => formData.get(k) === "on";

  await db.club.update({
    where: { id: user.clubId! },
    data: {
      checkinManual: on("checkinManual"),
      checkinBarcode: on("checkinBarcode"),
      checkinFingerprint: on("checkinFingerprint"),
      checkinWristband: on("checkinWristband"),
      checkinGate: on("checkinGate"),
      blockExpiredEntry: on("blockExpiredEntry"),
    },
  });

  await audit({ user, action: "update", entity: "club", entityId: user.clubId!, summary: "تعديل إعدادات طرق التحضير" });
  revalidatePath("/app/settings");
  revalidatePath("/app/reception");
}

// ═════════ حضور وانصراف الموظفين ═════════

export async function staffCheckIn(formData: FormData) {
  const user = await requireModule("hr");
  const employeeId = str(formData, "employeeId");
  const emp = await db.employee.findFirst({ where: { id: employeeId, clubId: user.clubId! } });
  if (!emp) return;

  const day = new Date();
  day.setHours(0, 0, 0, 0);

  const existing = await db.staffAttendance.findUnique({
    where: { employeeId_day: { employeeId, day } },
  });

  if (!existing) {
    await db.staffAttendance.create({
      data: { employeeId, day, checkIn: new Date(), status: "present" },
    });
  } else if (!existing.checkIn) {
    await db.staffAttendance.update({
      where: { id: existing.id },
      data: { checkIn: new Date(), status: "present" },
    });
  }

  revalidatePath("/app/hr");
}

export async function staffCheckOut(formData: FormData) {
  const user = await requireModule("hr");
  const employeeId = str(formData, "employeeId");
  const emp = await db.employee.findFirst({ where: { id: employeeId, clubId: user.clubId! } });
  if (!emp) return;

  const day = new Date();
  day.setHours(0, 0, 0, 0);

  const existing = await db.staffAttendance.findUnique({
    where: { employeeId_day: { employeeId, day } },
  });
  if (existing?.checkIn && !existing.checkOut) {
    await db.staffAttendance.update({ where: { id: existing.id }, data: { checkOut: new Date() } });
  }

  revalidatePath("/app/hr");
}

export async function markStaffAbsent(formData: FormData) {
  const user = await requireModule("hr");
  const employeeId = str(formData, "employeeId");
  const emp = await db.employee.findFirst({ where: { id: employeeId, clubId: user.clubId! } });
  if (!emp) return;

  const day = new Date();
  day.setHours(0, 0, 0, 0);

  await db.staffAttendance.upsert({
    where: { employeeId_day: { employeeId, day } },
    create: { employeeId, day, status: "absent" },
    update: { status: "absent", checkIn: null, checkOut: null },
  });

  await audit({ user, action: "update", entity: "staff_attendance", summary: `تسجيل غياب «${emp.name}»` });
  revalidatePath("/app/hr");
}

// ═════════ النسخ الاحتياطي ═════════

export async function takeBackup() {
  const user = await requireModule("settings");
  const result = await runBackup(user.clubId!);
  await audit({
    user,
    action: "create",
    entity: "backup",
    summary: `أخذ نسخة احتياطية (${result.counts.members} عضو، ${result.counts.invoices} فاتورة)`,
  });
  revalidatePath("/app/settings");
}

// ═════════ مفاتيح API ═════════

// المفتاح يُعرض مرة واحدة فقط — نعيده عبر كوكي مؤقت لتعرضه الصفحة
export async function createApiKey(formData: FormData) {
  const user = await requireModule("settings");
  const name = str(formData, "name");
  const scopes = [
    formData.get("scopeRead") === "on" && "read",
    formData.get("scopeWrite") === "on" && "write",
    formData.get("scopeCheckin") === "on" && "checkin",
  ]
    .filter(Boolean)
    .join(",");

  if (!name || !scopes) return;

  const { raw, prefix, keyHash } = generateApiKey();
  await db.apiKey.create({
    data: { clubId: user.clubId!, name, prefix, keyHash, scopes },
  });

  (await cookies()).set("nadi_new_key", raw, {
    httpOnly: false,
    maxAge: 120,
    path: "/app/settings",
  });

  await audit({ user, action: "create", entity: "api_key", summary: `إنشاء مفتاح API «${name}» بصلاحيات ${scopes}` });
  revalidatePath("/app/settings");
}

export async function toggleApiKey(formData: FormData) {
  const user = await requireModule("settings");
  const id = str(formData, "keyId");
  const key = await db.apiKey.findFirst({ where: { id, clubId: user.clubId! } });
  if (!key) return;

  await db.apiKey.update({ where: { id }, data: { active: !key.active } });
  await audit({
    user,
    action: key.active ? "suspend" : "activate",
    entity: "api_key",
    entityId: id,
    summary: `${key.active ? "إيقاف" : "تفعيل"} مفتاح «${key.name}»`,
  });
  revalidatePath("/app/settings");
}

export async function deleteApiKey(formData: FormData) {
  const user = await requireModule("settings");
  const id = str(formData, "keyId");
  const key = await db.apiKey.findFirst({ where: { id, clubId: user.clubId! } });
  if (!key) return;

  await db.apiKey.delete({ where: { id } });
  await audit({ user, action: "delete", entity: "api_key", entityId: id, summary: `حذف مفتاح «${key.name}»` });
  revalidatePath("/app/settings");
}

// ═════════ العروض والخصومات ═════════

export async function saveOffer(formData: FormData) {
  const user = await requireModule("offers");
  const id = str(formData, "offerId");
  const name = str(formData, "name");
  const code = str(formData, "code").toUpperCase();
  const kind = str(formData, "kind") || "percent";
  const value = numOf(formData, "value");
  const maxUses = Math.max(0, numOf(formData, "maxUses") || 0);
  const startsAt = new Date(str(formData, "startsAt"));
  const endsAt = new Date(str(formData, "endsAt"));
  const planId = str(formData, "planId");

  if (!name || !code || !(value > 0)) return;
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) return;
  if (kind === "percent" && value > 100) return;

  if (id) {
    const existing = await db.offer.findFirst({ where: { id, clubId: user.clubId! } });
    if (!existing) return;
    await db.offer.update({
      where: { id },
      data: { name, code, kind, value, maxUses, startsAt, endsAt, planId: planId || null },
    });
    await audit({ user, action: "update", entity: "offer", entityId: id, summary: `تعديل عرض «${name}»` });
  } else {
    const clash = await db.offer.findFirst({ where: { clubId: user.clubId!, code } });
    if (clash) return;
    const offer = await db.offer.create({
      data: {
        clubId: user.clubId!,
        name,
        code,
        kind,
        value,
        maxUses,
        startsAt,
        endsAt,
        planId: planId || null,
      },
    });
    await audit({
      user,
      action: "create",
      entity: "offer",
      entityId: offer.id,
      summary: `إضافة عرض «${name}» بكود ${code} (${kind === "percent" ? value + "%" : value + " ر.س"})`,
    });
  }

  revalidatePath("/app/offers");
}

export async function toggleOffer(formData: FormData) {
  const user = await requireModule("offers");
  const id = str(formData, "offerId");
  const offer = await db.offer.findFirst({ where: { id, clubId: user.clubId! } });
  if (!offer) return;

  await db.offer.update({ where: { id }, data: { active: !offer.active } });
  await audit({
    user,
    action: "update",
    entity: "offer",
    entityId: id,
    summary: `${offer.active ? "إيقاف" : "تفعيل"} عرض «${offer.name}»`,
  });
  revalidatePath("/app/offers");
}

export async function deleteOffer(formData: FormData) {
  const user = await requireModule("offers");
  const id = str(formData, "offerId");
  const offer = await db.offer.findFirst({
    where: { id, clubId: user.clubId! },
    include: { _count: { select: { subscriptions: true } } },
  });
  if (!offer) return;

  // عرض مستخدم يُعطَّل بدل الحذف حفاظاً على سجل الاشتراكات
  if (offer._count.subscriptions > 0) {
    await db.offer.update({ where: { id }, data: { active: false } });
    await audit({ user, action: "update", entity: "offer", entityId: id, summary: `تعطيل عرض «${offer.name}» (مستخدم سابقاً)` });
  } else {
    await db.offer.delete({ where: { id } });
    await audit({ user, action: "delete", entity: "offer", entityId: id, summary: `حذف عرض «${offer.name}»` });
  }
  revalidatePath("/app/offers");
}
