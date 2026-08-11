"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { hashPassword, requireModule } from "@/lib/auth";
import { audit } from "@/lib/audit";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const numOf = (fd: FormData, k: string) => Number(fd.get(k));

// ───────── الباقات ─────────

export async function savePlan(formData: FormData) {
  const user = await requireModule("subscriptions");
  const id = str(formData, "planId");
  const name = str(formData, "name");
  const durationDays = numOf(formData, "durationDays");
  const priceSAR = numOf(formData, "priceSAR");
  if (!name || !(durationDays > 0) || !(priceSAR >= 0)) return;

  if (id) {
    const existing = await db.plan.findFirst({ where: { id, clubId: user.clubId! } });
    if (!existing) return;
    await db.plan.update({ where: { id }, data: { name, durationDays, priceSAR } });
    await audit({ user, action: "update", entity: "plan", entityId: id, summary: `تعديل باقة «${name}»` });
  } else {
    const plan = await db.plan.create({
      data: { clubId: user.clubId!, name, durationDays, priceSAR },
    });
    await audit({ user, action: "create", entity: "plan", entityId: plan.id, summary: `إضافة باقة «${name}» بسعر ${priceSAR} ر.س` });
  }

  revalidatePath("/app/subscriptions");
}

export async function togglePlan(formData: FormData) {
  const user = await requireModule("subscriptions");
  const id = str(formData, "planId");
  const plan = await db.plan.findFirst({ where: { id, clubId: user.clubId! } });
  if (!plan) return;

  await db.plan.update({ where: { id }, data: { active: !plan.active } });
  await audit({
    user,
    action: "update",
    entity: "plan",
    entityId: id,
    summary: `${plan.active ? "تعطيل" : "تفعيل"} باقة «${plan.name}»`,
  });
  revalidatePath("/app/subscriptions");
}

export async function deletePlan(formData: FormData) {
  const user = await requireModule("subscriptions");
  const id = str(formData, "planId");
  const plan = await db.plan.findFirst({
    where: { id, clubId: user.clubId! },
    include: { _count: { select: { subscriptions: true } } },
  });
  if (!plan) return;

  // باقة مستخدمة لا تُحذف — تُعطَّل فقط حفاظاً على سجل الاشتراكات
  if (plan._count.subscriptions > 0) {
    await db.plan.update({ where: { id }, data: { active: false } });
    await audit({ user, action: "update", entity: "plan", entityId: id, summary: `تعطيل باقة «${plan.name}» (مستخدمة في اشتراكات سابقة)` });
  } else {
    await db.plan.delete({ where: { id } });
    await audit({ user, action: "delete", entity: "plan", entityId: id, summary: `حذف باقة «${plan.name}»` });
  }
  revalidatePath("/app/subscriptions");
}

// ───────── الأعضاء ─────────

export async function updateMember(formData: FormData) {
  const user = await requireModule("subscriptions");
  const id = str(formData, "memberId");
  const member = await db.member.findFirst({ where: { id, clubId: user.clubId! } });
  if (!member) return;

  const name = str(formData, "name") || member.name;
  await db.member.update({
    where: { id },
    data: {
      name,
      phone: str(formData, "phone") || member.phone,
      gender: str(formData, "gender") || member.gender,
      notes: str(formData, "notes") || null,
    },
  });
  await audit({ user, action: "update", entity: "member", entityId: id, summary: `تعديل بيانات العضو «${name}»` });
  revalidatePath("/app/subscriptions");
  revalidatePath(`/app/subscriptions/${id}`);
}

export async function deleteMember(formData: FormData) {
  const user = await requireModule("subscriptions");
  const id = str(formData, "memberId");
  const member = await db.member.findFirst({ where: { id, clubId: user.clubId! } });
  if (!member) return;

  // الفواتير مستندات ضريبية — تبقى محفوظة ويُفصل ارتباطها بالعضو
  await db.invoice.updateMany({ where: { memberId: id }, data: { memberId: null } });
  await db.member.delete({ where: { id } });

  await audit({
    user,
    action: "delete",
    entity: "member",
    entityId: id,
    summary: `حذف العضو «${member.name}» (الفواتير محفوظة)`,
  });
  redirect("/app/subscriptions");
}

export async function cancelSubscription(formData: FormData) {
  const user = await requireModule("subscriptions");
  const id = str(formData, "subId");
  const sub = await db.subscription.findFirst({
    where: { id, member: { clubId: user.clubId! } },
    include: { member: true },
  });
  if (!sub) return;

  await db.subscription.update({ where: { id }, data: { status: "cancelled" } });
  await audit({ user, action: "update", entity: "subscription", entityId: id, summary: `إلغاء اشتراك «${sub.member.name}»` });
  revalidatePath("/app/subscriptions");
}

// ───────── الحصص ─────────

export async function saveClass(formData: FormData) {
  const user = await requireModule("schedule");
  const id = str(formData, "classId");
  const name = str(formData, "name");
  const coach = str(formData, "coach");
  const durationMin = numOf(formData, "durationMin");
  const capacity = numOf(formData, "capacity");
  if (!name || !coach || !(durationMin > 0) || !(capacity > 0)) return;

  if (id) {
    const existing = await db.gymClass.findFirst({ where: { id, clubId: user.clubId! } });
    if (!existing) return;
    await db.gymClass.update({ where: { id }, data: { name, coach, durationMin, capacity } });
    await audit({ user, action: "update", entity: "class", entityId: id, summary: `تعديل حصة «${name}»` });
    revalidatePath("/app/schedule");
    return;
  }

  const gymClass = await db.gymClass.create({
    data: { clubId: user.clubId!, name, coach, durationMin, capacity },
  });

  // توليد جلسات الأسبوع القادم في الوقت المحدد
  const hour = Math.min(23, Math.max(0, numOf(formData, "hour") || 18));
  const days = Math.min(30, Math.max(1, numOf(formData, "days") || 7));
  for (let d = 0; d < days; d++) {
    const startsAt = new Date();
    startsAt.setDate(startsAt.getDate() + d);
    startsAt.setHours(hour, 0, 0, 0);
    await db.classSession.create({ data: { classId: gymClass.id, startsAt, capacity } });
  }

  await audit({
    user,
    action: "create",
    entity: "class",
    entityId: gymClass.id,
    summary: `إضافة حصة «${name}» مع ${days} جلسة`,
  });
  revalidatePath("/app/schedule");
}

export async function deleteClass(formData: FormData) {
  const user = await requireModule("schedule");
  const id = str(formData, "classId");
  const gymClass = await db.gymClass.findFirst({ where: { id, clubId: user.clubId! } });
  if (!gymClass) return;

  await db.gymClass.delete({ where: { id } }); // الجلسات والحجوزات تُحذف تلقائياً
  await audit({ user, action: "delete", entity: "class", entityId: id, summary: `حذف حصة «${gymClass.name}» وكل جلساتها` });
  revalidatePath("/app/schedule");
}

// إلغاء حجز مع ترقية أول شخص في قائمة الانتظار تلقائياً
export async function cancelBooking(formData: FormData) {
  const user = await requireModule("schedule");
  const id = str(formData, "bookingId");

  const booking = await db.booking.findFirst({
    where: { id, member: { clubId: user.clubId! } },
    include: { member: true, session: true },
  });
  if (!booking) return;

  await db.booking.delete({ where: { id } });

  let promoted: string | null = null;
  if (booking.status === "booked") {
    const next = await db.booking.findFirst({
      where: { sessionId: booking.sessionId, status: "waitlist" },
      orderBy: { createdAt: "asc" },
      include: { member: true },
    });
    if (next) {
      await db.booking.update({ where: { id: next.id }, data: { status: "booked" } });
      promoted = next.member.name;
    }
  }

  await audit({
    user,
    action: "delete",
    entity: "booking",
    entityId: id,
    summary: `إلغاء حجز «${booking.member.name}»${promoted ? ` وترقية «${promoted}» من قائمة الانتظار` : ""}`,
  });
  revalidatePath("/app/schedule");
}

// ───────── الموظفون ─────────

export async function saveEmployee(formData: FormData) {
  const user = await requireModule("hr");
  const id = str(formData, "employeeId");
  const name = str(formData, "name");
  const jobTitle = str(formData, "jobTitle");
  const department = str(formData, "department");
  const salarySAR = numOf(formData, "salarySAR");
  const phone = str(formData, "phone");
  if (!name || !jobTitle || !(salarySAR > 0)) return;

  if (id) {
    const existing = await db.employee.findFirst({ where: { id, clubId: user.clubId! } });
    if (!existing) return;
    await db.employee.update({
      where: { id },
      data: { name, jobTitle, department, salarySAR, phone, iban: str(formData, "iban") || null, status: str(formData, "status") || existing.status },
    });
    await audit({ user, action: "update", entity: "employee", entityId: id, summary: `تعديل بيانات الموظف «${name}»` });
  } else {
    const emp = await db.employee.create({
      data: {
        clubId: user.clubId!,
        branchId: user.branchId,
        name,
        jobTitle,
        department: department || "إدارة",
        salarySAR,
        phone,
        iban: str(formData, "iban") || null,
        hireDate: new Date(),
        barcode: `E${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      },
    });

    // حساب دخول تلقائي للموظف — يرى ملفه وإجازاته وتقييمه
    const email = str(formData, "email").toLowerCase() ||
      `${phone.replace(/\D/g, "")}@staff.local`;
    const taken = await db.user.findUnique({ where: { email } });
    if (!taken) {
      const account = await db.user.create({
        data: {
          clubId: user.clubId!,
          branchId: user.branchId,
          employeeId: emp.id,
          name,
          email,
          role: "employee",
          passwordHash: hashPassword(str(formData, "password") || "123456"),
        },
      });
      await audit({
        user,
        action: "create",
        entity: "user",
        entityId: account.id,
        summary: `إنشاء حساب دخول للموظف «${name}» (${email})`,
      });
    }

    await audit({ user, action: "create", entity: "employee", entityId: emp.id, summary: `إضافة الموظف «${name}» براتب ${salarySAR} ر.س` });
  }

  revalidatePath("/app/hr");
}

export async function deleteEmployee(formData: FormData) {
  const user = await requireModule("hr");
  const id = str(formData, "employeeId");
  const emp = await db.employee.findFirst({ where: { id, clubId: user.clubId! } });
  if (!emp) return;

  await db.employee.delete({ where: { id } });
  await audit({ user, action: "delete", entity: "employee", entityId: id, summary: `حذف الموظف «${emp.name}»` });
  revalidatePath("/app/hr");
}

// إنشاء مسير رواتب الشهر لكل الموظفين النشطين
export async function generatePayroll(formData: FormData) {
  const user = await requireModule("hr");
  const month = str(formData, "month");
  if (!/^\d{4}-\d{2}$/.test(month)) return;

  const employees = await db.employee.findMany({ where: { clubId: user.clubId!, status: "active" } });
  let created = 0;
  for (const e of employees) {
    const done = await db.payroll
      .create({
        data: { employeeId: e.id, month, baseSAR: e.salarySAR, netSAR: e.salarySAR },
      })
      .catch(() => null);
    if (done) created++;
  }

  await audit({ user, action: "create", entity: "payroll", summary: `إنشاء مسير رواتب ${month} لـ ${created} موظف` });
  revalidatePath("/app/hr");
}

export async function addLeave(formData: FormData) {
  const user = await requireModule("hr");
  const employeeId = str(formData, "employeeId");
  const type = str(formData, "type");
  const startsAt = new Date(str(formData, "startsAt"));
  const endsAt = new Date(str(formData, "endsAt"));
  if (!employeeId || Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) return;

  const emp = await db.employee.findFirst({ where: { id: employeeId, clubId: user.clubId! } });
  if (!emp) return;

  await db.leave.create({
    data: { employeeId, type: type || "سنوية", startsAt, endsAt, note: str(formData, "note") || null },
  });
  await audit({ user, action: "create", entity: "leave", summary: `تسجيل طلب إجازة ${type} لـ «${emp.name}»` });
  revalidatePath("/app/hr");
}

// ───────── المصروفات ─────────

export async function deleteExpense(formData: FormData) {
  const user = await requireModule("accounting");
  const id = str(formData, "expenseId");
  const exp = await db.expense.findFirst({ where: { id, clubId: user.clubId! } });
  if (!exp) return;

  await db.expense.delete({ where: { id } });
  await audit({ user, action: "delete", entity: "expense", entityId: id, summary: `حذف مصروف «${exp.description}» بمبلغ ${exp.amountSAR} ر.س` });
  revalidatePath("/app/accounting");
}

// ───────── مستخدمو النادي (الإعدادات) ─────────

export async function saveClubProfile(formData: FormData) {
  const user = await requireModule("settings");
  const name = str(formData, "name");
  if (!name) return;

  await db.club.update({
    where: { id: user.clubId! },
    data: {
      name,
      phone: str(formData, "phone") || null,
      address: str(formData, "address") || null,
      vatNumber: str(formData, "vatNumber") || null,
      crNumber: str(formData, "crNumber") || null,
    },
  });
  await audit({ user, action: "update", entity: "club", entityId: user.clubId!, summary: `تعديل بيانات النادي` });
  revalidatePath("/app/settings");
}

export async function createUser(formData: FormData) {
  const user = await requireModule("settings");
  const email = str(formData, "email").toLowerCase();
  const name = str(formData, "name");
  const role = str(formData, "role");
  const password = str(formData, "password") || "123456";

  if (!email || !name || !["owner", "manager", "accountant", "hr", "reception"].includes(role)) return;
  if (await db.user.findUnique({ where: { email } })) return;

  await db.user.create({
    data: { clubId: user.clubId!, name, email, role, passwordHash: hashPassword(password) },
  });
  await audit({ user, action: "create", entity: "user", summary: `إضافة مستخدم ${email} بدور ${role}` });
  revalidatePath("/app/settings");
}

export async function updateUser(formData: FormData) {
  const user = await requireModule("settings");
  const id = str(formData, "userId");
  const role = str(formData, "role");

  const target = await db.user.findFirst({ where: { id, clubId: user.clubId! } });
  if (!target) return;
  if (!["owner", "manager", "accountant", "hr", "reception"].includes(role)) return;

  await db.user.update({
    where: { id },
    data: { name: str(formData, "name") || target.name, role },
  });
  await audit({ user, action: "update", entity: "user", entityId: id, summary: `تعديل صلاحية ${target.email} إلى ${role}` });
  revalidatePath("/app/settings");
}

export async function toggleUser(formData: FormData) {
  const user = await requireModule("settings");
  const id = str(formData, "userId");

  const target = await db.user.findFirst({ where: { id, clubId: user.clubId! } });
  if (!target || target.id === user.id) return; // لا يوقف نفسه

  await db.user.update({ where: { id }, data: { active: !target.active } });
  await audit({
    user,
    action: target.active ? "suspend" : "activate",
    entity: "user",
    entityId: id,
    summary: `${target.active ? "إيقاف" : "تفعيل"} المستخدم ${target.email}`,
  });
  revalidatePath("/app/settings");
}

export async function deleteUser(formData: FormData) {
  const user = await requireModule("settings");
  const id = str(formData, "userId");

  const target = await db.user.findFirst({ where: { id, clubId: user.clubId! } });
  if (!target || target.id === user.id) return; // لا يحذف نفسه

  await db.user.delete({ where: { id } });
  await audit({ user, action: "delete", entity: "user", entityId: id, summary: `حذف المستخدم ${target.email}` });
  revalidatePath("/app/settings");
}

export async function changeMyPassword(formData: FormData) {
  const user = await requireModule("settings");
  const password = str(formData, "password");
  if (password.length < 6) return;

  await db.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(password) } });
  await audit({ user, action: "update", entity: "user", entityId: user.id, summary: `تغيير كلمة المرور الشخصية` });
  revalidatePath("/app/settings");
}
