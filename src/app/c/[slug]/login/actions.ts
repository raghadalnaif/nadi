"use server";

import { redirect } from "next/navigation";
import { createSession } from "@/lib/auth";
import { requestOtp, verifyOtp } from "@/lib/otp";

export type ClubLoginState =
  | { step: "phone"; slug: string; error?: string }
  | { step: "code"; slug: string; phone: string; note: string; devCode?: string; error?: string };

// الخطوة الأولى: إرسال الرمز — البحث مقصور على مشتركي هذا النادي
export async function sendClubCode(
  _prev: ClubLoginState | null,
  formData: FormData
): Promise<ClubLoginState> {
  const slug = String(formData.get("slug") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  if (!phone) return { step: "phone", slug, error: "أدخل رقم جوالك" };

  const result = await requestOtp(phone, slug);
  if (!result.ok) return { step: "phone", slug, error: result.message };

  return { step: "code", slug, phone, note: result.message, devCode: result.devCode };
}

// الخطوة الثانية: التحقق وفتح بوابة النادي
export async function checkClubCode(
  _prev: ClubLoginState | null,
  formData: FormData
): Promise<ClubLoginState> {
  const slug = String(formData.get("slug") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();

  const result = await verifyOtp(phone, code, slug);
  if (!result.ok) return { step: "code", slug, phone, note: "", error: result.message };

  await createSession(result.userId);
  redirect(`/c/${slug}`);
}
