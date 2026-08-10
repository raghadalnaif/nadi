import { Building2, DatabaseBackup, Download, Fingerprint, KeyRound, MapPin, Pencil, Plug, Power, ShieldCheck, Trash2, UserPlus, Users } from "lucide-react";
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
import { cookies } from "next/headers";
import { createApiKey, deleteApiKey, saveCheckinSettings, takeBackup, toggleApiKey } from "../ops-actions";
import { listBackups } from "@/lib/backup";
import { saveClubLocation } from "../hr/actions";

const CHECKIN_METHODS = [
  { key: "checkinManual", label: "تحضير يدوي من الاستقبال", hint: "الموظف يبحث ويضغط تحضير" },
  { key: "checkinBarcode", label: "باركود / بطاقة عضوية", hint: "مسح ضوئي سريع أو رقم العضوية" },
  { key: "checkinFingerprint", label: "بصمة", hint: "يتطلب جهاز بصمة مربوط بالشبكة" },
  { key: "checkinWristband", label: "أساور ذكية", hint: "أساور RFID للأعضاء" },
  { key: "checkinGate", label: "بوابة دخول", hint: "بوابة إلكترونية عند المدخل" },
] as const;

const MODULE_LABELS: Record<string, string> = {
  dashboard: "لوحة الإدارة",
  reception: "الاستقبال",
  subscriptions: "الاشتراكات",
  schedule: "الحصص",
  offers: "العروض والخصومات",
  invoices: "الفواتير الضريبية",
  accounting: "المحاسبة",
  reports: "التقارير",
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

  const [backups, apiKeys, newKey] = await Promise.all([
    listBackups(club.slug),
    db.apiKey.findMany({ where: { clubId }, orderBy: { createdAt: "desc" } }),
    cookies().then((c) => c.get("nadi_new_key")?.value),
  ]);
  const settings = club as unknown as Record<string, boolean>;

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

      <div className="grid lg:grid-cols-2 gap-5 items-start mt-5">
        <Card
          title="طرق التحضير"
          className="p-5 pt-4"
          action={<span className="text-xs text-slate-400 flex items-center gap-1.5"><Fingerprint className="w-3.5 h-3.5" />فعّل ما يناسب ناديك</span>}
        >
          <form action={saveCheckinSettings} className="space-y-3">
            {CHECKIN_METHODS.map((m) => (
              <label
                key={m.key}
                className="flex items-start gap-3 rounded-xl border border-slate-200 px-4 py-3 cursor-pointer hover:border-emerald-300 hover:bg-emerald-50/30 transition"
              >
                <input
                  type="checkbox"
                  name={m.key}
                  defaultChecked={settings[m.key]}
                  className="mt-0.5 w-4 h-4 accent-emerald-600"
                />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold text-slate-800">{m.label}</span>
                  <span className="block text-xs text-slate-400 mt-0.5">{m.hint}</span>
                </span>
              </label>
            ))}

            <label className="flex items-start gap-3 rounded-xl bg-amber-50 ring-1 ring-amber-100 px-4 py-3 cursor-pointer">
              <input
                type="checkbox"
                name="blockExpiredEntry"
                defaultChecked={club.blockExpiredEntry}
                className="mt-0.5 w-4 h-4 accent-amber-600"
              />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold text-amber-900">منع دخول منتهي الاشتراك</span>
                <span className="block text-xs text-amber-700 mt-0.5">
                  يرفض التحضير تلقائياً ويطالب بالتجديد
                </span>
              </span>
            </label>

            <Submit>حفظ الإعدادات</Submit>
          </form>
        </Card>

        <Card
          title="النسخ الاحتياطي"
          className="p-5 pt-4"
          action={<span className="text-xs text-slate-400 flex items-center gap-1.5"><DatabaseBackup className="w-3.5 h-3.5" />حماية بياناتك</span>}
        >
          <div className="rounded-xl bg-slate-50 px-4 py-3 mb-4">
            <p className="text-sm text-slate-600">
              آخر نسخة:{" "}
              <b className="text-slate-800">
                {club.lastBackupAt ? fullDate(club.lastBackupAt) : "لم تُؤخذ نسخة بعد"}
              </b>
            </p>
          </div>

          <div className="flex gap-2 mb-4">
            <form action={takeBackup} className="flex-1">
              <Submit>أخذ نسخة الآن</Submit>
            </form>
            <a
              href="/app/settings/backup"
              className="h-11 px-4 rounded-xl border border-slate-200 text-sm text-slate-600 flex items-center gap-1.5 hover:bg-slate-50 transition whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              تنزيل
            </a>
          </div>

          {backups.length > 0 && (
            <ul className="divide-y divide-slate-50 border-t border-slate-100 pt-1">
              {backups.slice(0, 5).map((b) => (
                <li key={b.name} className="flex items-center justify-between gap-3 py-2.5 text-xs">
                  <span className="text-slate-500 truncate">{fullDate(b.at)}</span>
                  <span className="text-slate-400 tabular-nums shrink-0">
                    {Math.round(b.size / 1024)} كيلوبايت
                  </span>
                </li>
              ))}
            </ul>
          )}

          <p className="text-xs text-slate-400 mt-3 pt-3 border-t border-slate-100 leading-relaxed">
            النسخة تشمل كل بيانات النادي: الأعضاء، الاشتراكات، الفواتير، الموظفون، والمصروفات.
            عند النشر على خادم سحابي يُفعَّل النسخ التلقائي اليومي إضافةً لهذا.
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
        title="موقع النادي ونطاق حضور الموظفين"
        className="mt-5 p-5 pt-4"
        action={<span className="text-xs text-slate-400 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />للتحقق الجغرافي</span>}
      >
        <form action={saveClubLocation} className="space-y-3">
          <div className="grid sm:grid-cols-3 gap-3">
            <Field label="خط العرض (Latitude)">
              <Input name="latitude" type="number" step="0.000001" defaultValue={club.latitude ?? ""} dir="ltr" className="text-right" placeholder="24.774265" />
            </Field>
            <Field label="خط الطول (Longitude)">
              <Input name="longitude" type="number" step="0.000001" defaultValue={club.longitude ?? ""} dir="ltr" className="text-right" placeholder="46.738586" />
            </Field>
            <Field label="النطاق المسموح (متر)">
              <Input name="geofenceMeters" type="number" min="20" max="2000" step="10" defaultValue={club.geofenceMeters} />
            </Field>
          </div>

          <label className="flex items-start gap-3 rounded-xl bg-amber-50 ring-1 ring-amber-100 px-4 py-3 cursor-pointer">
            <input type="checkbox" name="requireGeoStaff" defaultChecked={club.requireGeoStaff} className="mt-0.5 w-4 h-4 accent-amber-600" />
            <span className="flex-1">
              <span className="block text-sm font-bold text-amber-900">إلزام التحقق الجغرافي</span>
              <span className="block text-xs text-amber-700 mt-0.5">
                يُرفض تسجيل الحضور من خارج النطاق — بدونه يُسجَّل الحضور مع تنبيه فقط
              </span>
            </span>
          </label>

          <Submit>حفظ الموقع</Submit>
        </form>

        <p className="text-xs text-slate-400 mt-3 pt-3 border-t border-slate-100 leading-relaxed">
          لمعرفة إحداثيات ناديك: افتح خرائط قوقل، اضغط مطولاً على موقع النادي، وانسخ الرقمين الظاهرين.
        </p>
      </Card>

      <Card
        title="الربط مع التطبيقات (API)"
        className="mt-5"
        action={
          <Dialog label="مفتاح جديد" title="إنشاء مفتاح API" description="يُعرض المفتاح مرة واحدة فقط" variant="ghost" icon={<Plug className="w-4 h-4" />}>
            <form action={createApiKey} className="space-y-3">
              <Field label="اسم الاستخدام">
                <Input name="name" required placeholder="تطبيق الجوال / جهاز البصمة / UrPass" />
              </Field>
              <div className="space-y-2">
                <p className="text-sm text-slate-600">الصلاحيات</p>
                {[
                  { key: "scopeRead", label: "قراءة", hint: "الأعضاء، الباقات، الحصص" },
                  { key: "scopeWrite", label: "كتابة", hint: "تسجيل أعضاء واشتراكات وحجوزات" },
                  { key: "scopeCheckin", label: "تحضير", hint: "للبصمة والبوابات والأساور" },
                ].map((sc) => (
                  <label key={sc.key} className="flex items-start gap-3 rounded-xl border border-slate-200 px-3.5 py-2.5 cursor-pointer hover:border-emerald-300 transition">
                    <input type="checkbox" name={sc.key} defaultChecked={sc.key !== "scopeCheckin"} className="mt-0.5 w-4 h-4 accent-emerald-600" />
                    <span className="flex-1">
                      <span className="block text-sm font-bold text-slate-800">{sc.label}</span>
                      <span className="block text-xs text-slate-400">{sc.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
              <Submit>إنشاء المفتاح</Submit>
            </form>
          </Dialog>
        }
      >
        {newKey && (
          <div className="mx-5 mt-5 rounded-xl bg-emerald-50 ring-1 ring-emerald-100 px-4 py-3">
            <p className="text-sm font-bold text-emerald-800 mb-1.5">مفتاحك الجديد — انسخه الآن، لن يظهر مرة أخرى</p>
            <code className="block bg-white rounded-lg px-3 py-2 text-xs font-mono text-slate-800 break-all" dir="ltr">
              {newKey}
            </code>
          </div>
        )}

        {apiKeys.length === 0 ? (
          <Empty text="لا توجد مفاتيح — أنشئ مفتاحاً لربط تطبيق أو جهاز" />
        ) : (
          <Table
            head={
              <>
                <Th>الاستخدام</Th>
                <Th>المفتاح</Th>
                <Th>الصلاحيات</Th>
                <Th>الاستدعاءات</Th>
                <Th>آخر استخدام</Th>
                <Th>إجراء</Th>
              </>
            }
          >
            {apiKeys.map((k) => (
              <tr key={k.id} className="hover:bg-slate-50/60 transition">
                <Td className="font-bold">{k.name}</Td>
                <Td>
                  <code className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-lg" dir="ltr">
                    {k.prefix}…
                  </code>
                </Td>
                <Td>
                  <div className="flex gap-1 flex-wrap">
                    {k.scopes.split(",").map((sc) => (
                      <Badge key={sc} tone="violet">
                        {sc === "read" ? "قراءة" : sc === "write" ? "كتابة" : "تحضير"}
                      </Badge>
                    ))}
                  </div>
                </Td>
                <Td className="text-slate-500 tabular-nums">{k.callCount}</Td>
                <Td className="text-slate-500 text-xs whitespace-nowrap">
                  {k.lastUsedAt ? fullDate(k.lastUsedAt) : "لم يُستخدم"}
                </Td>
                <Td>
                  <div className="flex items-center gap-1">
                    <form action={toggleApiKey}>
                      <input type="hidden" name="keyId" value={k.id} />
                      <button
                        title={k.active ? "إيقاف" : "تفعيل"}
                        className="w-9 h-9 rounded-lg grid place-items-center text-slate-400 hover:bg-amber-50 hover:text-amber-600 transition"
                      >
                        <Power className="w-4 h-4" />
                      </button>
                    </form>
                    <form action={deleteApiKey}>
                      <input type="hidden" name="keyId" value={k.id} />
                      <ConfirmButton
                        label="حذف"
                        message={`حذف مفتاح ${k.name}؟ ستتوقف التطبيقات المرتبطة به فوراً.`}
                        icon={<Trash2 className="w-4 h-4" />}
                      />
                    </form>
                  </div>
                </Td>
              </tr>
            ))}
          </Table>
        )}

        <div className="px-5 py-4 border-t border-slate-100 text-xs text-slate-500 leading-relaxed">
          <p className="font-bold text-slate-700 mb-1.5">نقاط الاتصال المتاحة:</p>
          <code dir="ltr" className="block bg-slate-50 rounded-lg p-3 font-mono text-[11px] space-y-0.5 text-slate-600">
            GET&nbsp;&nbsp;/api/v1/plans<br />
            GET&nbsp;&nbsp;/api/v1/members?q=<br />
            POST /api/v1/members<br />
            GET&nbsp;&nbsp;/api/v1/subscriptions?status=active<br />
            POST /api/v1/subscriptions&nbsp;&nbsp;← إدراج العضويات<br />
            GET&nbsp;&nbsp;/api/v1/classes?days=7<br />
            POST /api/v1/bookings<br />
            POST /api/v1/checkin&nbsp;&nbsp;← البصمة والبوابات
          </code>
          <p className="mt-2">أرسل المفتاح في الترويسة: <code dir="ltr" className="bg-slate-100 px-1.5 py-0.5 rounded">Authorization: Bearer &lt;key&gt;</code></p>
        </div>
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
