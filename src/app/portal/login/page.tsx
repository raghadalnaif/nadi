import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ClubPicker } from "./club-picker";

// لا يوجد دخول مشترك عام — يختار ناديه ثم يدخل من بوابته الفرعية
export default async function PortalLoginPage() {
  const user = await getCurrentUser();
  if (user?.memberId) {
    const member = await db.member.findUnique({
      where: { id: user.memberId },
      select: { club: { select: { slug: true } } },
    });
    if (member) redirect(`/c/${member.club.slug}`);
  }

  const clubs = await db.club.findMany({
    where: { platformStatus: { not: "suspended" } },
    select: { name: true, slug: true, address: true },
    orderBy: { name: "asc" },
  });

  return <ClubPicker clubs={clubs} />;
}
