"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarRange, Printer } from "lucide-react";

const iso = (d: Date) => d.toISOString().slice(0, 10);

// اختصارات الفترات الشائعة في العمل المحاسبي
function presets() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const q = Math.floor(m / 3);
  return [
    { label: "هذا الشهر", from: new Date(y, m, 1), to: now },
    { label: "الشهر الماضي", from: new Date(y, m - 1, 1), to: new Date(y, m, 0) },
    { label: "هذا الربع", from: new Date(y, q * 3, 1), to: now },
    { label: "الربع الماضي", from: new Date(y, (q - 1) * 3, 1), to: new Date(y, q * 3, 0) },
    { label: "هذه السنة", from: new Date(y, 0, 1), to: now },
    { label: "السنة الماضية", from: new Date(y - 1, 0, 1), to: new Date(y - 1, 11, 31) },
  ];
}

export function PrintControls({
  from,
  to,
  report,
  reports,
}: {
  from: Date;
  to: Date;
  report: string;
  reports: Record<string, string>;
}) {
  const router = useRouter();
  const [f, setF] = useState(iso(from));
  const [t, setT] = useState(iso(to));
  const [r, setR] = useState(report);

  const apply = (nf = f, nt = t, nr = r) => {
    router.push(`/app/accounting/print?report=${nr}&from=${nf}&to=${nt}`);
  };

  return (
    <div className="print:hidden bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 mb-5">
      <div className="flex items-center gap-2 mb-4">
        <CalendarRange className="w-[18px] h-[18px] text-emerald-600" />
        <h2 className="font-bold text-slate-800">اختر التقرير والفترة</h2>
      </div>

      <div className="grid sm:grid-cols-4 gap-3 mb-4">
        <label className="block sm:col-span-2">
          <span className="block text-sm text-slate-600 mb-1.5">التقرير</span>
          <select
            value={r}
            onChange={(e) => {
              setR(e.target.value);
              apply(f, t, e.target.value);
            }}
            className="w-full h-11 bg-white border border-slate-200 rounded-xl px-3 text-sm outline-none focus:border-emerald-400"
          >
            {Object.entries(reports).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="block text-sm text-slate-600 mb-1.5">من تاريخ</span>
          <input
            type="date"
            value={f}
            onChange={(e) => setF(e.target.value)}
            className="w-full h-11 bg-white border border-slate-200 rounded-xl px-3.5 text-sm outline-none focus:border-emerald-400"
          />
        </label>

        <label className="block">
          <span className="block text-sm text-slate-600 mb-1.5">إلى تاريخ</span>
          <input
            type="date"
            value={t}
            onChange={(e) => setT(e.target.value)}
            className="w-full h-11 bg-white border border-slate-200 rounded-xl px-3.5 text-sm outline-none focus:border-emerald-400"
          />
        </label>
      </div>

      <div className="flex gap-1.5 flex-wrap mb-4">
        {presets().map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => {
              setF(iso(p.from));
              setT(iso(p.to));
              apply(iso(p.from), iso(p.to));
            }}
            className="px-3 h-8 rounded-lg border border-slate-200 text-xs text-slate-600 hover:border-emerald-300 hover:text-emerald-700 transition"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => apply()}
          className="h-11 px-5 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 transition"
        >
          عرض التقرير
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="h-11 px-5 rounded-xl bg-emerald-600 text-white text-sm font-bold flex items-center gap-2 hover:bg-emerald-700 active:scale-[0.99] transition"
        >
          <Printer className="w-4 h-4" />
          طباعة
        </button>
      </div>
    </div>
  );
}
