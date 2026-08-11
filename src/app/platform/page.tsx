import Link from "next/link";
import { Building2, CircleDollarSign, LogOut, Plus, Settings2, TrendingUp, Users } from "lucide-react";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth";
import { ACTION_LABEL } from "@/lib/audit";
import { logout } from "../login/actions";
import { Badge, Bar, Card, PageHeader, StatCard, Table, Td, Th, fullDate, num, sar } from "@/lib/ui";
import { Dialog } from "@/components/dialog";
import { Field, Input, Select, Submit } from "@/components/form";
import { createClub } from "./actions";

const PLAN_LABEL: Record<string, string> = {
  basic: "أساسي",
  pro: "احترافي",
  enterprise: "مؤسسي",
};

const STATUS: Record<string, { label: string; tone: "emerald" | "amber" | "red" }> = {
  active: { label: "نشط", tone: "emerald" },
  trial: { label: "تجريبي", tone: "amber" },
  suspended: { label: "موقوف", tone: "red" },
};

export default async function PlatformPage() {
  const user = await requireSuperAdmin();

  const [clubs, paidInvoices, unpaidInvoices, totalMembers, monthlyHistory, recentLogs] =
    await Promise.all([
      db.club.findMany({
        orderBy: { createdAt: "asc" },
        include: { _count: { select: { members: true, users: true } } },
      }),
      db.platformInvoice.aggregate({ where: { status: "paid" }, _sum: { amountSAR: true }, _count: true }),
      db.platformInvoice.aggregate({ where: { status: "unpaid" }, _sum: { amountSAR: true }, _count: true }),
      db.member.count(),
      db.platformInvoice.groupBy({ by: ["month"], _sum: { amountSAR: true }, orderBy: { month: "asc" } }),
      db.auditLog.findMany({ where: { clubId: null }, orderBy: { at: "desc" }, take: 6 }),
    ]);

  const mrr = clubs.filter((c) => c.platformStatus === "active").reduce((s, c) => s + c.platformFeeSAR, 0);
  const peak = Math.max(1, ...monthlyHistory.map((m) => m._sum.amountSAR ?? 0));
  const activeCount = clubs.filter((c) => c.platformStatus === "active").length;

  return (
    <div className="max-w-6xl mx-auto px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-2.5">
          <span className="w-10 h-10 rounded-xl bg-slate-900 grid place-items-center">
            <Building2 className="w-5 h-5 text-white" />
          </span>
          <div>
            <p className="font-extrabold text-slate-900 leading-tight">URGYM — لوحة مزود الحل</p>
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

      <PageHeader
        title="أداء المنصة"
        subtitle="اشتراكات الأندية وإيراداتك الشهرية"
        action={
          <Dialog
            label="نادي جديد"
            title="إضافة نادٍ جديد"
            description="يُنشأ النادي مع حساب المالك وباقات افتراضية"
            icon={<Plus className="w-4 h-4" />}
          >
            <form action={createClub} className="space-y-3">
              <Field label="اسم النادي">
                <Input name="name" required placeholder="نادي اللياقة الثاني" />
              </Field>
              <Field label="المعرّف (بالإنجليزي، بدون مسافات)">
                <Input name="slug" required dir="ltr" placeholder="fitness-two" className="text-right" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="الباقة">
                  <Select name="platformPlan" defaultValue="basic">
                    <option value="basic">أساسي — 299 ر.س</option>
                    <option value="pro">احترافي — 599 ر.س</option>
                    <option value="enterprise">مؤسسي — 1299 ر.س</option>
                  </Select>
                </Field>
                <Field label="الحالة">
                  <Select name="platformStatus" defaultValue="trial">
                    <option value="trial">تجريبي (14 يوم)</option>
                    <option value="active">نشط (30 يوم)</option>
                  </Select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="الرقم الضريبي">
                  <Input name="vatNumber" dir="ltr" placeholder="3000…" className="text-right" />
                </Field>
                <Field label="الجوال">
                  <Input name="phone" dir="ltr" placeholder="0114567890" className="text-right" />
                </Field>
              </div>

              <div className="pt-3 mt-1 border-t border-slate-100">
                <p className="text-xs text-slate-400 mb-3">حساب مالك النادي</p>
                <div className="space-y-3">
                  <Field label="اسم المالك">
                    <Input name="ownerName" required placeholder="سعود العتيبي" />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="البريد الإلكتروني">
                      <Input name="ownerEmail" type="email" required dir="ltr" placeholder="owner@club.sa" className="text-right" />
                    </Field>
                    <Field label="كلمة المرور">
                      <Input name="password" defaultValue="123456" dir="ltr" className="text-right" />
                    </Field>
                  </div>
                </div>
              </div>

              <Submit>إنشاء النادي</Submit>
            </form>
          </Dialog>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard label="الإيراد الشهري المتكرر" value={sar(mrr)} hint="MRR من الأندية النشطة" icon={<TrendingUp className="w-5 h-5" />} tone="emerald" />
        <StatCard label="عدد الأندية" value={num(clubs.length)} hint={`${num(activeCount)} نشط`} icon={<Building2 className="w-5 h-5" />} tone="violet" />
        <StatCard label="إجمالي المحصّل" value={sar(paidInvoices._sum.amountSAR ?? 0)} hint={`${num(paidInvoices._count)} فاتورة`} icon={<CircleDollarSign className="w-5 h-5" />} tone="sky" />
        <StatCard label="مستحقات غير محصلة" value={sar(unpaidInvoices._sum.amountSAR ?? 0)} hint={`${num(unpaidInvoices._count)} فاتورة`} icon={<CircleDollarSign className="w-5 h-5" />} tone={unpaidInvoices._count > 0 ? "amber" : "slate"} />
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

        <Card title="آخر الإجراءات" className="p-5 pt-4">
          {recentLogs.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">لا توجد إجراءات بعد</p>
          ) : (
            <ul className="space-y-3">
              {recentLogs.map((log) => (
                <li key={log.id} className="text-sm">
                  <p className="text-slate-700 leading-snug">{log.summary}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {log.userName} · {fullDate(log.at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
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
              <Th>إدارة</Th>
            </>
          }
        >
          {clubs.map((c) => {
            const st = STATUS[c.platformStatus] ?? STATUS.active;
            return (
              <tr key={c.id} className="hover:bg-slate-50/60 transition">
                <Td>
                  <Link href={`/platform/clubs/${c.id}`} className="font-bold hover:text-emerald-700 transition">
                    {c.name}
                  </Link>
                  <p className="text-xs text-slate-400" dir="ltr">{c.slug}</p>
                </Td>
                <Td><Badge tone="violet">{PLAN_LABEL[c.platformPlan]}</Badge></Td>
                <Td className="font-bold tabular-nums whitespace-nowrap">{sar(c.platformFeeSAR)}</Td>
                <Td className="text-slate-600 tabular-nums">{num(c._count.members)}</Td>
                <Td className="text-slate-500 whitespace-nowrap">{fullDate(c.platformEndsAt)}</Td>
                <Td><Badge tone={st.tone}>{st.label}</Badge></Td>
                <Td>
                  <Link
                    href={`/platform/clubs/${c.id}`}
                    className="w-9 h-9 rounded-lg grid place-items-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                    title="إدارة النادي"
                  >
                    <Settings2 className="w-4 h-4" />
                  </Link>
                </Td>
              </tr>
            );
          })}
        </Table>
        {clubs.length === 0 && <p className="text-center text-slate-400 py-12 text-sm">لا توجد أندية — أضف أول نادٍ</p>}
      </Card>

      <div className="mt-5 flex items-center justify-between text-sm text-slate-400 px-1">
        <span className="flex items-center gap-2">
          <Users className="w-4 h-4" />
          {num(totalMembers)} عضو في كل الأندية
        </span>
        <span>{Object.keys(ACTION_LABEL).length ? "كل الإجراءات مسجّلة في سجل التدقيق" : ""}</span>
      </div>
    </div>
  );
}
