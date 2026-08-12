"use client";

import { useState } from "react";
import { Check, Copy, Smartphone, Users } from "lucide-react";

// كل الحسابات التجريبية — الضغط على أي حساب يملأ نموذج الدخول مباشرة
export const DEMO_ACCOUNTS = [
  { role: "مزوّد الحل", email: "admin@nadi.sa", sees: "الأندية وإيرادك الشهري" },
  { role: "مالك النادي", email: "owner@club.sa", sees: "كل الأقسام والفروع" },
  { role: "مدير فرع", email: "branch@club.sa", sees: "فرع النرجس فقط" },
  { role: "مدير", email: "manager@club.sa", sees: "التشغيل بلا محاسبة" },
  { role: "محاسب", email: "accountant@club.sa", sees: "المحاسبة والتقارير" },
  { role: "موارد بشرية", email: "hr@club.sa", sees: "الموظفون والرواتب" },
  { role: "استقبال", email: "reception@club.sa", sees: "التحضير والكاشير" },
  { role: "موظف", email: "staff@club.sa", sees: "ملفه وإجازاته وتقييمه" },
  { role: "مشترك", email: "member@club.sa", sees: "بطاقته وحجوزاته" },
];

export function DemoAccounts() {
  const [copied, setCopied] = useState<string | null>(null);

  // نملأ الحقول في النموذج المجاور بدل أن يكتبها المستخدم
  const fill = (email: string) => {
    const form = document.querySelector<HTMLFormElement>("form");
    const emailInput = form?.querySelector<HTMLInputElement>('input[name="email"]');
    const passInput = form?.querySelector<HTMLInputElement>('input[name="password"]');
    if (emailInput) {
      emailInput.value = email;
      emailInput.dispatchEvent(new Event("input", { bubbles: true }));
    }
    if (passInput) {
      passInput.value = "123456";
      passInput.dispatchEvent(new Event("input", { bubbles: true }));
    }
    setCopied(email);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="mt-7 pt-6 border-t border-slate-100">
      <p className="text-xs text-slate-500 mb-3 flex items-center gap-1.5">
        <Users className="w-3.5 h-3.5" />
        حسابات للتجربة — اضغط أي حساب ليُملأ تلقائياً (كلمة المرور <b>123456</b>)
      </p>

      <div className="grid sm:grid-cols-2 gap-1.5">
        {DEMO_ACCOUNTS.map((a) => (
          <button
            key={a.email}
            type="button"
            onClick={() => fill(a.email)}
            className="text-right rounded-xl border border-slate-200 px-3 py-2 hover:border-emerald-300 hover:bg-emerald-50/40 transition group"
          >
            <span className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-800">{a.role}</span>
              {copied === a.email ? (
                <Check className="w-3 h-3 text-emerald-600" />
              ) : (
                <Copy className="w-3 h-3 text-slate-300 group-hover:text-emerald-500" />
              )}
            </span>
            <span className="block text-[11px] text-slate-400 truncate" dir="ltr">
              {a.email}
            </span>
          </button>
        ))}
      </div>

      <a
        href="/portal/login"
        className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 ring-1 ring-emerald-100 px-3.5 py-2.5 hover:bg-emerald-100/60 transition"
      >
        <Smartphone className="w-4 h-4 text-emerald-600 shrink-0" />
        <span className="min-w-0">
          <span className="block text-xs font-bold text-emerald-800">
            دخول المشترك برقم الجوال
          </span>
          <span className="block text-[11px] text-emerald-700" dir="ltr">
            0550000257
          </span>
        </span>
      </a>
    </div>
  );
}
