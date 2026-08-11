"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireModule, requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function postAnnouncement(formData: FormData) {
  const user = await requireModule("board");
  const title = str(formData, "title");
  const body = str(formData, "body");
  const kind = str(formData, "kind") || "announcement";
  const audience = str(formData, "audience") || "all";
  if (!title || !body) return;

  // الموظف العادي لا ينشر — فقط الإدارة
  if (!["owner", "branch_manager", "manager", "hr"].includes(user.role)) return;

  const a = await db.announcement.create({
    data: {
      clubId: user.clubId!,
      branchId: user.branchId,
      title,
      body,
      kind,
      audience,
      department: str(formData, "department") || null,
      authorId: user.id,
      authorName: user.name,
      pinned: formData.get("pinned") === "on",
    },
  });

  await audit({ user, action: "create", entity: "announcement", entityId: a.id, summary: `نشر «${title}»` });
  revalidatePath("/app/board");
  revalidatePath("/me");
}

export async function deleteAnnouncement(formData: FormData) {
  const user = await requireModule("board");
  const id = str(formData, "announcementId");

  const a = await db.announcement.findFirst({ where: { id, clubId: user.clubId! } });
  if (!a) return;
  // الكاتب أو المالك فقط
  if (a.authorId !== user.id && user.role !== "owner") return;

  await db.announcement.delete({ where: { id } });
  await audit({ user, action: "delete", entity: "announcement", entityId: id, summary: `حذف «${a.title}»` });
  revalidatePath("/app/board");
}

// تسجيل اطلاع — يعرف المدير من قرأ الخطاب
export async function markRead(formData: FormData) {
  const user = await requireUser();
  const id = str(formData, "announcementId");
  if (!user.clubId) return;

  const a = await db.announcement.findFirst({ where: { id, clubId: user.clubId } });
  if (!a) return;

  await db.announcementRead
    .create({ data: { announcementId: id, userId: user.id, userName: user.name } })
    .catch(() => {});

  revalidatePath("/app/board");
  revalidatePath("/me");
}
