import { BookOpen, Plus, RefreshCw } from "lucide-react";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/auth";
import { ensureChart } from "@/lib/ledger";
import { Badge, Card, Empty, PageHeader, Table, Td, Th, fullDate, num, sar } from "@/lib/ui";
import { Dialog } from "@/components/dialog";
import { Field, Input, Select, Submit } from "@/components/form";
import { AccountingTabs } from "../tabs";
import { addManualEntry, rebuildLedger } from "../actions";

const SOURCE_LABEL: Record<string, string> = {
  invoice: "فاتورة",
  payment: "تحصيل",
  expense: "مصروف",
  credit_note: "إشعار دائن",
  payroll: "رواتب",
  manual: "قيد يدوي",
};

export default async function JournalPage({ searchParams }: PageProps<"/app/accounting/journal">) {
  const user = await requireModule("accounting");
  const clubId = user.clubId!;
  await ensureChart(clubId);

  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const perPage = 25;

  const [entries, total, accounts] = await Promise.all([
    db.journalEntry.findMany({
      where: { clubId },
      include: { lines: { include: { account: true } } },
      orderBy: { number: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    db.journalEntry.count({ where: { clubId } }),
    db.account.findMany({ where: { clubId, active: true }, orderBy: { code: "asc" } }),
  ]);

  const pages = Math.ceil(total / perPage);

  return (
    <>
      <PageHeader
        title="دفتر اليومية"
        subtitle={`${num(total)} قيد مرحّل — كل حركة مالية مسجلة بقيد مزدوج`}
        action={
          <div className="flex items-center gap-2">
            <form action={rebuildLedger}>
              <button className="h-9 px-3.5 rounded-xl border border-slate-200 text-sm text-slate-600 flex items-center gap-1.5 hover:bg-slate-50 transition">
                <RefreshCw className="w-4 h-4" />
                إعادة ترحيل
              </button>
            </form>
            <Dialog label="قيد يدوي" title="إضافة قيد يدوي" icon={<Plus className="w-4 h-4" />}>
              <form action={addManualEntry} className="space-y-3">
                <Field label="البيان">
                  <Input name="memo" required placeholder="تسوية، إيداع رأس مال، …" />
                </Field>
                <Field label="الحساب المدين">
                  <Select name="debitCode" required>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.code}>
                        {a.code} — {a.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="الحساب الدائن">
                  <Select name="creditCode" required defaultValue="1010">
                    {accounts.map((a) => (
                      <option key={a.id} value={a.code}>
                        {a.code} — {a.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="المبلغ">
                  <Input name="amount" type="number" min="0.01" step="0.01" required />
                </Field>
                <Submit>ترحيل القيد</Submit>
              </form>
            </Dialog>
          </div>
        }
      />

      <AccountingTabs active="/app/accounting/journal" />

      {entries.length === 0 ? (
        <Card>
          <Empty text="لا توجد قيود — اضغط «إعادة ترحيل» لبناء الدفاتر من الفواتير والمصروفات الموجودة" />
        </Card>
      ) : (
        <div className="space-y-3">
          {entries.map((e) => {
            const totalDebit = e.lines.reduce((s, l) => s + l.debitSAR, 0);
            return (
              <Card key={e.id} className="overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-3 bg-slate-50/70 border-b border-slate-100">
                  <BookOpen className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="font-bold text-sm tabular-nums">قيد #{num(e.number)}</span>
                  <Badge tone="slate">{SOURCE_LABEL[e.source] ?? e.source}</Badge>
                  <span className="text-sm text-slate-600 flex-1 truncate">{e.memo}</span>
                  <span className="text-xs text-slate-400 whitespace-nowrap">{fullDate(e.date)}</span>
                  <span className="text-sm font-bold tabular-nums whitespace-nowrap">{sar(totalDebit)}</span>
                </div>
                <Table
                  head={
                    <>
                      <Th>الحساب</Th>
                      <Th>البيان</Th>
                      <Th className="text-left">مدين</Th>
                      <Th className="text-left">دائن</Th>
                    </>
                  }
                >
                  {e.lines.map((l) => (
                    <tr key={l.id}>
                      <Td>
                        <span className="tabular-nums text-slate-400 text-xs ml-2">{l.account.code}</span>
                        <span className="font-medium">{l.account.name}</span>
                      </Td>
                      <Td className="text-slate-500 text-xs">{l.memo ?? "—"}</Td>
                      <Td className="text-left tabular-nums font-bold">
                        {l.debitSAR > 0 ? sar(l.debitSAR) : "—"}
                      </Td>
                      <Td className="text-left tabular-nums font-bold">
                        {l.creditSAR > 0 ? sar(l.creditSAR) : "—"}
                      </Td>
                    </tr>
                  ))}
                </Table>
              </Card>
            );
          })}

          {pages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              {page > 1 && (
                <a
                  href={`/app/accounting/journal?page=${page - 1}`}
                  className="h-9 px-4 rounded-xl border border-slate-200 text-sm flex items-center hover:bg-slate-50"
                >
                  السابق
                </a>
              )}
              <span className="text-sm text-slate-500 tabular-nums px-2">
                {num(page)} من {num(pages)}
              </span>
              {page < pages && (
                <a
                  href={`/app/accounting/journal?page=${page + 1}`}
                  className="h-9 px-4 rounded-xl border border-slate-200 text-sm flex items-center hover:bg-slate-50"
                >
                  التالي
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
