"use client";

import { useActionState, useEffect, useRef } from "react";
import { CheckCircle2, Fingerprint, ScanLine, TriangleAlert, XCircle } from "lucide-react";
import { checkInByCode, type CheckinResult } from "../ops-actions";

const METHOD_LABEL: Record<string, string> = {
  barcode: "باركود",
  fingerprint: "بصمة",
  wristband: "سوار",
  gate: "بوابة",
};

export function Scanner({ methods }: { methods: string[] }) {
  const [state, formAction, pending] = useActionState(checkInByCode, null as CheckinResult | null);
  const inputRef = useRef<HTMLInputElement>(null);

  // قارئ الباركود يكتب ثم يضغط Enter — نُبقي التركيز على الحقل دائماً
  useEffect(() => {
    inputRef.current?.focus();
    if (state) inputRef.current?.select();
  }, [state]);

  if (methods.length === 0) return null;

  const tone = state?.tone;
  const Icon = tone === "success" ? CheckCircle2 : tone === "warn" ? TriangleAlert : XCircle;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <ScanLine className="w-[18px] h-[18px] text-emerald-600" />
        <h2 className="font-bold text-slate-800">التحضير السريع</h2>
        <span className="text-xs text-slate-400 mr-auto">امسح الباركود أو أدخل رقم العضوية</span>
      </div>

      <form action={formAction} className="flex gap-2">
        <input
          ref={inputRef}
          name="code"
          autoComplete="off"
          placeholder="امسح البطاقة أو اكتب رقم العضوية…"
          className="flex-1 min-w-0 h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm outline-none transition focus:bg-white focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10"
        />
        {methods.length > 1 ? (
          <select
            name="source"
            defaultValue={methods[0]}
            className="h-12 bg-white border border-slate-200 rounded-xl px-3 text-sm outline-none focus:border-emerald-400"
          >
            {methods.map((m) => (
              <option key={m} value={m}>{METHOD_LABEL[m] ?? m}</option>
            ))}
          </select>
        ) : (
          <input type="hidden" name="source" value={methods[0]} />
        )}
        <button
          disabled={pending}
          className="h-12 px-6 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 active:scale-[0.98] transition disabled:opacity-60 whitespace-nowrap"
        >
          {pending ? "…" : "تحضير"}
        </button>
      </form>

      {state && (
        <div
          className={`mt-3 rounded-xl px-4 py-3 flex items-center gap-2.5 ring-1 ${
            tone === "success"
              ? "bg-emerald-50 ring-emerald-100 text-emerald-800"
              : tone === "warn"
                ? "bg-amber-50 ring-amber-100 text-amber-800"
                : "bg-red-50 ring-red-100 text-red-800"
          }`}
        >
          <Icon className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">{state.message}</p>
        </div>
      )}

      <div className="flex items-center gap-1.5 mt-3 flex-wrap">
        <Fingerprint className="w-3.5 h-3.5 text-slate-300" />
        <span className="text-xs text-slate-400">الطرق المفعّلة:</span>
        {methods.map((m) => (
          <span key={m} className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
            {METHOD_LABEL[m] ?? m}
          </span>
        ))}
      </div>
    </div>
  );
}
