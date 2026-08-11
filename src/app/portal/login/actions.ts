"use server";

import { redirect } from "next/navigation";
import { createSession } from "@/lib/auth";
import { requestOtp, verifyOtp } from "@/lib/otp";

export type LoginState =
  | { step: "phone"; error?: string }
  | { step: "code"; phone: string; note: string; devCode?: string; error?: string };

// الخطوة الأولى: إرسال الرمز للجوال
export async function sendCode(_prev: LoginState | null, formData: FormData): Promise<LoginState> {
  const phone = String(formData.get("phone") ?? "").trim();
  if (!phone) return { step: "phone", error: "أدخل رقم جوالك" };

  const result = await requestOtp(phone);
  if (!result.ok) return { step: "phone", error: result.message };

  return { step: "code", phone, note: result.message, devCode: result.devCode };
}

// الخطوة الثانية: التحقق وإنشاء الجلسة
export async function checkCode(_prev: LoginState | null, formData: FormData): Promise<LoginState> {
  const phone = String(formData.get("phone") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();

  const result = await verifyOtp(phone, code);
  if (!result.ok) {
    return { step: "code", phone, note: "", error: result.message };
  }

  await createSession(result.userId);
  redirect("/portal");
}
