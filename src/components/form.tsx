import type { ReactNode } from "react";

const base =
  "w-full h-11 bg-white border border-slate-200 rounded-xl px-3.5 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm text-slate-600 mb-1.5">{label}</span>
      {children}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${base} ${props.className ?? ""}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${base} px-3 ${props.className ?? ""}`} />;
}

export function Submit({ children, tone = "emerald" }: { children: ReactNode; tone?: "emerald" | "red" | "slate" }) {
  const styles = {
    emerald: "bg-emerald-600 hover:bg-emerald-700",
    red: "bg-red-600 hover:bg-red-700",
    slate: "bg-slate-900 hover:bg-slate-800",
  }[tone];
  return (
    <button
      type="submit"
      className={`w-full h-11 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.99] transition ${styles}`}
    >
      {children}
    </button>
  );
}
