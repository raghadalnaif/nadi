"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Building2, Dumbbell, MapPin, Search } from "lucide-react";

// المشترك الذي وصل للرابط العام يختار ناديه ثم ينتقل لبوابته الفرعية
export function ClubPicker({
  clubs,
}: {
  clubs: { name: string; slug: string; address: string | null }[];
}) {
  const [q, setQ] = useState("");
  const filtered = q
    ? clubs.filter((c) => c.name.includes(q) || c.slug.includes(q.toLowerCase()))
    : clubs;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg">
        <Link href="/" className="flex items-center gap-2.5 mb-8 justify-center">
          <span className="w-10 h-10 rounded-xl bg-emerald-600 grid place-items-center">
            <Dumbbell className="w-5 h-5 text-white" />
          </span>
          <span className="text-xl font-extrabold text-slate-900">URGYM</span>
        </Link>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-7">
          <h1 className="text-xl font-extrabold text-slate-900">اختر ناديك</h1>
          <p className="text-sm text-slate-500 mt-1.5 mb-5">
            لكل نادٍ بوابة خاصة بمشتركيه — اختر ناديك للدخول
          </p>

          <div className="relative mb-4">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ابحث باسم النادي…"
              className="w-full h-11 bg-white border border-slate-200 rounded-xl pr-10 pl-4 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10"
            />
          </div>

          {filtered.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-8">لا توجد نتائج</p>
          ) : (
            <ul className="space-y-2 max-h-96 overflow-y-auto">
              {filtered.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/c/${c.slug}/login`}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3.5 hover:border-emerald-300 hover:bg-emerald-50/40 transition group"
                  >
                    <span className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 grid place-items-center shrink-0">
                      <Building2 className="w-5 h-5" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-bold text-slate-800 truncate">{c.name}</span>
                      {c.address && (
                        <span className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="truncate">{c.address}</span>
                        </span>
                      )}
                    </span>
                    <ArrowLeft className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 transition shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          هل أنت من فريق العمل؟{" "}
          <Link href="/login" className="text-emerald-700 hover:underline">
            سجّل الدخول من هنا
          </Link>
        </p>
      </div>
    </div>
  );
}
