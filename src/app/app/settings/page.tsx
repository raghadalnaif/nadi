import { Building2, ShieldCheck, Users } from "lucide-react";
import { db } from "@/lib/db";
import { MODULE_ACCESS, ROLES, requireModule, type Role } from "@/lib/auth";
import { Badge, Card, PageHeader, Table, Td, Th, fullDate, sar } from "@/lib/ui";

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

export default async function SettingsPage() {
  const user = await requireModule("settings");
  const clubId = user.clubId!;

  const [club, users] = await Promise.all([
    db.club.findUnique({ where: { id: clubId } }),
    db.user.findMany({ where: { clubId }, orderBy: { createdAt: "asc" } }),
  ]);
  if (!club) return null;

  return (
    <>
      <PageHeader title="الإعدادات" subtitle="بيانات النادي، المستخدمون، والصلاحيات" />

      <div className="grid lg:grid-cols-2 gap-5 items-start">
        <Card title="بيانات النادي" className="p-5 pt-4">
          <dl className="space-y-3.5">
            {[
              ["اسم النادي", club.name],
              ["الجوال", club.phone ?? "—"],
              ["العنوان", club.address ?? "—"],
              ["الرقم الضريبي", club.vatNumber ?? "—"],
              ["السجل التجاري", club.crNumber ?? "—"],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4 text-sm">
                <dt className="text-slate-500">{label}</dt>
                <dd className="font-medium text-left" dir={label.includes("رقم") || label === "الجوال" ? "ltr" : undefined}>
                  {value}
                </dd>
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
        </Card>
      </div>

      <Card
        title="مستخدمو النادي"
        className="mt-5"
        action={<span className="text-xs text-slate-400 flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />{users.length} مستخدم</span>}
      >
        <Table
          head={
            <>
              <Th>الاسم</Th>
              <Th>البريد الإلكتروني</Th>
              <Th>الدور</Th>
              <Th>آخر دخول</Th>
              <Th>الحالة</Th>
            </>
          }
        >
          {users.map((u) => (
            <tr key={u.id} className="hover:bg-slate-50/60 transition">
              <Td className="font-bold">{u.name}</Td>
              <Td className="text-slate-500" dir="ltr">{u.email}</Td>
              <Td><Badge tone="violet">{ROLES[u.role as keyof typeof ROLES]}</Badge></Td>
              <Td className="text-slate-500 whitespace-nowrap">
                {u.lastLoginAt ? fullDate(u.lastLoginAt) : "لم يدخل بعد"}
              </Td>
              <Td>
                <Badge tone={u.active ? "emerald" : "red"}>{u.active ? "نشط" : "موقوف"}</Badge>
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
    </>
  );
}
