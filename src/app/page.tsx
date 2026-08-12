import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  Building2,
  CalendarCheck,
  CheckCircle2,
  CreditCard,
  Dumbbell,
  Fingerprint,
  MessageCircle,
  ReceiptText,
  ScanLine,
  ShoppingCart,
  Smartphone,
  UsersRound,
  Wallet,
} from "lucide-react";
import { getCurrentUser, homeFor } from "@/lib/auth";
import { LoginForm } from "./login/login-form";
import { DemoAccounts } from "./login/demo-accounts";

const FEATURES = [
  {
    icon: UsersRound,
    title: "الاشتراكات والعضويات",
    text: "تجديد وتجميد واستئناف، وتنبيه قبل الانتهاء بأيام تحددها أنت.",
  },
  {
    icon: CalendarCheck,
    title: "الحجوزات والحصص",
    text: "سعة لحظية وقائمة انتظار تُرقّي التالي تلقائياً عند أي إلغاء.",
  },
  {
    icon: ScanLine,
    title: "التحضير بكل الطرق",
    text: "باركود، بصمة، أساور، وبوابات دخول — فعّل ما يناسب ناديك.",
  },
  {
    icon: ShoppingCart,
    title: "كاشير ونقطة بيع",
    text: "بيع منتجات واشتراكات في فاتورة واحدة مع خصم المخزون.",
  },
  {
    icon: ReceiptText,
    title: "فواتير متوافقة مع الزكاة",
    text: "مستند UBL 2.1 ورمز QR وسلسلة هاش تكشف أي تلاعب.",
  },
  {
    icon: Wallet,
    title: "محاسبة بقيد مزدوج",
    text: "دفتر يومية وميزان مراجعة وقوائم مالية وإقرار ضريبي.",
  },
  {
    icon: BarChart3,
    title: "موارد بشرية كاملة",
    text: "رواتب وبدلات وتأمينات ونهاية خدمة وحضور بالموقع الجغرافي.",
  },
  {
    icon: MessageCircle,
    title: "تنبيهات واتساب",
    text: "ترحيب وإيصال وتذكير قبل الانتهاء واسترجاع المنقطعين.",
  },
  {
    icon: Building2,
    title: "فروع متعددة",
    text: "كل فرع بمشتركيه وحساباته، ومدير الفرع يرى فرعه وحده.",
  },
];

const STEPS = [
  { n: "١", title: "سجّل ناديك", text: "نجهّز حسابك وباقاتك خلال دقائق." },
  { n: "٢", title: "أدخل مشتركيك", text: "يدوياً أو باستيراد قائمتك الحالية." },
  { n: "٣", title: "ابدأ التشغيل", text: "حضور وفواتير ومحاسبة من اليوم الأول." },
];

const PLANS = [
  {
    name: "أساسي",
    price: "٢٩٩",
    for: "نادٍ واحد بفرع واحد",
    perks: ["اشتراكات وحجوزات", "كاشير وفواتير زاتكا", "تنبيهات واتساب", "تقارير أساسية"],
  },
  {
    name: "احترافي",
    price: "٥٩٩",
    for: "الأندية النامية",
    perks: [
      "كل ما في الأساسي",
      "محاسبة بقيد مزدوج",
      "موارد بشرية ورواتب",
      "ربط أجهزة البصمة والبوابات",
      "بوابة المشتركين",
    ],
    featured: true,
  },
  {
    name: "مؤسسي",
    price: "١٢٩٩",
    for: "السلاسل متعددة الفروع",
    perks: ["كل ما في الاحترافي", "فروع بلا حد", "API للربط مع تطبيقاتك", "دعم مخصص"],
  },
];

export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <div className="min-h-screen bg-white">
      {/* ── الشريط العلوي ── */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-emerald-600 grid place-items-center">
              <Dumbbell className="w-[18px] h-[18px] text-white" />
            </span>
            <span className="text-lg font-extrabold text-slate-900">URGYM</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm text-slate-600 mr-6">
            <a href="#features" className="hover:text-emerald-700 transition">المزايا</a>
            <a href="#how" className="hover:text-emerald-700 transition">كيف يعمل</a>
            <a href="#pricing" className="hover:text-emerald-700 transition">الأسعار</a>
          </nav>

          <div className="mr-auto flex items-center gap-2">
            <Link
              href="/portal/login"
              className="hidden sm:flex h-9 px-3.5 rounded-xl border border-slate-200 text-sm text-slate-600 items-center gap-1.5 hover:border-emerald-300 hover:text-emerald-700 transition"
            >
              <Smartphone className="w-4 h-4" />
              بوابة المشترك
            </Link>
            <a
              href="#login"
              className="h-9 px-4 rounded-xl bg-emerald-600 text-white text-sm font-bold flex items-center hover:bg-emerald-700 transition"
            >
              {user ? "لوحتك" : "دخول"}
            </a>
          </div>
        </div>
      </header>

      {/* ── الواجهة الرئيسية مع الدخول بالجانب ── */}
      <section className="relative overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[32rem] h-[32rem] rounded-full bg-emerald-50" />
        <div className="absolute top-40 -right-32 w-96 h-96 rounded-full bg-emerald-50/60" />

        <div className="relative max-w-6xl mx-auto px-6 py-14 lg:py-20 grid lg:grid-cols-2 gap-12 items-start">
          <div className="lg:pt-6">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 px-3.5 py-1.5 text-xs font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              فواتير متوافقة مع هيئة الزكاة والضريبة
            </span>

            <h1 className="text-4xl lg:text-5xl font-extrabold text-slate-900 leading-[1.15] mt-5">
              نظام إدارة الأندية
              <br />
              <span className="text-emerald-600">والحجوزات</span>
            </h1>

            <p className="text-lg text-slate-600 mt-5 leading-relaxed max-w-lg">
              من استقبال العضو حتى القيد المحاسبي — اشتراكات وحجوزات وكاشير
              ومحاسبة وموارد بشرية في منصة واحدة عربية بالكامل.
            </p>

            <div className="flex flex-wrap gap-3 mt-7">
              <a
                href="#login"
                className="h-12 px-6 rounded-xl bg-emerald-600 text-white font-bold flex items-center gap-2 hover:bg-emerald-700 active:scale-[0.99] transition"
              >
                جرّب النظام الآن
                <ArrowLeft className="w-4 h-4" />
              </a>
              <a
                href="#features"
                className="h-12 px-6 rounded-xl border border-slate-200 text-slate-700 font-bold flex items-center hover:border-emerald-300 hover:text-emerald-700 transition"
              >
                استعرض المزايا
              </a>
            </div>

            <dl className="grid grid-cols-3 gap-6 mt-10 pt-8 border-t border-slate-100 max-w-lg">
              {[
                ["١٥", "قسماً متكاملاً"],
                ["١٠٠٪", "عربي RTL"],
                ["٢٤/٧", "يعمل بلا توقف"],
              ].map(([v, l]) => (
                <div key={l}>
                  <dt className="text-2xl font-extrabold text-slate-900 tabular-nums">{v}</dt>
                  <dd className="text-xs text-slate-500 mt-0.5">{l}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* بطاقة الدخول */}
          <div id="login" className="lg:sticky lg:top-24">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 p-7">
              {user ? (
                <div className="text-center py-6">
                  <span className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 grid place-items-center mx-auto mb-4">
                    <CheckCircle2 className="w-7 h-7" />
                  </span>
                  <p className="font-bold text-slate-900">أهلاً {user.name}</p>
                  <p className="text-sm text-slate-500 mt-1">أنت مسجّل الدخول بالفعل</p>
                  <Link
                    href={homeFor(user.role)}
                    className="mt-5 h-12 px-6 rounded-xl bg-emerald-600 text-white font-bold flex items-center justify-center gap-2 hover:bg-emerald-700 transition"
                  >
                    الذهاب للوحتك
                    <ArrowLeft className="w-4 h-4" />
                  </Link>
                </div>
              ) : (
                <>
                  <h2 className="text-xl font-extrabold text-slate-900">دخول فريق العمل</h2>
                  <p className="text-sm text-slate-500 mt-1 mb-6">
                    سجّل الدخول للوصول إلى لوحة إدارة ناديك
                  </p>
                  <LoginForm />
                  <DemoAccounts />
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── المزايا ── */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-16 lg:py-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl font-extrabold text-slate-900">كل ما يحتاجه ناديك</h2>
          <p className="text-slate-600 mt-3">
            بُني حول يوم النادي الفعلي — لا مزايا معلّبة ولا شاشات لا تُستخدم.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-slate-200 p-6 hover:border-emerald-300 hover:shadow-md hover:shadow-emerald-100/50 transition"
            >
              <span className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 grid place-items-center mb-4">
                <f.icon className="w-5 h-5" />
              </span>
              <h3 className="font-bold text-slate-900">{f.title}</h3>
              <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── كيف يعمل ── */}
      <section id="how" className="bg-slate-50 border-y border-slate-100">
        <div className="max-w-6xl mx-auto px-6 py-16 lg:py-20">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl font-extrabold text-slate-900">ابدأ خلال يوم واحد</h2>
            <p className="text-slate-600 mt-3">بلا تركيب معقّد ولا تدريب طويل.</p>
          </div>

          <div className="grid sm:grid-cols-3 gap-5">
            {STEPS.map((s) => (
              <div key={s.n} className="bg-white rounded-2xl border border-slate-200 p-7 text-center">
                <span className="w-12 h-12 rounded-2xl bg-emerald-600 text-white grid place-items-center mx-auto text-xl font-extrabold">
                  {s.n}
                </span>
                <h3 className="font-bold text-slate-900 mt-4">{s.title}</h3>
                <p className="text-sm text-slate-600 mt-1.5">{s.text}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 grid sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {[
              { icon: Fingerprint, t: "يدعم أجهزة البصمة" },
              { icon: CreditCard, t: "مدى وتابي وتمارا" },
              { icon: Smartphone, t: "بوابة للمشتركين" },
            ].map((x) => (
              <div
                key={x.t}
                className="flex items-center gap-2.5 justify-center rounded-xl bg-white border border-slate-200 px-4 py-3"
              >
                <x.icon className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-sm font-medium text-slate-700">{x.t}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── الأسعار ── */}
      <section id="pricing" className="max-w-6xl mx-auto px-6 py-16 lg:py-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl font-extrabold text-slate-900">أسعار واضحة بلا مفاجآت</h2>
          <p className="text-slate-600 mt-3">اشتراك شهري، وتلغي متى شئت.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-5 items-start">
          {PLANS.map((p) => (
            <div
              key={p.name}
              className={`rounded-2xl p-7 transition ${
                p.featured
                  ? "border-2 border-emerald-500 shadow-xl shadow-emerald-100/60 relative"
                  : "border border-slate-200"
              }`}
            >
              {p.featured && (
                <span className="absolute -top-3 right-7 bg-emerald-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                  الأكثر طلباً
                </span>
              )}
              <h3 className="font-bold text-slate-900">{p.name}</h3>
              <p className="text-xs text-slate-500 mt-1">{p.for}</p>
              <p className="mt-4">
                <span className="text-4xl font-extrabold text-slate-900 tabular-nums">{p.price}</span>
                <span className="text-slate-500 text-sm"> ر.س / شهرياً</span>
              </p>

              <ul className="mt-6 space-y-2.5">
                {p.perks.map((perk) => (
                  <li key={perk} className="flex items-start gap-2 text-sm text-slate-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    {perk}
                  </li>
                ))}
              </ul>

              <a
                href="#login"
                className={`mt-7 h-11 rounded-xl font-bold text-sm flex items-center justify-center transition ${
                  p.featured
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : "border border-slate-200 text-slate-700 hover:border-emerald-300 hover:text-emerald-700"
                }`}
              >
                ابدأ التجربة
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* ── دعوة أخيرة ── */}
      <section className="bg-emerald-600">
        <div className="max-w-4xl mx-auto px-6 py-16 text-center">
          <h2 className="text-3xl font-extrabold text-white">جرّب النظام كاملاً الآن</h2>
          <p className="text-emerald-50/90 mt-3 max-w-xl mx-auto">
            حسابات جاهزة لكل دور — مالك، محاسب، استقبال، موظف، ومشترك. بلا تسجيل.
          </p>
          <a
            href="#login"
            className="mt-7 inline-flex h-12 px-7 rounded-xl bg-white text-emerald-700 font-bold items-center gap-2 hover:bg-emerald-50 transition"
          >
            ادخل بحساب تجريبي
            <ArrowLeft className="w-4 h-4" />
          </a>
        </div>
      </section>

      {/* ── التذييل ── */}
      <footer className="border-t border-slate-100">
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center gap-4 justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-emerald-600 grid place-items-center">
              <Dumbbell className="w-4 h-4 text-white" />
            </span>
            <span className="font-extrabold text-slate-900">URGYM</span>
          </div>

          <div className="flex items-center gap-5 text-sm text-slate-500">
            <a href="#features" className="hover:text-emerald-700 transition">المزايا</a>
            <a href="#pricing" className="hover:text-emerald-700 transition">الأسعار</a>
            <Link href="/portal/login" className="hover:text-emerald-700 transition">
              بوابة المشترك
            </Link>
          </div>

          <p className="text-xs text-slate-400">منصة إدارة الأندية الرياضية</p>
        </div>
      </footer>
    </div>
  );
}
