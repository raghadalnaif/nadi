import { notFound, redirect } from "next/navigation";
import { CalendarCheck, Dumbbell, MapPin, QrCode, Wallet } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ClubLoginForm } from "./login-form";

const perks = [
  { icon: CalendarCheck, text: "احجز حصصك بنفسك" },
  { icon: QrCode, text: "رمز دخولك للنادي" },
  { icon: Wallet, text: "اشتراكك وفواتيرك" },
];

export default async function ClubLoginPage({ params }: PageProps<"/c/[slug]/login">) {
  const { slug } = await params;

  const club = await db.club.findUnique({
    where: { slug },
    select: { id: true, name: true, address: true, platformStatus: true },
  });
  if (!club) notFound();

  // من دخل بالفعل كمشترك في هذا النادي يذهب لبوابته مباشرة
  const user = await getCurrentUser();
  if (user?.memberId) {
    const member = await db.member.findUnique({
      where: { id: user.memberId },
      select: { clubId: true },
    });
    if (member?.clubId === club.id) redirect(`/c/${slug}`);
  }

  const suspended = club.platformStatus === "suspended";

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2.5 mb-8">
            <span className="w-10 h-10 rounded-xl bg-emerald-600 grid place-items-center">
              <Dumbbell className="w-5 h-5 text-white" />
            </span>
            <div className="min-w-0">
              <p className="text-lg font-extrabold text-slate-900 truncate">{club.name}</p>
              <p className="text-[11px] text-slate-400">بوابة المشتركين</p>
            </div>
          </div>

          {suspended ? (
            <div className="rounded-2xl bg-amber-50 ring-1 ring-amber-100 px-5 py-6 text-center">
              <p className="font-bold text-amber-900">البوابة متوقفة مؤقتاً</p>
              <p className="text-sm text-amber-700 mt-1.5">تواصل مع إدارة النادي</p>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-extrabold text-slate-900">أهلاً بك</h1>
              <p className="text-sm text-slate-500 mt-1.5 mb-7">
                أدخل رقم جوالك المسجّل لدى النادي ويصلك رمز الدخول
              </p>

              <ClubLoginForm slug={slug} />
            </>
          )}
        </div>
      </div>

      <div className="hidden lg:flex flex-col justify-center bg-emerald-600 px-14 py-12 relative overflow-hidden">
        <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-emerald-500/40" />
        <div className="absolute -bottom-32 -right-10 w-96 h-96 rounded-full bg-emerald-700/30" />

        <div className="relative">
          <h2 className="text-3xl font-extrabold text-white leading-snug">{club.name}</h2>
          {club.address && (
            <p className="text-emerald-50/80 mt-2 flex items-center gap-1.5 text-sm">
              <MapPin className="w-4 h-4" />
              {club.address}
            </p>
          )}
          <p className="text-emerald-50/90 mt-4 max-w-md">
            ناديك في جوالك — تابع اشتراكك واحجز حصصك واعرف حضورك من أي مكان.
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
