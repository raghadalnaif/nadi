"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { CheckCircle2, LogIn, LogOut, MapPin, MapPinOff, ScanLine, TriangleAlert, XCircle } from "lucide-react";
import { kioskPunch, type KioskResult } from "../actions";

type GeoState =
  | { status: "idle" | "asking" }
  | { status: "ok"; lat: number; lng: number; accuracy: number }
  | { status: "denied"; reason: string };

export function PunchPad({ geoRequired, hasClubLocation }: { geoRequired: boolean; hasClubLocation: boolean }) {
  const [state, formAction, pending] = useActionState(kioskPunch, null as KioskResult | null);
  const [geo, setGeo] = useState<GeoState>({ status: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);

  // نطلب الموقع مرة واحدة عند فتح الشاشة ونحدّثه باستمرار
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeo({ status: "denied", reason: "المتصفح لا يدعم تحديد الموقع" });
      return;
    }
    setGeo({ status: "asking" });
    const id = navigator.geolocation.watchPosition(
      (pos) =>
        setGeo({
          status: "ok",
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
        }),
      (err) =>
        setGeo({
          status: "denied",
          reason: err.code === 1 ? "رُفضت صلاحية الموقع" : "تعذّر تحديد الموقع",
        }),
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 12000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // إبقاء التركيز على الحقل ليعمل قارئ الباركود مباشرة
  useEffect(() => {
    inputRef.current?.focus();
    if (state) inputRef.current?.select();
  }, [state]);

  const tone = state?.tone;
  const Icon =
    state?.action === "in"
      ? LogIn
      : state?.action === "out"
        ? LogOut
        : tone === "success"
          ? CheckCircle2
          : tone === "warn"
            ? TriangleAlert
            : XCircle;

  const blocked = geoRequired && geo.status !== "ok";

  return (
    <div className="max-w-xl mx-auto">
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-5">
          <ScanLine className="w-5 h-5 text-emerald-600" />
          <h2 className="font-bold text-lg text-slate-800">تسجيل الحضور</h2>
          <span className="text-xs text-slate-400 mr-auto">امسح باركود الموظف</span>
        </div>

        <form action={formAction}>
          {geo.status === "ok" && (
            <>
              <input type="hidden" name="lat" value={geo.lat} />
              <input type="hidden" name="lng" value={geo.lng} />
            </>
          )}

          <input
            ref={inputRef}
            name="code"
            autoComplete="off"
            disabled={blocked}
            placeholder="امسح البطاقة أو اكتب رقم الهوية…"
            className="w-full h-16 bg-slate-50 border border-slate-200 rounded-2xl px-5 text-lg text-center outline-none transition focus:bg-white focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 disabled:opacity-50"
          />

          <button
            disabled={pending || blocked}
            className="w-full h-14 mt-3 rounded-2xl bg-emerald-600 text-white font-bold text-lg hover:bg-emerald-700 active:scale-[0.99] transition disabled:opacity-50"
          >
            {pending ? "جارٍ التسجيل…" : "تسجيل"}
          </button>
        </form>

        {state && (
          <div
            className={`mt-4 rounded-2xl px-5 py-4 flex items-start gap-3 ring-1 ${
              tone === "success"
                ? "bg-emerald-50 ring-emerald-100"
                : tone === "warn"
                  ? "bg-amber-50 ring-amber-100"
                  : "bg-red-50 ring-red-100"
            }`}
          >
            <Icon
              className={`w-6 h-6 shrink-0 mt-0.5 ${
                tone === "success" ? "text-emerald-600" : tone === "warn" ? "text-amber-600" : "text-red-600"
              }`}
            />
            <div className="min-w-0">
              <p
                className={`font-bold ${
                  tone === "success" ? "text-emerald-800" : tone === "warn" ? "text-amber-800" : "text-red-800"
                }`}
              >
                {state.message}
              </p>
              {state.detail && (
                <p
                  className={`text-sm mt-0.5 ${
                    tone === "success" ? "text-emerald-700" : tone === "warn" ? "text-amber-700" : "text-red-700"
                  }`}
                >
                  {state.detail}
                </p>
              )}
            </div>
          </div>
        )}

        {/* حالة الموقع الجغرافي */}
        <div
          className={`mt-4 rounded-xl px-4 py-3 flex items-center gap-2.5 ring-1 ${
            geo.status === "ok"
              ? "bg-emerald-50 ring-emerald-100 text-emerald-800"
              : geo.status === "denied"
                ? "bg-red-50 ring-red-100 text-red-800"
                : "bg-slate-50 ring-slate-100 text-slate-600"
          }`}
        >
          {geo.status === "ok" ? (
            <MapPin className="w-4 h-4 shrink-0" />
          ) : (
            <MapPinOff className="w-4 h-4 shrink-0" />
          )}
          <p className="text-sm flex-1">
            {geo.status === "ok"
              ? `الموقع محدَّد — دقة ${geo.accuracy} متر`
              : geo.status === "denied"
                ? geo.reason
                : "جارٍ تحديد الموقع…"}
          </p>
          {geoRequired && (
            <span className="text-xs font-bold whitespace-nowrap">
              {geo.status === "ok" ? "ضمن التحقق" : "مطلوب"}
            </span>
          )}
        </div>

        {!hasClubLocation && (
          <p className="mt-3 text-xs text-amber-700 bg-amber-50 ring-1 ring-amber-100 rounded-xl px-4 py-3">
            لم يُحدَّد موقع النادي بعد — اذهب إلى الإعدادات وحدّده ليعمل التحقق الجغرافي.
          </p>
        )}
      </div>
    </div>
  );
}
