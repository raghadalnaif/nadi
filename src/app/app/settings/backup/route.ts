import { requireModule } from "@/lib/auth";
import { buildSnapshot } from "@/lib/backup";

// تنزيل نسخة احتياطية كاملة بصيغة JSON
export async function GET() {
  const user = await requireModule("settings");
  const snapshot = await buildSnapshot(user.clubId!);

  return new Response(JSON.stringify(snapshot, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="backup-${snapshot.club?.slug}-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
