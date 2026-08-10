import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  CalendarPlus,
  KeyRound,
  Pencil,
  Play,
  Plus,
  Power,
  Trash2,
  Users,
} from "lucide-react";
import { db } from "@/lib/db";
import { ROLES, requireSuperAdmin } from "@/lib/auth";
import { ACTION_LABEL } from "@/lib/audit";
import { Badge, Card, Empty, PageHeader, StatCard, Table, Td, Th, fullDate, num, sar } from "@/lib/ui";
import { Dialog, ConfirmButton } from "@/components/dialog";
import { Field, Input, Select, Submit } from "@/components/form";
import {
  createClubUser,
  deleteClub,
  extendClub,
  payPlatformInvoice,
  resetUserPassword,
  setClubStatus,
  updateClub,
} from "../../actions";

const STATUS: Record<string, { label: string; tone: "emerald" | "amber" | "red" }> = {
  active: { label: "نشط", tone: "emerald" },
  trial: { label: "تجريبي", tone: "amber" },
  suspended: { label: "موقوف", tone: "red" },
};

export default async function ClubDetailPage({ params }: PageProps<"/platform/clubs/[id]">) {
  await requireSuperAdmin();
  const { id } = await params;

  const club = await db.club.findUnique({
    where: { id },
    include: {
      users: { orderBy: { createdAt: "asc" } },
      platformInvoices: { orderBy: { month: "desc" } },
      _count: { select: { members: true, employees: true, invoices: true } },
    },
  });
  if (!club) notFound();

  const logs = await db.auditLog.findMany({
    where: { entityId: id },
    orderBy: { at: "desc" },
    take: 8,
  });

  const st = STATUS[club.platformStatus] ?? STATUS.active;
  const unpaid = club.platformInvoices.filter((i) => i.status === "unpaid");
  const collected = club.platformInvoices
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + i.amountSAR, 0);

  return (
    <div className="max-w-5xl mx-auto px-8 py-8">
      <Link
        href="/platform"
        className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-emerald-700 transition mb-5"
      >
        <ArrowRight className="w-4 h-4" />
        رجوع لكل الأندية
      </Link>

      <PageHeader
        title={club.name}
        subtitle={`${club.slug} · اشترك في ${fullDate(club.createdAt)}`}
        action={
          <div className="flex items-center gap-2">
            <Dialog
              label="تعديل"
              title="تعديل بيانات النادي"
              variant="ghost"
              icon={<Pencil className="w-4 h-4" />}
            >
              <form action={updateClub} className="space-y-3">
                <input type="hidden" name="clubId" value={club.id} />
                <Field label="اسم النادي">
                  <Input name="name" defaultValue={club.name} required />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="الباقة">
                    <Select name="platformPlan" defaultValue={club.platformPlan}>
                      <option value="basic">أساسي</option>
                      <option value="pro">احترافي</option>
                      <option value="enterprise">مؤسسي</option>
                    </Select>
                  </Field>
                  <Field label="الرسوم الشهرية">
                    <Input name="platformFeeSAR" type="number" min="0" step="1" defaultValue={club.platformFeeSAR} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="الجوال">
                    <Input name="phone" defaultValue={club.phone ?? ""} dir="ltr" className="text-right" />
                  </Field>
                  <Field label="الرقم الضريبي">
                    <Input name="vatNumber" defaultValue={club.vatNumber ?? ""} dir="ltr" className="text-right" />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="السجل التجاري">
                    <Input name="crNumber" defaultValue={club.crNumber ?? ""} dir="ltr" className="text-right" />
                  </Field>
                  <Field label="العنوان">
                    <Input name="address" defaultValue={club.address ?? ""} />
                  </Field>
                </div>
                <Submit>حفظ التعديلات</Submit>
              </form>
            </Dialog>

            <Dialog
              label="تمديد"
              title="تمديد الاشتراك"
              description="تُصدر فواتير المنصة تلقائياً عن المدة المضافة"
              variant="ghost"
              icon={<CalendarPlus className="w-4 h-4" />}
            >
              <form action={extendClub} className="space-y-3">
                <input type="hidden" name="clubId" value={club.id} />
                <Field label="عدد الشهور">
                  <Select name="months" defaultValue="1">
                    {[1, 3, 6, 12].map((m) => (
                      <option key={m} value={m}>{m} شهر — {sar(club.platformFeeSAR * m)}</option>
                    ))}
                  </Select>
                </Field>
                <Submit>تمديد وتفعيل</Submit>
              </form>
            </Dialog>

            <form action={setClubStatus}>
              <input type="hidden" name="clubId" value={club.id} />
              <input
                type="hidden"
                name="status"
                value={club.platformStatus === "suspended" ? "active" : "suspended"}
              />
              <ConfirmButton
                variant="ghost"
                label={club.platformStatus === "suspended" ? "تفعيل" : "إيقاف"}
                message={
                  club.platformStatus === "suspended"
                    ? `تفعيل نادي ${club.name}؟`
                    : `إيقاف نادي ${club.name}؟ لن يتمكن فريقه من الدخول للنظام.`
                }
                icon={
                  club.platformStatus === "suspended" ? (
                    <Play className="w-4 h-4" />
                  ) : (
                    <Power className="w-4 h-4" />
                  )
                }
              />
            </form>

            <Dialog
              label="حذف النادي"
              title="حذف النادي نهائياً"
              description="سيُحذف كل شيء: الأعضاء، الاشتراكات، الفواتير، الموظفون. لا يمكن التراجع."
              variant="icon"
              icon={<Trash2 className="w-4 h-4" />}
            >
              <form action={deleteClub} className="space-y-3">
                <input type="hidden" name="clubId" value={club.id} />
                <div className="rounded-xl bg-red-50 ring-1 ring-red-100 px-4 py-3 text-sm text-red-800">
                  سيُحذف {num(club._count.members)} عضو و{num(club._count.invoices)} فاتورة و
                  {num(club._count.employees)} موظف نهائياً.
                </div>
                <Field label={`اكتب اسم النادي للتأكيد: ${club.name}`}>
                  <Input name="confirmName" required placeholder={club.name} autoComplete="off" />
                </Field>
                <Submit tone="red">حذف نهائي</Submit>
              </form>
            </Dialog>
          </div>
        }
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard label="الحالة" value={st.label} hint={`يتجدد ${fullDate(club.platformEndsAt)}`} icon={<Power className="w-5 h-5" />} tone={st.tone} />
        <StatCard label="الرسوم الشهرية" value={sar(club.platformFeeSAR)} icon={<Plus className="w-5 h-5" />} tone="violet" />
        <StatCard label="المحصّل منه" value={sar(collected)} icon={<Plus className="w-5 h-5" />} tone="emerald" />
        <StatCard label="الأعضاء" value={num(club._count.members)} hint={`${num(club.users.length)} مستخدم`} icon={<Users className="w-5 h-5" />} tone="sky" />
      </div>

      <div className="grid lg:grid-cols-2 gap-5 items-start">
        <Card
          title="مستخدمو النادي"
          action={
            <Dialog label="إضافة" title="إضافة مستخدم" variant="ghost" icon={<Plus className="w-4 h-4" />}>
              <form action={createClubUser} className="space-y-3">
                <input type="hidden" name="clubId" value={club.id} />
                <Field label="الاسم">
                  <Input name="name" required placeholder="محمد العتيبي" />
                </Field>
                <Field label="البريد الإلكتروني">
                  <Input name="email" type="email" required dir="ltr" className="text-right" placeholder="name@club.sa" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="الدور">
                    <Select name="role" defaultValue="reception">
                      <option value="owner">مالك النادي</option>
                      <option value="manager">مدير</option>
                      <option value="accountant">محاسب</option>
                      <option value="hr">موارد بشرية</option>
                      <option value="reception">استقبال</option>
                    </Select>
                  </Field>
                  <Field label="كلمة المرور">
                    <Input name="password" defaultValue="123456" dir="ltr" className="text-right" />
                  </Field>
                </div>
                <Submit>إضافة المستخدم</Submit>
              </form>
            </Dialog>
          }
        >
          <Table
            head={
              <>
                <Th>المستخدم</Th>
                <Th>الدور</Th>
                <Th>آخر دخول</Th>
                <Th>إجراء</Th>
              </>
            }
          >
            {club.users.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50/60 transition">
                <Td>
                  <p className="font-bold">{u.name}</p>
                  <p className="text-xs text-slate-400" dir="ltr">{u.email}</p>
                </Td>
                <Td><Badge tone="violet">{ROLES[u.role as keyof typeof ROLES]}</Badge></Td>
                <Td className="text-slate-500 text-xs whitespace-nowrap">
                  {u.lastLoginAt ? fullDate(u.lastLoginAt) : "لم يدخل"}
                </Td>
                <Td>
                  <Dialog
                    label="تصفير كلمة المرور"
                    title={`كلمة مرور جديدة لـ ${u.name}`}
                    variant="icon"
                    icon={<KeyRound className="w-4 h-4" />}
                  >
                    <form action={resetUserPassword} className="space-y-3">
                      <input type="hidden" name="userId" value={u.id} />
                      <Field label="كلمة المرور الجديدة">
                        <Input name="password" defaultValue="123456" dir="ltr" className="text-right" required />
                      </Field>
                      <Submit>تعيين</Submit>
                    </form>
                  </Dialog>
                </Td>
              </tr>
            ))}
          </Table>
          {club.users.length === 0 && <Empty text="لا مستخدمين" />}
        </Card>

        <Card title="فواتير اشتراك المنصة">
          <Table
            head={
              <>
                <Th>الشهر</Th>
                <Th>المبلغ</Th>
                <Th>الحالة</Th>
              </>
            }
          >
            {club.platformInvoices.slice(0, 8).map((inv) => (
              <tr key={inv.id} className="hover:bg-slate-50/60 transition">
                <Td className="tabular-nums" dir="ltr">{inv.month}</Td>
                <Td className="font-bold tabular-nums whitespace-nowrap">{sar(inv.amountSAR)}</Td>
                <Td>
                  {inv.status === "paid" ? (
                    <Badge tone="emerald">محصّلة</Badge>
                  ) : (
                    <form action={payPlatformInvoice}>
                      <input type="hidden" name="invoiceId" value={inv.id} />
                      <button className="h-8 px-3 rounded-lg bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 transition">
                        تحصيل
                      </button>
                    </form>
                  )}
                </Td>
              </tr>
            ))}
          </Table>
          {unpaid.length > 0 && (
            <p className="px-5 py-3 border-t border-slate-100 text-xs text-amber-700 bg-amber-50/50">
              {num(unpaid.length)} فاتورة غير محصّلة بقيمة{" "}
              {sar(unpaid.reduce((s, i) => s + i.amountSAR, 0))}
            </p>
          )}
        </Card>
      </div>

      <Card title="سجل التدقيق" className="mt-5">
        {logs.length === 0 ? (
          <Empty text="لا توجد إجراءات مسجلة على هذا النادي" />
        ) : (
          <ul className="divide-y divide-slate-50">
            {logs.map((log) => (
              <li key={log.id} className="flex items-center gap-3 px-5 py-3.5">
                <Badge tone="slate">{ACTION_LABEL[log.action] ?? log.action}</Badge>
                <p className="text-sm text-slate-700 flex-1">{log.summary}</p>
                <span className="text-xs text-slate-400 whitespace-nowrap">
                  {log.userName} · {fullDate(log.at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
