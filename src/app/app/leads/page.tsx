import { CalendarClock, MessageCircle, Pencil, Plus, Trash2, UserCheck, UserSearch, Users } from "lucide-react";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/auth";
import { Badge, Card, Empty, PageHeader, StatCard, Table, Td, Th, fullDate, num } from "@/lib/ui";
import { ConfirmButton, Dialog } from "@/components/dialog";
import { Field, Input, Select, Submit } from "@/components/form";
import { deleteLead, messageLead, saveLead, setLeadStatus } from "./actions";

const STATUS: Record<string, { label: string; tone: "slate" | "sky" | "amber" | "emerald" | "red" }> = {
  new: { label: "جديد", tone: "sky" },
  contacted: { label: "تم التواصل", tone: "amber" },
  trial: { label: "جرّب النادي", tone: "violet" as never },
  converted: { label: "اشترك ✓", tone: "emerald" },
  lost: { label: "لم يشترك", tone: "red" },
};

const SOURCES = ["زيارة", "اتصال", "إنستقرام", "توصية", "أخرى"];
const iso = (d?: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export default async function LeadsPage({ searchParams }: PageProps<"/app/leads">) {
  const user = await requireModule("leads");
  const clubId = user.clubId!;
  const params = await searchParams;
  const filter = typeof params.status === "string" ? params.status : "open";

  const now = new Date();
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const [leads, counts, dueToday] = await Promise.all([
    db.lead.findMany({
      where: {
        clubId,
        ...(filter === "open"
          ? { status: { in: ["new", "contacted", "trial"] } }
          : filter === "all"
            ? {}
            : { status: filter }),
      },
      orderBy: [{ followUpAt: "asc" }, { createdAt: "desc" }],
      take: 60,
    }),
    Promise.all([
      db.lead.count({ where: { clubId, status: { in: ["new", "contacted", "trial"] } } }),
      db.lead.count({ where: { clubId, status: "converted" } }),
      db.lead.count({ where: { clubId } }),
    ]),
    db.lead.count({
      where: { clubId, followUpAt: { lte: todayEnd }, status: { in: ["new", "contacted", "trial"] } },
    }),
  ]);

  const [openCount, convertedCount, totalCount] = counts;
  const conversionRate = totalCount > 0 ? Math.round((convertedCount / totalCount) * 100) : 0;

  const leadForm = (lead?: (typeof leads)[number]) => (
    <form action={saveLead} className="space-y-3">
      {lead && <input type="hidden" name="leadId" value={lead.id} />}
      <Field label="الاسم">
        <Input name="name" defaultValue={lead?.name} required placeholder="محمد العتيبي" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="الجوال">
          <Input name="phone" defaultValue={lead?.phone} dir="ltr" className="text-right" required placeholder="05xxxxxxxx" />
        </Field>
        <Field label="المصدر">
          <Select name="source" defaultValue={lead?.source ?? "زيارة"}>
            {SOURCES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="موعد المتابعة">
          <Input name="followUpAt" type="date" defaultValue={iso(lead?.followUpAt)} />
        </Field>
        {lead && (
          <Field label="الحالة">
            <Select name="status" defaultValue={lead.status}>
              {Object.entries(STATUS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </Select>
          </Field>
        )}
      </div>
      <Field label="ملاحظات">
        <Input name="note" defaultValue={lead?.note ?? ""} placeholder="مهتم بالباقة السنوية، يسأل عن الحصص…" />
      </Field>
      <Submit>{lead ? "حفظ" : "تسجيل العميل"}</Submit>
    </form>
  );

  return (
    <>
      <PageHeader
        title="العملاء المحتملون"
        subtitle="سجّل كل زائر وتابعه حتى يشترك"
        action={
          <Dialog label="عميل محتمل" title="تسجيل عميل محتمل" icon={<Plus className="w-4 h-4" />}>
            {leadForm()}
          </Dialog>
        }
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard label="قيد المتابعة" value={num(openCount)} icon={<UserSearch className="w-5 h-5" />} tone="sky" />
        <StatCard label="متابعات اليوم" value={num(dueToday)} hint="مستحقة الآن" icon={<CalendarClock className="w-5 h-5" />} tone={dueToday > 0 ? "amber" : "slate"} />
        <StatCard label="تحوّلوا لأعضاء" value={num(convertedCount)} icon={<UserCheck className="w-5 h-5" />} tone="emerald" />
        <StatCard label="نسبة التحويل" value={`${conversionRate}%`} hint={`من ${num(totalCount)} عميل`} icon={<Users className="w-5 h-5" />} tone="violet" />
      </div>

      <div className="flex gap-2 flex-wrap mb-4">
        {[
          { k: "open", l: "قيد المتابعة" },
          { k: "new", l: "جديد" },
          { k: "converted", l: "اشتركوا" },
          { k: "lost", l: "لم يشتركوا" },
          { k: "all", l: "الكل" },
        ].map((f) => (
          <a
            key={f.k}
            href={`/app/leads?status=${f.k}`}
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

      <Card>
        {leads.length === 0 ? (
          <Empty text="لا يوجد عملاء محتملون — سجّل كل زائر يسأل عن الاشتراك" />
        ) : (
          <Table
            head={
              <>
                <Th>العميل</Th>
                <Th>المصدر</Th>
                <Th>المتابعة</Th>
                <Th>ملاحظات</Th>
                <Th>الحالة</Th>
                <Th>إجراء</Th>
              </>
            }
          >
            {leads.map((l) => {
              const st = STATUS[l.status] ?? STATUS.new;
              const overdue = l.followUpAt && l.followUpAt <= now && ["new", "contacted", "trial"].includes(l.status);

              return (
                <tr key={l.id} className={`transition ${overdue ? "bg-amber-50/40" : "hover:bg-slate-50/60"}`}>
                  <Td>
                    <p className="font-bold">{l.name}</p>
                    <p className="text-xs text-slate-400 tabular-nums" dir="ltr">{l.phone}</p>
                  </Td>
                  <Td><Badge tone="slate">{l.source}</Badge></Td>
                  <Td className="text-xs whitespace-nowrap">
                    {l.followUpAt ? (
                      <span className={overdue ? "text-amber-700 font-bold" : "text-slate-500"}>
                        {fullDate(l.followUpAt)}
                        {overdue && " (مستحقة)"}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </Td>
                  <Td className="text-slate-500 text-xs max-w-48 truncate">{l.note ?? "—"}</Td>
                  <Td><Badge tone={st.tone}>{st.label}</Badge></Td>
                  <Td>
                    <div className="flex items-center gap-1">
                      <Dialog
                        label="رسالة"
                        title={`رسالة إلى ${l.name}`}
                        variant="icon"
                        icon={<MessageCircle className="w-4 h-4" />}
                      >
                        <form action={messageLead} className="space-y-3">
                          <input type="hidden" name="leadId" value={l.id} />
                          <Field label="نص الرسالة">
                            <textarea
                              name="body"
                              required
                              rows={5}
                              defaultValue={`مرحباً ${l.name} 👋\nشكراً لزيارتك. تحب نرسل لك تفاصيل الباقات والعروض الحالية؟`}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10"
                            />
                          </Field>
                          <Submit>تجهيز الرسالة</Submit>
                        </form>
                      </Dialog>

                      {l.status !== "converted" && (
                        <form action={setLeadStatus}>
                          <input type="hidden" name="leadId" value={l.id} />
                          <input type="hidden" name="status" value="converted" />
                          <button
                            title="تحوّل لعضو"
                            className="w-9 h-9 rounded-lg grid place-items-center text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 transition"
                          >
                            <UserCheck className="w-4 h-4" />
                          </button>
                        </form>
                      )}

                      <Dialog label="تعديل" title={`تعديل ${l.name}`} variant="icon" icon={<Pencil className="w-4 h-4" />}>
                        {leadForm(l)}
                      </Dialog>

                      <form action={deleteLead}>
                        <input type="hidden" name="leadId" value={l.id} />
                        <ConfirmButton label="حذف" message={`حذف ${l.name}؟`} icon={<Trash2 className="w-4 h-4" />} />
                      </form>
                    </div>
                  </Td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>

      <div className="mt-5 rounded-2xl bg-sky-50 ring-1 ring-sky-100 px-5 py-4 text-sm text-sky-800 leading-relaxed">
        <b>سير العمل:</b> يسجّل الاستقبال كل زائر يسأل عن الاشتراك، يحدّد موعد متابعة، ويرسل له
        رسالة واتساب. الصفوف المظللة بالأصفر متابعات مستحقة اليوم أو متأخرة.
      </div>
    </>
  );
}
