"use client";

import { useActionState, useMemo, useState } from "react";
import { CheckCircle2, MessageCircle, Minus, Plus, ShoppingCart, Trash2, XCircle } from "lucide-react";
import { checkout, type SaleResult } from "./actions";

type Item = { id: string; name: string; priceSAR: number; kind: "product" | "plan"; stock?: number; category?: string };
type Member = { id: string; name: string; phone: string; memberNo: number };

const sar = (n: number) =>
  new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 0 }).format(Math.round(n)) + " ر.س";

const PAY = { cash: "نقدي", mada: "مدى", visa: "فيزا", transfer: "تحويل", tabby: "تابي", tamara: "تمارا" };

export function Register({ products, plans, members }: { products: Item[]; plans: Item[]; members: Member[] }) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [memberId, setMemberId] = useState("");
  const [tab, setTab] = useState<"products" | "plans">("products");
  const [state, formAction, pending] = useActionState(checkout, null as SaleResult | null);

  const all = useMemo(() => [...products, ...plans], [products, plans]);
  const lines = Object.entries(cart)
    .filter(([, q]) => q > 0)
    .map(([id, qty]) => ({ item: all.find((x) => x.id === id)!, qty }))
    .filter((l) => l.item);

  const total = lines.reduce((s, l) => s + l.item.priceSAR * l.qty, 0);
  const vat = total - total / 1.15;
  const hasPlan = lines.some((l) => l.item.kind === "plan");

  const add = (id: string) => setCart((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
  const sub = (id: string) => setCart((c) => ({ ...c, [id]: Math.max(0, (c[id] ?? 0) - 1) }));
  const clear = () => setCart({});

  const payload = JSON.stringify(
    lines.map((l) => ({ kind: l.item.kind, id: l.item.id, qty: l.qty }))
  );

  const shown = tab === "products" ? products : plans;

  return (
    <div className="grid lg:grid-cols-5 gap-5 items-start">
      {/* شبكة الأصناف */}
      <div className="lg:col-span-3">
        <div className="flex gap-2 mb-4">
          {(["products", "plans"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-4 h-10 rounded-xl text-sm border transition ${
                tab === t
                  ? "bg-emerald-600 text-white border-emerald-600 font-bold"
                  : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300"
              }`}
            >
              {t === "products" ? `المنتجات (${products.length})` : `الباقات (${plans.length})`}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {shown.map((p) => {
            const out = p.kind === "product" && p.stock !== undefined && p.stock <= 0;
            return (
              <button
                key={p.id}
                type="button"
                disabled={out}
                onClick={() => add(p.id)}
                className={`text-right bg-white rounded-2xl border p-4 transition ${
                  out
                    ? "border-slate-200 opacity-50 cursor-not-allowed"
                    : "border-slate-200 hover:border-emerald-400 hover:shadow-sm active:scale-[0.98]"
                }`}
              >
                <p className="font-bold text-sm text-slate-800 leading-snug">{p.name}</p>
                <p className="text-emerald-700 font-bold mt-1.5 tabular-nums">{sar(p.priceSAR)}</p>
                {p.kind === "product" && p.stock !== undefined && (
                  <p className={`text-xs mt-1 ${p.stock <= 3 ? "text-amber-600" : "text-slate-400"}`}>
                    {out ? "نفد المخزون" : `المتاح ${p.stock}`}
                  </p>
                )}
                {p.kind === "plan" && <p className="text-xs text-slate-400 mt-1">اشتراك</p>}
              </button>
            );
          })}
          {shown.length === 0 && (
            <p className="col-span-full text-center text-slate-400 py-12 text-sm">
              {tab === "products" ? "لا توجد منتجات — أضف أول منتج" : "لا توجد باقات"}
            </p>
          )}
        </div>
      </div>

      {/* السلة */}
      <div className="lg:col-span-2 lg:sticky lg:top-6">
        <form action={formAction} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm">
          <input type="hidden" name="cart" value={payload} />

          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
            <ShoppingCart className="w-[18px] h-[18px] text-emerald-600" />
            <h2 className="font-bold text-slate-800">السلة</h2>
            {lines.length > 0 && (
              <button
                type="button"
                onClick={clear}
                className="mr-auto text-xs text-slate-400 hover:text-red-600 transition"
              >
                تفريغ
              </button>
            )}
          </div>

          {lines.length === 0 ? (
            <p className="text-center text-slate-400 py-10 text-sm">اضغط على صنف لإضافته</p>
          ) : (
            <ul className="divide-y divide-slate-50 max-h-72 overflow-y-auto">
              {lines.map((l) => (
                <li key={l.item.id} className="flex items-center gap-2 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{l.item.name}</p>
                    <p className="text-xs text-slate-400 tabular-nums">
                      {sar(l.item.priceSAR)} × {l.qty}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => sub(l.item.id)}
                      className="w-7 h-7 rounded-lg border border-slate-200 grid place-items-center hover:bg-slate-50"
                    >
                      {l.qty === 1 ? <Trash2 className="w-3.5 h-3.5 text-red-500" /> : <Minus className="w-3.5 h-3.5" />}
                    </button>
                    <span className="w-7 text-center text-sm font-bold tabular-nums">{l.qty}</span>
                    <button
                      type="button"
                      onClick={() => add(l.item.id)}
                      disabled={l.item.kind === "plan"}
                      className="w-7 h-7 rounded-lg border border-slate-200 grid place-items-center hover:bg-slate-50 disabled:opacity-30"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <span className="text-sm font-bold tabular-nums w-20 text-left shrink-0">
                    {sar(l.item.priceSAR * l.qty)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="px-5 py-4 border-t border-slate-100 space-y-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">
                العضو {hasPlan && <span className="text-red-500">(إلزامي لبيع اشتراك)</span>}
              </label>
              <select
                name="memberId"
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                required={hasPlan}
                className="w-full h-11 bg-white border border-slate-200 rounded-xl px-3 text-sm outline-none focus:border-emerald-400"
              >
                <option value="">عميل نقدي (بدون عضوية)</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} — {m.memberNo}
                  </option>
                ))}
              </select>
            </div>

            {!memberId && (
              <div className="grid grid-cols-2 gap-2">
                <input
                  name="walkInName"
                  placeholder="اسم العميل (اختياري)"
                  className="h-11 bg-white border border-slate-200 rounded-xl px-3 text-sm outline-none focus:border-emerald-400"
                />
                <input
                  name="walkInPhone"
                  dir="ltr"
                  placeholder="05xxxxxxxx"
                  className="h-11 bg-white border border-slate-200 rounded-xl px-3 text-sm text-right outline-none focus:border-emerald-400"
                />
              </div>
            )}

            <div>
              <label className="block text-xs text-slate-500 mb-1.5">طريقة الدفع</label>
              <div className="grid grid-cols-3 gap-1.5">
                {Object.entries(PAY).map(([k, v], i) => (
                  <label key={k} className="cursor-pointer">
                    <input type="radio" name="method" value={k} defaultChecked={i === 0} className="peer sr-only" />
                    <span className="block text-center text-xs py-2 rounded-lg border border-slate-200 peer-checked:bg-emerald-600 peer-checked:text-white peer-checked:border-emerald-600 transition">
                      {v}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 space-y-1.5">
              <div className="flex justify-between text-xs text-slate-500">
                <span>شامل ضريبة 15%</span>
                <span className="tabular-nums">{sar(vat)}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="font-bold">الإجمالي</span>
                <span className="text-2xl font-extrabold text-emerald-700 tabular-nums">{sar(total)}</span>
              </div>
            </div>

            <button
              disabled={pending || lines.length === 0}
              className="w-full h-12 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 active:scale-[0.99] transition disabled:opacity-50"
            >
              {pending ? "جارٍ الإصدار…" : "إتمام البيع وإصدار الفاتورة"}
            </button>
          </div>
        </form>

        {state && (
          <div
            className={`mt-3 rounded-2xl px-5 py-4 ring-1 ${
              state.tone === "success" ? "bg-emerald-50 ring-emerald-100" : "bg-red-50 ring-red-100"
            }`}
          >
            <div className="flex items-start gap-2.5">
              {state.tone === "success" ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              )}
              <p className={`text-sm font-bold ${state.tone === "success" ? "text-emerald-800" : "text-red-800"}`}>
                {state.message}
              </p>
            </div>

            {state.ok && (
              <div className="flex gap-2 mt-3">
                {state.invoiceId && (
                  <a
                    href={`/app/invoices/${state.invoiceId}`}
                    className="flex-1 h-10 rounded-xl bg-white border border-emerald-200 text-emerald-700 text-sm font-bold grid place-items-center hover:bg-emerald-50 transition"
                  >
                    عرض الفاتورة
                  </a>
                )}
                {state.waUrl && (
                  <a
                    href={state.waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 h-10 rounded-xl bg-emerald-600 text-white text-sm font-bold flex items-center justify-center gap-1.5 hover:bg-emerald-700 transition"
                  >
                    <MessageCircle className="w-4 h-4" />
                    إرسال الإيصال
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
