"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, ArrowLeft, Lock, Mail } from "lucide-react";
import { login } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full h-12 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 active:scale-[0.99] transition disabled:opacity-60 flex items-center justify-center gap-2"
    >
      {pending ? "جارٍ الدخول…" : "تسجيل الدخول"}
      {!pending && <ArrowLeft className="w-4 h-4" />}
    </button>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState(login, null as { error?: string } | null);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
          البريد الإلكتروني
        </label>
        <div className="relative">
          <Mail className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            placeholder="name@club.sa"
            defaultValue="owner@club.sa"
            className="w-full h-12 bg-white border border-slate-200 rounded-xl pr-10 pl-4 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10"
          />
        </div>
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
          كلمة المرور
        </label>
        <div className="relative">
          <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••"
            defaultValue="123456"
            className="w-full h-12 bg-white border border-slate-200 rounded-xl pr-10 pl-4 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10"
          />
        </div>
      </div>

      {state?.error && (
        <p className="flex items-center gap-2 text-sm text-red-700 bg-red-50 ring-1 ring-red-100 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {state.error}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}
