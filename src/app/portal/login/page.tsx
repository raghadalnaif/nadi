import { redirect } from "next/navigation";
import { CalendarCheck, Dumbbell, QrCode, Wallet } from "lucide-react";
import { getCurrentUser, homeFor } from "@/lib/auth";
import { MemberLoginForm } from "./login-form";

const perks = [
  { icon: CalendarCheck, text: "احجز حصصك بنفسك" },
  { icon: QrCode, text: "رمز دخولك للنادي" },
  { icon: Wallet, text: "اشتراكك وفواتيرك" },
];

export default async function MemberLoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user.role));

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2.5 mb-8">
            <span className="w-10 h-10 rounded-xl bg-emerald-600 grid place-items-center">
              <Dumbbell className="w-5 h-5 text-white" />
            </span>
            <span className="text-xl font-extrabold text-slate-900">URGYM</span>
          </div>

          <h1 className="text-2xl font-extrabold text-slate-900">أهلاً بك</h1>
          <p className="text-sm text-slate-500 mt-1.5 mb-7">
            أدخل رقم جوالك ويصلك رمز الدخول — بلا كلمة مرور
          </p>

          <MemberLoginForm />

          <div className="mt-8 pt-6 border-t border-slate-100">
            <a href="/login" className="text-xs text-slate-400 hover:text-slate-600 transition">
              هل أنت من فريق العمل؟ سجّل الدخول من هنا
            </a>
          </div>
        </div>
      </div>

      <div className="hidden lg:flex flex-col justify-center bg-emerald-600 px-14 py-12 relative overflow-hidden">
        <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-emerald-500/40" />
        <div className="absolute -bottom-32 -right-10 w-96 h-96 rounded-full bg-emerald-700/30" />

        <div className="relative">
          <h2 className="text-3xl font-extrabold text-white leading-snug">
            ناديك في جوالك
          </h2>
          <p className="text-emerald-50/90 mt-3 max-w-md">
            تابع اشتراكك واحجز حصصك واعرف حضورك — من أي مكان.
          </p>

          <ul className="mt-10 space-y-3 max-w-sm">
            {perks.map((p) => (
              <li
                key={p.text}
                className="bg-white/10 backdrop-blur rounded-2xl px-5 py-4 ring-1 ring-white/15 flex items-center gap-3"
              >
                <p.icon className="w-5 h-5 text-white shrink-0" />
                <span className="text-white font-medium">{p.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
