import { Building2, KeyRound, Pencil, Power, ShieldCheck, Trash2, UserPlus, Users } from "lucide-react";
import { db } from "@/lib/db";
import { MODULE_ACCESS, ROLES, requireModule, type Role } from "@/lib/auth";
import { ACTION_LABEL } from "@/lib/audit";
import { Badge, Card, Empty, PageHeader, Table, Td, Th, fullDate, sar } from "@/lib/ui";
import { ConfirmButton, Dialog } from "@/components/dialog";
import { Field, Input, Select, Submit } from "@/components/form";
import {
  changeMyPassword,
  createUser,
  deleteUser,
  saveClubProfile,
  toggleUser,
  updateUser,
} from "../manage-actions";

const MODULE_LABELS: Record<string, string> = {
  dashboard: "لوحة الإدارة",
  reception: "الاستقبال",
  subscriptions: "الاشتراكات",
  schedule: "الحصص",
  accounting: "المحاسبة",
  hr: "الموارد البشرية",
  settings: "الإعدادات",
};

const CLUB_ROLES: Role[] = ["owner", "manager", "accountant", "hr", "reception"];

const roleOptions = (
  <>
    <option value="owner">مالك النادي</option>
    <option value="manager">مدير</option>
    <option value="accountant">محاسب</option>
    <option value="hr">موارد بشرية</option>
    <option value="reception">استقبال</option>
  </>
);

export default async function SettingsPage() {
  const user = await requireModule("settings");
  const clubId = user.clubId!;

  const [club, users, logs] = await Promise.all([
    db.club.findUnique({ where: { id: clubId } }),
    db.user.findMany({ where: { clubId }, orderBy: { createdAt: "asc" } }),
    db.auditLog.findMany({ where: { clubId }, orderBy: { at: "desc" }, take: 10 }),
  ]);
  if (!club) return null;

  return (
    <>
      <PageHeader
        title="الإعدادات"
        subtitle="بيانات النادي، المستخدمون، والصلاحيات"
        action={
          <Dialog label="كلمة مروري" title="تغيير كلمة المرور" variant="ghost" icon={<KeyRound className="w-4 h-4" />}>
            <form action={changeMyPassword} className="space-y-3">
              <Field label="كلمة المرور الجديدة (6 أحرف على الأقل)">
                <Input name="password" type="password" required minLength={6} dir="ltr" className="text-right" />
              </Field>
              <Submit>تغيير</Submit>
            </form>
          </Dialog>
        }
      />

      <div className="grid lg:grid-cols-2 gap-5 items-start">
        <Card
          title="بيانات النادي"
          className="p-5 pt-4"
          action={
            <Dialog label="تعديل" title="تعديل بيانات النادي" variant="ghost" icon={<Pencil className="w-4 h-4" />}>
              <form action={saveClubProfile} className="space-y-3">
                <Field label="اسم النادي">
                  <Input name="name" defaultValue={club.name} required />
                </Field>
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
                <Submit>حفظ</Submit>
              </form>
            </Dialog>
          }
        >
          <dl className="space-y-3.5">
            {[
              ["اسم النادي", club.name, false],
              ["الجوال", club.phone ?? "—", true],
              ["العنوان", club.address ?? "—", false],
              ["الرقم الضريبي", club.vatNumber ?? "—", true],
              ["السجل التجاري", club.crNumber ?? "—", true],
            ].map(([label, value, ltr]) => (
              <div key={String(label)} className="flex items-center justify-between gap-4 text-sm">
                <dt className="text-slate-500">{label}</dt>
                <dd className="font-medium text-left" dir={ltr ? "ltr" : undefined}>{value}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card title="اشتراك النادي في المنصة" className="p-5 pt-4">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-11 h-11 rounded-xl bg-violet-50 text-violet-700 grid place-items-center">
              <Building2 className="w-5 h-5" />
            </span>
            <div>
              <p className="font-bold capitalize">{club.platformPlan}</p>
              <p className="text-sm text-slate-500">{sar(club.platformFeeSAR)} شهرياً</p>
            </div>
            <div className="mr-auto">
              <Badge tone={club.platformStatus === "active" ? "emerald" : "amber"}>
                {club.platformStatus === "active" ? "نشط" : "تجريبي"}
              </Badge>
            </div>
          </div>
          <p className="text-sm text-slate-500">
            يتجدد في <b className="text-slate-700">{fullDate(club.platformEndsAt)}</b>
          </p>
          <p className="text-xs text-slate-400 mt-3 pt-3 border-t border-slate-100">
            لتغيير الباقة أو التمديد، تواصل مع مزود الخدمة
          </p>
        </Card>
      </div>

      <Card
        title="مستخدمو النادي"
        className="mt-5"
        action={
          <Dialog label="مستخدم جديد" title="إضافة مستخدم" variant="ghost" icon={<UserPlus className="w-4 h-4" />}>
            <form action={createUser} className="space-y-3">
              <Field label="الاسم">
                <Input name="name" required placeholder="محمد العتيبي" />
              </Field>
              <Field label="البريد الإلكتروني">
                <Input name="email" type="email" required dir="ltr" className="text-right" placeholder="name@club.sa" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="الدور">
                  <Select name="role" defaultValue="reception">{roleOptions}</Select>
                </Field>
                <Field label="كلمة المرور">
                  <Input name="password" defaultValue="123456" dir="ltr" className="text-right" />
                </Field>
              </div>
              <Submit>إضافة</Submit>
            </form>
          </Dialog>
        }
      >
        <Table
          head={
            <>
              <Th>الاسم</Th>
              <Th>البريد الإلكتروني</Th>
              <Th>الدور</Th>
              <Th>آخر دخول</Th>
              <Th>الحالة</Th>
              <Th>إجراء</Th>
            </>
          }
        >
          {users.map((u) => (
            <tr key={u.id} className="hover:bg-slate-50/60 transition">
              <Td className="font-bold">
                {u.name}
                {u.id === user.id && <span className="text-xs text-slate-400 font-normal"> (أنت)</span>}
              </Td>
              <Td className="text-slate-500" dir="ltr">{u.email}</Td>
              <Td><Badge tone="violet">{ROLES[u.role as keyof typeof ROLES]}</Badge></Td>
              <Td className="text-slate-500 whitespace-nowrap text-xs">
                {u.lastLoginAt ? fullDate(u.lastLoginAt) : "لم يدخل بعد"}
              </Td>
              <Td><Badge tone={u.active ? "emerald" : "red"}>{u.active ? "نشط" : "موقوف"}</Badge></Td>
              <Td>
                <div className="flex items-center gap-1">
                  <Dialog label="تعديل" title={`تعديل ${u.name}`} variant="icon" icon={<Pencil className="w-4 h-4" />}>
                    <form action={updateUser} className="space-y-3">
                      <input type="hidden" name="userId" value={u.id} />
                      <Field label="الاسم">
                        <Input name="name" defaultValue={u.name} required />
                      </Field>
                      <Field label="الدور">
                        <Select name="role" defaultValue={u.role}>{roleOptions}</Select>
                      </Field>
                      <Submit>حفظ</Submit>
                    </form>
                  </Dialog>

                  {u.id !== user.id && (
                    <>
                      <form action={toggleUser}>
                        <input type="hidden" name="userId" value={u.id} />
                        <ConfirmButton
                          label={u.active ? "إيقاف" : "تفعيل"}
                          message={u.active ? `إيقاف ${u.name}؟ لن يتمكن من الدخول.` : `تفعيل ${u.name}؟`}
                          icon={<Power className="w-4 h-4" />}
                        />
                      </form>
                      <form action={deleteUser}>
                        <input type="hidden" name="userId" value={u.id} />
                        <ConfirmButton
                          label="حذف"
                          message={`حذف المستخدم ${u.name} نهائياً؟`}
                          icon={<Trash2 className="w-4 h-4" />}
                        />
                      </form>
                    </>
                  )}
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      </Card>

      <Card
        title="مصفوفة الصلاحيات"
        className="mt-5"
        action={<span className="text-xs text-slate-400 flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" />من يرى ماذا</span>}
      >
        <Table
          head={
            <>
              <Th>القسم</Th>
              {CLUB_ROLES.map((r) => (
                <Th key={r} className="text-center">{ROLES[r]}</Th>
              ))}
            </>
          }
        >
          {Object.entries(MODULE_ACCESS).map(([moduleName, roles]) => (
            <tr key={moduleName} className="hover:bg-slate-50/60 transition">
              <Td className="font-bold whitespace-nowrap">{MODULE_LABELS[moduleName]}</Td>
              {CLUB_ROLES.map((r) => (
                <td key={r} className="px-5 py-3.5 text-center">
                  {roles.includes(r) ? (
                    <span className="inline-block w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 text-xs leading-5">✓</span>
                  ) : (
                    <span className="inline-block w-5 h-5 rounded-full bg-slate-50 text-slate-300 text-xs leading-5">—</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </Table>
      </Card>

      <Card
        title="سجل التدقيق"
        className="mt-5"
        action={<span className="text-xs text-slate-400 flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />آخر 10 إجراءات</span>}
      >
        {logs.length === 0 ? (
          <Empty text="لا توجد إجراءات مسجلة بعد" />
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
    </>
  );
}
