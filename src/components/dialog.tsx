"use client";

import { useRef, type ReactNode } from "react";
import { X } from "lucide-react";

// نافذة منبثقة مبنية على <dialog> الأصلي — تُغلق تلقائياً بعد الإرسال
export function Dialog({
  label,
  title,
  description,
  children,
  variant = "primary",
  icon,
}: {
  label: string;
  title: string;
  description?: string;
  children: ReactNode;
  variant?: "primary" | "ghost" | "icon";
  icon?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  const styles = {
    primary:
      "h-10 px-4 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 active:scale-[0.98]",
    ghost:
      "h-9 px-3.5 rounded-xl border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 hover:border-slate-300",
    icon: "w-9 h-9 rounded-lg grid place-items-center text-slate-400 hover:bg-slate-100 hover:text-slate-700",
  }[variant];

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        title={variant === "icon" ? label : undefined}
        aria-label={variant === "icon" ? label : undefined}
        className={`flex items-center justify-center gap-1.5 transition whitespace-nowrap ${styles}`}
      >
        {icon}
        {variant !== "icon" && label}
      </button>

      <dialog
        ref={ref}
        className="backdrop:bg-slate-900/40 backdrop:backdrop-blur-[2px] rounded-2xl p-0 w-[min(92vw,26rem)] shadow-xl border border-slate-200 open:animate-none"
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close();
        }}
      >
        <div dir="rtl" className="text-right">
          <header className="flex items-start gap-3 px-5 py-4 border-b border-slate-100">
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-slate-900">{title}</h2>
              {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
            </div>
            <button
              type="button"
              onClick={() => ref.current?.close()}
              aria-label="إغلاق"
              className="w-8 h-8 rounded-lg grid place-items-center text-slate-400 hover:bg-slate-100 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </header>
          <div className="p-5" onSubmit={() => ref.current?.close()}>
            {children}
          </div>
        </div>
      </dialog>
    </>
  );
}

// زر يطلب تأكيداً قبل تنفيذ إجراء مدمّر
export function ConfirmButton({
  message,
  label,
  variant = "icon",
  icon,
}: {
  message: string;
  label: string;
  variant?: "icon" | "ghost";
  icon?: ReactNode;
}) {
  const styles = {
    icon: "w-9 h-9 rounded-lg grid place-items-center text-slate-400 hover:bg-red-50 hover:text-red-600",
    ghost:
      "h-9 px-3.5 rounded-xl border border-slate-200 text-slate-600 text-sm hover:bg-red-50 hover:text-red-600 hover:border-red-200",
  }[variant];

  return (
    <button
      type="submit"
      title={label}
      aria-label={label}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
      className={`flex items-center justify-center gap-1.5 transition whitespace-nowrap ${styles}`}
    >
      {icon}
      {variant !== "icon" && label}
    </button>
  );
}
