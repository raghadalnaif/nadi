import { db } from "./db";

// ═══════════════════════════════════════════════════════════
// محرك رسائل واتساب
//
// وضعان للإرسال:
//   link      — يولّد رابط wa.me جاهزاً يضغطه الموظف. يعمل فوراً
//                بلا أي إعداد، والرسالة تُرسل من جوال النادي.
//   cloud_api — إرسال تلقائي فعلي عبر WhatsApp Business Cloud API
//                من Meta. يتطلب حساب أعمال ورقماً معتمداً وقوالب
//                موافَقاً عليها من Meta.
// ═══════════════════════════════════════════════════════════

export const TEMPLATE_KEYS = {
  welcome: "ترحيب بعضو جديد",
  receipt: "إشعار فاتورة",
  expiry: "تذكير قبل انتهاء الاشتراك",
  winback: "استرجاع منقطع",
  post_sale: "متابعة ما بعد البيع",
} as const;

export type TemplateKey = keyof typeof TEMPLATE_KEYS;

// القوالب الافتراضية — تُنشأ مع النادي ويعدّلها المدير
export const DEFAULT_TEMPLATES: { key: TemplateKey; name: string; body: string }[] = [
  {
    key: "welcome",
    name: "ترحيب بعضو جديد",
    body:
      "أهلاً {الاسم} 👋\nيسعدنا انضمامك إلى {النادي}!\n\nاشتراكك: {الباقة}\nينتهي في: {تاريخ_الانتهاء}\nرقم عضويتك: {رقم_العضوية}\n\nنشوفك على خير 💪",
  },
  {
    key: "receipt",
    name: "إشعار فاتورة",
    body:
      "شكراً {الاسم} 🙏\nتم استلام مبلغ {المبلغ} من {النادي}.\nرقم الفاتورة: {رقم_الفاتورة}\n\nنتمنى لك تجربة ممتعة.",
  },
  {
    key: "expiry",
    name: "تذكير قبل انتهاء الاشتراك",
    body:
      "مرحباً {الاسم} 👋\nنذكّرك أن اشتراكك في {النادي} ينتهي بعد {الأيام_المتبقية} أيام ({تاريخ_الانتهاء}).\n\nجدّد الآن وواصل تقدمك 💪",
  },
  {
    key: "winback",
    name: "استرجاع منقطع",
    body:
      "اشتقنا لك {الاسم} 💚\nانتهى اشتراكك في {النادي} منذ {أيام_الانقطاع} يوم.\n\nرجعتك علينا سهلة — تواصل معنا وبنساعدك تبدأ من جديد.",
  },
  {
    key: "post_sale",
    name: "متابعة ما بعد البيع",
    body:
      "مرحباً {الاسم} 👋\nمر أسبوع على انضمامك لـ{النادي}.\n\nكيف كانت تجربتك؟ فيه شي نقدر نساعدك فيه؟ رأيك يهمنا.",
  },
];

export async function ensureTemplates(clubId: string) {
  const count = await db.messageTemplate.count({ where: { clubId } });
  if (count > 0) return;
  await db.messageTemplate.createMany({
    data: DEFAULT_TEMPLATES.map((t) => ({ clubId, key: t.key, name: t.name, body: t.body })),
  });
}

// استبدال المتغيرات داخل نص القالب
export function renderTemplate(body: string, vars: Record<string, string | number>) {
  return body.replace(/\{([^}]+)\}/g, (match, key) => {
    const v = vars[String(key).trim()];
    return v === undefined || v === null ? match : String(v);
  });
}

// رقم سعودي بصيغة دولية بلا رموز
export function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("966")) return digits;
  if (digits.startsWith("0")) return "966" + digits.slice(1);
  if (digits.startsWith("5") && digits.length === 9) return "966" + digits;
  return digits;
}

export function waLink(phone: string, body: string) {
  return `https://wa.me/${normalizePhone(phone)}?text=${encodeURIComponent(body)}`;
}

// يضع رسالة في صندوق الصادر — تُرسل تلقائياً أو يضغطها الموظف
export async function queueMessage(input: {
  clubId: string;
  kind: TemplateKey | "manual";
  toName: string;
  phone: string;
  memberId?: string | null;
  vars?: Record<string, string | number>;
  body?: string; // نص مباشر يتجاوز القالب
}) {
  const club = await db.club.findUnique({ where: { id: input.clubId } });
  if (!club) return null;

  let body = input.body ?? "";
  let templateId: string | null = null;

  if (!body && input.kind !== "manual") {
    await ensureTemplates(club.id);
    const tpl = await db.messageTemplate.findUnique({
      where: { clubId_key: { clubId: club.id, key: input.kind } },
    });
    if (!tpl || !tpl.active) return null;
    templateId = tpl.id;
    body = renderTemplate(tpl.body, { النادي: club.name, ...(input.vars ?? {}) });
  }
  if (!body) return null;

  const message = await db.message.create({
    data: {
      clubId: club.id,
      memberId: input.memberId ?? null,
      templateId,
      toName: input.toName,
      phone: input.phone,
      body,
      kind: input.kind,
      provider: club.waProvider,
      status: "pending",
    },
  });

  // في وضع الإرسال التلقائي نحاول الإرسال فوراً
  if (club.waProvider === "cloud_api") await sendViaCloudApi(message.id);

  return message;
}

// الإرسال الفعلي عبر WhatsApp Business Cloud API
export async function sendViaCloudApi(messageId: string) {
  const msg = await db.message.findUnique({ where: { id: messageId }, include: { club: true } });
  if (!msg || msg.status === "sent") return;

  const { club } = msg;
  if (!club.waPhoneId || !club.waToken) {
    await db.message.update({
      where: { id: messageId },
      data: { status: "failed", error: "لم تُضبط بيانات واتساب Business API في الإعدادات" },
    });
    return;
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${club.waPhoneId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${club.waToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: normalizePhone(msg.phone),
        type: "text",
        text: { preview_url: false, body: msg.body },
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      await db.message.update({
        where: { id: messageId },
        data: { status: "failed", error: detail.slice(0, 400) },
      });
      return;
    }

    await db.message.update({
      where: { id: messageId },
      data: { status: "sent", sentAt: new Date(), error: null },
    });
  } catch (e) {
    await db.message.update({
      where: { id: messageId },
      data: { status: "failed", error: e instanceof Error ? e.message : "خطأ في الاتصال" },
    });
  }
}

// ───────── المهام المجدولة ─────────
// تفحص الاشتراكات وتجهّز رسائل التذكير والاسترجاع.
// تُستدعى من زر «فحص التنبيهات» أو من مهمة مجدولة خارجية.
export async function runScheduledMessages(clubId: string) {
  const club = await db.club.findUnique({ where: { id: clubId } });
  if (!club) return { expiry: 0, winback: 0, postSale: 0 };

  const now = new Date();
  const fmt = (d: Date) => new Intl.DateTimeFormat("ar-SA", { dateStyle: "long" }).format(d);
  let expiry = 0;
  let winback = 0;
  let postSale = 0;

  // 1) تذكير قبل الانتهاء
  if (club.waAutoExpiry) {
    const until = new Date(Date.now() + club.waExpiryDays * 86400000);
    const soon = await db.subscription.findMany({
      where: { status: "active", endsAt: { gte: now, lte: until }, member: { clubId } },
      include: { member: true, plan: true },
    });

    for (const s of soon) {
      const already = await db.message.findFirst({
        where: {
          memberId: s.memberId,
          kind: "expiry",
          createdAt: { gte: new Date(Date.now() - 7 * 86400000) },
        },
      });
      if (already) continue;

      const daysLeft = Math.ceil((s.endsAt.getTime() - now.getTime()) / 86400000);
      await queueMessage({
        clubId,
        kind: "expiry",
        memberId: s.memberId,
        toName: s.member.name,
        phone: s.member.phone,
        vars: {
          الاسم: s.member.name,
          الباقة: s.plan.name,
          الأيام_المتبقية: daysLeft,
          تاريخ_الانتهاء: fmt(s.endsAt),
        },
      });
      expiry++;
    }
  }

  // 2) استرجاع المنقطعين (بين 7 و60 يوماً من الانتهاء)
  if (club.waAutoWinback) {
    const from = new Date(Date.now() - 60 * 86400000);
    const to = new Date(Date.now() - 7 * 86400000);
    const lapsed = await db.subscription.findMany({
      where: { status: "active", endsAt: { gte: from, lte: to }, member: { clubId } },
      include: { member: true },
      take: 50,
    });

    for (const s of lapsed) {
      // نتخطى من جدّد بعدها
      const newer = await db.subscription.findFirst({
        where: { memberId: s.memberId, endsAt: { gt: now } },
      });
      if (newer) continue;

      const already = await db.message.findFirst({
        where: { memberId: s.memberId, kind: "winback" },
      });
      if (already) continue;

      const days = Math.floor((now.getTime() - s.endsAt.getTime()) / 86400000);
      await queueMessage({
        clubId,
        kind: "winback",
        memberId: s.memberId,
        toName: s.member.name,
        phone: s.member.phone,
        vars: { الاسم: s.member.name, أيام_الانقطاع: days },
      });
      winback++;
    }
  }

  // 3) متابعة ما بعد البيع — بعد أسبوع من التسجيل
  const weekAgo = new Date(Date.now() - 7 * 86400000);
  const dayAfter = new Date(Date.now() - 6 * 86400000);
  const fresh = await db.member.findMany({
    where: { clubId, createdAt: { gte: weekAgo, lte: dayAfter } },
    take: 50,
  });
  for (const m of fresh) {
    const already = await db.message.findFirst({ where: { memberId: m.id, kind: "post_sale" } });
    if (already) continue;
    await queueMessage({
      clubId,
      kind: "post_sale",
      memberId: m.id,
      toName: m.name,
      phone: m.phone,
      vars: { الاسم: m.name },
    });
    postSale++;
  }

  return { expiry, winback, postSale };
}
