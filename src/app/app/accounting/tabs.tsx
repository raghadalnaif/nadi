import Link from "next/link";

const TABS = [
  { href: "/app/accounting", label: "النظرة العامة" },
  { href: "/app/accounting/journal", label: "دفتر اليومية" },
  { href: "/app/accounting/trial-balance", label: "ميزان المراجعة" },
  { href: "/app/accounting/statements", label: "القوائم المالية" },
  { href: "/app/accounting/vat", label: "الإقرار الضريبي" },
  { href: "/app/accounting/receivables", label: "أعمار الذمم" },
  { href: "/app/accounting/print", label: "طباعة التقارير" },
];

export function AccountingTabs({ active }: { active: string }) {
  return (
    <div className="flex gap-2 flex-wrap mb-6">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`px-4 h-10 rounded-xl text-sm flex items-center border transition ${
            active === t.href
              ? "bg-emerald-600 text-white border-emerald-600 font-bold"
              : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
