"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { computePayroll, distanceMeters, shiftMetrics } from "@/lib/hr";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const numOrNull = (fd: FormData, k: string) => {
  const v = Number(fd.get(k));
  return Number.isFinite(v) && v !== 0 ? v : null;
};

export type KioskResult = {
  ok: boolean;
  action: "in" | "out" | "none";
  message: string;
  employeeName?: string;
  detail?: string;
  tone: "success" | "warn" | "error";
};

// نقطة الحضور: يمسح الموظف باركوده فيسجّل دخولاً أو خروجاً تلقائياً،
// مع التقاط الموقع الجغرافي والتحقق من النطاق المسموح.
export async function kioskPunch(
  _prev: KioskResult | null,
  formData: FormData
): Promise<KioskResult> {
  const user = await requireModule("hr");
  const code = str(formData, "code");
  if (!code) return { ok: false, action: "none", message: "امسح الباركود", tone: "error" };

  const club = await db.club.findUnique({ where: { id: user.clubId! } });
  if (!club) return { ok: false, action: "none", message: "خطأ في النادي", tone: "error" };

  const employee = await db.employee.findFirst({
    where: { clubId: club.id, OR: [{ barcode: code }, { nationalId: code }, { phone: code }] },
  });
  if (!employee) {
    return { ok: false, action: "none", message: `لا يوجد موظف بالرمز ${code}`, tone: "error" };
  }
  if (employee.status === "terminated") {
    return { ok: false, action: "none", message: `${employee.name} منتهي الخدمة`, tone: "error" };
  }

  const lat = numOrNull(formData, "lat");
  const lng = numOrNull(formData, "lng");

  // التحقق الجغرافي — فقط إذا حدّد النادي موقعه
  let meters: number | null = null;
  let outside = false;
  if (club.latitude != null && club.longitude != null && lat != null && lng != null) {
    meters = distanceMeters({ lat, lng }, { lat: club.latitude, lng: club.longitude });
    outside = meters > club.geofenceMeters;
  }

  if (club.requireGeoStaff) {
    if (lat == null || lng == null) {
      return {
        ok: false,
        action: "none",
        employeeName: employee.name,
        message: "تعذّر تحديد الموقع — فعّل صلاحية الموقع في المتصفح",
        tone: "error",
      };
    }
    if (outside) {
      return {
        ok: false,
        action: "none",
        employeeName: employee.name,
        message: `${employee.name} خارج نطاق النادي`,
        detail: `المسافة ${meters} متر — المسموح ${club.geofenceMeters} متر`,
        tone: "error",
      };
    }
  }

  const day = new Date();
  day.setHours(0, 0, 0, 0);
  const now = new Date();

  const existing = await db.staffAttendance.findUnique({
    where: { employeeId_day: { employeeId: employee.id, day } },
  });

  // لا سجل أو لم يسجّل دخولاً → دخول
  if (!existing || !existing.checkIn) {
    const m = shiftMetrics({ checkIn: now, shiftStart: employee.shiftStart, shiftEnd: employee.shiftEnd });
    const data = {
      checkIn: now,
      status: "present",
      method: "barcode",
      checkInLat: lat,
      checkInLng: lng,
      checkInMeters: meters,
      outsideGeofence: outside,
      lateMinutes: m.lateMinutes,
    };

    if (existing) {
      await db.staffAttendance.update({ where: { id: existing.id }, data });
    } else {
      await db.staffAttendance.create({ data: { employeeId: employee.id, day, ...data } });
    }

    revalidatePath("/app/hr");
    return {
      ok: true,
      action: "in",
      employeeName: employee.name,
      message: `أهلاً ${employee.name} — سُجّل دخولك`,
      detail:
        (m.lateMinutes > 0 ? `متأخر ${m.lateMinutes} دقيقة` : "في الوقت") +
        (meters != null ? ` · ${meters} متر من النادي` : ""),
      tone: m.lateMinutes > 0 ? "warn" : "success",
    };
  }

  // سجّل دخولاً ولم يسجّل خروجاً → خروج
  if (!existing.checkOut) {
    const m = shiftMetrics({
      checkIn: existing.checkIn,
      checkOut: now,
      shiftStart: employee.shiftStart,
      shiftEnd: employee.shiftEnd,
    });

    await db.staffAttendance.update({
      where: { id: existing.id },
      data: {
        checkOut: now,
        checkOutLat: lat,
        checkOutLng: lng,
        checkOutMeters: meters,
        outsideGeofence: existing.outsideGeofence || outside,
        earlyLeaveMinutes: m.earlyLeaveMinutes,
        overtimeMinutes: m.overtimeMinutes,
      },
    });

    revalidatePath("/app/hr");
    return {
      ok: true,
      action: "out",
      employeeName: employee.name,
      message: `مع السلامة ${employee.name} — سُجّل خروجك`,
      detail:
        `عمل ${m.workedHours} ساعة` +
        (m.overtimeMinutes > 0 ? ` · إضافي ${m.overtimeMinutes} دقيقة` : "") +
        (m.earlyLeaveMinutes > 0 ? ` · خروج مبكر ${m.earlyLeaveMinutes} دقيقة` : ""),
      tone: m.earlyLeaveMinutes > 0 ? "warn" : "success",
    };
  }

  return {
    ok: true,
    action: "none",
    employeeName: employee.name,
    message: `${employee.name} سجّل دخوله وخروجه اليوم`,
    tone: "warn",
  };
}

// موقع النادي ونطاق الحضور
export async function saveClubLocation(formData: FormData) {
  const user = await requireModule("settings");
  const lat = Number(formData.get("latitude"));
  const lng = Number(formData.get("longitude"));
  const radius = Math.max(20, Math.min(2000, Number(formData.get("geofenceMeters")) || 150));

  await db.club.update({
    where: { id: user.clubId! },
    data: {
      latitude: Number.isFinite(lat) && lat !== 0 ? lat : null,
      longitude: Number.isFinite(lng) && lng !== 0 ? lng : null,
      geofenceMeters: radius,
      requireGeoStaff: formData.get("requireGeoStaff") === "on",
    },
  });

  await audit({ user, action: "update", entity: "club", summary: "تحديث موقع النادي ونطاق الحضور" });
  revalidatePath("/app/settings");
}

// تعديل بيانات التوظيف الاحترافية
export async function saveEmployeeDetails(formData: FormData) {
  const user = await requireModule("hr");
  const id = str(formData, "employeeId");
  const emp = await db.employee.findFirst({ where: { id, clubId: user.clubId! } });
  if (!emp) return;

  const date = (k: string) => {
    const v = str(formData, k);
    const d = v ? new Date(v) : null;
    return d && !Number.isNaN(d.getTime()) ? d : null;
  };

  await db.employee.update({
    where: { id },
    data: {
      nationalId: str(formData, "nationalId") || null,
      nationality: str(formData, "nationality") || emp.nationality,
      contractType: str(formData, "contractType") || emp.contractType,
      contractEndsAt: date("contractEndsAt"),
      idExpiresAt: date("idExpiresAt"),
      housingSAR: Math.max(0, Number(formData.get("housingSAR")) || 0),
      transportSAR: Math.max(0, Number(formData.get("transportSAR")) || 0),
      otherAllowSAR: Math.max(0, Number(formData.get("otherAllowSAR")) || 0),
      gosiSubject: formData.get("gosiSubject") === "on",
      shiftStart: str(formData, "shiftStart") || emp.shiftStart,
      shiftEnd: str(formData, "shiftEnd") || emp.shiftEnd,
      annualLeaveDays: Math.max(0, Number(formData.get("annualLeaveDays")) || emp.annualLeaveDays),
    },
  });

  await audit({ user, action: "update", entity: "employee", entityId: id, summary: `تحديث بيانات التوظيف لـ «${emp.name}»` });
  revalidatePath(`/app/hr/${id}`);
  revalidatePath("/app/hr");
}

export async function generateEmployeeBarcode(formData: FormData) {
  const user = await requireModule("hr");
  const id = str(formData, "employeeId");
  const emp = await db.employee.findFirst({ where: { id, clubId: user.clubId! } });
  if (!emp) return;

  const barcode = `E${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  await db.employee.update({ where: { id }, data: { barcode } });
  await audit({ user, action: "update", entity: "employee", entityId: id, summary: `توليد باركود لـ «${emp.name}»` });
  revalidatePath(`/app/hr/${id}`);
}

// مسير رواتب محسوب من الحضور الفعلي والبدلات والتأمينات
export async function generatePayrollPro(formData: FormData) {
  const user = await requireModule("hr");
  const month = str(formData, "month");
  if (!/^\d{4}-\d{2}$/.test(month)) return;

  const [y, m] = month.split("-").map(Number);
  const from = new Date(y, m - 1, 1);
  const to = new Date(y, m, 0, 23, 59, 59);

  const employees = await db.employee.findMany({
    where: { clubId: user.clubId!, status: { not: "terminated" } },
  });

  let created = 0;
  for (const e of employees) {
    const shifts = await db.staffAttendance.findMany({
      where: { employeeId: e.id, day: { gte: from, lte: to } },
    });

    const absentDays = shifts.filter((s) => s.status === "absent").length;
    const overtimeMinutes = shifts.reduce((s, x) => s + x.overtimeMinutes, 0);
    const workedDays = shifts.filter((s) => s.status === "present").length;

    const calc = computePayroll({
      basicSAR: e.salarySAR,
      housingSAR: e.housingSAR,
      transportSAR: e.transportSAR,
      otherAllowSAR: e.otherAllowSAR,
      isSaudi: e.nationality === "سعودي",
      gosiSubject: e.gosiSubject,
      absentDays,
      overtimeMinutes,
    });

    const done = await db.payroll
      .create({
        data: {
          employeeId: e.id,
          month,
          baseSAR: e.salarySAR,
          housingSAR: e.housingSAR,
          transportSAR: e.transportSAR,
          otherAllowSAR: e.otherAllowSAR,
          overtimeSAR: calc.overtimeSAR,
          absenceSAR: calc.absenceSAR,
          gosiEmpSAR: calc.gosiEmpSAR,
          gosiClubSAR: calc.gosiClubSAR,
          deductionsSAR: calc.absenceSAR + calc.gosiEmpSAR,
          workedDays,
          absentDays,
          netSAR: calc.netSAR,
        },
      })
      .catch(() => null);
    if (done) created++;
  }

  await audit({
    user,
    action: "create",
    entity: "payroll",
    summary: `مسير رواتب ${month} لـ ${created} موظف (محسوب من الحضور والبدلات والتأمينات)`,
  });
  revalidatePath("/app/hr");
}
