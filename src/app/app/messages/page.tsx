import { BellRing, CheckCircle2, MessageCircle, Megaphone, Pencil, Send, Trash2, Zap } from "lucide-react";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/auth";
import { TEMPLATE_KEYS, ensureTemplates, waLink } from "@/lib/whatsapp";
import { Badge, Card, Empty, PageHeader, StatCard, Table, Td, Th, fullDate, num } from "@/lib/ui";
import { ConfirmButton, Dialog } from "@/components/dialog";
import { Field, Input, Select, Submit } from "@/components/form";
import { broadcast, deleteMessage, markSent, runReminders, saveTemplate, sendManual, sendNow } from "./actions";

const KIND_LABEL: Record<string, string> = {
  welcome: "ترحيب",
  receipt: "إيصال",
  expiry: "تذكير انتهاء",
  winback: "استرجاع",
  post_sale: "متابعة",
  manual: "يدوية",
};

export default async function MessagesPage({ searchParams }: PageProps<"/app/messages">) {
  const user = await requireModule("messages");
  const clubId = user.clubId!;
  await ensureTemplates(clubId);

  const params = await searchParams;
  const filter = typeof params.filter === "string" ? params.filter : "pending";

  const [club, messages, templates, members, counts] = await Promise.all([
    db.club.findUnique({ where: { id: clubId } }),
    db.message.findMany({
      where: { clubId, ...(filter === "all" ? {} : { status: filter }) },
      include: { member: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.messageTemplate.findMany({ where: { clubId }, orderBy: { key: "asc" } }),
    db.member.findMany({ where: { clubId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    Promise.all([
      db.message.count({ where: { clubId, status: "pending" } }),
      db.message.count({ where: { clubId, status: "sent" } }),
      db.message.count({ where: { clubId, status: "failed" } }),
    ]),
  ]);

  const [pending, sent, failed] = counts;
  const isLinkMode = club?.waProvider !== "cloud_api";

  return (
    <>
      <PageHeader
        title="رسائل واتساب"
        subtitle={
          isLinkMode
            ? "وضع الرابط اليدوي — اضغط «إرسال» فيفتح واتساب برسالة جاهزة"
            : "الإرسال التلقائي مفعّل عبر WhatsApp Business API"
        }
        action={
          <div className="flex items-center gap-2">
            <form action={runReminders}>
              <button className="h-9 px-3.5 rounded-xl border border-slate-200 text-sm text-slate-600 flex items-center gap-1.5 hover:bg-slate-50 transition whitespace-nowrap">
                <BellRing className="w-4 h-4" />
                فحص التنبيهات
              </button>
            </form>

            <Dialog label="رسالة جماعية" title="رسالة لشريحة" variant="ghost" icon={<Megaphone className="w-4 h-4" />}>
              <form action={broadcast} className="space-y-3">
                <Field label="الشريحة">
                  <Select name="segment" defaultValue="expiring">
                    <option value="expiring">تنتهي اشتراكاتهم هذا الأسبوع</option>
                    <option value="expired">منتهية اشتراكاتهم</option>
                    <option value="active">الأعضاء النشطون</option>
                    <option value="all">كل الأعضاء</option>
                  </Select>
                </Field>
                <Field label="نص الرسالة">
                  <textarea
                    name="body"
                    required
                    rows={5}
                    defaultValue="مرحباً {الاسم} 👋"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10"
                  />
                </Field>
                <p className="text-xs text-slate-400">{"استخدم {الاسم} ليُستبدل باسم كل عضو"}</p>
                <Submit>تجهيز الرسائل</Submit>
              </form>
            </Dialog>

            <Dialog label="رسالة جديدة" title="إرسال رسالة" icon={<Send className="w-4 h-4" />}>
              <form action={sendManual} className="space-y-3">
                <Field label="العضو">
                  <Select name="memberId" defaultValue="">
                    <option value="">— رقم مباشر —</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </Select>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="الاسم (للرقم المباشر)">
                    <Input name="toName" placeholder="اسم المستلم" />
                  </Field>
                  <Field label="الجوال">
                    <Input name="phone" dir="ltr" className="text-right" placeholder="05xxxxxxxx" />
                  </Field>
                </div>
                <Field label="نص الرسالة">
                  <textarea
                    name="body"
                    required
                    rows={5}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10"
                  />
                </Field>
                <Submit>تجهيز الرسالة</Submit>
              </form>
            </Dialog>
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="بانتظار الإرسال" value={num(pending)} icon={<MessageCircle className="w-5 h-5" />} tone={pending > 0 ? "amber" : "slate"} />
        <StatCard label="مُرسَلة" value={num(sent)} icon={<CheckCircle2 className="w-5 h-5" />} tone="emerald" />
        <StatCard label="فشلت" value={num(failed)} icon={<Zap className="w-5 h-5" />} tone={failed > 0 ? "red" : "slate"} />
      </div>

      <div className="flex gap-2 flex-wrap mb-4">
        {[
          { k: "pending", l: "بانتظار الإرسال" },
          { k: "sent", l: "مُرسَلة" },
          { k: "failed", l: "فشلت" },
          { k: "all", l: "الكل" },
        ].map((f) => (
          <a
            key={f.k}
            href={`/app/messages?filter=${f.k}`}
            className={`px-3.5 h-9 rounded-xl text-sm flex items-center border transition ${
              filter === f.k
                ? "bg-emerald-600 text-white border-emerald-600 font-bold"
                : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300"
            }`}
          >
            {f.l}
          </a>
        ))}
      </div>

      <Card title="صندوق الرسائل">
        {messages.length === 0 ? (
          <Empty text="لا توجد رسائل — اضغط «فحص التنبيهات» لتجهيز رسائل التذكير تلقائياً" />
        ) : (
          <ul className="divide-y divide-slate-50">
            {messages.map((m) => (
              <li key={m.id} className="px-5 py-4 hover:bg-slate-50/60 transition">
                <div className="flex items-start gap-3">
                  <span
                    className={`w-9 h-9 rounded-full grid place-items-center shrink-0 ${
                      m.status === "sent"
                        ? "bg-emerald-50 text-emerald-600"
                        : m.status === "failed"
                          ? "bg-red-50 text-red-600"
                          : "bg-amber-50 text-amber-600"
                    }`}
                  >
                    <MessageCircle className="w-4 h-4" />
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm">{m.member?.name ?? m.toName}</span>
                      <span className="text-xs text-slate-400 tabular-nums" dir="ltr">{m.phone}</span>
                      <Badge tone="slate">{KIND_LABEL[m.kind] ?? m.kind}</Badge>
                      {m.status === "sent" && <Badge tone="emerald">مُرسَلة</Badge>}
                      {m.status === "failed" && <Badge tone="red">فشلت</Badge>}
                    </div>
                    <p className="text-sm text-slate-600 mt-1.5 whitespace-pre-line line-clamp-3">{m.body}</p>
                    <p className="text-[11px] text-slate-400 mt-1.5">
                      {fullDate(m.createdAt)}
                      {m.sentBy && ` · أرسلها ${m.sentBy}`}
                      {m.error && <span className="text-red-500"> · {m.error.slice(0, 80)}</span>}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {m.status !== "sent" &&
                      (isLinkMode ? (
                        <form action={markSent}>
                          <input type="hidden" name="messageId" value={m.id} />
                          <a
                            href={waLink(m.phone, m.body)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="h-9 px-3.5 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 hover:bg-emerald-700 transition whitespace-nowrap"
                          >
                            <Send className="w-3.5 h-3.5" />
                            فتح واتساب
                          </a>
                          <button className="mt-1.5 w-full h-7 rounded-lg border border-slate-200 text-[11px] text-slate-500 hover:bg-slate-50 transition">
                            تمّ الإرسال
                          </button>
                        </form>
                      ) : (
                        <form action={sendNow}>
                          <input type="hidden" name="messageId" value={m.id} />
                          <button className="h-9 px-3.5 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 hover:bg-emerald-700 transition whitespace-nowrap">
                            <Send className="w-3.5 h-3.5" />
                            إرسال
                          </button>
                        </form>
                      ))}

                    <form action={deleteMessage}>
                      <input type="hidden" name="messageId" value={m.id} />
                      <ConfirmButton label="حذف" message="حذف الرسالة؟" icon={<Trash2 className="w-4 h-4" />} />
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="القوالب التلقائية" className="mt-5">
        <Table
          head={
            <>
              <Th>القالب</Th>
              <Th>متى تُرسل</Th>
              <Th>الحالة</Th>
              <Th>تعديل</Th>
            </>
          }
        >
          {templates.map((t) => (
            <tr key={t.id} className="hover:bg-slate-50/60 transition">
              <Td className="font-bold">{t.name}</Td>
              <Td className="text-slate-500 text-xs">
                {t.key === "welcome"
                  ? "عند تسجيل عضو جديد"
                  : t.key === "receipt"
                    ? "بعد كل عملية بيع"
                    : t.key === "expiry"
                      ? `قبل ${num(club?.waExpiryDays ?? 3)} أيام من الانتهاء`
                      : t.key === "winback"
                        ? "بعد 7 أيام من الانقطاع"
                        : "بعد أسبوع من التسجيل"}
              </Td>
              <Td>
                <Badge tone={t.active ? "emerald" : "slate"}>{t.active ? "مفعّل" : "موقوف"}</Badge>
              </Td>
              <Td>
                <Dialog label="تعديل" title={`تعديل ${t.name}`} variant="icon" icon={<Pencil className="w-4 h-4" />}>
                  <form action={saveTemplate} className="space-y-3">
                    <input type="hidden" name="templateId" value={t.id} />
                    <Field label="نص الرسالة">
                      <textarea
                        name="body"
                        required
                        rows={8}
                        defaultValue={t.body}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10"
                      />
                    </Field>
                    <div className="rounded-xl bg-sky-50 ring-1 ring-sky-100 px-4 py-3 text-xs text-sky-800 leading-relaxed">
                      <b>المتغيرات المتاحة:</b> {"{الاسم} {النادي} {الباقة} {تاريخ_الانتهاء} {رقم_العضوية} {الأيام_المتبقية} {أيام_الانقطاع} {المبلغ} {رقم_الفاتورة}"}
                    </div>
                    <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 cursor-pointer">
                      <input type="checkbox" name="active" defaultChecked={t.active} className="w-4 h-4 accent-emerald-600" />
                      <span className="text-sm font-bold text-slate-800">مفعّل</span>
                    </label>
                    <Submit>حفظ القالب</Submit>
                  </form>
                </Dialog>
              </Td>
            </tr>
          ))}
        </Table>
        {templates.length === 0 && <Empty text="لا قوالب" />}
      </Card>

      {isLinkMode && (
        <div className="mt-5 rounded-2xl bg-sky-50 ring-1 ring-sky-100 px-5 py-4 text-sm text-sky-800 leading-relaxed">
          <b>كيف يعمل الآن؟</b> النظام يجهّز نص كل رسالة تلقائياً، والموظف يضغط «فتح واتساب» فتُفتح
          المحادثة والرسالة مكتوبة — يضغط إرسال فقط. للإرسال التلقائي الكامل بلا تدخل، فعّل
          WhatsApp Business API من الإعدادات (يتطلب حساب أعمال معتمداً من Meta).
        </div>
      )}
    </>
  );
}
