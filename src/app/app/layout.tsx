import { redirect } from "next/navigation";
import { Dumbbell, LogOut } from "lucide-react";
import { db } from "@/lib/db";
import { ROLES, canAccess, getCurrentUser } from "@/lib/auth";
import { logout } from "../login/actions";
import { SideNav, type NavItem } from "./nav";

const ALL_ITEMS: NavItem[] = [
  { key: "dashboard", href: "/app/dashboard", label: "لوحة الإدارة" },
  { key: "reception", href: "/app/reception", label: "الاستقبال" },
  { key: "subscriptions", href: "/app/subscriptions", label: "الاشتراكات" },
  { key: "schedule", href: "/app/schedule", label: "الحصص والحجوزات" },
  { key: "invoices", href: "/app/invoices", label: "الفواتير الضريبية" },
  { key: "accounting", href: "/app/accounting", label: "المحاسبة" },
  { key: "hr", href: "/app/hr", label: "الموارد البشرية" },
  { key: "settings", href: "/app/settings", label: "الإعدادات" },
];

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "super_admin") redirect("/platform");
  if (!user.clubId) redirect("/login");

  // شارة التنبيه: اشتراكات تنتهي خلال أسبوع
  const expiringSoon = await db.subscription.count({
    where: {
      status: "active",
      endsAt: { gte: new Date(), lte: new Date(Date.now() + 7 * 86400000) },
      member: { clubId: user.clubId },
    },
  });

  const items = ALL_ITEMS.filter((i) => canAccess(user.role, i.key)).map((i) =>
    i.key === "subscriptions" ? { ...i, badge: expiringSoon } : i
  );

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 shrink-0 bg-white border-l border-slate-200 flex flex-col sticky top-0 h-screen">
        <div className="px-5 h-16 flex items-center gap-2.5 border-b border-slate-100">
          <span className="w-9 h-9 rounded-xl bg-emerald-600 grid place-items-center shrink-0">
            <Dumbbell className="w-[18px] h-[18px] text-white" />
          </span>
          <div className="min-w-0">
            <p className="font-extrabold text-slate-900 leading-tight truncate">{user.club?.name}</p>
            <p className="text-[11px] text-slate-400 leading-tight">منصة نادي</p>
          </div>
        </div>

        <div className="py-4 flex-1 overflow-y-auto">
          <SideNav items={items} />
        </div>

        <div className="border-t border-slate-100 p-3">
          <div className="flex items-center gap-3 px-2 py-2">
            <span className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 grid place-items-center text-xs font-bold shrink-0">
              {user.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-800 truncate">{user.name}</p>
              <p className="text-xs text-slate-400">{ROLES[user.role as keyof typeof ROLES]}</p>
            </div>
            <form action={logout}>
              <button
                title="تسجيل الخروج"
                aria-label="تسجيل الخروج"
                className="w-9 h-9 rounded-lg grid place-items-center text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 px-8 py-7">{children}</main>
    </div>
  );
}
