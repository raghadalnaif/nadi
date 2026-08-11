import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { db } from "./db";

// في الإنتاج لا نسمح بمفتاح افتراضي — جلسات موقّعة بمفتاح معروف تعني
// أن أي شخص يستطيع انتحال أي مستخدم.
if (process.env.NODE_ENV === "production" && !process.env.AUTH_SECRET) {
  throw new Error(
    "AUTH_SECRET غير مضبوط. ولّده بالأمر: openssl rand -base64 32 وأضفه لمتغيرات البيئة."
  );
}

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

  const user = await db.user.findUnique({
    where: { id: userId },
    include: { club: true, branch: true },
  });
  if (!user || !user.active) return null;
  return user;
}

// ───────── الأدوار والصلاحيات ─────────

export const ROLES = {
  super_admin: "مزود الحل",
  owner: "مالك النادي",
  branch_manager: "مدير فرع",
  manager: "مدير",
  accountant: "محاسب",
  hr: "موارد بشرية",
  reception: "استقبال",
  employee: "موظف",
  member: "مشترك",
} as const;

export type Role = keyof typeof ROLES;

// أي قسم يشوفه أي دور — مصدر الحقيقة الوحيد للصلاحيات
export const MODULE_ACCESS: Record<string, Role[]> = {
  dashboard: ["owner", "branch_manager", "manager"],
  branches: ["owner"], // إدارة الفروع للمالك وحده
  reception: ["owner", "branch_manager", "manager", "reception"],
  pos: ["owner", "branch_manager", "manager", "reception"],
  shifts: ["owner", "branch_manager", "manager", "reception", "accountant"],
  subscriptions: ["owner", "branch_manager", "manager", "reception", "accountant"],
  leads: ["owner", "branch_manager", "manager", "reception"],
  messages: ["owner", "branch_manager", "manager", "reception"],
  schedule: ["owner", "branch_manager", "manager", "reception"],
  offers: ["owner", "manager", "accountant"],
  invoices: ["owner", "branch_manager", "accountant", "manager", "reception"],
  accounting: ["owner", "accountant"],
  reports: ["owner", "branch_manager", "manager", "accountant"],
  hr: ["owner", "branch_manager", "hr", "manager"],
  board: ["owner", "branch_manager", "manager", "hr", "accountant", "reception"],
  settings: ["owner"],
};

export function canAccess(role: string, moduleName: string) {
  return MODULE_ACCESS[moduleName]?.includes(role as Role) ?? false;
}

// الصفحة الأولى المناسبة لكل دور بعد تسجيل الدخول
export function homeFor(role: string) {
  if (role === "super_admin") return "/platform";
  if (role === "member") return "/portal";
  if (role === "employee") return "/me";
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
  if (user.role === "member") redirect("/portal");
  if (user.role === "employee") redirect("/me");
  if (!user.clubId) redirect("/login");
  if (!canAccess(user.role, moduleName)) redirect(homeFor(user.role));
  return user;
}

export async function requireSuperAdmin() {
  const user = await requireUser();
  if (user.role !== "super_admin") redirect(homeFor(user.role));
  return user;
}

// بوابة المشترك
export async function requireMember() {
  const user = await requireUser();
  if (user.role !== "member" || !user.memberId) redirect(homeFor(user.role));
  return user;
}

// بوابة الموظف
export async function requireEmployee() {
  const user = await requireUser();
  if (!user.employeeId) redirect(homeFor(user.role));
  return user;
}

// ───────── نطاق الفرع ─────────
// مدير الفرع يرى فرعه فقط؛ المالك يرى كل الفروع أو يفلتر باختياره.
export function branchScope(
  user: { role: string; branchId: string | null },
  selected?: string | null
) {
  if (user.role === "branch_manager" && user.branchId) return user.branchId;
  return selected && selected !== "all" ? selected : null;
}

// شرط Prisma للفلترة حسب الفرع
export function branchWhere(branchId: string | null) {
  return branchId ? { branchId } : {};
}
