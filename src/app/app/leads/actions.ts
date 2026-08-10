"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { queueMessage } from "@/lib/whatsapp";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function saveLead(formData: FormData) {
  const user = await requireModule("leads");
  const id = str(formData, "leadId");
  const name = str(formData, "name");
  const phone = str(formData, "phone");
  const source = str(formData, "source") || "زيارة";
  const note = str(formData, "note") || null;
  const followUpRaw = str(formData, "followUpAt");
  const followUpAt = followUpRaw ? new Date(followUpRaw) : null;

  if (!name || !phone) return;

  if (id) {
    const existing = await db.lead.findFirst({ where: { id, clubId: user.clubId! } });
    if (!existing) return;
    await db.lead.update({
      where: { id },
      data: { name, phone, source, note, followUpAt, status: str(formData, "status") || existing.status },
    });
    await audit({ user, action: "update", entity: "lead", entityId: id, summary: `تعديل عميل محتمل «${name}»` });
  } else {
    const lead = await db.lead.create({
      data: {
        clubId: user.clubId!,
        name,
        phone,
        source,
        note,
        followUpAt,
        handledBy: user.name,
      },
    });
    await audit({ user, action: "create", entity: "lead", entityId: lead.id, summary: `تسجيل عميل محتمل «${name}» من ${source}` });
  }

  revalidatePath("/app/leads");
}

export async function setLeadStatus(formData: FormData) {
  const user = await requireModule("leads");
  const id = str(formData, "leadId");
  const status = str(formData, "status");
  if (!["new", "contacted", "trial", "converted", "lost"].includes(status)) return;

  const lead = await db.lead.findFirst({ where: { id, clubId: user.clubId! } });
  if (!lead) return;

  await db.lead.update({ where: { id }, data: { status, handledBy: user.name } });
  await audit({ user, action: "update", entity: "lead", entityId: id, summary: `تحديث حالة «${lead.name}» إلى ${status}` });
  revalidatePath("/app/leads");
}

export async function deleteLead(formData: FormData) {
  const user = await requireModule("leads");
  const id = str(formData, "leadId");
  const lead = await db.lead.findFirst({ where: { id, clubId: user.clubId! } });
  if (!lead) return;

  await db.lead.delete({ where: { id } });
  await audit({ user, action: "delete", entity: "lead", entityId: id, summary: `حذف عميل محتمل «${lead.name}»` });
  revalidatePath("/app/leads");
}

// رسالة متابعة للعميل المحتمل
export async function messageLead(formData: FormData) {
  const user = await requireModule("leads");
  const id = str(formData, "leadId");
  const body = str(formData, "body");
  if (!body) return;

  const lead = await db.lead.findFirst({ where: { id, clubId: user.clubId! } });
  if (!lead) return;

  await queueMessage({
    clubId: user.clubId!,
    kind: "manual",
    toName: lead.name,
    phone: lead.phone,
    body: body.replace(/\{الاسم\}/g, lead.name),
  });

  await db.lead.update({ where: { id }, data: { status: lead.status === "new" ? "contacted" : lead.status } });
  revalidatePath("/app/leads");
  revalidatePath("/app/messages");
}
