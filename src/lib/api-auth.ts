import { createHash, randomBytes } from "crypto";
import { db } from "./db";

// المفتاح يُعرض مرة واحدة عند الإنشاء، ونخزّن هاشه فقط
export function generateApiKey() {
  const raw = "nadi_" + randomBytes(24).toString("base64url");
  return { raw, prefix: raw.slice(0, 13), keyHash: hashKey(raw) };
}

export function hashKey(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

export type ApiContext = {
  clubId: string;
  clubName: string;
  scopes: string[];
  keyId: string;
};

// يتحقق من ترويسة Authorization ويرجع سياق النادي
export async function authenticateRequest(req: Request): Promise<ApiContext | null> {
  const header = req.headers.get("authorization") ?? "";
  const raw = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!raw) return null;

  const key = await db.apiKey.findUnique({
    where: { keyHash: hashKey(raw) },
    include: { club: true },
  });
  if (!key || !key.active) return null;

  // النادي الموقوف لا تعمل مفاتيحه
  if (key.club.platformStatus === "suspended") return null;

  await db.apiKey.update({
    where: { id: key.id },
    data: { lastUsedAt: new Date(), callCount: { increment: 1 } },
  });

  return {
    clubId: key.clubId,
    clubName: key.club.name,
    scopes: key.scopes.split(",").map((s) => s.trim()),
    keyId: key.id,
  };
}

export function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export function apiError(message: string, status = 400, code?: string) {
  return Response.json({ error: { message, code: code ?? String(status) } }, { status });
}

// غلاف موحّد: يتحقق من المفتاح والصلاحية ثم ينفّذ المعالج
export async function withApi(
  req: Request,
  scope: "read" | "write" | "checkin",
  handler: (ctx: ApiContext) => Promise<Response>
) {
  const ctx = await authenticateRequest(req);
  if (!ctx) return apiError("مفتاح API غير صالح أو موقوف", 401, "unauthorized");
  if (!ctx.scopes.includes(scope)) {
    return apiError(`هذا المفتاح لا يملك صلاحية ${scope}`, 403, "forbidden");
  }

  try {
    return await handler(ctx);
  } catch (e) {
    console.error("[api]", e);
    return apiError("خطأ غير متوقع في الخادم", 500, "server_error");
  }
}
