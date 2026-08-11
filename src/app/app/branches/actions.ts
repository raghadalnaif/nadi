"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { hashPassword, requireModule } from "@/lib/auth";
import { audit } from "@/lib/audit";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function saveBranch(formData: FormData) {
  const user = await requireModule("branches");
  const id = str(formData, "branchId");
  const name = str(formData, "name");
  if (!name) return;

  const data = {
    name,
    address: str(formData, "address") || null,
    phone: str(formData, "phone") || null,
  };

  if (id) {
    const existing = await db.branch.findFirst({ where: { id, clubId: user.clubId! } });
    if (!existing) return;
    await db.branch.update({ where: { id }, data });
    await audit({ user, action: "update", entity: "branch", entityId: id, summary: `تعديل فرع «${name}»` });
  } else {
    const count = await db.branch.count({ where: { clubId: user.clubId! } });
    const branch = await db.branch.create({
      data: { ...data, clubId: user.clubId!, isMain: count === 0 },
    });
    await audit({ user, action: "create", entity: "branch", entityId: branch.id, summary: `إضافة فرع «${name}»` });
  }

  revalidatePath("/app/branches");
}

export async function toggleBranch(formData: FormData) {
  const user = await requireModule("branches");
  const id = str(formData, "branchId");
  const branch = await db.branch.findFirst({ where: { id, clubId: user.clubId! } });
  if (!branch) return;

  await db.branch.update({ where: { id }, data: { active: !branch.active } });
  await audit({
    user,
    action: branch.active ? "suspend" : "activate",
    entity: "branch",
    entityId: id,
    summary: `${branch.active ? "إيقاف" : "تفعيل"} فرع «${branch.name}»`,
  });
  revalidatePath("/app/branches");
}

export async function deleteBranch(formData: FormData) {
  const user = await requireModule("branches");
  const id = str(formData, "branchId");

  const branch = await db.branch.findFirst({
    where: { id, clubId: user.clubId! },
    include: { _count: { select: { members: true, employees: true, invoices: true } } },
  });
  if (!branch || branch.isMain) return; // الفرع الرئيسي لا يُحذف

  // البيانات تُفصل عن الفرع ولا تُحذف
  await db.branch.delete({ where: { id } });
  await audit({
    user,
    action: "delete",
    entity: "branch",
    entityId: id,
    summary: `حذف فرع «${branch.name}» (بياناته بقيت بلا فرع)`,
  });
  revalidatePath("/app/branches");
}

// تعيين مدير للفرع — ينشئ حسابه ويقيّده بفرعه
export async function assignBranchManager(formData: FormData) {
  const user = await requireModule("branches");
  const branchId = str(formData, "branchId");
  const name = str(formData, "name");
  const email = str(formData, "email").toLowerCase();
  const password = str(formData, "password") || "123456";

  const branch = await db.branch.findFirst({ where: { id: branchId, clubId: user.clubId! } });
  if (!branch || !name || !email) return;
  if (await db.user.findUnique({ where: { email } })) return;

  await db.user.create({
    data: {
      clubId: user.clubId!,
      branchId,
      name,
      email,
      role: "branch_manager",
      passwordHash: hashPassword(password),
    },
  });

  await audit({
    user,
    action: "create",
    entity: "user",
    summary: `تعيين ${name} مديراً لفرع «${branch.name}»`,
  });
  revalidatePath("/app/branches");
}

// نقل عضو أو موظف لفرع آخر
export async function moveToBranch(formData: FormData) {
  const user = await requireModule("branches");
  const kind = str(formData, "kind"); // member | employee
  const id = str(formData, "recordId");
  const branchId = str(formData, "branchId") || null;

  if (kind === "member") {
    const m = await db.member.findFirst({ where: { id, clubId: user.clubId! } });
    if (!m) return;
    await db.member.update({ where: { id }, data: { branchId } });
  } else if (kind === "employee") {
    const e = await db.employee.findFirst({ where: { id, clubId: user.clubId! } });
    if (!e) return;
    await db.employee.update({ where: { id }, data: { branchId } });
  }

  revalidatePath("/app/branches");
}
