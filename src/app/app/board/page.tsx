import { CheckCheck, Eye, FileText, Megaphone, Pin, Plus, ScrollText, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/auth";
import { Badge, Card, Empty, PageHeader, Table, Td, Th, fullDate, num } from "@/lib/ui";
import { ConfirmButton, Dialog } from "@/components/dialog";
import { Field, Input, Select, Submit } from "@/components/form";
import { deleteAnnouncement, markRead, postAnnouncement } from "./actions";

const KIND: Record<string, { label: string; tone: "sky" | "violet" | "amber"; icon: typeof Megaphone }> = {
  announcement: { label: "إعلان", tone: "sky", icon: Megaphone },
  letter: { label: "خطاب", tone: "violet", icon: ScrollText },
  policy: { label: "لائحة", tone: "amber", icon: FileText },
};

const AUDIENCE: Record<string, string> = {
  all: "الجميع",
  managers: "المدراء فقط",
  department: "قسم محدد",
};

export default async function BoardPage() {
  const user = await requireModule("board");
  const clubId = user.clubId!;
  const canPost = ["owner", "branch_manager", "manager", "hr"].includes(user.role);

  const [announcements, staffCount] = await Promise.all([
    db.announcement.findMany({
      where: { clubId },
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      take: 30,
      include: { reads: { select: { userId: true, userName: true, readAt: true } } },
    }),
    db.user.count({ where: { clubId, active: true, role: { notIn: ["member"] } } }),
  ]);

  return (
    <>
      <PageHeader
        title="الإعلانات والخطابات"
        subtitle="تواصل مباشر بين الإدارة والموظفين — كل خطاب يُسجَّل من اطّلع عليه"
        action={
          canPost && (
            <Dialog label="نشر جديد" title="نشر إعلان أو خطاب" icon={<Plus className="w-4 h-4" />}>
              <form action={postAnnouncement} className="space-y-3">
                <Field label="العنوان">
                  <Input name="title" required placeholder="تعديل مواعيد الدوام في رمضان" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="النوع">
                    <Select name="kind" defaultValue="announcement">
                      <option value="announcement">إعلان</option>
                      <option value="letter">خطاب رسمي</option>
                      <option value="policy">لائحة أو سياسة</option>
                    </Select>
                  </Field>
                  <Field label="الموجّه إلى">
                    <Select name="audience" defaultValue="all">
                      <option value="all">الجميع</option>
                      <option value="managers">المدراء فقط</option>
                      <option value="department">قسم محدد</option>
                    </Select>
                  </Field>
                </div>
                <Field label="القسم (إن اخترت قسماً محدداً)">
                  <Input name="department" placeholder="تدريب، استقبال، محاسبة…" />
                </Field>
                <Field label="النص">
                  <textarea
                    name="body"
                    required
                    rows={7}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10"
                  />
                </Field>
                <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 cursor-pointer">
                  <input type="checkbox" name="pinned" className="w-4 h-4 accent-emerald-600" />
                  <span className="text-sm font-bold text-slate-800">تثبيت في الأعلى</span>
                </label>
                <Submit>نشر</Submit>
              </form>
            </Dialog>
          )
        }
      />

      {announcements.length === 0 ? (
        <Card>
          <Empty text="لا توجد إعلانات — انشر أول إعلان للفريق" />
        </Card>
      ) : (
        <div className="space-y-4">
          {announcements.map((a) => {
            const meta = KIND[a.kind] ?? KIND.announcement;
            const Icon = meta.icon;
            const iRead = a.reads.some((r) => r.userId === user.id);
            const readRate = staffCount > 0 ? Math.round((a.reads.length / staffCount) * 100) : 0;

            return (
              <Card key={a.id} className="p-5">
                <div className="flex items-start gap-3 mb-3">
                  <span
                    className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 ${
                      meta.tone === "sky"
                        ? "bg-sky-50 text-sky-700"
                        : meta.tone === "violet"
                          ? "bg-violet-50 text-violet-700"
                          : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-slate-900">{a.title}</h3>
                      {a.pinned && (
                        <Badge tone="amber">
                          <Pin className="w-3 h-3" />
                          مثبّت
                        </Badge>
                      )}
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                      <Badge tone="slate">{AUDIENCE[a.audience] ?? a.audience}{a.department ? `: ${a.department}` : ""}</Badge>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {a.authorName} · {fullDate(a.createdAt)}
                    </p>
                  </div>

                  {(a.authorId === user.id || user.role === "owner") && (
                    <form action={deleteAnnouncement}>
                      <input type="hidden" name="announcementId" value={a.id} />
                      <ConfirmButton label="حذف" message={`حذف «${a.title}»؟`} icon={<Trash2 className="w-4 h-4" />} />
                    </form>
                  )}
                </div>

                <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{a.body}</p>

                <div className="flex items-center gap-3 mt-4 pt-3 border-t border-slate-100">
                  <span className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5" />
                    اطّلع عليه {num(a.reads.length)} من {num(staffCount)} ({readRate}%)
                  </span>

                  {!iRead ? (
                    <form action={markRead} className="mr-auto">
                      <input type="hidden" name="announcementId" value={a.id} />
                      <button className="h-9 px-4 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 hover:bg-emerald-700 transition">
                        <CheckCheck className="w-3.5 h-3.5" />
                        تسجيل اطلاعي
                      </button>
                    </form>
                  ) : (
                    <span className="mr-auto text-xs text-emerald-700 font-bold flex items-center gap-1.5">
                      <CheckCheck className="w-3.5 h-3.5" />
                      اطّلعت عليه
                    </span>
                  )}
                </div>

                {a.reads.length > 0 && ["owner", "branch_manager", "manager", "hr"].includes(user.role) && (
                  <details className="mt-3">
                    <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700">
                      من اطّلع عليه
                    </summary>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {a.reads.map((r) => (
                        <span key={r.userId} className="text-[11px] bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
                          {r.userName}
                        </span>
                      ))}
                    </div>
                  </details>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
