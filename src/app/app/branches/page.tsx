import { Building2, MapPin, Pencil, Plus, Power, Trash2, UserCog, Users, Wallet } from "lucide-react";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/auth";
import { Badge, Card, Empty, PageHeader, StatCard, Table, Td, Th, num, sar } from "@/lib/ui";
import { ConfirmButton, Dialog } from "@/components/dialog";
import { Field, Input, Submit } from "@/components/form";
import { assignBranchManager, deleteBranch, saveBranch, toggleBranch } from "./actions";

export default async function BranchesPage() {
  const user = await requireModule("branches");
  const clubId = user.clubId!;

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const branches = await db.branch.findMany({
    where: { clubId },
    orderBy: [{ isMain: "desc" }, { createdAt: "asc" }],
    include: {
      users: { where: { role: "branch_manager" }, select: { id: true, name: true, email: true } },
      _count: { select: { members: true, employees: true } },
    },
  });

  // إيراد ومصروف كل فرع هذا الشهر
  const stats = await Promise.all(
    branches.map(async (b) => {
      const [rev, exp] = await Promise.all([
        db.invoice.aggregate({
          where: { clubId, branchId: b.id, status: "paid", issuedAt: { gte: monthStart } },
          _sum: { totalSAR: true },
          _count: true,
        }),
        db.expense.aggregate({
          where: { clubId, branchId: b.id, spentAt: { gte: monthStart } },
          _sum: { amountSAR: true },
        }),
      ]);
      return {
        id: b.id,
        revenue: rev._sum.totalSAR ?? 0,
        invoices: rev._count,
        expenses: exp._sum.amountSAR ?? 0,
      };
    })
  );

  const unassigned = await db.member.count({ where: { clubId, branchId: null } });
  const totalRevenue = stats.reduce((s, x) => s + x.revenue, 0);
  const totalMembers = branches.reduce((s, b) => s + b._count.members, 0);

  const branchForm = (b?: (typeof branches)[number]) => (
    <form action={saveBranch} className="space-y-3">
      {b && <input type="hidden" name="branchId" value={b.id} />}
      <Field label="اسم الفرع">
        <Input name="name" defaultValue={b?.name} required placeholder="فرع الملقا" />
      </Field>
      <Field label="العنوان">
        <Input name="address" defaultValue={b?.address ?? ""} placeholder="الرياض، حي الملقا، طريق أنس بن مالك" />
      </Field>
      <Field label="الجوال">
        <Input name="phone" defaultValue={b?.phone ?? ""} dir="ltr" className="text-right" placeholder="0114567890" />
      </Field>
      <Submit>{b ? "حفظ" : "إضافة الفرع"}</Submit>
    </form>
  );

  return (
    <>
      <PageHeader
        title="الفروع"
        subtitle="كل فرع بمشتركيه وموظفيه ودخله — والمالك وحده يراها مجتمعة"
        action={
          <Dialog label="فرع جديد" title="إضافة فرع" icon={<Plus className="w-4 h-4" />}>
            {branchForm()}
          </Dialog>
        }
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard label="عدد الفروع" value={num(branches.length)} icon={<Building2 className="w-5 h-5" />} tone="violet" />
        <StatCard label="إجمالي المشتركين" value={num(totalMembers)} icon={<Users className="w-5 h-5" />} tone="emerald" />
        <StatCard label="إيراد الشهر (كل الفروع)" value={sar(totalRevenue)} icon={<Wallet className="w-5 h-5" />} tone="sky" />
        <StatCard
          label="بلا فرع محدد"
          value={num(unassigned)}
          hint="مشترك غير مرتبط بفرع"
          icon={<MapPin className="w-5 h-5" />}
          tone={unassigned > 0 ? "amber" : "slate"}
        />
      </div>

      {branches.length === 0 ? (
        <Card>
          <Empty text="لا توجد فروع — أضف الفرع الرئيسي أولاً ثم بقية الفروع" />
        </Card>
      ) : (
        <div className="grid lg:grid-cols-2 gap-5">
          {branches.map((b) => {
            const st = stats.find((x) => x.id === b.id)!;
            const profit = st.revenue - st.expenses;
            const manager = b.users[0];

            return (
              <Card key={b.id} className="p-5">
                <div className="flex items-start gap-3 mb-4">
                  <span className="w-11 h-11 rounded-xl bg-violet-50 text-violet-700 grid place-items-center shrink-0">
                    <Building2 className="w-5 h-5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold">{b.name}</p>
                      {b.isMain && <Badge tone="emerald">رئيسي</Badge>}
                      {!b.active && <Badge tone="red">موقوف</Badge>}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{b.address ?? "بلا عنوان"}</p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Dialog label="تعديل" title={`تعديل ${b.name}`} variant="icon" icon={<Pencil className="w-4 h-4" />}>
                      {branchForm(b)}
                    </Dialog>
                    <form action={toggleBranch}>
                      <input type="hidden" name="branchId" value={b.id} />
                      <button
                        title={b.active ? "إيقاف" : "تفعيل"}
                        className="w-9 h-9 rounded-lg grid place-items-center text-slate-400 hover:bg-amber-50 hover:text-amber-600 transition"
                      >
                        <Power className="w-4 h-4" />
                      </button>
                    </form>
                    {!b.isMain && (
                      <form action={deleteBranch}>
                        <input type="hidden" name="branchId" value={b.id} />
                        <ConfirmButton
                          label="حذف"
                          message={`حذف فرع ${b.name}؟ بياناته (${b._count.members} مشترك) ستبقى لكن بلا فرع.`}
                          icon={<Trash2 className="w-4 h-4" />}
                        />
                      </form>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 mb-4">
                  {[
                    ["المشتركون", num(b._count.members)],
                    ["الموظفون", num(b._count.employees)],
                    ["إيراد الشهر", sar(st.revenue)],
                    ["صافي الشهر", sar(profit)],
                  ].map(([label, value], i) => (
                    <div key={label} className="rounded-xl bg-slate-50 px-3.5 py-2.5">
                      <p className="text-[11px] text-slate-500">{label}</p>
                      <p
                        className={`font-bold tabular-nums mt-0.5 ${
                          i === 3 ? (profit >= 0 ? "text-emerald-700" : "text-red-600") : "text-slate-800"
                        }`}
                      >
                        {value}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center gap-3">
                  <UserCog className="w-4 h-4 text-slate-300 shrink-0" />
                  {manager ? (
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{manager.name}</p>
                      <p className="text-xs text-slate-400 truncate" dir="ltr">{manager.email}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400 flex-1">لا يوجد مدير للفرع</p>
                  )}

                  <Dialog
                    label={manager ? "تعيين آخر" : "تعيين مدير"}
                    title={`مدير فرع ${b.name}`}
                    description="يرى بيانات فرعه فقط"
                    variant="ghost"
                  >
                    <form action={assignBranchManager} className="space-y-3">
                      <input type="hidden" name="branchId" value={b.id} />
                      <Field label="الاسم">
                        <Input name="name" required placeholder="سعود العتيبي" />
                      </Field>
                      <Field label="البريد الإلكتروني">
                        <Input name="email" type="email" required dir="ltr" className="text-right" placeholder="manager@branch.sa" />
                      </Field>
                      <Field label="كلمة المرور">
                        <Input name="password" defaultValue="123456" dir="ltr" className="text-right" />
                      </Field>
                      <Submit>تعيين المدير</Submit>
                    </form>
                  </Dialog>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Card title="مقارنة أداء الفروع" className="mt-5">
        <Table
          head={
            <>
              <Th>الفرع</Th>
              <Th>المشتركون</Th>
              <Th>الفواتير</Th>
              <Th>الإيراد</Th>
              <Th>المصروف</Th>
              <Th>الصافي</Th>
            </>
          }
        >
          {branches.map((b) => {
            const st = stats.find((x) => x.id === b.id)!;
            const profit = st.revenue - st.expenses;
            return (
              <tr key={b.id} className="hover:bg-slate-50/60 transition">
                <Td className="font-bold">{b.name}</Td>
                <Td className="tabular-nums">{num(b._count.members)}</Td>
                <Td className="tabular-nums">{num(st.invoices)}</Td>
                <Td className="tabular-nums whitespace-nowrap">{sar(st.revenue)}</Td>
                <Td className="tabular-nums text-red-600 whitespace-nowrap">{sar(st.expenses)}</Td>
                <Td className={`tabular-nums font-bold whitespace-nowrap ${profit >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                  {sar(profit)}
                </Td>
              </tr>
            );
          })}
        </Table>
        <p className="px-5 py-3 text-xs text-slate-400 border-t border-slate-100">
          الأرقام للشهر الحالي · مدير الفرع يرى بيانات فرعه فقط في كل الأقسام
        </p>
      </Card>
    </>
  );
}
