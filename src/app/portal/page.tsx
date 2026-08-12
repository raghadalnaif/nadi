import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// البوابة العامة لم تعد تعرض شيئاً — كل نادٍ له بوابته الفرعية.
// نوجّه المشترك لبوابة ناديه، ومن لا جلسة له للصفحة الرئيسية.
export default async function PortalRedirect() {
  const user = await getCurrentUser();
  if (!user?.memberId) redirect("/");

  const member = await db.member.findUnique({
    where: { id: user.memberId },
    select: { club: { select: { slug: true } } },
  });

  redirect(member ? `/c/${member.club.slug}` : "/");
}
