import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { db } from "./db";

const SECRET = process.env.AUTH_SECRET ?? "nadi-dev-secret-change-in-production";
const COOKIE = "nadi_session";

// ───────── كلمات المرور ─────────

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

// ───────── الجلسة (كوكي موقّع) ─────────

function sign(value: string) {
  return createHmac("sha256", SECRET).update(value).digest("hex");
}

export async function createSession(userId: string) {
  const value = `${userId}.${Date.now()}`;
  const store = await cookies();
  store.set(COOKIE, `${value}.${sign(value)}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export async function getCurrentUser() {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;

  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const [userId, issued, signature] = parts;
  if (sign(`${userId}.${issued}`) !== signature) return null;

  const user = await db.user.findUnique({ where: { id: userId }, include: { club: true } });
  if (!user || !user.active) return null;
  return user;
}

// ───────── الأدوار والصلاحيات ─────────

export const ROLES = {
  super_admin: "مزود الحل",
  owner: "مالك النادي",
  manager: "مدير",
  accountant: "محاسب",
  hr: "موارد بشرية",
  reception: "استقبال",
} as const;

export type Role = keyof typeof ROLES;

// أي قسم يشوفه أي دور — مصدر الحقيقة الوحيد للصلاحيات
export const MODULE_ACCESS: Record<string, Role[]> = {
  dashboard: ["owner", "manager"],
  reception: ["owner", "manager", "reception"],
  subscriptions: ["owner", "manager", "reception", "accountant"],
  schedule: ["owner", "manager", "reception"],
  pos: ["owner", "manager", "reception"],
  leads: ["owner", "manager", "reception"],
  messages: ["owner", "manager", "reception"],
  offers: ["owner", "manager", "accountant"],
  invoices: ["owner", "accountant", "manager", "reception"],
  accounting: ["owner", "accountant"],
  reports: ["owner", "manager", "accountant"],
  hr: ["owner", "hr", "manager"],
  settings: ["owner"],
};

export function canAccess(role: string, moduleName: string) {
  return MODULE_ACCESS[moduleName]?.includes(role as Role) ?? false;
}

// الصفحة الأولى المناسبة لكل دور بعد تسجيل الدخول
export function homeFor(role: string) {
  if (role === "super_admin") return "/platform";
  if (role === "accountant") return "/app/accounting";
  if (role === "hr") return "/app/hr";
  if (role === "reception") return "/app/reception";
  return "/app/dashboard";
}

// ───────── الحراسة ─────────

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireModule(moduleName: string) {
  const user = await requireUser();
  if (user.role === "super_admin") redirect("/platform");
  if (!user.clubId) redirect("/login");
  if (!canAccess(user.role, moduleName)) redirect(homeFor(user.role));
  return user;
}

export async function requireSuperAdmin() {
  const user = await requireUser();
  if (user.role !== "super_admin") redirect(homeFor(user.role));
  return user;
}
