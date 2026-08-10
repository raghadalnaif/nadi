import { Building2, CircleDollarSign, LogOut, TrendingUp, Users } from "lucide-react";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth";
import { logout } from "../login/actions";
import { Badge, Bar, Card, PageHeader, StatCard, Table, Td, Th, fullDate, num, sar } from "@/lib/ui";

const PLAN_LABEL: Record<string, string> = {
  basic: "أساسي",
  pro: "احترافي",
  enterprise: "مؤسسي",
};

export default async function PlatformPage() {
  const user = await requireSuperAdmin();

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [clubs, paidInvoices, unpaidInvoices, totalMembers, monthlyHistory] = await Promise.all([
    db.club.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        _count: { select: { members: true, users: true } },
        platformInvoices: { orderBy: { month: "desc" }, take: 1 },
      },
    }),
    db.platformInvoice.aggregate({ where: { status: "paid" }, _sum: { amountSAR: true }, _count: true }),
    db.platformInvoice.aggregate({ where: { status: "unpaid" }, _sum: { amountSAR: true }, _count: true }),
    db.member.count(),
    db.platformInvoice.groupBy({
      by: ["month"],
      _sum: { amountSAR: true },
      orderBy: { month: "asc" },
    }),
  ]);

  const mrr = clubs
    .filter((c) => c.platformStatus === "active")
    .reduce((s, c) => s + c.platformFeeSAR, 0);
  const peak = Math.max(1, ...monthlyHistory.map((m) => m._sum.amountSAR ?? 0));

  return (
    <div className="max-w-6xl mx-auto px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-2.5">
          <span className="w-10 h-10 rounded-xl bg-slate-900 grid place-items-center">
            <Building2 className="w-5 h-5 text-white" />
          </span>
          <div>
            <p className="font-extrabold text-slate-900 leading-tight">لوحة مزود الحل</p>
            <p className="text-xs text-slate-400">{user.name}</p>
          </div>
        </div>
        <form action={logout}>
          <button className="h-10 px-4 rounded-xl border border-slate-200 text-sm text-slate-600 flex items-center gap-2 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition">
            <LogOut className="w-4 h-4" />
            خروج
          </button>
        </form>
      </div>

      <PageHeader title="أداء المنصة" subtitle="اشتراكات الأندية وإيراداتك الشهرية" />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="الإيراد الشهري المتكرر"
          value={sar(mrr)}
          hint="MRR من الأندية النشطة"
          icon={<TrendingUp className="w-5 h-5" />}
          tone="emerald"
        />
        <StatCard label="عدد الأندية" value={num(clubs.length)} icon={<Building2 className="w-5 h-5" />} tone="violet" />
        <StatCard
          label="إجمالي المحصّل"
          value={sar(paidInvoices._sum.amountSAR ?? 0)}
          hint={`${num(paidInvoices._count)} فاتورة`}
          icon={<CircleDollarSign className="w-5 h-5" />}
          tone="sky"
        />
        <StatCard
          label="مستحقات غير محصّلة"
          value={sar(unpaidInvoices._sum.amountSAR ?? 0)}
          hint={`${num(unpaidInvoices._count)} فاتورة`}
          icon={<CircleDollarSign className="w-5 h-5" />}
          tone={unpaidInvoices._count > 0 ? "amber" : "slate"}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-5 items-start mb-5">
        <Card title="إيرادات المنصة شهرياً" className="lg:col-span-2 p-5 pt-2">
          <div className="flex gap-3 h-48 pt-6">
            {monthlyHistory.map((m) => (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-2 h-full">
                <span className="text-[11px] font-bold text-slate-600 tabular-nums whitespace-nowrap">
                  {sar(m._sum.amountSAR ?? 0)}
                </span>
                <div className="flex-1 w-full flex items-end">
                  <div
                    className="w-full bg-slate-900 rounded-t-lg transition-all hover:bg-emerald-600 min-h-1"
                    style={{ height: `${Math.max(4, ((m._sum.amountSAR ?? 0) / peak) * 100)}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-400 tabular-nums" dir="ltr">{m.month}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="نظرة عامة" className="p-5 pt-4">
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-slate-600">أندية نشطة</span>
                <span className="font-bold tabular-nums">
                  {num(clubs.filter((c) => c.platformStatus === "active").length)} / {num(clubs.length)}
                </span>
              </div>
              <Bar pct={(clubs.filter((c) => c.platformStatus === "active").length / clubs.length) * 100} />
            </div>
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-sm">
              <span className="text-slate-600 flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-300" />
                أعضاء في كل الأندية
              </span>
              <span className="font-bold tabular-nums">{num(totalMembers)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">متوسط الاشتراك</span>
              <span className="font-bold tabular-nums">{sar(mrr / Math.max(1, clubs.length))}</span>
            </div>
          </div>
        </Card>
      </div>

      <Card title="الأندية المشتركة">
        <Table
          head={
            <>
              <Th>النادي</Th>
              <Th>الباقة</Th>
              <Th>الرسوم الشهرية</Th>
              <Th>الأعضاء</Th>
              <Th>يتجدد في</Th>
              <Th>الحالة</Th>
            </>
          }
        >
          {clubs.map((c) => (
            <tr key={c.id} className="hover:bg-slate-50/60 transition">
              <Td>
                <p className="font-bold">{c.name}</p>
                <p className="text-xs text-slate-400" dir="ltr">{c.slug}</p>
              </Td>
              <Td><Badge tone="violet">{PLAN_LABEL[c.platformPlan]}</Badge></Td>
              <Td className="font-bold tabular-nums whitespace-nowrap">{sar(c.platformFeeSAR)}</Td>
              <Td className="text-slate-600 tabular-nums">{num(c._count.members)}</Td>
              <Td className="text-slate-500 whitespace-nowrap">{fullDate(c.platformEndsAt)}</Td>
              <Td>
                <Badge tone={c.platformStatus === "active" ? "emerald" : c.platformStatus === "trial" ? "amber" : "red"}>
                  {c.platformStatus === "active" ? "نشط" : c.platformStatus === "trial" ? "تجريبي" : "موقوف"}
                </Badge>
              </Td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
