import type { ReactNode } from "react";

export const sar = (n: number) =>
  new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 0 }).format(Math.round(n)) + " ر.س";

export const num = (n: number) => new Intl.NumberFormat("ar-SA").format(n);

export const shortDate = (d: Date) =>
  new Intl.DateTimeFormat("ar-SA", { day: "numeric", month: "short" }).format(d);

export const fullDate = (d: Date) =>
  new Intl.DateTimeFormat("ar-SA", { day: "numeric", month: "long", year: "numeric" }).format(d);

export const time = (d: Date) =>
  new Intl.DateTimeFormat("ar-SA", { hour: "numeric", minute: "2-digit" }).format(d);

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({
  children,
  className = "",
  title,
  action,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  action?: ReactNode;
}) {
  return (
    <section
      className={`bg-white rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/40 ${className}`}
    >
      {title && (
        <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-800">{title}</h2>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

const toneMap = {
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  amber: "bg-amber-50 text-amber-700 ring-amber-100",
  red: "bg-red-50 text-red-700 ring-red-100",
  sky: "bg-sky-50 text-sky-700 ring-sky-100",
  violet: "bg-violet-50 text-violet-700 ring-violet-100",
  slate: "bg-slate-100 text-slate-600 ring-slate-200",
};

export type Tone = keyof typeof toneMap;

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full ring-1 whitespace-nowrap ${toneMap[tone]}`}
    >
      {children}
    </span>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "emerald",
}: {
  label: string;
  value: string;
  hint?: string;
  icon: ReactNode;
  tone?: Tone;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/40 p-5 transition hover:border-slate-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-slate-500">{label}</p>
          <p className="text-2xl font-bold mt-1 text-slate-900 tabular-nums">{value}</p>
          {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
        </div>
        <span className={`shrink-0 w-10 h-10 rounded-xl grid place-items-center ring-1 ${toneMap[tone]}`}>
          {icon}
        </span>
      </div>
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return <p className="text-center text-slate-400 py-12 text-sm">{text}</p>;
}

export function Th({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <th className={`text-right font-medium text-xs text-slate-500 px-5 py-3 ${className}`}>
      {children}
    </th>
  );
}

export function Td({
  children,
  className = "",
  dir,
}: {
  children: ReactNode;
  className?: string;
  dir?: "rtl" | "ltr";
}) {
  return (
    <td dir={dir} className={`px-5 py-3.5 text-sm ${className}`}>
      {children}
    </td>
  );
}

export function Table({ head, children }: { head: ReactNode; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-slate-50/70 border-b border-slate-100">
          <tr>{head}</tr>
        </thead>
        <tbody className="divide-y divide-slate-50">{children}</tbody>
      </table>
    </div>
  );
}

// شريط تقدم بسيط — يستخدم في السعة والميزانيات
export function Bar({ pct, tone = "emerald" }: { pct: number; tone?: "emerald" | "amber" | "red" }) {
  const color = { emerald: "bg-emerald-500", amber: "bg-amber-500", red: "bg-red-500" }[tone];
  return (
    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

export function subStatus(endsAt: Date, status: string) {
  if (status === "frozen") return { key: "frozen", label: "مجمّد", tone: "sky" as Tone, daysLeft: 0 };
  const daysLeft = Math.ceil((endsAt.getTime() - Date.now()) / 86400000);
  if (daysLeft <= 0) return { key: "expired", label: "منتهي", tone: "red" as Tone, daysLeft };
  if (daysLeft <= 7) return { key: "expiring", label: "قرب ينتهي", tone: "amber" as Tone, daysLeft };
  return { key: "active", label: "فعّال", tone: "emerald" as Tone, daysLeft };
}

export const payMethodLabel: Record<string, string> = {
  cash: "نقدي",
  mada: "مدى",
  visa: "فيزا",
  transfer: "تحويل",
  tabby: "تابي",
  tamara: "تمارا",
};

export const sourceLabel: Record<string, string> = {
  reception: "الاستقبال",
  app: "التطبيق",
  urpass: "UrPass",
  fingerprint: "بصمة",
  wristband: "سوار",
  gate: "بوابة",
};
