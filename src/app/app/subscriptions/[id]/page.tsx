import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  CalendarCheck,
  MessageCircle,
  KeyRound,
  Pencil,
  RefreshCw,
  Trash2,
  Wallet,
  XCircle,
} from "lucide-react";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/auth";
import {
  Badge,
  Card,
  Empty,
  PageHeader,
  StatCard,
  Table,
  Td,
  Th,
  fullDate,
  num,
  sar,
  sourceLabel,
  time,
} from "@/lib/ui";
import { membershipStatus } from "@/lib/membership";
import { ConfirmButton, Dialog } from "@/components/dialog";
import { Field, Input, Select, Submit } from "@/components/form";
import { renew } from "../../actions";
import { cancelSubscription, deleteMember, updateMember } from "../../manage-actions";
import { createMemberAccount } from "@/app/portal/actions";

export default async function MemberPage({ params }: PageProps<"/app/subscriptions/[id]">) {
  const user = await requireModule("subscriptions");
  const { id } = await params;

  const member = await db.member.findFirst({
    where: { id, clubId: user.clubId! },
    include: {
      subscriptions: { include: { plan: true }, orderBy: { endsAt: "desc" } },
      attendance: { orderBy: { checkedAt: "desc" }, take: 10 },
      invoices: { orderBy: { issuedAt: "desc" }, take: 8 },
      bookings: {
        where: { status: { in: ["booked", "waitlist"] } },
        include: { session: { include: { gymClass: true } } },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
      _count: { select: { attendance: true, bookings: true } },
    },
  });
  if (!member) notFound();

  const current = member.subscriptions[0];
  const st = membershipStatus(current);
  const totalPaid = member.invoices
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + i.totalSAR, 0);

  const wa = `https://wa.me/966${member.phone.replace(/^0/, "")}?text=${encodeURIComponent(
    `مرحباً ${member.name}، `
  )}`;

  return (
    <>
      <Link
        href="/app/subscriptions"
        className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-emerald-700 transition mb-5"
      >
        <ArrowRight className="w-4 h-4" />
        رجوع للاشتراكات
      </Link>

      <PageHeader
        title={member.name}
        subtitle={`عضوية رقم ${num(member.memberNo)} · انضم في ${fullDate(member.createdAt)}`}
        action={
          <div className="flex items-center gap-2">
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="h-9 px-3.5 rounded-xl border border-slate-200 text-sm text-slate-600 flex items-center gap-1.5 hover:bg-slate-50 transition"
            >
              <MessageCircle className="w-4 h-4 text-emerald-600" />
              واتساب
            </a>

            <form action={renew}>
              <input type="hidden" name="memberId" value={member.id} />
              <button className="h-9 px-3.5 rounded-xl bg-emerald-600 text-white text-sm font-bold flex items-center gap-1.5 hover:bg-emerald-700 transition">
                <RefreshCw className="w-4 h-4" />
                تجديد
              </button>
            </form>

            <Dialog label="حساب البوابة" title={`حساب بوابة ${member.name}`} description="يدخل المشترك برقم جواله ويرى اشتراكه ويحجز حصصه" variant="ghost" icon={<KeyRound className="w-4 h-4" />}>
              <form action={createMemberAccount} className="space-y-3">
                <input type="hidden" name="memberId" value={member.id} />
                <div className="rounded-xl bg-sky-50 ring-1 ring-sky-100 px-4 py-3 text-sm text-sky-800">
                  اسم الدخول: <b dir="ltr">{member.phone.replace(/\D/g, "")}@member.local</b>
                </div>
                <Field label="كلمة المرور">
                  <Input name="password" defaultValue="123456" dir="ltr" className="text-right" required />
                </Field>
                <Submit>إنشاء الحساب أو تصفير كلمة المرور</Submit>
              </form>
            </Dialog>

            <Dialog label="تعديل" title="تعديل بيانات العضو" variant="ghost" icon={<Pencil className="w-4 h-4" />}>
              <form action={updateMember} className="space-y-3">
                <input type="hidden" name="memberId" value={member.id} />
                <Field label="الاسم">
                  <Input name="name" defaultValue={member.name} required />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="الجوال">
                    <Input name="phone" defaultValue={member.phone} dir="ltr" className="text-right" required />
                  </Field>
                  <Field label="الجنس">
                    <Select name="gender" defaultValue={member.gender}>
                      <option value="male">ذكر</option>
                      <option value="female">أنثى</option>
                    </Select>
                  </Field>
                </div>
                <Field label="ملاحظات">
                  <Input name="notes" defaultValue={member.notes ?? ""} placeholder="إصابة سابقة، تفضيلات…" />
                </Field>
                <Submit>حفظ</Submit>
              </form>
            </Dialog>

            <form action={deleteMember}>
              <input type="hidden" name="memberId" value={member.id} />
              <ConfirmButton
                label="حذف العضو"
                message={`حذف ${member.name} نهائياً؟ ستُحذف اشتراكاته وحضوره وحجوزاته. الفواتير تبقى محفوظة كمستندات ضريبية.`}
                icon={<Trash2 className="w-4 h-4" />}
              />
            </form>
          </div>
        }
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="حالة الاشتراك"
          value={st?.label ?? "بلا اشتراك"}
          hint={st?.remaining}
          icon={<CalendarCheck className="w-5 h-5" />}
          tone={st?.tone ?? "slate"}
        />
        <StatCard label="مرات الحضور" value={num(member._count.attendance)} icon={<CalendarCheck className="w-5 h-5" />} tone="sky" />
        <StatCard label="إجمالي المدفوع" value={sar(totalPaid)} icon={<Wallet className="w-5 h-5" />} tone="emerald" />
        <StatCard label="الحجوزات" value={num(member._count.bookings)} icon={<CalendarCheck className="w-5 h-5" />} tone="violet" />
      </div>

      {member.notes && (
        <div className="mb-5 rounded-2xl bg-amber-50 ring-1 ring-amber-100 px-5 py-4 text-sm text-amber-800">
          <b>ملاحظات:</b> {member.notes}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-5 items-start">
        <Card title="سجل الاشتراكات">
          <Table
            head={
              <>
                <Th>الباقة</Th>
                <Th>من</Th>
                <Th>إلى</Th>
                <Th>الحالة</Th>
                <Th>إجراء</Th>
              </>
            }
          >
            {member.subscriptions.map((s) => {
              const sst = membershipStatus(s)!;
              return (
                <tr key={s.id} className="hover:bg-slate-50/60 transition">
                  <Td className="font-bold">
                    {s.plan.name}
                    {s.plan.kind === "sessions" && (
                      <span className="block text-xs font-normal text-violet-600">
                        {num(s.sessionsUsed)} من {num(s.sessionsTotal)} حصة
                      </span>
                    )}
                  </Td>
                  <Td className="text-slate-500 whitespace-nowrap text-xs">{fullDate(s.startsAt)}</Td>
                  <Td className="text-slate-500 whitespace-nowrap text-xs">{fullDate(s.endsAt)}</Td>
                  <Td>
                    <Badge tone={sst.tone}>{sst.label}</Badge>
                  </Td>
                  <Td>
                    {s.status !== "cancelled" && (
                      <form action={cancelSubscription}>
                        <input type="hidden" name="subId" value={s.id} />
                        <ConfirmButton
                          label="إلغاء الاشتراك"
                          message={`إلغاء اشتراك ${s.plan.name}؟`}
                          icon={<XCircle className="w-4 h-4" />}
                        />
                      </form>
                    )}
                  </Td>
                </tr>
              );
            })}
          </Table>
          {member.subscriptions.length === 0 && <Empty text="لا توجد اشتراكات" />}
        </Card>

        <Card title="الفواتير">
          <Table
            head={
              <>
                <Th>الرقم</Th>
                <Th>التاريخ</Th>
                <Th>المبلغ</Th>
                <Th>الحالة</Th>
              </>
            }
          >
            {member.invoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-slate-50/60 transition">
                <Td>
                  <Link href={`/app/invoices/${inv.id}`} className="font-bold text-emerald-700 hover:underline" dir="ltr">
                    {inv.number}
                  </Link>
                </Td>
                <Td className="text-slate-500 whitespace-nowrap text-xs">{fullDate(inv.issuedAt)}</Td>
                <Td className="font-bold tabular-nums whitespace-nowrap">{sar(inv.totalSAR)}</Td>
                <Td>
                  <Badge tone={inv.status === "paid" ? "emerald" : "amber"}>
                    {inv.status === "paid" ? "مدفوعة" : "غير مدفوعة"}
                  </Badge>
                </Td>
              </tr>
            ))}
          </Table>
          {member.invoices.length === 0 && <Empty text="لا توجد فواتير" />}
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-5 mt-5 items-start">
        <Card title="آخر مرات الحضور">
          {member.attendance.length === 0 ? (
            <Empty text="لم يحضر بعد" />
          ) : (
            <ul className="divide-y divide-slate-50">
              {member.attendance.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-5 py-3">
                  <CalendarCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="text-sm flex-1">{fullDate(a.checkedAt)}</span>
                  <span className="text-xs text-slate-400">{sourceLabel[a.source] ?? a.source}</span>
                  <span className="text-xs text-slate-400 tabular-nums">{time(a.checkedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="الحجوزات القادمة">
          {member.bookings.length === 0 ? (
            <Empty text="لا حجوزات حالية" />
          ) : (
            <ul className="divide-y divide-slate-50">
              {member.bookings.map((b) => (
                <li key={b.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold">{b.session.gymClass.name}</p>
                    <p className="text-xs text-slate-400">
                      {fullDate(b.session.startsAt)} · {time(b.session.startsAt)}
                    </p>
                  </div>
                  <Badge tone={b.status === "booked" ? "emerald" : "amber"}>
                    {b.status === "booked" ? "مؤكد" : "قائمة انتظار"}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
