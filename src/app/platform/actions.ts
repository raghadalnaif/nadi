"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { hashPassword, requireSuperAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

const PLAN_FEES: Record<string, number> = { basic: 299, pro: 599, enterprise: 1299 };

// إنشاء نادٍ جديد + حساب المالك + باقات وحصص افتراضية
export async function createClub(formData: FormData) {
  const admin = await requireSuperAdmin();

  const name = str(formData, "name");
  const slug = str(formData, "slug").toLowerCase().replace(/\s+/g, "-");
  const ownerName = str(formData, "ownerName");
  const ownerEmail = str(formData, "ownerEmail").toLowerCase();
  const password = str(formData, "password") || "123456";
  const platformPlan = str(formData, "platformPlan") || "basic";
  const platformStatus = str(formData, "platformStatus") || "trial";

  if (!name || !slug || !ownerName || !ownerEmail) return;

  const clash = await db.club.findUnique({ where: { slug } });
  if (clash) return;
  const emailTaken = await db.user.findUnique({ where: { email: ownerEmail } });
  if (emailTaken) return;

  const endsAt = new Date();
  endsAt.setDate(endsAt.getDate() + (platformStatus === "trial" ? 14 : 30));

  const club = await db.club.create({
    data: {
      name,
      slug,
      phone: str(formData, "phone") || null,
      address: str(formData, "address") || null,
      vatNumber: str(formData, "vatNumber") || null,
      crNumber: str(formData, "crNumber") || null,
      platformPlan,
      platformFeeSAR: PLAN_FEES[platformPlan] ?? 299,
      platformStatus,
      platformEndsAt: endsAt,
      // باقات افتراضية يقدر النادي يعدلها لاحقاً
      plans: {
        create: [
          { name: "شهري", durationDays: 30, priceSAR: 299 },
          { name: "3 شهور", durationDays: 90, priceSAR: 749 },
          { name: "سنوي", durationDays: 365, priceSAR: 2199 },
        ],
      },
    },
  });

  await db.user.create({
    data: {
      clubId: club.id,
      name: ownerName,
      email: ownerEmail,
      passwordHash: hashPassword(password),
      role: "owner",
    },
  });

  await audit({
    user: admin,
    clubId: null,
    action: "create",
    entity: "club",
    entityId: club.id,
    summary: `إنشاء نادي «${name}» بباقة ${platformPlan} وحساب مالك ${ownerEmail}`,
  });

  revalidatePath("/platform");
}

export async function updateClub(formData: FormData) {
  const admin = await requireSuperAdmin();
  const id = str(formData, "clubId");
  const club = await db.club.findUnique({ where: { id } });
  if (!club) return;

  const name = str(formData, "name") || club.name;
  const platformPlan = str(formData, "platformPlan") || club.platformPlan;
  const feeRaw = Number(formData.get("platformFeeSAR"));

  await db.club.update({
    where: { id },
    data: {
      name,
      phone: str(formData, "phone") || null,
      address: str(formData, "address") || null,
      vatNumber: str(formData, "vatNumber") || null,
      crNumber: str(formData, "crNumber") || null,
      platformPlan,
      platformFeeSAR: Number.isFinite(feeRaw) && feeRaw > 0 ? feeRaw : PLAN_FEES[platformPlan] ?? club.platformFeeSAR,
    },
  });

  await audit({
    user: admin,
    clubId: null,
    action: "update",
    entity: "club",
    entityId: id,
    summary: `تعديل بيانات نادي «${name}»`,
  });

  revalidatePath("/platform");
  revalidatePath(`/platform/clubs/${id}`);
}

// إيقاف / تفعيل / تمديد اشتراك النادي في المنصة
export async function setClubStatus(formData: FormData) {
  const admin = await requireSuperAdmin();
  const id = str(formData, "clubId");
  const status = str(formData, "status");
  if (!["active", "trial", "suspended"].includes(status)) return;

  const club = await db.club.findUnique({ where: { id } });
  if (!club) return;

  await db.club.update({ where: { id }, data: { platformStatus: status } });
  await audit({
    user: admin,
    clubId: null,
    action: status === "suspended" ? "suspend" : "activate",
    entity: "club",
    entityId: id,
    summary: `تغيير حالة نادي «${club.name}» إلى ${status === "suspended" ? "موقوف" : status === "trial" ? "تجريبي" : "نشط"}`,
  });

  revalidatePath("/platform");
  revalidatePath(`/platform/clubs/${id}`);
}

export async function extendClub(formData: FormData) {
  const admin = await requireSuperAdmin();
  const id = str(formData, "clubId");
  const months = Math.max(1, Math.min(12, Number(formData.get("months")) || 1));

  const club = await db.club.findUnique({ where: { id } });
  if (!club) return;

  const base = club.platformEndsAt > new Date() ? club.platformEndsAt : new Date();
  const endsAt = new Date(base);
  endsAt.setMonth(endsAt.getMonth() + months);

  await db.club.update({
    where: { id },
    data: { platformEndsAt: endsAt, platformStatus: "active" },
  });

  // إصدار فواتير المنصة عن المدة المضافة
  for (let i = 0; i < months; i++) {
    const d = new Date(base);
    d.setMonth(d.getMonth() + i);
    await db.platformInvoice
      .create({
        data: { clubId: id, month: monthKey(d), amountSAR: club.platformFeeSAR, status: "unpaid" },
      })
      .catch(() => {});
  }

  await audit({
    user: admin,
    clubId: null,
    action: "update",
    entity: "club",
    entityId: id,
    summary: `تمديد اشتراك نادي «${club.name}» ${months} شهر`,
  });

  revalidatePath("/platform");
  revalidatePath(`/platform/clubs/${id}`);
}

export async function deleteClub(formData: FormData) {
  const admin = await requireSuperAdmin();
  const id = str(formData, "clubId");
  const confirmName = str(formData, "confirmName");

  const club = await db.club.findUnique({ where: { id } });
  if (!club || confirmName !== club.name) return;

  // حذف يدوي مرتب لأن SQLite لا يحذف كل الفروع تلقائياً
  await db.$transaction([
    db.payment.deleteMany({ where: { invoice: { clubId: id } } }),
    db.invoiceItem.deleteMany({ where: { invoice: { clubId: id } } }),
    db.invoice.deleteMany({ where: { clubId: id } }),
    db.booking.deleteMany({ where: { member: { clubId: id } } }),
    db.classSession.deleteMany({ where: { gymClass: { clubId: id } } }),
    db.gymClass.deleteMany({ where: { clubId: id } }),
    db.attendance.deleteMany({ where: { member: { clubId: id } } }),
    db.subscription.deleteMany({ where: { member: { clubId: id } } }),
    db.plan.deleteMany({ where: { clubId: id } }),
    db.member.deleteMany({ where: { clubId: id } }),
    db.staffAttendance.deleteMany({ where: { employee: { clubId: id } } }),
    db.payroll.deleteMany({ where: { employee: { clubId: id } } }),
    db.leave.deleteMany({ where: { employee: { clubId: id } } }),
    db.employee.deleteMany({ where: { clubId: id } }),
    db.expense.deleteMany({ where: { clubId: id } }),
    db.platformInvoice.deleteMany({ where: { clubId: id } }),
    db.user.deleteMany({ where: { clubId: id } }),
    db.club.delete({ where: { id } }),
  ]);

  await audit({
    user: admin,
    clubId: null,
    action: "delete",
    entity: "club",
    entityId: id,
    summary: `حذف نادي «${club.name}» وكل بياناته نهائياً`,
  });

  redirect("/platform");
}

export async function payPlatformInvoice(formData: FormData) {
  const admin = await requireSuperAdmin();
  const id = str(formData, "invoiceId");

  const inv = await db.platformInvoice.findUnique({ where: { id }, include: { club: true } });
  if (!inv || inv.status === "paid") return;

  await db.platformInvoice.update({
    where: { id },
    data: { status: "paid", paidAt: new Date() },
  });

  await audit({
    user: admin,
    clubId: null,
    action: "pay",
    entity: "platform_invoice",
    entityId: id,
    summary: `تحصيل اشتراك ${inv.month} من نادي «${inv.club.name}»`,
  });

  revalidatePath(`/platform/clubs/${inv.clubId}`);
  revalidatePath("/platform");
}

// إنشاء مستخدم داخل أي نادٍ (لدعم العملاء)
export async function createClubUser(formData: FormData) {
  const admin = await requireSuperAdmin();
  const clubId = str(formData, "clubId");
  const email = str(formData, "email").toLowerCase();
  const name = str(formData, "name");
  const role = str(formData, "role");
  const password = str(formData, "password") || "123456";

  if (!email || !name || !["owner", "manager", "accountant", "hr", "reception"].includes(role)) return;
  if (await db.user.findUnique({ where: { email } })) return;

  await db.user.create({
    data: { clubId, name, email, role, passwordHash: hashPassword(password) },
  });

  await audit({
    user: admin,
    clubId: null,
    action: "create",
    entity: "user",
    summary: `إنشاء مستخدم ${email} بدور ${role}`,
  });

  revalidatePath(`/platform/clubs/${clubId}`);
}

export async function resetUserPassword(formData: FormData) {
  const admin = await requireSuperAdmin();
  const userId = str(formData, "userId");
  const password = str(formData, "password") || "123456";

  const target = await db.user.findUnique({ where: { id: userId } });
  if (!target) return;

  await db.user.update({ where: { id: userId }, data: { passwordHash: hashPassword(password) } });
  await audit({
    user: admin,
    clubId: null,
    action: "update",
    entity: "user",
    entityId: userId,
    summary: `تصفير كلمة مرور ${target.email}`,
  });

  revalidatePath(`/platform/clubs/${target.clubId}`);
}
