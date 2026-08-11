"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireEmployee, requireModule } from "@/lib/auth";
import { audit } from "@/lib/audit";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

// الموظف يرفع طلب إجازة بنفسه
export async function requestLeave(formData: FormData) {
  const user = await requireEmployee();
  const type = str(formData, "type") || "سنوية";
  const startsAt = new Date(str(formData, "startsAt"));
  const endsAt = new Date(str(formData, "endsAt"));
  const note = str(formData, "note") || null;

  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) return;
  if (endsAt < startsAt) return;

  await db.leave.create({
    data: {
      employeeId: user.employeeId!,
      type,
      startsAt,
      endsAt,
      note,
      status: "pending",
      requestedBy: user.name,
    },
  });

  revalidatePath("/me");
  revalidatePath("/app/hr");
}

export async function cancelMyLeave(formData: FormData) {
  const user = await requireEmployee();
  const id = str(formData, "leaveId");

  const leave = await db.leave.findFirst({
    where: { id, employeeId: user.employeeId!, status: "pending" },
  });
  if (!leave) return;

  await db.leave.delete({ where: { id } });
  revalidatePath("/me");
}

// قرار الموارد البشرية على الطلب مع سبب
export async function decideLeaveRequest(formData: FormData) {
  const user = await requireModule("hr");
  const id = str(formData, "leaveId");
  const decision = str(formData, "decision");
  const decisionNote = str(formData, "decisionNote") || null;
  if (!["approved", "rejected"].includes(decision)) return;

  const leave = await db.leave.findFirst({
    where: { id, employee: { clubId: user.clubId! } },
    include: { employee: true },
  });
  if (!leave) return;

  await db.leave.update({
    where: { id },
    data: { status: decision, decidedBy: user.name, decidedAt: new Date(), decisionNote },
  });

  // الموافقة تحدّث حالة الموظف إلى «في إجازة» عند بدئها
  if (decision === "approved" && leave.startsAt <= new Date() && leave.endsAt >= new Date()) {
    await db.employee.update({ where: { id: leave.employeeId }, data: { status: "on_leave" } });
  }

  await audit({
    user,
    action: "update",
    entity: "leave",
    entityId: id,
    summary: `${decision === "approved" ? "قبول" : "رفض"} إجازة «${leave.employee.name}»`,
  });

  revalidatePath("/app/hr");
  revalidatePath("/me");
}

// التقييم السنوي
export async function saveEvaluation(formData: FormData) {
  const user = await requireModule("hr");
  const employeeId = str(formData, "employeeId");
  const year = Number(formData.get("year")) || new Date().getFullYear();

  const emp = await db.employee.findFirst({ where: { id: employeeId, clubId: user.clubId! } });
  if (!emp) return;

  const clamp = (k: string) => Math.min(5, Math.max(1, Number(formData.get(k)) || 3));
  const attendance = clamp("attendance");
  const performance = clamp("performance");
  const teamwork = clamp("teamwork");
  const discipline = clamp("discipline");
  const overall = Math.round(((attendance + performance + teamwork + discipline) / 4) * 100) / 100;

  await db.evaluation.upsert({
    where: { employeeId_year: { employeeId, year } },
    create: {
      employeeId,
      year,
      attendance,
      performance,
      teamwork,
      discipline,
      overall,
      notes: str(formData, "notes") || null,
      byName: user.name,
    },
    update: {
      attendance,
      performance,
      teamwork,
      discipline,
      overall,
      notes: str(formData, "notes") || null,
      byName: user.name,
    },
  });

  await audit({
    user,
    action: "update",
    entity: "evaluation",
    entityId: employeeId,
    summary: `تقييم ${year} لـ «${emp.name}»: ${overall} من 5`,
  });

  revalidatePath(`/app/hr/${employeeId}`);
  revalidatePath("/me");
}
