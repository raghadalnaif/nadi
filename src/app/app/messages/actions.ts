"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/auth";
import { audit } from "@/lib/audit";
import {
  ensureTemplates,
  queueMessage,
  runScheduledMessages,
  sendViaCloudApi,
} from "@/lib/whatsapp";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

// تعليم الرسالة كمُرسَلة بعد ضغط الموظف على رابط واتساب
export async function markSent(formData: FormData) {
  const user = await requireModule("messages");
  const id = str(formData, "messageId");

  const msg = await db.message.findFirst({ where: { id, clubId: user.clubId! } });
  if (!msg || msg.status === "sent") return;

  await db.message.update({
    where: { id },
    data: { status: "sent", sentAt: new Date(), sentBy: user.name },
  });
  revalidatePath("/app/messages");
}

// إرسال فعلي عبر Cloud API
export async function sendNow(formData: FormData) {
  const user = await requireModule("messages");
  const id = str(formData, "messageId");

  const msg = await db.message.findFirst({ where: { id, clubId: user.clubId! } });
  if (!msg) return;

  await sendViaCloudApi(id);
  revalidatePath("/app/messages");
}

export async function deleteMessage(formData: FormData) {
  const user = await requireModule("messages");
  const id = str(formData, "messageId");
  const msg = await db.message.findFirst({ where: { id, clubId: user.clubId! } });
  if (!msg) return;

  await db.message.delete({ where: { id } });
  revalidatePath("/app/messages");
}

// فحص الاشتراكات وتجهيز رسائل التذكير والاسترجاع والمتابعة
export async function runReminders() {
  const user = await requireModule("messages");
  const result = await runScheduledMessages(user.clubId!);

  await audit({
    user,
    action: "create",
    entity: "message",
    summary: `فحص التنبيهات: ${result.expiry} تذكير انتهاء، ${result.winback} استرجاع، ${result.postSale} متابعة`,
  });

  revalidatePath("/app/messages");
}

// رسالة يدوية لعضو أو رقم مباشر
export async function sendManual(formData: FormData) {
  const user = await requireModule("messages");
  const memberId = str(formData, "memberId");
  const phone = str(formData, "phone");
  const body = str(formData, "body");
  if (!body) return;

  let toName = str(formData, "toName") || "عميل";
  let finalPhone = phone;

  if (memberId) {
    const m = await db.member.findFirst({ where: { id: memberId, clubId: user.clubId! } });
    if (!m) return;
    toName = m.name;
    finalPhone = m.phone;
  }
  if (!finalPhone) return;

  await queueMessage({
    clubId: user.clubId!,
    kind: "manual",
    memberId: memberId || null,
    toName,
    phone: finalPhone,
    body,
  });

  revalidatePath("/app/messages");
}

// رسالة جماعية لشريحة محددة
export async function broadcast(formData: FormData) {
  const user = await requireModule("messages");
  const clubId = user.clubId!;
  const segment = str(formData, "segment");
  const body = str(formData, "body");
  if (!body) return;

  const now = new Date();
  const week = new Date(Date.now() + 7 * 86400000);

  const where =
    segment === "expiring"
      ? { clubId, subscriptions: { some: { status: "active", endsAt: { gte: now, lte: week } } } }
      : segment === "expired"
        ? { clubId, subscriptions: { some: { status: "active", endsAt: { lt: now } } } }
        : segment === "active"
          ? { clubId, subscriptions: { some: { status: "active", endsAt: { gte: now } } } }
          : { clubId };

  const members = await db.member.findMany({ where, take: 200 });

  for (const m of members) {
    await queueMessage({
      clubId,
      kind: "manual",
      memberId: m.id,
      toName: m.name,
      phone: m.phone,
      body: body.replace(/\{الاسم\}/g, m.name),
    });
  }

  await audit({
    user,
    action: "create",
    entity: "message",
    summary: `رسالة جماعية لـ ${members.length} عضو`,
  });

  revalidatePath("/app/messages");
}

// ═════════ القوالب ═════════

export async function saveTemplate(formData: FormData) {
  const user = await requireModule("messages");
  await ensureTemplates(user.clubId!);

  const id = str(formData, "templateId");
  const body = str(formData, "body");
  if (!id || !body) return;

  const tpl = await db.messageTemplate.findFirst({ where: { id, clubId: user.clubId! } });
  if (!tpl) return;

  await db.messageTemplate.update({
    where: { id },
    data: { body, active: formData.get("active") === "on" },
  });

  await audit({ user, action: "update", entity: "template", entityId: id, summary: `تعديل قالب «${tpl.name}»` });
  revalidatePath("/app/messages");
}

// ═════════ إعدادات واتساب ═════════

export async function saveWhatsappSettings(formData: FormData) {
  const user = await requireModule("settings");
  const provider = str(formData, "waProvider") === "cloud_api" ? "cloud_api" : "link";

  await db.club.update({
    where: { id: user.clubId! },
    data: {
      waProvider: provider,
      waPhoneId: str(formData, "waPhoneId") || null,
      waToken: str(formData, "waToken") || null,
      waAutoWelcome: formData.get("waAutoWelcome") === "on",
      waAutoExpiry: formData.get("waAutoExpiry") === "on",
      waAutoWinback: formData.get("waAutoWinback") === "on",
      waAutoReceipt: formData.get("waAutoReceipt") === "on",
      waExpiryDays: Math.min(30, Math.max(1, Number(formData.get("waExpiryDays")) || 3)),
    },
  });

  await audit({ user, action: "update", entity: "club", summary: "تعديل إعدادات واتساب" });
  revalidatePath("/app/settings");
  revalidatePath("/app/messages");
}
