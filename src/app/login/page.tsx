import { redirect } from "next/navigation";
import { BarChart3, CalendarCheck, Dumbbell, ReceiptText, Users } from "lucide-react";
import { getCurrentUser, homeFor } from "@/lib/auth";
import { LoginForm } from "./login-form";

const demoAccounts = [
  { role: "مالك النادي", email: "owner@club.sa" },
  { role: "محاسب", email: "accountant@club.sa" },
  { role: "موارد بشرية", email: "hr@club.sa" },
  { role: "استقبال", email: "reception@club.sa" },
  { role: "مزود الحل", email: "admin@nadi.sa" },
];

const features = [
  { icon: Users, title: "اشتراكات وأعضاء", text: "تجديد، تجميد، وتنبيه قبل الانتهاء" },
  { icon: CalendarCheck, title: "حجوزات وحصص", text: "سعة لحظية وقائمة انتظار ذكية" },
  { icon: ReceiptText, title: "محاسبة وفواتير", text: "فواتير ضريبية متوافقة مع الزكاة" },
  { icon: BarChart3, title: "تقارير فورية", text: "إيرادات ومصروفات وحضور" },
];

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user.role));

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* اليمين: نموذج الدخول */}
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2.5 mb-8">
            <span className="w-10 h-10 rounded-xl bg-emerald-600 grid place-items-center">
              <Dumbbell className="w-5 h-5 text-white" />
            </span>
            <span className="text-xl font-extrabold text-slate-900">URGYM</span>
          </div>

          <h1 className="text-2xl font-extrabold text-slate-900">أهلاً بك مجدداً</h1>
          <p className="text-sm text-slate-500 mt-1.5 mb-7">
            سجّل الدخول للوصول إلى لوحة إدارة ناديك
          </p>

          <LoginForm />

          <a
            href="/portal/login"
            className="mt-6 flex items-center justify-center gap-2 h-12 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:border-emerald-300 hover:text-emerald-700 transition"
          >
            هل أنت مشترك؟ ادخل برقم جوالك
          </a>

          <div className="mt-8 pt-6 border-t border-slate-100">
            <p className="text-xs text-slate-400 mb-3">حسابات تجريبية — كلمة المرور للجميع 123456</p>
            <div className="flex flex-wrap gap-1.5">
              {demoAccounts.map((a) => (
                <span
                  key={a.email}
                  className="text-xs bg-slate-100 text-slate-600 rounded-lg px-2.5 py-1.5"
                  title={a.email}
                >
                  {a.role}: <span dir="ltr" className="text-slate-500">{a.email}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* اليسار: العرض التسويقي */}
      <div className="hidden lg:flex flex-col justify-center bg-emerald-600 px-14 py-12 relative overflow-hidden">
        <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-emerald-500/40" />
        <div className="absolute -bottom-32 -right-10 w-96 h-96 rounded-full bg-emerald-700/30" />

        <div className="relative">
          <h2 className="text-3xl font-extrabold text-white leading-snug">
            كل ما يحتاجه ناديك
            <br />
            في منصة واحدة
          </h2>
          <p className="text-emerald-50/90 mt-3 max-w-md">
            من استقبال العضو حتى القيد المحاسبي — أقسام منفصلة، صلاحيات واضحة، وسرعة في كل شاشة.
          </p>

          <div className="grid grid-cols-2 gap-3 mt-10 max-w-lg">
            {features.map((f) => (
              <div key={f.title} className="bg-white/10 backdrop-blur rounded-2xl p-4 ring-1 ring-white/15">
                <f.icon className="w-5 h-5 text-white mb-2.5" />
                <p className="font-bold text-white text-sm">{f.title}</p>
                <p className="text-emerald-50/80 text-xs mt-0.5 leading-relaxed">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
