import { db } from "./db";

// يسجّل كل إجراء إداري — من فعله، على ماذا، ومتى
export async function audit(input: {
  user: { id: string; name: string; clubId?: string | null };
  action: "create" | "update" | "delete" | "pay" | "suspend" | "activate";
  entity: string;
  entityId?: string;
  summary: string;
  clubId?: string | null;
}) {
  await db.auditLog.create({
    data: {
      clubId: input.clubId ?? input.user.clubId ?? null,
      userId: input.user.id,
      userName: input.user.name,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      summary: input.summary,
    },
  });
}

export const ACTION_LABEL: Record<string, string> = {
  create: "إضافة",
  update: "تعديل",
  delete: "حذف",
  pay: "تحصيل",
  suspend: "إيقاف",
  activate: "تفعيل",
};
