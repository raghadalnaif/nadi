"use client";

import { useActionState, useEffect, useRef } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, MessageCircle, Smartphone } from "lucide-react";
import { checkClubCode, sendClubCode, type ClubLoginState } from "./actions";

export function ClubLoginForm({ slug }: { slug: string }) {
  const [state, sendAction, sending] = useActionState(
    sendClubCode,
    { step: "phone", slug } as ClubLoginState
  );

  if (state.step === "code") return <CodeStep initial={state} />;

  return (
    <form action={sendAction} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />

      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-1.5">
          رقم جوالك
        </label>
        <div className="relative">
          <Smartphone className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="phone"
            name="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            autoFocus
            dir="ltr"
            placeholder="05xxxxxxxx"
            className="w-full h-14 bg-white border border-slate-200 rounded-xl pr-10 pl-4 text-lg text-right outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10"
          />
        </div>
      </div>

      {state.error && (
        <p className="flex items-center gap-2 text-sm text-red-700 bg-red-50 ring-1 ring-red-100 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {state.error}
        </p>
      )}

      <button
        disabled={sending}
        className="w-full h-14 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 active:scale-[0.99] transition disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {sending ? "جارٍ الإرسال…" : "إرسال رمز الدخول"}
        {!sending && <ArrowLeft className="w-4 h-4" />}
      </button>

      <p className="text-xs text-slate-400 text-center leading-relaxed">
        سيصلك رمز من ٦ أرقام على جوالك. لا تحتاج كلمة مرور.
      </p>
    </form>
  );
}

function CodeStep({ initial }: { initial: Extract<ClubLoginState, { step: "code" }> }) {
  const [state, verifyAction, verifying] = useActionState(
    checkClubCode,
    initial as ClubLoginState
  );
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const current = state.step === "code" ? state : initial;

  return (
    <form action={verifyAction} className="space-y-4">
      <input type="hidden" name="slug" value={current.slug} />
      <input type="hidden" name="phone" value={current.phone} />

      <div className="rounded-xl bg-emerald-50 ring-1 ring-emerald-100 px-4 py-3 flex items-start gap-2.5">
        <MessageCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-sm text-emerald-800">{current.note || "أدخل الرمز المرسل"}</p>
          <p className="text-xs text-emerald-700 mt-0.5" dir="ltr">{current.phone}</p>
        </div>
      </div>

      {current.devCode && (
        <p className="text-center text-sm bg-amber-50 ring-1 ring-amber-100 text-amber-800 rounded-xl py-2.5">
          رمز التجربة: <b className="font-mono text-lg tracking-widest">{current.devCode}</b>
        </p>
      )}

      <div>
        <label htmlFor="code" className="block text-sm font-medium text-slate-700 mb-1.5">
          رمز الدخول
        </label>
        <input
          ref={inputRef}
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          dir="ltr"
          placeholder="••••••"
          className="w-full h-16 bg-white border border-slate-200 rounded-xl px-4 text-3xl text-center tracking-[0.5em] font-mono outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10"
        />
      </div>

      {state.step === "code" && state.error && (
        <p className="flex items-center gap-2 text-sm text-red-700 bg-red-50 ring-1 ring-red-100 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {state.error}
        </p>
      )}

      <button
        disabled={verifying}
        className="w-full h-14 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 active:scale-[0.99] transition disabled:opacity-60"
      >
        {verifying ? "جارٍ التحقق…" : "دخول"}
      </button>

      <a
        href={`/c/${current.slug}/login`}
        className="flex items-center justify-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition"
      >
        <ArrowRight className="w-4 h-4" />
        تغيير رقم الجوال
      </a>
    </form>
  );
}
